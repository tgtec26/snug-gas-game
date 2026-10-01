'use client';

import { useEffect, useRef, useState } from 'react';
import { useGame, emergencyQueue } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { comboOf } from '@/game/rules';
import { playSfx } from '@/game/audio';
import { Story } from '@/components/overlays/StoryOverlay';
import { PatientIcon } from '@/components/art/PatientIcon';


export function EmergencyOverlay() {
  const phase = useGame(s => s.phase);
  const id = useGame(s => s.currentId);
  const patient = useDataStore(s => s.patients.find(p => p.id === id));
  const roundReady = useGame(s => s.roundReady);
  const startRound = useGame(s => s.startRound);
  const log = useGame(s => s.emergencyLog);
  const storyMs = useDataStore(s => s.minigame?.emergencyStoryMs ?? 1800);
  if (phase !== 'emergency' || !patient) return null;
  return (
    <>
      {!roundReady && <Story key={`${patient.id}-${log.length}`} patient={patient} endMs={storyMs} onDone={startRound} />}
      <Round key={`r-${patient.id}-${log.length}`} />
    </>
  );
}

/** 라운드 표시: 위쪽에 환자 줄(성공 초록·놓침 빨강·지금 노랑), 시간 막대, 콤보. 시간이 다 되면 놓친 것으로 기록한다. */
function Round() {
  const ids = useGame(s => s.emergencyIds);
  const log = useGame(s => s.emergencyLog);
  const currentId = useGame(s => s.currentId);
  const roundReady = useGame(s => s.roundReady);
  const recordRound = useGame(s => s.recordRound);
  const limit = useDataStore(s => s.minigame?.emergencyRoundMs ?? 18000);
  const [left, setLeft] = useState(1);
  const [late, setLate] = useState(false);
  const startedAt = useRef(0);
  const queue = emergencyQueue(ids, log);
  const combo = comboOf(log.map(l => l.ok)).current;

  useEffect(() => {
    if (!roundReady || !currentId) return;
    startedAt.current = performance.now();
    const t = window.setInterval(() => {
      const k = 1 - (performance.now() - startedAt.current) / limit;
      setLeft(Math.max(0, k));
      if (k <= 0) { window.clearInterval(t); setLate(true); playSfx('error'); window.setTimeout(() => recordRound(currentId, false), 350); }
    }, 100);
    return () => window.clearInterval(t);
  }, [roundReady, currentId, limit, recordRound]);

  const hurry = left < 0.3;
  return (
    <div className="absolute inset-x-0 top-2 flex flex-col items-center gap-2 pointer-events-none select-none">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900/80 border-2 border-white/60 px-4 py-2">
        {queue.map((qid, i) => {
          const done = log[i]; const now = i === log.length;
          return (
            <div key={`${qid}-${i}`} className="relative rounded-xl p-1" style={{ background: done ? (done.ok ? '#3fae6a' : '#d04a4a') : now ? '#f2b84a' : 'rgba(255,255,255,0.18)', opacity: done || now ? 1 : 0.7 }}>
              <PatientIcon id={qid as never} size={46} shadow={false} />
            </div>
          );
        })}
      </div>
      <div className="w-[420px] h-4 rounded-full bg-slate-900/70 border-2 border-white/60 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${left * 100}%`, background: hurry ? '#e0513f' : '#3fae6a', transition: 'width 100ms linear, background 200ms' }} />
      </div>
      {combo >= 2 && (
        <div key={combo} className="font-black text-[44px] text-amber-300 drop-shadow-[0_3px_0_rgba(0,0,0,0.7)]" style={{ animation: 'combo-pop 450ms ease-out' }}>
          x{combo}
        </div>
      )}
      {late && <div className="absolute inset-0 -top-2 h-[800px] w-[1280px] bg-red-600/25" style={{ animation: 'combo-pop 350ms ease-out' }} />}
    </div>
  );
}
