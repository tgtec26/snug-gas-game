// 화면 전환 뒤 잠깐 입력 무시 (연타 방지). ms는 admin의 입력 잠금 값으로 바꿀 수 있게 호출하는 쪽에서 넘긴다.
import { useEffect, useState } from 'react';
export function useLock(ms = 900) {
  const [locked, setLocked] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLocked(false), ms); return () => clearTimeout(t); }, [ms]);
  return locked;
}
