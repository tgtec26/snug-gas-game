import { describe, it, expect } from 'vitest';
import patients from '../public/data/patients.json';
import type { Patient, Phase } from '../game/types';
import { buildStages } from '../game/stages';
import { sceneFor } from '../game/systems/sceneRouter';
import { emergencyQueue } from '../game/store';

const ps = patients as unknown as Patient[];
const stages = buildStages(ps);
const examIds = ps.filter(p => p.kind !== 'emergency').map(p => p.id);
const emergencyIds = ps.filter(p => p.kind === 'emergency').map(p => p.id);
const PHASES: Phase[] = ['title', 'intro', 'tutorial', 'clinic', 'story', 'exam', 'diagnosis', 'emergency', 'ending', 'result'];
const find = (id: string) => stages.find(s => s.id === id)!;

describe('미리보기 스테이지 목록', () => {
  it('모든 phase가 하나 이상 들어 있고 id가 겹치지 않는다', () => {
    for (const p of PHASES) expect(stages.some(s => s.state.phase === p), p).toBe(true);
    expect(new Set(stages.map(s => s.id)).size).toBe(stages.length);
  });
  it('환자마다 사연·진료·진단서(진료 4명), 응급실(4명)이 따로 있다', () => {
    for (const id of examIds) for (const k of ['story', 'exam', 'diagnosis']) expect(find(`${k}:${id}`), `${k}:${id}`).toBeTruthy();
    for (const id of emergencyIds) expect(find(`emergency:${id}`)).toBeTruthy();
  });
  it('진료·사연은 앞 환자까지 끝낸 기록을 채우고 자기 기록은 비운다', () => {
    const second = find(`exam:${examIds[1]}`).state;
    expect(Object.keys(second.records!)).toEqual([examIds[0]]);
    expect(second.currentId).toBe(examIds[1]);
    expect(find(`story:${examIds[1]}`).state.records![examIds[1]]).toBeUndefined();
  });
  it('진단서는 그 환자의 기록이 있어야 별이 보인다', () => {
    const d = find(`diagnosis:${examIds[2]}`).state;
    expect(d.records![examIds[2]]).toBeTruthy(); expect(d.phase).toBe('diagnosis');
  });
  it('응급실 환자는 앞 환자까지 푼 기록과 함께 그 차례로 시작한다', () => {
    const e = find(`emergency:${emergencyIds[2]}`).state;
    expect(e.currentId).toBe(emergencyIds[2]);
    expect(e.emergencyLog).toEqual(emergencyIds.slice(0, 2).map(id => ({ id, ok: true })));
    expect(emergencyQueue(emergencyIds, e.emergencyLog!)[e.emergencyLog!.length]).toBe(emergencyIds[2]);
    expect(Object.keys(e.records!)).toEqual(examIds);
  });
  it('피날레·결과는 진료 기록과 응급실 결과를 모두 채운다', () => {
    for (const id of ['ending', 'result']) {
      const s = find(id).state;
      expect(Object.keys(s.records!)).toEqual(examIds);
      expect(s.emergencyResults).toEqual(emergencyIds.map(() => true));
    }
  });
  it('모든 스테이지가 등록된 씬으로 이어진다', () => {
    for (const s of stages) {
      const p = ps.find(x => x.id === s.state.currentId);
      expect(['Backdrop', 'Clinic', 'Dip', 'Shake', 'Finale'], s.id).toContain(sceneFor(s.state.phase!, p?.kind, p?.rig));
    }
  });
});
