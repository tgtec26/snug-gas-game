import { describe, it, expect, beforeEach } from 'vitest';
import patients from '../public/data/patients.json';
import type { Patient } from '../game/types';
import { summarize } from '../game/summary';
import { addToDex, freshCards, clearFresh, clearDex } from '../game/dex';

const ps = patients as unknown as Patient[];

describe('요약', () => {
  it('치료한 환자 수·별·잘못 돌린 횟수', () => {
    const s = summarize({
      records: { rubberball: { stars: 3, wrongGauge: 0 }, snackbag: { stars: 2, wrongGauge: 2 } },
      emergencyResults: [true, true, false, true],
    }, ps);
    expect(s).toEqual({ treated: 5, total: 8, stars: 5 + 2, wrongGauge: 2 });
  });
  it('기록이 없으면 모두 0', () => {
    expect(summarize({ records: {}, emergencyResults: [] }, ps)).toEqual({ treated: 0, total: 8, stars: 0, wrongGauge: 0 });
  });
});

describe('이번 판에 새로 얻은 카드', () => {
  beforeEach(() => { clearDex(); clearFresh(); });
  it('처음 얻은 카드만 기록하고, 이미 있는 카드는 기록하지 않는다', () => {
    addToDex('laws', 'boyle'); addToDex('laws', 'boyle'); addToDex('particles', 'pressure');
    expect(freshCards()).toEqual(['laws:boyle', 'particles:pressure']);
    clearFresh(); expect(freshCards()).toEqual([]);
  });
});
