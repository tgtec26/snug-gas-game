'use client';

import { useGame } from '@/game/store';

/**
 * 개발 전용(배포 빌드에는 나오지 않음): 아직 없는 화면을 건너뛰어 흐름을 확인한다.
 * - 모든 phase: next()
 * - exam: 재현 성공(별 3개)으로 진단서로
 * - emergency: 응급실 4명 모두 성공으로 엔딩으로
 */
export function DevSkip() {
  const phase = useGame(s => s.phase);
  const currentId = useGame(s => s.currentId);
  const next = useGame(s => s.next);
  const completeExam = useGame(s => s.completeExam);
  const finishEmergency = useGame(s => s.finishEmergency);
  if (process.env.NODE_ENV === 'production') return null;
  const btn = 'px-3 py-1 rounded bg-black/60 border border-white/40';
  return (
    <div className="absolute left-[360px] bottom-10 z-50 pointer-events-auto flex items-center gap-2 text-[14px] text-white/80">
      <span className="px-2 py-1 rounded bg-black/60">dev: {phase}</span>
      <button type="button" className={btn} onClick={e => { next(); e.currentTarget.blur(); }}>next()</button>
      {phase === 'exam' && currentId && (
        <button type="button" className={btn} onClick={e => { completeExam(currentId, { firstCorrect: true, inTime: true, bonus: true, wrongGauge: 0 }); e.currentTarget.blur(); }}>재현 성공</button>
      )}
      {phase === 'emergency' && (
        <button type="button" className={btn} onClick={e => { finishEmergency([true, true, true, true]); e.currentTarget.blur(); }}>응급실 완료</button>
      )}
    </div>
  );
}
