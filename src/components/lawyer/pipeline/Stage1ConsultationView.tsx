import React, { useState } from 'react';
import { 
  UserCheck, CheckCircle2, AlertTriangle, ShieldCheck, 
  Sparkles, ArrowRight, Scale, Calculator, Phone, FileText,
  ChevronDown, ChevronUp, AlertCircle, HelpCircle, Send
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';

interface Stage1ConsultationViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyer: User;
  onUpdateStatus: (newStatus: any) => void;
  onAdvanceToNextStage: () => void;
  onSwitchCaseType?: (type: 'individual_rehab' | 'bankruptcy') => void;
}

export default function Stage1ConsultationView({
  clientRequest,
  crmExt,
  activeLawyer,
  onUpdateStatus,
  onAdvanceToNextStage,
  onSwitchCaseType,
}: Stage1ConsultationViewProps) {
  const fp = clientRequest.financialProfile || {};
  const debtTotal = fp.debtTotal || 0; // 만원
  const income = fp.income || 0; // 만원
  const isBankruptcy = crmExt?.caseType === 'bankruptcy' || crmExt?.caseType === 'individual_bankruptcy' || income === 0;

  // 체크리스트 상태
  const [debtCheckPassed, setDebtCheckPassed] = useState(() => debtTotal > 0 && debtTotal <= 150000); // 15억 이하
  const [incomeCheckPassed, setIncomeCheckPassed] = useState(() => isBankruptcy ? true : income > 133); // 중위소득 1인 생계비 기준
  const [article595Passed, setArticle595Passed] = useState(true); // 595조 결격사유 없음
  const [caseTypeConfirmed, setCaseTypeConfirmed] = useState(() => crmExt?.crmStatus !== 'requested');

  // 아코디언 섹션 토글
  const [openSection, setOpenSection] = useState<'qualification' | 'article595' | 'casetype'>('qualification');

  const allConditionsMet = debtCheckPassed && incomeCheckPassed && article595Passed && caseTypeConfirmed;

  // 1 Major Action: 적격 확정 및 Gate 1 통과
  const handleConfirmEligibility = () => {
    setCaseTypeConfirmed(true);
    if (crmExt?.crmStatus === 'requested') {
      onUpdateStatus('consulting');
    }
    addClientNotification({
      type: 'status_change',
      title: `[적격 진단 완료] ${clientRequest.clientName}님의 ${isBankruptcy ? '개인파산' : '개인회생'} 신청 적격성 판정이 완료되었습니다.`,
      emoji: '⚖️',
      linkTab: 'diagnosis',
    });
    toast.success(`${isBankruptcy ? '개인파산' : '개인회생'} 적격성 검토가 완료되었습니다. [Gate 1 통과]`);
  };

  // 적격 안내 알림톡 전송
  const handleSendEligibilityAlimtok = () => {
    addClientNotification({
      type: 'status_change',
      title: `[상담 안내] ${clientRequest.clientName}님, 상담 결과 ${isBankruptcy ? '개인파산·면책' : '개인회생'} 신청 적격 요건을 충족하셨습니다.`,
      emoji: '📱',
      linkTab: 'diagnosis',
    });
    toast.success(`${clientRequest.clientName}님께 적격 판정 및 수임 절차 안내 알림톡이 전송되었습니다.`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. 단계 목표 & 진행률 바 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Stage 01 목표
          </span>
          <span className="text-xs font-bold text-slate-800">
            신청인 적격성 판정 및 사건유형(회생 vs 파산) 확정
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">완료 조건:</span>
          <span className="font-mono font-bold text-[#1E3A5F]">
            {Number(debtCheckPassed) + Number(incomeCheckPassed) + Number(article595Passed) + Number(caseTypeConfirmed)} / 4 충족
          </span>
          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden ml-1">
            <div 
              className="h-full bg-[#1E3A5F] rounded-full transition-all" 
              style={{ width: `${((Number(debtCheckPassed) + Number(incomeCheckPassed) + Number(article595Passed) + Number(caseTypeConfirmed)) / 4) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Next Action Hero Card (1 Major + 1~2 Minor 원칙) ── */}
      <div className={`p-5 rounded-2xl border transition-all shadow-xs ${
        allConditionsMet 
          ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${
              allConditionsMet ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
            }`}>
              {allConditionsMet ? <CheckCircle2 className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {allConditionsMet ? 'Gate 1 통과 완료' : '지금 해야 할 핵심 작업'}
                </span>
                <span className="text-sm font-black tracking-tight">
                  {allConditionsMet 
                    ? '적격 판정이 완료되었습니다. 2단계(계약·착수)로 진행하여 수임계약을 체결하세요.' 
                    : '신청인의 채무·소득 요건 및 제595조 결격사유를 검토하고 사건 유형을 확정하세요.'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {allConditionsMet 
                  ? '법원 인지대·송달료 실비 산출 및 모바일 전자계약서를 발송할 준비가 되었습니다.' 
                  : '무담보 10억/담보 15억 한도 내 채무액과 지속 소득 유무를 확인한 뒤 적격을 판정합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!allConditionsMet ? (
              <button
                type="button"
                onClick={handleConfirmEligibility}
                className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>적격 판정 및 사건유형 확정 (Major)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <span>Stage 2 (계약·착수)로 진행</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleSendEligibilityAlimtok}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              title="의뢰인에게 적격 진단 결과 및 필요 서류 알림톡 발송"
            >
              <Send className="w-3.5 h-3.5 text-[#1E3A5F]" />
              <span>적격 안내톡 발송</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. 단계별 업무 체크리스트 (아코디언 방식) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {/* 섹션 1: 채무 및 소득 법적 요건 */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'qualification' ? ('' as any) : 'qualification')}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                debtCheckPassed && incomeCheckPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>
                1
              </span>
              <span className="font-black text-xs text-slate-900">
                채무 한도 및 소득 적격 요건 검토
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                (채무 총액: {debtTotal.toLocaleString()}만원 | 월 소득: {income.toLocaleString()}만원)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                debtCheckPassed && incomeCheckPassed 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {debtCheckPassed && incomeCheckPassed ? '요건 충족' : '확인 필요'}
              </span>
              {openSection === 'qualification' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'qualification' && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-700">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
                <input
                  type="checkbox"
                  checked={debtCheckPassed}
                  onChange={e => setDebtCheckPassed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#1E3A5F] rounded border-slate-300 focus:ring-[#1E3A5F]"
                />
                <div>
                  <div className="font-bold text-slate-900">
                    채무 한도 적합 (무담보 10억 이하, 담보부 15억 이하)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    현재 총 채무액 {debtTotal.toLocaleString()}만원으로 법정 상한선 이내입니다.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
                <input
                  type="checkbox"
                  checked={incomeCheckPassed}
                  onChange={e => setIncomeCheckPassed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#1E3A5F] rounded border-slate-300 focus:ring-[#1E3A5F]"
                />
                <div>
                  <div className="font-bold text-slate-900">
                    반복적·계속적 소득 유무 (개인회생 가용소득 요건)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {income > 0 
                      ? `월 소득 ${income.toLocaleString()}만원이 확인되어 개인회생 절차 진행이 가능합니다.` 
                      : '소득이 없어 개인파산 절차 또는 소득 발생 후 회생 진행이 적합합니다.'}
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* 섹션 2: 채무자회생법 제595조 결격사유 사전 점검 */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'article595' ? ('' as any) : 'article595')}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                article595Passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                2
              </span>
              <span className="font-black text-xs text-slate-900">
                제595조 개시신청 기각사유 사전 스크리닝
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                (최근 5년 이내 면책 이력, 허위자료 제출 여부)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                article595Passed 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {article595Passed ? '결격사유 없음' : '방어 소명 필요'}
              </span>
              {openSection === 'article595' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'article595' && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2.5 text-xs text-slate-700">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200">
                <input
                  type="checkbox"
                  checked={article595Passed}
                  onChange={e => setArticle595Passed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#1E3A5F] rounded border-slate-300 focus:ring-[#1E3A5F]"
                />
                <div>
                  <div className="font-bold text-slate-900">
                    최근 5년 이내 개인회생/개인파산 면책 이력 없음 (제595조 제5호)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    과거 5년 이내에 면책을 받은 사실이 없음을 의뢰인 구두 및 KCB/NICE 신용조회로 확인하였습니다.
                  </div>
                </div>
              </label>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  제595조 기각사유(절차비용 미납, 허위작성, 성실성 결여)를 사전에 통제하기 위해 Stage 3에서 서류 마스킹 및 교차검증을 수행합니다.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 섹션 3: 사건 유형 확정 */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => setOpenSection(openSection === 'casetype' ? ('' as any) : 'casetype')}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                caseTypeConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
              }`}>
                3
              </span>
              <span className="font-black text-xs text-slate-900">
                사건 유형 확정 (개인회생 vs 개인파산)
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                현재 선택: <strong className="text-[#1E3A5F]">{isBankruptcy ? '개인파산·면책' : '개인회생'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {isBankruptcy ? '파산 트랙' : '회생 트랙'}
              </span>
              {openSection === 'casetype' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'casetype' && (
            <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onSwitchCaseType && onSwitchCaseType('individual_rehab')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !isBankruptcy 
                      ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900">⚖️ 개인회생 트랙</span>
                    {!isBankruptcy && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    정기적인 급여소득 또는 영업소득이 있어 36개월간 가용소득으로 변제 후 잔여 채무 면책
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onSwitchCaseType && onSwitchCaseType('bankruptcy')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isBankruptcy 
                      ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20 shadow-xs' 
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900">🏛️ 개인파산·면책 트랙</span>
                    {isBankruptcy && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    고령, 중증 질환, 실직 등으로 객관적인 근로능력이 결여되어 전액 일괄 면책 도모
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. 단계 완료 조건 (Gatekeeper Bar) ── */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold">Stage 1 완료 조건:</span>
          <span className="text-slate-300">
            채무/소득 요건 확인 · 제595조 결격사유 통과 · 사건유형 확정 ({allConditionsMet ? '충족' : '대기'})
          </span>
        </div>

        {allConditionsMet ? (
          <button
            type="button"
            onClick={onAdvanceToNextStage}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>Stage 2 (계약·착수)로 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConfirmEligibility}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>남은 미완료 요건 확정하기</span>
          </button>
        )}
      </div>
    </div>
  );
}
