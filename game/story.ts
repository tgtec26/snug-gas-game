import type { Patient } from '@/game/types';
import { volumeDirection } from '@/game/rules';

/** 사연 장면 id. 그림은 components/art/storyDecor.tsx의 Record가 컴파일 시점에 빠짐없이 맞춘다. */
export const STORY_SCENES = [
  'sit-on-ball', 'mountain', 'cold-outside', 'winter-field',
  'dented-ball', 'lie-on-bed', 'heat-balloon', 'landing',
] as const;
export type StorySceneId = (typeof STORY_SCENES)[number];

export interface StoryPlan {
  scene: string;
  gauge: Patient['gauge'];
  /** 계기 눈금 0~1: 시작과 끝. 사연에서 움직인 계기만 움직인다. */
  from: number;
  to: number;
  /** 환자 모양이 변하는 방향: 부풀어 오름 / 찌그러짐 */
  deform: 'swell' | 'squash';
}

/** 사연 장면 계획: 글 없이 계기 바늘·눈금이 움직이고 환자 모양이 변한다. 방향은 rules의 volumeDirection이 정한다. */
export function storyPlan(p: Patient): StoryPlan {
  const cause = p.steps.find(s => s.role === 'cause') ?? p.steps[0];
  return {
    scene: p.scene,
    gauge: p.gauge,
    from: 0.5,
    to: cause.change === 'up' ? 0.85 : 0.15,
    deform: volumeDirection(p.variable, cause.change) === 'increase' ? 'swell' : 'squash',
  };
}
