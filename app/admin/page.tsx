'use client';
import { useState } from 'react';
import Link from 'next/link';
import JsonEditor from './_components/JsonEditor';
import LayoutEditor from './_components/LayoutEditor';
import VolumeEditor from './_components/VolumeEditor';
import { btnStyle } from './_components/adminUi';
import type { DataFile } from '@/game/adminData';

interface Tab { id: string; label: string; files?: { file: DataFile; label: string; help: string }[] }
const TABS: Tab[] = [
  { id: 'patients', label: '환자', files: [
    { file: 'patients', label: '환자', help: 'steps의 size는 압력이면 부피 눈금 칸 수, 온도면 온도 단계 수. 담그기 환자는 size가 뜨거운 물·얼음물 단계(실험 설정의 dip)와 같아야 합니다. rig:"dip"은 응급실에서 담그기 장치를 씁니다. verified:true 데이터만 게임에 쓰입니다.' },
    { file: 'people', label: '인물 카드', help: '교과서에 적힌 내용만 쓰세요. 분자·원자 같은 교과서에 없는 말은 저장할 수 없습니다.' },
    { file: 'homework-cards', label: '숙제 카드', help: '교과서가 답을 주지 않은 사례. 제목과 쪽수만 둡니다(답 필드는 저장할 수 없습니다).' },
  ] },
  { id: 'particles', label: '입자 규칙', files: [{ file: 'particle-rules', label: '입자 규칙', help: '교과서에 있는 칸만 값을 쓰고, 없는 칸은 null(강조하지 않음). 입자 개수(count)는 항상 "same".' }] },
  { id: 'experiments', label: '실험 설정', files: [{ file: 'experiments', label: '실험 설정', help: '주사기 범위·눈금 읽기·허용 오차(tolerance)·유지 시간(holdMs, ms)·온도 단계·렌즈 관찰 시간·담그기(dip) 설정. 수치는 화면에 숫자로 보이지 않는 내부 눈금입니다.' }] },
  { id: 'minigame', label: '미니게임', files: [{ file: 'minigame-config', label: '미니게임', help: '시간은 ms(1000 = 1초). examTimeLimitMs 진료 제한(별 ②), hintIdleMs 손 모양 안내가 뜨는 시간, emergencyRoundMs 응급실 라운드, particleCount 렌즈 입자 수, shake 구슬 흔들기(gain이 클수록 게이지가 빨리 참), hero.nameMax 이름 최대 글자 수, hero.cardSize 시작 화면 캐릭터 그림 높이(px). 한 판 10분 내외가 되도록.' }] },
  { id: 'dialog', label: '대사', files: [{ file: 'dialog-config', label: '대사', help: '대사는 한 번에 1~2문장. hints는 실패 한 줄 안내, tutorial은 구슬 흔들기 카드. 교과서에 없는 말(분자 등)은 저장할 수 없습니다.' }] },
  { id: 'layout', label: '배치' },
  { id: 'assets', label: '에셋', files: [{ file: 'manifest', label: '그림 목록', help: 'public/assets/ 아래에 넣은 그림 파일을 여기에 적으면 플레이스홀더 대신 쓰입니다. 예: ["bg/exam.webp"]. 알려진 파일 이름만 저장됩니다(game/systems/render.ts의 ART 표).' }] },
  { id: 'volume', label: '음량' },
];

export default function AdminPage() {
  const [tab, setTab] = useState(TABS[0].id);
  const t = TABS.find(x => x.id === tab)!;
  const [sub, setSub] = useState<Record<string, number>>({});
  const f = t.files?.[sub[tab] ?? 0];
  const prod = process.env.NODE_ENV === 'production';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f', color: '#eee', fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: '#141414', borderBottom: '1px solid #2a2a2a', alignItems: 'center' }}>
        {TABS.map(x => <button key={x.id} onClick={() => setTab(x.id)} style={{ ...btnStyle(tab === x.id), padding: '8px 16px', fontSize: 13 }}>{x.label}</button>)}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: prod ? '#f87171' : '#888' }}>
          {prod ? '읽기 전용 — 배포 서버에서는 저장 불가' : '저장은 로컬(pnpm dev)에서만 됩니다. 저장한 JSON은 git 커밋·푸시로 배포하세요.'}
        </div>
        <Link href="/" style={{ marginLeft: 12, fontSize: 12, color: '#7dd3fc' }}>게임 →</Link>
      </div>
      {t.files && t.files.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 12px', background: '#111' }}>
          {t.files.map((x, i) => <button key={x.file} onClick={() => setSub({ ...sub, [tab]: i })} style={btnStyle((sub[tab] ?? 0) === i)}>{x.label}</button>)}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'layout' ? <LayoutEditor /> : tab === 'volume' ? <VolumeEditor /> : f ? <JsonEditor key={f.file} file={f.file} help={f.help} /> : null}
      </div>
    </div>
  );
}
