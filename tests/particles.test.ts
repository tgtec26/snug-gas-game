import { describe, it, expect } from 'vitest';
import experiments from '../public/data/experiments.json';
import rules from '../public/data/particle-rules.json';
import type { Experiments, ParticleRule } from '../game/types';
import { checkLensObserved } from '../game/rules';
import {
  createParticles, stepParticles, speedFactor, boxFor, currentOp, emphasis, trackObservation, PARTICLE_RADIUS,
} from '../game/particles';

const cfg = experiments as unknown as Experiments;
const pr = rules as unknown as ParticleRule[];
/** 재현 가능한 난수 */
const seeded = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function simulate(n: number, box: { w: number; h: number }, factor: number, sec: number) {
  let ps = createParticles(n, seeded()); let hits = 0;
  for (let t = 0; t < sec; t += 1 / 60) { const r = stepParticles(ps, box, factor, 1 / 60); ps = r.ps; hits += r.hits.length; }
  return { ps, hits };
}

describe('입자 시뮬레이션', () => {
  it('입자 개수는 절대 바뀌지 않는다', () => {
    const { ps } = simulate(14, { w: 150, h: 220 }, 1, 5);
    expect(ps).toHaveLength(14);
  });
  it('입자는 벽 안에 머문다', () => {
    const box = { w: 150, h: 120 };
    const { ps } = simulate(14, box, 1.6, 5);
    for (const p of ps) {
      expect(p.u * box.w).toBeGreaterThanOrEqual(PARTICLE_RADIUS - 1e-6); expect(p.u * box.w).toBeLessThanOrEqual(box.w - PARTICLE_RADIUS + 1e-6);
      expect(p.v * box.h).toBeGreaterThanOrEqual(PARTICLE_RADIUS - 1e-6); expect(p.v * box.h).toBeLessThanOrEqual(box.h - PARTICLE_RADIUS + 1e-6);
    }
  });
  it('압력을 높여 부피가 줄면 벽 충돌이 잦아진다 (입자 속도는 같다)', () => {
    const big = simulate(14, boxFor(28, 11, 150), speedFactor({ piston: 28, tempStep: 0 }), 6).hits;
    const small = simulate(14, boxFor(12, 11, 150), speedFactor({ piston: 12, tempStep: 0 }), 6).hits;
    expect(small).toBeGreaterThan(big);
    expect(speedFactor({ piston: 12, tempStep: 0 })).toBe(speedFactor({ piston: 28, tempStep: 0 }));
  });
  it('온도가 오르면 입자가 빨라지고 내리면 느려진다', () => {
    expect(speedFactor({ piston: 20, tempStep: 3 })).toBeGreaterThan(speedFactor({ piston: 20, tempStep: 0 }));
    expect(speedFactor({ piston: 20, tempStep: -3 })).toBeLessThan(speedFactor({ piston: 20, tempStep: 0 }));
    expect(speedFactor({ piston: 20, tempStep: -4 })).toBeGreaterThan(0);
  });
  it('입자 속력은 배율에 정확히 맞는다', () => {
    const r = stepParticles(createParticles(5, seeded()), { w: 150, h: 200 }, 1.5, 1 / 60);
    const sp = Math.hypot(r.ps[0].vx, r.ps[0].vy);
    const base = Math.hypot(...[stepParticles(createParticles(5, seeded()), { w: 150, h: 200 }, 1, 1 / 60).ps[0]].map(p => [p.vx, p.vy]).flat() as [number, number]);
    expect(sp / base).toBeCloseTo(1.5, 5);
  });
});

describe('렌즈 강조 규칙', () => {
  it('조작이 없으면 강조 없음', () => {
    expect(currentOp(cfg, { piston: 20, tempStep: 0 }, null)).toBeNull();
    expect(emphasis(pr, null)).toEqual({ distance: false, strength: false });
  });
  it('압력 조작: 사이 거리를 강조하고 세기는 강조하지 않는다', () => {
    const op = currentOp(cfg, { piston: 14, tempStep: 0 }, 'pressure');
    expect(op).toEqual({ variable: 'pressure', change: 'up' });
    expect(emphasis(pr, op)).toEqual({ distance: true, strength: false });
    expect(currentOp(cfg, { piston: 26, tempStep: 0 }, 'pressure')?.change).toBe('down');
  });
  it('온도 조작: 세기를 강조하고 거리는 강조하지 않는다', () => {
    const op = currentOp(cfg, { piston: 20, tempStep: -2 }, 'temperature');
    expect(op).toEqual({ variable: 'temperature', change: 'down' });
    expect(emphasis(pr, op)).toEqual({ distance: false, strength: true });
  });
});

describe('렌즈 관찰 기록', () => {
  const idle = { movingMs: 0, sinceMoveMs: 1e9 };
  it('가만히 있으면 쌓이지 않는다', () => {
    let a = idle; const prev = { volume: 20, tempStep: 0 };
    for (let i = 0; i < 100; i++) a = trackObservation(prev, { ...prev }, a, 16);
    expect(a.movingMs).toBe(0);
  });
  it('계속 움직이면 그 시간만큼 쌓여 관찰로 인정된다', () => {
    let a = idle; let prev = { volume: 20, tempStep: 0 };
    for (let i = 0; i < 150; i++) { const cur = { volume: prev.volume - 0.05, tempStep: 0 }; a = trackObservation(prev, cur, a, 16); prev = cur; }
    expect(a.movingMs).toBe(150 * 16);
    expect(checkLensObserved(cfg, a.movingMs)).toBe(true);
  });
  it('키를 한 번 누르면 움직임 직후 유예 시간만 더해진다', () => {
    let a = idle; let prev = { volume: 20, tempStep: 0 };
    a = trackObservation(prev, { volume: 19, tempStep: 0 }, a, 16); prev = { volume: 19, tempStep: 0 };
    for (let i = 0; i < 100; i++) a = trackObservation(prev, { ...prev }, a, 16);
    expect(a.movingMs).toBeGreaterThan(300); expect(a.movingMs).toBeLessThan(500);
  });
});
