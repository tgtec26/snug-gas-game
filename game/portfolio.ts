export const PORTFOLIO_BASE_URL = 'https://snug-portfolio.vercel.app';
export const GAS_GAME_ID = 'air-clinic';

export interface PortfolioClass {
  classId: string;
  grade: number;
  classNo: number;
  displayName?: string;
}

export interface PortfolioTeacher {
  teacherId: string;
  subject: string;
  teacherName?: string;
  classes: PortfolioClass[];
}

export interface PortfolioDestinations {
  teachers: PortfolioTeacher[];
}

export interface SelectedPortfolioDestination {
  teacherId: string;
  classId: string;
}

export interface StudentNumberParse {
  numbers: string[];
  rejected: string[];
}

export interface UploadFileRequest {
  name: string;
  mimeType: 'image/png';
  size: number;
}

export interface UploadSessionRequest {
  classId: string;
  studentNumber: string;
  idempotencyKey: string;
  files: UploadFileRequest[];
  title: string;
}

export interface UploadSessionResponse {
  uploadToken: string;
  fileId?: string;
  uploadUrl?: string;
  files?: { fileId: string; uploadUrl: string; name?: string; mimeType?: string; size?: number }[];
}

export interface UploadFinalizeRequest {
  classId: string;
  studentNumber: string;
  idempotencyKey: string;
  type: 'image';
  title: string;
  description: string;
  uploadToken: string;
  driveFileIds: string[];
  mimeTypes: ['image/png'];
  uploadedFiles: { fileId: string; name: string; mimeType: 'image/png'; size: number }[];
}

export interface PortfolioSubmitResult {
  studentNumber: string;
  ok: boolean;
  postId?: string;
  error?: string;
}

export interface SubmitPortfolioGroupOptions {
  baseUrl?: string;
  destination: SelectedPortfolioDestination;
  studentNumbers: string[];
  blob: Blob;
  title: string;
  description: string;
  gameId?: string;
  now?: Date;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

const MAX_GROUP_SIZE = 8;
const MAX_PNG_BYTES = 8 * 1024 * 1024;

export function parseStudentNumbers(input: string): StudentNumberParse {
  const seen = new Set<string>();
  const numbers: string[] = [];
  const rejected: string[] = [];
  for (const raw of input.split(/[,\s]+/)) {
    const value = raw.trim();
    if (!value) continue;
    if (!/^\d{1,2}$/.test(value)) {
      rejected.push(value);
      continue;
    }
    const normalized = String(Number(value));
    if (Number(normalized) < 1) {
      rejected.push(value);
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      numbers.push(normalized);
    }
  }
  return { numbers, rejected };
}

export function validateStudentNumbers(input: string): string | null {
  const parsed = parseStudentNumbers(input);
  if (parsed.numbers.length === 0) return '학생 번호를 입력해 주세요.';
  if (parsed.rejected.length > 0) return `번호만 입력해 주세요: ${parsed.rejected.join(', ')}`;
  if (parsed.numbers.length > MAX_GROUP_SIZE) return `한 번에 ${MAX_GROUP_SIZE}명까지 보낼 수 있어요.`;
  return null;
}

export function validatePngBlob(blob: Blob): string | null {
  if (blob.type && blob.type !== 'image/png') return 'PNG 이미지로만 보낼 수 있어요.';
  if (blob.size <= 0) return '결과 이미지가 비어 있어요.';
  if (blob.size > MAX_PNG_BYTES) return '결과 이미지가 너무 커요. 내려받기만 해 주세요.';
  return null;
}

export function isFreshPortfolioPreview(startedRevision: number, currentRevision: number): boolean {
  return startedRevision === currentRevision;
}

export function findSelectedClass(
  destinations: PortfolioDestinations | null,
  selected: SelectedPortfolioDestination,
): { teacher: PortfolioTeacher; klass: PortfolioClass } | null {
  const teacher = destinations?.teachers.find(t => t.teacherId === selected.teacherId);
  const klass = teacher?.classes.find(c => c.classId === selected.classId);
  return teacher && klass ? { teacher, klass } : null;
}

export function makeIdempotencyKey(args: {
  gameId: string;
  teacherId: string;
  classId: string;
  studentNumber: string;
  now: Date;
}): string {
  const day = args.now.toISOString().slice(0, 10);
  return [args.gameId, args.teacherId, args.classId, args.studentNumber, day].join(':');
}

export async function loadPortfolioDestinations(baseUrl = PORTFOLIO_BASE_URL, fetcher: typeof fetch = fetch): Promise<PortfolioDestinations> {
  const response = await fetcher(`${baseUrl}/api/public/portfolio-destinations`, { method: 'GET' });
  if (!response.ok) throw new Error('destination-load-failed');
  const data = await response.json() as PortfolioDestinations;
  if (!Array.isArray(data.teachers)) throw new Error('destination-shape-invalid');
  return data;
}

export async function submitPortfolioGroup(options: SubmitPortfolioGroupOptions): Promise<PortfolioSubmitResult[]> {
  const baseUrl = options.baseUrl ?? PORTFOLIO_BASE_URL;
  const fetcher = options.fetcher ?? fetch;
  const fileError = validatePngBlob(options.blob);
  if (fileError) return options.studentNumbers.map(studentNumber => ({ studentNumber, ok: false, error: fileError }));

  const now = options.now ?? new Date();
  const gameId = options.gameId ?? GAS_GAME_ID;
  const results: PortfolioSubmitResult[] = [];

  for (const studentNumber of options.studentNumbers) {
    const idempotencyKey = makeIdempotencyKey({
      gameId,
      teacherId: options.destination.teacherId,
      classId: options.destination.classId,
      studentNumber,
      now,
    });
    const fileName = `${gameId}-${options.destination.classId}-${studentNumber}.png`;
    const file = { name: fileName, mimeType: 'image/png' as const, size: options.blob.size };
    try {
      const sessionResponse = await fetcher(`${baseUrl}/api/t/${encodeURIComponent(options.destination.teacherId)}/upload-session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          classId: options.destination.classId,
          studentNumber,
          idempotencyKey,
          files: [file],
          title: options.title,
        } satisfies UploadSessionRequest),
        signal: options.signal,
      });
      if (!sessionResponse.ok) throw new Error('upload-session-failed');
      const session = await sessionResponse.json() as UploadSessionResponse;
      const uploadTarget = session.files?.[0] ?? (session.fileId && session.uploadUrl ? { fileId: session.fileId, uploadUrl: session.uploadUrl } : null);
      if (!uploadTarget?.fileId || !uploadTarget.uploadUrl || !session.uploadToken) throw new Error('upload-session-invalid');

      const uploadResponse = await fetcher(uploadTarget.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: options.blob,
        signal: options.signal,
      });
      if (!uploadResponse.ok) throw new Error('file-upload-failed');

      const finalizeResponse = await fetcher(`${baseUrl}/api/t/${encodeURIComponent(options.destination.teacherId)}/upload-finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          classId: options.destination.classId,
          studentNumber,
          idempotencyKey,
          type: 'image',
          title: options.title,
          description: options.description,
          uploadToken: session.uploadToken,
          driveFileIds: [uploadTarget.fileId],
          mimeTypes: ['image/png'],
          uploadedFiles: [{ ...file, fileId: uploadTarget.fileId }],
        } satisfies UploadFinalizeRequest),
        signal: options.signal,
      });
      if (!finalizeResponse.ok) throw new Error('upload-finalize-failed');
      const finalized = await finalizeResponse.json().catch(() => ({})) as { postId?: string };
      results.push({ studentNumber, ok: true, postId: finalized.postId });
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? '보내기를 취소했어요.'
        : error instanceof Error ? error.message : 'upload-failed';
      results.push({ studentNumber, ok: false, error: message });
      if (options.signal?.aborted) break;
    }
  }

  return results;
}
