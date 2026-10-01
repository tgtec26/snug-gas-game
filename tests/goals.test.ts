import { describe, it, expect } from 'vitest';
import patients from '../public/data/patients.json';
import dialog from '../public/data/dialog-config.json';
import type { Patient } from '../game/types';
import { goalFor, type Goals } from '../game/goals';
import { sentenceCount, FORBIDDEN, collectStrings } from '../game/validators';

const ps = patients as unknown as Patient[];
const goals = (dialog as unknown as { goals: Goals }).goals;
const by = (id: string) => ps.find(p => p.id === id)!;

describe('상단 안내(goals)', () => {
  it('모든 환자의 모든 step에 안내가 있다', () => {
    for (const p of ps) p.steps.forEach((_, i) => expect(goalFor(goals, p, i).length, `${p.id} ${i}`).toBeGreaterThan(5));
  });
  it('진료 종류에 맞는 안내', () => {
    expect(goalFor(goals, by('rubberball'), 0)).toBe(goals.measure.cause);
    expect(goalFor(goals, by('rubberball'), 1)).toBe(goals.measure.explore);
    expect(goalFor(goals, by('snackbag'), 0)).toBe(goals.pressure.cause);
    expect(goalFor(goals, by('soccerball'), 1)).toBe(goals.temperature.explore);
    expect(goalFor(goals, by('foilballoon'), 0)).toBe(goals.dipCold);   // 얼음물(내림)
    expect(goalFor(goals, by('foilballoon'), 1)).toBe(goals.dipHot);
    expect(goalFor(goals, by('ppball'), 0)).toBe(goals.dipHot);         // 응급실 탁구공: 뜨거운 물
  });
  it('한 줄(1문장), 금지어·숫자 없음', () => {
    for (const s of collectStrings(goals)) {
      expect(sentenceCount(s), s).toBe(1);
      for (const w of FORBIDDEN) expect(s).not.toContain(w);
      expect(/\d/.test(s), s).toBe(false);
    }
  });
});
