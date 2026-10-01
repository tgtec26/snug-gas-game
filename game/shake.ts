/** 구슬 흔들기 튜토리얼(교과서 199쪽 쇠구슬 비유). 병 속 구슬이 움직이는 벽에 부딪힌 세기로 손바닥 힘 게이지가 오른다. */
export interface Ball { x: number; y: number; vx: number; vy: number }
export interface ShakeConfig {
  balls: number;          // 쇠구슬 개수
  gain: number;           // 부딪힌 상대 속력(px/초) 1당 게이지 증가량
  decayPerSec: number;    // 가만히 있으면 게이지가 줄어드는 속도(1/초)
  hitMinSpeed: number;    // 이보다 약한 부딪힘은 세지 않는다(px/초)
}
export interface Bottle { x: number; y: number; w: number; h: number }   // y는 바닥 기준
export interface ShakeState { balls: Ball[]; gauge: number; bottleX: number }
export interface ShakeHit { x: number; y: number; speed: number }

export const BALL_R = 9;
const GRAVITY = 1400;
const REST = 0.55;     // 반발 계수
const SPEED_CAP = 700; // 한 번의 부딪힘이 줄 수 있는 세기의 한계(px/초): 너무 세게 흔들어도 한순간에 차지 않게

export function validateShake(c: ShakeConfig): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(c.balls) || c.balls <= 0) errs.push('shake.balls는 0보다 큰 정수여야 한다');
  for (const k of ['gain', 'hitMinSpeed'] as const) if (!(c[k] > 0)) errs.push(`shake.${k}는 0보다 커야 한다`);
  if (!(c.decayPerSec >= 0)) errs.push('shake.decayPerSec는 0 이상이어야 한다');
  return errs;
}

/** 병 바닥에 구슬을 가만히 깔아 둔다. */
export function createShake(cfg: ShakeConfig, b: Bottle, rand: () => number = Math.random): ShakeState {
  const balls: Ball[] = Array.from({ length: cfg.balls }, (_, i) => {
    const cols = Math.max(1, Math.floor((b.w - 2 * BALL_R) / (2 * BALL_R)));
    return { x: b.x - b.w / 2 + BALL_R + ((i % cols) + rand() * 0.2) * 2 * BALL_R, y: b.y - BALL_R - Math.floor(i / cols) * 2 * BALL_R, vx: 0, vy: 0 };
  });
  return { balls, gauge: 0, bottleX: b.x };
}

/**
 * dtSec만큼 진행. 병이 bottleX로 옮겨 가며 벽이 움직이고, 구슬은 움직이는 벽에 튕긴다.
 * 병이 정지하면 구슬도 바닥에 가라앉아 게이지가 오르지 않는다.
 */
export function stepShake(
  cfg: ShakeConfig, b: Bottle, st: ShakeState, bottleX: number, dtSec: number,
): { state: ShakeState; hits: ShakeHit[] } {
  const dt = Math.max(1e-4, dtSec);
  const wallV = (bottleX - st.bottleX) / dt;
  const L = bottleX - b.w / 2 + BALL_R, R = bottleX + b.w / 2 - BALL_R;
  const top = b.y - b.h + BALL_R, bottom = b.y - BALL_R;
  const hits: ShakeHit[] = []; let gain = 0;
  const balls = st.balls.map(p => {
    let { x, y, vx, vy } = p;
    vy += GRAVITY * dt; x += vx * dt; y += vy * dt;
    if (x < L) { const rel = vx - wallV; x = L; if (rel < 0) { vx = wallV - rel * REST; if (-rel > cfg.hitMinSpeed) { hits.push({ x, y, speed: -rel }); gain += Math.min(-rel, SPEED_CAP) * cfg.gain; } } else vx = Math.max(vx, wallV); }
    else if (x > R) { const rel = vx - wallV; x = R; if (rel > 0) { vx = wallV - rel * REST; if (rel > cfg.hitMinSpeed) { hits.push({ x, y, speed: rel }); gain += Math.min(rel, SPEED_CAP) * cfg.gain; } } else vx = Math.min(vx, wallV); }
    if (y < top) { y = top; if (vy < 0) { if (-vy > cfg.hitMinSpeed) { hits.push({ x, y, speed: -vy }); gain += Math.min(-vy, SPEED_CAP) * cfg.gain; } vy = -vy * REST; } }
    else if (y > bottom) { y = bottom; if (vy > 0) { if (vy > cfg.hitMinSpeed * 3) { hits.push({ x, y, speed: vy }); gain += Math.min(vy, SPEED_CAP) * cfg.gain * 0.3; } vy = -vy * REST; if (Math.abs(vy) < 40) vy = 0; } vx *= 0.98; }
    return { x, y, vx, vy };
  });
  // 구슬끼리 겹치지 않게 밀어내고 부딪힌 방향의 속도를 맞바꾼다(같은 질량)
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], c = balls[j]; const dx = c.x - a.x, dy = c.y - a.y; const d2 = dx * dx + dy * dy;
    if (d2 >= 4 * BALL_R * BALL_R || d2 === 0) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (2 * BALL_R - d) / 2;
    a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
    const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
    if (rv < 0) { const j2 = (-(1 + REST) * rv) / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny; }
  }
  for (const p of balls) { p.x = Math.min(R, Math.max(L, p.x)); p.y = Math.min(bottom, Math.max(top, p.y)); }
  const gauge = Math.min(1, Math.max(0, st.gauge + gain - cfg.decayPerSec * dtSec));
  return { state: { balls, gauge, bottleX }, hits };
}
