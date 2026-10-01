import { describe, it, expect } from 'vitest';
import layout from '../public/data/layout.json';
import { validateLayout, type Layout } from '../game/layout';

const real = layout as unknown as Layout;
const clone = () => structuredClone(real) as Layout;

describe('layout.json', () => {
  it('오류가 없다', () => { expect(validateLayout(real)).toEqual([]); });
  it('무대 밖 좌표를 잡는다', () => {
    const l = clone(); l.clinic.gauge.x = 1400;
    expect(validateLayout(l).join()).toContain('clinic.gauge.x');
    const m = clone(); m.clinic.dial.y = -5;
    expect(validateLayout(m).join()).toContain('clinic.dial.y');
  });
  it('0 이하 크기를 잡는다', () => {
    const l = clone(); l.clinic.gauge.size = 0;
    expect(validateLayout(l).join()).toContain('clinic.gauge.size');
  });
  it('숫자가 아닌 값·빠진 값을 잡는다', () => {
    const l = clone(); (l.clinic.dial as unknown as { r: unknown }).r = 'big';
    expect(validateLayout(l).join()).toContain('clinic.dial.r');
    const m = clone(); delete (m.clinic as unknown as Record<string, unknown>).reset;
    expect(validateLayout(m).length).toBeGreaterThan(0);
  });
  it('통이 주사기를 감싸지 않으면 잡는다', () => {
    const l = clone(); l.clinic.beaker.w = l.clinic.barrel.w;
    expect(validateLayout(l).join()).toContain('통이 주사기보다 넓어야');
    const m = clone(); m.clinic.barrel.top = m.clinic.barrel.bottom + 1;
    expect(validateLayout(m).join()).toContain('barrel');
  });
});
