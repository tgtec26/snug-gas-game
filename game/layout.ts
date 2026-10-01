/** 장면별 위치·크기. 코드에 좌표를 박지 않고 public/data/layout.json(admin의 배치 탭)에서 읽는다. 무대 1280×800 좌표. */
export interface ClinicLayout {
  barrel: { x: number; top: number; bottom: number; w: number };
  piston: { rod: number; handleW: number; handleH: number; hit: number };
  beaker: { x: number; top: number; bottom: number; w: number };
  gauge: { x: number; y: number; size: number };
  thermo: { x: number; y: number; h: number };
  dial: { x: number; y: number; r: number };
  patient: { x: number; y: number; size: number };
  reset: { x: number; y: number };
  graph: { x: number; y: number; w: number; h: number };
}
export interface DipLayout {
  hot: { x: number; top: number; bottom: number; w: number };
  cold: { x: number; top: number; bottom: number; w: number };
  waterInset: number;   // 비커 윗면에서 수면까지
  syringe: { x: number; y: number; w: number; pxPerMl: number; nozzle: number; minX: number; maxX: number; minY: number; maxY: number };
  person: { x: number; y: number; r: number };
  gloves: { x: number; y: number };
  goggles: { x: number; y: number };
  thermo: { x: number; y: number; h: number };
}
export interface Layout { clinic: ClinicLayout; dip: DipLayout }

const COORD = new Set(['x', 'y', 'top', 'bottom']);

/** 있어야 하는 값. 빠지면 씬이 NaN 좌표로 그리게 되므로 로딩 단계에서 막는다. */
const REQUIRED: Record<keyof ClinicLayout, string[]> = {
  barrel: ['x', 'top', 'bottom', 'w'],
  piston: ['rod', 'handleW', 'handleH', 'hit'],
  beaker: ['x', 'top', 'bottom', 'w'],
  gauge: ['x', 'y', 'size'],
  thermo: ['x', 'y', 'h'],
  dial: ['x', 'y', 'r'],
  patient: ['x', 'y', 'size'],
  reset: ['x', 'y'],
  graph: ['x', 'y', 'w', 'h'],
};

/** 오류 문자열 목록. 좌표는 무대 안, 크기는 0보다 커야 하고, 통이 주사기를 감싸야 한다. */
export function validateLayout(l: Layout): string[] {
  const errs: string[] = [];
  const walk = (o: unknown, path: string) => {
    if (typeof o === 'number') {
      const key = path.split('.').pop() as string;
      if (!Number.isFinite(o)) errs.push(`${path}: 숫자가 아니다`);
      else if (COORD.has(key)) {
        const max = key === 'x' ? 1280 : 800;
        if (o < 0 || o > max) errs.push(`${path}: 무대(0~${max}) 밖이다`);
      } else if (!(o > 0)) errs.push(`${path}: 0보다 커야 한다`);
    } else if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k);
    } else errs.push(`${path}: 값이 없다`);
  };
  walk(l, '');
  const c = l.clinic;
  if (c) {
    for (const [group, keys] of Object.entries(REQUIRED)) {
      const g = (c as unknown as Record<string, Record<string, unknown> | undefined>)[group];
      if (!g) { errs.push(`clinic.${group}: 없다`); continue; }
      for (const k of keys) if (typeof g[k] !== 'number') errs.push(`clinic.${group}.${k}: 없다`);
    }
    if (c.barrel && c.beaker) {
      if (!(c.barrel.top < c.barrel.bottom)) errs.push('clinic.barrel: top이 bottom보다 위여야 한다');
      if (!(c.beaker.top < c.beaker.bottom)) errs.push('clinic.beaker: top이 bottom보다 위여야 한다');
      if (!(c.beaker.w > c.barrel.w)) errs.push('clinic.beaker: 통이 주사기보다 넓어야 한다');
    }
  } else errs.push('clinic 배치가 없다');
  const d = l.dip;
  if (!d) errs.push('dip 배치가 없다');
  else {
    for (const k of ['hot', 'cold'] as const) if (!(d[k].top < d[k].bottom)) errs.push(`dip.${k}: top이 bottom보다 위여야 한다`);
    if (!(d.syringe.minX < d.syringe.maxX) || !(d.syringe.minY < d.syringe.maxY)) errs.push('dip.syringe: 이동 범위가 거꾸로다');
    if (!(d.hot.w > d.syringe.w) || !(d.cold.w > d.syringe.w)) errs.push('dip: 비커가 주사기보다 넓어야 한다');
  }
  return errs;
}
