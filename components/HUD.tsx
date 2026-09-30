'use client';

import { useGame, totalStars } from '@/game/store';
import type { Phase } from '@/game/types';

const SHOWN: Phase[] = ['clinic', 'story', 'exam', 'diagnosis', 'emergency'];

export function StarIcon({ size = 28, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.6 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"
        fill={filled ? '#f2c14e' : 'none'} stroke={filled ? '#b7791f' : '#8a97a3'} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/** 왼쪽 위 별 합계. 진료 중에만 보인다. */
export function HUD() {
  const phase = useGame(s => s.phase);
  const records = useGame(s => s.records);
  const emergencyResults = useGame(s => s.emergencyResults);
  if (!SHOWN.includes(phase)) return null;
  const n = totalStars({ records, emergencyResults });
  return (
    <div className="absolute top-2 left-3 z-40 flex items-center gap-2 rounded-xl bg-slate-900/80 border-2 border-white/60 px-3 h-11" aria-label={`별 ${n}개`}>
      <StarIcon />
      <span className="text-[24px] font-black text-white tabular-nums">{n}</span>
    </div>
  );
}
