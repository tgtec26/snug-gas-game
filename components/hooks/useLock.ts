// 화면 전환 뒤 잠깐 입력 무시 (연타 방지). 시간은 minigame-config의 lockMs(짧게)·longLockMs(길게)에서 읽는다(admin 미니게임 탭).
import { useEffect, useState } from 'react';
import { useDataStore } from '@/game/dataStore';

export function useLock(kind: 'short' | 'long' = 'short') {
  const ms = useDataStore(s => (kind === 'short' ? s.minigame?.lockMs : s.minigame?.longLockMs)) ?? (kind === 'short' ? 700 : 1200);
  const [locked, setLocked] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLocked(false), ms); return () => clearTimeout(t); }, [ms]);
  return locked;
}
