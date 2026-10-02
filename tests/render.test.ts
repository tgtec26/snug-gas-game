import { describe, it, expect } from 'vitest';
import { artToLoad, ART, heroKey } from '../game/systems/render';

describe('착용 그림 고르기', () => {
  it('장갑·보안경 착용 여부에 따라 네 가지 중 하나', () => {
    expect(heroKey('girl1', [])).toBe('hero_girl1');
    expect(heroKey('girl1', ['gloves'])).toBe('hero_girl1_gloves');
    expect(heroKey('girl1', ['goggles'])).toBe('hero_girl1_goggles');
    expect(heroKey('girl1', ['goggles', 'gloves'])).toBe('hero_girl1_both');
  });
  it('3명 모두 네 가지 그림이 ART 표에 있다', () => {
    for (const h of ['boy', 'girl1', 'girl2']) for (const w of [[], ['gloves'], ['goggles'], ['gloves', 'goggles']]) {
      expect(Object.values(ART), `${h} ${w}`).toContain(heroKey(h, w));
    }
  });
});

describe('그림 manifest', () => {
  it('비어 있으면 요청 0건 (404가 쌓이지 않는다)', () => { expect(artToLoad([])).toEqual([]); });
  it('적힌 파일 중 아는 키만 [키, URL]로', () => {
    expect(artToLoad(['bg/clinic.webp', 'bg/unknown.webp'])).toEqual([['clinic_bg', '/assets/bg/clinic.webp']]);
  });
  it('텍스처 키가 겹치지 않는다', () => { expect(new Set(Object.values(ART)).size).toBe(Object.keys(ART).length); });
});
