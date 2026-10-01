import type { Change, Device, Experiments, ParticleRule, Variable } from './types';
import { particleView } from './rules';

/** 입자 하나. u, v는 용기 안의 상대 위치(0~1)라서 용기 크기가 변해도 위치가 따라간다. 속도는 px/초. */
export interface Particle { u: number; v: number; vx: number; vy: number }
export interface Box { w: number; h: number }
export interface Hit { x: number; y: number }

export const PARTICLE_RADIUS = 7;
const BASE_SPEED = 90;   // px/초. 온도 단계가 0일 때의 빠르기(표시용)

/** 표시용 입자 N개. 개수는 이후 절대 바뀌지 않는다. */
export function createParticles(n: number, rand: () => number = Math.random): Particle[] {
  return Array.from({ length: n }, () => {
    const a = rand() * Math.PI * 2;
    return { u: 0.1 + rand() * 0.8, v: 0.1 + rand() * 0.8, vx: Math.cos(a) * BASE_SPEED, vy: Math.sin(a) * BASE_SPEED };
  });
}

/** 온도 단계가 오를수록 입자가 빨라진다(교과서 222쪽). 압력을 바꿀 때는 온도 단계가 0이라 늘 같다. */
export const speedFactor = (d: Device): number => Math.max(0.2, 1 + d.tempStep * 0.2);

/** 표시용 용기 크기. 높이는 부피에 비례한다. */
export const boxFor = (volume: number, pxPerMl: number, w: number): Box => ({ w, h: volume * pxPerMl });

/** dtSec만큼 진행: 벽에 튕기고 속도는 speed 배율에 맞춘다. 부딪힌 자리(px)를 돌려준다. */
export function stepParticles(ps: Particle[], box: Box, factor: number, dtSec: number): { ps: Particle[]; hits: Hit[] } {
  const hits: Hit[] = []; const R = PARTICLE_RADIUS; const sp = BASE_SPEED * factor;
  const out = ps.map(p => {
    const len = Math.hypot(p.vx, p.vy) || 1;
    let vx = (p.vx / len) * sp, vy = (p.vy / len) * sp;
    let x = p.u * box.w + vx * dtSec, y = p.v * box.h + vy * dtSec;
    let hit = false;
    if (x < R) { x = R; vx = Math.abs(vx); hit = true; } else if (x > box.w - R) { x = box.w - R; vx = -Math.abs(vx); hit = true; }
    if (y < R) { y = R; vy = Math.abs(vy); hit = true; } else if (y > box.h - R) { y = box.h - R; vy = -Math.abs(vy); hit = true; }
    if (hit) hits.push({ x, y });
    return { u: x / box.w, v: y / box.h, vx, vy };
  });
  return { ps: out, hits };
}

/** 지금 하고 있는 조작: 어느 변인을 올리는가 내리는가. 조작이 없으면 null. */
export function currentOp(cfg: Experiments, d: Device, used: Variable | null): { variable: Variable; change: Change } | null {
  if (used === 'pressure') {
    if (d.piston === cfg.syringe.start) return null;
    return { variable: 'pressure', change: d.piston < cfg.syringe.start ? 'up' : 'down' };
  }
  if (used === 'temperature') {
    if (d.tempStep === 0) return null;
    return { variable: 'temperature', change: d.tempStep > 0 ? 'up' : 'down' };
  }
  return null;
}

/** 렌즈가 강조할 칸. 조작이 없거나 교과서에 없는 칸이면 강조 없음. */
export function emphasis(rules: ParticleRule[], op: { variable: Variable; change: Change } | null) {
  const r = op ? particleView(rules, op.variable, op.change) : null;
  return { distance: !!r?.distance, strength: !!r?.strength };
}

export const MOVE_GRACE_MS = 400;   // 키를 한 번 눌러도 이만큼은 '움직이는 중'으로 본다

/**
 * 렌즈를 댄 채 조절기가 움직인 시간을 쌓는다. 움직인 뒤 MOVE_GRACE_MS 동안은 계속 움직이는 중으로 센다
 * (키보드는 한 번에 한 프레임만 값이 바뀌기 때문).
 */
export function trackObservation(
  prev: { volume: number; tempStep: number } | null, cur: { volume: number; tempStep: number },
  acc: { movingMs: number; sinceMoveMs: number }, dtMs: number,
): { movingMs: number; sinceMoveMs: number } {
  if (!prev) return acc;
  const moved = Math.abs(cur.volume - prev.volume) > 0.01 || Math.abs(cur.tempStep - prev.tempStep) > 0.001;
  const sinceMoveMs = moved ? 0 : acc.sinceMoveMs + dtMs;
  return { sinceMoveMs, movingMs: moved || sinceMoveMs < MOVE_GRACE_MS ? acc.movingMs + dtMs : acc.movingMs };
}
