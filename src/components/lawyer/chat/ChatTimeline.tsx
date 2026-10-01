import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowDown, CheckCircle2, FileText, Info, MessageSquareDashed, PhoneCall } from 'lucide-react';
import type { ConsultMessage, ConsultRequest } from '../../../types';
import { buildChatTimeline, type ChatTimelineItem } from './chatSelectors';
import { formatChatTime, formatDayDivider, formatFullDateTime, localDayKey } from './chatFormat';

// ── 본문 표시: 줄바꿈 보존 + https 링크 + 대괄호 제목 ──

const URL_RE = /https:\/\/[^\s<>"']+/g;
const TRAILING_PUNCT_RE = /[.,;:!?)\]}'"」』]+$/;
const TITLE_RE = /^\[([^\]\n]{1,30})\]\s*/;

function linkify(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text))) {
    let url = match[0];
    const trail = TRAILING_PUNCT_RE.exec(url);
    if (trail) url = url.slice(0, url.length - trail[0].length);
    const start = match.index;
    const end = start + url.length;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a
        key={`url-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand underline underline-offset-2 [overflow-wrap:anywhere]"
      >
        {url}
      </a>
    );
    last = end;
    URL_RE.lastIndex = end;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MessageBody({ text }: { text: string }) {
  const raw = String(text || '');
  const title = TITLE_RE.exec(raw);
  const body = title ? raw.slice(title[0].length) : raw;
  return (
    <>
      {title && <span className="block mb-1 text-sm font-bold text-brand">{title[1]}</span>}
      {linkify(body)}
    </>
  );
}

// ── 타임라인 구성 요소 ──

function DayDivider({ at, now }: { at: string; now: Date }) {
  const label = formatDayDivider(at, now);
  if (!label) return null;
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    </div>
  );
}

function SystemEvent({ item }: { item: Extract<ChatTimelineItem, { kind: 'system' }> }) {
  const Icon = item.tone === 'success'
    ? CheckCircle2
    : item.tone === 'attention'
      ? (item.text.includes('전화') ? PhoneCall : AlertCircle)
      : Info;
  const toneClass = item.tone === 'success'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : item.tone === 'attention'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-slate-100 border-slate-200 text-slate-600';
  return (
    <div className="flex justify-center px-2">
      <span
        title={formatFullDateTime(item.message.createdAt)}
        className={`inline-flex items-start gap-1.5 max-w-[90%] px-3 py-1.5 rounded-lg border text-[12px] font-semibold leading-5 ${toneClass}`}
      >
        <Icon className="w-3.5 h-3.5 mt-[3px] shrink-0" aria-hidden="true" />
        <span>{item.text}</span>
      </span>
    </div>
  );
}

function MessageGroup({
  group,
  clientName,
  onRetry,
}: {
  group: Extract<ChatTimelineItem, { kind: 'group' }>;
  clientName: string;
  onRetry?: (messageId: string) => void;
}) {
  const { mine, messages } = group;
  return (
    <div className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      {!mine && <span className="px-1 text-[12px] font-bold text-slate-700">{clientName}</span>}
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1;
        // 이 기기에서 보낸 메시지의 전송 상태 (App.handleAddMessage가 기록 — 없으면 전송 완료)
        // (이전: 변호사 메시지는 전송 상태를 추적하지 않아 저장에 실패해도 보낸 것처럼 보였다)
        const delivery = mine ? m.deliveryStatus : undefined;
        const time = isLast && !delivery ? (
          <span className="shrink-0 pb-0.5 text-[12px] text-slate-500 tabular-nums">{formatChatTime(m.createdAt)}</span>
        ) : null;
        return (
          <div key={m.id} className={`flex flex-col gap-1 w-full ${mine ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-end gap-2 w-full ${mine ? 'justify-end' : 'justify-start'}`}>
              {mine && time}
              <div
                title={formatFullDateTime(m.createdAt)}
                className={`max-w-[min(75%,560px)] rounded-2xl border px-3.5 py-2.5 text-base text-slate-900 whitespace-pre-wrap [overflow-wrap:anywhere] ${
                  mine ? 'bg-brand-light border-brand/15' : 'bg-white border-slate-200'
                } ${delivery === 'sending' ? 'opacity-70' : ''} ${delivery === 'failed' ? 'ring-2 ring-red-300' : ''}`}
              >
                <span className="sr-only">
                  {mine ? '보낸 메시지' : `${clientName} 메시지`}, {formatChatTime(m.createdAt)}
                  {delivery === 'sending' ? ', 보내는 중' : delivery === 'failed' ? ', 전송되지 않음' : ''}:{' '}
                </span>
                <MessageBody text={m.message} />
              </div>
              {!mine && time}
            </div>
            {delivery === 'sending' && (
              <span className="px-1 text-[12px] font-medium text-slate-500">보내는 중…</span>
            )}
            {delivery === 'failed' && (
              <div className="flex items-center gap-1 px-1 text-[12px] font-semibold text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>전송되지 않았습니다</span>
                {onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(m.id)}
                    className="min-h-11 px-2.5 -my-2 rounded-lg font-bold text-brand hover:bg-brand-light whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    다시 보내기
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IntakeCard({
  request,
  expanded,
  onToggle,
  cardRef,
}: {
  request: ConsultRequest;
  expanded: boolean;
  onToggle: () => void;
  cardRef: React.Ref<HTMLElement>;
}) {
  const content = String(request.content || '').trim();
  const collapsible = content.length > 110 || (content.match(/\n/g) || []).length >= 2;
  const fp = request.financialProfile;
  const hasDiagnosis = Boolean(fp && ((fp.debtTotal || 0) > 0 || (fp.income || 0) > 0));
  const entryLabel = request.entryCategory?.label;
  return (
    <article ref={cardRef} aria-label="상담 신청서" className="w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-4 scroll-mt-4">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
        <span className="text-xs font-bold text-brand shrink-0">상담 신청서</span>
        {entryLabel && (
          <span className="inline-flex items-center h-5 px-1.5 rounded-lg border border-slate-200 text-[12px] text-slate-600 truncate">
            {entryLabel}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[12px] text-slate-500 tabular-nums" title={formatFullDateTime(request.createdAt)}>
          {formatChatTime(request.createdAt)} 접수
        </span>
      </div>
      <h3 className="mt-2 text-[15px] font-bold leading-6 text-slate-900">{request.title || '상담 신청'}</h3>
      {content && (
        <p className={`mt-1.5 text-sm text-slate-700 whitespace-pre-wrap [overflow-wrap:anywhere] ${expanded ? '' : 'line-clamp-3'}`}>
          {content}
        </p>
      )}
      {(collapsible || hasDiagnosis) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {collapsible ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={onToggle}
              className="text-xs font-bold text-brand hover:underline underline-offset-2 cursor-pointer"
            >
              {expanded ? '사연 접기' : '사연 전체 보기'}
            </button>
          ) : <span />}
          {hasDiagnosis && (
            <span className="inline-flex items-center h-5 px-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[12px] font-semibold text-emerald-700">
              자가진단 완료
            </span>
          )}
        </div>
      )}
    </article>
  );
}

// ── 타임라인 ──

interface ChatTimelineProps {
  request: ConsultRequest;
  messages: ConsultMessage[];
  lawyerId: string;
  /** 의뢰인 표시 이름 (가명 규칙 적용된 값) */
  clientName: string;
  now: Date;
  /** 값이 바뀌면 신청서 사연을 펼치고 그 위치로 이동 */
  revealIntakeSignal?: number;
  /** 전송 실패한 내 메시지의 '다시 보내기' (넘기지 않으면 버튼을 그리지 않는다) */
  onRetry?: (messageId: string) => void;
  /** 의뢰인이 아직 대화를 열지 않았는지 (빈 대화 안내 문구용) */
  chatLocked?: boolean;
}

/** 스레드마다 key로 새로 마운트한다 — 열면 맨 아래(최신 메시지)부터 보인다 */
export default function ChatTimeline({ request, messages, lawyerId, clientName, now, revealIntakeSignal = 0, onRetry, chatLocked = false }: ChatTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const intakeRef = useRef<HTMLElement>(null);
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef(messages.length);
  const initialSignalRef = useRef(revealIntakeSignal);
  const [newCount, setNewCount] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(
    () => buildChatTimeline(messages, lawyerId, localDayKey(request.createdAt)),
    [messages, lawyerId, request.createdAt]
  );

  // 처음 열 때 최신 메시지 위치로 (이전: 맨 위 접수 카드부터 표시)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // 새 메시지: 맨 아래 근처이거나 내가 보낸 메시지면 따라 내려가고, 아니면 알림 버튼
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;
    if (messages.length <= prev) return;
    const el = scrollRef.current;
    if (!el) return;
    const added = messages.slice(prev);
    const mineAdded = added.some(m => m.senderId === lawyerId);
    if (nearBottomRef.current || mineAdded) {
      requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
      setNewCount(0);
    } else {
      const incoming = added.filter(m => m.senderId !== lawyerId).length;
      if (incoming > 0) setNewCount(c => c + incoming);
    }
  }, [messages, lawyerId]);

  // 헤더 ⋯ 메뉴의 '사연 원문 보기'
  useEffect(() => {
    if (revealIntakeSignal === initialSignalRef.current) return;
    setExpanded(true);
    requestAnimationFrame(() => intakeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [revealIntakeSignal]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    if (near && newCount > 0) setNewCount(0);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewCount(0);
  };

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto bg-slate-50 px-4 sm:px-6 py-5">
        <div className="mx-auto max-w-3xl space-y-4" role="log" aria-live="polite" aria-relevant="additions" aria-label="상담 대화 내용">
          <DayDivider at={request.createdAt} now={now} />
          <IntakeCard request={request} expanded={expanded} onToggle={() => setExpanded(v => !v)} cardRef={intakeRef} />

          {items.map(item => {
            if (item.kind === 'day') return <DayDivider key={item.key} at={item.at} now={now} />;
            if (item.kind === 'system') return <SystemEvent key={item.key} item={item} />;
            return <MessageGroup key={item.key} group={item} clientName={clientName} onRetry={onRetry} />;
          })}

          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center gap-2 py-6">
              <MessageSquareDashed className="w-8 h-8 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">아직 주고받은 메시지가 없습니다</p>
              <p className="text-xs text-slate-600">
                {chatLocked
                  ? '의뢰인이 제안서의 ‘상담 시작’을 누르면 대화가 열립니다.'
                  : '아래 입력창이나 ‘자주 쓰는 답변’으로 첫 메시지를 보내 상담을 시작하세요.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {newCount > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-brand text-white text-xs font-bold shadow-md whitespace-nowrap press-scale cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          새 메시지 {newCount}개
        </button>
      )}
    </div>
  );
}
