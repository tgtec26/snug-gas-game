'use client';

import { useGame } from '@/game/store';
import { useUI } from '@/game/ui';

/** 시작 조작이 곧 전체 화면 요청이다(별도 안내 단계 없음). start()는 title에서만 동작해 연타해도 한 번만 진행한다. */
export function TitleOverlay() {
  const phase = useGame(s => s.phase);
  const start = useGame(s => s.start);
  const openDex = useUI(s => s.openDex);
  if (phase !== 'title') return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 pointer-events-auto">
      <div className="text-[22px] text-amber-200 tracking-widest mb-2">중1 과학 · 기체의 성질</div>
      <h1 className="text-[84px] font-black text-white mb-12 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]">공기 진료소</h1>
      <button
        type="button"
        autoFocus
        onClick={() => {
          document.documentElement.requestFullscreen?.().catch(() => {});   // 시작 조작 = 전체 화면
          start();
        }}
        className="text-[30px] w-[260px] h-[72px] rounded-2xl bg-amber-400 text-slate-900 font-black shadow-[0_8px_0_#b7791f] active:translate-y-1 active:shadow-[0_4px_0_#b7791f] animate-pulse"
      >
        진료 시작
      </button>
      <button type="button" onClick={openDex} className="mt-6 text-[22px] px-6 h-[52px] rounded-xl bg-white/90 text-slate-900 font-bold border-4 border-amber-300">진료 기록부</button>
    </div>
  );
}
