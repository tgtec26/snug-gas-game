import * as Phaser from 'phaser';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PatientIcon, PATIENT_ICON_IDS } from '@/components/art/PatientIcon';
import { sceneFor } from '@/game/systems/sceneRouter';
import { artToLoad, DPR } from '@/game/systems/render';
import { PLACEHOLDERS, svgDataUrl } from '@/game/systems/svgArt';
import { useGame } from '@/game/store';

/**
 * SVG 코드 플레이스홀더를 항상 불러오고, public/assets/manifest.json 에 적힌 codex 그림이 있으면 함께 불러온다.
 * 그림이 있으면 addBg가 그림을, 없으면 플레이스홀더를 쓴다. 없는 파일은 요청하지 않아 404가 쌓이지 않는다.
 */
export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }); }
  preload() {
    for (const [key, art] of Object.entries(PLACEHOLDERS)) {
      this.load.svg(key, svgDataUrl(art.svg), { width: art.w * DPR, height: art.h * DPR });
    }
    // 환자 아이콘은 React 그림(PatientIcon)과 같은 SVG를 Phaser 텍스처로도 쓴다: patient_<id>_ph
    for (const id of PATIENT_ICON_IDS) {
      const svg = renderToStaticMarkup(createElement(PatientIcon, { id, size: 240, shadow: false })).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      this.load.svg(`patient_${id}_ph`, svgDataUrl(svg), { width: 240 * DPR, height: 240 * DPR });
    }
    this.load.json('art_manifest', '/assets/manifest.json');
    this.load.once('filecomplete-json-art_manifest', (_key: string, _type: string, files: string[]) => {
      for (const [key, url] of artToLoad(Array.isArray(files) ? files : [])) this.load.image(key, url);
    });
  }
  create() {
    this.scene.start(sceneFor(useGame.getState().phase));
  }
}
