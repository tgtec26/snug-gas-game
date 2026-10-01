import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { DATA_FILES, filePathOf, validateFile, type DataFile } from '@/game/adminData';

const isDataFile = (f: string): f is DataFile => (DATA_FILES as readonly string[]).includes(f);
const abs = (f: DataFile) => path.resolve(process.cwd(), filePathOf(f));
const readJson = async (f: DataFile) => JSON.parse(await fs.readFile(abs(f), 'utf-8'));

export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!isDataFile(file)) return NextResponse.json({ error: 'unknown file' }, { status: 400 });
  try {
    return NextResponse.json(await readJson(file));
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}

/** 저장은 로컬(pnpm dev)에서만. 배포 서버는 403. 검증 오류가 있으면 파일을 바꾸지 않는다. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Admin API disabled in production' }, { status: 403 });
  }
  const { file } = await ctx.params;
  if (!isDataFile(file)) return NextResponse.json({ error: 'unknown file' }, { status: 400 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  let all: Record<DataFile, unknown>;
  try {
    all = Object.fromEntries(await Promise.all(DATA_FILES.map(async f => [f, await readJson(f)]))) as Record<DataFile, unknown>;
  } catch {
    return NextResponse.json({ error: 'data read failed' }, { status: 500 });
  }
  const errors = validateFile(file, body, all);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  await fs.writeFile(abs(file), JSON.stringify(body, null, 2) + '\n', 'utf-8');
  return NextResponse.json({ ok: true, file: `${file}.json` });
}
