import * as Phaser from 'phaser';
import { hiDpi, TEXT, OUTLINE } from '@/game/systems/render';
import { attachRouter } from '@/game/systems/sceneRouter';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { summarize } from '@/game/summary';
import { playSfx } from '@/game/audio';

type Stage = 'pause' | 'pump' | 'launch' | 'count' | 'done';

const PAUSE_MS = 600;       // 잠깐 멈춤 (입력 잠금)
const PUMP_MS = 2200;       // 펌프 연타 제한 시간 (2초 남짓)
const PRESS_GAIN = 0.12;    // 한 번 누를 때 오르는 압력
const SKIP_AFTER_MS = 1000; // 잠금이 풀린 뒤부터 건너뛸 수 있다
const AUTO_NEXT_MS = 2200;  // 별 카운트업이 끝난 뒤 자동으로 요약 팝업

const PUMP = { x: 470, y: 690 };
const PAD = { x: 800, y: 660 };

/** 에어 로켓 피날레(6-8): 펌프 연타 → 로켓이 위쪽 하늘로 발사 → 빛 폭발·팡파르 → 별 카운트업 → 요약 팝업. 원리는 글로 설명하지 않는 연출. */
export class FinaleScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private stage: Stage = 'pause';
  private t0 = 0;
  private charge = 0;
  private handle = 0;           // 손잡이가 눌린 정도 0~1
  private rocketY = 0;
  private rocketT = 0;          // 발사 진행 0~1
  private apexY = 120;
  private trail: { x: number; y: number; t0: number }[] = [];
  private countText!: Phaser.GameObjects.Text;
  private treatedText!: Phaser.GameObjects.Text;
  private nextArrow!: Phaser.GameObjects.Graphics;
  private stars = 0;
  private shown = { stars: 0 };
  private doneAt = 0;
  private advanced = false;
  private lastKeyAt = 0;

  constructor() { super({ key: 'Finale' }); }

  create() {
    hiDpi(this);
    attachRouter(this);
    this.g = this.add.graphics().setDepth(5);
    this.stage = 'pause'; this.t0 = performance.now(); this.charge = 0; this.handle = 0; this.rocketT = 0; this.trail = [];
    this.shown = { stars: 0 }; this.doneAt = 0; this.advanced = false; this.lastKeyAt = 0;

    const s = useGame.getState(); const patients = useDataStore.getState().patients;
    const sum = summarize({ records: s.records, emergencyResults: s.emergencyResults }, patients);
    this.stars = sum.stars;
    this.countText = this.add.text(640, 330, '', { ...TEXT, ...OUTLINE, fontSize: '120px', fontStyle: 'bold', color: '#ffd54f' }).setOrigin(0.5).setDepth(30).setAlpha(0);
    this.treatedText = this.add.text(640, 450, `치료한 환자 ${sum.treated}명`, { ...TEXT, ...OUTLINE, fontSize: '40px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(30).setAlpha(0);
    this.nextArrow = this.add.graphics().setDepth(30).setAlpha(0);
    this.nextArrow.fillStyle(0xffffff, 1); this.nextArrow.fillTriangle(1170, 720, 1170, 770, 1218, 745);
    this.tweens.add({ targets: this.nextArrow, x: -12, duration: 450, yoyo: true, repeat: -1 });

    this.input.on('pointerdown', this.onDown, this);
    // 키보드: Space·Enter·↓로 펌프를 누른다. 자동 반복(e.repeat)은 무시, 너무 빠른 중복도 무시.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') { this.skip(); return; }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); this.press(); }
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
  }

  private elapsed() { return performance.now() - this.t0; }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.stage === 'pump') {
      if (Math.hypot(p.worldX - PUMP.x, p.worldY - (PUMP.y - 150)) < 130) { this.press(); return; }
    }
    if (p.worldX > 1100 && p.worldY > 690) this.skip();
    else if (this.stage === 'done') this.advance();
  }

  /** 펌프 손잡이를 한 번 누른다 */
  private press() {
    const now = performance.now();
    if (this.stage !== 'pump' || now - this.lastKeyAt < 40) return;
    this.lastKeyAt = now;
    this.charge = Math.min(1, this.charge + PRESS_GAIN); this.handle = 1;
    playSfx('correct', 0.9 + this.charge * 0.5);
    for (let i = 0; i < 4; i++) {
      const c = this.add.circle(PAD.x - 30 + Math.random() * 60, PAD.y + 30, 5, 0xffffff, 0.8).setDepth(8);
      this.tweens.add({ targets: c, y: c.y - 40 - Math.random() * 40, alpha: 0, duration: 400, onComplete: () => c.destroy() });
    }
    if (this.charge >= 1) this.launch();
  }

  private skip() {
    if (this.elapsed() < PAUSE_MS + SKIP_AFTER_MS) return;
    if (this.stage === 'pump') { this.charge = Math.max(this.charge, 0.6); this.launch(); }
    else if (this.stage === 'launch' || this.stage === 'count') this.startCount(true);
    else if (this.stage === 'done') this.advance();
  }

  private launch() {
    if (this.stage !== 'pump') return;
    this.stage = 'launch'; this.t0 = performance.now(); this.rocketT = 0;
    this.apexY = 330 - this.charge * 240;   // 많이 누를수록 높이 올라간다 (항상 위쪽 하늘로)
    playSfx('success', 1.2);
    this.cameras.main.shake(160, 0.004);
  }

  private startCount(skipped = false) {
    if (this.stage === 'count' || this.stage === 'done') return;
    this.stage = 'count'; this.t0 = performance.now();
    this.boom(skipped);
    this.countText.setAlpha(1); this.treatedText.setAlpha(1);
    this.tweens.add({
      targets: this.shown, stars: this.stars, duration: Math.max(400, Math.min(1400, 300 + this.stars * 120)), ease: 'Quad.Out',
      onUpdate: () => { this.countText.setText(`★ ${Math.round(this.shown.stars)}`); },
      onComplete: () => {
        this.countText.setText(`★ ${this.stars}`);
        this.tweens.add({ targets: this.countText, scale: 1.25, yoyo: true, duration: 180 });
        this.stage = 'done'; this.doneAt = performance.now(); this.nextArrow.setAlpha(1);
      },
    });
  }

  /** 빛 폭발과 파티클, 팡파르 */
  private boom(quiet: boolean) {
    this.cameras.main.flash(260, 255, 255, 255, true);
    if (!quiet) playSfx('success', 1);
    const cx = PAD.x + 60 * 0, cy = Math.max(this.apexY, 100);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2; const d = 120 + Math.random() * 380;
      const c = this.add.circle(cx, cy, 5 + Math.random() * 9, [0xffd54f, 0xffffff, 0xff8a65, 0x8fe3c0, 0x80d8ff][i % 5]).setDepth(25);
      this.tweens.add({ targets: c, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d + 60, alpha: 0, scale: 0.2, duration: 900 + Math.random() * 700, ease: 'Cubic.Out', onComplete: () => c.destroy() });
    }
    const ring = this.add.circle(cx, cy, 20, 0xffffff, 0).setStrokeStyle(10, 0xffffff, 1).setDepth(24);
    this.tweens.add({ targets: ring, scale: 18, alpha: 0, duration: 800, onComplete: () => ring.destroy() });
  }

  private advance() {
    if (this.advanced || performance.now() - this.doneAt < 800) return;
    this.advanced = true; useGame.getState().next();
  }

  update() {
    const now = performance.now(); const el = this.elapsed();
    if (this.stage === 'pause' && el >= PAUSE_MS) { this.stage = 'pump'; this.t0 = now; }
    else if (this.stage === 'pump' && el >= PUMP_MS) this.launch();
    else if (this.stage === 'launch') {
      this.rocketT = Math.min(1, el / 1100);
      const x = PAD.x, y = 600 + (this.apexY - 600) * (1 - Math.pow(1 - this.rocketT, 2.2));
      this.rocketY = y; this.trail.push({ x: x + (Math.random() - 0.5) * 10, y: y + 60, t0: now });
      if (this.rocketT >= 1) this.startCount();
    } else if (this.stage === 'done' && now - this.doneAt > AUTO_NEXT_MS) this.advance();
    this.handle = Math.max(0, this.handle - 0.12);
    this.trail = this.trail.filter(p => now - p.t0 < 500);
    this.draw(now);
  }

  // ── 그리기 ──────────────────────────────────────────────────
  private draw(now: number) {
    const g = this.g; g.clear();
    // 하늘과 풀밭
    for (let i = 0; i < 16; i++) { g.fillStyle(Phaser.Display.Color.GetColor(110 + i * 7, 190 + i * 3, 240), 1); g.fillRect(0, i * 50, 1280, 51); }
    g.fillStyle(0x6bbf59, 1); g.fillRect(0, 700, 1280, 100); g.fillStyle(0x58a84a, 1); g.fillRect(0, 700, 1280, 12);
    for (let i = 0; i < 5; i++) { const cx = (i * 330 + now / 60) % 1500 - 100; g.fillStyle(0xffffff, 0.9); g.fillEllipse(cx, 160 + (i % 3) * 70, 190, 56); g.fillEllipse(cx + 50, 140 + (i % 3) * 70, 120, 50); }
    this.drawTube(g);
    this.drawPump(g);
    this.drawPad(g);
    if (this.stage === 'pause' || this.stage === 'pump') this.drawRocket(g, 600, false);
    if (this.stage === 'launch' || this.stage === 'count' || this.stage === 'done') {
      for (const p of this.trail) { const k = (now - p.t0) / 500; g.fillStyle(0xffffff, 0.6 * (1 - k)); g.fillCircle(p.x, p.y + k * 40, 14 * (1 - k) + 4); }
      if (this.stage === 'launch') this.drawRocket(g, this.rocketY, true);
    }
    if (this.stage === 'pump') this.drawHint(g, now);
    if (this.stage !== 'pause' && this.elapsed() > SKIP_AFTER_MS && this.stage !== 'done') { g.fillStyle(0xffffff, 0.8); g.fillTriangle(1170, 720, 1170, 770, 1218, 745); }
  }

  private drawTube(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(14, 0x37474f, 1); g.beginPath(); g.moveTo(PUMP.x + 40, PUMP.y + 30); g.lineTo(PAD.x - 60, PAD.y + 40); g.strokePath();
    g.lineStyle(8, 0x78909c, 1); g.beginPath(); g.moveTo(PUMP.x + 40, PUMP.y + 30); g.lineTo(PAD.x - 60, PAD.y + 40); g.strokePath();
  }

  private drawPump(g: Phaser.GameObjects.Graphics) {
    const { x, y } = PUMP; const dip = this.handle * 60;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y + 62, 220, 28);
    g.fillStyle(0x455a64, 1); g.fillRoundedRect(x - 90, y + 30, 180, 30, 10);
    g.fillStyle(0xcfd8dc, 1); g.fillRoundedRect(x - 36, y - 120, 72, 160, 14); g.lineStyle(4, 0x78909c, 1); g.strokeRoundedRect(x - 36, y - 120, 72, 160, 14);
    g.fillStyle(0x90a4ae, 1); g.fillRect(x - 8, y - 200 + dip, 16, 110);
    g.fillStyle(0xe0513f, 1); g.fillRoundedRect(x - 80, y - 232 + dip, 160, 38, 16); g.lineStyle(4, 0x7f2a1f, 1); g.strokeRoundedRect(x - 80, y - 232 + dip, 160, 38, 16);
    g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(x - 64, y - 224 + dip, 128, 10, 5);
    // 압력 게이지: 누를수록 바늘이 오른다
    const gx = x, gy = y - 300, r = 54;
    g.fillStyle(0x546e7a, 1); g.fillCircle(gx, gy, r); g.fillStyle(0xffffff, 1); g.fillCircle(gx, gy, r - 7);
    const a = ((-120 + this.charge * 240) * Math.PI) / 180;
    g.lineStyle(6, 0xc0506a, 1); g.lineBetween(gx, gy, gx + Math.sin(a) * (r - 14), gy - Math.cos(a) * (r - 14));
    g.fillStyle(0x546e7a, 1); g.fillCircle(gx, gy, 7);
  }

  private drawPad(g: Phaser.GameObjects.Graphics) {
    const { x, y } = PAD;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y + 70, 200, 26);
    g.fillStyle(0x455a64, 1); g.fillRoundedRect(x - 80, y + 30, 160, 34, 10);
    g.fillStyle(0x78909c, 1); g.fillRect(x - 14, y + 4, 28, 30);
  }

  private drawRocket(g: Phaser.GameObjects.Graphics, y: number, flame: boolean) {
    const x = PAD.x;
    if (flame) { g.fillStyle(0xffd54f, 0.9); g.fillTriangle(x - 16, y + 66, x + 16, y + 66, x, y + 110 + Math.random() * 20); }
    g.fillStyle(0x2e86de, 1); g.fillRoundedRect(x - 26, y - 40, 52, 110, 22);                     // 몸통(페트병)
    g.fillStyle(0xffffff, 0.4); g.fillRoundedRect(x - 16, y - 30, 12, 80, 6);
    g.fillStyle(0xe0513f, 1); g.fillTriangle(x - 26, y - 34, x + 26, y - 34, x, y - 96);          // 머리
    g.fillStyle(0xf2b84a, 1); g.fillTriangle(x - 26, y + 40, x - 56, y + 76, x - 26, y + 70); g.fillTriangle(x + 26, y + 40, x + 56, y + 76, x + 26, y + 70);   // 날개
    g.lineStyle(4, 0x1b4f8f, 1); g.strokeRoundedRect(x - 26, y - 40, 52, 110, 22);
    g.fillStyle(0xcfefff, 1); g.fillCircle(x, y - 6, 12); g.lineStyle(3, 0x1b4f8f, 1); g.strokeCircle(x, y - 6, 12);
  }

  /** 글 없는 안내: 손잡이를 위아래로 누르는 손 모양 */
  private drawHint(g: Phaser.GameObjects.Graphics, now: number) {
    if (this.charge > 0.3) return;
    const off = (Math.sin(now / 160) + 1) * 28; const hx = PUMP.x + 40, hy = PUMP.y - 300 + off;
    const pts = [[0, 0], [0, 38], [9, 30], [16, 44], [23, 40], [16, 27], [28, 27]].map(([dx, dy]) => new Phaser.Math.Vector2(hx + dx, hy + dy));
    g.fillStyle(0xffffff, 1); g.lineStyle(3, 0x263238, 1); g.fillPoints(pts, true); g.strokePoints(pts, true);
    g.fillStyle(0xffffff, 0.95); g.fillTriangle(PUMP.x - 130, PUMP.y - 150, PUMP.x - 160, PUMP.y - 190, PUMP.x - 100, PUMP.y - 190);
  }
}
