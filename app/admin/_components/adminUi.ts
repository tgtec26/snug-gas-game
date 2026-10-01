import type { CSSProperties } from 'react';
import type { DataFile } from '@/game/adminData';

export const inputStyle: CSSProperties = { background: '#0f0f0f', border: '1px solid #333', borderRadius: 4, padding: '5px 7px', color: '#eee', fontFamily: 'inherit', fontSize: 12, boxSizing: 'border-box' };
export const textareaStyle: CSSProperties = { ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.5 };
export const btnStyle = (active = false): CSSProperties => ({ padding: '8px 12px', background: active ? '#22c55e' : '#222', color: active ? '#000' : '#ddd', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: active ? 'bold' : 'normal', fontSize: 12 });
export const saveBtnStyle: CSSProperties = { padding: '9px 22px', background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' };

export async function loadFile<T>(file: DataFile): Promise<T | null> {
  try { const r = await fetch(`/api/admin/${file}`, { cache: 'no-store' }); if (!r.ok) return null; return (await r.json()) as T; } catch { return null; }
}
export async function saveFile(file: DataFile, data: unknown): Promise<string> {
  try {
    const r = await fetch(`/api/admin/${file}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (r.ok) return '저장 완료';
    const j = await r.json().catch(() => ({}));
    if (r.status === 403) return '배포 서버에서는 저장할 수 없습니다 (로컬 pnpm dev에서만)';
    return `저장 실패: ${(j.errors ?? [j.error ?? r.status]).join(' / ')}`;
  } catch (e) { return `저장 실패: ${String(e)}`; }
}
