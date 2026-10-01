import * as Phaser from 'phaser';
import {
  boxFor, createParticles, currentOp, emphasis, speedFactor, stepParticles, trackObservation, PARTICLE_RADIUS, type Particle,
} from '@/game/particles';
import { checkLensObserved, deviceVolume } from '@/game/rules';
import { addToDex } from '@/game/dex';
import type { Device, Experiments, ParticleRule, Variable } from '@/game/types';

interface Rect { x: number; y: number; w: number; h: number }

export interface LensOptions {
  icon: { x: number; y: number };
  view: Rect;                 // 확대 보기 창
  zone: Rect;                 // 렌즈를 대는 검사 장치 영역
  cfg: Experiments;
  rules: ParticleRule[];
  count: number;
  getDevice: () => { device: Device; used: Variable | null };
  onObserved?: (variable: Variable) => void;
}

/**
 * 엑스레이 렌즈. 렌즈 아이콘을 끌어 검사 장치 영역에 놓으면 거치대에 걸려 확대 보기(입자)가 켜진다.
 * 다시 끌어 영역 밖에 놓거나 L 키로 끈다. 걸어 둔 채로 조절기를 움직이면 입자가 실시간으로 변한다.
 * 판정·강조 규칙은 game/particles.ts, 여기는 그리기와 입력만 한다.
 */
export class LensView {
  private g: Phaser.GameObjects.Graphics;
  private ps: Particle[];
  private on = false;
  private drag: { x: number; y: number } | null = null;
  private flashes: { x: number; y: number; t0: number; r: number }[] = [];
  private prev: { volume: number; tempStep: number } | null = null;
  private obs = { movingMs: 0, sinceMoveMs: 1e9 };
  private recorded = new Set<Variable>();

  constructor(private scene: Phaser.Scene, private o: LensOptions) {
    this.g = scene.add.graphics().setDepth(50);
    this.ps = createParticles(o.count);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.cancel, this);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.cancel, this);
    const onKey = (e: KeyboardEvent) => { if (!e.repeat && (e.key === 'l' || e.key === 'L')) this.on = !this.on; };
    window.addEventListener('keydown', onKey);
    scene.events.once('shutdown', () => {
      window.removeEventListener('keydown', onKey);
      scene.game.events.off(Phaser.Core.Events.BLUR, this.cancel, this);
    });
  }

  /** 렌즈로 보는 중이거나 끄는 중인가(이때 조절기 입력과 겹치지 않게 씬이 참고할 수 있다) */
  get dragging() { return this.drag !== null; }
  get active() { return this.on; }

  private inZone(x: number, y: number) {
    const z = this.o.zone; return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  }
  private onDown(p: Phaser.Input.Pointer) {
    const i = this.o.icon;
    if (Math.hypot(p.worldX - i.x, p.worldY - i.y) < 70) { this.drag = { x: p.worldX, y: p.worldY }; this.on = false; }
  }
  private onMove(p: Phaser.Input.Pointer) { if (this.drag) this.drag = { x: p.worldX, y: p.worldY }; }
  private onUp(p: Phaser.Input.Pointer) {
    if (!this.drag) return;
    this.on = this.inZone(p.worldX, p.worldY); this.drag = null;
  }
  private cancel() { this.drag = null; }

  /** 매 프레임: 입자를 진행하고 그린다. dtMs는 실제 경과 시간. */
  update(dtMs: number) {
    const g = this.g; g.clear();
    this.drawIcon(g);
    if (!this.on) { this.prev = null; return; }
    const { device, used } = this.o.getDevice(); const cfg = this.o.cfg; const v = this.o.view;
    const vol = deviceVolume(cfg, device);

    // 관찰 기록: 렌즈를 댄 채 조절기가 움직인 시간
    const cur = { volume: vol, tempStep: device.tempStep };
    this.obs = trackObservation(this.prev, cur, this.obs, dtMs); this.prev = cur;
    if (used && !this.recorded.has(used) && checkLensObserved(cfg, this.obs.movingMs)) {
      this.recorded.add(used); addToDex('particles', used); this.o.onObserved?.(used);
    }

    // 표시용 용기: 높이는 부피에 비례
    const pxPerMl = (v.h - 90) / (cfg.syringe.max + 2);
    const box = boxFor(vol, pxPerMl, Math.min(160, v.w * 0.52));
    const r = stepParticles(this.ps, box, speedFactor(device), Math.min(dtMs, 100) / 1000);
    this.ps = r.ps;
    const op = currentOp(cfg, device, used); const emph = emphasis(this.o.rules, op);
    const bx = v.x + (v.w - box.w) / 2, by = v.y + v.h - 28 - box.h;   // 용기 바닥은 고정, 윗면(피스톤)이 움직인다
    const now = performance.now();
    for (const h of r.hits) this.flashes.push({ x: bx + h.x, y: by + h.y, t0: now, r: 16 * (emph.strength ? speedFactor(device) : 1) });
    this.flashes = this.flashes.filter(f => now - f.t0 < 260).slice(-40);

    // 창
    g.fillStyle(0x000000, 0.25); g.fillRoundedRect(v.x + 6, v.y + 8, v.w, v.h, 22);
    g.fillStyle(0x10222c, 0.95); g.fillRoundedRect(v.x, v.y, v.w, v.h, 22);
    g.lineStyle(6, 0x9fe3ff, 1); g.strokeRoundedRect(v.x, v.y, v.w, v.h, 22);
    // 용기와 피스톤
    g.fillStyle(0x1d3b4a, 1); g.fillRect(bx, by, box.w, box.h);
    g.lineStyle(4, 0xbfe6f7, 1); g.lineBetween(bx, by - 30, bx, by + box.h); g.lineBetween(bx + box.w, by - 30, bx + box.w, by + box.h); g.lineBetween(bx, by + box.h, bx + box.w, by + box.h);
    g.fillStyle(0x546e7a, 1); g.fillRect(bx + 2, by - 14, box.w - 4, 14);
    g.fillStyle(0xe0513f, 1); g.fillRoundedRect(bx + box.w / 2 - 34, by - 40, 68, 24, 8);

    // 강조: 압력 조작이면 가장 가까운 두 입자 사이의 거리를 점선으로 보여 준다
    if (emph.distance && this.ps.length > 1) this.drawNearest(g, bx, by, box);

    // 입자와 화살표(화살표 길이가 운동 빠르기)
    for (const p of this.ps) {
      const x = bx + p.u * box.w, y = by + p.v * box.h;
      const len = Math.hypot(p.vx, p.vy) * 0.35; const ang = Math.atan2(p.vy, p.vx);
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      g.lineStyle(4, 0xffffff, 0.9); g.lineBetween(x, y, ex, ey);
      g.fillStyle(0xffffff, 0.95); g.fillTriangle(ex + Math.cos(ang) * 9, ey + Math.sin(ang) * 9, ex + Math.cos(ang + 2.4) * 8, ey + Math.sin(ang + 2.4) * 8, ex + Math.cos(ang - 2.4) * 8, ey + Math.sin(ang - 2.4) * 8);
      g.fillStyle(0xffd54f, 1); g.fillCircle(x, y, PARTICLE_RADIUS); g.lineStyle(2, 0x8a6a00, 1); g.strokeCircle(x, y, PARTICLE_RADIUS);
    }
    // 벽 충돌 섬광
    for (const f of this.flashes) {
      const k = (now - f.t0) / 260;
      g.lineStyle(4, 0xffffff, 1 - k); g.strokeCircle(f.x, f.y, f.r * (0.4 + k));
      g.fillStyle(0xfff3a8, 0.6 * (1 - k)); g.fillCircle(f.x, f.y, f.r * 0.5 * (1 - k));
    }
  }

  private drawNearest(g: Phaser.GameObjects.Graphics, bx: number, by: number, box: { w: number; h: number }) {
    const a = this.ps[0]; let best = -1, bd = Infinity;
    for (let i = 1; i < this.ps.length; i++) {
      const d = Math.hypot((this.ps[i].u - a.u) * box.w, (this.ps[i].v - a.v) * box.h);
      if (d < bd) { bd = d; best = i; }
    }
    const b = this.ps[best];
    const x1 = bx + a.u * box.w, y1 = by + a.v * box.h, x2 = bx + b.u * box.w, y2 = by + b.v * box.h;
    const n = Math.max(1, Math.floor(bd / 12));
    g.lineStyle(3, 0x8fe3c0, 1);
    for (let i = 0; i < n; i += 2) g.lineBetween(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, x1 + ((x2 - x1) * (i + 1)) / n, y1 + ((y2 - y1) * (i + 1)) / n);
  }

  /** 렌즈 아이콘: 거치대에 걸려 있으면 빈 자리만 반짝이고, 끄는 중에는 손가락을 따라간다. */
  private drawIcon(g: Phaser.GameObjects.Graphics) {
    const i = this.o.icon; const now = performance.now();
    const at = this.drag ?? i; const lift = this.drag ? 1 : 0;
    g.fillStyle(0x000000, 0.22); g.fillEllipse(i.x, i.y + 52, 84, 14);
    if (this.on && !this.drag) { g.lineStyle(4, 0x9fe3ff, 0.5 + 0.4 * Math.sin(now / 250)); g.strokeCircle(i.x, i.y, 40); return; }
    const x = at.x, y = at.y - lift * 16, s = 1 + lift * 0.12;
    g.lineStyle(10 * s, 0x6b4e2e, 1); g.lineBetween(x + 22 * s, y + 22 * s, x + 46 * s, y + 52 * s);
    g.fillStyle(0xcfefff, 0.6); g.fillCircle(x, y, 34 * s);
    g.lineStyle(7 * s, 0x546e7a, 1); g.strokeCircle(x, y, 34 * s);
    g.fillStyle(0xffffff, 0.6); g.fillCircle(x - 11 * s, y - 11 * s, 8 * s);
    if (this.drag && this.inZone(this.drag.x, this.drag.y)) { g.lineStyle(5, 0xffc933, 0.6 + 0.4 * Math.sin(now / 150)); g.strokeRect(this.o.zone.x, this.o.zone.y, this.o.zone.w, this.o.zone.h); }
  }
}
