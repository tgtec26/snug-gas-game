import type * as Phaser from 'phaser';
import { useGame } from '@/game/store';
import type { Phase } from '@/game/types';

/** 등록된 씬 키. 태스크가 진행되며 Clinic(Task 7), Shake(Task 12), Finale(Task 14)이 더해진다. */
export type SceneKey = 'Backdrop' | 'Clinic';

/** phase → 씬. 검사(exam)는 검사 장치 씬, 나머지 오버레이 위주 phase는 대기실 배경 씬. */
export function sceneFor(phase: Phase): SceneKey {
  return phase === 'exam' ? 'Clinic' : 'Backdrop';
}

/**
 * 씬이 떠 있는 동안 phase가 바뀌면 알맞은 씬으로 넘긴다.
 * 붙는 순간에도 현재 phase를 확인한다: scene.start()와 create() 사이에 phase가 먼저 바뀌면
 * "변화"만 보는 구독은 그것을 놓쳐 엉뚱한 씬에 머문다(새로고침·빠른 건너뛰기).
 */
export function attachRouter(scene: Phaser.Scene) {
  const go = (phase: Phase) => {
    const target = sceneFor(phase);
    if (target === scene.scene.key) return false;
    unsub(); scene.scene.start(target);
    return true;
  };
  const unsub = useGame.subscribe((s, prev) => { if (s.phase !== prev.phase) go(s.phase); });
  scene.events.once('shutdown', unsub);
  go(useGame.getState().phase);
  return unsub;
}
