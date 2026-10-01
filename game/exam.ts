import type { Device, Experiments, Patient, Variable } from './types';
import type { Reading } from './rules';
import { canUse, checkPistonRun, clamp, matchStep } from './rules';

/** 한 진료(환자 하나)의 진행 상태. 순수 데이터라 Phaser 없이 테스트한다. */
export interface ExamState {
  patientId: string;
  stepIndex: number;          // 지금 재현할 step (cause → explore)
  device: Device;
  used: Variable | null;      // 지금 부피를 정하는 조절기
  firstUsed: Variable | null; // 처음 조작한 조절기 (별 ①)
  heldMs: number;             // 목표 모양에 머문 시간
  elapsedMs: number;
  wrongGauge: number;         // 다른 조절기로 같은 부피를 만든 횟수
  wrongLatched: boolean;      // 같은 진입에서 한 번만 세고 알린다
  readings: Reading[];        // 측정 진료: 눈금별로 머문 시간
  snap: boolean;              // 측정 진료: 피스톤이 1 mL 눈금에 딸깍 멈춘다
  tempOpen: boolean;          // 측정 진료는 피스톤만 열려 있다
  done: boolean;
}

export type ExamEvent =
  | { type: 'step-done'; stepIndex: number }
  | { type: 'reading'; volume: number }
  | { type: 'wrong-gauge' }
  | { type: 'all-done' };

export interface MinigameConfig { examTimeLimitMs: number; hintIdleMs: number; successHoldMs: number }

export function validateMinigame(c: MinigameConfig): string[] {
  const errs: string[] = [];
  for (const k of ['examTimeLimitMs', 'hintIdleMs', 'successHoldMs'] as const) {
    if (typeof c[k] !== 'number' || !(c[k] > 0)) errs.push(`${k}는 0보다 커야 한다`);
  }
  return errs;
}

export const origin = (cfg: Experiments): Device => ({ piston: cfg.syringe.start, tempStep: 0 });

export const createExam = (cfg: Experiments, patient: Patient): ExamState => ({
  patientId: patient.id, stepIndex: 0, device: origin(cfg), used: null, firstUsed: null,
  heldMs: 0, elapsedMs: 0, wrongGauge: 0, wrongLatched: false,
  readings: [], snap: patient.kind === 'measure', tempOpen: patient.kind !== 'measure', done: false,
});

const round1 = (v: number) => Math.round(v * 10) / 10;

/** 피스톤을 움직인다. 온도 다이얼이 원점이 아니면(압력 일정) 무시. */
export function movePiston(cfg: Experiments, st: ExamState, volume: number): ExamState {
  if (st.done || !canUse(cfg, st.device, 'pressure')) return st;
  const clamped = clamp(volume, cfg.syringe.min, cfg.syringe.max);
  const v = st.snap ? Math.round(clamped) : round1(clamped);
  if (v === st.device.piston && st.used === 'pressure') return st;
  return { ...st, device: { piston: v, tempStep: 0 }, used: 'pressure', firstUsed: st.firstUsed ?? 'pressure' };
}

/** 온도 다이얼을 돌린다. 피스톤이 원점이 아니면(온도 일정) 무시. 피스톤은 압력을 맞추며 따라간다. */
export function moveTemp(cfg: Experiments, st: ExamState, step: number): ExamState {
  if (st.done || !st.tempOpen || !canUse(cfg, st.device, 'temperature')) return st;
  const t = clamp(Math.round(step), cfg.temp.minStep, cfg.temp.maxStep);
  if (t === st.device.tempStep && st.used === 'temperature') return st;
  return { ...st, device: { piston: cfg.syringe.start, tempStep: t }, used: 'temperature', firstUsed: st.firstUsed ?? 'temperature' };
}

/** 두 조절기를 원점으로 돌려 잠금을 푼다. 처음 조작한 조절기 기록은 남긴다. */
export const resetDevice = (cfg: Experiments, st: ExamState): ExamState =>
  st.done ? st : { ...st, device: origin(cfg), used: null, heldMs: 0, wrongLatched: false };

/** 시간을 dtMs만큼 진행하고 재현 판정을 한다. 다른 조절기로 같은 부피를 만들어도 성공이 아니다. */
export function tickExam(
  cfg: Experiments, patient: Patient, st: ExamState, dtMs: number,
): { state: ExamState; events: ExamEvent[] } {
  if (st.done) return { state: st, events: [] };
  const events: ExamEvent[] = [];
  const s: ExamState = { ...st, elapsedMs: st.elapsedMs + dtMs };
  const heldMs = s.heldMs + dtMs;

  // 측정 진료: 피스톤이 1 mL 눈금에 있는 시간을 눈금별로 쌓는다. 처음 문턱을 넘는 순간 한 번 알린다.
  const v = s.device.piston;
  if (s.snap && s.device.tempStep === 0 && Number.isInteger(v)) {
    const prev = s.readings.find(x => x.volume === v);
    const dwellMs = (prev?.dwellMs ?? 0) + dtMs;
    s.readings = [...s.readings.filter(x => x.volume !== v), { volume: v, dwellMs }];
    if (dwellMs >= cfg.measure.dwellMs && (prev?.dwellMs ?? 0) < cfg.measure.dwellMs) events.push({ type: 'reading', volume: v });
  }

  const r = matchStep(cfg, patient, s.stepIndex, { used: s.used, device: s.device, heldMs });

  // 측정 진료: 눈금을 모두 읽기 전에는 12 mL에 닿아도 재현이 아니다(건너뛰기 없음)
  const mustRead = s.snap && patient.steps[s.stepIndex].role === 'cause' && !checkPistonRun(cfg, s.readings).complete;
  if (r.ok && mustRead) return { state: { ...s, heldMs }, events };

  if (r.ok) {
    const stepIndex = s.stepIndex + 1;
    const done = stepIndex >= patient.steps.length;
    events.push({ type: 'step-done', stepIndex: s.stepIndex });
    if (done) events.push({ type: 'all-done' });
    return { state: { ...s, stepIndex: done ? s.stepIndex : stepIndex, heldMs: 0, wrongLatched: false, done }, events };
  }
  if (r.reason === 'hold') return { state: { ...s, heldMs }, events };
  if (r.reason === 'wrong-gauge') {
    if (s.wrongLatched) return { state: { ...s, heldMs: 0 }, events };
    events.push({ type: 'wrong-gauge' });
    return { state: { ...s, heldMs: 0, wrongGauge: s.wrongGauge + 1, wrongLatched: true }, events };
  }
  return { state: { ...s, heldMs: 0, wrongLatched: false }, events };
}

/** completeExam에 넘길 결과. bonus(별 ③)는 진료 종류별 보조 과제(Task 8~11)가 정한다. */
export const examResult = (st: ExamState, patient: Patient, limitMs: number, bonus: boolean) => ({
  firstCorrect: st.firstUsed === patient.variable,
  inTime: st.elapsedMs <= limitMs,
  bonus,
  wrongGauge: st.wrongGauge,
});
