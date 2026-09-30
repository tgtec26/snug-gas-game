import { describe, it, expect } from 'vitest';
import { artToLoad, ART } from '../game/systems/render';

describe('그림 manifest', () => {
  it('비어 있으면 요청 0건 (404가 쌓이지 않는다)', () => { expect(artToLoad([])).toEqual([]); });
  it('적힌 파일 중 아는 키만 [키, URL]로', () => {
    expect(artToLoad(['bg/clinic.webp', 'bg/unknown.webp'])).toEqual([['clinic_bg', '/assets/bg/clinic.webp']]);
  });
  it('텍스처 키가 겹치지 않는다', () => { expect(new Set(Object.values(ART)).size).toBe(Object.keys(ART).length); });
});
