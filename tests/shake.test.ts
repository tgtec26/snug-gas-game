import { describe, it, expect } from 'vitest';
import minigame from '../public/data/minigame-config.json';
import { createShake, stepShake, validateShake, BALL_R, type ShakeConfig } from '../game/shake';

const cfg = (minigame as unknown as { shake: ShakeConfig }).shake;
const seeded = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const B = { x: 500, y: 600, w: 150, h: 260 };

/** 병을 amp(px), hz로 좌우로 흔든다 */
function shake(amp: number, hz: number, sec: number) {
  let st = createShake(cfg, B, seeded()); let hits = 0; let full = -1;
  for (let t = 0; t < sec; t += 1 / 60) {
    const r = stepShake(cfg, B, st, B.x + amp * Math.sin(2 * Math.PI * hz * t), 1 / 60);
    st = r.state; hits += r.hits.length; if (full < 0 && st.gauge >= 1) full = t;
  }
  return { st, hits, full };
}

describe('구슬 흔들기', () => {
  it('설정이 유효하고 잘못된 값을 잡는다', () => {
    expect(validateShake(cfg)).toEqual([]);
    expect(validateShake({ ...cfg, balls: 0 }).length).toBeGreaterThan(0);
    expect(validateShake({ ...cfg, gain: -1 }).length).toBeGreaterThan(0);
  });
  it('구슬 개수는 설정대로이고 절대 바뀌지 않는다', () => {
    expect(shake(60, 2.5, 5).st.balls).toHaveLength(cfg.balls);
  });
  it('구슬은 항상 병 안에 있다', () => {
    const { st } = shake(80, 3, 8);
    for (const p of st.balls) {
      expect(p.x).toBeGreaterThanOrEqual(st.bottleX - B.w / 2 + BALL_R - 1e-6); expect(p.x).toBeLessThanOrEqual(st.bottleX + B.w / 2 - BALL_R + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(B.y - B.h + BALL_R - 1e-6); expect(p.y).toBeLessThanOrEqual(B.y - BALL_R + 1e-6);
    }
  });
  it('가만히 두거나 아주 살살 흔들면 게이지가 거의 오르지 않는다', () => {
    expect(shake(0, 0, 10).st.gauge).toBeLessThan(0.02);
    expect(shake(20, 1, 20).st.gauge).toBeLessThan(0.05);
  });
  it('세게 흔들수록 게이지가 많이 오른다 (천천히 조금, 세게 많이)', () => {
    const slow = shake(40, 2, 10).st.gauge, mid = shake(60, 2.5, 10).st.gauge, hard = shake(80, 3, 10).st.gauge;
    expect(mid).toBeGreaterThan(slow); expect(hard).toBeGreaterThan(mid);
  });
  it('세게 흔들면 한순간에 차지 않고 수십 초 안에 찬다', () => {
    const r = shake(80, 3, 60);
    expect(r.full).toBeGreaterThan(5); expect(r.full).toBeLessThan(40);
  });
  it('흔들다 멈추면 게이지가 서서히 줄어든다', () => {
    let st = shake(80, 3, 3).st; const g0 = st.gauge;
    for (let t = 0; t < 5; t += 1 / 60) st = stepShake(cfg, B, st, st.bottleX, 1 / 60).state;
    expect(st.gauge).toBeLessThan(g0);
  });
  it('벽에 부딪힐 때마다 hit이 나오고 부딪힌 세기가 양수다', () => {
    let st = createShake(cfg, B, seeded()); const all: number[] = [];
    for (let t = 0; t < 3; t += 1 / 60) { const r = stepShake(cfg, B, st, B.x + 70 * Math.sin(t * 18), 1 / 60); st = r.state; all.push(...r.hits.map(h => h.speed)); }
    expect(all.length).toBeGreaterThan(20); expect(all.every(s => s > 0)).toBe(true);
  });
});
