'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  findSelectedClass,
  isFreshPortfolioPreview,
  loadPortfolioDestinations,
  parseStudentNumbers,
  PORTFOLIO_BASE_URL,
  submitPortfolioGroup,
  validatePngBlob,
  validateStudentNumbers,
  type PortfolioDestinations,
  type PortfolioSubmitResult,
  type SelectedPortfolioDestination,
} from '@/game/portfolio';

interface PortfolioSubmitPanelProps {
  makePngBlob: () => Promise<Blob>;
  title: string;
  description: string;
}

type Phase = 'idle' | 'preview' | 'submitting' | 'done';
type ConfirmedPreview = {
  revision: number;
  blob: Blob;
  url: string;
  destination: SelectedPortfolioDestination;
  studentNumbers: string[];
};

export function PortfolioSubmitPanel({ makePngBlob, title, description }: PortfolioSubmitPanelProps) {
  const [destinations, setDestinations] = useState<PortfolioDestinations | null>(null);
  const [selected, setSelected] = useState<SelectedPortfolioDestination>({ teacherId: '', classId: '' });
  const [studentInput, setStudentInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [confirmedPreview, setConfirmedPreview] = useState<ConfirmedPreview | null>(null);
  const [status, setStatus] = useState('보낼 반과 번호를 고른 뒤 미리보기를 만드세요.');
  const [results, setResults] = useState<PortfolioSubmitResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const previewRevisionRef = useRef(0);

  useEffect(() => {
    let alive = true;
    loadPortfolioDestinations(PORTFOLIO_BASE_URL)
      .then(data => {
        if (!alive) return;
        setDestinations(data);
        setStatus('보낼 반과 번호를 고른 뒤 미리보기를 만드세요.');
      })
      .catch(() => {
        if (alive) setStatus('포트폴리오 대상 목록을 불러오지 못했어요. PNG 내려받기를 사용해 주세요.');
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => {
    if (confirmedPreview?.url) URL.revokeObjectURL(confirmedPreview.url);
  }, [confirmedPreview]);

  const selectedClass = useMemo(() => findSelectedClass(destinations, selected), [destinations, selected]);
  const studentNumbers = useMemo(() => parseStudentNumbers(studentInput).numbers, [studentInput]);
  const canPreview = Boolean(selectedClass && studentInput.trim() && phase !== 'submitting');
  const canSubmit = Boolean(confirmedPreview && phase === 'preview');

  const resetPreview = (message = '내용이 바뀌었어요. 미리보기를 다시 만들어 주세요.') => {
    previewRevisionRef.current += 1;
    setConfirmedPreview(current => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setResults([]);
    setPhase('idle');
    setStatus(message);
  };

  const onTeacherChange = (teacherId: string) => {
    setSelected({ teacherId, classId: '' });
    resetPreview();
  };

  const onClassChange = (classId: string) => {
    setSelected(s => ({ ...s, classId }));
    resetPreview();
  };

  const onStudentInput = (value: string) => {
    setStudentInput(value);
    resetPreview();
  };

  const makePreview = async () => {
    const numberError = validateStudentNumbers(studentInput);
    if (numberError) {
      setStatus(numberError);
      return;
    }
    if (!selectedClass) {
      setStatus('보낼 반을 먼저 골라 주세요.');
      return;
    }
    const revision = previewRevisionRef.current + 1;
    previewRevisionRef.current = revision;
    const snapshot = {
      destination: { ...selected },
      studentNumbers: [...studentNumbers],
    };
    setStatus('결과 이미지를 만드는 중이에요.');
    try {
      const blob = await makePngBlob();
      if (!isFreshPortfolioPreview(revision, previewRevisionRef.current)) return;
      const blobError = validatePngBlob(blob);
      if (blobError) {
        setStatus(blobError);
        return;
      }
      const url = URL.createObjectURL(blob);
      setConfirmedPreview(current => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { revision, blob, url, ...snapshot };
      });
      setPhase('preview');
      setStatus('미리보기를 확인한 뒤 포트폴리오에 보내기를 눌러 주세요.');
    } catch {
      if (!isFreshPortfolioPreview(revision, previewRevisionRef.current)) return;
      setStatus('결과 이미지를 만들지 못했어요. PNG 내려받기를 사용해 주세요.');
    }
  };

  const submit = async () => {
    if (!confirmedPreview || confirmedPreview.revision !== previewRevisionRef.current || !canSubmit) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('submitting');
    setStatus('포트폴리오에 보내는 중이에요.');
    const nextResults = await submitPortfolioGroup({
      destination: confirmedPreview.destination,
      studentNumbers: confirmedPreview.studentNumbers,
      blob: confirmedPreview.blob,
      title,
      description,
      signal: controller.signal,
    });
    abortRef.current = null;
    setResults(nextResults);
    const failed = nextResults.filter(r => !r.ok);
    if (failed.length === 0) {
      setPhase('done');
      setStatus('포트폴리오 등록이 끝났어요.');
    } else {
      setPhase('preview');
      setStudentInput(failed.map(r => r.studentNumber).join(', '));
      setStatus(`성공 ${nextResults.length - failed.length}명, 다시 보낼 번호 ${failed.map(r => r.studentNumber).join(', ')}`);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setStatus('보내기를 취소하고 있어요.');
  };

  const teacherOptions = destinations?.teachers ?? [];
  const classOptions = selectedClass?.teacher.classes ?? [];
  const previewUrl = confirmedPreview?.url ?? '';

  return (
    <section data-export-exclude="true" className="mt-4 rounded-2xl border-[4px] border-teal-300 bg-white px-4 py-3 text-slate-900">
      <div className="mb-2 text-[22px] font-black">포트폴리오 제출</div>
      <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-2">
        <label className="text-[14px] font-bold text-slate-600">
          과목/선생님
          <select
            value={selected.teacherId}
            onChange={e => onTeacherChange(e.target.value)}
            disabled={phase === 'submitting' || teacherOptions.length === 0}
            className="mt-1 h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-2 text-[16px] font-bold text-slate-900"
          >
            <option value="">선택</option>
            {teacherOptions.map(t => (
              <option key={t.teacherId} value={t.teacherId}>
                {t.subject}{t.teacherName ? ` / ${t.teacherName}` : ''} ({t.teacherId})
              </option>
            ))}
          </select>
        </label>
        <label className="text-[14px] font-bold text-slate-600">
          학년/반
          <select
            value={selected.classId}
            onChange={e => onClassChange(e.target.value)}
            disabled={phase === 'submitting' || classOptions.length === 0}
            className="mt-1 h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-2 text-[16px] font-bold text-slate-900"
          >
            <option value="">선택</option>
            {classOptions.map(c => (
              <option key={c.classId} value={c.classId}>{c.displayName ?? `${c.grade}학년 ${c.classNo}반`}</option>
            ))}
          </select>
        </label>
        <label className="text-[14px] font-bold text-slate-600">
          번호
          <input
            value={studentInput}
            onInput={e => onStudentInput(e.currentTarget.value)}
            disabled={phase === 'submitting'}
            placeholder="예: 7 또는 7, 8"
            className="mt-1 h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-[16px] font-bold text-slate-900"
          />
        </label>
      </div>
      {previewUrl && (
        <div className="mt-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="제출할 결과 미리보기" className="h-24 w-32 rounded-lg border-2 border-slate-300 object-contain bg-[#fbf6ea]" />
          <div className="text-[15px] leading-snug text-slate-600">이 이미지가 선택한 번호의 포트폴리오에 등록돼요.</div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={makePreview} disabled={!canPreview} className="h-11 rounded-xl bg-teal-300 px-4 text-[16px] font-black text-slate-900 disabled:opacity-40">미리보기 만들기</button>
        <button type="button" onClick={submit} disabled={!canSubmit} className="h-11 rounded-xl bg-amber-400 px-4 text-[16px] font-black text-slate-900 disabled:opacity-40">포트폴리오에 보내기</button>
        {phase === 'submitting' && <button type="button" onClick={cancel} className="h-11 rounded-xl bg-slate-700 px-4 text-[16px] font-black text-white">취소</button>}
      </div>
      <div className="mt-2 min-h-6 text-[15px] font-bold text-slate-600">{status}</div>
      {results.length > 0 && (
        <div className="mt-1 text-[14px] text-slate-500">
          성공 {results.filter(r => r.ok).length}명 / 실패 {results.filter(r => !r.ok).length}명
        </div>
      )}
    </section>
  );
}
