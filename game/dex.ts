/** 진료 기록부(도감). 판을 넘어 누적되고, 같은 카드는 한 번만 들어간다. */
export interface Dex {
  patients: string[];   // 증상 카드: 치료한 환자 id
  laws: string[];       // 법칙 도장: boyle, charles
  particles: string[];  // 입자 엑스레이 카드: pressure, temperature
  people: string[];     // 인물 카드: boyle, charles
}
export type DexKind = keyof Dex;

export const DEX_KEY = 'air-clinic-dex-v1';

const empty = (): Dex => ({ patients: [], laws: [], particles: [], people: [] });
let cache: Dex | null = null;
let fresh: string[] = [];   // 이번 판에 처음 얻은 카드 (저장하지 않음): "kind:id"

function parse(raw: string | null): Dex {
  const dex = empty();
  if (!raw) return dex;
  try {
    const o = JSON.parse(raw) as Partial<Record<DexKind, unknown>>;
    for (const k of Object.keys(dex) as DexKind[]) {
      const v = o[k];
      if (Array.isArray(v)) dex[k] = v.filter((x): x is string => typeof x === 'string');
    }
  } catch { /* 깨진 저장본은 빈 도감으로 시작 */ }
  return dex;
}

export function loadDex(): Dex {
  if (cache) return cache;
  let raw: string | null = null;
  try { raw = localStorage.getItem(DEX_KEY); } catch { /* 저장소를 못 읽어도 진행 */ }
  cache = parse(raw);
  return cache;
}

/** 새로 들어가면 true, 이미 있으면 false. */
export function addToDex(kind: DexKind, id: string): boolean {
  const dex = loadDex();
  if (dex[kind].includes(id)) return false;
  dex[kind] = [...dex[kind], id];
  fresh = [...fresh, `${kind}:${id}`];
  try { localStorage.setItem(DEX_KEY, JSON.stringify(dex)); } catch { /* 저장 실패해도 진행 */ }
  return true;
}

/** 이번 판에 새로 얻은 카드 */
export const freshCards = (): string[] => fresh;
export const clearFresh = (): void => { fresh = []; };

export function clearDex(): void {
  cache = null; fresh = [];
  try { localStorage.removeItem(DEX_KEY); } catch { /* */ }
}
