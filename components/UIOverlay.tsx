'use client';

import type { ComponentType } from 'react';
import { HUD } from '@/components/HUD';
import { TopControls } from '@/components/TopControls';
import { AudioRunner } from '@/components/AudioRunner';
import { DevSkip } from '@/components/DevSkip';
import { TitleOverlay } from '@/components/overlays/TitleOverlay';
import { IntroOverlay } from '@/components/overlays/IntroOverlay';
import { ClinicOverlay } from '@/components/overlays/ClinicOverlay';
import { StoryOverlay } from '@/components/overlays/StoryOverlay';
import { DiagnosisOverlay } from '@/components/overlays/DiagnosisOverlay';
import { EmergencyOverlay } from '@/components/overlays/EmergencyOverlay';
import { useGame } from '@/game/store';
import type { Phase } from '@/game/types';

/** 아직 만들지 않은 phase. 해당 태스크가 이 표의 값만 바꾼다. */
const Pending: ComponentType = () => null;

/** phase → 오버레이 */
export const OVERLAYS: Record<Phase, ComponentType> = {
  title: TitleOverlay,
  intro: IntroOverlay,
  tutorial: Pending,    // Task 12
  clinic: ClinicOverlay,
  story: StoryOverlay,
  exam: Pending,        // Task 7~11
  diagnosis: DiagnosisOverlay,
  emergency: EmergencyOverlay,
  ending: Pending,      // Task 14
  result: Pending,      // Task 14
};

/** 1280×800 네이티브 좌표. 루트는 클릭을 통과시키고 각 오버레이가 pointer-events-auto를 켠다. */
export function UIOverlay() {
  const phase = useGame(s => s.phase);
  const Current = OVERLAYS[phase];
  return (
    <div className="absolute inset-0 pointer-events-none">
      <HUD />
      <Current />
      <DevSkip />
      <TopControls />
      <AudioRunner />
    </div>
  );
}
