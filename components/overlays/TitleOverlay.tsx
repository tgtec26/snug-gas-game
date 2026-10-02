'use client';

import { useEffect, useRef, useState } from 'react';
import { useGame, HERO_IDS, type HeroId } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { useUI } from '@/game/ui';

/**
 * 진행 캐릭터(남 1, 여 2)를 고르고 이름을 입력한 뒤 시작한다. 기본 이름·예시 이름은 두지 않는다.
 * 시작 조작이 곧 전체 화면 요청이다(별도 안내 단계 없음). start()는 title에서만 동작해 연타해도 한 번만 진행한다.
 */
export function TitleOverlay() {
  const phase = useGame(s => s.phase);
  const start = useGame(s => s.start);
  const openDex = useUI(s => s.openDex);
  const dexOpen = useUI(s => s.dexOpen);
  const hero = useDataStore(s => s.minigame?.hero);
  const [name, setName] = useState(() => useGame.getState().playerName);
  const [heroId, setHeroId] = useState<HeroId>(() => useGame.getState().heroId);
  const nameRef = useRef<HTMLInputElement>(null);
  const nameOk = name.trim().length > 0;

  // 좌우 화살표로 캐릭터 선택 (이름을 입력하는 중에는 글자 커서가 움직여야 하므로 제외)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || dexOpen || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const d = e.key === 'ArrowLeft' ? HERO_IDS.length - 1 : 1;
      setHeroId(id => HERO_IDS[(HERO_IDS.indexOf(id) + d) % HERO_IDS.length]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dexOpen]);

  if (phase !== 'title' || !hero) return null;

  const tryStart = () => {
    if (!nameOk) { nameRef.current?.focus(); return; }
    document.documentElement.requestFullscreen?.().catch(() => {});   // 시작 조작 = 전체 화면
    start(name.trim().slice(0, hero.nameMax), heroId);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 pointer-events-auto">
      <div className="text-[22px] text-amber-200 tracking-widest mb-1">중1 과학 · 기체의 성질</div>
      <h1 className="text-[68px] font-black text-white mb-5 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]">공기 진료소</h1>
      <div role="radiogroup" aria-label="캐릭터 선택" className="flex gap-6 mb-6">
        {HERO_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={heroId === id}
            aria-label={`캐릭터 ${i + 1}`}
            onClick={() => setHeroId(id)}
            className={`px-5 pt-3 rounded-3xl border-[6px] overflow-hidden transition-transform ${heroId === id ? 'bg-amber-100 border-amber-400 scale-105 shadow-[0_0_28px_8px_rgba(255,214,102,0.6)]' : 'bg-white/80 border-white/60 opacity-75'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/assets/hero/${id}.webp`} alt="" height={hero.cardSize} draggable={false} className="block w-auto" style={{ height: hero.cardSize }} />
          </button>
        ))}
      </div>
      <div className="flex gap-4">
        <input
          ref={nameRef}
          autoFocus
          aria-label="이름"
          placeholder="이름"
          autoComplete="off"
          value={name}
          maxLength={hero.nameMax}
          onChange={e => setName(e.target.value.replace(/^\s+/, ''))}
          onKeyDown={e => { if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing && e.keyCode !== 229) tryStart(); }}
          className="w-[300px] h-[72px] px-5 rounded-2xl border-4 border-amber-300 bg-white text-[30px] font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500"
        />
        <button
          type="button"
          aria-disabled={!nameOk}
          onClick={tryStart}
          className={`text-[30px] w-[220px] h-[72px] rounded-2xl bg-amber-400 text-slate-900 font-black shadow-[0_8px_0_#b7791f] active:translate-y-1 active:shadow-[0_4px_0_#b7791f] ${nameOk ? 'animate-pulse' : 'opacity-50 grayscale'}`}
        >
          진료 시작
        </button>
      </div>
      <button type="button" onClick={openDex} className="mt-5 text-[22px] px-6 h-[52px] rounded-xl bg-white/90 text-slate-900 font-bold border-4 border-amber-300">진료 기록부</button>
    </div>
  );
}
