import { describe, expect, it, vi } from 'vitest';
import {
  findSelectedClass,
  makeIdempotencyKey,
  parseStudentNumbers,
  submitPortfolioGroup,
  validatePngBlob,
  validateStudentNumbers,
} from '../game/portfolio';

const png = () => new Blob(['png-bytes'], { type: 'image/png' });

describe('portfolio helpers', () => {
  it('parses group student numbers without exposing names', () => {
    expect(parseStudentNumbers('07, 8 8 a 0 12')).toEqual({
      numbers: ['7', '8', '12'],
      rejected: ['a', '0'],
    });
  });

  it('validates number limits and PNG files', () => {
    expect(validateStudentNumbers('')).toBe('학생 번호를 입력해 주세요.');
    expect(validateStudentNumbers('1 2 3 4 5 6 7 8 9')).toContain('8명');
    expect(validateStudentNumbers('1, 2')).toBeNull();
    expect(validatePngBlob(png())).toBeNull();
    expect(validatePngBlob(new Blob(['x'], { type: 'image/jpeg' }))).toContain('PNG');
  });

  it('keeps teacher ambiguity visible by selecting teachers by id, not subject', () => {
    const data = {
      teachers: [
        { teacherId: 'science-a', subject: '과학', teacherName: '김선생님', classes: [{ classId: 'a-1', grade: 1, classNo: 1 }] },
        { teacherId: 'science-b', subject: '과학', teacherName: '박선생님', classes: [{ classId: 'b-1', grade: 1, classNo: 1 }] },
      ],
    };
    expect(findSelectedClass(data, { teacherId: 'science-b', classId: 'b-1' })?.teacher.teacherName).toBe('박선생님');
  });

  it('uses stable per-day idempotency keys', () => {
    expect(makeIdempotencyKey({
      gameId: 'air-clinic',
      teacherId: 'science-b',
      classId: 'b-1',
      studentNumber: '7',
      now: new Date('2026-10-03T12:00:00Z'),
    })).toBe('air-clinic:science-b:b-1:7:2026-10-03');
  });
});

describe('submitPortfolioGroup', () => {
  it('binds session, file, destination, type, and size for each student', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/upload-session')) {
        const request = JSON.parse(String(init?.body));
        return Response.json({
          uploadToken: `token-${request.studentNumber}`,
          files: [{ fileId: `file-${request.studentNumber}`, uploadUrl: `https://upload.test/${request.studentNumber}` }],
        });
      }
      if (url.startsWith('https://upload.test/')) return new Response(null, { status: 200 });
      if (url.endsWith('/upload-finalize')) return Response.json({ postId: 'post-ok' });
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    const results = await submitPortfolioGroup({
      baseUrl: 'https://portfolio.test',
      destination: { teacherId: 'science-b', classId: 'b-1' },
      studentNumbers: ['7', '8'],
      blob: png(),
      title: '공기 진료소 결과',
      description: '별 3개',
      now: new Date('2026-10-03T00:00:00Z'),
      fetcher,
    });

    expect(results).toEqual([
      { studentNumber: '7', ok: true, postId: 'post-ok' },
      { studentNumber: '8', ok: true, postId: 'post-ok' },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(6);
    const firstSession = JSON.parse(String(calls[0].init?.body));
    expect(firstSession).toMatchObject({
      classId: 'b-1',
      studentNumber: '7',
      idempotencyKey: 'air-clinic:science-b:b-1:7:2026-10-03',
      files: [{ name: 'air-clinic-b-1-7.png', mimeType: 'image/png', size: png().size }],
    });
    const firstFinalize = JSON.parse(String(calls[2].init?.body));
    expect(firstFinalize).toMatchObject({
      classId: 'b-1',
      studentNumber: '7',
      type: 'image',
      uploadToken: 'token-7',
      driveFileIds: ['file-7'],
      mimeTypes: ['image/png'],
      uploadedFiles: [{ fileId: 'file-7', mimeType: 'image/png', size: png().size }],
    });
  });

  it('returns partial failures so only failed student numbers need retry', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/upload-session')) {
        const request = JSON.parse(String(init?.body));
        return Response.json({
          uploadToken: `token-${request.studentNumber}`,
          files: [{ fileId: `file-${request.studentNumber}`, uploadUrl: `https://upload.test/${request.studentNumber}` }],
        });
      }
      if (url === 'https://upload.test/8') return new Response(null, { status: 503 });
      if (url.startsWith('https://upload.test/')) return new Response(null, { status: 200 });
      if (url.endsWith('/upload-finalize')) return Response.json({ postId: 'post-ok' });
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    const results = await submitPortfolioGroup({
      baseUrl: 'https://portfolio.test',
      destination: { teacherId: 'science-b', classId: 'b-1' },
      studentNumbers: ['7', '8'],
      blob: png(),
      title: '공기 진료소 결과',
      description: '별 3개',
      fetcher,
    });

    expect(results.map(r => [r.studentNumber, r.ok])).toEqual([['7', true], ['8', false]]);
    expect(results[1].error).toBe('file-upload-failed');
  });
});
