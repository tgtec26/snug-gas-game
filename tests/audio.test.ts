import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import audioConfig from '../public/data/audio-config.json';
import { bgmSlotFor } from '../components/AudioRunner';
import { validateAudioConfig, setMuted, isMuted, sfxGateOpen, SFX_MIN_GAP_MS, BGM_SLOTS, SFX_SLOTS, type AudioConfig } from '../game/audio';

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

describe('음소거 저장', () => {
  beforeEach(() => { window.localStorage.clear(); });
  it('켜면 localStorage에 남고 끄면 지워진다', () => {
    setMuted(true); expect(window.localStorage.getItem('gas-muted')).toBe('1');
    setMuted(false); expect(window.localStorage.getItem('gas-muted')).toBe('0');
  });
  it('저장소가 막혀 있어도 예외 없이 이번 방문에는 적용된다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => setMuted(true)).not.toThrow();
    expect(isMuted()).toBe(true);
    spy.mockRestore(); setMuted(false);
  });
});

describe('효과음 연타 간격', () => {
  it('같은 슬롯은 간격 안이면 막고, 다른 슬롯과 간격 뒤는 통과한다', () => {
    expect(sfxGateOpen('tick', 1000)).toBe(true);
    expect(sfxGateOpen('tick', 1000 + SFX_MIN_GAP_MS - 1)).toBe(false);
    expect(sfxGateOpen('stamp', 1010)).toBe(true);
    expect(sfxGateOpen('tick', 1000 + SFX_MIN_GAP_MS)).toBe(true);
  });
});

describe('장면별 BGM', () => {
  it('타이틀·인트로 / 플레이 / 엔딩·결과로 고른다', () => {
    expect(bgmSlotFor('title')).toBe('title');
    expect(bgmSlotFor('intro')).toBe('title');
    expect(bgmSlotFor('ending')).toBe('ending');
    expect(bgmSlotFor('result')).toBe('ending');
    expect(bgmSlotFor('clinic' as never)).toBe('play');
  });
});
