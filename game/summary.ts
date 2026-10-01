import type { ExamRecord, Patient } from './types';
import { totalStars } from './store';

export interface Summary {
  treated: number;        // 치료한 환자 수 (진료 + 응급실에서 성공한 환자)
  total: number;          // 전체 환자 수
  stars: number;          // 별 합계
  wrongGauge: number;     // 잘못 돌린 조절기 횟수
}

/** 요약 팝업에 쓸 숫자. 모두 store의 기록에서 계산한다. */
export function summarize(
  s: { records: Record<string, ExamRecord>; emergencyResults: boolean[] }, patients: Patient[],
): Summary {
  const examCount = Object.keys(s.records).length;
  return {
    treated: examCount + s.emergencyResults.filter(Boolean).length,
    total: patients.length,
    stars: totalStars(s),
    wrongGauge: Object.values(s.records).reduce((a, r) => a + r.wrongGauge, 0),
  };
}
