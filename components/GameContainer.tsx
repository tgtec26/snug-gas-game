'use client';

import { useEffect, useRef } from 'react';

export function GameContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (removeCanvas: boolean) => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    (async () => {
      const Phaser = (await import('phaser')).default;
      const { makePhaserConfig } = await import('@/game/phaserConfig');
      if (cancelled || !containerRef.current) return;
      const game = new Phaser.Game(makePhaserConfig(containerRef.current));
      gameRef.current = game;
      if (process.env.NODE_ENV !== 'production') {
        // QA용: 브라우저 콘솔에서 __game / __store / __rules 로 접근
        const w = window as unknown as Record<string, unknown>;
        w.__game = game;
        w.__store = (await import('@/game/store')).useGame;
        w.__rules = await import('@/game/rules');
        // 숨겨진 미리보기 창에서도 루프가 돌도록 (Phaser는 visibilitychange=hidden 시 loop.pause)
        game.events.removeAllListeners(Phaser.Core.Events.HIDDEN);
        game.events.on(Phaser.Core.Events.HIDDEN, () => { game.loop.resume(); });
        if (document.hidden) game.loop.resume();
      }
    })();
    return () => { cancelled = true; gameRef.current?.destroy(true); gameRef.current = null; };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
