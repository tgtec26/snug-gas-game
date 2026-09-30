import * as Phaser from 'phaser';
import { hiDpi, addBg } from '@/game/systems/render';
import { attachRouter } from '@/game/systems/sceneRouter';

/** 오버레이 위주 phase(타이틀·인트로·대기실·사연·진단서·엔딩·요약)의 배경. */
export class BackdropScene extends Phaser.Scene {
  constructor() { super({ key: 'Backdrop' }); }
  create() {
    hiDpi(this);
    addBg(this, 'clinic_bg', 'clinic_bg_ph');
    attachRouter(this);
  }
}
