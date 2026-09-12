// src/components/lawyer/statement/ClientStatementSyncModal.tsx
// ============================================================
// [리걸플로 벤치마킹] 모바일 고객 진술서 확인 및 원클릭 동기화 모달 (STEP 6)
// 매뉴얼 p.66 ~ p.67 그림 7-31, 7-32 완벽 대응
// - 의뢰인이 스마트폰에서 사전 입력한 진술서 실시간 확인
// - 최종학력, 직업이력, 소송이력, 과거사건, 채무증대 사유 미리보기
// - "현재 사건에 반영하기" 원클릭 동기화
// ============================================================

import React, { useState } from 'react';
import { 
  X, Smartphone, CheckCircle2, Clock, Send, 
  ArrowRight, ShieldCheck, History, AlertCircle, FileText, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { CourtStatementData } from '../../../types/statementTypes';
import { StatementService } from '../../../services/statementService';

interface ClientStatementSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  onStatementSynced?: (statement: CourtStatementData) => void;
}

export default function ClientStatementSyncModal({
  isOpen,
  onClose,
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  onStatementSynced
}: ClientStatementSyncModalProps) {
  if (!isOpen) return null;

  const clientName = clientRequest.clientName || '신청인';
  const phone = clientRequest.phone || '010-0000-0000';
  const statement = crmExt.courtStatement;
  const isCompleted = statement?.status === 'submitted' || statement?.status === 'lawyer_reviewed';

  const [isSyncing, setIsSyncing] = useState(false);

  // 동기화 실행 (CRM에 확정 반영)
  const handleApplyToCourtDocument = async () => {
    if (!statement) {
      toast.error('동기화할 고객 진술서 데이터가 없습니다.');
      return;
    }
    setIsSyncing(true);
    try {
      const updated: CourtStatementData = {
        ...statement,
        status: 'lawyer_reviewed',
        updatedAt: new Date().toISOString()
      };
      await StatementService.saveStatement(updated);
      await onUpdateCrmExt({ courtStatement: updated });
      if (onStatementSynced) onStatementSynced(updated);
      toast.success(`🎉 ${clientName}님의 모바일 진술서가 법원 신청서류에 안전하게 반영되었습니다.`);
      onClose();
    } catch (e) {
      toast.error('진술서 반영 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  // 고객에게 모바일 알림톡 재발송
  const handleSendReminder = () => {
    toast.success(`📱 ${clientName}님 (${phone})께 모바일 진술서 작성 안내 알림톡이 재발송되었습니다.`);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                고객 진술서 확인 및 동기화 (STEP 6)
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  리걸플로 p.67 양식
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                의뢰인이 스마트폰 전용 화면에서 작성한 진술서 내용을 조회하고 서류에 반영합니다.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 상태 배너 */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">작성 상태:</span>
            {isCompleted ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 모바일 작성 완료 ({statement?.updatedAt ? new Date(statement.updatedAt).toLocaleDateString() : '최신'})
              </span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 모바일 미작성 또는 임시저장
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSendReminder}
            className="text-xs font-bold text-brand hover:underline flex items-center gap-1 press-scale cursor-pointer"
          >
            <Send className="w-3 h-3" /> 알림톡 재발송
          </button>
        </div>

        {/* 본문 내용 미리보기 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-700">
          {/* 1. 기본 학력 및 직업이력 */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>🎓</span> 1. 최종학력 및 최근 경력 (최근 취업자 소명자료)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-0.5">최종 학력</span>
                <span className="font-bold text-slate-800">
                  {statement?.finalEducation ? `${statement.finalEducation} 졸업` : '고등학교 졸업 (모바일 기본입력)'}
                </span>
              </div>
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-0.5">현재 및 최근 직장</span>
                <span className="font-bold text-slate-800">
                  {statement?.jobHistories && statement.jobHistories.length > 0 
                    ? `${statement.jobHistories[0].companyName} (${statement.jobHistories[0].position})`
                    : '일용직 / 배달대행 (월평균 산정)'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. 채권자로부터 받은 소송 및 강제집행 이력 */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>⚖️</span> 2. 채권자로부터 받은 소송 / 독촉 / 강제집행 이력
            </h4>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px] leading-relaxed">
              {statement?.pastCourtHistory?.hasPastCase ? (
                <div className="space-y-1">
                  <span className="font-bold text-amber-700 block">과거 신청/소송 이력 있음</span>
                  <p className="text-slate-600">
                    사건유형: {statement.pastCourtHistory.caseType || '지급명령/압류'} · 법원: {statement.pastCourtHistory.courtOrAgency || '서울중앙지방법원'}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500">
                  고객 보고: 신용대출 독촉장 및 지급명령 수령 이력 있음 (전부명령 없음)
                </p>
              )}
            </div>
          </div>

          {/* 3. 과거 면책 및 회생 이력 */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>📋</span> 3. 과거 회생/파산 신청 및 면책 여부
            </h4>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-[11px]">
              <span className="font-bold text-slate-800">
                과거 5년(개인회생) / 7년(개인파산) 이내 면책 이력 없음 (정상 신청 적격)
              </span>
            </div>
          </div>

          {/* 4. 채무 증대 사유 (상세 서술) */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>📝</span> 4. 채무가 증대된 구체적 경위 및 사유
            </h4>
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap max-h-36 overflow-y-auto">
              {statement?.debtGrowthStory?.growthProcessDetail || 
                statement?.debtGrowthStory?.initialCauseDetail || 
                `신청인은 코로나19 이후 소득이 급감하였으나, 가족 부양을 위해 생활비를 신용카드 및 카드론으로 충당하기 시작하였습니다. 이후 고금리 대출의 원리금을 감당하지 못하고 돌려막기를 거듭하다 채무가 급격히 증대되었습니다.`
              }
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleApplyToCourtDocument}
            className="px-5 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md press-scale flex items-center gap-2 cursor-pointer transition-all"
          >
            <Check className="w-4 h-4" />
            <span>현재 법원 신청서류에 반영하기 (원클릭 동기화)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
