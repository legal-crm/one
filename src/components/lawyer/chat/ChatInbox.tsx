import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { MessageSquare, Search, SearchX } from 'lucide-react';
import type { ConsultRequest } from '../../../types';
import { getConsultStatusMeta, isRetainedConsultStatus } from '../../../constants/consultStatus';
import { classifySystemText, cleanSystemText, isSystemChatMessage, type LawyerChatThread } from './chatSelectors';
import { formatElapsed, formatFullDateTime, formatListTime, formatManwon, shortRequestNo } from './chatFormat';
import { ChatAvatar, ConsultStatusChip } from './ChatPrimitives';

type InboxFilter = 'all' | 'needsReply' | 'active' | 'retained';

// 건수는 할 일이 있는 '답변 필요'에만 표시한다 (좁은 폭에서도 한 줄에 들어가도록)
const FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'needsReply', label: '답변 필요' },
  { id: 'active', label: '상담 중' },
  { id: 'retained', label: '수임 후' },
];

function matchesFilter(t: LawyerChatThread, filter: InboxFilter): boolean {
  if (filter === 'needsReply') return t.needsReply;
  if (filter === 'retained') return isRetainedConsultStatus(t.request.status);
  if (filter === 'active') {
    const g = getConsultStatusMeta(t.request.status).group;
    return g === 'intake' || g === 'comparing' || g === 'counseling';
  }
  return true;
}

function previewOf(t: LawyerChatThread, lawyerId: string): { prefix?: string; text: string; muted: boolean } {
  const last = t.lastMessage;
  // 전화상담 요청 같은 확인 필요 안내가 마지막이면 그 문구를 보여준다
  if (last && isSystemChatMessage(last) && classifySystemText(last.message) === 'attention') {
    return { text: cleanSystemText(last.message), muted: false };
  }
  const m = t.lastConversationMessage;
  if (m) {
    return {
      prefix: m.senderId === lawyerId ? '나: ' : undefined,
      text: String(m.message || '').replace(/\s+/g, ' ').trim(),
      muted: false,
    };
  }
  if (last) return { text: cleanSystemText(last.message), muted: true };
  return { text: t.request.title || '상담 신청', muted: true };
}

interface ChatInboxProps {
  threads: LawyerChatThread[];
  activeThreadId?: string;
  lawyerId: string;
  now: Date;
  onSelect: (id: string) => void;
  getDisplayName: (req: ConsultRequest) => string;
  /** 대화가 하나도 없을 때 안내 버튼 */
  onGoCrm: () => void;
}

export default function ChatInbox({ threads, activeThreadId, lawyerId, now, onSelect, getDisplayName, onGoCrm }: ChatInboxProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const deferredQuery = useDeferredValue(query);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const names = useMemo(() => {
    const map = new Map<string, string>();
    threads.forEach(t => map.set(t.id, getDisplayName(t.request)));
    return map;
  }, [threads, getDisplayName]);

  // 같은 가명이 2건 이상일 때만 #번호를 붙인다
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    names.forEach(n => counts.set(n, (counts.get(n) || 0) + 1));
    return new Set(Array.from(counts.entries()).filter(([, c]) => c > 1).map(([n]) => n));
  }, [names]);

  const counts = useMemo(() => {
    const result: Record<InboxFilter, number> = { all: 0, needsReply: 0, active: 0, retained: 0 };
    threads.forEach(t => FILTERS.forEach(f => { if (matchesFilter(t, f.id)) result[f.id] += 1; }));
    return result;
  }, [threads]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase().replace(/^#/, '');
    return threads.filter(t => {
      if (!matchesFilter(t, filter)) return false;
      if (!q) return true;
      const name = (names.get(t.id) || '').toLowerCase();
      if (name.includes(q)) return true;
      if (shortRequestNo(t.id).toLowerCase().includes(q)) return true;
      if ((t.request.title || '').toLowerCase().includes(q)) return true;
      return t.messages.some(m => !isSystemChatMessage(m) && String(m.message || '').toLowerCase().includes(q));
    });
  }, [threads, filter, deferredQuery, names]);

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const idx = visible.findIndex(t => itemRefs.current.get(t.id) === document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    const nextIdx = e.key === 'ArrowDown' ? Math.min(visible.length - 1, idx + 1) : Math.max(0, idx - 1);
    const next = visible[nextIdx];
    if (!next || nextIdx === idx) return;
    itemRefs.current.get(next.id)?.focus();
    onSelect(next.id);
  };

  const resetFilters = () => { setQuery(''); setFilter('all'); };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-14 px-4 flex items-center border-b border-slate-200 shrink-0">
        <h2 className="text-base font-bold text-slate-900">상담 메시지함</h2>
      </div>

      <div className="px-3 pt-3 pb-2.5 space-y-2.5 border-b border-slate-200 shrink-0">
        <label className="relative block">
          <span className="sr-only">대화 검색</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="가명·요청번호·메시지 검색"
            className="w-full h-9 pointer-coarse:h-11 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/40"
          />
        </label>
        <div role="group" aria-label="대화 필터" className="flex flex-wrap gap-1">
          {FILTERS.map(f => {
            const selected = filter === f.id;
            const showCount = f.id === 'needsReply' && counts.needsReply > 0;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${f.label} ${counts[f.id]}건`}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 inline-flex items-center gap-1 h-7 pointer-coarse:h-11 px-2 rounded-lg border text-[12px] font-semibold whitespace-nowrap transition-colors press-scale cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
                  selected
                    ? 'bg-brand border-brand text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
                {showCount && (
                  <span className={`tabular-nums ${selected ? 'text-white' : 'text-amber-700'}`}>{counts.needsReply}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
          <MessageSquare className="w-10 h-10 text-slate-300" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700">진행 중인 상담 대화가 없습니다</p>
          <p className="text-xs text-slate-600 leading-5">제안서를 보내거나 의뢰인이 상담을 시작하면<br />여기에 표시됩니다.</p>
          <button
            type="button"
            onClick={onGoCrm}
            className="mt-1 h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-brand whitespace-nowrap press-scale cursor-pointer"
          >
            고객관리에서 신규 의뢰 확인
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
          <SearchX className="w-9 h-9 text-slate-300" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700">조건에 맞는 대화가 없습니다</p>
          <button
            type="button"
            onClick={resetFilters}
            className="h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-brand whitespace-nowrap press-scale cursor-pointer"
          >
            필터 초기화
          </button>
        </div>
      ) : (
        <ul className="flex-1 min-h-0 overflow-y-auto" aria-label="상담 대화 목록" onKeyDown={handleListKeyDown}>
          {visible.map(t => {
            const name = names.get(t.id) || '의뢰인';
            const selected = t.id === activeThreadId;
            const preview = previewOf(t, lawyerId);
            const debt = t.request.financialProfile?.debtTotal || 0;
            const lastAt = t.lastMessage?.createdAt || t.request.createdAt;
            return (
              <li key={t.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  ref={el => { if (el) itemRefs.current.set(t.id, el); else itemRefs.current.delete(t.id); }}
                  type="button"
                  onClick={() => onSelect(t.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-l-[3px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 ${
                    selected ? 'bg-brand-light border-l-brand' : 'border-l-transparent hover:bg-slate-50'
                  }`}
                >
                  <ChatAvatar name={name} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-sm font-bold text-slate-900 truncate">{name}</span>
                      {duplicateNames.has(name) && (
                        <span className="text-[12px] text-slate-500 shrink-0">#{shortRequestNo(t.id)}</span>
                      )}
                      {/* 답변이 필요하면 마지막 시각 대신 대기 시간을 보여준다 */}
                      {t.needsReply && t.waitingSince ? (
                        <span className="ml-auto pl-2 text-[12px] font-bold text-amber-700 shrink-0 tabular-nums" title={formatFullDateTime(t.waitingSince)}>
                          대기 {formatElapsed(t.waitingSince, now)}
                        </span>
                      ) : (
                        <span className="ml-auto pl-2 text-[12px] text-slate-500 shrink-0 tabular-nums" title={formatFullDateTime(lastAt)}>
                          {formatListTime(lastAt, now)}
                        </span>
                      )}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs truncate ${
                        preview.muted ? 'text-slate-500' : t.needsReply ? 'font-semibold text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {preview.prefix && <span className="font-normal text-slate-500">{preview.prefix}</span>}
                      {preview.text}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2 min-w-0">
                      <ConsultStatusChip status={t.request.status} />
                      {debt > 0 && (
                        <span className="text-[12px] text-slate-600 tabular-nums truncate">채무 {formatManwon(debt, { unit: false })}</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
