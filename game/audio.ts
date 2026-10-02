/**
 * 배경음 1트랙 + 효과음. 음량·음원은 public/data/audio-config.json (admin의 음량 탭)에서 읽고,
 * 코드에는 값을 두지 않는다. 음원은 암석 순환 게임의 것을 재활용한다.
 * 브라우저는 첫 사용자 입력 전 재생을 막으므로 실패는 조용히 무시하고, 첫 입력 때 unlockAudio()로 다시 시도한다.
 */
export const BGM_SLOTS = ['title', 'play', 'ending'] as const;
export const SFX_SLOTS = ['correct', 'error', 'success', 'tick', 'piston', 'splash', 'collide', 'stamp', 'fanfare', 'launch'] as const;
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
let mutedLoaded = false;

const MUTE_KEY = 'gas-muted';
/** 같은 효과음이 이 간격(ms) 안에 다시 울리면 무시한다(연타 때 소리가 겹쳐 터지는 것 방지). */
export const SFX_MIN_GAP_MS = 90;
const lastSfxAt: Partial<Record<SfxSlot, number>> = {};

/** 같은 효과음의 최소 간격 검사. 통과하면 시각을 기록한다. */
export function sfxGateOpen(slot: SfxSlot, now: number): boolean {
  const last = lastSfxAt[slot];
  if (last !== undefined && now - last < SFX_MIN_GAP_MS) return false;
  lastSfxAt[slot] = now;
  return true;
}

function loadMuted() {
  if (mutedLoaded) return;
  mutedLoaded = true;
  try { muted = window.localStorage.getItem(MUTE_KEY) === '1'; } catch { /* 저장소 차단 — 기본값 유지 */ }
}

export function configureAudio(c: AudioConfig) {
  config = c;
  if (current) current.el.volume = c.bgmVolume;
}

function safePlay(el: HTMLAudioElement) {
  el.play()?.catch(() => { /* autoplay 차단 — 무시 */ });
}

export function playBgm(slot: BgmSlot) {
  if (typeof window === 'undefined' || !config) return;
  loadMuted();
  if (current?.slot === slot) { if (current.el.paused && !document.hidden) safePlay(current.el); return; }
  current?.el.pause();
  const el = new Audio(`/assets/audio/${config.bgm[slot]}.mp3`);
  el.loop = true;
  el.volume = config.bgmVolume;
  el.muted = muted;
  current = { slot, el };
  if (!document.hidden) safePlay(el);
}

export function stopBgm() {
  current?.el.pause();
  current = null;
}

/** 탭이 숨겨지면 BGM을 멈추고, 돌아오면 이어서 튼다. */
export function setPageHidden(hidden: boolean) {
  if (!current) return;
  if (hidden) current.el.pause(); else safePlay(current.el);
}

// 효과음은 WebAudio로 재생한다(아이폰 Safari는 HTMLAudio 음량 조절이 안 된다).
let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

function getBuffer(c: AudioContext, name: string): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    p = fetch(`/assets/audio/${name}.mp3`).then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).catch(() => null);
    buffers.set(name, p);
  }
  return p;
}

/** rate가 1보다 크면 음이 높아진다(콤보가 쌓일수록 올라가는 소리). */
export function playSfx(slot: SfxSlot, rate = 1) {
  if (typeof window === 'undefined' || !config) return;
  loadMuted();
  if (muted || !sfxGateOpen(slot, performance.now())) return;
  const c = getCtx();
  if (!c) return;
  const volume = config.sfxVolume;
  void c.resume().catch(() => {});
  void getBuffer(c, config.sfx[slot]).then(buf => {
    if (!buf || muted) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = volume;
    src.connect(g).connect(c.destination);
    src.start();
  });
}

/** 첫 사용자 입력에서 호출: 오디오 컨텍스트를 풀고 BGM을 (다시) 시작한다. */
export function unlockAudio() {
  loadMuted();
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
  if (current?.el.paused && !document.hidden) safePlay(current.el);
}

export function setMuted(m: boolean) {
  loadMuted();
  muted = m;
  if (current) current.el.muted = m;
  try { window.localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* 저장 실패 — 이번 방문에만 적용 */ }
}
export function isMuted() { loadMuted(); return muted; }
