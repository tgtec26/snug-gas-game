import type { Patient } from './types';

/** 화면 위에 늘 떠 있는 "지금 할 일" 한 줄 (대사 설정 dialog-config의 goals). */
export interface Goals {
  tutorial: string; clinic: string; story: string;
  measure: { cause: string; explore: string };
  pressure: { cause: string; explore: string };
  temperature: { cause: string; explore: string };
  dipCold: string; dipHot: string; finale: string;
}

/** 지금 재현해야 하는 step에 맞는 안내. 담그기 장치는 얼음물/뜨거운 물, 측정 진료는 눈금 읽기. */
export function goalFor(goals: Goals, patient: Patient, stepIndex: number): string {
  const step = patient.steps[Math.min(stepIndex, patient.steps.length - 1)];
  if (patient.kind === 'dip' || patient.rig === 'dip') return step.change === 'up' ? goals.dipHot : goals.dipCold;
  if (patient.kind === 'measure') return goals.measure[step.role];
  return goals[patient.variable][step.role];
}
