import type * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DPR } from '@/game/config';

export { DPR };
export const TEXT = { fontFamily: 'Pretendard, "Apple SD Gothic Neo", system-ui, sans-serif', resolution: DPR };
/** 밝은 배경 위에서도 읽히는 글자 테두리 */
export const OUTLINE = { stroke: '#000', strokeThickness: 4 } as const;

/** 씬 create() 첫 줄에서 호출: 카메라를 DPR배 줌해 월드 좌표는 1280×800 그대로 유지 */
export function hiDpi(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(DPR);
  scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
/** 텍스처 원본 크기와 무관하게 표시 크기 고정 (그림은 표시 크기의 2배 해상도 권장) */
export function addImg(scene: Phaser.Scene, x: number, y: number, key: string, w: number, h: number) {
  return scene.add.image(x, y, key).setDisplaySize(w, h);
}
/** 전체 화면 배경: codex 그림(artKey)이 있으면 그림, 없으면 SVG 코드 플레이스홀더(placeholderKey) */
export function addBg(scene: Phaser.Scene, artKey: string, placeholderKey: string) {
  const key = scene.textures.exists(artKey) ? artKey : placeholderKey;
  return scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
}

/** 텍스처 키 ← public/assets/ 안의 파일 (docs/art-todo.md 표). 그림을 넣으면 manifest.json에 경로를 한 줄 더한다. */
export const ART: Record<string, string> = {
  'bg/clinic.webp': 'clinic_bg',
  'bg/exam.webp': 'exam_bg',
  'npc/apprentice.webp': 'npc_apprentice',
  'npc/doctor.webp': 'npc_doctor',
  'equip/beaker.webp': 'sp_beaker',
  'equip/gauge.webp': 'sp_gauge',
  'equip/thermo.webp': 'sp_thermo',
  'equip/knob.webp': 'sp_knob',
  'equip/barrel.webp': 'sp_barrel',
  'equip/grip.webp': 'sp_grip',
  'equip/ball.webp': 'sp_ball',
  'equip/lens.webp': 'sp_lens',
  'equip/ice.webp': 'sp_ice',
  'props/glove.webp': 'sp_glove',
  'props/goggles.webp': 'sp_goggles',
  'props/kid.webp': 'sp_kid',
  'props/bottle.webp': 'sp_bottle',
  'props/palm.webp': 'sp_palm',
  'props/rocket.webp': 'sp_rocket',
  'props/pumpbody.webp': 'sp_pumpbody',
  'props/pumphandle.webp': 'sp_pumphandle',
  'props/pad.webp': 'sp_pad',
  'bg/finale.webp': 'finale_bg',
  'bg/rig_clinic.webp': 'rig_clinic',
  'bg/rig_dip.webp': 'rig_dip',
  'story/sit-on-ball.webp': 'story_sit-on-ball',
  'story/mountain.webp': 'story_mountain',
  'story/cold-outside.webp': 'story_cold-outside',
  'story/winter-field.webp': 'story_winter-field',
  'story/dented-ball.webp': 'story_dented-ball',
  'story/lie-on-bed.webp': 'story_lie-on-bed',
  'story/heat-balloon.webp': 'story_heat-balloon',
  'story/landing.webp': 'story_landing',
  'patients/rubberball.webp': 'patient_rubberball',
  'patients/snackbag.webp': 'patient_snackbag',
  'patients/foilballoon.webp': 'patient_foilballoon',
  'patients/soccerball.webp': 'patient_soccerball',
  'patients/ppball.webp': 'patient_ppball',
  'patients/airbed.webp': 'patient_airbed',
  'patients/balloon.webp': 'patient_balloon',
  'patients/shoe.webp': 'patient_shoe',
  'patients/emergency.webp': 'patient_emergency',
};
/** manifest.json 에 적힌(= 실제로 있는) 파일만 [키, URL]로 — 없는 파일을 요청해 404가 쌓이지 않게 */
export const artToLoad = (files: string[]): [string, string][] =>
  files.filter(f => ART[f]).map(f => [ART[f], `/assets/${f}`]);
