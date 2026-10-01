'use client';
import { useEffect, useRef, useState } from 'react';
import { loadFile, saveFile, saveBtnStyle, btnStyle, inputStyle } from './adminUi';
import type { Layout } from '@/game/layout';

type Group = Record<string, number>;
const SCENES = [['clinic', '검사 장치'], ['dip', '담그기'], ['shake', '구슬 흔들기']] as const;
const STAGE = { w: 1280, h: 800 };
const VIEW = 0.62;   // 편집 화면 배율

/** 마커 위치: x와 y(또는 top)가 있으면 그 점. 통(barrel·beaker·hot·cold)은 x, top 이다. */
const anchor = (g: Group): [number, number] | null => (typeof g.x === 'number' ? (typeof g.y === 'number' ? [g.x, g.y] : typeof g.top === 'number' ? [g.x, g.top] : null) : null);

/** 마커를 (dx, dy)만큼 옮긴다: 통은 top·bottom을 함께, 나머지는 x·y. */
function moved(g: Group, dx: number, dy: number): Group {
  const n: Group = { ...g, x: Math.round(g.x + dx) };
  if (typeof g.y === 'number') n.y = Math.round(g.y + dy);
  if (typeof g.top === 'number') { n.top = Math.round(g.top + dy); if (typeof g.bottom === 'number') n.bottom = Math.round(g.bottom + dy); }
  if (typeof g.minX === 'number') { n.minX = Math.round(g.minX + dx); n.maxX = Math.round(g.maxX + dx); }
  return n;
}

/** 장면별 위치·크기를 끌어서 옮기고 숫자로 고친다. 저장하면 public/data/layout.json에 들어가 씬이 그대로 읽는다. */
export default function LayoutEditor() {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [scene, setScene] = useState<(typeof SCENES)[number][0]>('clinic');
  const [sel, setSel] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const drag = useRef<{ key: string; x: number; y: number } | null>(null);
  useEffect(() => { loadFile<Layout>('layout').then(setLayout); }, []);
  if (!layout) return <div style={{ padding: 20, color: '#888' }}>불러오는 중…</div>;

  const groups = layout[scene] as unknown as Record<string, Group | Record<string, unknown>>;
  const numeric = (g: unknown): g is Group => !!g && typeof g === 'object' && Object.values(g as object).every(v => typeof v === 'number');
  const keys = Object.keys(groups).filter(k => numeric(groups[k]));
  const set = (k: string, g: Group) => setLayout({ ...layout, [scene]: { ...groups, [k]: g } } as Layout);

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.x) / VIEW, dy = (e.clientY - d.y) / VIEW;
    drag.current = { ...d, x: e.clientX, y: e.clientY };
    set(d.key, moved(groups[d.key] as Group, dx, dy));
  };
  const selected = sel && numeric(groups[sel]) ? (groups[sel] as Group) : null;

  return (
    <div style={{ display: 'flex', gap: 14, padding: 14, height: '100%', boxSizing: 'border-box' }}>
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {SCENES.map(([id, label]) => <button key={id} onClick={() => { setScene(id); setSel(null); }} style={btnStyle(scene === id)}>{label}</button>)}
        </div>
        <div onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
          style={{ position: 'relative', width: STAGE.w * VIEW, height: STAGE.h * VIEW, background: 'linear-gradient(#2b3f4a,#3a4a52)', border: '1px solid #444', touchAction: 'none', userSelect: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)', backgroundSize: `${100 * VIEW}px ${100 * VIEW}px` }}>
          {keys.map(k => {
            const g = groups[k] as Group; const a = anchor(g); if (!a) return null;
            const isSel = sel === k; const w = typeof g.w === 'number' && typeof g.h === 'number' ? { w: g.w * VIEW, h: g.h * VIEW } : null;
            return (
              <div key={k}>
                {w && <div style={{ position: 'absolute', left: (typeof g.top === 'number' ? a[0] - g.w / 2 : a[0]) * VIEW, top: a[1] * VIEW - (typeof g.bottom === 'number' && typeof g.top === 'number' ? 0 : 0), width: w.w, height: typeof g.bottom === 'number' ? (g.bottom - g.top) * VIEW : w.h, border: `1px dashed ${isSel ? '#fde047' : '#7dd3fc88'}`, pointerEvents: 'none' }} />}
                <div onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { key: k, x: e.clientX, y: e.clientY }; setSel(k); }}
                  style={{ position: 'absolute', left: a[0] * VIEW - 9, top: a[1] * VIEW - 9, width: 18, height: 18, borderRadius: 9, background: isSel ? '#fde047' : '#38bdf8', border: '2px solid #000', cursor: 'grab' }} />
                <div style={{ position: 'absolute', left: a[0] * VIEW + 12, top: a[1] * VIEW - 8, fontSize: 11, color: isSel ? '#fde047' : '#cde', pointerEvents: 'none' }}>{k}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
          <button style={saveBtnStyle} onClick={async () => setStatus(await saveFile('layout', layout))}>저장</button>
          <span style={{ fontSize: 12, color: status.startsWith('저장 완료') ? '#86efac' : '#fca5a5' }}>{status}</span>
        </div>
      </div>
      <div style={{ width: 260, overflow: 'auto' }}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>점을 끌어 옮기고, 아래 숫자로 크기·세부 값을 고쳐요. 좌표는 1280×800 기준.</div>
        {selected ? (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{sel}</div>
            {Object.entries(selected).map(([f, v]) => (
              <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ width: 70, color: '#aaa' }}>{f}</span>
                <input type="number" value={v} style={{ ...inputStyle, width: 110 }} onChange={e => set(sel as string, { ...selected, [f]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: '#777' }}>점을 눌러 선택하세요.</div>}
      </div>
    </div>
  );
}
