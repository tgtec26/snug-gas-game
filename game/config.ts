export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;
/** 기기 픽셀 비율 (최대 2). 캔버스 내부 해상도를 DPR배로 만들어 레티나에서 흐려지지 않게 한다. */
export const DPR = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;

export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
