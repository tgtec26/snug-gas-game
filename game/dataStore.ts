import { create } from 'zustand';
import type { Experiments, ParticleRule, Patient, Person, HomeworkCard } from '@/game/types';
import { validateDataset } from '@/game/validators';
import { configureAudio, validateAudioConfig, type AudioConfig } from '@/game/audio';
import { validateLayout, type Layout } from '@/game/layout';
import { validateMinigame, type MinigameConfig } from '@/game/exam';
import { useGame } from '@/game/store';

export interface DialogConfig {
  doctor: { name: string };
  intro: string[];
  diagnosis: { boyle: string[]; charles: string[] };
  tutorial: { card: string; line: string };
  hints: { wrongGauge: string; gear: string; submerge: string; hold: string; notThere: string };
  ending: string[];
}

interface DataState {
  patients: Patient[];
  experiments: Experiments | null;
  particleRules: ParticleRule[];
  people: Person[];
  homework: HomeworkCard[];
  dialog: DialogConfig | null;
  audio: AudioConfig | null;
  layout: Layout | null;
  minigame: MinigameConfig | null;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
}

const getJson = async <T,>(file: string): Promise<T> => {
  const r = await fetch(`/data/${file}.json`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${file}.json: HTTP ${r.status}`);
  return (await r.json()) as T;
};

/** 데이터 검증에 실패하면 개발·배포 모두 로딩 오류 화면을 보인다(데이터 없이는 판정할 수 없다). */
export const useDataStore = create<DataState>()((set) => ({
  patients: [], experiments: null, particleRules: [], people: [], homework: [], dialog: null, audio: null, layout: null, minigame: null,
  loaded: false, error: null,
  load: async () => {
    try {
      const [patients, experiments, particleRules, people, homework, dialog, audio, layout, minigame] = await Promise.all([
        getJson<Patient[]>('patients'), getJson<Experiments>('experiments'), getJson<ParticleRule[]>('particle-rules'),
        getJson<Person[]>('people'), getJson<HomeworkCard[]>('homework-cards'),
        getJson<DialogConfig>('dialog-config'), getJson<AudioConfig>('audio-config'),
        getJson<Layout>('layout'), getJson<MinigameConfig>('minigame-config'),
      ]);
      const errs = [
        ...validateDataset({ patients, experiments, particleRules, people, homework, dialog: dialog as unknown as Record<string, unknown> }),
        ...validateAudioConfig(audio),
        ...validateLayout(layout),
        ...validateMinigame(minigame),
      ];
      if (errs.length) throw new Error(errs.join(' / '));
      useGame.getState().loadPatients(patients);
      configureAudio(audio);
      set({ patients, experiments, particleRules, people, homework, dialog, audio, layout, minigame, loaded: true, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loaded: true });
    }
  },
}));
