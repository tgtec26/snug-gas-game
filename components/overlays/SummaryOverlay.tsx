'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { useUI } from '@/game/ui';
import { summarize } from '@/game/summary';
import { loadDex, freshCards, clearFresh } from '@/game/dex';
import { useLock } from '@/components/hooks/useLock';
import { StarIcon } from '@/components/HUD';

const CARD_NAME: Record<string, (id: string, name: (pid: string) => string) => string> = {
  patients: (id, name) => name(id),
  laws: id => (id === 'boyle' ? '보일 법칙' : '샤를 법칙'),
  particles: id => (id === 'pressure' ? '압력과 입자' : '온도와 입자'),
  people: id => (id === 'boyle' ? '보일' : '샤를'),
};

/** 요약 결과 팝업: 치료한 환자 수·별·새 카드·실수를 결과 카드에 모으고 PNG로 저장한다. */
export function SummaryOverlay() {
  const records = useGame(s => s.records);
  const emergencyResults = useGame(s => s.emergencyResults);
  const heroId = useGame(s => s.heroId);
  const playerName = useGame(s => s.playerName);
  const restartRun = useGame(s => s.restartRun);
  const reset = useGame(s => s.reset);
  const patients = useDataStore(s => s.patients);
  const loadPatients = useGame(s => s.loadPatients);
  const dialog = useDataStore(s => s.dialog);
  const openDex = useUI(s => s.openDex);
  const locked = useLock('long');
  const card = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const sum = summarize({ records, emergencyResults }, patients);
  const dex = loadDex();
  const nameOf = (id: string) => patients.find(p => p.id === id)?.name ?? id;
  const fresh = freshCards().map(c => { const [k, id] = c.split(':'); return CARD_NAME[k]?.(id, nameOf) ?? id; });
  const dexTotal = patients.length + 2 + 2 + 2;
  const dexHave = dex.patients.length + dex.laws.length + dex.particles.length + dex.people.length;

  const save = async () => {
    if (!card.current || saving) return;
    setSaving(true); setErr('');
    try {
      const url = await toPng(card.current, { pixelRatio: 2, backgroundColor: '#fbf6ea' });
      const a = document.createElement('a');
      a.href = url; a.download = '공기-진료소-결과.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch { setErr('저장하지 못했어요. 다시 눌러 보세요.'); }
    setSaving(false);
  };
  const again = () => { clearFresh(); restartRun(); };
  const toTitle = () => { clearFresh(); reset(); loadPatients(patients); };

  const btn = 'h-[56px] px-7 rounded-2xl text-[20px] font-black disabled:opacity-40 disabled:grayscale shadow-[0_5px_0_rgba(0,0,0,0.35)] active:translate-y-1';
  return (
    <div className="absolute inset-0 bg-black/70 pointer-events-auto flex items-center justify-center">
      <div className="relative" style={{ animation: 'pop .5s cubic-bezier(.2,1.4,.4,1) both' }}>
        <div ref={card} className="w-[760px] rounded-3xl bg-[#fbf6ea] border-[6px] border-amber-300 px-10 py-8 text-slate-900">
          <div className="flex items-center gap-4 border-b-2 border-slate-300 pb-2 mb-4">
            <div className="w-[68px] h-[68px] shrink-0 rounded-full overflow-hidden bg-teal-100 border-[3px] border-amber-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/assets/hero/${heroId}.webp`} alt="" draggable={false} className="block w-full" />
            </div>
            <div>
              <div className="text-[34px] font-black leading-tight">오늘의 진료 결과</div>
              <div className="text-[20px] text-slate-600">견습 공기 의사 <b className="text-slate-900">{playerName}</b></div>
            </div>
          </div>
          <div className="flex items-center gap-8 mb-4">
            <div className="flex items-center gap-2 text-[64px] font-black text-amber-500 leading-none tabular-nums" aria-label={`별 ${sum.stars}개`}>
              <StarIcon size={64} />{sum.stars}
            </div>
            <div className="text-[24px] leading-snug">
              <div>치료한 환자 <b>{sum.treated}</b>명</div>
              <div>잘못 돌린 조절기 <b>{sum.wrongGauge}</b>번</div>
            </div>
          </div>
          <div className="mb-3">
            <div className="text-[20px] text-slate-500 mb-1">새로 얻은 카드 {fresh.length}장</div>
            <div className="flex flex-wrap gap-2 min-h-[34px]">
              {fresh.length === 0 && <span className="text-[18px] text-slate-400">이번엔 새 카드가 없어요</span>}
              {fresh.map((n, i) => <span key={`${n}-${i}`} className="rounded-full bg-amber-200 border-2 border-amber-400 px-3 py-0.5 text-[18px] font-bold">{n}</span>)}
            </div>
          </div>
          {dialog && (
            <div className="rounded-xl bg-white border-2 border-slate-300 px-4 py-3 text-[18px] leading-snug mb-3">
              <div>{dialog.diagnosis.boyle[0]}</div>
              <div>{dialog.diagnosis.charles[0]}</div>
            </div>
          )}
          <div className="text-[18px] text-slate-600">진료 기록부 <b className="tabular-nums">{dexHave}</b>/{dexTotal}</div>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <button type="button" disabled={locked || saving} onClick={save} className={`${btn} bg-amber-400 text-black`}>{saving ? '저장 중' : '나의 결과 내려받기'}</button>
          <button type="button" disabled={locked} onClick={openDex} className={`${btn} bg-white text-slate-900`}>진료 기록부</button>
          <button type="button" disabled={locked} onClick={again} className={`${btn} bg-sky-300 text-slate-900`}>다시 하기</button>
          <button type="button" disabled={locked} onClick={toTitle} className={`${btn} bg-slate-800 text-white`}>처음으로</button>
        </div>
        {err && <div className="mt-2 text-center text-[18px] text-red-300">{err}</div>}
      </div>
    </div>
  );
}
