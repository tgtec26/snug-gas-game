import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/game/config';
import { DPR } from '@/game/systems/render';
import { BootScene } from '@/game/scenes/BootScene';
import { BackdropScene } from '@/game/scenes/BackdropScene';
import { ClinicScene } from '@/game/scenes/ClinicScene';
import { DipScene } from '@/game/scenes/DipScene';

export function makePhaserConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH * DPR,
    height: GAME_HEIGHT * DPR,
    backgroundColor: '#0b0b12',
    scene: [BootScene, BackdropScene, ClinicScene, DipScene],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // 개발 중에는 숨겨진 미리보기 창(rAF 정지)에서도 루프가 돌도록 setTimeout 루프 사용. 배포는 rAF.
    fps: process.env.NODE_ENV !== 'production' ? { forceSetTimeOut: true, target: 60 } : undefined,
  };
}
