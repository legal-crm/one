import { FileCheck, FileText } from 'lucide-react';
import { Badge } from './ui';
import NextActionCard from './mypage/NextActionCard';
import RehabCompanionView from './companion/RehabCompanionView';
import { getRequestRoomStage } from './consultFlow';
import ClientProposalTracker from './proposal/ClientProposalTracker';
import { useMyPageModel, type MyPageViewProps } from './mypage/useMyPageModel';
import MyPageCompactView from './mypage/MyPageCompactView';
import MyCaseDetails from './mypage/MyCaseDetails';
import MyPageModals from './mypage/MyPageModals';
import MyServerCasesCard from './mypage/MyServerCasesCard';

/**
 * '내 사건' 화면의 사건 진행 · 회생동행 영역 (MY-1, 이전 이름 '마이페이지')
 * 상담은 같은 '내 사건' 머리글의 '상담'(ChatView), 알림·계정·동의는 '내 정보'(mypage/MyInfoView)
 * - 상태·핸들러: mypage/useMyPageModel · 섹션: mypage/*Card, MyCaseDetails · 모달: mypage/MyPageModals
 * - isCompact: 내 관리방 '내 채무' 창에서 쓰는 간단 보기(mypage/MyPageCompactView)
 */
export default function MyPageView(props: MyPageViewProps) {
  const vm = useMyPageModel(props);
  const {
    activeRequest, allProposals, assignedLawyer, companionFallbackIds, contractedProposal,
    handleStartContractFromProposal, isCompact, isContracted, lawyers, mypageTab, mypageTabsRef, nextAction,
    onNavigateToChat, openDocRequestCount, profile, rejectedDocCount, requests, runNextAction,
    setSelectedProposalForReport, userAlias,
  } = vm;

  // [isCompact 모드] 내 관리방 '내 채무' 창 전용 보기
  if (isCompact) return <MyPageCompactView vm={vm} />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn text-left">

      {/* 제목·가명·영역 고르기는 '내 사건' 머리글(mycase/MyCaseHubHeader)이 맡는다. 가명 변경은 '내 정보'에서 */}
      {assignedLawyer && (
        <header>
          <p className="flex items-center gap-2 text-sm text-slate-700">
            {assignedLawyer.avatar ? (
              <img src={assignedLawyer.avatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <span className="w-7 h-7 rounded-lg bg-brand text-white flex items-center justify-center text-xs font-bold" aria-hidden="true">{assignedLawyer.name.charAt(0)}</span>
            )}
            <span>담당 변호사 <strong className="text-slate-900">{assignedLawyer.name} 변호사</strong>{assignedLawyer.firm ? ` · ${assignedLawyer.firm}` : ''}</span>
          </p>
        </header>
      )}

      <NextActionCard next={nextAction} onAction={runNextAction} />
      {/* 영역(사건 진행 · 회생동행)은 '내 사건' 머리글에서 고른다. 다음 할 일 버튼이 영역을 바꾸면 이 위치로 스크롤 */}
      <div ref={mypageTabsRef} className="scroll-mt-4" aria-hidden="true" />
      {mypageTab === 'diagnosis' && openDocRequestCount + rejectedDocCount > 0 && (
        <p className="text-sm font-bold text-amber-800">
          서류 할 일 {openDocRequestCount + rejectedDocCount}건이 있어요. 아래 서류함에서 확인해 주세요.
        </p>
      )}
      {/* ═══ 회생동행 (진행·변제 관리) ═══ */}
      {!isCompact && mypageTab === 'companion' && (
        <div>
          <RehabCompanionView
            userAlias={userAlias}
            clientId={activeRequest?.id || requests[0]?.id}
            fallbackClientIds={companionFallbackIds}
            onNavigateToChat={onNavigateToChat}
            embedded
          />
        </div>
      )}

      {/* ═══ 사건 진행: 진단·제안서·서류·계약·수임료 ═══ */}
      {mypageTab === 'diagnosis' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 서버 사건 기록 (사무소가 기록한 단계·날짜, CM-11) */}
          <MyServerCasesCard isLoggedIn={vm.isLoggedIn} />
          {/* ═══ [제안서 중심 Proposal-First 트래커] ═══ */}
          {/* 계약 전 단계(!isContracted)일 때는 제안서 작성 중/도착 상태를 최우선 센터피스로 렌더링 */}
          {/* 요청을 보낸 뒤에만 진행을 보여 준다 (아무에게도 요청하지 않았는데 '검토 중'으로 보이지 않게) */}
          {!isContracted && !!profile && !!activeRequest && ['waiting_reply', 'review_proposals', 'comparing', 'counseling'].includes(getRequestRoomStage(activeRequest)) && (
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
