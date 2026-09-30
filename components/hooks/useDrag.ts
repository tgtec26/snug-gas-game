// 무대(1280×800) 좌표로 변환하는 드래그. 캔버스 밖에서 손을 떼도 종료된다.
import { useCallback, useRef, useState } from 'react';
export interface DragState { id: string; x: number; y: number }
export function useDrag(stage: React.RefObject<HTMLElement | null>, onDrop: (id: string, x: number, y: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const cur = useRef<DragState | null>(null);
  const toStage = (e: PointerEvent | React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 1280, y: ((e.clientY - r.top) / r.height) * 800 };
  };
  const begin = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    const p = toStage(e); cur.current = { id, ...p }; setDrag(cur.current);
    const move = (ev: PointerEvent) => { const q = toStage(ev); cur.current = { id, ...q }; setDrag(cur.current); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      const c = cur.current; cur.current = null; setDrag(null);
      if (c) onDrop(c.id, c.x, c.y);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDrop]);
  return { drag, begin };
}
