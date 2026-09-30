import { FileCheck, FileText, ShieldCheck } from 'lucide-react';
import { Badge, SegmentedTabs } from './ui';
import NextActionCard from './mypage/NextActionCard';
import RehabCompanionView from './companion/RehabCompanionView';
import type { MyPageSubTab } from './mypage/nextAction';
import { getRequestRoomStage } from './consultFlow';
import ClientProposalTracker from './proposal/ClientProposalTracker';
import { useMyPageModel, type MyPageViewProps } from './mypage/useMyPageModel';
import MyPageCompactView from './mypage/MyPageCompactView';
import MyPageNotificationsPanel from './mypage/MyPageNotificationsPanel';
import MyCaseDetails from './mypage/MyCaseDetails';
import MyPageModals from './mypage/MyPageModals';

/**
 * 마이페이지 (탭: 내 사건 · 회생동행 · 알림·설정)
 * - 상태·핸들러: mypage/useMyPageModel · 섹션: mypage/*Card, MyCaseDetails · 모달: mypage/MyPageModals
 * - isCompact: 내 관리방 '내 채무' 창에서 쓰는 간단 보기(mypage/MyPageCompactView)
 */
export default function MyPageView(props: MyPageViewProps) {
  const vm = useMyPageModel(props);
  const {
    activeRequest, allProposals, assignedLawyer, companionFallbackIds, contractedProposal,
    handleStartContractFromProposal, isCompact, isContracted, lawyers, mypageTab, mypageTabsRef, nextAction,
    onNavigateToChat, openDocRequestCount, profile, rejectedDocCount, requests, runNextAction, setMypageTab,
    setSelectedProposalForReport, unreadNotificationCount, userAlias,
  } = vm;

  // [isCompact 모드] 내 관리방 '내 채무' 창 전용 보기
  if (isCompact) return <MyPageCompactView vm={vm} />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn text-left">

      {/* 머리글: 제목·가명·담당 변호사 (가명 변경은 알림·설정 탭에서 서버 중복 확인을 거쳐 한다) */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">마이페이지</h1>
          <Badge tone="teal" icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}>스텔스 가명 보호</Badge>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed break-keep">
          <strong className="text-slate-900">{userAlias || '회원'}</strong>님의 사건 진행·서류·납부를 관리합니다. 수임 계약 전까지 변호사에게는 가명으로 표시됩니다.
        </p>
        {assignedLawyer && (
          <p className="flex items-center gap-2 text-sm text-slate-700">
            {assignedLawyer.avatar ? (
              <img src={assignedLawyer.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <span className="w-7 h-7 rounded-lg bg-brand text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">{assignedLawyer.name.charAt(0)}</span>
            )}
            <span>담당 변호사 <strong className="text-slate-900">{assignedLawyer.name} 변호사</strong>{assignedLawyer.firm ? ` · ${assignedLawyer.firm}` : ''}</span>
          </p>
        )}
      </header>

      <NextActionCard next={nextAction} onAction={runNextAction} />
      {/* 마이페이지 탭: 내 사건(진단·서류·계약·수임료) / 회생동행(진행·변제 관리) / 알림·설정 */}
      <div ref={mypageTabsRef} className="scroll-mt-4">
        <SegmentedTabs<MyPageSubTab>
          tabs={[
            {
              id: 'diagnosis',
              label: '내 사건',
              badge: openDocRequestCount + rejectedDocCount > 0
                ? <span className="ml-1 rounded-full bg-amber-700 px-1.5 text-xs font-bold text-white">{openDocRequestCount + rejectedDocCount}<span className="sr-only">건 서류 할 일</span></span>
                : undefined,
            },
            { id: 'companion', label: '회생동행' },
            {
              id: 'settings',
              label: '알림·설정',
              badge: unreadNotificationCount > 0
                ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">{unreadNotificationCount}<span className="sr-only">개 새 알림</span></span>
                : undefined,
            },
          ]}
          value={mypageTab}
          onChange={setMypageTab}
          ariaLabel="마이페이지 메뉴"
          idPrefix="mypage"
        />
      </div>
      {/* ═══ 탭 1: 회생·파산 완주동행 (메인 허브) ═══ */}
      {!isCompact && mypageTab === 'companion' && (
        <div role="tabpanel" id="mypage-panel-companion" aria-labelledby="mypage-tab-companion">
          <RehabCompanionView
            userAlias={userAlias}
            clientId={activeRequest?.id || requests[0]?.id}
            fallbackClientIds={companionFallbackIds}
            onNavigateToChat={onNavigateToChat}
            embedded
          />
        </div>
      )}

      {/* ═══ 탭 3: 알림 수신함 & 설정 ═══ */}
      {mypageTab === 'settings' && !isCompact && <MyPageNotificationsPanel vm={vm} />}

      {/* ═══ 탭 2: 채무 진단 & 맞춤 제안서 / 법원 서류 제출 ═══ */}
      {mypageTab === 'diagnosis' && (
        <div role="tabpanel" id="mypage-panel-diagnosis" aria-labelledby="mypage-tab-diagnosis" className="space-y-6 animate-fadeIn">
          {/* ═══ [제안서 중심 Proposal-First 트래커] ═══ */}
          {/* 계약 전 단계(!isContracted)일 때는 제안서 작성 중/도착 상태를 최우선 센터피스로 렌더링 */}
          {/* 요청을 보낸 뒤에만 진행을 보여 준다 (아무에게도 요청하지 않았는데 '검토 중'으로 보이지 않게) */}
          {!isContracted && !!profile && !!activeRequest && ['open_waiting', 'waiting_reply', 'review_proposals', 'comparing', 'counseling'].includes(getRequestRoomStage(activeRequest)) && (
            <ClientProposalTracker
              proposals={allProposals}
              activeRequest={activeRequest || requests[0]}
              onViewReport={(proposal) => setSelectedProposalForReport(proposal)}
              onNavigateToChat={(reqId) => onNavigateToChat(reqId || allProposals[0]?.req?.id)}
              onStartContract={handleStartContractFromProposal}
              onOpenLawyerCompare={() => onNavigateToChat(allProposals[0]?.req?.id)}
              lawyers={lawyers}
            />
          )}

          {/* 계약 후: 수임 계약한 변호사의 제안서만 다시 볼 수 있게 한다 (이전: 첫 번째 제안서를 열어 다른 변호사 제안서가 보일 수 있었음) */}
          {isContracted && contractedProposal && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0" aria-hidden="true">
                  <FileCheck className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">수임 계약한 제안서</span>
                    <Badge tone="success">계약 완료</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600 break-keep">
                    {contractedProposal.lawyerName} 변호사의 제안 조건과 첨부 리포트를 다시 볼 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProposalForReport(contractedProposal)}
                className="min-h-11 px-5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                제안서 보기
              </button>
            </div>
          )}

          {!profile ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 mx-auto bg-brand-light rounded-2xl flex items-center justify-center text-brand" aria-hidden="true">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">아직 내 상황 체크 기록이 없습니다</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              내 상황 체크(약 3분)를 마치면 예상 변제금과 서류·계약 진행이 이곳에 모입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-8 animate-fadeIn">
            {/* ════ [!isCompact 모드] 마이페이지 본연의 3대 자산·서류 보관함 ════ */}
            {!isCompact && <MyCaseDetails vm={vm} />}

          </div>
        )}
      </div>
      )}

      <MyPageModals vm={vm} />
    </div>
  );
}
