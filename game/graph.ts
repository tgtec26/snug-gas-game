import type { Experiments } from './types';
import { needleFromVolume } from './rules';

/** 가로축(압력) 끝: 시작 압력의 몇 배까지 그리는가. 교과서 그림 Ⅵ-3처럼 곡선이 가로축에 가까워지는 모양이 보이게 한다. */
export const GRAPH_P_MAX = 2.4;

export interface GraphRect { x: number; y: number; w: number; h: number }

/** 축 안쪽 그리는 영역. 원점(ox, oy)은 두 축이 만나는 모서리다(축을 0에서 시작). */
export function plotArea(r: GraphRect) {
  return { ox: r.x + 34, oy: r.y + r.h - 30, pw: r.w - 34 - 22, ph: r.h - 30 - 22 };
}

/** 가로는 압력(시작 압력=1인 상대 값, 수치는 화면에 쓰지 않는다), 세로는 부피(0~주사기 최대). */
export function toGraph(r: GraphRect, cfg: Experiments, pressure: number, volume: number) {
  const a = plotArea(r);
  return { X: a.ox + (pressure / GRAPH_P_MAX) * a.pw, Y: a.oy - (volume / cfg.syringe.max) * a.ph };
}

/** 반비례 곡선(압력×부피=일정) 위의 점들. 부피 vFrom에서 vTo까지 압력을 고르게 나눠 뽑는다. */
export function curveSamples(cfg: Experiments, vFrom: number, vTo: number, n = 24): { p: number; v: number }[] {
  const p0 = needleFromVolume(vFrom, cfg.syringe.start), p1 = needleFromVolume(vTo, cfg.syringe.start);
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = p0 + ((p1 - p0) * i) / n;
    return { p, v: cfg.syringe.start / p };
  });
}
