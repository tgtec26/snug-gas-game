import type {
  Change, Device, Experiments, Law, MatchReason, ParticleRule, Patient, Trend, Variable,
} from './types';

export const lawOf = (variable: Variable): Law => (variable === 'pressure' ? 'boyle' : 'charles');

/** 압력↑ 부피↓, 압력↓ 부피↑, 온도↑ 부피↑, 온도↓ 부피↓ (교과서 202, 212쪽) */
export function volumeDirection(variable: Variable, change: Change): Trend {
  const up = change === 'up';
  if (variable === 'pressure') return up ? 'decrease' : 'increase';
  return up ? 'increase' : 'decrease';
}

/** 반비례: 압력 센서 바늘의 상대 높이 = 기준 부피 / 부피. 절대 값이 아니다. */
export function needleFromVolume(volume: number, reference: number): number {
  if (volume <= 0) throw new Error('부피는 0보다 커야 해요');
  return reference / volume;
}

/** 일정한 비율로 증가: 온도 단계가 1 오를 때마다 같은 만큼 늘어난다. */
export function volumeFromTemp(cfg: Experiments, tempStep: number): number {
  return cfg.syringe.start + tempStep * cfg.temp.perStep;
}

/** 온도 다이얼이 원점이 아니면 피스톤이 압력을 맞추며 따라가므로 부피는 온도로 정해진다. */
export function deviceVolume(cfg: Experiments, d: Device): number {
  return d.tempStep !== 0 ? volumeFromTemp(cfg, d.tempStep) : d.piston;
}

/** 지금 일정하게 유지되는 변인 = 잠긴 조절기. 둘 다 원점이면 null. */
export function heldConstant(cfg: Experiments, d: Device): Variable | null {
  if (d.tempStep !== 0) return 'pressure';
  if (d.piston !== cfg.syringe.start) return 'temperature';
  return null;
}

export const canUse = (cfg: Experiments, d: Device, variable: Variable): boolean =>
  heldConstant(cfg, d) !== variable;

/** 교과서 조건 문구: "온도가 일정할 때", "압력이 일정할 때" */
export const badgeText = (held: Variable): string => (held === 'temperature' ? '온도 일정' : '압력 일정');

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** 환자 step의 목표 부피 */
export function stepTargetVolume(cfg: Experiments, patient: Patient, stepIndex: number): number {
  const s = patient.steps[stepIndex];
  if (!s) throw new Error(`${patient.id}: step ${stepIndex} 없음`);
  if (patient.variable === 'pressure') return cfg.syringe.start + (s.change === 'up' ? -s.size : s.size);
  return volumeFromTemp(cfg, s.change === 'up' ? s.size : -s.size);
}

export interface MatchInput { used: Variable | null; device: Device; heldMs: number }

/** 재현 판정. 다른 조절기로 같은 부피를 만들어도 성공이 아니다(지름길 없음). */
export function matchStep(
  cfg: Experiments, patient: Patient, stepIndex: number, input: MatchInput,
): { ok: boolean; reason: MatchReason | null } {
  const there = Math.abs(deviceVolume(cfg, input.device) - stepTargetVolume(cfg, patient, stepIndex)) <= cfg.tolerance;
  if (!there) return { ok: false, reason: 'not-there' };
  if (input.used !== patient.variable) return { ok: false, reason: 'wrong-gauge' };
  if (input.heldMs < cfg.holdMs) return { ok: false, reason: 'hold' };
  return { ok: true, reason: null };
}

export interface Reading { volume: number; dwellMs: number }

/** 측정 진료: 20 mL에서 12 mL까지 1 mL 눈금을 모두 멈춰 읽었는가. 건너뛰면 미완. */
export function checkPistonRun(cfg: Experiments, readings: Reading[]): { complete: boolean; missing: number[] } {
  const missing: number[] = [];
  for (let v = cfg.measure.from; v >= cfg.measure.to; v--) {
    if (!readings.some(r => r.volume === v && r.dwellMs >= cfg.measure.dwellMs)) missing.push(v);
  }
  return { complete: missing.length === 0, missing };
}

export const checkSafetyGear = (cfg: Experiments, worn: string[]): boolean => cfg.gear.every(g => worn.includes(g));

/** 화면 y는 아래로 커진다. 기체 윗부분이 수면 아래(y가 같거나 큼)여야 모두 잠긴 것. */
export const checkSubmerged = (gasTopY: number, waterTopY: number): boolean => gasTopY >= waterTopY;

export const checkLensObserved = (cfg: Experiments, movingMs: number): boolean => movingMs >= cfg.lens.observeMs;

/** 입자 렌즈에서 강조할 항목. 교과서에 없는 칸(null)은 강조하지 않는다. */
export function particleView(
  rules: ParticleRule[], variable: Variable, change: Change,
): ParticleRule {
  const r = rules.find(x => x.variable === variable && x.change === change);
  if (!r) throw new Error(`입자 규칙 없음: ${variable} ${change}`);
  return r;
}

export function scoreStars(r: { firstCorrect: boolean; inTime: boolean; bonus: boolean }): number {
  return Number(r.firstCorrect) + Number(r.inTime) + Number(r.bonus);
}

export function comboOf(history: boolean[]): { current: number; best: number } {
  let current = 0; let best = 0;
  for (const ok of history) { current = ok ? current + 1 : 0; best = Math.max(best, current); }
  return { current, best };
}
