import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GET, POST } from '../app/api/admin/[file]/route';
import { DATA_FILES, filePathOf } from '../game/adminData';

let tmp: string;
const ctx = (file: string) => ({ params: Promise.resolve({ file }) });
const post = (file: string, body: unknown) =>
  POST(new Request('http://x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) as never, ctx(file));
const read = (f: (typeof DATA_FILES)[number]) => JSON.parse(fs.readFileSync(path.join(tmp, filePathOf(f)), 'utf-8'));
const raw = (f: (typeof DATA_FILES)[number]) => fs.readFileSync(path.join(tmp, filePathOf(f)), 'utf-8');

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-'));
  for (const f of DATA_FILES) { fs.mkdirSync(path.dirname(path.join(tmp, filePathOf(f))), { recursive: true }); fs.copyFileSync(filePathOf(f), path.join(tmp, filePathOf(f))); }
  vi.spyOn(process, 'cwd').mockReturnValue(tmp);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); fs.rmSync(tmp, { recursive: true, force: true }); });

describe('admin route', () => {
  it('허용 파일만: 알 수 없는 이름·경로 조작은 400', async () => {
    for (const n of ['foo', '../package', '..%2Fpackage', 'patients.json', '']) {
      expect((await GET({} as never, ctx(n))).status).toBe(400);
      expect((await post(n, [])).status).toBe(400);
    }
  });
  it('GET은 한글이 그대로 온다', async () => {
    const r = await GET({} as never, ctx('patients'));
    expect((await r.json())[0].name).toBe('고무공');
  });
  it('정상 저장: 들여쓰기·UTF-8 유지', async () => {
    const mg = read('minigame-config'); mg.examTimeLimitMs = 70000;
    expect((await post('minigame-config', mg)).status).toBe(200);
    expect(raw('minigame-config')).toContain('"examTimeLimitMs": 70000');
    expect(raw('minigame-config').endsWith('\n')).toBe(true);
  });
  it('검증에 실패하거나 깨진 JSON이면 400, 파일은 그대로', async () => {
    const before = raw('minigame-config');
    const bad = read('minigame-config'); bad.particleCount = 0;
    expect((await post('minigame-config', bad)).status).toBe(400);
    expect((await post('minigame-config', '{oops')).status).toBe(400);
    expect(raw('minigame-config')).toBe(before);
  });
  it('환자: 금지어·verified:false·실험 설정과 어긋나는 값은 400', async () => {
    const ps = read('patients'); ps[0].verified = false;
    expect((await post('patients', ps)).status).toBe(400);
    const ps2 = read('patients'); ps2[0].name = '분자 공';
    const r = await post('patients', ps2);
    expect(r.status).toBe(400); expect(JSON.stringify(await r.json())).toContain('금지어');
    const ex = read('experiments'); ex.dip.hotStep = 2;   // 담그기 환자의 step(3)과 어긋남
    expect((await post('experiments', ex)).status).toBe(400);
  });
  it('대사: 2문장을 넘으면 400', async () => {
    const d = read('dialog-config'); d.intro[0] = '하나. 둘. 셋.';
    expect((await post('dialog-config', d)).status).toBe(400);
  });
  it('배치: 무대 밖 좌표는 400, 음량 범위 밖도 400', async () => {
    const l = read('layout'); l.clinic.gauge.x = 5000;
    expect((await post('layout', l)).status).toBe(400);
    const a = read('audio-config'); a.sfxVolume = 3;
    expect((await post('audio-config', a)).status).toBe(400);
  });
  it('에셋 목록(manifest): 알려진 그림 파일만', async () => {
    expect((await post('manifest', ['bg/exam.webp'])).status).toBe(200);
    expect((await post('manifest', ['bg/nope.webp'])).status).toBe(400);
    expect((await post('manifest', 'x')).status).toBe(400);
  });
  it('숙제 카드에 답 필드를 넣으면 400', async () => {
    const h = read('homework-cards'); h[0].answer = 'x';
    expect((await post('homework-cards', h)).status).toBe(400);
  });
  it('production은 403', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await post('minigame-config', read('minigame-config'))).status).toBe(403);
  });
});
