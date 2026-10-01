import * as Phaser from 'phaser';
import { TEXT } from '@/game/systems/render';

/** 화면 위쪽의 "지금 할 일" 한 줄. 어두운 알약 모양 바탕 위의 흰 글씨. */
export class GoalBanner {
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private shown = '';

  constructor(scene: Phaser.Scene, private y = 44) {
    this.bg = scene.add.graphics().setDepth(40);
    this.text = scene.add.text(640, y, '', { ...TEXT, fontSize: '32px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(41);
  }

  set(text: string) {
    if (text === this.shown) return;
    this.shown = text; this.text.setText(text).setVisible(!!text);
    this.bg.clear();
    if (!text) return;
    const w = Math.min(1180, this.text.width + 64), h = 56;
    this.bg.fillStyle(0x0f1d26, 0.78); this.bg.fillRoundedRect(640 - w / 2, this.y - h / 2, w, h, 28);
    this.bg.lineStyle(3, 0xffffff, 0.55); this.bg.strokeRoundedRect(640 - w / 2, this.y - h / 2, w, h, 28);
  }
}
