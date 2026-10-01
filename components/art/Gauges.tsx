import { useDataStore } from '@/game/dataStore';

/** 압력 센서 계기와 온도계 (SVG 코드 그림). value는 0~1이고 CSS transition으로 움직인다. 숫자는 쓰지 않는다. */
export function PressureGauge({ value, ms = 1600, size = 200 }: { value: number; ms?: number; size?: number }) {
  const angle = -120 + value * 240;
  const art = useDataStore(s => s.art.includes('equip/gauge.webp'));
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 200 224" aria-label="압력 센서 계기">
      {art ? <image href="/assets/equip/gauge.webp" x="8" y="8" width="184" height="226" preserveAspectRatio="xMidYMin meet" /> : <>
        <ellipse cx="100" cy="190" rx="60" ry="8" fill="#000" opacity=".22" />
        <circle cx="100" cy="100" r="88" fill="#eceff1" stroke="#546e7a" strokeWidth="8" />
        <circle cx="100" cy="100" r="74" fill="#fff" stroke="#b0bec5" strokeWidth="3" />
      </>}
      {Array.from({ length: 11 }, (_, i) => {
        const a = ((-120 + (i / 10) * 240) * Math.PI) / 180;
        const x1 = 100 + Math.sin(a) * 60, y1 = 100 - Math.cos(a) * 60, x2 = 100 + Math.sin(a) * 70, y2 = 100 - Math.cos(a) * 70;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#546e7a" strokeWidth={i % 5 === 0 ? 5 : 3} strokeLinecap="round" />;
      })}
      <path d="M40 130 A70 70 0 0 0 160 130" fill="none" stroke="#c0506a" strokeWidth="6" strokeLinecap="round" opacity=".35" />
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px', transition: `transform ${ms}ms ease-in-out` }}>
        <line x1="100" y1="112" x2="100" y2="38" stroke="#c0506a" strokeWidth="7" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="100" r="9" fill="#546e7a" />
    </svg>
  );
}

export function Thermometer({ value, ms = 1600, size = 200 }: { value: number; ms?: number; size?: number }) {
  const h = 20 + value * 120;
  const art = useDataStore(s => s.art.includes('equip/thermo.webp'));
  return (
    <svg width={size * 0.5} height={size} viewBox="0 0 100 200" aria-label="온도계">
      {art ? <image href="/assets/equip/thermo.webp" x="20" y="0" width="60" height="196" preserveAspectRatio="none" /> : <>
        <ellipse cx="50" cy="192" rx="36" ry="6" fill="#000" opacity=".22" />
        <rect x="34" y="8" width="32" height="150" rx="16" fill="#eceff1" stroke="#546e7a" strokeWidth="6" />
        <circle cx="50" cy="164" r="24" fill="#eceff1" stroke="#546e7a" strokeWidth="6" />
      </>}
      <circle cx="50" cy="164" r="14" fill="#e0513f" />
      <rect x="44" y={150 - h} width="12" height={h + 14} rx="6" fill="#e0513f"
        style={{ transition: `y ${ms}ms ease-in-out, height ${ms}ms ease-in-out` }} />
      {Array.from({ length: 7 }, (_, i) => <line key={i} x1="70" y1={30 + i * 18} x2={i % 3 === 0 ? 84 : 78} y2={30 + i * 18} stroke="#546e7a" strokeWidth="3" strokeLinecap="round" />)}
    </svg>
  );
}
