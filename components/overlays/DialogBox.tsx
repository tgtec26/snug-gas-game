'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLock } from '@/components/hooks/useLock';
import { DoctorPortraitArt } from '@/components/Portrait';
import { useGame } from '@/game/store';

interface Props { npcName: string; lines: string[]; onDone: () => void }

const CHAR_MS = 18;

/** 읽는 장면의 대사창. 한 번에 한 줄(1~2문장)씩, 탭·Enter·Space로 넘긴다. 전환 직후 0.7초는 입력 잠금. 대사의 {name}은 학생이 입력한 이름으로 바꾼다. */
export function DialogBox({ npcName, lines, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(0);
  const locked = useLock('short');
  const playerName = useGame(s => s.playerName);
  const line = (lines[idx] ?? '').replaceAll('{name}', playerName);
  const complete = shown >= line.length;

  useEffect(() => {
    if (complete) return;
    const t = setInterval(() => setShown(s => Math.min(line.length, s + 1)), CHAR_MS);
    return () => clearInterval(t);
  }, [complete, line]);

  const advance = useCallback(() => {
    if (locked) return;
    if (!complete) { setShown(line.length); return; }
    if (idx + 1 < lines.length) { setIdx(idx + 1); setShown(0); }
    else onDone();
  }, [locked, complete, line.length, idx, lines.length, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-auto cursor-pointer select-none" onClick={advance}>
      <div className="mx-6 mb-5 px-8 py-7 flex gap-6 min-h-[170px] rounded-3xl border-4 border-amber-300 bg-slate-900/90 shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        <div className="shrink-0 flex flex-col items-center gap-2 w-[120px]">
          <DoctorPortraitArt />
          <div className="text-[16px] text-amber-200 font-bold text-center">{npcName}</div>
        </div>
        <div className="flex-1 text-[26px] leading-relaxed text-white">
          {line.slice(0, shown)}
          {complete && <span className="ml-2 text-amber-300 animate-pulse">▼</span>}
        </div>
      </div>
    </div>
  );
}
