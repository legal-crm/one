import React, { useRef } from 'react';
import { ChevronLeft, ExternalLink, Info, Scale, X } from 'lucide-react';
import type { ConsultRequest, CrmNote } from '../../../types';
import { isClosedConsultStatus, isRetainedConsultStatus } from '../../../constants/consultStatus';
import { IconButton } from './ChatPrimitives';
import SummaryTab from './rail/SummaryTab';
import FinanceTab from './rail/FinanceTab';
import MemoTab from './rail/MemoTab';
import { useRepaymentSimulation } from './rail/useRepaymentSimulation';

export type RailTab = 'summary' | 'finance' | 'memo';
export type CrmDetailTab = 'info' | 'notes' | 'contracts' | 'documents';

const TABS: Array<{ id: RailTab; label: string }> = [
  { id: 'summary', label: '요약' },
  { id: 'finance', label: '채무·재산' },
  { id: 'memo', label: '메모' },
];

interface ClientContextRailProps {
  request: ConsultRequest | null;
  /** inline: 3열 고정 / drawer: 중간 폭 서랍 / page: 모바일 한 화면 */
  variant: 'inline' | 'drawer' | 'page';
  tab: RailTab;
  onTabChange: (tab: RailTab) => void;
  onClose?: () => void;
  onConvertToCase: (req: ConsultRequest) => void;
  onOpenCrm: (reqId: string, detailTab?: CrmDetailTab) => void;
  getDisplayPhoneNumber: (req: ConsultRequest) => string;
  memoNotes: CrmNote[] | null;
  memoCount: number;
  onSaveMemo: (content: string) => Promise<boolean>;
  now: Date;
}

export default function ClientContextRail({
  request, variant, tab, onTabChange, onClose, onConvertToCase, onOpenCrm, getDisplayPhoneNumber,
  memoNotes, memoCount, onSaveMemo, now,
}: ClientContextRailProps) {
  const simulation = useRepaymentSimulation(request);
  const tabRefs = useRef<Record<RailTab, HTMLButtonElement | null>>({ summary: null, finance: null, memo: null });
  const canConvert = Boolean(request && !isRetainedConsultStatus(request.status) && !isClosedConsultStatus(request.status));

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = TABS.findIndex(t => t.id === tab);
    const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    onTabChange(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-14 shrink-0 px-4 flex items-center gap-2 border-b border-slate-200">
        {variant === 'page' && onClose && (
          <IconButton label="대화로 돌아가기" onClick={onClose}>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </IconButton>
        )}
        <h2 className="text-base font-bold text-slate-900 truncate">가계 진단 분석서</h2>
        {/* 주요 행동은 헤더에 고정 — 화면 우측 하단의 실무 퀵툴 버튼에 가리지 않도록 (소득 유형은 인적 사항 '직업'에 표시) */}
        {request && (
          canConvert ? (
            <button
              type="button"
              onClick={() => onConvertToCase(request)}
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-8 pointer-coarse:h-11 px-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold whitespace-nowrap transition-colors press-scale cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1"
            >
              <Scale className="w-3.5 h-3.5" aria-hidden="true" />
              정식 수임 전환
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenCrm(request.id, 'info')}
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-8 pointer-coarse:h-11 px-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold whitespace-nowrap transition-colors press-scale cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              고객관리에서 열기
            </button>
          )
        )}
        {variant === 'drawer' && onClose && (
          <IconButton label="분석서 닫기" onClick={onClose} className={request ? '' : 'ml-auto'} autoFocus>
            <X className="w-4 h-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>

      {!request ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-2">
          <Info className="w-8 h-8 text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-600">대화를 선택하면 의뢰인 정보가 표시됩니다.</p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="분석서 보기" className="shrink-0 h-11 px-4 flex items-stretch gap-5 border-b border-slate-200">
            {TABS.map(t => {
              const selected = t.id === tab;
              return (
                <button
                  key={t.id}
                  ref={el => { tabRefs.current[t.id] = el; }}
                  type="button"
                  role="tab"
                  id={`chat-rail-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`chat-rail-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onTabChange(t.id)}
                  onKeyDown={handleTabKeyDown}
                  className={`relative inline-flex items-center gap-1.5 text-sm whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-t ${
                    selected ? 'font-bold text-brand' : 'font-semibold text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                  {t.id === 'memo' && memoCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-slate-100 text-[12px] font-bold text-slate-600 tabular-nums">
                      {memoCount}
                    </span>
                  )}
                  {selected && <span className="absolute left-0 right-0 -bottom-px h-[3px] rounded-t bg-brand" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div
            id={`chat-rail-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`chat-rail-tab-${tab}`}
            className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-16"
          >
            {tab === 'summary' && (
              <SummaryTab
                request={request}
                simulation={simulation}
                getDisplayPhoneNumber={getDisplayPhoneNumber}
                onOpenCrmInfo={() => onOpenCrm(request.id, 'info')}
              />
            )}
            {tab === 'finance' && <FinanceTab request={request} simulation={simulation} />}
            {tab === 'memo' && (
              <MemoTab
                notes={memoNotes}
                onSave={onSaveMemo}
                onOpenCrmNotes={() => onOpenCrm(request.id, 'notes')}
                now={now}
              />
            )}
          </div>

        </>
      )}
    </div>
  );
}
