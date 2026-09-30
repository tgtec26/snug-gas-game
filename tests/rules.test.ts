import { describe, it, expect } from 'vitest';
import experiments from '../public/data/experiments.json';
import patients from '../public/data/patients.json';
import particleRules from '../public/data/particle-rules.json';
import type { Device, Experiments, ParticleRule, Patient } from '../game/types';
import {
  lawOf, volumeDirection, needleFromVolume, volumeFromTemp, deviceVolume, heldConstant, canUse, badgeText,
  stepTargetVolume, matchStep, checkPistonRun, checkSafetyGear, checkSubmerged, checkLensObserved,
  particleView, scoreStars, comboOf,
} from '../game/rules';

const cfg = experiments as unknown as Experiments;
const ps = patients as unknown as Patient[];
const rules = particleRules as unknown as ParticleRule[];
const origin: Device = { piston: cfg.syringe.start, tempStep: 0 };

describe('법칙과 부피 방향 (교과서 202, 212쪽)', () => {
  it('압력은 보일, 온도는 샤를', () => { expect(lawOf('pressure')).toBe('boyle'); expect(lawOf('temperature')).toBe('charles'); });
  it('4조합', () => {
    expect(volumeDirection('pressure', 'up')).toBe('decrease');
    expect(volumeDirection('pressure', 'down')).toBe('increase');
    expect(volumeDirection('temperature', 'up')).toBe('increase');
    expect(volumeDirection('temperature', 'down')).toBe('decrease');
  });
});

describe('반비례와 일정한 비율 (수치를 화면에 쓰지 않는 상대 값)', () => {
  it('부피가 절반이면 바늘은 2배', () => {
    for (const v of [16, 20, 24, 28]) {
      expect(needleFromVolume(v / 2, cfg.syringe.start)).toBeCloseTo(2 * needleFromVolume(v, cfg.syringe.start));
    }
  });
  it('기준 부피에서 바늘은 1', () => { expect(needleFromVolume(20, 20)).toBe(1); });
  it('부피가 작아질수록 바늘은 커진다', () => {
    let prev = 0;
    for (let v = cfg.syringe.max; v >= cfg.syringe.min; v--) {
      const n = needleFromVolume(v, cfg.syringe.start);
      expect(n).toBeGreaterThan(prev); prev = n;
    }
  });
  it('0 이하 부피는 오류', () => { expect(() => needleFromVolume(0, 20)).toThrow(); });
  it('온도 단계가 같으면 부피 증가도 같다', () => {
    const d = (a: number, b: number) => volumeFromTemp(cfg, b) - volumeFromTemp(cfg, a);
    expect(d(-4, -3)).toBeCloseTo(d(0, 1));
    expect(d(2, 3)).toBeCloseTo(d(0, 1));
    expect(volumeFromTemp(cfg, 0)).toBe(cfg.syringe.start);
  });
});

describe('한 번에 하나만 바꾸기 (잠금)', () => {
  it('둘 다 원점이면 잠금 없음', () => { expect(heldConstant(cfg, origin)).toBeNull(); });
  it('피스톤을 움직이면 온도가 일정', () => {
    const d = { piston: 15, tempStep: 0 };
    expect(heldConstant(cfg, d)).toBe('temperature');
    expect(canUse(cfg, d, 'temperature')).toBe(false);
    expect(canUse(cfg, d, 'pressure')).toBe(true);
    expect(badgeText('temperature')).toBe('온도 일정');
  });
  it('온도 다이얼을 돌리면 압력이 일정, 부피는 온도로 정해진다', () => {
    const d = { piston: 15, tempStep: 2 };
    expect(heldConstant(cfg, d)).toBe('pressure');
    expect(canUse(cfg, d, 'pressure')).toBe(false);
    expect(deviceVolume(cfg, d)).toBe(volumeFromTemp(cfg, 2));
    expect(badgeText('pressure')).toBe('압력 일정');
  });
});

describe('재현 판정 (지름길 없음)', () => {
  it('환자 데이터: 목표 부피가 주사기 범위 안이고 모두 verified', () => {
    for (const p of ps) {
      expect(p.verified).toBe(true);
      p.steps.forEach((_, i) => {
        const t = stepTargetVolume(cfg, p, i);
        expect(t).toBeGreaterThanOrEqual(cfg.syringe.min);
        expect(t).toBeLessThanOrEqual(cfg.syringe.max);
      });
    }
  });
  it('올바른 조절기 + 목표 부피 + 유지 시간 → 성공', () => {
    for (const p of ps) {
      p.steps.forEach((s, i) => {
        const device: Device = p.variable === 'pressure'
          ? { piston: stepTargetVolume(cfg, p, i), tempStep: 0 }
          : { piston: cfg.syringe.start, tempStep: s.change === 'up' ? s.size : -s.size };
        expect(matchStep(cfg, p, i, { used: p.variable, device, heldMs: cfg.holdMs })).toEqual({ ok: true, reason: null });
      });
    }
  });
  it('유지 시간이 모자라면 hold, 목표가 아니면 not-there', () => {
    const p = ps[1];
    const at = { piston: stepTargetVolume(cfg, p, 0), tempStep: 0 };
    expect(matchStep(cfg, p, 0, { used: 'pressure', device: at, heldMs: 0 }).reason).toBe('hold');
    expect(matchStep(cfg, p, 0, { used: 'pressure', device: origin, heldMs: 9999 }).reason).toBe('not-there');
  });
  it('다른 조절기로 같은 부피를 만들어도 모든 환자·모든 단계에서 실패 (전수)', () => {
    let reachedWrongGauge = 0;
    for (const p of ps) {
      p.steps.forEach((_, i) => {
        const wrong = p.variable === 'pressure' ? 'temperature' : 'pressure';
        const devices: Device[] = [];
        if (wrong === 'temperature') for (let t = cfg.temp.minStep; t <= cfg.temp.maxStep; t++) devices.push({ piston: cfg.syringe.start, tempStep: t });
        else for (let v = cfg.syringe.min; v <= cfg.syringe.max; v++) devices.push({ piston: v, tempStep: 0 });
        for (const device of devices) {
          const r = matchStep(cfg, p, i, { used: wrong, device, heldMs: 99999 });
          expect(r.ok).toBe(false);
          if (r.reason === 'wrong-gauge') reachedWrongGauge++;
        }
      });
    }
    expect(reachedWrongGauge).toBeGreaterThan(0); // 부피가 같아졌는데도 막힌 경우가 실제로 있다
  });
  it('step 범위 밖이면 오류', () => { expect(() => stepTargetVolume(cfg, ps[0], 9)).toThrow(); });
});

describe('측정 진료: 눈금을 모두 읽어야 한다', () => {
  const all = (dwell: number) => { const r = []; for (let v = 20; v >= 12; v--) r.push({ volume: v, dwellMs: dwell }); return r; };
  it('20~12 전부 읽으면 완료', () => { expect(checkPistonRun(cfg, all(500))).toEqual({ complete: true, missing: [] }); });
  it('12 mL로 바로 끌면 미완 (나머지 8개 누락)', () => {
    const r = checkPistonRun(cfg, [{ volume: 12, dwellMs: 900 }]);
    expect(r.complete).toBe(false); expect(r.missing).toEqual([20, 19, 18, 17, 16, 15, 14, 13]);
  });
  it('멈춤 시간이 짧으면 그 눈금은 읽지 않은 것', () => {
    const r = checkPistonRun(cfg, [...all(500).filter(x => x.volume !== 15), { volume: 15, dwellMs: 100 }]);
    expect(r.missing).toEqual([15]);
  });
});

describe('안전 장비·담그기·렌즈', () => {
  it('장갑과 보안경을 모두 착용해야 한다', () => {
    expect(checkSafetyGear(cfg, ['gloves'])).toBe(false);
    expect(checkSafetyGear(cfg, ['goggles', 'gloves'])).toBe(true);
  });
  it('기체가 모두 잠겨야 한다', () => { expect(checkSubmerged(300, 280)).toBe(true); expect(checkSubmerged(250, 280)).toBe(false); });
  it('렌즈를 댄 채 일정 시간 움직여야 관찰', () => { expect(checkLensObserved(cfg, 1999)).toBe(false); expect(checkLensObserved(cfg, 2000)).toBe(true); });
});

describe('입자 렌즈: 교과서 칸만 강조 (207, 217, 202쪽)', () => {
  it('압력↑: 개수 일정, 거리 감소, 충돌 횟수 증가, 화살표 길이 같음, 세기는 강조 안 함', () => {
    expect(particleView(rules, 'pressure', 'up')).toMatchObject({ count: 'same', distance: 'decrease', collisionCount: 'increase', speed: 'same', strength: null });
  });
  it('온도↑: 개수 일정, 빠르기·세기 증가, 거리·횟수는 강조 안 함', () => {
    expect(particleView(rules, 'temperature', 'up')).toMatchObject({ count: 'same', speed: 'increase', strength: 'increase', distance: null, collisionCount: null });
  });
  it('내림은 반대', () => {
    expect(particleView(rules, 'pressure', 'down')).toMatchObject({ distance: 'increase', collisionCount: 'decrease' });
    expect(particleView(rules, 'temperature', 'down')).toMatchObject({ speed: 'decrease', strength: 'decrease' });
  });
  it('규칙이 없으면 오류', () => { expect(() => particleView([], 'pressure', 'up')).toThrow(); });
  it('입자 개수는 어떤 조합에서도 일정', () => { for (const r of rules) expect(r.count).toBe('same'); });
});

describe('별점과 콤보', () => {
  it('별 0~3', () => {
    expect(scoreStars({ firstCorrect: true, inTime: true, bonus: true })).toBe(3);
    expect(scoreStars({ firstCorrect: false, inTime: true, bonus: false })).toBe(1);
    expect(scoreStars({ firstCorrect: false, inTime: false, bonus: false })).toBe(0);
  });
  it('콤보는 실패하면 끊긴다', () => {
    expect(comboOf([true, true, false, true])).toEqual({ current: 1, best: 2 });
    expect(comboOf([])).toEqual({ current: 0, best: 0 });
  });
});
