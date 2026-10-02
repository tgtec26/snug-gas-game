import * as Phaser from 'phaser';
import { hiDpi, addBg, heroKey, TEXT, OUTLINE } from '@/game/systems/render';
import { attachRouter } from '@/game/systems/sceneRouter';
import { useGame } from '@/game/store';
import { useDataStore } from '@/game/dataStore';
import { playSfx } from '@/game/audio';
import { createExam, tickExam, examResult, type ExamState, type ExamEvent } from '@/game/exam';
import { resolveSyringe, stepDip, waterTopY, type DipResolved, type Beaker } from '@/game/dip';
import { deviceVolume, stepTargetVolume } from '@/game/rules';
import { LensView } from '@/game/systems/lens';
import { GoalBanner } from '@/game/systems/goalBanner';
import { goalFor } from '@/game/goals';
import { inEmergency, roundBlocked, comboRate } from '@/game/systems/emergencyRound';
import type { Experiments, Patient } from '@/game/types';
import type { DipLayout, ClinicLayout } from '@/game/layout';

const MAX_FRAME_MS = 200;
const KEY_STEP = 30;
const BARREL_LEN = 160;          // 주사기 통 길이(노즐 위쪽)
const GEARS = ['gloves', 'goggles'] as const;
type Gear = (typeof GEARS)[number];

/** 담그기 진료: 주사기를 끌어 얼음물·뜨거운 물에 담근다. 판정은 game/exam.ts, 담그기 규칙은 game/dip.ts. 여기는 그리기와 입력만. */
export class DipScene extends Phaser.Scene {
  private cfg!: Experiments;
  private patient!: Patient;
  private L!: DipLayout;
  private PL!: ClinicLayout['patient'];
  private st!: ExamState;
  private res!: DipResolved;
  private target = { x: 0, y: 0 };
  private worn: Gear[] = [];
  private gearRefused = 0;
  private prevBlocked = false;
  private prevSubmerged = false;
  private submergeSince = 0;
  private submergeHinted = false;
  private limitMs = 60000;
  private hintIdleMs = 4000;
  private holdFinishMs = 900;
  private g!: Phaser.GameObjects.Graphics;
  private ghostImg!: Phaser.GameObjects.Image;
  private previewImg!: Phaser.GameObjects.Image;
  private hintText!: Phaser.GameObjects.Text;
  private hintUntil = 0;
  private drag: { kind: 'syringe'; dx: number; dy: number } | { kind: 'gear'; gear: Gear; x: number; y: number } | null = null;
  private lastActionAt = 0;
  private lastTick = 0;
  private shakeUntil: Record<Beaker, number> = { hot: 0, cold: 0 };
  private stepStartAt = 0;
  private finishing = false;
  private finishTimer: number | null = null;
  private lens!: LensView;
  private gHand!: Phaser.GameObjects.Graphics;
  private gWater!: Phaser.GameObjects.Graphics;
  private goal!: GoalBanner;
  private sp!: {
    barrel: Phaser.GameObjects.Image; grip: Phaser.GameObjects.Image;
    kid: Phaser.GameObjects.Image;
    gloveTray: Phaser.GameObjects.Image; gogglesTray: Phaser.GameObjects.Image;
  };

  constructor() { super({ key: 'Dip' }); }

  create() {
    hiDpi(this);
    addBg(this, 'rig_dip', 'exam_bg_ph');
    attachRouter(this);

    const data = useDataStore.getState();
    const id = useGame.getState().currentId;
    const patient = data.patients.find(p => p.id === id);
    if (!patient || !data.experiments || !data.layout || !data.minigame) { this.scene.start('Backdrop'); return; }
    this.patient = patient; this.cfg = data.experiments; this.L = data.layout.dip; this.PL = data.layout.clinic.patient;
    this.limitMs = data.minigame.examTimeLimitMs; this.hintIdleMs = data.minigame.hintIdleMs; this.holdFinishMs = data.minigame.successHoldMs;
    this.st = createExam(this.cfg, patient);
    this.target = { x: this.L.syringe.x, y: this.L.syringe.y };
    this.worn = inEmergency() ? [...GEARS] : []; this.gearRefused = 0; this.prevBlocked = false; this.prevSubmerged = false; this.submergeSince = 0; this.submergeHinted = false;
    this.drag = null; this.finishing = false; this.shakeUntil = { hot: 0, cold: 0 };
    this.lastActionAt = performance.now(); this.lastTick = performance.now(); this.stepStartAt = performance.now();
    this.res = resolveSyringe(this.L, this.cfg, this.worn, this.target.x, this.target.y);

    this.g = this.add.graphics().setDepth(10);
    this.goal = new GoalBanner(this, inEmergency() ? 764 : 44);
    this.gHand = this.add.graphics().setDepth(45);
    this.gWater = this.add.graphics().setDepth(12);
    const im = (k: string, d: number) => this.add.image(0, 0, `sp_${k}`).setDepth(d);
    this.sp = {
      barrel: im('barrel', 11), grip: im('grip', 13),
      kid: this.add.image(0, 0, heroKey(useGame.getState().heroId, this.worn)).setDepth(8),
      gloveTray: im('glove', 11), gogglesTray: im('goggles', 11),
    };
    const key = this.textures.exists(`patient_${patient.id}`) ? `patient_${patient.id}` : `patient_${patient.id}_ph`; const p = this.PL;
    this.ghostImg = this.add.image(p.x, p.y, key).setDepth(9).setTint(0x1b2a33).setTintMode(Phaser.TintModes.FILL).setAlpha(0.28);
    this.previewImg = this.add.image(p.x, p.y, key).setDepth(11);
    this.hintText = this.add.text(640, 112, '', { ...TEXT, ...OUTLINE, fontSize: '26px', fontStyle: 'bold', color: '#ffffff' }).setDepth(30).setOrigin(0.5).setAlpha(0);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.cancelDrag, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.cancelDrag, this);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.BLUR, this.cancelDrag, this);
      if (this.finishTimer !== null) { window.clearTimeout(this.finishTimer); this.finishTimer = null; }
    });

    // 키보드: 방향키로 주사기를 옮기고 G로 장비를 하나씩 착용. 자동 반복(e.repeat)은 무시.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || this.st.done || roundBlocked()) return;
      const move = (dx: number, dy: number) => { e.preventDefault(); this.target = { x: this.target.x + dx, y: this.target.y + dy }; this.act(); };
      if (e.key === 'ArrowUp') move(0, -KEY_STEP);
      else if (e.key === 'ArrowDown') move(0, KEY_STEP);
      else if (e.key === 'ArrowLeft') move(-KEY_STEP, 0);
      else if (e.key === 'ArrowRight') move(KEY_STEP, 0);
      else if (e.key === 'g' || e.key === 'G') { const next = GEARS.find(x => !this.worn.includes(x)); if (next) this.wear(next); }
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

  private act() { this.lastActionAt = performance.now(); }

  private wear(g: Gear) {
    if (this.worn.includes(g)) return;
    this.worn = [...this.worn, g]; playSfx('correct'); this.act();
    this.sparkle(this.L.person.x, this.L.person.y - 40, 10);
  }

  // ── 입력 ────────────────────────────────────────────────────
  private gearPos(g: Gear) { return this.L[g]; }
  private syringeHit(x: number, y: number) {
    const s = this.L.syringe; const r = this.res;
    return Math.abs(x - r.x) < s.w / 2 + 34 && y > r.y - BARREL_LEN - 90 && y < r.y + 20;
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.st.done || roundBlocked()) return;
    const x = p.worldX, y = p.worldY;
    for (const g of GEARS) {
      if (this.worn.includes(g)) continue;
      const gp = this.gearPos(g);
      if (Math.hypot(x - gp.x, y - gp.y) < 70) { this.drag = { kind: 'gear', gear: g, x, y }; this.act(); return; }
    }
    if (this.syringeHit(x, y)) { this.drag = { kind: 'syringe', dx: this.res.x - x, dy: this.res.y - y }; this.act(); }
  }
  private onMove(p: Phaser.Input.Pointer) {
    if (!this.drag || this.st.done) return;
    if (this.drag.kind === 'syringe') this.target = { x: p.worldX + this.drag.dx, y: p.worldY + this.drag.dy };
    else this.drag = { ...this.drag, x: p.worldX, y: p.worldY };
    this.act();
  }
  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag; this.drag = null;
    if (d?.kind === 'gear') {
      const per = this.L.person;
      if (Math.hypot(p.worldX - per.x, p.worldY - per.y) < per.r + 60) this.wear(d.gear);
    }
  }
  private cancelDrag() { this.drag = null; }

  // ── 진행 ────────────────────────────────────────────────────
  update() {
    if (!this.st) return;
    const nowMs = performance.now();
    const dt = Math.min(nowMs - this.lastTick, MAX_FRAME_MS);   // Phaser delta는 느린 프레임에서 보정되므로 시계를 직접 읽는다
    this.lastTick = nowMs;
    this.res = resolveSyringe(this.L, this.cfg, this.worn, this.target.x, this.target.y);
    this.target = { x: this.res.x, y: this.res.y };
    this.watchRefusals(nowMs);
    this.st = stepDip(this.cfg, this.st, this.res, dt);
    const r = tickExam(this.cfg, this.patient, this.st, dt);
    this.st = r.state;
    for (const e of r.events) this.onEvent(e);
    this.draw();
    this.lens.update(dt);
    const goals = useDataStore.getState().dialog?.goals; if (goals) this.goal.set(this.st.done ? '' : goalFor(goals, this.patient, this.st.stepIndex));
  }

  private say(text: string, ms = 2200) { this.hintText.setText(text).setAlpha(1); this.hintUntil = performance.now() + ms; }

  /** 장비 없이 뜨거운 물에 들어가려는 순간 한 번, 잠기지 않은 채 오래 머물면 한 번 알린다. */
  private watchRefusals(now: number) {
    const dlg = useDataStore.getState().dialog; const r = this.res;
    if (r.blockedGear && !this.prevBlocked) {
      this.gearRefused++; this.shakeUntil.hot = now + 400; playSfx('error'); this.cameras.main.shake(120, 0.003);
      if (dlg) this.say(dlg.hints.gear);
    }
    this.prevBlocked = r.blockedGear;
    if (r.submerged !== this.prevSubmerged) { this.prevSubmerged = r.submerged; playSfx('splash'); }
    if (r.beaker && !r.submerged) {
      if (!this.submergeSince) this.submergeSince = now;
      else if (!this.submergeHinted && now - this.submergeSince > 1800 && dlg) { this.submergeHinted = true; this.say(dlg.hints.submerge); }
    } else { this.submergeSince = 0; this.submergeHinted = false; }
  }

  private onEvent(e: ExamEvent) {
    if (e.type === 'step-done') {
      this.stepStartAt = performance.now(); playSfx('correct'); this.cameras.main.flash(160, 255, 255, 255, true);
      this.tweens.add({ targets: this.previewImg, scale: this.previewImg.scale * 1.12, yoyo: true, duration: 140 });
      this.sparkle(this.PL.x, this.PL.y, 14);
    } else if (e.type === 'all-done' && !this.finishing) {
      this.finishing = true; playSfx('success', inEmergency() ? comboRate() : 1); this.sparkle(this.PL.x, this.PL.y, 26);
      this.finishTimer = window.setTimeout(() => {
        this.finishTimer = null;
        if (inEmergency()) { useGame.getState().recordRound(this.patient.id, true); return; }
        useGame.getState().completeExam(this.patient.id, examResult(this.st, this.patient, this.limitMs, this.gearRefused === 0));
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

  // ── 그리기 ──────────────────────────────────────────────────
  private draw() {
    const g = this.g; const now = performance.now(); const L = this.L; const cfg = this.cfg;
    g.clear(); this.gHand.clear();
    const vol = deviceVolume(cfg, this.st.device);
    this.drawBeaker(g, 'cold', now); this.drawBeaker(g, 'hot', now); this.drawSubmergedTint();
    this.drawThermo(g);
    this.drawPerson(g, now);
    this.drawSyringe(g, vol, now);
    this.drawGearTray(g);
    this.drawPatient(g, vol, now);
    this.drawHand(g, now);
    if (this.hintText.alpha > 0 && now > this.hintUntil) this.hintText.setAlpha(0);
    void L;
  }

  /** 비커·얼음·김은 배경 그림(rig_dip)에 있다. 장비 없이 뜨거운 물에 들어가려 하면 비커 테두리가 붉게 깜박인다. */
  private drawBeaker(g: Phaser.GameObjects.Graphics, k: Beaker, now: number) {
    const b = this.L[k];
    if (now < this.shakeUntil[k] && Math.floor(now / 80) % 2 === 0) { g.lineStyle(6, 0xe0513f, 0.9); g.strokeRoundedRect(b.x - b.w / 2 - 8, b.top - 24, b.w + 16, b.bottom - b.top + 50, 16); }
  }

  /** 주사기가 잠긴 부분에 물 색을 얹어, 그림 속 물에 담긴 것처럼 보이게 한다 */
  private drawSubmergedTint() {
    const w = this.gWater; w.clear(); const r = this.res;
    if (!r.beaker) return;
    const b = this.L[r.beaker]; const wt = waterTopY(this.L, r.beaker); const sy = this.L.syringe;
    if (r.y <= wt) return;
    w.fillStyle(r.beaker === 'hot' ? 0xff6a33 : 0x2f86d6, 0.34);
    w.fillRect(r.x - sy.w * 0.75, wt, sy.w * 1.5, Math.min(r.y + 6, b.bottom - 14) - wt);
  }

  private drawThermo(g: Phaser.GameObjects.Graphics) {
    const { x, y, h } = this.L.thermo; const cfg = this.cfg;
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x, y + h + 40, 70, 18);
    const t01 = (this.st.device.tempStep - cfg.temp.minStep) / (cfg.temp.maxStep - cfg.temp.minStep);
    const mh = 20 + t01 * (h - 40);
    g.fillStyle(0xe0513f, 1); g.fillCircle(x, y + h + 10, 15); g.fillRoundedRect(x - 6, y + h - mh, 12, mh + 6, 6);
    const step = this.patient.steps[this.st.stepIndex];
    const ts = step.change === 'up' ? step.size : -step.size;
    const my = y + h - (20 + ((ts - cfg.temp.minStep) / (cfg.temp.maxStep - cfg.temp.minStep)) * (h - 40));
    g.fillStyle(0xffc933, 0.65 + 0.3 * Math.sin(performance.now() / 260)); g.fillTriangle(x + 18, my, x + 40, my - 11, x + 40, my + 11);
    for (let i = 0; i < 6; i++) { g.lineStyle(3, 0x546e7a, 1); g.lineBetween(x - 28, y + 20 + i * ((h - 40) / 5), x - 18, y + 20 + i * ((h - 40) / 5)); }
  }

  /** 사람 모양 실루엣: 장갑·보안경을 끌어다 놓는 자리. 끄는 중에는 맥박처럼 빛난다. */
  private drawPerson(g: Phaser.GameObjects.Graphics, now: number) {
    const { x, y, r } = this.L.person;
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x, y + r + 70, r * 2, 26);
    if (this.drag?.kind === 'gear') { g.lineStyle(6, 0xffc933, 0.5 + 0.4 * Math.sin(now / 150)); g.strokeCircle(x, y, r + 30); }
    this.sp.kid.setTexture(heroKey(useGame.getState().heroId, this.worn)).setPosition(x, y + 5).setDisplaySize(151, 250);   // 착용 그림으로 바뀐다
  }

  private drawGearIcon(g: Phaser.GameObjects.Graphics, gear: Gear, x: number, y: number, s: number) {
    g.fillStyle(0x000000, 0.22); g.fillEllipse(x, y + 34 * s, 80 * s, 14 * s);
    if (gear === 'gloves') this.sp.gloveTray.setVisible(true).setPosition(x, y).setDisplaySize(52 * s, 81 * s);
    else this.sp.gogglesTray.setVisible(true).setPosition(x, y).setDisplaySize(104 * s, 104 * s * (196 / 379));
  }

  private drawGearTray(g: Phaser.GameObjects.Graphics) {
    this.sp.gloveTray.setVisible(false); this.sp.gogglesTray.setVisible(false);
    for (const gear of GEARS) {
      if (this.worn.includes(gear)) continue;
      const p = this.gearPos(gear);
      if (this.drag?.kind === 'gear' && this.drag.gear === gear) this.drawGearIcon(g, gear, this.drag.x, this.drag.y - 18, 1.15);
      else this.drawGearIcon(g, gear, p.x, p.y, 1);
    }
  }

  private drawSyringe(g: Phaser.GameObjects.Graphics, vol: number, now: number) {
    const s = this.L.syringe; const r = this.res; const lift = this.drag?.kind === 'syringe' ? 1 : 0;
    const tip = r.y; const bodyBottom = tip - s.nozzle; const top = bodyBottom - BARREL_LEN;
    const gasTop = bodyBottom - vol * s.pxPerMl;
    // 바닥 그림자: 높이에 따라 멀어지고 흐려진다
    const height = Math.max(0, (this.L.cold.bottom + 14) - tip);
    g.fillStyle(0x000000, Math.max(0.08, 0.26 - height / 2500)); g.fillEllipse(r.x + lift * 10, this.L.cold.bottom + 30, s.w * (1.4 + height / 500), 16);
    // 통
    g.fillStyle(0xbfe6f7, 0.8); g.fillRect(r.x - s.w / 2 + 4, gasTop, s.w - 8, bodyBottom - gasTop);
    g.lineStyle(2, 0x455a64, 0.9);
    for (let i = 0; i <= 16; i++) g.lineBetween(r.x + s.w / 2, bodyBottom - i * (BARREL_LEN / 16), r.x + s.w / 2 + (i % 2 === 0 ? 14 : 8), bodyBottom - i * (BARREL_LEN / 16));
    // 노즐
    this.sp.barrel.setPosition(r.x, (top - 14 + tip) / 2).setDisplaySize(s.w * 1.47, tip - top + 14);
    // 피스톤: 머리 + 막대 + 손잡이
    g.fillStyle(0x37474f, 1); g.fillRect(r.x - s.w / 2 + 3, gasTop - 12, s.w - 6, 12);
    g.fillStyle(0x546e7a, 1); g.fillRect(r.x - 5, gasTop - 60, 10, 50);
    this.sp.grip.setPosition(r.x, gasTop - 71).setDisplaySize(92, 92 / (366 / 113));
    if (lift) { g.lineStyle(4, 0xffc933, 0.6 + 0.3 * Math.sin(now / 150)); g.strokeRect(r.x - s.w / 2 - 4, top - 4, s.w + 8, BARREL_LEN + s.nozzle + 8); }
  }

  private drawPatient(g: Phaser.GameObjects.Graphics, vol: number, now: number) {
    const L = this.PL; const cfg = this.cfg;
    const ratio = vol / cfg.syringe.start;
    const tRatio = stepTargetVolume(cfg, this.patient, this.st.stepIndex) / cfg.syringe.start;
    const dims = (r: number) => r >= 1 ? { w: L.size * Math.min(1.4, r), h: L.size * Math.min(1.4, r) } : { w: L.size * (1 + (1 - r) * 0.35), h: L.size * r * 0.95 };
    const base = L.y + L.size / 2; const gd = dims(tRatio), pd = dims(ratio);
    this.ghostImg.setPosition(L.x, base - gd.h / 2).setDisplaySize(gd.w, gd.h).setAlpha(0.22 + 0.1 * Math.sin(now / 260));
    this.previewImg.setPosition(L.x, base - pd.h / 2).setDisplaySize(pd.w, pd.h);
    g.fillStyle(0x000000, 0.22); g.fillEllipse(L.x, base + 8, L.size * 0.9, 20);
    const n = this.patient.steps.length;
    for (let i = 0; i < n; i++) {
      const done = i < this.st.stepIndex || this.st.done;
      g.fillStyle(done ? 0x3fae6a : 0xffffff, done ? 1 : 0.5); g.fillCircle(L.x - ((n - 1) * 18) + i * 36, base + 34, 10);
      g.lineStyle(2, 0x263238, 0.8); g.strokeCircle(L.x - ((n - 1) * 18) + i * 36, base + 34, 10);
    }
  }

  /** 글 없는 손 모양 안내: 장비가 필요하면 장비를 사람에게, 아니면 주사기를 알맞은 비커 안으로 끌어 가는 모습 */
  private drawHand(g: Phaser.GameObjects.Graphics, now: number) {
    if (this.st.done || this.drag) return;
    const step = this.patient.steps[this.st.stepIndex];
    const needGear = step.change === 'up' && this.worn.length < GEARS.length;
    const idle = now - this.lastActionAt;
    const show = idle > this.hintIdleMs || (this.st.used === null && now > 700) || (this.st.stepIndex > 0 && now - this.stepStartAt > 900);
    if (!show) return;
    const k = (now % 1800) / 1800; const e = k < 0.75 ? Phaser.Math.Easing.Sine.InOut(k / 0.75) : 1;
    let from: { x: number; y: number }, to: { x: number; y: number };
    if (needGear) {
      const gear = GEARS.find(x => !this.worn.includes(x)) as Gear; from = this.gearPos(gear); to = { x: this.L.person.x, y: this.L.person.y };
    } else {
      const b = this.L[step.change === 'up' ? 'hot' : 'cold'];
      from = { x: this.res.x, y: this.res.y - 40 }; to = { x: b.x, y: this.L.cold.bottom - 60 };
    }
    const hx = from.x + (to.x - from.x) * e + 14, hy = from.y + (to.y - from.y) * e + 10;
    const pts = [[0, 0], [0, 38], [9, 30], [16, 44], [23, 40], [16, 27], [28, 27]].map(([dx, dy]) => new Phaser.Math.Vector2(hx + dx, hy + dy));
    const h = this.gHand; h.fillStyle(0xffffff, 1); h.lineStyle(3, 0x263238, 1); h.fillPoints(pts, true); h.strokePoints(pts, true);
  }
}
