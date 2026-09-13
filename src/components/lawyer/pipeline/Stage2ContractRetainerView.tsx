import React, { useState } from 'react';
import { 
  FileCheck2, Calculator, Send, CheckCircle2, AlertTriangle, 
  Coins, UserCheck, Calendar, ArrowRight, ShieldAlert, Sparkles,
  ExternalLink, FileText, Phone, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';

interface Stage2ContractRetainerViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyer: User;
  onUpdateStatus: (newStatus: any) => void;
  onAdvanceToNextStage: () => void;
  onOpenContractSubTab?: () => void;
  onOpenPowerOfAttorneyModal?: () => void;
}

export default function Stage2ContractRetainerView({
  clientRequest,
  crmExt,
  activeLawyer,
  onUpdateStatus,
  onAdvanceToNextStage,
  onOpenContractSubTab,
  onOpenPowerOfAttorneyModal,
}: Stage2ContractRetainerViewProps) {
  const [creditorCount, setCreditorCount] = useState<number>(() => {
    return (crmExt?.debtCertificateOrders?.[0]?.items || []).length || (clientRequest as any)?.creditorCount || 5;
  });
  const [isBusinessDebtor, setIsBusinessDebtor] = useState(() => {
    return (clientRequest as any)?.category === 'business' || (clientRequest as any)?.jobType === 'business';
  });
  const [retainerFee, setRetainerFee] = useState<number>(() => {
    return crmExt?.feeSchedule?.[0]?.amount || (crmExt?.totalFee ? Math.round(crmExt.totalFee * 0.3) : 500000);
  });
  const [monthlyFee, setMonthlyFee] = useState<number>(() => {
    return crmExt?.feeSchedule?.[1]?.amount || 300000;
  });
  const [installmentMonths, setInstallmentMonths] = useState<number>(() => {
    return crmExt?.feeSchedule?.length ? Math.max(1, crmExt.feeSchedule.length - 1) : 4;
  });
  const [isContractSigned, setIsContractSigned] = useState(() => {
    return crmExt?.crmStatus === 'contracted' || crmExt?.crmStatus === 'preparing' || crmExt?.crmStatus === 'completed' || !!crmExt?.contractDate;
  });

  // 법원 실비 계산 공식 (2026 전자소송 기준)
  // 1) 인지대: 28,800원 고정 (개시 27,000 + 금지명령 1,800)
  const stampFee = 28800;
  // 2) 송달료: 5,200원 * (기본 10회 + 채권자수 * 8회)
  const deliveryFee = 5200 * (10 + (creditorCount * 8));
  // 3) 외부회생위원 선임 예납금: 영업소득자 150,000원
  const trusteeDeposit = isBusinessDebtor ? 150000 : 0;
  // 총 법원 비용
  const totalCourtCost = stampFee + deliveryFee + trusteeDeposit;

  // 총 변호사 수임료
  const totalLawyerFee = retainerFee + (monthlyFee * installmentMonths);
  // 의뢰인 총 부담금
  const grandTotal = totalCourtCost + totalLawyerFee;

  // 전자계약서 모바일 발송 핸들러
  const handleSendElectronicContract = () => {
    addClientNotification({
      type: 'status_change',
      title: '[전자계약서 발송] 카카오 알림톡으로 전송된 전자서명 링크를 확인해 서명을 완료해주세요.',
      emoji: '✍️',
      linkTab: 'diagnosis',
    });
    toast.success(`${clientRequest.clientName}님께 모바일 전자계약서 링크가 카카오 알림톡으로 발송되었습니다.`);
  };

  // 방문/대면 계약 확인 핸들러
  const handleConfirmInPersonContract = () => {
    setIsContractSigned(true);
    onUpdateStatus('contracted');
    addClientNotification({
      type: 'status_change',
      title: '[수임계약 체결 완료] 정식 사건 위임계약이 체결되어 서류 수합 및 사건 진행을 개시합니다.',
      emoji: '📝',
      linkTab: 'diagnosis',
    });
    toast.success('방문/서면 계약 체결이 완료 처리되었습니다. [Gate 2 통과]');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. 단계 목표 & 진행률 바 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Stage 02 목표
          </span>
          <span className="text-xs font-bold text-slate-800">
            법원 실비·수임료 산출 및 모바일 전자계약 체결 (위임장 확보)
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">계약 상태:</span>
          <span className={`font-bold px-2 py-0.5 rounded border ${
            isContractSigned 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {isContractSigned ? '✓ 수임 체결 완료' : '서명 대기중'}
          </span>
        </div>
      </div>

      {/* ── 2. Next Action Hero Card (1 Major + 1~2 Minor 원칙) ── */}
      <div className={`p-5 rounded-2xl border transition-all shadow-xs ${
        isContractSigned 
          ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${
              isContractSigned ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
            }`}>
              {isContractSigned ? <CheckCircle2 className="w-5 h-5" /> : <FileCheck2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {isContractSigned ? 'Gate 2 통과 완료' : '지금 해야 할 핵심 작업'}
                </span>
                <span className="text-sm font-black tracking-tight">
                  {isContractSigned 
                    ? '정식 위임계약이 완료되었습니다. 소송위임장을 확인하거나 3단계로 진행하세요.' 
                    : '의뢰인에게 모바일 전자계약서를 전송하여 정식 위임 계약을 체결하세요.'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isContractSigned 
                  ? '소송대리인 위임장이 생성되었습니다. 3단계(고객정보·서류수집)로 안전하게 이동할 수 있습니다.' 
                  : '카카오 알림톡으로 스마트폰 전자서명 링크를 즉시 발송하거나, 방문 계약 시 수동 체결 처리합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!isContractSigned ? (
              <>
                <button
                  type="button"
                  onClick={handleSendElectronicContract}
                  className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>모바일 전자계약서 발송 (Major)</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmInPersonContract}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="방문 상담 등으로 이미 종이 서면 계약서를 체결한 경우"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>서면계약 완료 처리</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAdvanceToNextStage}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
                >
                  <span>Stage 3 (서류수집)로 진행</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {onOpenPowerOfAttorneyModal && (
                  <button
                    type="button"
                    onClick={onOpenPowerOfAttorneyModal}
                    className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>소송위임장 발급</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. 실비·수임료 2단 산정 캔버스 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 2026 전자소송 법원 실비 계산기 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1E3A5F]" />
              <h4 className="font-black text-sm text-slate-900">법원 필수 실비 자동 산출</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-bold">2026 전자소송 요율 기준</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>채권자 수 (금융사 + 개인채권자)</span>
                <span className="text-[#1E3A5F] font-mono">{creditorCount}개 사</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={creditorCount}
                onChange={e => setCreditorCount(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBusinessDebtor}
                  onChange={e => setIsBusinessDebtor(e.target.checked)}
                  className="rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                />
                <span className="font-bold text-slate-800">영업소득자 (외부회생위원 예납금 15만원 대상)</span>
              </label>
              <span className={`font-mono font-bold ${isBusinessDebtor ? 'text-blue-600' : 'text-slate-400'}`}>
                {isBusinessDebtor ? '+150,000원' : '해당없음'}
              </span>
            </div>

            {/* 실비 상세 내역 */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
              <div className="flex justify-between">
                <span>1. 인지대 (개시신청 + 금지명령 10% 감액)</span>
                <span className="font-mono font-bold text-slate-800">{stampFee.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span>2. 송달료 (기본 10회 + {creditorCount}곳 × 8회 = {10 + (creditorCount * 8)}회)</span>
                <span className="font-mono font-bold text-slate-800">{deliveryFee.toLocaleString()}원</span>
              </div>
              {isBusinessDebtor && (
                <div className="flex justify-between">
                  <span>3. 외부회생위원 선임 예납금</span>
                  <span className="font-mono font-bold text-slate-800">{trusteeDeposit.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100 font-extrabold text-slate-900">
                <span>법원 실비 소계</span>
                <span className="text-blue-600 font-mono text-sm">{totalCourtCost.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 우측: 로펌 수임료 및 분납 일정 확정 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <h4 className="font-black text-sm text-slate-900">수임료 및 분납 조건 설정</h4>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              무이자 분납 지원
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">착수금 (계약 시 납부)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="50000"
                    value={retainerFee}
                    onChange={e => setRetainerFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-medium">원</span>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">월 분납금 (회당)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="50000"
                    value={monthlyFee}
                    onChange={e => setMonthlyFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-medium">원</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>분납 회차</span>
                <span className="text-[#1E3A5F] font-mono">{installmentMonths}회 분납</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                value={installmentMonths}
                onChange={e => setInstallmentMonths(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
              />
            </div>

            {/* 수임료 및 총액 요약 */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
              <div className="flex justify-between">
                <span>착수금 1회</span>
                <span className="font-mono font-bold text-slate-800">{retainerFee.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span>분납 합계 ({monthlyFee.toLocaleString()}원 × {installmentMonths}회)</span>
                <span className="font-mono font-bold text-slate-800">{(monthlyFee * installmentMonths).toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 font-extrabold text-slate-900">
                <span>총 수임료 (부가세 별도/포함 합의)</span>
                <span className="text-emerald-600 font-mono text-sm">{totalLawyerFee.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. 의뢰인 총 부담금 종합 바 & 완료 이동 버튼 ── */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">의뢰인 총 부담 예정액 (실비 + 수임료)</span>
            <span className="font-mono text-lg font-black text-emerald-400">{grandTotal.toLocaleString()}원</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="text-[11px] text-slate-300">
            <span>법원실비 {totalCourtCost.toLocaleString()}원 + 변호사보수 {totalLawyerFee.toLocaleString()}원</span>
          </div>
        </div>

        {isContractSigned ? (
          <button
            type="button"
            onClick={onAdvanceToNextStage}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>Stage 3 (고객정보·서류수집)로 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSendElectronicContract}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>전자계약서 발송 후 체결 대기</span>
          </button>
        )}
      </div>
    </div>
  );
}
