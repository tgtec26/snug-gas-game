'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { storyPlan, type StorySceneId } from '@/game/story';
import { useLock } from '@/components/hooks/useLock';
import { GoalBar } from '@/components/GoalBar';
import { PatientIcon } from '@/components/art/PatientIcon';
import { PressureGauge, Thermometer } from '@/components/art/Gauges';
import { STORY_DECOR } from '@/components/art/storyDecor';
import type { Patient } from '@/game/types';

const START_MS = 600;   // 장면이 보인 뒤 계기가 움직이기 시작

export function StoryOverlay() {
  const phase = useGame(s => s.phase);
  const id = useGame(s => s.currentId);
  const patient = useDataStore(s => s.patients.find(p => p.id === id));
  const finishStory = useGame(s => s.finishStory);
  const storyMs = useDataStore(s => s.minigame?.storyMs ?? 3200);
  if (phase !== 'story' || !patient) return null;
  return <Story key={patient.id} patient={patient} endMs={storyMs} onDone={finishStory} />;
}

/** 글 없는 사연 장면: 계기 바늘·눈금이 움직이고 환자 모양이 변한다. 잠금(0.7초) 뒤에는 탭·Enter·Space로 건너뛴다. */
export function Story({ patient, endMs, onDone }: { patient: Patient; endMs: number; onDone: () => void }) {
  const finishStory = onDone;
  const locked = useLock('short');
  const plan = storyPlan(patient);
  const goal = useDataStore(s => s.dialog?.goals.story ?? '');
  const art = useDataStore(s => s.art.includes(`story/${plan.scene}.webp`));
  const [value, setValue] = useState(plan.from);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => { setValue(plan.to); setMoved(true); }, START_MS);
    const b = setTimeout(() => finishStory(), endMs);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [plan.to, finishStory, endMs]);

  const skip = useCallback(() => { if (!locked) finishStory(); }, [locked, finishStory]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skip]);

  const deform = moved
    ? (plan.deform === 'swell' ? 'scale(1.38)' : 'scale(1.22, 0.58)')
    : 'scale(1)';

  return (
    <div className="absolute inset-0 bg-black/55 pointer-events-auto cursor-pointer select-none" onClick={skip}>
      <GoalBar text={goal} />
      <div className="absolute flex items-center gap-8" style={{ left: 230, top: 170 }}>
        <div className="relative w-[560px] h-[400px] rounded-3xl overflow-hidden border-[6px] border-white shadow-[0_14px_36px_rgba(0,0,0,0.5)]">
          {art
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="absolute inset-0" src={`/assets/story/${plan.scene}.webp`} alt="" width={560} height={400} draggable={false} style={{ objectFit: 'cover' }} />
            : (
              <svg className="absolute inset-0" width="560" height="400" viewBox="0 0 560 400" aria-hidden="true">
                {STORY_DECOR[plan.scene as StorySceneId]}
              </svg>
            )}
          <div className="absolute" style={{ left: 195, top: 172, width: 170, height: 170 }}>
            <div style={{ transform: deform, transformOrigin: '50% 88%', transition: 'transform 1600ms ease-in-out', width: 170, height: 170 }}>
              <PatientIcon id={patient.id} size={170} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center w-[230px] h-[300px] rounded-3xl bg-white/90 border-[6px] border-white shadow-[0_14px_36px_rgba(0,0,0,0.5)]">
          {plan.gauge === 'pressure-sensor'
            ? <PressureGauge value={value} size={200} />
            : <Thermometer value={value} size={230} />}
        </div>
      </div>
      {!locked && (
        <svg className="absolute right-10 bottom-8" width="64" height="40" viewBox="0 0 64 40" aria-hidden="true" style={{ animation: 'bob 1.2s ease-in-out infinite' }}>
          <path d="M6 6 L26 20 L6 34 M30 6 L50 20 L30 34" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
