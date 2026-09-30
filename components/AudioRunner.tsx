'use client';

import { useEffect } from 'react';
import { useGame } from '@/game/store';
import { playBgm, stopBgm, unlockAudio, type BgmSlot } from '@/game/audio';
import { useDataStore } from '@/game/dataStore';
import type { Phase } from '@/game/types';

/** phase에 맞춰 배경음 전환: 타이틀·인트로 / 진료 중 / 엔딩·요약 */
export function bgmSlotFor(phase: Phase): BgmSlot {
  if (phase === 'title' || phase === 'intro') return 'title';
  if (phase === 'ending' || phase === 'result') return 'ending';
  return 'play';
}

export function AudioRunner() {
  const phase = useGame(s => s.phase);
  const audio = useDataStore(s => s.audio);

  useEffect(() => { if (audio) playBgm(bgmSlotFor(phase)); }, [phase, audio]);

  // 첫 입력 전에는 자동 재생이 막히므로 입력이 올 때마다 재시도
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => { window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); stopBgm(); };
  }, []);

  return null;
}
