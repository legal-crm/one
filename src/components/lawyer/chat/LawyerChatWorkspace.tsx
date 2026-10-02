import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConsultRequest, ConsultMessage, CrmClientExtension, StaffMember, StaffRole, User } from '../../../types';
import { CRM_NOTE_CATEGORIES } from '../../../types';
import {
  createActivityLog, createCrmNote, createDefaultCrmExtension, getCrmExt, loadCrmData, loadCrmDataResult, saveCrmClient,
  type CrmDataStore,
} from '../../../services/crmService';
import { buildLawyerChatThread, buildLawyerChatThreads } from './chatSelectors';
import { DEFAULT_CHAT_REPLY_TEMPLATES } from './chatTemplates';
import { useElementWidth, useNow } from './chatHooks';
import ChatInbox from './ChatInbox';
import ChatConversation, { type ChatLayout } from './ChatConversation';
import ClientContextRail, { type CrmDetailTab, type RailTab } from './ClientContextRail';
import type { MemoSaveResult } from './rail/MemoTab';
import { isClientPseudonymous } from '../../../utils/clientDisplay';

const RAIL_PREF_KEY = 'lawyer_chat_rail_open_v1';

/** 작업 영역 폭 기준 레이아웃 (사이드바 접힘까지 반영) — 기획서 4장 */
function layoutFor(width: number): ChatLayout {
  if (width >= 1100) return 'wide';
  if (width >= 720) return 'drawer';
  return 'single';
}

export interface LawyerChatWorkspaceProps {
  requests: ConsultRequest[];
  messages: ConsultMessage[];
  activeLawyer: User;
  /** 로그인한 직원 (대표 변호사 본인이면 null) — 메모 작성자 기록용 */
  currentStaff?: StaffMember | null;
  activeChatReqId: string;
  onSelectThread: (reqId: string) => void;
  /** 메시지 전송 (승인 확인·활동 로그 포함). 받아들였으면 true */
  onSendMessage: (reqId: string, text: string) => boolean;
  /** 전송 실패한 메시지를 같은 id로 다시 보낸다 (승인 확인·실패 안내 포함) */
  onRetryMessage?: (messageId: string) => Promise<boolean>;
  onConvertToCase: (req: ConsultRequest) => void;
  /** 이미 정식 수임 사건이 있는 요청인지 — 있으면 '정식 수임 전환' 대신 '사건 열기'를 보여 준다 */
  hasCaseForRequest?: (reqId: string) => boolean;
  /** 고객관리 탭으로 이동 (reqId가 없으면 목록) */
  onOpenCrm: (reqId?: string, detailTab?: CrmDetailTab) => void;
  /**
   * 대화 헤더의 '실무 퀵툴' 버튼 (기획서 A7). LegalQuickDock이 외부 버튼으로 메뉴 열기를 지원하면 연결한다.
   * 넘기지 않으면 헤더 버튼을 그리지 않는다. 트리거 버튼에는 data-quickdock-trigger 속성이 붙는다.
   */
  onOpenQuickDock?: (anchor: DOMRect) => void;
  getDisplayClientName: (req: ConsultRequest) => string;
  getDisplayPhoneNumber: (req: ConsultRequest) => string;
}

export default function LawyerChatWorkspace({
  requests, messages, activeLawyer, currentStaff = null, activeChatReqId, onSelectThread, onSendMessage,
  onRetryMessage, onConvertToCase, hasCaseForRequest, onOpenCrm, onOpenQuickDock, getDisplayClientName, getDisplayPhoneNumber,
}: LawyerChatWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(containerRef, typeof window !== 'undefined' ? window.innerWidth : 1440);
  const layout = layoutFor(width);
  const extraWide = width >= 1360;
  const now = useNow();

  // ── 스레드 ──
  const threads = useMemo(
    () => buildLawyerChatThreads(requests, messages, activeLawyer),
    [requests, messages, activeLawyer]
  );
  const selectedRequest = useMemo(
    () => (activeChatReqId && requests.find(r => r.id === activeChatReqId)) || threads[0]?.request || null,
    [activeChatReqId, requests, threads]
  );
  const selectedThread = useMemo(() => {
    if (!selectedRequest) return null;
    return threads.find(t => t.id === selectedRequest.id) || buildLawyerChatThread(selectedRequest, messages, activeLawyer);
  }, [selectedRequest, threads, messages, activeLawyer]);
  const selectedId = selectedThread?.id || '';

  // ── 패널 상태 ──
  const [mobilePane, setMobilePane] = useState<'threads' | 'chat' | 'rail'>(() => (activeChatReqId ? 'chat' : 'threads'));
  const [railOpen, setRailOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_PREF_KEY) !== 'closed'; } catch { return true; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railTab, setRailTab] = useState<RailTab>('summary');

  const setRailOpenPersist = (open: boolean) => {
    setRailOpen(open);
    try { localStorage.setItem(RAIL_PREF_KEY, open ? 'open' : 'closed'); } catch { /* ignore */ }
  };

  const railInline = layout === 'wide' && railOpen;
  const openRail = () => {
    if (layout === 'wide') setRailOpenPersist(true);
    else if (layout === 'drawer') setDrawerOpen(true);
    else setMobilePane('rail');
  };

  // 서랍: Esc로 닫기, 3열로 넓어지면 닫기
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);
  useEffect(() => {
    if (layout !== 'drawer') setDrawerOpen(false);
  }, [layout]);

  const handleSelect = (id: string) => {
    onSelectThread(id);
    if (layout === 'single') setMobilePane('chat');
  };

  // ── 입력 중인 답장 (스레드별 보관 — 다른 방으로 잘못 보내지 않도록) ──
  const draftsRef = useRef<Record<string, string>>({});

  const canSend = activeLawyer.approved !== false;
  const handleSend = useCallback(
    (text: string) => (selectedId ? onSendMessage(selectedId, text) : false),
    [selectedId, onSendMessage]
  );
  const handleRetry = useMemo(
    () => (onRetryMessage ? (messageId: string) => { void onRetryMessage(messageId); } : undefined),
    [onRetryMessage]
  );

  // ── 내부 메모 (고객관리 상담 메모와 같은 저장소) ──
  const [crmStore, setCrmStore] = useState<CrmDataStore | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);

  const reloadCrm = useCallback(async () => {
    setCrmLoading(true);
    try {
      setCrmStore(await loadCrmData());
    } finally {
      setCrmLoading(false);
    }
  }, []);

  // 메모 탭을 처음 열 때 불러온다 (고객관리 탭과 같이 서버 데이터 기준)
  useEffect(() => {
    if (railTab === 'memo' && crmStore === null && !crmLoading) void reloadCrm();
  }, [railTab, crmStore, crmLoading, reloadCrm]);

  const localMemoCount = useMemo(() => (selectedId ? getCrmExt(selectedId).notes?.length || 0 : 0), [selectedId]);
  const memoNotes = crmStore ? (crmStore[selectedId]?.notes || []) : null;
  const memoCount = crmStore ? (crmStore[selectedId]?.notes?.length || 0) : localMemoCount;

  const saveMemo = useCallback(async (content: string): Promise<MemoSaveResult> => {
    if (!selectedId) return 'failed';
    // 저장 직전 최신 데이터를 기준으로 합친다 (다른 화면에서 바뀐 서류·수임료 등을 덮어쓰지 않도록)
    // 서버를 읽지 못하면 저장하지 않는다 — 이 기기의 오래된 사본이나 빈 기본값으로 서버 행 전체를 덮어쓰지 않기 위해
    // (이전: loadCrmData가 서버 오류 시 이 기기 사본으로 대체해, 그 사본을 기준으로 서버 행을 덮어쓸 수 있었다)
    const loaded = await loadCrmDataResult();
    if (!loaded.ok) return 'failed';
    const store = loaded.data;
    const base: CrmClientExtension = store[selectedId] || createDefaultCrmExtension(selectedId);
    const actor: { id: string; name: string; role: StaffRole } = currentStaff
      ? { id: currentStaff.id, name: currentStaff.name, role: currentStaff.role }
      : { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' };
    const note = createCrmNote('consult', content, actor.id, actor.name);
    const activity = createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'note_added',
      `메모 추가 [${CRM_NOTE_CATEGORIES.consult.label}]: ${content.slice(0, 30)}...`
    );
    const updated: CrmClientExtension = {
      ...base,
      notes: [...(base.notes || []), note],
      activities: [...(base.activities || []), activity],
      lastActivityAt: new Date().toISOString(),
    };
    const ok = await saveCrmClient(selectedId, updated);
    setCrmStore({ ...store, [selectedId]: updated });
    return ok ? 'saved' : 'local';
  }, [selectedId, currentStaff, activeLawyer]);

  // ── 렌더 ──
  const panel = 'bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-0';
  const inboxWidth = layout === 'single' ? 'w-full' : layout === 'drawer' ? 'w-[272px]' : extraWide ? 'w-[320px]' : 'w-[288px]';
  const railWidth = extraWide ? 'w-[400px]' : 'w-[360px]';

  const showInbox = layout !== 'single' || mobilePane === 'threads' || !selectedThread;
  const showConversation = layout !== 'single' || (mobilePane === 'chat' && Boolean(selectedThread));
  const showRailPage = layout === 'single' && mobilePane === 'rail' && Boolean(selectedThread);

  const displayName = selectedThread ? getDisplayClientName(selectedThread.request) : '';
  const isPseudonymous = selectedThread ? isClientPseudonymous(selectedThread.request) : true;

  const renderRail = (variant: 'inline' | 'drawer' | 'page', onClose?: () => void) => (
    <ClientContextRail
      request={selectedThread?.request || null}
      variant={variant}
      tab={railTab}
      onTabChange={setRailTab}
      onClose={onClose}
      onConvertToCase={onConvertToCase}
      onOpenCrm={onOpenCrm}
      getDisplayPhoneNumber={getDisplayPhoneNumber}
      memoNotes={memoNotes}
      memoCount={memoCount}
      onSaveMemo={saveMemo}
      now={now}
      hasCase={selectedThread ? Boolean(hasCaseForRequest?.(selectedThread.request.id)) : false}
    />
  );

  return (
    <div ref={containerRef} className="relative h-full min-h-0 flex gap-3">
      {showInbox && (
        <section aria-label="상담 메시지함" className={`${panel} ${inboxWidth} shrink-0`}>
          <ChatInbox
            threads={threads}
            activeThreadId={selectedId}
            lawyerId={activeLawyer.id}
            now={now}
            onSelect={handleSelect}
            getDisplayName={getDisplayClientName}
            onGoCrm={() => onOpenCrm()}
          />
        </section>
      )}

      {showConversation && (
        <section aria-label="상담 대화" className={`${panel} flex-1 min-w-0`}>
          <ChatConversation
            thread={selectedThread}
            lawyerId={activeLawyer.id}
            now={now}
            layout={layout}
            displayName={displayName}
            isPseudonymous={isPseudonymous}
            railInline={railInline}
            onCloseRail={() => setRailOpenPersist(false)}
            onOpenRail={openRail}
            onBack={() => setMobilePane('threads')}
            onOpenCrm={onOpenCrm}
            onOpenQuickDock={onOpenQuickDock}
            canSend={canSend}
            onSend={handleSend}
            onRetry={handleRetry}
            draft={draftsRef.current[selectedId] || ''}
            onDraftChange={text => { if (selectedId) draftsRef.current[selectedId] = text; }}
            templates={DEFAULT_CHAT_REPLY_TEMPLATES}
          />
        </section>
      )}

      {railInline && (
        <aside aria-label="가계 진단 분석서" className={`${panel} ${railWidth} shrink-0`}>
          {renderRail('inline')}
        </aside>
      )}

      {showRailPage && (
        <aside aria-label="가계 진단 분석서" className={`${panel} w-full`}>
          {renderRail('page', () => setMobilePane('chat'))}
        </aside>
      )}

      {layout === 'drawer' && drawerOpen && selectedThread && (
        <>
          <div
            className="absolute inset-0 z-20 rounded-2xl bg-slate-900/20"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="가계 진단 분석서"
            className={`${panel} absolute top-0 right-0 bottom-0 z-30 w-[380px] max-w-[92%] shadow-lg`}
          >
            {renderRail('drawer', () => setDrawerOpen(false))}
          </aside>
        </>
      )}
    </div>
  );
}
