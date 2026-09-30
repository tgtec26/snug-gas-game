import { describe, it, expect } from 'vitest';
import { sceneFor } from '../game/systems/sceneRouter';
import { bgmSlotFor } from '../components/AudioRunner';
import { BGM_SLOTS } from '../game/audio';
import type { Phase } from '../game/types';

const PHASES: Phase[] = ['title', 'intro', 'tutorial', 'clinic', 'story', 'exam', 'diagnosis', 'emergency', 'ending', 'result'];
const REGISTERED = ['Backdrop'];

describe('phase → 씬', () => {
  it('모든 phase가 등록된 씬으로 간다', () => {
    for (const p of PHASES) expect(REGISTERED, p).toContain(sceneFor(p));
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
