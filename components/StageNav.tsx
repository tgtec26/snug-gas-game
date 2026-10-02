'use client';

import { useMemo, useState } from 'react';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { buildStages, PREVIEW_NAME, type Stage } from '@/game/stages';

/** 개발 모드이거나 주소에 ?preview=1 이 있을 때만 켠다. 학생에게 나가는 배포본에는 보이지 않는다. */
const previewOn = () => process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).get('preview') === '1';

/** 같은 씬(검사 장치) 안에서 환자만 바꾸는 이동도 새로 시작하도록, 대기실을 한 번 거친 뒤 목표로 간다. */
function go(stage: Stage) {
  const { playerName } = useGame.getState();
  const target = { ...stage.state, roundReady: false, playerName: playerName || PREVIEW_NAME };
  useGame.setState({ phase: 'clinic', currentId: null, roundReady: false });
  window.setTimeout(() => useGame.setState(target), 100);
}

/** 미리보기용 스테이지 네비게이터: 화면 아래 한 줄에서 모든 스테이지로 바로 간다. */
export function StageNav() {
  const patients = useDataStore(s => s.patients);
  const phase = useGame(s => s.phase);
  const currentId = useGame(s => s.currentId);
  const [open, setOpen] = useState(true);
  const stages = useMemo(() => buildStages(patients), [patients]);
  if (!previewOn()) return null;

  const active = stages.find(s => s.state.phase === phase && (s.state.currentId ?? null) === currentId)?.id;
  return (
    <div className="absolute inset-x-0 bottom-0 z-50 pointer-events-auto flex items-center gap-1 bg-black/75 px-2 py-1 text-[13px] text-white/90">
      <button type="button" aria-label="스테이지 네비게이터 접기·펴기" onClick={e => { setOpen(o => !o); e.currentTarget.blur(); }} className="shrink-0 rounded bg-white/15 px-2 py-0.5 font-bold">{open ? '스테이지 접기' : '스테이지'}</button>
      {open && (
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto whitespace-nowrap">
          {stages.map(s => (
            <button key={s.id} type="button" onClick={e => { go(s); e.currentTarget.blur(); }}
              className={`shrink-0 rounded px-2 py-0.5 ${s.id === active ? 'bg-amber-400 font-bold text-slate-900' : 'bg-white/10 hover:bg-white/25'}`}>{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
