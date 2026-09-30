import type * as Phaser from 'phaser';
import { useGame } from '@/game/store';
import type { Phase } from '@/game/types';

/** 등록된 씬 키. 태스크가 진행되며 Clinic(Task 7), Shake(Task 12), Finale(Task 14)이 더해진다. */
export type SceneKey = 'Backdrop';

/** phase → 씬. 오버레이 위주의 phase는 모두 대기실 배경 씬을 쓴다. */
export function sceneFor(phase: Phase): SceneKey {
  void phase;
  return 'Backdrop';
}

export function attachRouter(scene: Phaser.Scene) {
  const unsub = useGame.subscribe((s, prev) => {
    if (s.phase === prev.phase) return;
    const target = sceneFor(s.phase);
    if (target !== scene.scene.key) { unsub(); scene.scene.start(target); }
  });
  scene.events.once('shutdown', unsub);
  return unsub;
}
