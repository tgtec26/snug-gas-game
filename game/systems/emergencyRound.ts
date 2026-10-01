import { useGame } from '@/game/store';
import { comboOf } from '@/game/rules';

/** 응급실 라운드 중인가 */
export const inEmergency = (): boolean => useGame.getState().phase === 'emergency';

/** 응급실에서 사연이 끝나기 전에는 조절기를 쓸 수 없다. */
export function roundBlocked(): boolean {
  const s = useGame.getState();
  return s.phase === 'emergency' && !s.roundReady;
}

/** 이번 성공까지 포함한 콤보에 따라 올라가는 효과음 배속 (음높이) */
export function comboRate(): number {
  const combo = comboOf(useGame.getState().emergencyLog.map(l => l.ok)).current + 1;
  return Math.min(1.6, 1 + 0.12 * (combo - 1));
}
