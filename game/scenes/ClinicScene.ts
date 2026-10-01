import * as Phaser from 'phaser';
import { hiDpi, addBg, TEXT, OUTLINE } from '@/game/systems/render';
import { attachRouter } from '@/game/systems/sceneRouter';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { playSfx } from '@/game/audio';
import {
  createExam, movePiston, moveTemp, resetDevice, tickExam, examResult, type ExamState, type ExamEvent,
} from '@/game/exam';
import { checkPistonRun, deviceVolume, heldConstant, needleFromVolume, pressureReading, stepTargetVolume, badgeText } from '@/game/rules';
import { LensView } from '@/game/systems/lens';
import { inEmergency, roundBlocked, comboRate } from '@/game/systems/emergencyRound';
import type { Experiments, Patient } from '@/game/types';
import type { ClinicLayout } from '@/game/layout';

const VOL_PAD_LOW = 4;   // 주사기 그림의 부피 눈금 아래 여유
const VOL_PAD_HIGH = 2;  // 위 여유
const NEEDLE_MAX = 1.8;  // 압력 센서 바늘 상대 높이의 화면 매핑 범위(기준 1이 12시 방향). 숫자로 표시하지 않는다.
const ANGLE = 120;
const MAX_FRAME_MS = 200;

const lerpColor = (a: number, b: number, t: number) => {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.IntegerToColor(a), Phaser.Display.Color.IntegerToColor(b), 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

/** 물 색: 차가움(파랑) - 보통(옅은 하늘) - 뜨거움(주황). t=0.5가 원점이다. 중간 색이 탁해지지 않게 3단계로 섞는다. */
const waterColorAt = (t: number, surface = false) => {
  const cold = surface ? 0x9fd7f6 : 0x3f9de0, mid = surface ? 0xd6f1fb : 0x8fd6ee, hot = surface ? 0xffc2a0 : 0xef6f4a;
  return t < 0.5 ? lerpColor(cold, mid, t * 2) : lerpColor(mid, hot, (t - 0.5) * 2);
};

/** 검사 장치: 피스톤·온도 다이얼·압력 센서·온도계. 판정은 game/exam.ts, 과학 계산은 game/rules.ts가 하고 여기는 그리기와 입력만 한다. */
export class ClinicScene extends Phaser.Scene {
  private cfg!: Experiments;
  private patient!: Patient;
  private L!: ClinicLayout;
  private st!: ExamState;
  private limitMs = 60000;
  private hintIdleMs = 4000;
  private holdFinishMs = 900;
  private g!: Phaser.GameObjects.Graphics;
  private ghostImg!: Phaser.GameObjects.Image;
  private previewImg!: Phaser.GameObjects.Image;
  private badgeTemp!: Phaser.GameObjects.Text;
  private badgePress!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private hintUntil = 0;
  private drag: { kind: 'piston'; dy: number } | { kind: 'dial' } | null = null;
  private lastActionAt = 0;
  private shake: { piston: number; dial: number } = { piston: 0, dial: 0 };
  private finishing = false;
  private lastTick = 0;
  private finishTimer: number | null = null;
  private popAt: Record<number, number> = {};
  private lastPistonVol = 0;
  private lastPistonSound = 0;
  private lens!: LensView;
  private stepStartAt = 0;

  constructor() { super({ key: 'Clinic' }); }

  create() {
    hiDpi(this);
    addBg(this, 'exam_bg', 'exam_bg_ph');
    attachRouter(this);

    const data = useDataStore.getState();
    const id = useGame.getState().currentId;
    const patient = data.patients.find(p => p.id === id);
    if (!patient || !data.experiments || !data.layout || !data.minigame) { this.scene.start('Backdrop'); return; }
    this.patient = patient; this.cfg = data.experiments; this.L = data.layout.clinic;
    this.limitMs = data.minigame.examTimeLimitMs; this.hintIdleMs = data.minigame.hintIdleMs; this.holdFinishMs = data.minigame.successHoldMs;
    this.st = createExam(this.cfg, patient); this.lastPistonVol = this.cfg.syringe.start;
    this.lastActionAt = performance.now(); this.lastTick = performance.now();
    this.finishing = false; this.stepStartAt = performance.now(); this.popAt = {}; this.drag = null; this.shake = { piston: 0, dial: 0 };

    this.g = this.add.graphics().setDepth(10);
    const key = `patient_${patient.id}_ph`;
    const p = this.L.patient;
    this.ghostImg = this.add.image(p.x, p.y, key).setDepth(9).setTint(0x1b2a33).setTintMode(Phaser.TintModes.FILL).setAlpha(0.28);
    this.previewImg = this.add.image(p.x, p.y, key).setDepth(11);
    const t = (color: string) => this.add.text(0, 0, '', { ...TEXT, ...OUTLINE, fontSize: '22px', fontStyle: 'bold', color }).setDepth(20).setOrigin(0.5);
    this.badgeTemp = t('#ffe28a'); this.badgePress = t('#ffe28a');
    this.hintText = this.add.text(640, 70, '', { ...TEXT, ...OUTLINE, fontSize: '26px', fontStyle: 'bold', color: '#ffffff' }).setDepth(30).setOrigin(0.5).setAlpha(0);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.endDrag, this);
    this.input.on('pointerupoutside', this.endDrag, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.endDrag, this);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.endDrag, this);
      if (this.finishTimer !== null) { window.clearTimeout(this.finishTimer); this.finishTimer = null; }
    });

    // 키보드는 Phaser 키 큐 대신 네이티브 keydown을 쓴다: 프레임이 느릴 때 Phaser가 같은 키를 두 번 내보내는 경우가 있었다.
    // 키 자동 반복(e.repeat)은 무시한다.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); this.nudgePiston(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.nudgePiston(-1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.nudgeTemp(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.nudgeTemp(1); }
      else if (e.key === 'r' || e.key === 'R') this.reset();
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    this.lens = new LensView(this, {
      icon: this.L.lens, view: this.L.lensView, zone: this.L.lensZone, cfg: this.cfg,
      rules: data.particleRules, count: data.minigame.particleCount,
      getDevice: () => ({ device: this.st.device, used: this.st.used }),
      onObserved: () => { playSfx('correct'); this.sparkle(this.L.lensView.x + this.L.lensView.w / 2, this.L.lensView.y + 40, 12); },
    });
    this.draw();
  }

  // ── 좌표 변환 ────────────────────────────────────────────────
  private vAxis() { return { lo: this.cfg.syringe.min - VOL_PAD_LOW, hi: this.cfg.syringe.max + VOL_PAD_HIGH }; }
  private headY(volume: number) {
    const { lo, hi } = this.vAxis(); const b = this.L.barrel;
    return b.bottom - ((volume - lo) / (hi - lo)) * (b.bottom - b.top);
  }
  private volumeAtHeadY(y: number) {
    const { lo, hi } = this.vAxis(); const b = this.L.barrel;
    return lo + ((b.bottom - y) / (b.bottom - b.top)) * (hi - lo);
  }
  private handleCY(volume: number) { return this.headY(volume) - this.L.piston.rod; }
  /** 압력 센서 바늘 각도. n은 상대 높이(1이 기준)이며 숫자로 표시하지 않는다. */
  private angleOfReading(n: number) {
    // 반비례라 부피가 절반이면 값이 2배: 로그 눈금으로 펴서 기준(1)을 12시, 누르면 오른쪽, 당기면 왼쪽으로 놓는다.
    const v = Math.min(1, Math.max(0, 0.5 + (0.5 * Math.log(n)) / Math.log(NEEDLE_MAX)));
    return -ANGLE + v * 2 * ANGLE;
  }
  /** 목표 부피에 해당하는 압력 읽음(목표 눈금 표시용: 압력을 바꿔서 그 부피가 될 때의 바늘 위치) */
  private targetAngle(volume: number) { return this.angleOfReading(needleFromVolume(volume, this.cfg.syringe.start)); }
  private tempToAngle(step: number) {
    const { minStep, maxStep } = this.cfg.temp;
    return -ANGLE + ((step - minStep) / (maxStep - minStep)) * 2 * ANGLE;
  }
  private angleToTemp(deg: number) {
    const { minStep, maxStep } = this.cfg.temp;
    const d = Math.max(-ANGLE, Math.min(ANGLE, deg));
    return minStep + ((d + ANGLE) / (2 * ANGLE)) * (maxStep - minStep);
  }

  // ── 입력 ────────────────────────────────────────────────────
  private locked(variable: 'pressure' | 'temperature') {
    return heldConstant(this.cfg, this.st.device) === variable || (variable === 'temperature' && !this.st.tempOpen);
  }
  /** 조작이 있었음을 기록한다. 한 줄 힌트는 조작이 이어져도 읽을 수 있게 시간이 지나야 꺼진다. */
  private act() { this.lastActionAt = performance.now(); }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.st.done || roundBlocked()) return;
    const L = this.L; const x = p.worldX, y = p.worldY;
    const rs = L.reset;
    if (Math.hypot(x - rs.x, y - rs.y) < 48) { this.reset(); return; }
    const vol = deviceVolume(this.cfg, this.st.device);
    const hy = this.handleCY(vol); const hit = L.piston.hit;
    if (Math.abs(x - L.barrel.x) < hit / 2 && Math.abs(y - hy) < hit * 0.32) {
      if (this.locked('pressure')) { this.shake.piston = performance.now() + 350; playSfx('error'); return; }
      this.drag = { kind: 'piston', dy: hy - y }; this.act(); return;
    }
    const d = L.dial;
    if (Math.hypot(x - d.x, y - d.y) < d.r + 28) {
      if (this.locked('temperature')) { this.shake.dial = performance.now() + 350; playSfx('error'); return; }
      this.drag = { kind: 'dial' }; this.act(); this.onMove(p);
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (!this.drag || this.st.done) return;
    if (this.drag.kind === 'piston') {
      const cy = p.worldY + this.drag.dy;
      this.st = movePiston(this.cfg, this.st, this.volumeAtHeadY(cy + this.L.piston.rod));
    } else {
      const d = this.L.dial;
      const deg = (Math.atan2(p.worldX - d.x, -(p.worldY - d.y)) * 180) / Math.PI;
      this.st = moveTemp(this.cfg, this.st, this.angleToTemp(deg));
    }
    this.act();
  }

  private endDrag() { this.drag = null; }

  private nudgePiston(dir: number) {
    if (this.st.done || roundBlocked()) return;
    if (this.locked('pressure')) { this.shake.piston = performance.now() + 350; playSfx('error'); return; }
    this.st = movePiston(this.cfg, this.st, this.st.device.piston + dir); this.act();
  }
  private nudgeTemp(dir: number) {
    if (this.st.done || roundBlocked()) return;
    if (this.locked('temperature')) { this.shake.dial = performance.now() + 350; playSfx('error'); return; }
    this.st = moveTemp(this.cfg, this.st, this.st.device.tempStep + dir); this.act();
  }
  private reset() { if (!this.st.done && !roundBlocked()) { this.st = resetDevice(this.cfg, this.st); this.drag = null; this.hintText.setAlpha(0); this.act(); } }

  // ── 진행 ────────────────────────────────────────────────────
  update() {
    if (!this.st) return;
    // Phaser가 넘기는 delta는 느린 프레임에서 목표 프레임(16.6ms)으로 보정되어 게임 시간이 실제보다 느리게 흐른다
    // (헤드리스 16fps에서 실제의 26%). "0.8초 머물기"가 실제 시간이 되도록 시계를 직접 읽는다.
    // 탭이 숨겨졌다 돌아올 때의 큰 간격만 자른다.
    const nowMs = performance.now();
    const dt = Math.min(nowMs - this.lastTick, MAX_FRAME_MS);
    this.lastTick = nowMs;
    const r = tickExam(this.cfg, this.patient, this.st, dt);
    this.st = r.state;
    for (const e of r.events) this.onEvent(e);
    this.draw();
    this.lens.update(dt);
    this.pistonSound();
  }

  /** 피스톤이 움직이는 동안 쉬익 소리(겹치지 않게 간격을 둔다) */
  private pistonSound() {
    const v = this.st.device.piston; const now = performance.now();
    if (v !== this.lastPistonVol) { this.lastPistonVol = v; if (now - this.lastPistonSound > 160) { this.lastPistonSound = now; playSfx('piston'); } }
  }

  private say(text: string, ms = 2200) {
    this.hintText.setText(text).setAlpha(1); this.hintUntil = performance.now() + ms;
  }

  private onEvent(e: ExamEvent) {
    const dlg = useDataStore.getState().dialog;
    if (e.type === 'wrong-gauge') {
      playSfx('error'); this.cameras.main.shake(140, 0.004);
      if (dlg) this.say(dlg.hints.wrongGauge);
    } else if (e.type === 'reading') {
      playSfx('tick'); this.popAt[e.volume] = performance.now();
      const y = this.headY(e.volume); this.sparkle(this.L.barrel.x + this.L.barrel.w / 2 + 14, y, 6);
    } else if (e.type === 'step-done') {
      this.stepStartAt = performance.now(); playSfx('correct'); this.cameras.main.flash(160, 255, 255, 255, true);
      this.tweens.add({ targets: this.previewImg, scale: this.previewImg.scale * 1.12, yoyo: true, duration: 140 });
      this.sparkle(this.L.patient.x, this.L.patient.y, 14);
    } else if (e.type === 'all-done' && !this.finishing) {
      this.finishing = true; playSfx('success', inEmergency() ? comboRate() : 1); this.sparkle(this.L.patient.x, this.L.patient.y, 26);
      this.finishTimer = window.setTimeout(() => {
        this.finishTimer = null;
        if (inEmergency()) { useGame.getState().recordRound(this.patient.id, true); return; }
        useGame.getState().completeExam(this.patient.id, examResult(this.st, this.patient, this.limitMs, this.patient.kind === 'measure' && checkPistonRun(this.cfg, this.st.readings).complete));
      }, this.holdFinishMs);
    }
  }

  private sparkle(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const d = 60 + Math.random() * 90;
      const c = this.add.circle(x, y, 5 + Math.random() * 5, [0xffe28a, 0xffffff, 0x8fe3c0][i % 3]).setDepth(40);
      this.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 600 + Math.random() * 300, onComplete: () => c.destroy() });
    }
  }

  // ── 그리기 (3/4 시점: 그림자, 원통의 타원 윗면, 앞뒤 겹침) ──────────────
  private draw() {
    const g = this.g; const L = this.L; const cfg = this.cfg; const st = this.st; const now = performance.now();
    g.clear();
    const vol = deviceVolume(cfg, st.device);
    const held = heldConstant(cfg, st.device);
    const b = L.barrel, bk = L.beaker;
    const waterT = (st.device.tempStep - cfg.temp.minStep) / (cfg.temp.maxStep - cfg.temp.minStep);
    const waterColor = waterColorAt(waterT);

    // 바닥 그림자
    g.fillStyle(0x000000, 0.22); g.fillEllipse(bk.x, bk.bottom + 12, bk.w + 70, 34);
    g.fillEllipse(L.dial.x, L.dial.y + L.dial.r * 0.55, L.dial.r * 2.4, 34);
    g.fillEllipse(L.gauge.x, L.gauge.y + L.gauge.size * 0.52, L.gauge.size * 0.9, 26);
    g.fillEllipse(L.thermo.x, L.thermo.y + L.thermo.h + 18, 70, 18);

    // 받침대 기둥
    g.fillStyle(0x78909c, 1); g.fillRect(bk.x - bk.w / 2 - 34, bk.top - 70, 14, bk.bottom - bk.top + 70 + 6);
    g.fillRoundedRect(bk.x - bk.w / 2 - 34, bk.top - 70, 100, 12, 6);

    // 통(비커): 뒷벽 → 물 → 앞 유리
    const ry = 22;
    g.fillStyle(0xdff3f7, 0.35); g.fillRect(bk.x - bk.w / 2, bk.top, bk.w, bk.bottom - bk.top);
    g.fillStyle(waterColor, 0.72); g.fillRect(bk.x - bk.w / 2 + 4, bk.top + 46, bk.w - 8, bk.bottom - bk.top - 46);
    g.fillEllipse(bk.x, bk.bottom, bk.w - 8, ry * 1.6);
    g.fillStyle(waterColorAt(waterT, true), 0.85); g.fillEllipse(bk.x, bk.top + 46, bk.w - 8, ry * 1.6);

    // 주사기 통: 뒤쪽 타원, 몸통, 기체
    const headY = this.headY(vol);
    g.fillStyle(0xeaf6fb, 0.55); g.fillRect(b.x - b.w / 2, b.top, b.w, b.bottom - b.top); g.fillEllipse(b.x, b.bottom, b.w, 18);
    g.fillStyle(0xbfe6f7, 0.75); g.fillRect(b.x - b.w / 2 + 4, headY, b.w - 8, b.bottom - headY); g.fillEllipse(b.x, b.bottom, b.w - 8, 14);
    g.lineStyle(3, 0x607d8b, 1); g.strokeRect(b.x - b.w / 2, b.top, b.w, b.bottom - b.top); g.strokeEllipse(b.x, b.top, b.w, 18);
    // 눈금 (숫자는 쓰지 않는다)
    g.lineStyle(2, 0x455a64, 0.9);
    for (let v = cfg.syringe.min; v <= cfg.syringe.max; v++) {
      const y = this.headY(v); const long = (v - cfg.syringe.min) % 4 === 0;
      g.lineBetween(b.x + b.w / 2, y, b.x + b.w / 2 + (long ? 16 : 9), y);
    }
    // 노즐과 관(압력 센서로)
    g.fillStyle(0x90a4ae, 1); g.fillRect(b.x - 7, b.bottom, 14, 18);
    g.lineStyle(7, 0x78909c, 1);
    const curve = new Phaser.Curves.CubicBezier(new Phaser.Math.Vector2(b.x, b.bottom + 18), new Phaser.Math.Vector2(b.x, b.bottom + 70), new Phaser.Math.Vector2(L.gauge.x - 40, L.gauge.y + L.gauge.size * 0.55 + 40), new Phaser.Math.Vector2(L.gauge.x, L.gauge.y + L.gauge.size * 0.5));
    curve.draw(g, 32);

    // 목표 모양 띠 (고스트): 이번 step의 목표 머리 높이
    const tv = stepTargetVolume(cfg, this.patient, st.stepIndex);
    const ty = this.headY(tv); const tol = this.headY(vol - cfg.tolerance) - this.headY(vol);
    const ghostAlpha = 0.65 + 0.3 * Math.sin(now / 260);
    g.lineStyle(4, 0xffc933, ghostAlpha);
    for (let x = b.x - b.w / 2 - 10; x < b.x + b.w / 2 + 10; x += 16) g.lineBetween(x, ty, Math.min(x + 9, b.x + b.w / 2 + 10), ty);
    g.fillStyle(0xffc933, 0.12); g.fillRect(b.x - b.w / 2 - 10, ty - Math.abs(tol), b.w + 20, Math.abs(tol) * 2);

    // 피스톤: 머리(원판) + 막대 + 손잡이. 집어 올리면 그림자가 멀어지고 커진다.
    const lift = this.drag?.kind === 'piston' ? 1 : 0;
    const shakeX = now < this.shake.piston ? Math.sin(now / 25) * 6 : 0;
    g.fillStyle(0x37474f, 1); g.fillEllipse(b.x, headY, b.w - 6, 16);
    g.fillStyle(0x546e7a, 1); g.fillRect(b.x - 5, headY - L.piston.rod, 10, L.piston.rod);
    const hcy = headY - L.piston.rod;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(b.x + shakeX + 10 + lift * 18, hcy + 34 + lift * 30, L.piston.handleW * (1 - lift * 0.12), 16);
    const hw = L.piston.handleW * (1 + lift * 0.08), hh = L.piston.handleH * (1 + lift * 0.08);
    const pLocked = held === 'pressure';   // 온도를 쓰는 중이면 압력이 일정하다: 피스톤이 잠긴다
    g.fillStyle(pLocked ? 0x8a9aa3 : 0xe0513f, 1); g.fillRoundedRect(b.x - hw / 2 + shakeX, hcy - hh / 2, hw, hh, 12);
    g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(b.x - hw / 2 + 8 + shakeX, hcy - hh / 2 + 5, hw - 16, 8, 4);
    g.lineStyle(3, 0x7f2a1f, pLocked ? 0.3 : 1); g.strokeRoundedRect(b.x - hw / 2 + shakeX, hcy - hh / 2, hw, hh, 12);

    // 비커 앞 유리 테두리(뒤 → 앞 겹침)
    g.lineStyle(4, 0x8fb7c2, 0.9); g.strokeEllipse(bk.x, bk.top, bk.w, ry * 2);
    g.lineBetween(bk.x - bk.w / 2, bk.top, bk.x - bk.w / 2, bk.bottom); g.lineBetween(bk.x + bk.w / 2, bk.top, bk.x + bk.w / 2, bk.bottom);
    g.beginPath();
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI; const px = bk.x + Math.cos(a) * (bk.w / 2), py = bk.bottom + Math.sin(a) * ry; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.strokePath();

    this.drawGauge(g);
    this.drawThermo(g);
    this.drawDial(g, held === 'temperature' || !st.tempOpen, now);
    if (this.st.snap) { this.drawReadMarks(g, now); this.drawGraph(g, now); }
    this.drawReset(g);
    this.updatePatient(vol, now);
    this.drawBadgesAndHand(g, held, now);
    if (this.hintText.alpha > 0 && now > this.hintUntil) this.hintText.setAlpha(0);
  }

  /** 눈금 읽기 표시: 읽은 눈금은 초록 점, 안 읽은 눈금은 노랗게 반짝, 머무는 눈금은 차오르는 고리 */
  private drawReadMarks(g: Phaser.GameObjects.Graphics, now: number) {
    const b = this.L.barrel; const m = this.cfg.measure; const x = b.x + b.w / 2 + 34;
    const cur = this.st.device.piston;
    for (let v = m.from; v >= m.to; v--) {
      const r = this.st.readings.find(q => q.volume === v);
      const read = !!r && r.dwellMs >= m.dwellMs; const y = this.headY(v);
      const pop = now - (this.popAt[v] ?? -1e9); const k = pop < 350 ? 1 + 0.7 * Math.sin((pop / 350) * Math.PI) : 1;
      if (read) { g.fillStyle(0x3fae6a, 1); g.fillCircle(x, y, 7 * k); g.lineStyle(2, 0x1f6b3d, 1); g.strokeCircle(x, y, 7 * k); }
      else { g.fillStyle(0xffc933, 0.45 + 0.4 * Math.sin(now / 240 + v)); g.fillCircle(x, y, 6); }
      if (v === cur && this.st.device.tempStep === 0 && !read && r) {
        g.lineStyle(4, 0x3fae6a, 1); g.beginPath();
        g.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + Math.min(1, r.dwellMs / m.dwellMs) * Math.PI * 2, false); g.strokePath();
      }
    }
  }

  /** 작은 그래프: 눈금을 읽을 때마다 점이 하나씩 찍힌다. 가로 = 부피 눈금, 세로 = 바늘의 상대 높이(수치 없음). */
  private drawGraph(g: Phaser.GameObjects.Graphics, now: number) {
    const { x, y, w, h } = this.L.graph; const m = this.cfg.measure;
    const lo = needleFromVolume(m.from, this.cfg.syringe.start), hi = needleFromVolume(m.to, this.cfg.syringe.start);
    const px = (v: number) => x + 22 + ((v - m.to) / (m.from - m.to)) * (w - 44);
    const py = (n: number) => y + h - 24 - ((n - lo) / (hi - lo)) * (h - 52);
    g.fillStyle(0x000000, 0.2); g.fillRoundedRect(x + 6, y + 8, w, h, 12);
    g.fillStyle(0xfdfcf7, 0.96); g.fillRoundedRect(x, y, w, h, 12); g.lineStyle(3, 0x546e7a, 1); g.strokeRoundedRect(x, y, w, h, 12);
    g.lineStyle(3, 0x546e7a, 1); g.lineBetween(x + 12, y + 12, x + 12, y + h - 12); g.lineBetween(x + 12, y + h - 12, x + w - 12, y + h - 12);
    const pts = this.st.readings.filter(r => r.dwellMs >= m.dwellMs).sort((a, b) => b.volume - a.volume)
      .map(r => ({ v: r.volume, X: px(r.volume), Y: py(needleFromVolume(r.volume, this.cfg.syringe.start)) }));
    if (pts.length > 1) {
      g.lineStyle(3, 0xc0506a, 0.5); g.beginPath(); g.moveTo(pts[0].X, pts[0].Y);
      for (const p of pts.slice(1)) g.lineTo(p.X, p.Y);
      g.strokePath();
    }
    for (const p of pts) {
      const pop = now - (this.popAt[p.v] ?? -1e9); const k = pop < 350 ? 1 + 0.9 * Math.sin((pop / 350) * Math.PI) : 1;
      g.fillStyle(0xc0506a, 1); g.fillCircle(p.X, p.Y, 6 * k); g.lineStyle(2, 0x6b1f30, 1); g.strokeCircle(p.X, p.Y, 6 * k);
    }
  }

  private drawGauge(g: Phaser.GameObjects.Graphics) {
    const { x, y, size } = this.L.gauge; const r = size / 2;
    g.fillStyle(0x546e7a, 1); g.fillCircle(x, y, r); g.fillStyle(0xffffff, 1); g.fillCircle(x, y, r - 10);
    g.lineStyle(3, 0xb0bec5, 1); g.strokeCircle(x, y, r - 10);
    g.lineStyle(4, 0x546e7a, 1);
    for (let i = 0; i <= 10; i++) {
      const a = ((-ANGLE + (i / 10) * 2 * ANGLE) * Math.PI) / 180;
      const r1 = r - 26, r2 = r - (i % 5 === 0 ? 14 : 19);
      g.lineBetween(x + Math.sin(a) * r1, y - Math.cos(a) * r1, x + Math.sin(a) * r2, y - Math.cos(a) * r2);
    }
    // 목표 눈금 고스트 (압력 환자만): 이번 step의 목표 바늘 위치
    if (this.patient.variable === 'pressure') {
      const ta = (this.targetAngle(stepTargetVolume(this.cfg, this.patient, this.st.stepIndex)) * Math.PI) / 180;
      const pulse = 0.65 + 0.3 * Math.sin(performance.now() / 260);
      g.fillStyle(0xffc933, pulse);
      g.fillTriangle(x + Math.sin(ta) * (r - 4), y - Math.cos(ta) * (r - 4), x + Math.sin(ta - 0.12) * (r - 24), y - Math.cos(ta - 0.12) * (r - 24), x + Math.sin(ta + 0.12) * (r - 24), y - Math.cos(ta + 0.12) * (r - 24));
    }
    const na = (this.angleOfReading(pressureReading(this.cfg, this.st.device)) * Math.PI) / 180;
    g.lineStyle(7, 0xc0506a, 1); g.lineBetween(x, y, x + Math.sin(na) * (r - 30), y - Math.cos(na) * (r - 30));
    g.fillStyle(0x546e7a, 1); g.fillCircle(x, y, 10);
  }

  private drawThermo(g: Phaser.GameObjects.Graphics) {
    const { x, y, h } = this.L.thermo; const cfg = this.cfg;
    g.fillStyle(0xeceff1, 1); g.fillRoundedRect(x - 14, y, 28, h, 14); g.fillCircle(x, y + h + 10, 24);
    g.lineStyle(4, 0x546e7a, 1); g.strokeRoundedRect(x - 14, y, 28, h, 14); g.strokeCircle(x, y + h + 10, 24);
    const t01 = (this.st.device.tempStep - cfg.temp.minStep) / (cfg.temp.maxStep - cfg.temp.minStep);
    const mh = 20 + t01 * (h - 40);
    g.fillStyle(0xe0513f, 1); g.fillCircle(x, y + h + 10, 15);
    g.fillRoundedRect(x - 6, y + h - mh, 12, mh + 6, 6);
    if (this.patient.variable === 'temperature') {
      const step = this.patient.steps[this.st.stepIndex];
      const ts = step.change === 'up' ? step.size : -step.size;
      const tt = (ts - cfg.temp.minStep) / (cfg.temp.maxStep - cfg.temp.minStep);
      const my = y + h - (20 + tt * (h - 40));
      g.fillStyle(0xffc933, 0.65 + 0.3 * Math.sin(performance.now() / 260));
      g.fillTriangle(x + 18, my, x + 40, my - 11, x + 40, my + 11);
    }
    for (let i = 0; i < 6; i++) { g.lineStyle(3, 0x546e7a, 1); g.lineBetween(x - 28, y + 20 + i * ((h - 40) / 5), x - 18, y + 20 + i * ((h - 40) / 5)); }
  }

  private drawDial(g: Phaser.GameObjects.Graphics, locked: boolean, now: number) {
    const { x, y, r } = this.L.dial;
    const sx = now < this.shake.dial ? Math.sin(now / 25) * 6 : 0;
    const lift = this.drag?.kind === 'dial' ? 1 : 0;
    const X = x + sx;
    g.fillStyle(0x455a64, 1); g.fillCircle(X, y + 8, r + 14);
    g.fillStyle(0x263238, 1); g.fillCircle(X, y, r + 10);
    // 눈금 호: 파랑(낮춤)에서 빨강(높임)까지
    for (let i = 0; i <= 16; i++) {
      const t = i / 16; const a = ((-ANGLE + t * 2 * ANGLE) * Math.PI) / 180;
      g.fillStyle(lerpColor(0x57b7e8, 0xe8684a, t), locked ? 0.35 : 1);
      g.fillCircle(X + Math.sin(a) * (r + 2), y - Math.cos(a) * (r + 2), 4.5);
    }
    g.fillStyle(locked ? 0x90a4ae : 0xeceff1, 1); g.fillCircle(X, y - lift * 4, r - 14);
    g.fillStyle(0xffffff, 0.35); g.fillCircle(X - 14, y - 16 - lift * 4, r - 40);
    const a = (this.tempToAngle(this.st.device.tempStep) * Math.PI) / 180;
    g.lineStyle(9, 0x37474f, 1); g.lineBetween(X, y - lift * 4, X + Math.sin(a) * (r - 22), y - Math.cos(a) * (r - 22) - lift * 4);
    g.fillStyle(0x37474f, 1); g.fillCircle(X, y - lift * 4, 9);
    if (this.patient.variable === 'temperature') {
      const step = this.patient.steps[this.st.stepIndex];
      const ts = step.change === 'up' ? step.size : -step.size;
      const ta = (this.tempToAngle(ts) * Math.PI) / 180;
      g.fillStyle(0xffc933, 0.65 + 0.3 * Math.sin(now / 260));
      g.fillTriangle(X + Math.sin(ta) * (r + 26), y - Math.cos(ta) * (r + 26), X + Math.sin(ta - 0.14) * (r + 50), y - Math.cos(ta - 0.14) * (r + 50), X + Math.sin(ta + 0.14) * (r + 50), y - Math.cos(ta + 0.14) * (r + 50));
    }
  }

  private drawReset(g: Phaser.GameObjects.Graphics) {
    const { x, y } = this.L.reset;
    g.fillStyle(0x000000, 0.22); g.fillEllipse(x, y + 30, 70, 14);
    g.fillStyle(0x37474f, 0.92); g.fillCircle(x, y, 34); g.lineStyle(3, 0xffffff, 0.8); g.strokeCircle(x, y, 34);
    g.lineStyle(6, 0xffffff, 1); g.beginPath(); g.arc(x, y, 15, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(230), false); g.strokePath();
    g.fillStyle(0xffffff, 1); g.fillTriangle(x + 4, y - 26, x + 4, y - 6, x + 22, y - 16);
  }

  private updatePatient(vol: number, now: number) {
    const L = this.L.patient; const cfg = this.cfg;
    const ratio = vol / cfg.syringe.start;
    const tRatio = stepTargetVolume(cfg, this.patient, this.st.stepIndex) / cfg.syringe.start;
    const dims = (r: number) => r >= 1 ? { w: L.size * Math.min(1.4, r), h: L.size * Math.min(1.4, r) } : { w: L.size * (1 + (1 - r) * 0.35), h: L.size * r * 0.95 };
    const base = L.y + L.size / 2;
    const gd = dims(tRatio), pd = dims(ratio);
    this.ghostImg.setPosition(L.x, base - gd.h / 2).setDisplaySize(gd.w, gd.h).setAlpha(0.22 + 0.1 * Math.sin(now / 260));
    this.previewImg.setPosition(L.x, base - pd.h / 2).setDisplaySize(pd.w, pd.h);
    // 받침 그림자와 진행 점(step)
    const g = this.g;
    g.fillStyle(0x000000, 0.22); g.fillEllipse(L.x, base + 8, L.size * 0.9, 20);
    const n = this.patient.steps.length;
    for (let i = 0; i < n; i++) {
      const done = i < this.st.stepIndex || this.st.done;
      g.fillStyle(done ? 0x3fae6a : 0xffffff, done ? 1 : 0.5); g.fillCircle(L.x - ((n - 1) * 18) + i * 36, base + 34, 10);
      g.lineStyle(2, 0x263238, 0.8); g.strokeCircle(L.x - ((n - 1) * 18) + i * 36, base + 34, 10);
    }
  }

  private drawBadgesAndHand(g: Phaser.GameObjects.Graphics, held: 'pressure' | 'temperature' | null, now: number) {
    const L = this.L;
    // 잠긴 조절기에 자물쇠와 교과서 조건 배지를 붙인다: 피스톤을 쓰면 다이얼(온도 일정), 다이얼을 쓰면 피스톤(압력 일정)
    const hcy = this.handleCY(deviceVolume(this.cfg, this.st.device));
    const place = (t: Phaser.GameObjects.Text, variable: 'pressure' | 'temperature', x: number, y: number) => {
      if (held === variable) t.setText(badgeText(variable)).setPosition(x, y).setAlpha(1); else t.setAlpha(0);
    };
    place(this.badgePress, 'pressure', L.barrel.x + 14, hcy - 50);
    place(this.badgeTemp, 'temperature', L.dial.x, L.dial.y - L.dial.r - 70);
    const lock = (x: number, y: number) => {
      g.fillStyle(0x455a64, 1); g.fillRoundedRect(x - 14, y - 4, 28, 22, 4);
      g.lineStyle(5, 0x455a64, 1); g.beginPath(); g.arc(x, y - 4, 9, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0xffe28a, 1); g.fillCircle(x, y + 7, 3);
    };
    if (held === 'pressure') lock(L.barrel.x - 62, hcy - 58);
    if (held === 'temperature') lock(L.dial.x, L.dial.y - L.dial.r - 102);

    // 손 모양 안내: 처음 또는 한참 조작이 없을 때 글 없이 끌어 가는 모양을 보여 준다
    const idle = now - this.lastActionAt;
    if (!this.st.done && ((this.st.used === null && now > 700) || idle > this.hintIdleMs || (this.patient.steps[this.st.stepIndex].role === 'explore' && now - this.stepStartAt > 900)) && !this.drag) {
      const k = (now % 1800) / 1800; const e = k < 0.75 ? Phaser.Math.Easing.Sine.InOut(k / 0.75) : 1;
      let hx: number, hy: number;
      if (this.patient.variable === 'pressure') {
        const cur = deviceVolume(this.cfg, this.st.device);
        const from = this.handleCY(cur); const tgt = this.handleCY(stepTargetVolume(this.cfg, this.patient, this.st.stepIndex));
        hx = L.barrel.x + 20; hy = from + (tgt - from) * e + 26;
      } else {
        const step = this.patient.steps[this.st.stepIndex];
        const ts = step.change === 'up' ? step.size : -step.size;
        const a0 = this.tempToAngle(this.st.device.tempStep); const a1 = this.tempToAngle(ts);
        const a = ((a0 + (a1 - a0) * e) * Math.PI) / 180;
        hx = L.dial.x + Math.sin(a) * (L.dial.r - 26) + 10; hy = L.dial.y - Math.cos(a) * (L.dial.r - 26) + 14;
      }
      g.fillStyle(0xffffff, 1); g.lineStyle(3, 0x263238, 1);
      g.fillPoints([new Phaser.Math.Vector2(hx, hy), new Phaser.Math.Vector2(hx, hy + 38), new Phaser.Math.Vector2(hx + 9, hy + 30), new Phaser.Math.Vector2(hx + 16, hy + 44), new Phaser.Math.Vector2(hx + 23, hy + 40), new Phaser.Math.Vector2(hx + 16, hy + 27), new Phaser.Math.Vector2(hx + 28, hy + 27)], true);
      g.strokePoints([new Phaser.Math.Vector2(hx, hy), new Phaser.Math.Vector2(hx, hy + 38), new Phaser.Math.Vector2(hx + 9, hy + 30), new Phaser.Math.Vector2(hx + 16, hy + 44), new Phaser.Math.Vector2(hx + 23, hy + 40), new Phaser.Math.Vector2(hx + 16, hy + 27), new Phaser.Math.Vector2(hx + 28, hy + 27)], true);
    }
  }
}
