import type { Patient } from './types';
import type { RunData } from './store';

/** 미리보기 네비게이터의 한 칸. state는 그 스테이지가 단독으로 열리도록 채운 테스트용 진행 상태다. */
export interface Stage { id: string; label: string; state: Partial<RunData> }

/** 이름이 비어 있을 때만 쓰는 미리보기용 이름. 정식 데이터·에셋에는 쓰지 않는다. */
export const PREVIEW_NAME = '테스트';

const done = { stars: 3, wrongGauge: 0 };
const doneRecords = (ids: string[]): RunData['records'] => Object.fromEntries(ids.map(id => [id, done]));

/** 환자 데이터에서 모든 스테이지(시작 화면, 각 조작 장면, 단계, 결과)를 만든다. 환자나 phase가 늘면 목록도 늘어난다. */
export function buildStages(patients: Patient[]): Stage[] {
  const exams = patients.filter(p => p.kind !== 'emergency');
  const emergencies = patients.filter(p => p.kind === 'emergency');
  const examIds = exams.map(p => p.id);
  const emergencyIds = emergencies.map(p => p.id);
  const base = { currentId: null, records: {}, emergencyResults: [], emergencyLog: [] };
  const finished = { ...base, records: doneRecords(examIds), emergencyResults: emergencyIds.map(() => true) };

  const stages: Stage[] = [
    { id: 'title', label: '시작 화면', state: { ...base, phase: 'title' } },
    { id: 'intro', label: '인트로', state: { ...base, phase: 'intro' } },
    { id: 'tutorial', label: '구슬 흔들기', state: { ...base, phase: 'tutorial' } },
    { id: 'clinic', label: '대기실', state: { ...base, phase: 'clinic' } },
  ];
  exams.forEach((p, i) => {
    const before = doneRecords(examIds.slice(0, i));
    stages.push(
      { id: `story:${p.id}`, label: `${p.name} 사연`, state: { ...base, phase: 'story', currentId: p.id, records: before } },
      { id: `exam:${p.id}`, label: `${p.name} 진료`, state: { ...base, phase: 'exam', currentId: p.id, records: before } },
      { id: `diagnosis:${p.id}`, label: `${p.name} 진단서`, state: { ...base, phase: 'diagnosis', currentId: p.id, records: doneRecords(examIds.slice(0, i + 1)) } },
    );
  });
  emergencies.forEach((p, j) => {
    stages.push({
      id: `emergency:${p.id}`, label: `응급 ${p.name}`,
      state: { ...base, phase: 'emergency', currentId: p.id, records: doneRecords(examIds), emergencyLog: emergencyIds.slice(0, j).map(id => ({ id, ok: true })) },
    });
  });
  stages.push(
    { id: 'ending', label: '피날레', state: { ...finished, phase: 'ending' } },
    { id: 'result', label: '결과', state: { ...finished, phase: 'result' } },
  );
  return stages;
}
