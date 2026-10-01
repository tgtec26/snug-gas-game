'use client';

/** 화면 위쪽의 "지금 할 일" 한 줄 (Phaser 씬의 GoalBanner와 같은 모양). */
export function GoalBar({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-8 h-14 flex items-center rounded-full bg-[#0f1d26]/80 border-[3px] border-white/55 text-white text-[32px] font-bold whitespace-nowrap pointer-events-none select-none">
      {text}
    </div>
  );
}
