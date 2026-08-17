/**
 * [백업] CaseReviewCopilot에서 RehabResultReport 모달을 호출하던 기존 로직
 * 
 * 이 파일은 참조용 백업입니다. 다른 곳에서 RehabResultReport를 재사용할 때 활용하세요.
 * 
 * 원본 위치: src/components/lawyer/CaseReviewCopilot.tsx
 * 백업 날짜: 2026-08-17
 */

// ============================================================
// 1. Import (CaseReviewCopilot.tsx 상단)
// ============================================================
// const RehabResultReport = React.lazy(() => import('../../rehab-chatbot-package/components/rehab/RehabResultReport'));

// ============================================================
// 2. State 선언 (컴포넌트 내부)
// ============================================================
// const [showRehabReport, setShowRehabReport] = useState(false);

// ============================================================
// 3. 리포트 열기 버튼 (변제금 진단 결과 섹션 하단, 라인 ~902-908)
// ============================================================
/*
<button
  onClick={() => setShowRehabReport(true)}
  className="w-full bg-brand/10 hover:bg-brand/20 text-brand font-bold text-xs py-2.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
>
  <Scale className="w-3.5 h-3.5" />
  상세 진단 리포트 보기
</button>
*/

// ============================================================
// 4. RehabResultReport 모달 렌더링 (컴포넌트 JSX 최하단, 라인 ~1359-1380)
// ============================================================
/*
{showRehabReport && rehabCalcResult && rehabUserInput && (
  <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
    <RehabResultReport
      result={rehabCalcResult}
      userInput={rehabUserInput}
      onClose={() => setShowRehabReport(false)}
      embedded={false}
      viewerRole={permissions.canSendToClient ? 'lawyer' : 'staff'}
      onSendProposal={() => {
        setShowRehabReport(false);
        addAuditLog('PROPOSAL_INITIATED', '진단 리포트에서 제안서 발송 시작');
      }}
      onRequestConfirm={(memo) => {
        setShowRehabReport(false);
        setReviewStatus('LAWYER_REVIEW_REQUIRED');
        setConfirmRequest({ requester: actorName, role: actorRole, memo, requestedAt: new Date().toLocaleString('ko-KR') });
        addAuditLog('CONFIRM_REQUESTED', `변호사 컨펌 요청: ${memo}`);
      }}
    />
  </Suspense>
)}
*/

// ============================================================
// 5. RehabResultReport 컴포넌트 Props 인터페이스
// ============================================================
/*
interface RehabResultReportProps {
  result: RehabCalculationResult;
  userInput: RehabUserInput;
  onClose: () => void;
  onConsultation?: () => void;
  isLoggedIn?: boolean;
  onShowAuthModal?: () => void;
  embedded?: boolean;
  viewerRole?: 'client' | 'lawyer' | 'staff';
  onSendProposal?: () => void;
  onRequestConfirm?: (memo: string) => void;
}
*/

// ============================================================
// 6. RehabResultReport 컴포넌트 위치
// ============================================================
// 파일 경로: src/rehab-chatbot-package/components/rehab/RehabResultReport.tsx
// 6개 탭: overview(종합분석), assets(재산·가구), debts(소득·채무), 
//         statistics(나의위치), simulation(시뮬레이션), checklist(변호사가이드)
//
// 이 컴포넌트는 고객용 자가진단 리포트로 계속 사용됩니다.
// 변호사 어드민에서는 LawyerProposalDraft로 대체되었습니다.

export {};
