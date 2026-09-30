import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Modal, type ModalProps } from './Modal';
import { cn } from '../../../utils/cn';
import type { ConfirmOptions } from '../../common/DialogProvider';

/* ─────────────────────────────────────────────
   서류 작성 모달 공통 셸 (기획 3-5)
   - 모바일 전체 화면 · 데스크톱 가운데 고정 높이(탭을 바꿔도 창 크기가 흔들리지 않게)
   - 밝은 헤더: 제목 · 한 줄 설명 · 상태 배지 · 저장 상태
   - X · ESC · 배경 클릭 모두 onBeforeClose(자동 저장·확인)를 거친다
   - 하단 고정 액션 바(왼쪽 보조 · 오른쪽 주 버튼)
   ───────────────────────────────────────────── */

export type DocSaveState =
  | { status: 'idle' }
  | { status: 'dirty' }
  | { status: 'saving' }
  | { status: 'saved'; at: number }
  | { status: 'error' };

/** device: 이 기기(브라우저)에만 저장 · server: 사건 기록(서버)에 저장 */
export type DocSaveTarget = 'device' | 'server';

function toMs(v: string | number | Date | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const ms = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

export function formatSavedAt(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? time : `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

/** 저장 상태 한 줄 (저장 중 · 저장됨 · 저장 전 변경 · 실패) */
export function DocSaveStatus({
  state,
  target = 'device',
  dirtyLabel = '저장 전 변경이 있어요',
  idleLabel,
  className,
}: {
  state: DocSaveState;
  target?: DocSaveTarget;
  dirtyLabel?: string;
  /** 저장 기록이 없을 때 보여 줄 안내(예: '닫으면 자동 저장돼요') */
  idleLabel?: string;
  className?: string;
}) {
  let icon: React.ReactNode = null;
  let text = '';
  let tone = 'text-slate-600';
  switch (state.status) {
    case 'saving':
      icon = <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />;
      text = '저장 중…';
      break;
    case 'saved':
      icon = <Check className="w-3.5 h-3.5" aria-hidden="true" />;
      text = `${target === 'device' ? '이 기기에 ' : ''}저장됨 · ${formatSavedAt(state.at)}`;
      tone = 'text-emerald-700';
      break;
    case 'dirty':
      icon = <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />;
      text = dirtyLabel;
      tone = 'text-amber-800';
      break;
    case 'error':
      icon = <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />;
      text = '저장하지 못했어요. 잠시 후 다시 시도해 주세요';
      tone = 'text-red-700';
      break;
    default:
      if (!idleLabel) return null;
      text = idleLabel;
  }
  return (
    <p role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-xs font-bold', tone, className)}>
      {icon}
      {text}
    </p>
  );
}

/**
 * 서류 초안 저장 상태 관리
 * - ready가 true가 된 순간의 입력값을 기준점으로 삼아 변경 여부(isDirty)를 계산한다
 * - auto: 입력이 멈추고 delay ms 뒤 자동 저장(이 기기 저장처럼 가벼운 저장만). 화면이 사라질 때 남은 변경도 저장
 * - saveNow: 즉시 저장(닫기 전·임시 저장 버튼). 변경이 없으면 저장하지 않고 true
 * - save는 실패 시 throw 하거나 false를 돌려준다
 */
export function useDocAutosave({
  snapshot,
  ready,
  save,
  auto = false,
  delay = 1200,
  initialSavedAt,
}: {
  snapshot: string;
  ready: boolean;
  save: () => void | boolean | Promise<void | boolean>;
  auto?: boolean;
  delay?: number;
  initialSavedAt?: string | number | Date | null;
}) {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(() => toMs(initialSavedAt));
  const snapshotRef = useRef(snapshot);
  const saveRef = useRef(save);
  const baselineRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<number | null>(null);
  const autoRef = useRef(auto);
  snapshotRef.current = snapshot;
  saveRef.current = save;
  autoRef.current = auto;

  useEffect(() => {
    if (ready && baselineRef.current === null) {
      baselineRef.current = snapshot;
      setBaseline(snapshot);
    }
  }, [ready, snapshot]);

  useEffect(() => {
    if (initialSavedAt === undefined) return;
    const ms = toMs(initialSavedAt);
    if (ms) setSavedAt((prev) => (prev && prev > ms ? prev : ms));
  }, [initialSavedAt]);

  const isDirty = baseline !== null && snapshot !== baseline;

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inFlightRef.current) await inFlightRef.current;
    const current = snapshotRef.current;
    if (baselineRef.current === null || current === baselineRef.current) return true;
    const run = (async () => {
      setStatus('saving');
      try {
        const res = await saveRef.current();
        if (res === false) throw new Error('save returned false');
        baselineRef.current = current;
        setBaseline(current);
        setSavedAt(Date.now());
        setStatus('idle');
        return true;
      } catch (e) {
        console.error('[useDocAutosave] save failed', e);
        setStatus('error');
        return false;
      }
    })();
    inFlightRef.current = run;
    const ok = await run;
    inFlightRef.current = null;
    return ok;
  }, []);

  /**
   * 모달이 직접 저장·제출했을 때 저장된 상태로 표시.
   * setState 직후처럼 화면이 아직 새 값으로 그려지기 전이면 저장한 값의 직렬화(snapshot)를 함께 넘긴다
   */
  const markSaved = useCallback((at?: string | number | Date | null, savedSnapshot?: string) => {
    const snap = savedSnapshot ?? snapshotRef.current;
    baselineRef.current = snap;
    setBaseline(snap);
    setSavedAt(toMs(at ?? null) ?? Date.now());
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (!auto || !ready || baselineRef.current === null || snapshot === baselineRef.current) return;
    const t = window.setTimeout(() => {
      timerRef.current = null;
      void saveNow();
    }, delay);
    timerRef.current = t;
    return () => {
      window.clearTimeout(t);
      if (timerRef.current === t) timerRef.current = null;
    };
  }, [auto, ready, snapshot, delay, saveNow]);

  // 모달이 다른 경로로 사라질 때(부모 화면 전환 등) 남은 변경을 저장한다(자동 저장 모드만)
  useEffect(
    () => () => {
      if (autoRef.current && baselineRef.current !== null && snapshotRef.current !== baselineRef.current) {
        try {
          void saveRef.current();
        } catch (e) {
          console.error('[useDocAutosave] save on unmount failed', e);
        }
      }
    },
    [],
  );

  const saveState: DocSaveState =
    status === 'saving'
      ? { status: 'saving' }
      : status === 'error'
        ? { status: 'error' }
        : isDirty
          ? { status: 'dirty' }
          : savedAt
            ? { status: 'saved', at: savedAt }
            : { status: 'idle' };

  return { saveState, isDirty, saveNow, markSaved };
}

/** 제출 전 확인 창 문구: 무엇을 누구에게 보내는지 + 요약 몇 줄 */
export function buildSubmitConfirm({
  title,
  lines,
  note,
  confirmText = '제출하기',
  cancelText = '다시 확인',
}: {
  title: string;
  lines?: Array<string | false | null | undefined>;
  note?: string;
  confirmText?: string;
  cancelText?: string;
}): ConfirmOptions {
  const body = (lines || []).filter(Boolean).map((l) => `· ${l}`).join('\n');
  return {
    title,
    message: [body, note].filter(Boolean).join('\n\n'),
    confirmText,
    cancelText,
    variant: 'primary',
  };
}

export interface DocModalProps extends Omit<ModalProps, 'open' | 'mobile' | 'size' | 'meta'> {
  /** 부모가 열려 있을 때만 렌더링하므로 기본 true */
  open?: boolean;
  size?: ModalProps['size'];
  /** 제목 아래 상태 배지(제출함 등) */
  badges?: React.ReactNode;
  saveState?: DocSaveState;
  saveTarget?: DocSaveTarget;
  dirtyLabel?: string;
  idleLabel?: string;
}

export function DocModal({
  open = true,
  size = 'xl',
  badges,
  saveState,
  saveTarget,
  dirtyLabel,
  idleLabel,
  className,
  bodyClassName,
  footerClassName,
  ...rest
}: DocModalProps) {
  const status = saveState ? (
    <DocSaveStatus state={saveState} target={saveTarget} dirtyLabel={dirtyLabel} idleLabel={idleLabel} />
  ) : null;
  const meta = badges || status ? (
    <>
      {badges}
      {status}
    </>
  ) : undefined;
  return (
    <Modal
      open={open}
      size={size}
      mobile="fullscreen"
      meta={meta}
      className={cn('sm:h-[min(56rem,92dvh)] sm:max-h-[92dvh]', className)}
      bodyClassName={cn('bg-slate-50 px-4 py-5 sm:px-6', bodyClassName)}
      footerClassName={cn('justify-between', footerClassName)}
      {...rest}
    />
  );
}

export default DocModal;
