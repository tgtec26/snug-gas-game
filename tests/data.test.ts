import { describe, it, expect } from 'vitest';
import experiments from '../public/data/experiments.json';
import patients from '../public/data/patients.json';
import particleRules from '../public/data/particle-rules.json';
import dialog from '../public/data/dialog-config.json';
import people from '../public/data/people.json';
import homework from '../public/data/homework-cards.json';
import type { Experiments, ParticleRule, Patient, Person, HomeworkCard } from '../game/types';
import { validateDataset, sentenceCount, FORBIDDEN, type Dataset } from '../game/validators';
import { withName } from '../game/name';

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

describe('이름 부르기', () => {
  const withDialog = (d: Record<string, unknown>): Dataset => ({ ...real, dialog: { ...real.dialog, ...d } });
  it('{name}을 이름으로 바꾸고 {count}를 숫자로 바꾼다', () => {
    expect(withName('{name} 선생님이 치료한 환자 {count}명', '학생', 3)).toBe('학생 선생님이 치료한 환자 3명');
    expect(withName('{name}, {name}', '학생')).toBe('학생, 학생');
  });
  it('이름 바로 뒤에 조사를 붙이면 거부한다 (받침에 따라 어색해진다)', () => {
    expect(validateDataset(withDialog({ intro: ['어서 와요, {name}이 선생님!'] })).join()).toContain('조사');
    expect(validateDataset(withDialog({ intro: ['어서 와요, {name} 선생님!'] }))).toEqual([]);
    expect(validateDataset(withDialog({ intro: ['{name}, 어서 와요.'] }))).toEqual([]);
  });
  it('주인공을 부르는 자리가 대사 설정에 있다', () => {
    const text = JSON.stringify(real.dialog);
    expect(text.match(/\{name\}/g)!.length).toBeGreaterThanOrEqual(4);
  });
});

describe('조절기 잠금 안내', () => {
  it('잠긴 조절기를 만졌을 때 되돌리는 방법을 알려 주는 한 줄이 있다', () => {
    const h = real.dialog.hints as Record<string, string>;
    expect(h.lockedDial).toContain('되돌리기'); expect(h.lockedPiston).toContain('되돌리기'); expect(h.dialClosed).toBeTruthy();
  });
});

describe('도구', () => {
  it('문장 수', () => { expect(sentenceCount('하나예요.')).toBe(1); expect(sentenceCount('하나예요! 둘이에요?')).toBe(2); expect(sentenceCount('1.5배예요.')).toBe(1); });
  it('금지어 목록에 분자·원자·켈빈·파스칼·정비례가 있다', () => { for (const w of ['분자', '원자', '켈빈', '파스칼', '정비례']) expect(FORBIDDEN).toContain(w); });
});
