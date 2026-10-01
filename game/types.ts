export type Variable = 'pressure' | 'temperature';
export type Change = 'up' | 'down';
export type Law = 'boyle' | 'charles';
export type Trend = 'increase' | 'decrease';
export type Kind = 'measure' | 'dip' | 'redo' | 'emergency';

export interface PatientStep {
  change: Change;            // 변인을 올리는가 내리는가
  size: number;              // 압력: 부피 눈금 칸 수, 온도: 온도 단계 수
  role: 'cause' | 'explore'; // cause = 사연 재현, explore = 반대 방향 확인
}

export interface Patient {
  id: string;
  name: string;
  kind: Kind;
  variable: Variable;
  scene: string;             // 사연 장면 id (글 없음)
  gauge: 'pressure-sensor' | 'thermometer';
  pages: number[];           // 교과서 쪽
  rig?: 'dip';               // 응급실에서 쓰는 장치: 있으면 담그기 장치(DipScene), 없으면 주사기·다이얼(ClinicScene)
  verified: boolean;
  steps: PatientStep[];
}

export interface Experiments {
  syringe: { start: number; min: number; max: number };
  measure: { from: number; to: number; dwellMs: number };
  tolerance: number;
  holdMs: number;
  temp: { minStep: number; maxStep: number; perStep: number };
  gear: string[];
  lens: { observeMs: number };
  dip: { hotStep: number; coldStep: number; rate: number };   // 담그기: 뜨거운 물·얼음물의 온도 단계, 단계/초
}

export interface Device { piston: number; tempStep: number }

export interface ParticleRule {
  variable: Variable;
  change: Change;
  count: 'same';
  distance: Trend | null;
  collisionCount: Trend | null;
  strength: Trend | null;
  speed: Trend | 'same' | null;
}

export type MatchReason = 'wrong-gauge' | 'not-there' | 'hold';

export type Phase =
  | 'title' | 'intro' | 'tutorial' | 'clinic' | 'story' | 'exam'
  | 'diagnosis' | 'emergency' | 'ending' | 'result';

export interface ExamRecord { stars: number; wrongGauge: number }
