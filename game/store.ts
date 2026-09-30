import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ExamRecord, Patient, Phase } from './types';
import { scoreStars } from './rules';

export const RUN_KEY = 'air-clinic-run-v1';

export interface RunData {
  phase: Phase;
  examIds: string[];                    // 진료 순서 (응급 제외)
  emergencyIds: string[];
  currentId: string | null;
  records: Record<string, ExamRecord>;
  emergencyResults: boolean[];
}

export interface GameState extends RunData {
  loadPatients: (patients: Patient[]) => void;
  start: () => void;
  next: () => void;
  enterExam: (id: string) => void;
  finishStory: () => void;
  completeExam: (id: string, r: { firstCorrect: boolean; inTime: boolean; bonus: boolean; wrongGauge: number }) => void;
  finishEmergency: (results: boolean[]) => void;
  restartRun: () => void;
  reset: () => void;
}

const blank = (): RunData => ({
  phase: 'title', examIds: [], emergencyIds: [], currentId: null, records: {}, emergencyResults: [],
});

export const nextExamId = (s: Pick<RunData, 'examIds' | 'records'>): string | null =>
  s.examIds.find(id => !s.records[id]) ?? null;

export const totalStars = (s: Pick<RunData, 'records' | 'emergencyResults'>): number =>
  Object.values(s.records).reduce((a, r) => a + r.stars, 0)
  + Math.min(3, Math.floor(s.emergencyResults.filter(Boolean).length * 3 / Math.max(1, s.emergencyResults.length)));

/** 새로고침 복원: 진행 중이던 진료는 사연 장면부터 다시, 응급실은 처음부터 다시. */
export function normalizeRehydrated(s: RunData): RunData {
  if (s.phase === 'exam') return { ...s, phase: 'story' };
  if (s.phase === 'emergency') return { ...s, emergencyResults: [] };
  return s;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...blank(),
      loadPatients: patients => set(s => ({
        examIds: patients.filter(p => p.kind !== 'emergency').map(p => p.id),
        emergencyIds: patients.filter(p => p.kind === 'emergency').map(p => p.id),
        // 데이터가 바뀌어 기록이 어긋나면 기록을 버린다
        records: Object.fromEntries(Object.entries(s.records).filter(([id]) => patients.some(p => p.id === id))),
      })),
      start: () => { if (get().phase === 'title') set({ phase: 'intro' }); },
      next: () => {
        const s = get();
        if (s.phase === 'intro') set({ phase: 'tutorial' });
        else if (s.phase === 'tutorial') set({ phase: 'clinic' });
        else if (s.phase === 'diagnosis') set({ phase: 'clinic', currentId: null });
        else if (s.phase === 'clinic' && nextExamId(s) === null && s.examIds.length > 0) set({ phase: 'emergency', emergencyResults: [] });
        else if (s.phase === 'ending') set({ phase: 'result' });
      },
      enterExam: id => {
        const s = get();
        if (s.phase !== 'clinic' || nextExamId(s) !== id) return;
        set({ phase: 'story', currentId: id });
      },
      finishStory: () => { if (get().phase === 'story') set({ phase: 'exam' }); },
      completeExam: (id, r) => {
        const s = get();
        if (s.phase !== 'exam' || s.currentId !== id) return;
        set({
          phase: 'diagnosis',
          records: { ...s.records, [id]: { stars: scoreStars(r), wrongGauge: r.wrongGauge } },
        });
      },
      finishEmergency: results => {
        const s = get();
        if (s.phase !== 'emergency') return;
        set({ phase: 'ending', emergencyResults: results.slice(0, s.emergencyIds.length) });
      },
      restartRun: () => {
        if (get().phase === 'result') set({ phase: 'clinic', currentId: null, records: {}, emergencyResults: [] });
      },
      reset: () => set(blank()),
    }),
    {
      name: RUN_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({
        phase: s.phase, examIds: s.examIds, emergencyIds: s.emergencyIds,
        currentId: s.currentId, records: s.records, emergencyResults: s.emergencyResults,
      }),
      merge: (persisted, current) => ({ ...current, ...normalizeRehydrated({ ...blank(), ...(persisted as Partial<RunData>) }) }),
    },
  ),
);
