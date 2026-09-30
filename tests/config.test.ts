import { it, expect } from 'vitest';
import { GAME_WIDTH, GAME_HEIGHT, hex } from '@/game/config';

it('무대 크기는 1280×800 (크롬북 1280×800과 1:1)', () => {
  expect(GAME_WIDTH).toBe(1280);
  expect(GAME_HEIGHT).toBe(800);
});

it('hex() 는 6자리 CSS 색', () => {
  expect(hex(0x4cc9f0)).toBe('#4cc9f0');
  expect(hex(0x000000)).toBe('#000000');
});
