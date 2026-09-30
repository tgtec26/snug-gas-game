import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import audioConfig from '../public/data/audio-config.json';
import { validateAudioConfig, setMuted, isMuted, BGM_SLOTS, SFX_SLOTS, type AudioConfig } from '../game/audio';

const cfg = audioConfig as unknown as AudioConfig;

describe('audio-config.json (음량과 음원은 코드가 아니라 데이터)', () => {
  it('오류가 없다', () => { expect(validateAudioConfig(cfg)).toEqual([]); });
  it('참조하는 음원 파일이 모두 public/assets/audio에 있다', () => {
    const names = [...BGM_SLOTS.map(s => cfg.bgm[s]), ...SFX_SLOTS.map(s => cfg.sfx[s])];
    for (const n of names) expect(fs.existsSync(path.join(__dirname, '../public/assets/audio', `${n}.mp3`)), n).toBe(true);
  });
  it('음량 범위를 벗어나면 잡는다', () => {
    expect(validateAudioConfig({ ...cfg, bgmVolume: 1.2 }).join()).toContain('bgmVolume');
    expect(validateAudioConfig({ ...cfg, sfxVolume: -0.1 }).join()).toContain('sfxVolume');
  });
  it('슬롯이 비었거나 경로를 가리키면 잡는다', () => {
    expect(validateAudioConfig({ ...cfg, bgm: { ...cfg.bgm, play: '' } }).join()).toContain('bgm.play');
    expect(validateAudioConfig({ ...cfg, sfx: { ...cfg.sfx, error: '../secret' } }).join()).toContain('sfx.error');
  });
});

describe('음소거', () => {
  it('켜고 끈다', () => { setMuted(true); expect(isMuted()).toBe(true); setMuted(false); expect(isMuted()).toBe(false); });
});
