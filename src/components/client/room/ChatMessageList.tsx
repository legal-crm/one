import React from 'react';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import type { ConsultMessage } from '../../../types';
import { cn } from '../../../utils/cn';
import { clientSystemMessageText } from '../consultFlow';

/**
 * 1:1 상담 대화 목록
 * - 날짜가 바뀌면 구분선, 같은 사람이 5분 안에 이어 보낸 말풍선은 묶어서 이름·시간을 한 번만 보여 준다
 * - 줄바꿈 보존(whitespace-pre-wrap), 내 말풍선은 오른쪽·브랜드색, 전송 중·실패·다시 보내기 표시
 * - 대화가 없으면 예시 질문을 눌러 입력창에 채울 수 있다
 */

const GROUP_GAP_MS = 5 * 60 * 1000;

const EXAMPLE_QUESTIONS = [
  '제 상황에서는 개인회생과 파산 중 어떤 절차를 검토하면 좋을까요?',
  '수임료와 실비는 어떻게 나눠 낼 수 있나요?',
  '신청하려면 어떤 서류를 먼저 준비해야 하나요?',
];

function isSystemMessage(m: ConsultMessage): boolean {
  return m.message.startsWith('[System]') || m.senderType === 'system' || m.senderId === 'system' || m.senderName === '시스템 안내';
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

function sameGroup(a: ConsultMessage | undefined, b: ConsultMessage | undefined): boolean {
  if (!a || !b) return false;
  if (isSystemMessage(a) || isSystemMessage(b)) return false;
  if (a.senderType !== b.senderType || a.senderId !== b.senderId) return false;
  if (dayKey(a.createdAt) !== dayKey(b.createdAt)) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <= GROUP_GAP_MS;
}

interface ChatMessageListProps {
  messages: ConsultMessage[];
  /** 대화 상대 변호사 이름 (빈 상태 문구·말풍선 이름) */
  partnerName?: string;
  /** 보낼 수 있을 때만 예시 질문을 보여 준다 */
  canSend: boolean;
  onPickExample?: (text: string) => void;
  onRetry?: (messageId: string) => void;
}

/** 새로 도착한 상대 메시지만 화면 읽기 프로그램에 알린다(대화 상대를 바꾸거나 처음 열 때는 알리지 않는다) */
function useIncomingAnnouncement(messages: ConsultMessage[], partnerName?: string) {
  const [announcement, setAnnouncement] = React.useState('');
  const lastIdRef = React.useRef<string | null>(null);
  const partnerRef = React.useRef<string | undefined>(partnerName);
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    const last = messages[messages.length - 1];
    const prevLast = lastIdRef.current;
    const partnerChanged = partnerRef.current !== partnerName;
    lastIdRef.current = last?.id ?? null;
    partnerRef.current = partnerName;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (partnerChanged || !last || prevLast === last.id) return;
    const prevIdx = prevLast ? messages.findIndex((m) => m.id === prevLast) : -1;
    if (prevLast && prevIdx < 0) return; // 목록이 통째로 바뀐 경우(다른 상담)
    const added = messages.slice(prevIdx + 1).filter((m) => m.senderType !== 'client');
    if (added.length === 0) return;
    const text = added
      .map((m) =>
        isSystemMessage(m)
          ? `안내: ${clientSystemMessageText(m.message) ?? m.message.replace(/^\[System\]\s*/, '')}`
          : `${m.senderName || (partnerName ? `${partnerName} 변호사` : '변호사')}: ${m.message}`,
      )
      .join(' / ');
    setAnnouncement(`새 메시지. ${text}`.slice(0, 400));
  }, [messages, partnerName]);
  return announcement;
}

export default function ChatMessageList({ messages, partnerName, canSend, onPickExample, onRetry }: ChatMessageListProps) {
  const announcement = useIncomingAnnouncement(messages, partnerName);
  const liveRegion = (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8">
        {liveRegion}
        <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand flex items-center justify-center mb-3" aria-hidden="true">
          <MessageCircle className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-900 break-keep">
          {partnerName ? `${partnerName} 변호사에게 궁금한 점을 먼저 남겨 보세요` : '아직 주고받은 대화가 없습니다'}
        </p>
        {canSend && onPickExample && (
          <>
            <p className="mt-1 text-xs text-slate-600">예시를 누르면 입력창에 채워집니다.</p>
            <ul className="mt-4 w-full max-w-md space-y-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => onPickExample(q)}
                    className="w-full min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-left text-sm text-slate-700 hover:border-brand/40 hover:bg-brand-light/60 break-keep"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  return (
    <>
    {liveRegion}
    <ol className="px-4 sm:px-5 py-4 space-y-1" aria-label="대화 내용">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
        const dayLabel = showDay ? (
          <li key={`day-${m.id}`} className="flex items-center gap-3 py-3" aria-label={formatDay(m.createdAt)}>
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-500" aria-hidden="true">{formatDay(m.createdAt)}</span>
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </li>
        ) : null;

        if (isSystemMessage(m)) {
          const text = clientSystemMessageText(m.message) ?? m.message.replace(/^\[System\]\s*/, '');
          return (
            <React.Fragment key={m.id}>
              {dayLabel}
              <li className="flex justify-center py-2">
                <p className="max-w-md rounded-xl bg-slate-100 px-4 py-2 text-center text-xs sm:text-sm font-medium text-slate-700 break-keep">
                  {text}
                </p>
              </li>
            </React.Fragment>
          );
        }

        const isMe = m.senderType === 'client';
        const groupStart = !sameGroup(prev, m);
        const groupEnd = !sameGroup(m, next);
        const delivery = isMe ? m.deliveryStatus : undefined;
        const name = isMe ? '나' : (m.senderName || (partnerName ? `${partnerName} 변호사` : '변호사'));

        return (
          <React.Fragment key={m.id}>
            {dayLabel}
            <li className={cn('flex flex-col', isMe ? 'items-end' : 'items-start', groupStart ? 'pt-3' : 'pt-0.5')}>
              {groupStart && !isMe && <span className="px-1 pb-1 text-xs font-bold text-slate-700">{name}</span>}
              <div
                className={cn(
                  'max-w-[85%] sm:max-w-[75%] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words',
                  isMe
                    ? cn('bg-brand text-white rounded-2xl', groupStart && 'rounded-tr-md', delivery === 'sending' && 'opacity-70', delivery === 'failed' && 'ring-2 ring-red-300')
                    : cn('bg-white text-slate-900 border border-slate-200 rounded-2xl', groupStart && 'rounded-tl-md'),
                )}
              >
                <span className="sr-only">{name}: </span>
                {m.message}
              </div>
              {delivery === 'sending' && <span className="px-1 pt-1 text-xs font-medium text-slate-500">보내는 중…</span>}
              {delivery === 'failed' && (
                <div className="flex items-center gap-1 px-1 text-xs font-semibold text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>전송되지 않았습니다</span>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(m.id)}
                      className="min-h-11 px-2.5 -my-2 rounded-lg font-bold text-brand hover:bg-brand-light whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      다시 보내기
                    </button>
                  )}
                </div>
              )}
              {groupEnd && !delivery && (
                <time dateTime={m.createdAt} className="px-1 pt-1 text-xs font-medium text-slate-500">
                  {formatTime(m.createdAt)}
                </time>
              )}
            </li>
          </React.Fragment>
        );
      })}
    </ol>
    </>
  );
}
