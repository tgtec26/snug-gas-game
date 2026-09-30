'use client';

import { useGame } from '@/game/store';

/** 개발 전용(배포 빌드에는 나오지 않음): 아직 없는 화면의 phase를 next()로 넘겨 흐름을 확인한다. */
export function DevSkip() {
  const phase = useGame(s => s.phase);
  const next = useGame(s => s.next);
  if (process.env.NODE_ENV === 'production') return null;
  return (
    <div className="absolute left-16 bottom-3 z-50 pointer-events-auto flex items-center gap-2 text-[14px] text-white/80">
      <span className="px-2 py-1 rounded bg-black/60">dev: {phase}</span>
      <button type="button" onClick={e => { next(); e.currentTarget.blur(); }} className="px-3 py-1 rounded bg-black/60 border border-white/40">next()</button>
    </div>
  );
}
