'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame, nextExamId } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { useLock } from '@/components/hooks/useLock';
import { useDrag } from '@/components/hooks/useDrag';
import { GoalBar } from '@/components/GoalBar';
import { PatientIcon } from '@/components/art/PatientIcon';

/** 검사대 자리 (드롭 판정, 터치 여유 포함). 무대 1280×800 좌표. */
const TABLE = { x1: 370, x2: 910, y1: 600, y2: 790 };
const inTable = (x: number, y: number) => x >= TABLE.x1 && x <= TABLE.x2 && y >= TABLE.y1 && y <= TABLE.y2;
const SLOT_X = [170, 400, 630, 860, 1090];
const ICON = 120;
const FLOOR_TOP = 440;
const IDLE_HINT_MS = 2500;

export function ClinicOverlay() {
  const phase = useGame(s => s.phase);
  if (phase !== 'clinic') return null;
  return <Clinic />;
}

function Clinic() {
  const examIds = useGame(s => s.examIds);
  const records = useGame(s => s.records);
  const enterExam = useGame(s => s.enterExam);
  const next = useGame(s => s.next);
  const patients = useDataStore(s => s.patients);
  const locked = useLock('short');
  const stage = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const activeRef = useRef<HTMLButtonElement>(null);

  const activeId = nextExamId({ examIds, records }) ?? 'emergency';
  const items = [...examIds, 'emergency'];
  const nameOf = (id: string) => id === 'emergency' ? '응급실' : patients.find(p => p.id === id)?.name ?? id;
  const stateOf = (id: string) => (id === activeId ? 'active' : id !== 'emergency' && records[id] ? 'done' : 'waiting');

  const trigger = useCallback((id: string) => {
    if (locked || id !== activeId) return;
    if (id === 'emergency') next(); else enterExam(id);
  }, [locked, activeId, next, enterExam]);

  const toStage = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 800 };
  };

  const onDrop = useCallback((id: string, x: number, y: number) => {
    const moved = Math.hypot(x - start.current.x, y - start.current.y) > 12;
    suppressClick.current = moved;              // 끌었다 놓은 뒤 이어지는 click은 무시
    if (moved && inTable(x, y)) trigger(id);
  }, [trigger]);
  const { drag, begin } = useDrag(stage, onDrop);
  const goal = useDataStore(s => s.dialog?.goals.clinic ?? '');

  // 한참 조작이 없으면 글 없이 손 모양으로 "끌어다 놓기"를 보여 준다. 조건이 바뀌면 키가 바뀌어 힌트가 저절로 꺼진다.
  const hintKey = `${activeId}:${locked ? 'l' : 'u'}:${drag ? 'd' : 'n'}`;
  const [idleKey, setIdleKey] = useState('');
  useEffect(() => {
    if (locked || drag) return;
    const t = setTimeout(() => setIdleKey(hintKey), IDLE_HINT_MS);
    return () => clearTimeout(t);
  }, [hintKey, locked, drag]);
  const idle = idleKey === hintKey;

  // 키보드만 쓰는 학생도 Enter 한 번으로 시작할 수 있게, 차례인 환자에 포커스를 둔다.
  useEffect(() => { activeRef.current?.focus({ preventScroll: true }); }, [activeId]);

  const idx = items.indexOf(activeId);
  const hx0 = SLOT_X[idx] ?? 640, hy0 = FLOOR_TOP + 40;
  const hx1 = (TABLE.x1 + TABLE.x2) / 2, hy1 = 690;

  return (
    <div ref={stage} className="absolute inset-0 pointer-events-none select-none">
      <GoalBar text={goal} />
      {/* 검사대 놓을 자리 */}
      <div className={`absolute rounded-3xl border-4 border-dashed ${drag ? 'border-amber-300 bg-amber-300/25' : 'border-white/70 bg-white/10'}`}
        style={{ left: TABLE.x1 + 40, top: TABLE.y1 + 30, width: TABLE.x2 - TABLE.x1 - 80, height: 120, animation: locked ? undefined : 'glow 1.8s ease-in-out infinite' }}>
        <svg className="absolute left-1/2 -translate-x-1/2 -top-14" width="56" height="44" viewBox="0 0 56 44" aria-hidden="true" style={{ animation: 'bob 1.2s ease-in-out infinite' }}>
          <path d="M28 4 V36 M10 20 L28 38 L46 20" stroke="#ffd166" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {items.map((id, i) => {
        const st = stateOf(id);
        const dragging = drag?.id === id;
        const x = dragging ? drag.x - ICON / 2 : SLOT_X[i] - ICON / 2;
        const y = dragging ? drag.y - ICON / 2 - 12 : FLOOR_TOP;
        return (
          <div key={id} className="absolute" style={{ left: x, top: y, width: ICON, zIndex: dragging ? 30 : 10 }}>
            {/* 바닥 그림자: 집어 올리면 멀어지고 작아진다 */}
            <div className="absolute rounded-full bg-black/30"
              style={{ left: dragging ? 26 : 14, width: dragging ? 70 : 92, height: dragging ? 10 : 14, top: dragging ? ICON + 40 : ICON - 8, transition: dragging ? undefined : 'all 200ms' }} />
            <button
              ref={st === 'active' ? activeRef : undefined}
              type="button"
              tabIndex={st === 'active' ? 0 : -1}
              aria-label={`${nameOf(id)}${st === 'done' ? ' 진료 완료' : ''}`}
              disabled={st !== 'active'}
              className={`relative pointer-events-auto block touch-none ${st === 'active' ? 'cursor-grab' : 'cursor-default'}`}
              style={{
                width: ICON, height: ICON,
                transform: dragging ? 'scale(1.15)' : undefined,
                opacity: st === 'waiting' ? 0.45 : st === 'done' ? 0.75 : 1,
                filter: st === 'done' ? 'grayscale(0.6)' : undefined,
                animation: st === 'active' && !dragging ? 'bob 1.4s ease-in-out infinite' : undefined,
              }}
              onPointerDown={e => { if (st !== 'active' || locked) return; start.current = toStage(e); begin(id, e); }}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } trigger(id); }}
              onKeyDown={e => { if (e.repeat) e.preventDefault(); }}
            >
              <PatientIcon id={id === 'emergency' ? 'emergency' : id} size={ICON} shadow={false} />
              {st === 'done' && (
                <svg className="absolute -top-2 -right-2" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
                  <circle cx="22" cy="22" r="20" fill="#3fae6a" stroke="#fff" strokeWidth="3" />
                  <path d="M12 23 L19 30 L32 15" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {st === 'waiting' && (
                <svg className="absolute bottom-0 right-0" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
                  <rect x="6" y="15" width="22" height="16" rx="3" fill="#607d8b" /><path d="M11 15 V10 a6 6 0 0 1 12 0 V15" stroke="#607d8b" strokeWidth="4" fill="none" />
                </svg>
              )}
            </button>
            <div className="mt-2 text-center text-[20px] font-black text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">{nameOf(id)}</div>
          </div>
        );
      })}

      {idle && !drag && (
        <svg className="absolute left-0 top-0 z-40" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"
          style={{ ['--x0' as string]: `${hx0 - 10}px`, ['--y0' as string]: `${hy0}px`, ['--x1' as string]: `${hx1 - 10}px`, ['--y1' as string]: `${hy1}px`, animation: 'handMove 1.8s ease-in-out infinite' }}>
          <path d="M14 6 L14 40 L22 33 L28 46 L34 43 L28 31 L40 31 Z" fill="#fff" stroke="#263238" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
