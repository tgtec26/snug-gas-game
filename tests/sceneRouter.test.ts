import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sceneFor, attachRouter } from '../game/systems/sceneRouter';
import { useGame } from '../game/store';
import { bgmSlotFor } from '../components/AudioRunner';
import { BGM_SLOTS } from '../game/audio';
import type { Phase } from '../game/types';

const PHASES: Phase[] = ['title', 'intro', 'tutorial', 'clinic', 'story', 'exam', 'diagnosis', 'emergency', 'ending', 'result'];
const REGISTERED = ['Backdrop', 'Clinic', 'Dip', 'Shake', 'Finale'];

describe('phase → 씬', () => {
  it('모든 phase가 등록된 씬으로 간다', () => {
    for (const p of PHASES) expect(REGISTERED, p).toContain(sceneFor(p));
  });
});

describe('검사 장치 씬', () => {
  it('exam은 Clinic, tutorial은 Shake, 나머지는 Backdrop (응급실은 Task 13 전까지 Backdrop)', () => {
    expect(sceneFor('exam')).toBe('Clinic');
    expect(sceneFor('tutorial')).toBe('Shake');
    expect(sceneFor('ending')).toBe('Finale');
    for (const p of PHASES.filter(x => x !== 'exam' && x !== 'tutorial' && x !== 'emergency' && x !== 'ending')) expect(sceneFor(p), p).toBe('Backdrop');
  });
});

describe('담그기 진료 씬', () => {
  it('dip 환자의 exam만 Dip 씬', () => {
    expect(sceneFor('exam', 'dip')).toBe('Dip');
    expect(sceneFor('exam', 'redo')).toBe('Clinic');
    expect(sceneFor('diagnosis', 'dip')).toBe('Backdrop');
  });
});

describe('응급실 씬', () => {
  it('담그기 장치 환자는 Dip, 나머지는 Clinic', () => {
    expect(sceneFor('emergency', 'emergency', 'dip')).toBe('Dip');
    expect(sceneFor('emergency', 'emergency')).toBe('Clinic');
  });
});

describe('phase → 배경음', () => {
  it('모든 phase가 설정에 있는 슬롯을 쓴다', () => {
    for (const p of PHASES) expect(BGM_SLOTS, p).toContain(bgmSlotFor(p));
  });
  it('타이틀·인트로 / 진료 중 / 엔딩·요약', () => {
    expect(bgmSlotFor('title')).toBe('title');
    expect(bgmSlotFor('intro')).toBe('title');
    expect(bgmSlotFor('exam')).toBe('play');
    expect(bgmSlotFor('emergency')).toBe('play');
    expect(bgmSlotFor('ending')).toBe('ending');
    expect(bgmSlotFor('result')).toBe('ending');
  });
});

describe('attachRouter (씬이 시작되는 사이에 phase가 바뀌어도 놓치지 않는다)', () => {
  beforeEach(() => { localStorage.clear(); useGame.getState().reset(); });
  const fake = (key: string) => {
    const handlers: Array<[string, () => void]> = [];
    const emit = (name: string) => handlers.filter(([n]) => n === name).forEach(([, h]) => h());
    return {
      start: vi.fn(),
      scene: { scene: { key, start: vi.fn() }, events: { once: (name: string, fn: () => void) => handlers.push([name, fn]) } },
      shutdown: () => emit('shutdown'),
      destroy: () => emit('destroy'),
    };
  };
  it('붙는 순간 이미 phase가 exam이면 바로 Clinic으로 넘긴다', () => {
    useGame.setState({ phase: 'exam' });
    const f = fake('Backdrop');
    attachRouter(f.scene as never);
    expect(f.scene.scene.start).toHaveBeenCalledWith('Clinic');
  });
  it('이미 알맞은 씬이면 아무것도 하지 않는다', () => {
    useGame.setState({ phase: 'clinic' });
    const f = fake('Backdrop');
    attachRouter(f.scene as never);
    expect(f.scene.scene.start).not.toHaveBeenCalled();
  });
  it('붙은 뒤 phase가 바뀌면 한 번만 넘기고 구독을 끊는다', () => {
    useGame.setState({ phase: 'clinic' });
    const f = fake('Backdrop');
    attachRouter(f.scene as never);
    useGame.setState({ phase: 'exam' });
    useGame.setState({ phase: 'diagnosis' });
    expect(f.scene.scene.start).toHaveBeenCalledTimes(1);
    expect(f.scene.scene.start).toHaveBeenCalledWith('Clinic');
  });
  it('shutdown 뒤에는 반응하지 않는다', () => {
    useGame.setState({ phase: 'clinic' });
    const f = fake('Backdrop');
    attachRouter(f.scene as never);
    f.shutdown();
    useGame.setState({ phase: 'exam' });
    expect(f.scene.scene.start).not.toHaveBeenCalled();
  });
  it('게임이 통째로 파괴된 뒤(개발 중 화면 갱신)에도 옛 씬이 반응하지 않는다', () => {
    useGame.setState({ phase: 'clinic' });
    const f = fake('Backdrop');
    attachRouter(f.scene as never);
    f.destroy();   // game.destroy()는 shutdown 없이 destroy만 내보낸다
    useGame.setState({ phase: 'exam' });
    expect(f.scene.scene.start).not.toHaveBeenCalled();
  });
});
