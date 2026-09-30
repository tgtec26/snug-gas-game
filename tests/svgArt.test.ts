import { describe, it, expect } from 'vitest';
import { PLACEHOLDERS, svgDataUrl } from '../game/systems/svgArt';

describe('SVG 코드 플레이스홀더', () => {
  for (const [key, art] of Object.entries(PLACEHOLDERS)) {
    describe(key, () => {
      it('올바른 SVG(XML)로 읽힌다', () => {
        const doc = new DOMParser().parseFromString(art.svg, 'image/svg+xml');
        expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
        expect(doc.documentElement.tagName).toBe('svg');
      });
      it('viewBox가 표시 크기와 같다', () => {
        expect(art.svg).toContain(`viewBox="0 0 ${art.w} ${art.h}"`);
      });
      it('글자·스크립트·외부 그림이 없다', () => {
        expect(art.svg).not.toMatch(/<text|<script|<image|href=/);
      });
    });
  }
  it('base64 data URL로 바꿀 수 있고 한글도 깨지지 않는다 (Phaser가 base64로 디코딩한다)', () => {
    const src = '<svg xmlns="http://www.w3.org/2000/svg"><!-- 공기 진료소 --></svg>';
    const u = svgDataUrl(src);
    expect(u.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(decodeURIComponent(escape(atob(u.split(',')[1])))).toBe(src);
  });
  it('모든 플레이스홀더가 base64로 문제없이 디코딩된다', () => {
    for (const art of Object.values(PLACEHOLDERS)) {
      expect(decodeURIComponent(escape(atob(svgDataUrl(art.svg).split(',')[1])))).toBe(art.svg);
    }
  });
});
