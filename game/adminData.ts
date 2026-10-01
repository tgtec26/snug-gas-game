import { validateDataset } from './validators';
import { validateLayout, type Layout } from './layout';
import { validateMinigame, type MinigameConfig } from './exam';
import { validateAudioConfig, type AudioConfig } from './audio';
import { ART } from './systems/render';
import type { Experiments, HomeworkCard, ParticleRule, Patient, Person } from './types';

/** admin이 읽고 쓸 수 있는 데이터 파일 (public/data). manifest만 public/assets에 있다. */
export const DATA_FILES = [
  'patients', 'particle-rules', 'experiments', 'minigame-config', 'dialog-config', 'layout', 'audio-config',
  'people', 'homework-cards', 'manifest',
] as const;
export type DataFile = (typeof DATA_FILES)[number];

export const filePathOf = (f: DataFile): string => (f === 'manifest' ? `public/assets/${f}.json` : `public/data/${f}.json`);

const DIALOG_KEYS = ['doctor', 'intro', 'diagnosis', 'tutorial', 'hints', 'ending'];

/**
 * 파일 하나를 저장하기 전 검사. 다른 파일과 엮이는 검사(환자, 실험 설정, 대사끼리 맞는지 등)도 한다.
 * all은 디스크에 있는 현재 값이고, body가 해당 파일의 새 값이다.
 */
export function validateFile(file: DataFile, body: unknown, all: Record<DataFile, unknown>): string[] {
  const data = { ...all, [file]: body } as Record<DataFile, unknown>;
  const errs: string[] = [];
  try {
    if (file === 'minigame-config') return validateMinigame(body as MinigameConfig);
    if (file === 'layout') return validateLayout(body as Layout);
    if (file === 'audio-config') return validateAudioConfig(body as AudioConfig);
    if (file === 'manifest') {
      if (!Array.isArray(body) || body.some(x => typeof x !== 'string')) return ['manifest는 파일 경로 문자열의 목록이어야 한다'];
      return (body as string[]).filter(f => !ART[f]).map(f => `알 수 없는 그림 파일: ${f}`);
    }
    if (!Array.isArray(body) && (file === 'patients' || file === 'particle-rules' || file === 'people' || file === 'homework-cards')) return [`${file}는 목록이어야 한다`];
    const dialog = data['dialog-config'] as Record<string, unknown>;
    for (const k of DIALOG_KEYS) if (!dialog || !(k in dialog)) errs.push(`dialog-config에 ${k}가 없다`);
    if (errs.length) return errs;
    return validateDataset({
      patients: data.patients as Patient[], experiments: data.experiments as Experiments, particleRules: data['particle-rules'] as ParticleRule[],
      dialog, people: data.people as Person[], homework: data['homework-cards'] as HomeworkCard[],
    });
  } catch (e) {
    return [`검사 중 오류: ${String(e)}`];
  }
}
