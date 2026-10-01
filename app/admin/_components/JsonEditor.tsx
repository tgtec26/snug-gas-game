'use client';
import { useEffect, useState } from 'react';
import type { DataFile } from '@/game/adminData';
import { loadFile, saveFile, saveBtnStyle, textareaStyle } from './adminUi';

/** 구조가 단순한 파일은 JSON을 직접 고친다. 형식 오류가 있으면 저장 버튼이 꺼지고, 검증 오류는 저장할 때 서버가 알려 준다. */
export default function JsonEditor({ file, help }: { file: DataFile; help: string }) {
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => { loadFile<unknown>(file).then(v => setText(v === null ? '' : JSON.stringify(v, null, 2))); }, [file]);
  if (text === null) return <div style={{ padding: 20, color: '#888' }}>불러오는 중…</div>;

  let parsed: unknown = null; let formatError = '';
  try { parsed = JSON.parse(text); } catch (e) { formatError = `JSON 형식 오류: ${String(e)}`; }
  const save = async () => { setStatus('저장 중...'); setStatus(await saveFile(file, parsed)); };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#aaa' }}>{help}</div>
      <textarea value={text} onChange={e => { setText(e.target.value); setStatus(''); }} spellCheck={false} style={{ ...textareaStyle, flex: 1, fontSize: 13 }} />
      {formatError && <div style={{ color: '#f87171', fontSize: 12 }}>{formatError}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={save} disabled={!!formatError} style={{ ...saveBtnStyle, opacity: formatError ? 0.4 : 1 }}>저장</button>
        {status && <span style={{ fontSize: 12, color: status.startsWith('저장 완료') ? '#86efac' : '#fca5a5' }}>{status}</span>}
      </div>
    </div>
  );
}
