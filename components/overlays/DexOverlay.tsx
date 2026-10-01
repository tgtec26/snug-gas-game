'use client';

import { useEffect } from 'react';
import { useUI } from '@/game/ui';
import { useDataStore } from '@/game/dataStore';
import { loadDex } from '@/game/dex';
import { PatientIcon } from '@/components/art/PatientIcon';
import { StarIcon } from '@/components/HUD';

const LAW = { boyle: '보일 법칙', charles: '샤를 법칙' } as const;
const PARTICLE = { pressure: '압력과 입자', temperature: '온도와 입자' } as const;

const pageText = (pages: number[]) => `${pages[0]}${pages.length > 1 ? `~${pages[pages.length - 1]}` : ''}쪽`;

/** 진료 기록부(도감): 증상 카드, 법칙 도장, 입자 카드, 인물 카드, 잠긴 숙제 카드. 타이틀과 요약에서 연다. */
export function DexOverlay() {
  const open = useUI(s => s.dexOpen);
  const close = useUI(s => s.closeDex);
  const patients = useDataStore(s => s.patients);
  const people = useDataStore(s => s.people);
  const homework = useDataStore(s => s.homework);
  const dialog = useDataStore(s => s.dialog);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
  if (!open) return null;

  const dex = loadDex();
  const card = (have: boolean) => `rounded-2xl border-4 px-3 py-3 flex flex-col items-center gap-1 ${have ? 'bg-[#fffaf0] border-amber-300' : 'bg-slate-200/80 border-slate-300'}`;
  const section = 'text-[22px] font-black mb-2 mt-4 flex items-center gap-2';

  return (
    <div className="absolute inset-0 z-50 bg-black/70 pointer-events-auto flex items-center justify-center" onClick={close}>
      <div className="relative w-[1060px] max-h-[720px] overflow-y-auto rounded-3xl bg-[#fbf6ea] border-[6px] border-amber-300 px-10 py-6 text-slate-900 shadow-[0_18px_44px_rgba(0,0,0,0.55)]" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={close} aria-label="닫기" className="absolute right-4 top-3 w-12 h-12 rounded-full bg-slate-800 text-white text-[26px] font-black">×</button>
        <h2 className="text-[34px] font-black">진료 기록부</h2>

        <div className={section}>증상 카드 <span className="text-[18px] text-slate-500">{dex.patients.length}/{patients.length}</span></div>
        <div className="grid grid-cols-4 gap-3">
          {patients.map(p => {
            const have = dex.patients.includes(p.id);
            return (
              <div key={p.id} className={card(have)}>
                <div style={{ filter: have ? undefined : 'grayscale(1) brightness(0.35)', opacity: have ? 1 : 0.6 }}><PatientIcon id={p.id} size={84} shadow={false} /></div>
                <div className="text-[18px] font-bold">{have ? p.name : '?'}</div>
                <div className="text-[14px] text-slate-500">{have ? pageText(p.pages) : ' '}</div>
              </div>
            );
          })}
        </div>

        <div className={section}>법칙 도장</div>
        <div className="grid grid-cols-2 gap-3">
          {(['boyle', 'charles'] as const).map(l => {
            const have = dex.laws.includes(l);
            return (
              <div key={l} className={card(have)}>
                <div className={`text-[26px] font-black ${have ? 'text-rose-600' : 'text-slate-400'}`}>{have ? LAW[l] : '?'}</div>
                {have && dialog && <div className="text-[16px] leading-snug text-center">{dialog.diagnosis[l][0]}</div>}
              </div>
            );
          })}
        </div>

        <div className={section}>입자 엑스레이 카드</div>
        <div className="grid grid-cols-2 gap-3">
          {(['pressure', 'temperature'] as const).map(v => {
            const have = dex.particles.includes(v);
            const law = v === 'pressure' ? 'boyle' : 'charles';
            return (
              <div key={v} className={card(have)}>
                <div className={`text-[24px] font-black ${have ? 'text-sky-700' : 'text-slate-400'}`}>{have ? PARTICLE[v] : '?'}</div>
                {have && dialog && <div className="text-[16px] leading-snug text-center">{dialog.diagnosis[law][1]}</div>}
              </div>
            );
          })}
        </div>

        <div className={section}>인물 카드</div>
        <div className="grid grid-cols-2 gap-3">
          {people.map(p => {
            const have = dex.people.includes(p.id);
            return (
              <div key={p.id} className={card(have)}>
                <div className={`text-[26px] font-black ${have ? '' : 'text-slate-400'}`}>{have ? p.name : '?'}</div>
                {have && <><div className="text-[16px] text-slate-600">{p.country} · {p.years}</div><div className="text-[16px] text-center">{p.line}</div></>}
              </div>
            );
          })}
        </div>

        <div className={section}><StarIcon size={22} filled={false} /> 잠긴 숙제 카드</div>
        <div className="grid grid-cols-5 gap-3 pb-2">
          {homework.map(h => (
            <div key={h.id} className={card(false)}>
              <svg width="34" height="40" viewBox="0 0 34 40" aria-hidden="true"><rect x="4" y="16" width="26" height="22" rx="5" fill="#64748b" /><path d="M9 16 V11 a8 8 0 0 1 16 0 V16" stroke="#64748b" strokeWidth="4" fill="none" /></svg>
              <div className="text-[16px] font-bold text-center leading-tight">{h.title}</div>
              <div className="text-[14px] text-slate-500">{pageText(h.pages)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
