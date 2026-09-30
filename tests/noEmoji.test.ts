import { it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// 지침 9번: 이모지 사용 금지. 화면에 나가는 모든 소스와 데이터를 검사한다.
const ROOT = path.join(__dirname, '..');
const DIRS = ['app', 'components', 'game', 'public/data'];
const EMOJI = /\p{Extended_Pictographic}/u;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

it('소스와 데이터에 이모지가 없다', () => {
  const hits: string[] = [];
  for (const d of DIRS) for (const f of walk(path.join(ROOT, d))) {
    const m = fs.readFileSync(f, 'utf8').match(EMOJI);
    if (m) hits.push(`${path.relative(ROOT, f)}: ${m[0]}`);
  }
  expect(hits).toEqual([]);
});
