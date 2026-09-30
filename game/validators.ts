import type { Experiments, ParticleRule, Patient } from './types';
import { stepTargetVolume } from './rules';

/** 교과서에 없어서 쓰지 않는 말 (발췌 2-9) */
export const FORBIDDEN = ['분자', '원자', '켈빈', '파스칼', '정비례', '밀도', '부력', '운동 에너지', '이상 기체', '절대 온도'];

export function collectStrings(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) o.forEach(v => collectStrings(v, out));
  else if (o && typeof o === 'object') Object.values(o).forEach(v => collectStrings(v, out));
  return out;
}

export function sentenceCount(s: string): number {
  return s.trim().replace(/(\d)\.(\d)/g, '$1_$2').split(/(?<=[.?!])\s+/).filter(Boolean).length;
}

export interface Dataset {
  patients: Patient[]; experiments: Experiments; particleRules: ParticleRule[]; dialog: Record<string, unknown>;
}

/** 오류 문자열 목록. 비어 있어야 게임을 시작할 수 있다. */
export function validateDataset(d: Dataset): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const p of d.patients) {
    if (ids.has(p.id)) errs.push(`환자 id 중복: ${p.id}`);
    ids.add(p.id);
    if (!p.verified) errs.push(`${p.id}: verified:false 데이터는 게임에 쓸 수 없다`);
    if ((p.variable === 'pressure') !== (p.gauge === 'pressure-sensor')) errs.push(`${p.id}: 변인과 계기가 맞지 않는다`);
    if (p.steps.length === 0) errs.push(`${p.id}: step이 없다`);
    p.steps.forEach((s, i) => {
      if (!(s.size > 0)) errs.push(`${p.id}: step ${i} size는 0보다 커야 한다`);
      if (p.variable === 'temperature' && s.size > Math.min(d.experiments.temp.maxStep, -d.experiments.temp.minStep)) errs.push(`${p.id}: step ${i} 온도 단계가 범위 밖`);
      if (s.size > 0) {
        const t = stepTargetVolume(d.experiments, p, i);
        if (t < d.experiments.syringe.min || t > d.experiments.syringe.max) errs.push(`${p.id}: step ${i} 목표 부피 ${t}가 주사기 범위 밖`);
      }
    });
  }
  for (const r of d.particleRules) if (r.count !== 'same') errs.push(`입자 규칙 ${r.variable} ${r.change}: 입자 개수는 일정해야 한다`);
  for (const v of ['pressure', 'temperature'] as const) for (const c of ['up', 'down'] as const) {
    if (!d.particleRules.some(r => r.variable === v && r.change === c)) errs.push(`입자 규칙 없음: ${v} ${c}`);
  }
  for (const s of collectStrings(d.patients).concat(collectStrings(d.dialog))) {
    for (const w of FORBIDDEN) if (s.includes(w)) errs.push(`금지어 "${w}": ${s.slice(0, 30)}`);
  }
  for (const s of collectStrings(d.dialog)) {
    if (sentenceCount(s) > 2) errs.push(`대사가 2문장을 넘는다: ${s.slice(0, 30)}`);
  }
  return errs;
}
