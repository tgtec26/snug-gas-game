import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ExamRecord, Patient, Phase } from './types';
import { scoreStars } from './rules';

export const RUN_KEY = 'air-clinic-run-v1';

/** 시작 화면에서 고르는 진행 캐릭터 (남 1, 여 2). 그림은 hero/<id>.webp */
export const HERO_IDS = ['boy', 'girl1', 'girl2'] as const;
export type HeroId = (typeof HERO_IDS)[number];

export interface RunData {
  phase: Phase;
  heroId: HeroId;
  playerName: string;                   // 학생이 직접 입력한 이름 (기본값 없음)
  examIds: string[];                    // 진료 순서 (응급 제외)
  emergencyIds: string[];
  currentId: string | null;
  records: Record<string, ExamRecord>;
  emergencyResults: boolean[];
  emergencyLog: { id: string; ok: boolean }[];   // 응급실 라운드 기록 (놓친 환자의 재도전 포함)
}

export interface GameState extends RunData {
  loadPatients: (patients: Patient[]) => void;
  start: (name: string, heroId: HeroId) => void;
  next: () => void;
  enterExam: (id: string) => void;
  finishStory: () => void;
  completeExam: (id: string, r: { firstCorrect: boolean; inTime: boolean; bonus: boolean; wrongGauge: number }) => void;
  roundReady: boolean;                           // 응급실: 사연이 끝나 조작할 수 있는가 (저장하지 않음)
  startRound: () => void;
  recordRound: (id: string, ok: boolean) => void;
  finishEmergency: (results: boolean[]) => void;
  restartRun: () => void;
  reset: () => void;
}

const blank = (): RunData => ({
  phase: 'title', heroId: 'boy', playerName: '', examIds: [], emergencyIds: [], currentId: null, records: {}, emergencyResults: [], emergencyLog: [],
});

export const nextExamId = (s: Pick<RunData, 'examIds' | 'records'>): string | null =>
  s.examIds.find(id => !s.records[id]) ?? null;

export const totalStars = (s: Pick<RunData, 'records' | 'emergencyResults'>): number =>
  Object.values(s.records).reduce((a, r) => a + r.stars, 0)
  + Math.min(3, Math.floor(s.emergencyResults.filter(Boolean).length * 3 / Math.max(1, s.emergencyResults.length)));

/** 응급실 환자 순서: 4명이 한 바퀴 돈 뒤 놓친 환자만 마지막에 한 번 더 온다. */
export function emergencyQueue(ids: string[], log: { id: string; ok: boolean }[]): string[] {
  if (log.length < ids.length) return ids;
  const first = log.slice(0, ids.length);
  return [...ids, ...ids.filter(id => !first.some(l => l.id === id && l.ok))];
}

/** 새로고침 복원: 진행 중이던 진료는 사연 장면부터 다시, 응급실은 처음부터 다시. 이름 없는 예전 저장본은 시작 화면으로. */
export function normalizeRehydrated(s: RunData): RunData {
  if (!s.playerName && s.phase !== 'title') return blank();
  if (s.phase === 'exam') return { ...s, phase: 'story' };
  if (s.phase === 'emergency') return { ...s, emergencyResults: [], emergencyLog: [], currentId: s.emergencyIds[0] ?? null };
  return s;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...blank(),
      roundReady: false,
      loadPatients: patients => set(s => ({
        examIds: patients.filter(p => p.kind !== 'emergency').map(p => p.id),
        emergencyIds: patients.filter(p => p.kind === 'emergency').map(p => p.id),
        // 데이터가 바뀌어 기록이 어긋나면 기록을 버린다
        records: Object.fromEntries(Object.entries(s.records).filter(([id]) => patients.some(p => p.id === id))),
      })),
      start: (name, heroId) => {
        const playerName = name.trim();
        if (get().phase === 'title' && playerName) set({ phase: 'intro', playerName, heroId });
      },
      next: () => {
        const s = get();
        if (s.phase === 'intro') set({ phase: 'tutorial' });
        else if (s.phase === 'tutorial') set({ phase: 'clinic' });
        else if (s.phase === 'diagnosis') set({ phase: 'clinic', currentId: null });
        else if (s.phase === 'clinic' && nextExamId(s) === null && s.examIds.length > 0) set({ phase: 'emergency', emergencyResults: [], emergencyLog: [], currentId: s.emergencyIds[0] ?? null, roundReady: false });
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
      startRound: () => { if (get().phase === 'emergency') set({ roundReady: true }); },
      recordRound: (id, ok) => {
        const s = get();
        if (s.phase !== 'emergency' || !s.roundReady || s.currentId !== id) return;
        const log = [...s.emergencyLog, { id, ok }];
        const queue = emergencyQueue(s.emergencyIds, log);
        if (log.length >= queue.length) {
          const results = s.emergencyIds.map(e => log.some(l => l.id === e && l.ok));
          set({ phase: 'ending', emergencyLog: log, emergencyResults: results, currentId: null, roundReady: false });
        } else set({ emergencyLog: log, currentId: queue[log.length], roundReady: false });
      },
      finishEmergency: results => {
        const s = get();
        if (s.phase !== 'emergency') return;
        set({ phase: 'ending', emergencyResults: results.slice(0, s.emergencyIds.length), currentId: null, roundReady: false });
      },
      restartRun: () => {
        if (get().phase === 'result') set({ phase: 'clinic', currentId: null, records: {}, emergencyResults: [], emergencyLog: [] });
      },
      reset: () => set(s => ({ ...blank(), heroId: s.heroId, playerName: s.playerName })),
    }),
    {
      name: RUN_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({
        phase: s.phase, heroId: s.heroId, playerName: s.playerName, examIds: s.examIds, emergencyIds: s.emergencyIds,
        currentId: s.currentId, records: s.records, emergencyResults: s.emergencyResults, emergencyLog: s.emergencyLog,
      }),
      merge: (persisted, current) => ({ ...current, ...normalizeRehydrated({ ...blank(), ...(persisted as Partial<RunData>) }) }),
    },
  ),
);
