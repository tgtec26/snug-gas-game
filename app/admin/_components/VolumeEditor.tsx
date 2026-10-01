'use client';
import { useEffect, useState } from 'react';
import { loadFile, saveFile, saveBtnStyle, inputStyle } from './adminUi';
import { BGM_SLOTS, SFX_SLOTS, type AudioConfig } from '@/game/audio';

const NAMES: Record<string, string> = {
  title: '타이틀·인트로', play: '진료 중', ending: '엔딩·요약',
  correct: '정답·단계 성공', error: '오답·실패', success: '진료 성공', tick: '눈금 딸깍', piston: '피스톤', splash: '물 담그기',
  collide: '입자 충돌', stamp: '도장', fanfare: '팡파르', launch: '로켓 발사',
};

/** 배경음·효과음의 음량과 음원 이름(public/assets/audio/<이름>.mp3). 미리 듣기 단추 포함. */
export default function VolumeEditor() {
  const [cfg, setCfg] = useState<AudioConfig | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => { loadFile<AudioConfig>('audio-config').then(setCfg); }, []);
  if (!cfg) return <div style={{ padding: 20, color: '#888' }}>불러오는 중…</div>;
  const play = (name: string, vol: number) => { const a = new Audio(`/assets/audio/${name}.mp3`); a.volume = vol; void a.play().catch(() => {}); };
  const slider = (label: string, key: 'bgmVolume' | 'sfxVolume') => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13 }}>
      <span style={{ width: 120 }}>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={cfg[key]} onChange={e => setCfg({ ...cfg, [key]: Number(e.target.value) })} style={{ width: 240 }} />
      <span style={{ width: 40 }}>{cfg[key].toFixed(2)}</span>
    </label>
  );
  const row = (group: 'bgm' | 'sfx', slot: string, vol: number) => (
    <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
      <span style={{ width: 120, color: '#aaa' }}>{NAMES[slot] ?? slot}</span>
      <input style={{ ...inputStyle, width: 220 }} value={(cfg[group] as Record<string, string>)[slot]}
        onChange={e => setCfg({ ...cfg, [group]: { ...cfg[group], [slot]: e.target.value } })} />
      <button style={{ ...inputStyle, cursor: 'pointer' }} onClick={() => play((cfg[group] as Record<string, string>)[slot], vol)}>듣기</button>
    </div>
  );
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>음원 이름은 public/assets/audio 안의 파일 이름(확장자 .mp3 제외)이에요. 새 음원은 그 폴더에 넣고 이름만 바꾸면 돼요.</div>
      {slider('배경음 음량', 'bgmVolume')}
      {BGM_SLOTS.map(s => row('bgm', s, cfg.bgmVolume))}
      <div style={{ height: 14 }} />
      {slider('효과음 음량', 'sfxVolume')}
      {SFX_SLOTS.map(s => row('sfx', s, cfg.sfxVolume))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
        <button style={saveBtnStyle} onClick={async () => setStatus(await saveFile('audio-config', cfg))}>저장</button>
        <span style={{ fontSize: 12, color: status.startsWith('저장 완료') ? '#86efac' : '#fca5a5' }}>{status}</span>
      </div>
    </div>
  );
}
