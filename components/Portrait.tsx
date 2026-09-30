/** 진료소장 초상 플레이스홀더 (SVG 코드 그림). 그림이 준비되면 codex 이미지로 교체한다. */
export function DoctorPortrait({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="48" r="46" fill="#e0f2f1" stroke="#f2c14e" strokeWidth="4" />
      <path d="M14 92 C16 66 32 60 48 60 C64 60 80 66 82 92 Z" fill="#ffffff" />
      <path d="M40 60 L48 76 L56 60 Z" fill="#7fc8c4" />
      <circle cx="48" cy="40" r="19" fill="#f6d2b0" />
      <path d="M28 38 C28 20 40 14 48 14 C58 14 68 22 68 38 C62 30 56 28 48 28 C40 28 34 30 28 38 Z" fill="#5b4a3b" />
      <circle cx="41" cy="42" r="2.6" fill="#3a2d22" /><circle cx="55" cy="42" r="2.6" fill="#3a2d22" />
      <path d="M42 50 Q48 55 54 50" stroke="#a65d4a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="48" cy="22" r="6" fill="#ffffff" stroke="#7fc8c4" strokeWidth="2" />
    </svg>
  );
}
