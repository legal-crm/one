import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Calculator, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, MessageSquare, MoreHorizontal, PanelRightClose } from 'lucide-react';
import type { ConsultRequest } from '../../../types';
import { HARASSMENT_SHORT_LABELS, harassmentSeverity, lookupLabel } from '../../../constants/clientProfileLabels';
import type { LawyerChatThread } from './chatSelectors';
import type { ChatReplyTemplate } from './chatTemplates';
import type { CrmDetailTab } from './ClientContextRail';
import { formatManwon, shortRequestNo } from './chatFormat';
import { useDismiss } from './chatHooks';
import { ChatAvatar, ConsultStatusChip, IconButton } from './ChatPrimitives';
import ChatTimeline from './ChatTimeline';
import ChatComposer from './ChatComposer';

export type ChatLayout = 'single' | 'drawer' | 'wide';

interface ChatConversationProps {
  thread: LawyerChatThread | null;
  lawyerId: string;
  now: Date;
  layout: ChatLayout;
  displayName: string;
  /** 가명 상태(계약·연락처 공개 전)인지 */
  isPseudonymous: boolean;
  /** 분석서가 옆에 열려 있는지 (wide 레이아웃) */
  railInline: boolean;
  onCloseRail: () => void;
  /** 분석서 열기 (서랍·모바일 화면·접힌 3열) */
  onOpenRail: () => void;
  onBack?: () => void;
  onOpenCrm: (reqId: string, detailTab?: CrmDetailTab) => void;
  onOpenQuickDock?: (anchor: DOMRect) => void;
  canSend: boolean;
  onSend: (text: string) => boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  templates: ChatReplyTemplate[];
}

function formatReceivedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 접수`;
}

/** 분석서가 옆에 없을 때만 보이는 핵심 수치 1줄 (같은 수치를 한 화면에 두 번 보이지 않기 위해) */
function SummaryStrip({ request, onOpenRail }: { request: ConsultRequest; onOpenRail: () => void }) {
  const fp = request.financialProfile;
  const severity = harassmentSeverity(fp?.harassmentLevel);
  const parts: React.ReactNode[] = [];
  if ((fp?.debtTotal || 0) > 0) parts.push(<span key="debt">총 채무 <strong className="font-bold text-slate-900 tabular-nums">{formatManwon(fp.debtTotal, { unit: false })}</strong></span>);
  if ((fp?.income || 0) > 0) parts.push(<span key="income">월 소득 <strong className="font-bold text-slate-900 tabular-nums">{formatManwon(fp.income, { unit: false })}</strong></span>);
  if (fp?.residenceRegion) parts.push(<span key="region">{fp.residenceRegion}</span>);
  return (
    <div className="shrink-0 min-h-10 pl-4 pr-2 flex items-center gap-2 border-b border-slate-200 bg-white text-[12px] text-slate-600">
      {/* 수치는 좁으면 가로로 밀리고, 분석서 버튼은 항상 보이게 둔다 */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5 whitespace-nowrap overflow-x-auto scrollbar-hide">
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-slate-300" aria-hidden="true">|</span>}
            {p}
          </React.Fragment>
        ))}
        {severity === 'risk' && (
          <span className="inline-flex items-center h-5 px-1.5 rounded-lg border border-rose-200 bg-rose-50 font-semibold text-rose-700">
            {lookupLabel(HARASSMENT_SHORT_LABELS, fp?.harassmentLevel)}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenRail}
        className="shrink-0 inline-flex items-center gap-0.5 h-8 pointer-coarse:h-11 px-2 rounded-lg font-bold text-brand hover:bg-brand-light cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        분석서 보기
        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ChatConversation({
  thread, lawyerId, now, layout, displayName, isPseudonymous, railInline, onCloseRail, onOpenRail, onBack,
  onOpenCrm, onOpenQuickDock, canSend, onSend, draft, onDraftChange, templates,
}: ChatConversationProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealSignal, setRevealSignal] = useState(0);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const quickDockButtonRef = useRef<HTMLButtonElement>(null);
  useDismiss(menuOpen, () => setMenuOpen(false), [moreButtonRef, menuRef]);

  if (!thread) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
        <MessageSquare className="w-12 h-12 text-slate-300" aria-hidden="true" />
        <p className="text-base font-bold text-slate-700">대화를 선택하세요</p>
        <p className="text-sm text-slate-600">왼쪽 메시지함에서 상담을 고르면 대화가 열립니다.</p>
      </div>
    );
  }

  const request = thread.request;
  const requestNo = shortRequestNo(request.id);
  const single = layout === 'single';
  const subline = [request.title, formatReceivedDate(request.createdAt), isPseudonymous ? '안심 가명 상담' : ''].filter(Boolean).join(' · ');

  const copyRequestNo = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(request.id);
      toast.success('요청 번호를 복사했습니다.');
    } catch {
      toast.error('복사하지 못했습니다. 브라우저 권한을 확인해 주세요.');
    }
  };

  const menuItems: Array<{ id: string; label: string; icon: React.ElementType; onSelect: () => void }> = [
    { id: 'story', label: '사연 원문 보기', icon: FileText, onSelect: () => { setMenuOpen(false); setRevealSignal(s => s + 1); } },
    { id: 'crm', label: '고객관리에서 열기', icon: ExternalLink, onSelect: () => { setMenuOpen(false); onOpenCrm(request.id, 'info'); } },
    { id: 'copy', label: '요청 번호 복사', icon: Copy, onSelect: copyRequestNo },
  ];
  if (single && onOpenQuickDock) {
    menuItems.push({
      id: 'dock',
      label: '실무 퀵툴 열기',
      icon: Calculator,
      onSelect: () => {
        setMenuOpen(false);
        const rect = moreButtonRef.current?.getBoundingClientRect();
        if (rect) onOpenQuickDock(rect);
      },
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="h-14 shrink-0 px-3 sm:px-4 flex items-center gap-2.5 border-b border-slate-200 bg-white">
        {single && onBack && (
          <IconButton label="대화 목록으로" onClick={onBack}>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </IconButton>
        )}
        <ChatAvatar name={displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h2 className="text-[15px] font-bold text-slate-900 truncate">{displayName}</h2>
            {requestNo && <span className="text-[12px] text-slate-500 shrink-0">#{requestNo}</span>}
            {!single && <ConsultStatusChip status={request.status} className="ml-1 shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            {single && <ConsultStatusChip status={request.status} className="shrink-0" />}
            <p className="text-[12px] text-slate-500 truncate">{subline}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!single && onOpenQuickDock && (
            <button
              ref={quickDockButtonRef}
              type="button"
              data-quickdock-trigger=""
              onClick={() => {
                const rect = quickDockButtonRef.current?.getBoundingClientRect();
                if (rect) onOpenQuickDock(rect);
              }}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors press-scale cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
              실무 퀵툴
            </button>
          )}
          {railInline && (
            <IconButton label="분석서 닫기" active onClick={onCloseRail}>
              <PanelRightClose className="w-4 h-4" aria-hidden="true" />
            </IconButton>
          )}
          <div className="relative">
            <IconButton
              ref={moreButtonRef}
              label="대화 메뉴"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-quickdock-trigger=""
              onClick={() => setMenuOpen(v => !v)}
            >
              <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
            </IconButton>
            {menuOpen && (
              <div
                ref={menuRef}
                role="menu"
                aria-label="대화 메뉴"
                className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg z-30"
              >
                {menuItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={item.onSelect}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2 pointer-coarse:py-3 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50 cursor-pointer"
                  >
                    <item.icon className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {!railInline && <SummaryStrip request={request} onOpenRail={onOpenRail} />}

      <ChatTimeline
        key={thread.id}
        request={request}
        messages={thread.messages}
        lawyerId={lawyerId}
        clientName={displayName}
        now={now}
        revealIntakeSignal={revealSignal}
      />

      <ChatComposer
        key={`composer-${thread.id}`}
        reserveCornerSpace={layout === 'drawer'}
        canSend={canSend}
        onSend={onSend}
        initialValue={draft}
        onDraftChange={onDraftChange}
        templates={templates}
      />
    </div>
  );
}
