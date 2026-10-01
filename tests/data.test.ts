import { describe, it, expect } from 'vitest';
import experiments from '../public/data/experiments.json';
import patients from '../public/data/patients.json';
import particleRules from '../public/data/particle-rules.json';
import dialog from '../public/data/dialog-config.json';
import people from '../public/data/people.json';
import homework from '../public/data/homework-cards.json';
import type { Experiments, ParticleRule, Patient, Person, HomeworkCard } from '../game/types';
import { validateDataset, sentenceCount, FORBIDDEN, type Dataset } from '../game/validators';

const real = {
  patients: patients as unknown as Patient[], experiments: experiments as unknown as Experiments,
  particleRules: particleRules as unknown as ParticleRule[], dialog: dialog as Record<string, unknown>,
  people: people as Person[], homework: homework as HomeworkCard[],
} satisfies Dataset;

describe('실제 데이터', () => {
  it('오류가 없다', () => { expect(validateDataset(real)).toEqual([]); });
  it('환자 8명: 진료 4 + 응급 4', () => {
    expect(real.patients.filter(p => p.kind !== 'emergency')).toHaveLength(4);
    expect(real.patients.filter(p => p.kind === 'emergency')).toHaveLength(4);
  });
});

describe('검증기가 실제로 잡는다', () => {
  const clone = () => structuredClone(real) as Dataset;
  it('숙제 카드에 답 필드가 들어가면', () => {
    const d = clone(); (d.homework as unknown as Record<string, unknown>[])[0].answer = '...'; expect(validateDataset(d).join()).toContain('답');
  });
  it('인물 카드에 금지어가 들어가면', () => {
    const d = clone(); d.people![0].line = '분자를 발견했어요.'; expect(validateDataset(d).join()).toContain('금지어');
  });
  it('인물은 보일·샤를, 숙제 카드는 5장', () => {
    expect(real.people!.map(p => p.id)).toEqual(['boyle', 'charles']); expect(real.homework).toHaveLength(5);
  });
  it('verified:false', () => { const d = clone(); d.patients[0].verified = false; expect(validateDataset(d).join()).toContain('verified'); });
  it('금지어가 대사에 들어가면', () => { const d = clone(); (d.dialog.intro as string[])[0] = '기체 분자는 움직여요.'; expect(validateDataset(d).join()).toContain('금지어'); });
  it('대사가 3문장이면', () => { const d = clone(); (d.dialog.intro as string[])[0] = '하나예요. 둘이에요. 셋이에요.'; expect(validateDataset(d).join()).toContain('2문장'); });
  it('변인과 계기가 어긋나면', () => { const d = clone(); d.patients[0].gauge = 'thermometer'; expect(validateDataset(d).join()).toContain('계기'); });
  it('목표 부피가 주사기 범위 밖이면', () => { const d = clone(); d.patients[0].steps[0].size = 99; expect(validateDataset(d).join()).toContain('범위 밖'); });
  it('입자 개수가 바뀌는 규칙은 거부', () => { const d = clone(); (d.particleRules[0] as unknown as { count: string }).count = 'more'; expect(validateDataset(d).join()).toContain('입자 개수'); });
  it('id 중복', () => { const d = clone(); d.patients[1].id = d.patients[0].id; expect(validateDataset(d).join()).toContain('중복'); });
});

describe('도구', () => {
  it('문장 수', () => { expect(sentenceCount('하나예요.')).toBe(1); expect(sentenceCount('하나예요! 둘이에요?')).toBe(2); expect(sentenceCount('1.5배예요.')).toBe(1); });
  it('금지어 목록에 분자·원자·켈빈·파스칼·정비례가 있다', () => { for (const w of ['분자', '원자', '켈빈', '파스칼', '정비례']) expect(FORBIDDEN).toContain(w); });
});
