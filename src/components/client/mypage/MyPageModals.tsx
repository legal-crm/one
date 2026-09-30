import React from 'react';
import PremiumProposalReportModal from '../../common/PremiumProposalReportModal';
import { getIncomeExpenseProgress, getPropertyProgress, getStatementProgress } from '../docDrafts';
import { updateCrmClientExtension } from '../../../services/crmService';
import CreditorMeetingGuideModal from '../companion/CreditorMeetingGuideModal';
import ClientCertificateSubmissionModal from '../vault/ClientCertificateSubmissionModal';
import type { MyPageModel } from './useMyPageModel';
const Fast2ndDocHubModal = React.lazy(() => import('../Fast2ndDocHubModal'));
const ClientStatementModal = React.lazy(() => import('../statement/ClientStatementModal'));
const ClientPropertyIntakeModal = React.lazy(() => import('../property/ClientPropertyIntakeModal'));
const ClientMonthlyIncomeExpenseModal = React.lazy(() => import('../incomeExpense/ClientMonthlyIncomeExpenseModal'));
const ClientBankAuditModal = React.lazy(() => import('../correction/ClientBankAuditModal'));

/**
 * 마이페이지에서 여는 모달 모음(제안서 리포트·서류 작성 모달·채권자집회 안내·인증서 제출) (MyPageView에서 분리)
 */
export default function MyPageModals({ vm }: { vm: MyPageModel }) {
  const {
    activeRequest, clientVault, crmExt, handleStartContractFromProposal, isBankAuditModalOpen,
    isCertSubmissionModalOpen, isContracted, isCreditorMeetingModalOpen, isFastDocHubOpen,
    isIncomeExpenseModalOpen, isPropertyIntakeModalOpen, isStatementModalOpen, onNavigateToChat, profile,
    requests, selectedProposalForReport, setClientVault, setIsBankAuditModalOpen,
    setIsCertSubmissionModalOpen, setIsCreditorMeetingModalOpen, setIsFastDocHubOpen,
    setIsIncomeExpenseModalOpen, setIsPropertyIntakeModalOpen, setIsStatementModalOpen, setRefreshTick,
    setSelectedProposalForReport, targetClientId, userAlias,
  } = vm;
  return (
    <>
      {/* 프리미엄 제안서 & 7p AI 진단서 모달 */}
      {selectedProposalForReport && (
        <PremiumProposalReportModal
          isOpen={!!selectedProposalForReport}
          onClose={() => setSelectedProposalForReport(null)}
          isContracted={isContracted}
          proposal={selectedProposalForReport}
          clientInfo={activeRequest || requests[0]}
          onContactLawyer={() => {
            const targetReqId = activeRequest?.id || requests[0]?.id;
            setSelectedProposalForReport(null);
            onNavigateToChat(targetReqId);
          }}
          onAppointLawyer={() => {
            const propToAppoint = selectedProposalForReport;
            setSelectedProposalForReport(null);
            handleStartContractFromProposal(propToAppoint);
          }}
        />
      )}

      {/* 🚀 2차 서류 원스톱 완성 & 변호사·사무장 전달 허브 모달 */}
      {isFastDocHubOpen && (
        <React.Suspense fallback={null}>
          <Fast2ndDocHubModal
            isOpen={isFastDocHubOpen}
            onClose={() => setIsFastDocHubOpen(false)}
            clientName={profile?.name || userAlias || '신청인'}
            clientId={activeRequest?.id || requests[0]?.id || 'client-self'}
            // 작성 여부·채무 요약은 실제 값만 (제출 완료일 때만 '작성 완료'로 표시)
            hasStatement={getStatementProgress(activeRequest?.id || requests[0]?.id || 'client-self') === 'submitted'}
            hasIncomeExpense={getIncomeExpenseProgress(crmExt?.incomeExpenseD5103) === 'submitted'}
            hasProperty={
              getPropertyProgress(activeRequest?.id || requests[0]?.id || 'client-self', profile?.name || userAlias) === 'submitted' ||
              ['submitted_to_lawyer', 'reviewed_by_lawyer'].includes((crmExt as any)?.propertyListD5102?.clientIntakeStatus)
            }
            debtSummary={{
              totalDebt: profile?.debtTotal ? profile.debtTotal * 10000 : 0,
              monthlyIncome: profile?.income ? profile.income * 10000 : 0,
              courtName: activeRequest?.court || '',
              expectedReductionRate: 0,
              monthlyPayment: 0
            }}
            onOpenStatementModal={() => setIsStatementModalOpen(true)}
            onOpenIncomeExpenseModal={() => setIsIncomeExpenseModalOpen(true)}
            onOpenPropertyModal={() => setIsPropertyIntakeModalOpen(true)}
          />
        </React.Suspense>
      )}

      {/* 🎙️ 법원 제출용 진술서 작성 모달 (Gemini AI 도우미) */}
      {isStatementModalOpen && (
        <React.Suspense fallback={null}>
          <ClientStatementModal
            isOpen={isStatementModalOpen}
            onClose={() => setIsStatementModalOpen(false)}
            clientId={activeRequest?.id || requests[0]?.id || 'client-self'}
            clientName={profile?.name || userAlias || '신청인'}
            caseType={activeRequest?.caseType === 'bankruptcy' || activeRequest?.category === 'individual_bankruptcy' ? 'bankruptcy' : 'rehab'}
            courtName={activeRequest?.court || ''}
            totalDebtAmount={profile?.debtTotal || 0}
            monthlyIncome={profile?.income || 0}
            onSuccessSubmitted={() => {
              setRefreshTick(c => c + 1);
            }}
          />
        </React.Suspense>
      )}

      {/* 📋 법원 제출용 재산상황표(D5102) 기초자료 작성 모달 (리걸플로 7-4 벤치마킹) */}
      {isPropertyIntakeModalOpen && (
        <React.Suspense fallback={null}>
          <ClientPropertyIntakeModal
            isOpen={isPropertyIntakeModalOpen}
            onClose={() => setIsPropertyIntakeModalOpen(false)}
            clientId={activeRequest?.id || requests[0]?.id || 'client-self'}
            clientName={profile?.name || userAlias || '신청인'}
            onSyncToLawyerCrm={async (updates) => {
              const targetId = activeRequest?.id || requests[0]?.id || 'client-self';
              const ok = updates ? await updateCrmClientExtension(targetId, updates) : false;
              setRefreshTick(c => c + 1);
              return ok;
            }}
          />
        </React.Suspense>
      )}

      {/* 📊 법원 제출용 수입 및 지출 내역서 (수지표, D5103) 고객 작성 모달 */}
      {isIncomeExpenseModalOpen && (
        <React.Suspense fallback={null}>
          <ClientMonthlyIncomeExpenseModal
            isOpen={isIncomeExpenseModalOpen}
            onClose={() => setIsIncomeExpenseModalOpen(false)}
            clientId={activeRequest?.id || requests[0]?.id || 'client-self'}
            clientName={profile?.name || userAlias || '신청인'}
            initialD5103={crmExt?.incomeExpenseD5103 || null}
            onSaveD5103={async (updatedData) => {
              const targetId = activeRequest?.id || requests[0]?.id || 'client-self';
              const ok = await updateCrmClientExtension(targetId, {
                incomeExpenseD5103: updatedData
              });
              setRefreshTick(c => c + 1);
              if (!ok) throw new Error('서버 저장 실패');
            }}
          />
        </React.Suspense>
      )}

      {/* 💳 법원 100만 원 이상 금융거래 소명표 고객 모달 */}
      {isBankAuditModalOpen && (
        <React.Suspense fallback={null}>
          <ClientBankAuditModal
            isOpen={isBankAuditModalOpen}
            onClose={() => setIsBankAuditModalOpen(false)}
            clientId={activeRequest?.id || requests[0]?.id || 'client-self'}
            clientName={profile?.name || userAlias || '신청인'}
            caseNumber={crmExt?.courtCase?.caseNumber || (activeRequest as any)?.caseNumber || ''}
            courtName={crmExt?.courtCase?.courtName || activeRequest?.court || ''}
            onSubmittedSuccess={() => {
              setRefreshTick(c => c + 1);
            }}
            onSyncToCrm={(data) => updateCrmClientExtension(activeRequest?.id || requests[0]?.id || 'client-self', { bankStatementAudit: data })}
          />
        </React.Suspense>
      )}

      {/* 채권자집회 출석 가이드 모달 */}

      <CreditorMeetingGuideModal
        isOpen={isCreditorMeetingModalOpen}
        onClose={() => setIsCreditorMeetingModalOpen(false)}
        courtName={crmExt?.courtCase?.courtName || activeRequest?.court || ''}
        caseNumber={crmExt?.courtCase?.caseNumber || (activeRequest as any)?.caseNumber || '사건 접수 준비중'}
      />

      {/* 🔐 의뢰인 안심 인증서 제출 마법사 모달 */}
      {isCertSubmissionModalOpen && targetClientId && (
        <ClientCertificateSubmissionModal
          clientId={targetClientId}
          clientName={profile?.name || userAlias || '신청인'}
          clientPhone={profile?.phone || (activeRequest as any)?.phone || ''}
          existingVault={clientVault || undefined}
          onSaveVault={async (updated) => {
            setClientVault(updated);
            await updateCrmClientExtension(targetClientId, { certificateVault: updated });
            setRefreshTick(c => c + 1);
          }}
          onClose={() => setIsCertSubmissionModalOpen(false)}
        />
      )}
    </>
  );
}
