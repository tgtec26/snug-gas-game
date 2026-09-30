import { it, expect, beforeEach } from 'vitest';
import { loadDex, addToDex, clearDex, DEX_KEY } from '../game/dex';

beforeEach(() => { localStorage.clear(); clearDex(); });

it('새 카드면 true, 이미 있으면 false, 판을 넘어 저장', () => {
  expect(addToDex('patients', 'rubberball')).toBe(true);
  expect(addToDex('patients', 'rubberball')).toBe(false);
  expect(loadDex().patients).toEqual(['rubberball']);
  expect(JSON.parse(localStorage.getItem(DEX_KEY)!).patients).toEqual(['rubberball']);
});
it('종류가 달라도 같은 id는 따로 센다 (법칙 도장 boyle, 인물 카드 boyle)', () => {
  expect(addToDex('laws', 'boyle')).toBe(true);
  expect(addToDex('people', 'boyle')).toBe(true);
});
it('저장본을 다시 읽으면 이어진다', () => {
  addToDex('particles', 'pressure');
  clearDex(); // 메모리 캐시만 지우는 게 아니라 저장본도 지운다
  expect(loadDex().particles).toEqual([]);
});
it('localStorage가 깨져 있어도 빈 도감', () => {
  localStorage.setItem(DEX_KEY, '{oops');
  expect(loadDex()).toEqual({ patients: [], laws: [], particles: [], people: [] });
});
it('필드 모양이 틀린 저장본은 그 필드만 비운다', () => {
  localStorage.setItem(DEX_KEY, JSON.stringify({ patients: 'x', laws: ['boyle', 3, null], people: ['charles'] }));
  const d = loadDex();
  expect(d.patients).toEqual([]);
  expect(d.laws).toEqual(['boyle']);
  expect(d.people).toEqual(['charles']);
});
