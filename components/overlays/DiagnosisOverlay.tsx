'use client';

import { useCallback, useEffect } from 'react';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { lawOf } from '@/game/rules';
import { addToDex } from '@/game/dex';
import { playSfx } from '@/game/audio';
import { useLock } from '@/components/hooks/useLock';
import { PatientIcon } from '@/components/art/PatientIcon';
import { StarIcon } from '@/components/HUD';
import type { Patient } from '@/game/types';

const LAW_NAME = { boyle: '보일 법칙', charles: '샤를 법칙' } as const;

export function DiagnosisOverlay() {
  const phase = useGame(s => s.phase);
  const id = useGame(s => s.currentId);
  const patient = useDataStore(s => s.patients.find(p => p.id === id));
  if (phase !== 'diagnosis' || !patient) return null;
  return <Diagnosis key={patient.id} patient={patient} />;
}

/** 읽는 장면: 법칙 도장이 쿵 찍히고, 교과서 한 줄(2문장 이내)과 별을 보여 준다. 잠금(1.2초) 뒤 탭·Enter·Space로 대기실로. */
function Diagnosis({ patient }: { patient: Patient }) {
  const next = useGame(s => s.next);
  const stars = useGame(s => s.records[patient.id]?.stars ?? 0);
  const dialog = useDataStore(s => s.dialog);
  const locked = useLock('long');
  const law = lawOf(patient.variable);

  useEffect(() => {
    addToDex('patients', patient.id);
    addToDex('laws', law);
    addToDex('people', law);
    playSfx('success');
    const t = window.setTimeout(() => playSfx('stamp'), 650);   // 도장이 쿵 찍히는 순간
    return () => window.clearTimeout(t);
  }, [patient.id, law]);

  const go = useCallback(() => { if (!locked) next(); }, [locked, next]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <div className="absolute inset-0 bg-black/60 pointer-events-auto cursor-pointer select-none flex items-center justify-center" onClick={go}>
      <div className="relative w-[960px] rounded-3xl bg-[#fbf6ea] border-[6px] border-amber-300 px-12 py-10 shadow-[0_18px_44px_rgba(0,0,0,0.55)] text-slate-900">
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-center gap-3 w-[200px]">
            <PatientIcon id={patient.id} size={170} />
            <div className="text-[24px] font-black">{patient.name}</div>
            <div className="flex gap-1" aria-label={`별 ${stars}개`}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ animation: i < stars ? `pop 450ms ${700 + i * 280}ms both` : undefined, opacity: i < stars ? undefined : 1 }}>
                  <StarIcon size={44} filled={i < stars} />
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-5 text-[27px] leading-relaxed">
            {dialog?.diagnosis[law].map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
        <div className="absolute -top-10 -right-8 w-[190px] h-[190px] rounded-full border-[8px] border-rose-600 text-rose-600 flex flex-col items-center justify-center text-center text-[36px] font-black leading-tight bg-white/70"
          style={{ animation: 'stampIn 700ms 250ms both', transform: 'rotate(-8deg)' }}>
          {LAW_NAME[law].split(' ').map(w => <span key={w} className="block">{w}</span>)}
        </div>
        {!locked && (
          <svg className="absolute right-8 bottom-5" width="56" height="36" viewBox="0 0 64 40" aria-hidden="true" style={{ animation: 'bob 1.2s ease-in-out infinite' }}>
            <path d="M6 6 L26 20 L6 34 M30 6 L50 20 L30 34" stroke="#b7791f" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}
