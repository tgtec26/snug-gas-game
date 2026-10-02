import { describe, it, expect, beforeEach } from 'vitest';
import patients from '../public/data/patients.json';
import type { Patient } from '../game/types';
import { useGame, nextExamId, totalStars, normalizeRehydrated, emergencyQueue, RUN_KEY } from '../game/store';

const ps = patients as unknown as Patient[];
const good = { firstCorrect: true, inTime: true, bonus: true, wrongGauge: 0 };
const g = () => useGame.getState();

beforeEach(() => { localStorage.clear(); g().reset(); g().loadPatients(ps); });

function toClinic() { g().start('학생', 'boy'); g().next(); g().next(); }

describe('단계 전이', () => {
  it('title → intro → tutorial → clinic', () => {
    expect(g().phase).toBe('title'); g().start('학생', 'boy'); expect(g().phase).toBe('intro');
    g().next(); expect(g().phase).toBe('tutorial'); g().next(); expect(g().phase).toBe('clinic');
  });
  it('환자 순서: 진료 4건 + 응급 4명, 응급은 진료 목록에 없다', () => {
    expect(g().examIds).toEqual(['rubberball', 'snackbag', 'foilballoon', 'soccerball']);
    expect(g().emergencyIds).toEqual(['ppball', 'airbed', 'balloon', 'shoe']);
  });
  it('진료는 정해진 순서로만 들어간다', () => {
    toClinic();
    g().enterExam('snackbag'); expect(g().phase).toBe('clinic');   // 순서 건너뛰기 불가
    g().enterExam('ppball'); expect(g().phase).toBe('clinic');     // 응급 환자는 진료로 못 들어감
    g().enterExam('rubberball'); expect(g().phase).toBe('story'); expect(g().currentId).toBe('rubberball');
  });
  it('story → exam → diagnosis → clinic, 기록과 별', () => {
    toClinic(); g().enterExam('rubberball'); g().finishStory(); expect(g().phase).toBe('exam');
    g().completeExam('rubberball', good); expect(g().phase).toBe('diagnosis');
    expect(g().records.rubberball).toEqual({ stars: 3, wrongGauge: 0 });
    g().next(); expect(g().phase).toBe('clinic'); expect(nextExamId(g())).toBe('snackbag');
  });
  it('Enter 연타: 같은 액션을 두 번 불러도 한 번만 진행', () => {
    toClinic(); g().enterExam('rubberball'); g().finishStory(); g().finishStory(); expect(g().phase).toBe('exam');
    g().completeExam('rubberball', good); g().completeExam('rubberball', { ...good, firstCorrect: false });
    expect(g().records.rubberball.stars).toBe(3);   // 두 번째 호출은 무시
  });
  it('엉뚱한 phase·환자의 액션은 무시', () => {
    g().finishStory(); expect(g().phase).toBe('title');
    toClinic(); g().completeExam('rubberball', good); expect(g().phase).toBe('clinic');
    g().enterExam('rubberball'); g().finishStory(); g().completeExam('snackbag', good); expect(g().phase).toBe('exam');
  });
  it('진료를 다 마치기 전에는 응급실로 못 간다, 다 마치면 간다', () => {
    toClinic(); g().next(); expect(g().phase).toBe('clinic');
    for (const id of g().examIds) { g().enterExam(id); g().finishStory(); g().completeExam(id, good); g().next(); }
    g().next(); expect(g().phase).toBe('emergency');
    g().finishEmergency([true, true, false, true]); expect(g().phase).toBe('ending');
    expect(g().emergencyResults).toEqual([true, true, false, true]);
    g().next(); expect(g().phase).toBe('result');
  });
  it('다시 하기: 기록은 지우고 튜토리얼은 건너뛴다', () => {
    toClinic(); for (const id of g().examIds) { g().enterExam(id); g().finishStory(); g().completeExam(id, good); g().next(); }
    g().next(); g().finishEmergency([true, true, true, true]); g().next();
    g().restartRun(); expect(g().phase).toBe('clinic'); expect(g().records).toEqual({}); expect(nextExamId(g())).toBe('rubberball');
  });
  it('result가 아닐 때 restartRun은 무시', () => { toClinic(); g().restartRun(); expect(g().phase).toBe('clinic'); });
});

describe('별 합계', () => {
  it('진료 별 + 응급실 별(0~3)', () => {
    expect(totalStars({ records: { a: { stars: 3, wrongGauge: 0 }, b: { stars: 2, wrongGauge: 1 } }, emergencyResults: [true, true, true, true] })).toBe(8);
    expect(totalStars({ records: {}, emergencyResults: [] })).toBe(0);
    expect(totalStars({ records: {}, emergencyResults: [true, false, false, false] })).toBe(0);
    expect(totalStars({ records: {}, emergencyResults: [true, true, false, false] })).toBe(1);
  });
});

describe('캐릭터와 이름', () => {
  it('이름이 비었거나 공백뿐이면 시작하지 않는다', () => {
    g().start('', 'girl1'); g().start('   ', 'girl1'); expect(g().phase).toBe('title');
  });
  it('앞뒤 공백을 떼고 이름과 캐릭터를 저장한다', () => {
    g().start('  학생 ', 'girl2'); expect(g().phase).toBe('intro');
    expect(g().playerName).toBe('학생'); expect(g().heroId).toBe('girl2');
    expect(JSON.parse(localStorage.getItem(RUN_KEY) as string).state).toMatchObject({ playerName: '학생', heroId: 'girl2' });
  });
  it('처음으로(reset) 뒤에도 이름과 캐릭터는 남는다', () => {
    g().start('학생', 'girl1'); g().reset();
    expect(g().phase).toBe('title'); expect(g().playerName).toBe('학생'); expect(g().heroId).toBe('girl1');
  });
});

describe('새로고침 복원', () => {
  const base = { phase: 'clinic' as const, heroId: 'boy' as const, playerName: '학생', examIds: ['a'], emergencyIds: ['e'], currentId: null, records: {}, emergencyResults: [], emergencyLog: [] };
  it('진행 중이던 진료는 사연 장면부터', () => { expect(normalizeRehydrated({ ...base, phase: 'exam', currentId: 'a' }).phase).toBe('story'); });
  it('응급실 중간 결과는 버린다', () => { expect(normalizeRehydrated({ ...base, phase: 'emergency', emergencyResults: [true] }).emergencyResults).toEqual([]); });
  it('진단서와 대기실은 그대로', () => { expect(normalizeRehydrated({ ...base, phase: 'diagnosis' }).phase).toBe('diagnosis'); });
  it('이름 없이 진행 중이던 예전 저장본은 시작 화면으로', () => {
    const n = normalizeRehydrated({ ...base, playerName: '', records: { a: { stars: 3, wrongGauge: 0 } } });
    expect(n.phase).toBe('title'); expect(n.records).toEqual({});
  });
  it('저장본이 localStorage에 들어간다', () => {
    toClinic(); expect(JSON.parse(localStorage.getItem(RUN_KEY) as string).state.phase).toBe('clinic');
  });
  it('데이터가 바뀌어 사라진 환자의 기록은 버린다', () => {
    toClinic(); g().enterExam('rubberball'); g().finishStory(); g().completeExam('rubberball', good);
    g().loadPatients(ps.filter(p => p.id !== 'rubberball'));
    expect(g().records.rubberball).toBeUndefined();
  });
});

describe('응급실 라운드', () => {
  const ids = ['ppball', 'airbed', 'balloon', 'shoe'];
  function toEmergency() { toClinic(); for (const id of g().examIds) { g().enterExam(id); g().finishStory(); g().completeExam(id, good); g().next(); } g().next(); }
  it('큐: 처음엔 4명, 첫 바퀴가 끝나면 놓친 환자만 한 번 더', () => {
    expect(emergencyQueue(ids, [])).toEqual(ids);
    const log = (oks: boolean[]) => oks.map((ok, i) => ({ id: ids[i], ok }));
    expect(emergencyQueue(ids, log([true, true, true, true]))).toEqual(ids);
    expect(emergencyQueue(ids, log([true, false, true, false]))).toEqual([...ids, 'airbed', 'shoe']);
    expect(emergencyQueue(ids, log([true, false]))).toEqual(ids);   // 첫 바퀴 도중에는 아직 늘지 않는다
  });
  it('응급실에 들어가면 첫 환자가 현재 환자, 사연이 끝나야 라운드 시작', () => {
    toEmergency();
    expect(g().phase).toBe('emergency'); expect(g().currentId).toBe('ppball'); expect(g().roundReady).toBe(false);
    g().recordRound('ppball', true); expect(g().emergencyLog).toEqual([]);   // 시작 전 기록은 무시
    g().startRound(); expect(g().roundReady).toBe(true);
  });
  it('성공하면 다음 환자로, 같은 환자의 중복 기록은 무시', () => {
    toEmergency(); g().startRound();
    g().recordRound('ppball', true); g().recordRound('ppball', true);
    expect(g().emergencyLog).toEqual([{ id: 'ppball', ok: true }]);
    expect(g().currentId).toBe('airbed'); expect(g().roundReady).toBe(false);
  });
  it('다른 환자 id의 기록은 무시 (시간 초과 뒤 늦게 도착한 성공 방지)', () => {
    toEmergency(); g().startRound(); g().recordRound('ppball', false); g().startRound();
    g().recordRound('ppball', true);
    expect(g().emergencyLog).toEqual([{ id: 'ppball', ok: false }]);
  });
  it('4명을 모두 성공하면 엔딩, 결과는 환자 순서대로', () => {
    toEmergency();
    for (const id of ids) { g().startRound(); g().recordRound(id, true); }
    expect(g().phase).toBe('ending'); expect(g().emergencyResults).toEqual([true, true, true, true]); expect(g().currentId).toBeNull();
  });
  it('놓치면 마지막에 한 번 더 오고, 끝나면 엔딩 (재도전 성공이 결과에 반영)', () => {
    toEmergency();
    g().startRound(); g().recordRound('ppball', true);
    g().startRound(); g().recordRound('airbed', false);
    g().startRound(); g().recordRound('balloon', true);
    g().startRound(); g().recordRound('shoe', true);
    expect(g().phase).toBe('emergency'); expect(g().currentId).toBe('airbed');
    g().startRound(); g().recordRound('airbed', true);
    expect(g().phase).toBe('ending'); expect(g().emergencyResults).toEqual([true, true, true, true]);
  });
  it('재도전도 놓치면 그 환자는 실패로 남는다', () => {
    toEmergency();
    for (const [id, ok] of [['ppball', true], ['airbed', false], ['balloon', true], ['shoe', true], ['airbed', false]] as const) { g().startRound(); g().recordRound(id, ok); }
    expect(g().phase).toBe('ending'); expect(g().emergencyResults).toEqual([true, false, true, true]);
  });
  it('새로고침하면 응급실은 처음부터 다시', () => {
    toEmergency(); g().startRound(); g().recordRound('ppball', true);
    const n = normalizeRehydrated({ phase: 'emergency', heroId: 'boy', playerName: '학생', examIds: g().examIds, emergencyIds: ids, currentId: 'airbed', records: {}, emergencyResults: [], emergencyLog: [{ id: 'ppball', ok: true }] });
    expect(n.emergencyLog).toEqual([]); expect(n.currentId).toBe('ppball');
  });
});
