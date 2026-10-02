import { describe, it, expect } from 'vitest';
import experiments from '../public/data/experiments.json';
import layout from '../public/data/layout.json';
import type { Experiments } from '../game/types';
import { curveSamples, toGraph, plotArea, GRAPH_P_MAX } from '../game/graph';

const cfg = experiments as unknown as Experiments;
const rect = (layout as unknown as { clinic: { graph: { x: number; y: number; w: number; h: number } } }).clinic.graph;

describe('압력–부피 그래프 (교과서 Ⅵ-3: 가로 압력, 세로 부피, 원점에서 시작)', () => {
  it('원점은 축이 만나는 모서리다', () => {
    const a = plotArea(rect); const o = toGraph(rect, cfg, 0, 0);
    expect(o.X).toBe(a.ox); expect(o.Y).toBe(a.oy);
  });
  it('곡선 위의 모든 점은 압력×부피가 같다 (반비례)', () => {
    const s = curveSamples(cfg, cfg.syringe.max, 8, 30);
    for (const q of s) expect(q.p * q.v).toBeCloseTo(cfg.syringe.start, 6);
  });
  it('부피가 줄수록 압력이 늘고, 곡선은 아래로 볼록하다 (일차식이 아니다)', () => {
    const s = curveSamples(cfg, cfg.syringe.max, 8, 30);
    for (let i = 1; i < s.length; i++) { expect(s[i].p).toBeGreaterThan(s[i - 1].p); expect(s[i].v).toBeLessThan(s[i - 1].v); }
    // 같은 압력 간격에서 부피가 줄어드는 폭이 점점 작아진다
    const drops = s.slice(1).map((q, i) => s[i].v - q.v);
    for (let i = 1; i < drops.length; i++) expect(drops[i]).toBeLessThan(drops[i - 1]);
  });
  it('끝까지 늘린 곡선이 상자 안에 들어가고 두 축에 가까워진다', () => {
    const s = curveSamples(cfg, cfg.syringe.max, cfg.syringe.start / GRAPH_P_MAX, 30).map(q => toGraph(rect, cfg, q.p, q.v));
    const a = plotArea(rect);
    for (const q of s) { expect(q.X).toBeGreaterThanOrEqual(a.ox); expect(q.X).toBeLessThanOrEqual(a.ox + a.pw + 0.5); expect(q.Y).toBeLessThanOrEqual(a.oy); expect(q.Y).toBeGreaterThanOrEqual(a.oy - a.ph - 0.5); }
    const first = s[0], last = s[s.length - 1];
    expect(first.Y - (a.oy - a.ph)).toBeLessThan(2);          // 왼쪽 끝은 위쪽 끝에 닿고
    expect(last.X - (a.ox + a.pw)).toBeGreaterThan(-2);       // 오른쪽 끝은 가로 끝에 닿는다
  });
});
