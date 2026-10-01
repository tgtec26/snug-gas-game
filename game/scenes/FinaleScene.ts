import * as Phaser from 'phaser';
import { hiDpi, TEXT, OUTLINE } from '@/game/systems/render';
import { attachRouter } from '@/game/systems/sceneRouter';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { summarize } from '@/game/summary';
import { playSfx } from '@/game/audio';
import { GoalBanner } from '@/game/systems/goalBanner';

type Stage = 'pause' | 'pump' | 'launch' | 'count' | 'done';

const SKIP_AFTER_MS = 1000; // 잠금이 풀린 뒤부터 건너뛸 수 있다

/** 에어 로켓 피날레(6-8): 펌프 연타 → 로켓이 위쪽 하늘로 발사 → 빛 폭발·팡파르 → 별 카운트업 → 요약 팝업. 원리는 글로 설명하지 않는 연출. */
export class FinaleScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private goal!: GoalBanner;
  private sp!: Record<'pumpbody' | 'pumphandle' | 'gauge' | 'pad' | 'rocket', Phaser.GameObjects.Image>;
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
  private PAUSE_MS = 600;
  private PUMP_MS = 2200;
  private PRESS_GAIN = 0.12;
  private AUTO_NEXT_MS = 2200;
  private PUMP = { x: 470, y: 690 };
  private PAD = { x: 800, y: 660 };

  constructor() { super({ key: 'Finale' }); }

  create() {
    hiDpi(this);
    attachRouter(this);
    this.add.image(640, 400, 'finale_bg').setDisplaySize(1280, 800).setDepth(0);
    this.g = this.add.graphics().setDepth(5);
    this.goal = new GoalBanner(this);
    this.sp = {
      pumpbody: this.add.image(0, 0, 'sp_pumpbody').setDepth(4), pumphandle: this.add.image(0, 0, 'sp_pumphandle').setDepth(4),
      gauge: this.add.image(0, 0, 'sp_gauge').setDepth(4), pad: this.add.image(0, 0, 'sp_pad').setDepth(4), rocket: this.add.image(0, 0, 'sp_rocket').setDepth(4),
    };
    this.stage = 'pause'; this.t0 = performance.now(); this.charge = 0; this.handle = 0; this.rocketT = 0; this.trail = [];
    this.shown = { stars: 0 }; this.doneAt = 0; this.advanced = false; this.lastKeyAt = 0;

    const data = useDataStore.getState(); const s = useGame.getState(); const patients = data.patients;
    if (data.minigame) { const f = data.minigame.finale; this.PAUSE_MS = f.pauseMs; this.PUMP_MS = f.pumpMs; this.PRESS_GAIN = f.pressGain; this.AUTO_NEXT_MS = f.autoNextMs; }
    if (data.layout) { this.PUMP = data.layout.finale.pump; this.PAD = data.layout.finale.pad; }
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
      if (Math.hypot(p.worldX - this.PUMP.x, p.worldY - (this.PUMP.y - 150)) < 130) { this.press(); return; }
    }
    if (p.worldX > 1100 && p.worldY > 690) this.skip();
    else if (this.stage === 'done') this.advance();
  }

  /** 펌프 손잡이를 한 번 누른다 */
  private press() {
    const now = performance.now();
    if (this.stage !== 'pump' || now - this.lastKeyAt < 40) return;
    this.lastKeyAt = now;
    this.charge = Math.min(1, this.charge + this.PRESS_GAIN); this.handle = 1;
    playSfx('correct', 0.9 + this.charge * 0.5);
    for (let i = 0; i < 4; i++) {
      const c = this.add.circle(this.PAD.x - 30 + Math.random() * 60, this.PAD.y + 30, 5, 0xffffff, 0.8).setDepth(8);
      this.tweens.add({ targets: c, y: c.y - 40 - Math.random() * 40, alpha: 0, duration: 400, onComplete: () => c.destroy() });
    }
    if (this.charge >= 1) this.launch();
  }

  private skip() {
    if (this.elapsed() < this.PAUSE_MS + SKIP_AFTER_MS) return;
    if (this.stage === 'pump') { this.charge = Math.max(this.charge, 0.6); this.launch(); }
    else if (this.stage === 'launch' || this.stage === 'count') this.startCount(true);
    else if (this.stage === 'done') this.advance();
  }

  private launch() {
    if (this.stage !== 'pump') return;
    this.stage = 'launch'; this.t0 = performance.now(); this.rocketT = 0;
    this.apexY = 330 - this.charge * 240;   // 많이 누를수록 높이 올라간다 (항상 위쪽 하늘로)
    playSfx('launch');
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
    if (!quiet) playSfx('fanfare');
    const cx = this.PAD.x + 60 * 0, cy = Math.max(this.apexY, 100);
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
    if (this.stage === 'pause' && el >= this.PAUSE_MS) { this.stage = 'pump'; this.t0 = now; }
    else if (this.stage === 'pump' && el >= this.PUMP_MS) this.launch();
    else if (this.stage === 'launch') {
      this.rocketT = Math.min(1, el / 1100);
      const x = this.PAD.x, y = 600 + (this.apexY - 600) * (1 - Math.pow(1 - this.rocketT, 2.2));
      this.rocketY = y; this.trail.push({ x: x + (Math.random() - 0.5) * 10, y: y + 60, t0: now });
      if (this.rocketT >= 1) this.startCount();
    } else if (this.stage === 'done' && now - this.doneAt > this.AUTO_NEXT_MS) this.advance();
    this.handle = Math.max(0, this.handle - 0.12);
    this.trail = this.trail.filter(p => now - p.t0 < 500);
    this.draw(now);
  }

  // ── 그리기 ──────────────────────────────────────────────────
  private draw(now: number) {
    const g = this.g; g.clear();
    this.drawTube(g);
    this.drawPump(g);
    this.drawPad(g);
    this.sp.rocket.setVisible(false);
    this.goal.set(this.stage === 'pump' || this.stage === 'pause' ? (useDataStore.getState().dialog?.goals.finale ?? '') : '');
    if (this.stage === 'pause' || this.stage === 'pump') this.drawRocket(g, 600, false);
    if (this.stage === 'launch' || this.stage === 'count' || this.stage === 'done') {
      for (const p of this.trail) { const k = (now - p.t0) / 500; g.fillStyle(0xffffff, 0.6 * (1 - k)); g.fillCircle(p.x, p.y + k * 40, 14 * (1 - k) + 4); }
      if (this.stage === 'launch') this.drawRocket(g, this.rocketY, true);
    }
    if (this.stage === 'pump') this.drawHint(g, now);
    if (this.stage !== 'pause' && this.elapsed() > SKIP_AFTER_MS && this.stage !== 'done') { g.fillStyle(0xffffff, 0.8); g.fillTriangle(1170, 720, 1170, 770, 1218, 745); }
  }

  private drawTube(g: Phaser.GameObjects.Graphics) {
    g.lineStyle(14, 0x37474f, 1); g.beginPath(); g.moveTo(this.PUMP.x + 40, this.PUMP.y + 30); g.lineTo(this.PAD.x - 60, this.PAD.y + 40); g.strokePath();
    g.lineStyle(8, 0x78909c, 1); g.beginPath(); g.moveTo(this.PUMP.x + 40, this.PUMP.y + 30); g.lineTo(this.PAD.x - 60, this.PAD.y + 40); g.strokePath();
  }

  private drawPump(g: Phaser.GameObjects.Graphics) {
    const { x, y } = this.PUMP; const dip = this.handle * 60;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y + 62, 220, 28);
    this.sp.pumpbody.setPosition(x, y + 62 - 113).setDisplaySize(190, 226);
    this.sp.pumphandle.setPosition(x, y - 238 + dip + 110).setDisplaySize(160, 220);
    // 압력 게이지: 누를수록 바늘이 오른다
    const gx = x, gy = y - 300, r = 54;
    this.sp.gauge.setPosition(gx, gy - r + (r * 2 * 1.228) / 2).setDisplaySize(r * 2, r * 2 * 1.228);
    const a = ((-120 + this.charge * 240) * Math.PI) / 180;
    g.lineStyle(6, 0xc0506a, 1); g.lineBetween(gx, gy, gx + Math.sin(a) * (r - 14), gy - Math.cos(a) * (r - 14));
    g.fillStyle(0x546e7a, 1); g.fillCircle(gx, gy, 7);
  }

  private drawPad(g: Phaser.GameObjects.Graphics) {
    const { x, y } = this.PAD;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y + 70, 200, 26);
    this.sp.pad.setPosition(x, y + 66 - 55).setDisplaySize(190, 110);
  }

  private drawRocket(g: Phaser.GameObjects.Graphics, y: number, flame: boolean) {
    const x = this.PAD.x;
    if (flame) { g.fillStyle(0xffd54f, 0.9); g.fillTriangle(x - 16, y + 66, x + 16, y + 66, x, y + 110 + Math.random() * 20); }
    this.sp.rocket.setVisible(true).setPosition(x, y - 10).setDisplaySize(116, 190);
  }

  /** 글 없는 안내: 손잡이를 위아래로 누르는 손 모양 */
  private drawHint(g: Phaser.GameObjects.Graphics, now: number) {
    if (this.charge > 0.3) return;
    const off = (Math.sin(now / 160) + 1) * 28; const hx = this.PUMP.x + 40, hy = this.PUMP.y - 300 + off;
    const pts = [[0, 0], [0, 38], [9, 30], [16, 44], [23, 40], [16, 27], [28, 27]].map(([dx, dy]) => new Phaser.Math.Vector2(hx + dx, hy + dy));
    g.fillStyle(0xffffff, 1); g.lineStyle(3, 0x263238, 1); g.fillPoints(pts, true); g.strokePoints(pts, true);
    g.fillStyle(0xffffff, 0.95); g.fillTriangle(this.PUMP.x - 130, this.PUMP.y - 150, this.PUMP.x - 160, this.PUMP.y - 190, this.PUMP.x - 100, this.PUMP.y - 190);
  }
}
