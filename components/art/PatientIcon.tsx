import { useDataStore } from '@/game/dataStore';

/** 환자 아이콘 플레이스홀더 (SVG 코드 그림). codex 이미지로 교체 예정. viewBox 120×120. */
export type PatientId = string;

const BODY: Record<string, React.ReactNode> = {
  rubberball: (<>
    <circle cx="60" cy="58" r="44" fill="#e0513f" stroke="#9b2f23" strokeWidth="4" />
    <path d="M22 52 Q60 32 98 52" stroke="#fff" strokeOpacity=".55" strokeWidth="6" fill="none" />
    <ellipse cx="44" cy="38" rx="10" ry="6" fill="#fff" fillOpacity=".5" transform="rotate(-25 44 38)" />
  </>),
  snackbag: (<>
    <path d="M20 26 L100 26 L96 100 L24 100 Z" fill="#f2b531" stroke="#b37a10" strokeWidth="4" strokeLinejoin="round" />
    <rect x="16" y="18" width="88" height="14" rx="3" fill="#d9961b" stroke="#b37a10" strokeWidth="3" />
    <rect x="20" y="94" width="80" height="14" rx="3" fill="#d9961b" stroke="#b37a10" strokeWidth="3" />
    <circle cx="60" cy="62" r="17" fill="#e0513f" /><path d="M52 62 h16 M60 54 v16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
  </>),
  foilballoon: (<>
    <polygon points="60,8 72,42 108,42 79,64 90,100 60,78 30,100 41,64 12,42 48,42" fill="#cfd8dc" stroke="#78909c" strokeWidth="4" strokeLinejoin="round" />
    <polygon points="60,24 66,42 84,42 70,54 75,72 60,62 45,72 50,54 36,42 54,42" fill="#fff" fillOpacity=".55" />
    <path d="M60 100 q-8 8 0 14" stroke="#78909c" strokeWidth="3" fill="none" />
  </>),
  soccerball: (<>
    <circle cx="60" cy="60" r="44" fill="#fff" stroke="#455a64" strokeWidth="4" />
    <polygon points="60,36 82,52 74,78 46,78 38,52" fill="#263238" />
    <path d="M60 36 V18 M82 52 L100 44 M74 78 L86 96 M46 78 L34 96 M38 52 L20 44" stroke="#455a64" strokeWidth="3" />
  </>),
  ppball: (<>
    <circle cx="60" cy="60" r="42" fill="#fff6e0" stroke="#e0a030" strokeWidth="4" />
    <path d="M28 40 Q48 60 34 84" stroke="#c98a20" strokeWidth="5" fill="none" strokeLinecap="round" />
    <ellipse cx="44" cy="62" rx="10" ry="18" fill="#e9c88a" opacity=".7" />
  </>),
  airbed: (<>
    <rect x="8" y="42" width="104" height="48" rx="16" fill="#4aa3df" stroke="#2a6fa0" strokeWidth="4" />
    <path d="M36 46 V86 M60 46 V86 M84 46 V86" stroke="#2a6fa0" strokeWidth="3" />
    <rect x="14" y="48" width="92" height="10" rx="5" fill="#fff" fillOpacity=".3" />
  </>),
  balloon: (<>
    <path d="M60 6 C102 6 106 54 76 78 L44 78 C14 54 18 6 60 6 Z" fill="#e0513f" stroke="#9b2f23" strokeWidth="4" />
    <path d="M60 6 C46 28 46 58 60 78" stroke="#f2c14e" strokeWidth="9" fill="none" />
    <path d="M46 78 L50 94 M74 78 L70 94" stroke="#6d4c1f" strokeWidth="3" />
    <rect x="46" y="94" width="28" height="16" rx="3" fill="#a0682c" stroke="#6d4c1f" strokeWidth="3" />
  </>),
  shoe: (<>
    <path d="M10 84 L10 56 C10 46 18 44 26 48 L46 58 L70 54 C92 54 110 66 110 80 L110 88 L10 88 Z" fill="#fff" stroke="#455a64" strokeWidth="4" strokeLinejoin="round" />
    <rect x="8" y="86" width="104" height="14" rx="7" fill="#455a64" />
    <rect x="20" y="72" width="34" height="12" rx="6" fill="#7fd0e8" stroke="#2a8aa8" strokeWidth="2" />
    <path d="M52 60 l6 6 M60 58 l6 6" stroke="#455a64" strokeWidth="3" strokeLinecap="round" />
  </>),
  emergency: (<>
    <rect x="14" y="8" width="92" height="104" rx="8" fill="#f4efe6" stroke="#b9ab94" strokeWidth="4" />
    <rect x="22" y="16" width="76" height="88" rx="4" fill="#dff1f1" stroke="#9ec9c9" strokeWidth="3" />
    <circle cx="60" cy="60" r="26" fill="#fff" stroke="#c0506a" strokeWidth="4" />
    <path d="M60 46 v28 M46 60 h28" stroke="#c0506a" strokeWidth="8" strokeLinecap="round" />
    <circle cx="92" cy="62" r="4" fill="#b9ab94" />
  </>),
};

/** 플레이스홀더가 있는 환자·아이콘 id. BootScene이 Phaser 텍스처를 만든다. */
export const PATIENT_ICON_IDS = Object.keys(BODY);

/** 플레이스홀더 SVG 그림. BootScene이 Phaser 텍스처를 만들 때도 쓴다. */
export function PatientIconSvg({ id, size = 120, shadow = true }: { id: PatientId; size?: number; shadow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" style={{ overflow: 'visible' }}>
      {shadow && <ellipse cx="60" cy="112" rx="38" ry="6" fill="#000" opacity=".22" />}
      {BODY[id] ?? <circle cx="60" cy="60" r="40" fill="#b0bec5" />}
    </svg>
  );
}

/** codex 그림(public/assets/patients/<id>.webp)이 manifest에 있으면 그림, 없으면 SVG 플레이스홀더 */
export function PatientIcon({ id, size = 120, shadow = true }: { id: PatientId; size?: number; shadow?: boolean }) {
  const has = useDataStore(s => s.art.includes(`patients/${id}.webp`));
  if (!has) return <PatientIconSvg id={id} size={size} shadow={shadow} />;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {shadow && <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}><ellipse cx="60" cy="112" rx="38" ry="6" fill="#000" opacity=".22" /></svg>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/assets/patients/${id}.webp`} alt="" width={size} height={size} draggable={false} style={{ position: 'absolute', inset: 0, objectFit: 'contain', objectPosition: '50% 92%' }} />
    </div>
  );
}
