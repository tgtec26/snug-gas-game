/**
 * 배경음 1트랙 + 효과음. 음량·음원은 public/data/audio-config.json (admin의 음량 탭)에서 읽고,
 * 코드에는 값을 두지 않는다. 음원은 암석 순환 게임의 것을 재활용한다.
 * 브라우저는 첫 사용자 입력 전 재생을 막으므로 실패는 조용히 무시하고, 첫 입력 때 unlockAudio()로 다시 시도한다.
 */
export const BGM_SLOTS = ['title', 'play', 'ending'] as const;
export const SFX_SLOTS = ['correct', 'error', 'success'] as const;
export type BgmSlot = (typeof BGM_SLOTS)[number];
export type SfxSlot = (typeof SFX_SLOTS)[number];

export interface AudioConfig {
  bgmVolume: number;
  sfxVolume: number;
  bgm: Record<BgmSlot, string>;
  sfx: Record<SfxSlot, string>;
}

const FILE_NAME = /^[A-Za-z0-9_-]+$/;

/** 오류 문자열 목록. 비어 있어야 쓸 수 있다. */
export function validateAudioConfig(c: AudioConfig): string[] {
  const errs: string[] = [];
  for (const k of ['bgmVolume', 'sfxVolume'] as const) {
    if (typeof c[k] !== 'number' || !(c[k] >= 0 && c[k] <= 1)) errs.push(`${k}는 0~1 사이여야 한다`);
  }
  for (const s of BGM_SLOTS) if (!FILE_NAME.test(c.bgm?.[s] ?? '')) errs.push(`bgm.${s} 음원 이름이 올바르지 않다`);
  for (const s of SFX_SLOTS) if (!FILE_NAME.test(c.sfx?.[s] ?? '')) errs.push(`sfx.${s} 음원 이름이 올바르지 않다`);
  return errs;
}

let config: AudioConfig | null = null;
let current: { slot: BgmSlot; el: HTMLAudioElement } | null = null;
let muted = false;

export function configureAudio(c: AudioConfig) {
  config = c;
  if (current) current.el.volume = c.bgmVolume;
}

function safePlay(el: HTMLAudioElement) {
  el.play()?.catch(() => { /* autoplay 차단 — 무시 */ });
}

export function playBgm(slot: BgmSlot) {
  if (typeof window === 'undefined' || !config) return;
  if (current?.slot === slot) { if (current.el.paused) safePlay(current.el); return; }
  current?.el.pause();
  const el = new Audio(`/assets/audio/${config.bgm[slot]}.mp3`);
  el.loop = true;
  el.volume = config.bgmVolume;
  el.muted = muted;
  current = { slot, el };
  safePlay(el);
}

export function stopBgm() {
  current?.el.pause();
  current = null;
}

/** rate가 1보다 크면 음이 높아진다(콤보가 쌓일수록 올라가는 소리). */
export function playSfx(slot: SfxSlot, rate = 1) {
  if (typeof window === 'undefined' || muted || !config) return;
  const el = new Audio(`/assets/audio/${config.sfx[slot]}.mp3`);
  el.volume = config.sfxVolume;
  if (rate !== 1) { el.preservesPitch = false; el.playbackRate = rate; }
  safePlay(el);
}

export function unlockAudio() {
  if (current?.el.paused) safePlay(current.el);
}

export function setMuted(m: boolean) {
  muted = m;
  if (current) current.el.muted = m;
}
export const isMuted = () => muted;
