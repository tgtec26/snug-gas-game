import * as Phaser from 'phaser';
import { GoalBanner } from '@/game/systems/goalBanner';
import { hiDpi, addBg, TEXT } from '@/game/systems/render';
import { attachRouter } from '@/game/systems/sceneRouter';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { playSfx } from '@/game/audio';
import { createShake, stepShake, BALL_R, type ShakeConfig, type ShakeState } from '@/game/shake';
import type { ShakeLayout } from '@/game/layout';

const MAX_FRAME_MS = 100;
const EASE_PER_SEC = 20;     // 병이 손가락을 따라가는 빠르기
const KEY_SWING = 110;       // 키보드 ←→ 한 번에 병이 옮겨 가는 거리
const SOUND_GAP_MS = 180;    // 충돌 소리가 겹치지 않게
const LOCK_MS = 1000;        // 카드가 뜬 뒤 입력 잠금

/** 구슬 흔들기 튜토리얼(199쪽): 병을 좌우로 흔들면 구슬이 벽에 부딪혀 손바닥 힘 게이지가 오른다. 규칙은 game/shake.ts. */
export class ShakeScene extends Phaser.Scene {
  private cfg!: ShakeConfig;
  private L!: ShakeLayout;
  private st!: ShakeState;
  private g!: Phaser.GameObjects.Graphics;
  private target = 0;
  private grab: number | null = null;     // 병을 잡은 위치와 병 중심의 차
  private lastKey: 'L' | 'R' | null = null;
  private lastTick = 0;
  private lastSound = 0;
  private lastAct = 0;
  private shownGauge = 0;
  private flashes: { x: number; y: number; t0: number }[] = [];
  private doneAt = 0;
  private card: Phaser.GameObjects.Container | null = null;
  private balls: Phaser.GameObjects.Image[] = [];
  private sp!: { bottle: Phaser.GameObjects.Image; gauge: Phaser.GameObjects.Image };
  private goal!: GoalBanner;

  constructor() { super({ key: 'Shake' }); }

  create() {
    hiDpi(this);
    addBg(this, 'exam_bg', 'exam_bg_ph');
    attachRouter(this);
    const data = useDataStore.getState();
    if (!data.minigame || !data.layout) { this.scene.start('Backdrop'); return; }
    this.cfg = data.minigame.shake; this.L = data.layout.shake;
    this.st = createShake(this.cfg, this.L.bottle);
    this.target = this.L.bottle.x; this.grab = null; this.lastKey = null; this.flashes = []; this.doneAt = 0; this.card = null; this.shownGauge = 0;
    this.lastTick = performance.now(); this.lastAct = performance.now(); this.lastSound = 0;
    this.g = this.add.graphics().setDepth(10);
    this.balls = Array.from({ length: this.cfg.balls }, () => this.add.image(0, 0, 'sp_ball').setDepth(11));
    this.sp = { bottle: this.add.image(0, 0, 'sp_bottle').setDepth(12), gauge: this.add.image(0, 0, 'sp_gauge').setDepth(9) };
    this.goal = new GoalBanner(this); this.goal.set(data.dialog?.goals.tutorial ?? '');

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.release, this);
    this.input.on('pointerupoutside', this.release, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.release, this);

    // 키보드: ←→를 번갈아 눌러 흔든다. 자동 반복(e.repeat)과 같은 키 연타는 무시.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (this.doneAt) { if (e.key === 'Enter' || e.key === ' ') this.advance(); return; }
      const side = e.key === 'ArrowLeft' ? 'L' : e.key === 'ArrowRight' ? 'R' : null;
      if (!side) return;
      e.preventDefault();
      if (side === this.lastKey) return;
      this.lastKey = side; this.lastAct = performance.now();
      this.target = this.L.bottle.x + (side === 'L' ? -KEY_SWING : KEY_SWING);
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', onKey);
      this.game.events.off(Phaser.Core.Events.BLUR, this.release, this);
    });
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.doneAt) { this.advance(); return; }
    const b = this.L.bottle;
    if (Math.abs(p.worldX - this.st.bottleX) < b.w / 2 + 50 && p.worldY > b.y - b.h - 90 && p.worldY < b.y + 30) {
      this.grab = this.st.bottleX - p.worldX; this.lastAct = performance.now();
    }
  }
  private onMove(p: Phaser.Input.Pointer) {
    if (this.grab === null || this.doneAt) return;
    const b = this.L.bottle;
    this.target = Phaser.Math.Clamp(p.worldX + this.grab, b.minX, b.maxX); this.lastAct = performance.now();
  }
  private release() { this.grab = null; }

  /** 카드가 뜬 뒤 입력 잠금이 지나면 대기실로 */
  private advance() {
    if (performance.now() - this.doneAt < LOCK_MS) return;
    useGame.getState().next();
  }

  update() {
    if (!this.st) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTick, MAX_FRAME_MS); this.lastTick = now;   // Phaser delta는 느린 프레임에서 보정되므로 시계를 직접 읽는다
    const b = this.L.bottle;
    const x = this.st.bottleX + (this.target - this.st.bottleX) * Math.min(1, (dt / 1000) * EASE_PER_SEC);
    const r = stepShake(this.cfg, b, this.st, Phaser.Math.Clamp(x, b.minX, b.maxX), dt / 1000);
    this.st = this.doneAt ? { ...r.state, gauge: 1 } : r.state;
    if (!this.doneAt) {
      for (const h of r.hits.slice(0, 10)) this.flashes.push({ x: h.x, y: h.y, t0: now });
      if (r.hits.length && now - this.lastSound > SOUND_GAP_MS) { this.lastSound = now; playSfx('collide'); }
      if (this.st.gauge >= 1) this.complete();
    }
    this.flashes = this.flashes.filter(f => now - f.t0 < 220).slice(-40);
    this.shownGauge += (this.st.gauge - this.shownGauge) * Math.min(1, dt / 120);
    this.draw(now);
  }

  private complete() {
    this.doneAt = performance.now(); this.grab = null; this.goal.set('');
    playSfx('fanfare'); this.cameras.main.flash(200, 255, 255, 255, true); this.cameras.main.shake(180, 0.006);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2; const d = 120 + Math.random() * 160;
      const c = this.add.circle(this.L.gauge.x, this.L.gauge.y + this.L.gauge.h / 2, 6 + Math.random() * 6, [0xffe28a, 0xffffff, 0x8fe3c0][i % 3]).setDepth(40);
      this.tweens.add({ targets: c, x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 700 + Math.random() * 400, onComplete: () => c.destroy() });
    }
    const t = useDataStore.getState().dialog?.tutorial; if (!t) return;
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.25); panel.fillRoundedRect(-340, -120, 700, 260, 28);
    panel.fillStyle(0xfffaf0, 1); panel.fillRoundedRect(-350, -130, 700, 260, 28); panel.lineStyle(6, 0xf2b84a, 1); panel.strokeRoundedRect(-350, -130, 700, 260, 28);
    const stamp = this.add.container(-210, 0);
    const sg = this.add.graphics(); sg.fillStyle(0xffe3ea, 1); sg.fillCircle(0, 0, 84); sg.lineStyle(8, 0xd23a5d, 1); sg.strokeCircle(0, 0, 84); stamp.add(sg);
    stamp.add(this.add.text(0, 0, t.card, { ...TEXT, fontSize: '32px', fontStyle: 'bold', color: '#d23a5d', align: 'center', wordWrap: { width: 130 } }).setOrigin(0.5));
    const line = this.add.text(70, 0, t.line, { ...TEXT, fontSize: '30px', color: '#3a2d1f', wordWrap: { width: 380 }, lineSpacing: 10 }).setOrigin(0.5);
    const arrow = this.add.graphics(); arrow.fillStyle(0xf2b84a, 1); arrow.fillTriangle(280, 80, 280, 120, 318, 100);
    this.tweens.add({ targets: arrow, x: 10, duration: 450, yoyo: true, repeat: -1 });
    this.card = this.add.container(640, 360, [panel, stamp, line, arrow]).setDepth(30).setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: this.card, scale: 1, alpha: 1, duration: 320, ease: 'Back.Out' });
    stamp.setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 260, delay: 340, ease: 'Back.In', onComplete: () => { playSfx('stamp'); this.cameras.main.shake(120, 0.005); } });
  }

  // ── 그리기 ──────────────────────────────────────────────────
  private draw(now: number) {
    const g = this.g; const b = this.L.bottle; const x = this.st.bottleX; g.clear();
    // 병 그림자
    g.fillStyle(0x000000, 0.22); g.fillEllipse(x, b.y + 16, b.w + 50, 30);
    // 병은 그림(투명한 페트병이 구슬 위로 겹친다), 구슬은 그림 20개
    // 그림의 병 안쪽(어깨 아래 ~ 바닥 굴곡 위)이 물리 영역(b.w × b.h)과 맞도록 키운다
    const H = b.h / 0.68; const imgTop = b.y - 0.93 * H;
    this.sp.bottle.setPosition(x, imgTop + H / 2).setDisplaySize(H * (151 / 355), H);
    this.balls.forEach((im, i) => { const p = this.st.balls[i]; im.setVisible(!!p); if (p) im.setPosition(p.x, p.y).setDisplaySize(BALL_R * 2.3, BALL_R * 2.3); });
    // 충돌 섬광
    for (const f of this.flashes) {
      const k = (now - f.t0) / 220;
      g.lineStyle(3, 0xffffff, 1 - k); g.strokeCircle(f.x, f.y, 8 + 14 * k);
      g.fillStyle(0xfff3a8, 0.7 * (1 - k)); g.fillCircle(f.x, f.y, 7 * (1 - k));
    }
    this.drawGauge(g, now);
    if (!this.doneAt && now - this.lastAct > 3500 && this.grab === null) this.drawHint(g, now);
    if (this.grab !== null) { g.lineStyle(5, 0xffc933, 0.6 + 0.3 * Math.sin(now / 150)); g.strokeRoundedRect(x - b.w / 2 - 6, b.y - b.h - 6, b.w + 12, b.h + 12, 26); }
  }

  /** 손바닥 힘 게이지: 막대가 차오르고 위쪽에 손바닥이 있다 */
  /** 압력 계기: 구슬이 벽에 세게 부딪힐수록 바늘이 오른다(압력 증가). 가득 차면 완료. */
  private drawGauge(g: Phaser.GameObjects.Graphics, now: number) {
    const { x, y, w, h } = this.L.gauge; const k = this.shownGauge;
    const size = Math.max(w, h * 0.7); const cx = x, cy = y + h / 2; const r = size / 2;
    g.fillStyle(0x000000, 0.2); g.fillEllipse(cx, cy + r * 1.35, r * 1.8, 26);
    this.sp.gauge.setPosition(cx, cy - r + (size * 1.228) / 2).setDisplaySize(size, size * 1.228);
    g.lineStyle(4, 0x546e7a, 1);
    for (let i = 0; i <= 10; i++) {
      const a = ((-120 + (i / 10) * 240) * Math.PI) / 180; const r1 = r * 0.5, r2 = r * (i % 5 === 0 ? 0.68 : 0.62);
      g.lineBetween(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1, cx + Math.sin(a) * r2, cy - Math.cos(a) * r2);
    }
    const shake = k > 0.85 ? Math.sin(now / 35) * 2 : 0;
    const na = ((-120 + k * 240) * Math.PI) / 180;
    g.lineStyle(8, k < 0.8 ? 0xc0506a : 0xe0513f, 1); g.lineBetween(cx, cy, cx + Math.sin(na) * (r * 0.62) + shake, cy - Math.cos(na) * (r * 0.62));
    g.fillStyle(0x546e7a, 1); g.fillCircle(cx, cy, 10);
  }

  /** 글 없는 안내: 병 위에서 좌우로 움직이는 손 모양과 화살표 */
  private drawHint(g: Phaser.GameObjects.Graphics, now: number) {
    const b = this.L.bottle; const sw = Math.sin(now / 280) * 70; const hx = this.st.bottleX + sw, hy = b.y - b.h / 2;
    g.lineStyle(6, 0xffffff, 0.95);
    g.lineBetween(this.st.bottleX - 110, hy - 70, this.st.bottleX + 110, hy - 70);
    g.fillStyle(0xffffff, 0.95); g.fillTriangle(this.st.bottleX - 130, hy - 70, this.st.bottleX - 100, hy - 88, this.st.bottleX - 100, hy - 52); g.fillTriangle(this.st.bottleX + 130, hy - 70, this.st.bottleX + 100, hy - 88, this.st.bottleX + 100, hy - 52);
    const pts = [[0, 0], [0, 38], [9, 30], [16, 44], [23, 40], [16, 27], [28, 27]].map(([dx, dy]) => new Phaser.Math.Vector2(hx + dx, hy + dy - 40));
    g.fillStyle(0xffffff, 1); g.lineStyle(3, 0x263238, 1); g.fillPoints(pts, true); g.strokePoints(pts, true);
  }
}

