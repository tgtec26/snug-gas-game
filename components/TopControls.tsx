'use client';

import { useEffect, useState } from 'react';
import { isMuted, setMuted } from '@/game/audio';

const btn = 'pointer-events-auto w-11 h-11 rounded-xl bg-slate-900/80 border-2 border-white/60 flex items-center justify-center';

/** 오른쪽 위 전체 화면·음소거. 누른 뒤 blur()해서 Enter·Space가 다시 누르지 않게 한다. */
export function TopControls() {
  const [mute, setMute] = useState(isMuted());
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  return (
    <div className="absolute top-2 right-3 flex gap-2 z-50">
      <button type="button" aria-label="음소거" aria-pressed={mute} className={btn}
        onClick={e => { setMuted(!mute); setMute(!mute); e.currentTarget.blur(); }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#fff" />
          {mute ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8c1.6 1.2 1.6 6.8 0 8M19.5 5.5c3.4 3 3.4 10 0 13" />}
        </svg>
      </button>
      <button type="button" aria-label="전체 화면" aria-pressed={full} className={btn}
        onClick={e => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); e.currentTarget.blur(); }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {full
            ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
        </svg>
      </button>
    </div>
  );
}
