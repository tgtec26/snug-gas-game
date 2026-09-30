import { describe, it, expect } from 'vitest';
import patients from '../public/data/patients.json';
import type { Patient } from '../game/types';
import { storyPlan, STORY_SCENES } from '../game/story';

const ps = patients as unknown as Patient[];

describe('사연 장면 계획 (글 없이 계기와 환자 모양으로 원인을 보여 준다)', () => {
  it('모든 환자의 사연 장면 id에 그림이 있다', () => {
    for (const p of ps) expect(STORY_SCENES as readonly string[], p.id).toContain(p.scene);
  });
  it('계기는 변인과 같은 종류 (압력 → 압력 센서, 온도 → 온도계)', () => {
    for (const p of ps) expect(storyPlan(p).gauge, p.id).toBe(p.variable === 'pressure' ? 'pressure-sensor' : 'thermometer');
  });
  it('계기 눈금은 원인 방향으로 움직인다 (올림 → 위, 내림 → 아래)', () => {
    for (const p of ps) {
      const cause = p.steps.find(s => s.role === 'cause')!;
      const plan = storyPlan(p);
      expect(plan.to > plan.from, p.id).toBe(cause.change === 'up');
      expect(plan.to).toBeGreaterThanOrEqual(0); expect(plan.to).toBeLessThanOrEqual(1);
    }
  });
  it('환자 모양: 압력↑·온도↓는 찌그러짐, 압력↓·온도↑는 부풀어 오름 (교과서 202, 212쪽)', () => {
    const by = Object.fromEntries(ps.map(p => [p.id, storyPlan(p).deform]));
    expect(by.rubberball).toBe('squash');   // 사람이 앉음: 압력↑
    expect(by.airbed).toBe('squash');       // 눕는다: 압력↑
    expect(by.shoe).toBe('squash');         // 착지: 압력↑
    expect(by.snackbag).toBe('swell');      // 높은 산: 압력↓
    expect(by.foilballoon).toBe('squash');  // 추운 밖: 온도↓
    expect(by.soccerball).toBe('squash');   // 겨울 바깥: 온도↓
    expect(by.balloon).toBe('swell');       // 가열: 온도↑
  });
  it('탁구공 사연은 찌그러진 까닭을 그리지 않는다 (교과서에 없음)', () => {
    const pp = ps.find(p => p.id === 'ppball')!;
    expect(pp.scene).toBe('dented-ball');
  });
});
