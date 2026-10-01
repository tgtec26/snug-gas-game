import { describe, it, expect } from 'vitest';
import experiments from '../public/data/experiments.json';
import patients from '../public/data/patients.json';
import minigame from '../public/data/minigame-config.json';
import type { Experiments, Patient } from '../game/types';
import { stepTargetVolume, heldConstant } from '../game/rules';
import {
  createExam, movePiston, moveTemp, resetDevice, tickExam, examResult, validateMinigame,
  type ExamState, type ExamEvent, type MinigameConfig,
} from '../game/exam';

const cfg = experiments as unknown as Experiments;
const ps = patients as unknown as Patient[];
const byId = (id: string) => ps.find(p => p.id === id)!;
const mg = minigame as unknown as MinigameConfig;

/** 같은 상태로 ms만큼 시간을 흘린다 (16ms 프레임) */
function run(p: Patient, st: ExamState, ms: number) {
  const events: ExamEvent[] = [];
  let s = st;
  for (let t = 0; t < ms; t += 16) { const r = tickExam(cfg, p, s, 16); s = r.state; events.push(...r.events); }
  return { s, events };
}
/** 환자의 step을 올바른 조절기로 재현 */
function reproduce(p: Patient, st: ExamState, i: number) {
  const step = p.steps[i];
  return p.variable === 'pressure'
    ? movePiston(cfg, st, stepTargetVolume(cfg, p, i))
    : moveTemp(cfg, st, step.change === 'up' ? step.size : -step.size);
}

describe('올바른 조절기로 끝까지 재현', () => {
  for (const p of ps) {
    it(`${p.name}: 모든 step을 재현하면 all-done 한 번, 이벤트 순서 보존`, () => {
      let s = createExam(cfg, p);
      const all: ExamEvent[] = [];
      for (let i = 0; i < p.steps.length; i++) {
        s = reproduce(p, s, i);
        const r = run(p, s, cfg.holdMs + 200); s = r.s; all.push(...r.events);
      }
      expect(s.done).toBe(true);
      expect(all.filter(e => e.type === 'all-done')).toHaveLength(1);
      expect(all.filter(e => e.type === 'step-done').map(e => (e as { stepIndex: number }).stepIndex)).toEqual(p.steps.map((_, i) => i));
      expect(s.wrongGauge).toBe(0);
    });
  }
});

describe('유지 시간', () => {
  it('목표에 닿아도 유지 시간 전에는 성공이 아니다', () => {
    const p = byId('snackbag');
    const s = reproduce(p, createExam(cfg, p), 0);
    const r = run(p, s, cfg.holdMs - 100);
    expect(r.s.done).toBe(false); expect(r.s.stepIndex).toBe(0); expect(r.events).toEqual([]);
  });
  it('목표를 벗어나면 유지 시간이 0으로 돌아간다', () => {
    const p = byId('snackbag');
    let s = reproduce(p, createExam(cfg, p), 0);
    s = run(p, s, cfg.holdMs - 100).s;
    expect(s.heldMs).toBeGreaterThan(0);
    s = movePiston(cfg, s, cfg.syringe.start);
    s = run(p, s, 50).s;
    expect(s.heldMs).toBe(0);
  });
});

describe('다른 조절기로 같은 부피 (지름길 없음)', () => {
  it('압력 환자에게 온도 다이얼로 같은 부피를 만들면 wrong-gauge를 한 번만 알리고 성공하지 않는다', () => {
    const p = byId('airbed');      // 압력↑ 4칸 → 부피 16. 온도 -3단계 = 15.5 (허용 오차 안)
    let s = moveTemp(cfg, createExam(cfg, p), -3);
    const r = run(p, s, 3000); s = r.s;
    expect(r.events.filter(e => e.type === 'wrong-gauge')).toHaveLength(1);
    expect(s.wrongGauge).toBe(1);
    expect(s.done).toBe(false);
    expect(s.firstUsed).toBe('temperature');
  });
  it('원점으로 돌린 뒤 올바른 조절기로 하면 성공하고, 첫 조작이 틀렸으니 별 ①은 없다', () => {
    const p = byId('airbed');
    let s = moveTemp(cfg, createExam(cfg, p), -3);
    s = run(p, s, 500).s;
    s = resetDevice(cfg, s);
    s = reproduce(p, s, 0);
    s = run(p, s, cfg.holdMs + 100).s;
    expect(s.done).toBe(true);
    expect(examResult(s, p, mg.examTimeLimitMs, false)).toMatchObject({ firstCorrect: false, wrongGauge: 1 });
  });
  it('다시 벗어났다가 들어오면 wrong-gauge를 다시 센다', () => {
    const p = byId('airbed');
    let s = moveTemp(cfg, createExam(cfg, p), -3);
    s = run(p, s, 100).s;
    s = moveTemp(cfg, s, 0); s = run(p, s, 100).s;
    s = moveTemp(cfg, s, -3); s = run(p, s, 100).s;
    expect(s.wrongGauge).toBe(2);
  });
});

describe('한 번에 하나만 바꾸기 (잠금)', () => {
  it('피스톤을 움직이면 온도 다이얼은 무시된다', () => {
    const p = byId('snackbag');
    let s = movePiston(cfg, createExam(cfg, p), 24);
    const before = s;
    s = moveTemp(cfg, s, 2);
    expect(s).toBe(before);
    expect(heldConstant(cfg, s.device)).toBe('temperature');
  });
  it('온도 다이얼을 돌리면 피스톤은 무시된다', () => {
    const p = byId('soccerball');
    let s = moveTemp(cfg, createExam(cfg, p), -2);
    const before = s;
    s = movePiston(cfg, s, 25);
    expect(s).toBe(before);
    expect(heldConstant(cfg, s.device)).toBe('pressure');
  });
  it('원점으로 돌리면 잠금이 풀린다', () => {
    const p = byId('soccerball');
    let s = moveTemp(cfg, createExam(cfg, p), -2);
    s = resetDevice(cfg, s);
    s = movePiston(cfg, s, 24);
    expect(s.device.piston).toBe(24);
  });
  it('온도를 원점(0)으로 돌려도 잠금이 풀린다', () => {
    const p = byId('soccerball');
    let s = moveTemp(cfg, createExam(cfg, p), -2);
    s = moveTemp(cfg, s, 0);
    s = movePiston(cfg, s, 24);
    expect(s.device.piston).toBe(24);
  });
  it('범위를 넘으면 잘라서 받는다', () => {
    const p = byId('snackbag');
    expect(movePiston(cfg, createExam(cfg, p), 999).device.piston).toBe(cfg.syringe.max);
    expect(movePiston(cfg, createExam(cfg, p), -5).device.piston).toBe(cfg.syringe.min);
    expect(moveTemp(cfg, createExam(cfg, p), 99).device.tempStep).toBe(cfg.temp.maxStep);
    expect(moveTemp(cfg, createExam(cfg, p), -99).device.tempStep).toBe(cfg.temp.minStep);
  });
});

describe('끝난 뒤와 제한 시간', () => {
  it('끝난 진료는 더 바뀌지 않는다', () => {
    const p = byId('ppball');
    let s = reproduce(p, createExam(cfg, p), 0);
    s = run(p, s, cfg.holdMs + 100).s;
    expect(s.done).toBe(true);
    expect(movePiston(cfg, s, 25)).toBe(s);
    expect(moveTemp(cfg, s, 1)).toBe(s);
    expect(resetDevice(cfg, s)).toBe(s);
    expect(tickExam(cfg, p, s, 16).events).toEqual([]);
  });
  it('제한 시간 안이면 inTime, 넘으면 아님', () => {
    const p = byId('ppball');
    const fast = { ...createExam(cfg, p), firstUsed: 'temperature' as const, elapsedMs: mg.examTimeLimitMs - 1 };
    const slow = { ...fast, elapsedMs: mg.examTimeLimitMs + 1 };
    expect(examResult(fast, p, mg.examTimeLimitMs, false).inTime).toBe(true);
    expect(examResult(slow, p, mg.examTimeLimitMs, false).inTime).toBe(false);
    expect(examResult(fast, p, mg.examTimeLimitMs, false).firstCorrect).toBe(true);
  });
  it('시간은 tick마다 쌓인다', () => {
    const p = byId('snackbag');
    expect(run(p, createExam(cfg, p), 1000).s.elapsedMs).toBeGreaterThanOrEqual(1000);
  });
});

describe('minigame-config.json', () => {
  it('오류가 없다', () => { expect(validateMinigame(mg)).toEqual([]); });
  it('0 이하 값은 잡는다', () => { expect(validateMinigame({ ...mg, examTimeLimitMs: 0 }).join()).toContain('examTimeLimitMs'); });
});
