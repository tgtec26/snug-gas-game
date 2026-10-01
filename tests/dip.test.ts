import { describe, it, expect } from 'vitest';
import experiments from '../public/data/experiments.json';
import patients from '../public/data/patients.json';
import layout from '../public/data/layout.json';
import type { Experiments, Patient } from '../game/types';
import type { Layout } from '../game/layout';
import { validateLayout } from '../game/layout';
import { createExam, tickExam, type ExamState } from '../game/exam';
import { resolveSyringe, dipTarget, stepDip, waterTopY, type DipResolved } from '../game/dip';

const cfg = experiments as unknown as Experiments;
const L = (layout as unknown as Layout).dip;
const foil = (patients as unknown as Patient[]).find(p => p.id === 'foilballoon')!;
const GEAR = cfg.gear;
const DEEP = 600;

describe('담그기 배치', () => {
  it('layout.json의 dip 배치가 유효하다', () => { expect(validateLayout(layout as unknown as Layout)).toEqual([]); });
  it('깊이 담그면 기체가 모두 잠길 수 있다 (비커가 충분히 깊다)', () => {
    const r = resolveSyringe(L, cfg, GEAR, L.cold.x, DEEP);
    expect(r.submerged).toBe(true);
  });
});

describe('resolveSyringe', () => {
  it('비커 밖 허공에서는 잠기지 않는다', () => {
    const r = resolveSyringe(L, cfg, GEAR, (L.hot.x + L.cold.x) / 2, 400);
    expect(r.beaker).toBeNull(); expect(r.submerged).toBe(false);
  });
  it('수면에 노즐만 닿으면 기체 윗부분이 물 밖이라 잠긴 것이 아니다', () => {
    const r = resolveSyringe(L, cfg, GEAR, L.cold.x, waterTopY(L, 'cold') + 5);
    expect(r.beaker).toBe('cold'); expect(r.submerged).toBe(false);
  });
  it('비커 벽은 옆으로 지나갈 수 없다 (벽 바깥으로 밀어낸다)', () => {
    const r = resolveSyringe(L, cfg, GEAR, L.cold.x + L.cold.w / 2, DEEP);
    expect(Math.abs(r.x - L.cold.x)).toBeGreaterThanOrEqual(L.cold.w / 2);
    expect(r.beaker).toBeNull();
  });
  it('비커 테두리보다 위에서는 벽을 넘어 지나갈 수 있다', () => {
    const r = resolveSyringe(L, cfg, GEAR, L.cold.x + L.cold.w / 2, L.cold.top - 40);
    expect(r.x).toBe(L.cold.x + L.cold.w / 2);
  });
  it('장비를 안 끼면 뜨거운 물에 못 들어가고 blockedGear', () => {
    const r = resolveSyringe(L, cfg, ['gloves'], L.hot.x, DEEP);
    expect(r.beaker).toBeNull(); expect(r.blockedGear).toBe(true); expect(r.y).toBeLessThan(L.hot.top);
  });
  it('장비를 안 껴도 얼음물은 된다 / 장비를 끼면 뜨거운 물도 된다', () => {
    expect(resolveSyringe(L, cfg, [], L.cold.x, DEEP).submerged).toBe(true);
    expect(resolveSyringe(L, cfg, GEAR, L.hot.x, DEEP).submerged).toBe(true);
  });
  it('위에서 장비 없이 접근만 하면(들어가지 않으면) blockedGear가 아니다', () => {
    expect(resolveSyringe(L, cfg, [], L.hot.x, L.hot.top - 40).blockedGear).toBe(false);
  });
});

describe('온도 변화와 재현 판정', () => {
  const dip = (st: ExamState, r: DipResolved, ms: number) => {
    let s = st; const ev: string[] = [];
    for (let t = 0; t < ms; t += 16) {
      s = stepDip(cfg, s, r, 16);
      const o = tickExam(cfg, foil, s, 16); s = o.state; ev.push(...o.events.map(e => e.type));
    }
    return { s, ev };
  };
  const cold = resolveSyringe(L, cfg, [], L.cold.x, DEEP);
  const hot = resolveSyringe(L, cfg, GEAR, L.hot.x, DEEP);

  it('목표: 얼음물 -, 뜨거운 물 +, 물 밖 0', () => {
    expect(dipTarget(cfg, cold)).toBe(cfg.dip.coldStep);
    expect(dipTarget(cfg, hot)).toBe(cfg.dip.hotStep);
    expect(dipTarget(cfg, resolveSyringe(L, cfg, GEAR, 500, 300))).toBe(0);
  });
  it('온도는 서서히 변한다 (한 프레임에 다 변하지 않는다)', () => {
    const s = stepDip(cfg, createExam(cfg, foil), cold, 16);
    expect(s.device.tempStep).toBeGreaterThan(cfg.dip.coldStep); expect(s.device.tempStep).toBeLessThan(0);
  });
  it('얼음물 → 뜨거운 물 순서로 담그면 두 step이 차례로 끝난다', () => {
    const a = dip(createExam(cfg, foil), cold, 3000);
    expect(a.ev).toContain('step-done');
    const b = dip(a.s, hot, 5000);
    expect(b.ev).toContain('all-done');
  });
  it('물 밖에서는 아무것도 완료되지 않는다', () => {
    const out = resolveSyringe(L, cfg, GEAR, 500, 300);
    expect(dip(createExam(cfg, foil), out, 5000).ev).toEqual([]);
  });
});
