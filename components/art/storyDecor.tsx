import type { StorySceneId } from '@/game/story';

/**
 * 사연 장면 배경 (SVG 코드 그림, 글 없음). viewBox 560×400. 환자 아이콘은 (280,270) 근처에 겹쳐 놓인다.
 * codex 이미지로 교체 예정. STORY_SCENES의 모든 id에 그림이 있어야 컴파일된다.
 */
const Sky = ({ a, b }: { a: string; b: string }) => (
  <>
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
    <rect width="560" height="400" fill="url(#sky)" />
  </>
);
const Ground = ({ color, y = 330 }: { color: string; y?: number }) => <rect y={y} width="560" height={400 - y} fill={color} />;

export const STORY_DECOR: Record<StorySceneId, React.ReactNode> = {
  'sit-on-ball': (<>
    <Sky a="#d8f1ff" b="#f4fbff" /><Ground color="#c9a77c" />
    {/* 공 위에 앉는 사람 */}
    <g><rect x="246" y="96" width="68" height="74" rx="22" fill="#4a7fbf" /><circle cx="280" cy="70" r="26" fill="#f6d2b0" />
      <path d="M254 66 C254 44 270 40 280 40 C294 40 306 50 306 66 C298 58 290 56 280 56 C270 56 262 58 254 66 Z" fill="#5b4a3b" />
      <rect x="240" y="160" width="100" height="26" rx="13" fill="#2f4f86" /><rect x="326" y="170" width="18" height="60" rx="9" fill="#2f4f86" />
      <rect x="216" y="170" width="18" height="60" rx="9" fill="#2f4f86" /></g>
  </>),
  'mountain': (<>
    <Sky a="#7cc7ff" b="#e3f4ff" />
    <polygon points="-20,340 150,120 320,340" fill="#8a9ba8" /><polygon points="150,120 185,172 150,160 120,176" fill="#fff" />
    <polygon points="200,340 390,70 580,340" fill="#6f8290" /><polygon points="390,70 430,134 392,120 350,140" fill="#fff" />
    <ellipse cx="90" cy="70" rx="44" ry="16" fill="#fff" opacity=".9" />
    <Ground color="#7aa35a" y={332} />
    <path d="M40 332 Q200 280 330 200" stroke="#c9b48a" strokeWidth="14" fill="none" strokeLinecap="round" opacity=".8" />
  </>),
  'cold-outside': (<>
    <Sky a="#7d97c9" b="#c7d6ee" /><Ground color="#eef4fb" y={320} />
    {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={30 + ((i * 97) % 500)} cy={30 + ((i * 53) % 260)} r={3 + (i % 3)} fill="#fff" opacity=".9" />)}
    <g><rect x="80" y="210" width="16" height="120" fill="#6d5137" /><path d="M88 230 L50 190 M88 250 L126 200" stroke="#6d5137" strokeWidth="8" strokeLinecap="round" /></g>
  </>),
  'winter-field': (<>
    <Sky a="#b7c9e0" b="#e8eef5" /><Ground color="#f4f7fb" y={300} />
    <g stroke="#9aa7b4" strokeWidth="6"><line x1="60" y1="300" x2="60" y2="210" /><line x1="200" y1="300" x2="200" y2="210" /><line x1="60" y1="210" x2="200" y2="210" />
      <path d="M60 210 L200 300 M200 210 L60 300" strokeWidth="2" opacity=".6" /></g>
    <g><rect x="470" y="200" width="14" height="120" fill="#6d5137" /><path d="M477 230 L445 196 M477 250 L511 210" stroke="#6d5137" strokeWidth="7" strokeLinecap="round" /></g>
    {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={40 + ((i * 131) % 480)} cy={20 + ((i * 71) % 200)} r={3} fill="#fff" />)}
  </>),
  'dented-ball': (<>
    <Sky a="#f3ead8" b="#e6dcc5" /><Ground color="#b89467" y={310} />
    <rect x="120" y="300" width="320" height="22" rx="8" fill="#8d6b41" /><rect x="140" y="320" width="18" height="70" fill="#8d6b41" /><rect x="402" y="320" width="18" height="70" fill="#8d6b41" />
    <g><rect x="470" y="60" width="60" height="110" rx="10" fill="#dce8ea" stroke="#9ec9c9" strokeWidth="4" /><rect x="480" y="72" width="40" height="40" rx="6" fill="#fff" /></g>
  </>),
  'lie-on-bed': (<>
    <Sky a="#e9f3f4" b="#f7fbfb" /><Ground color="#c9a77c" y={320} />
    {/* 침대 위에 누운 사람 */}
    <g><rect x="170" y="150" width="220" height="44" rx="22" fill="#d66a54" /><circle cx="386" cy="168" r="26" fill="#f6d2b0" />
      <path d="M366 160 C366 140 380 136 392 138 C404 142 412 152 410 166 C402 158 392 154 380 156 Z" fill="#5b4a3b" />
      <rect x="150" y="176" width="64" height="26" rx="13" fill="#2f4f86" /></g>
    <rect x="60" y="60" width="90" height="70" rx="8" fill="#fff" stroke="#b0bec5" strokeWidth="4" /><circle cx="105" cy="95" r="18" fill="#ffe082" />
  </>),
  'heat-balloon': (<>
    <Sky a="#7cc7ff" b="#fbe6c7" /><Ground color="#7aa35a" y={340} />
    <ellipse cx="90" cy="80" rx="46" ry="16" fill="#fff" opacity=".9" /><ellipse cx="470" cy="120" rx="50" ry="18" fill="#fff" opacity=".85" />
    {/* 아래에서 가열하는 불꽃 */}
    <g><path d="M280 340 C248 330 240 296 262 270 C266 290 280 292 280 270 C300 290 318 318 298 340 Z" fill="#ff8a3d" /><path d="M280 340 C266 334 264 312 278 298 C290 312 296 326 286 340 Z" fill="#ffd166" /></g>
  </>),
  'landing': (<>
    <Sky a="#dff0f4" b="#f4fafb" /><Ground color="#9aa7b4" y={330} />
    <g stroke="#90a4ae" strokeWidth="6" strokeLinecap="round" opacity=".8"><line x1="230" y1="40" x2="230" y2="110" /><line x1="280" y1="20" x2="280" y2="110" /><line x1="330" y1="40" x2="330" y2="110" /></g>
    <g><rect x="256" y="120" width="48" height="110" rx="18" fill="#4a7fbf" /><circle cx="280" cy="98" r="22" fill="#f6d2b0" /></g>
  </>),
};
