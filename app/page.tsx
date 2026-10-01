'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { GameContainer } from '@/components/GameContainer';
import { UIOverlay } from '@/components/UIOverlay';
import { useDataStore } from '@/game/dataStore';
import { GAME_WIDTH, GAME_HEIGHT } from '@/game/config';

/** 무대 1280×800을 뷰포트에 letterbox. Phaser는 FIT, UI는 transform scale. */
export default function Home() {
  const [size, setSize] = useState({ w: GAME_WIDTH, h: GAME_HEIGHT, scale: 1 });
  const loaded = useDataStore(s => s.loaded);
  const error = useDataStore(s => s.error);
  const load = useDataStore(s => s.load);

  useEffect(() => { void load(); }, [load]);

  useLayoutEffect(() => {
    const update = () => {
      const s = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
      setSize({ w: GAME_WIDTH * s, h: GAME_HEIGHT * s, scale: s });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);

  if (!loaded) return <main className="fixed inset-0 bg-black text-white flex items-center justify-center">불러오는 중…</main>;
  if (error) return <main className="fixed inset-0 bg-black text-red-300 flex items-center justify-center p-8 text-center">데이터를 불러오지 못했습니다.<br />{error}</main>;

  return (
    <main className="fixed inset-0 overflow-hidden bg-black flex items-center justify-center">
      <div className="relative bg-black overflow-hidden" style={{ width: size.w, height: size.h }}>
        <GameContainer />
        <div className="absolute top-0 left-0 pointer-events-none" style={{ width: GAME_WIDTH, height: GAME_HEIGHT, transform: `scale(${size.scale})`, transformOrigin: 'top left' }}>
          <UIOverlay />
        </div>
      </div>
    </main>
  );
}
