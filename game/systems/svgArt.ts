/**
 * 플레이스홀더 그림: AI가 SVG 코드로 직접 그린 단순 도형. 게임을 끝까지 완성한 뒤 codex 이미지로 하나씩 교체한다.
 * 이모지 금지, 글자 없음(조작 장면은 글 없이 안내). 좌표는 viewBox 기준.
 */
export interface SvgArt { svg: string; w: number; h: number }

const wrap = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

/** 진료소 대기실: 살짝 위에서 내려다본 3/4 시점. 뒤 벽 → 바닥 → 앞쪽 접수대 순으로 겹친다(깊이 정렬). */
export const clinicBackground = (): SvgArt => ({
  w: 1280, h: 800,
  svg: wrap(1280, 800, `
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9ea"/><stop offset="1" stop-color="#a9d3d6"/></linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a77c"/><stop offset="1" stop-color="#a98557"/></linearGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#d8f1ff"/></linearGradient>
    </defs>
    <rect width="1280" height="440" fill="url(#wall)"/>
    <rect y="410" width="1280" height="30" fill="#8bbfc3"/>
    <polygon points="0,440 1280,440 1280,800 0,800" fill="url(#floor)"/>
    <g stroke="#8d6b41" stroke-width="3" opacity=".55">
      <line x1="0" y1="560" x2="1280" y2="560"/><line x1="0" y1="690" x2="1280" y2="690"/>
      <line x1="640" y1="440" x2="640" y2="800"/><line x1="320" y1="440" x2="-120" y2="800"/><line x1="960" y1="440" x2="1400" y2="800"/>
      <line x1="160" y1="440" x2="-560" y2="800"/><line x1="1120" y1="440" x2="1840" y2="800"/>
    </g>
    <g><rect x="120" y="110" width="250" height="210" rx="14" fill="#fff"/><rect x="136" y="126" width="218" height="178" rx="8" fill="url(#sky)"/>
      <line x1="245" y1="126" x2="245" y2="304" stroke="#fff" stroke-width="8"/><line x1="136" y1="215" x2="354" y2="215" stroke="#fff" stroke-width="8"/>
      <ellipse cx="190" cy="170" rx="34" ry="14" fill="#fff" opacity=".9"/></g>
    <g><circle cx="640" cy="170" r="62" fill="#fff" stroke="#6b7f86" stroke-width="10"/><line x1="640" y1="170" x2="640" y2="126" stroke="#34464d" stroke-width="7" stroke-linecap="round"/><line x1="640" y1="170" x2="672" y2="186" stroke="#34464d" stroke-width="7" stroke-linecap="round"/></g>
    <g><rect x="900" y="120" width="260" height="190" rx="10" fill="#e8f4f4" stroke="#6b7f86" stroke-width="8"/>
      <circle cx="1030" cy="215" r="58" fill="#fff" stroke="#c0506a" stroke-width="8"/><line x1="1030" y1="215" x2="1062" y2="182" stroke="#c0506a" stroke-width="7" stroke-linecap="round"/>
      <g stroke="#6b7f86" stroke-width="4"><line x1="930" y1="290" x2="1130" y2="290"/></g></g>
    <ellipse cx="640" cy="742" rx="470" ry="30" fill="#000" opacity=".22"/>
    <rect x="170" y="640" width="940" height="90" rx="16" fill="#f4efe6" stroke="#b9ab94" stroke-width="6"/>
    <rect x="170" y="700" width="940" height="60" rx="16" fill="#d9ccb4"/>
    <g><ellipse cx="1180" cy="720" rx="44" ry="12" fill="#000" opacity=".22"/><path d="M1146 650 h68 l-10 66 h-48z" fill="#b5653f"/>
      <ellipse cx="1180" cy="648" rx="36" ry="10" fill="#3a2a1c"/><path d="M1180 648 c-30 -50 -34 -90 -4 -110 c8 34 10 68 4 110z" fill="#5fae5c"/><path d="M1180 648 c26 -40 50 -60 76 -60 c-6 32 -34 52 -76 60z" fill="#4e9a4c"/></g>
  `),
});

/** 검사대 배경 (Task 7에서 ClinicScene이 쓴다): 벽 + 사선 작업대 윗면. */
export const examBackground = (): SvgArt => ({
  w: 1280, h: 800,
  svg: wrap(1280, 800, `
    <defs>
      <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe0e3"/><stop offset="1" stop-color="#9ccbd0"/></linearGradient>
      <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcd2bd"/><stop offset="1" stop-color="#bfb197"/></linearGradient>
    </defs>
    <rect width="1280" height="800" fill="url(#w)"/>
    <polygon points="60,420 1220,420 1310,800 -30,800" fill="url(#t)"/>
    <polygon points="60,420 1220,420 1222,436 58,436" fill="#a89b80"/>
    <g stroke="#a89b80" stroke-width="3" opacity=".5"><line x1="640" y1="436" x2="640" y2="800"/><line x1="350" y1="436" x2="150" y2="800"/><line x1="930" y1="436" x2="1130" y2="800"/></g>
  `),
});

export const PLACEHOLDERS: Record<string, SvgArt> = {
  clinic_bg_ph: clinicBackground(),
  exam_bg_ph: examBackground(),
};

/** Phaser는 data: 로 시작하는 URL을 모두 base64로 보고 디코딩하므로 base64로 만든다. */
export const svgDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
