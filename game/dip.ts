import type { Experiments } from './types';
import type { DipLayout } from './layout';
import type { ExamState } from './exam';
import { checkSafetyGear, checkSubmerged, clamp } from './rules';

export type Beaker = 'hot' | 'cold';

/** 주사기(노즐 끝 기준 위치)를 화면 규칙에 맞게 놓은 결과 */
export interface DipResolved { x: number; y: number; beaker: Beaker | null; submerged: boolean; blockedGear: boolean }

/** 수면의 화면 y */
export const waterTopY = (L: DipLayout, b: Beaker): number => L[b].top + L.waterInset;

/** 노즐 끝 y가 주어질 때 기체 윗부분의 화면 y. 잠김 판정은 시작 부피 기준(기체가 부풀어 올라도 깜박이지 않게). */
export const gasTopY = (L: DipLayout, cfg: Experiments, tipY: number): number =>
  tipY - L.syringe.nozzle - cfg.syringe.start * L.syringe.pxPerMl;

/**
 * 끌어 놓은 위치(x, y)를 실제 놓이는 위치로 바꾼다.
 * 비커 벽은 옆으로 지나갈 수 없고(벽이 밀어낸다), 뜨거운 물은 장비를 모두 착용해야 들어갈 수 있다.
 * 기체가 모두 수면 아래에 있어야 submerged.
 */
export function resolveSyringe(
  L: DipLayout, cfg: Experiments, worn: string[], x: number, y: number,
): DipResolved {
  const s = L.syringe; const half = s.w / 2;
  let cx = clamp(x, s.minX, s.maxX); let cy = clamp(y, s.minY, s.maxY);
  let beaker: Beaker | null = null; let blockedGear = false;
  for (const k of ['hot', 'cold'] as const) {
    const b = L[k]; const dx = Math.abs(cx - b.x);
    if (dx <= b.w / 2 - half - 4) {
      if (k === 'hot' && !checkSafetyGear(cfg, worn)) {
        if (cy > b.top - 8) blockedGear = true;
        cy = Math.min(cy, b.top - 8);
      } else if (cy > b.top) beaker = k;
    } else if (dx < b.w / 2 + half && cy > b.top - 8) {
      cx = b.x + Math.sign(cx - b.x || 1) * (b.w / 2 + half);   // 벽이 옆으로 막는다
    }
  }
  const submerged = beaker !== null && checkSubmerged(gasTopY(L, cfg, cy), waterTopY(L, beaker));
  return { x: cx, y: cy, beaker, submerged, blockedGear };
}

/** 잠긴 비커가 정하는 온도 단계 목표. 물 밖이면 처음 온도(0). */
export function dipTarget(cfg: Experiments, r: DipResolved): number {
  if (!r.submerged || !r.beaker) return 0;
  return r.beaker === 'hot' ? cfg.dip.hotStep : cfg.dip.coldStep;
}

/** dtMs만큼 온도가 목표를 향해 움직인다. 처음 잠기는 순간 '온도 조절기를 쓴 것'으로 기록한다. */
export function stepDip(cfg: Experiments, st: ExamState, r: DipResolved, dtMs: number): ExamState {
  if (st.done) return st;
  const target = dipTarget(cfg, r);
  const cur = st.device.tempStep;
  const d = target - cur;
  const max = (cfg.dip.rate * dtMs) / 1000;
  const next = Math.abs(d) <= max ? target : cur + Math.sign(d) * max;
  const used = st.used ?? (r.submerged ? 'temperature' : null);
  return {
    ...st, used,
    firstUsed: st.firstUsed ?? (r.submerged ? 'temperature' : null),
    device: { piston: cfg.syringe.start, tempStep: next },
  };
}
