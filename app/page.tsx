'use client';

import { useLayoutEffect, useState } from 'react';
import { GAME_WIDTH, GAME_HEIGHT } from '@/game/config';

/** 무대 1280×800을 뷰포트에 letterbox (UI는 transform scale). 게임 본체는 아직 없다. */
export default function Home() {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);

  return (
    <main className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <div
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'center center', flex: 'none' }}
        className="flex items-center justify-center bg-slate-800 text-white"
      >
        <h1 className="text-5xl font-bold">공기 진료소 (가제)</h1>
      </div>
    </main>
  );
}
