import React, { useState } from 'react';
import { 
  FileCheck2, Calculator, Send, CheckCircle2, AlertTriangle, 
  Coins, UserCheck, Calendar, ArrowRight, ShieldAlert, Sparkles,
  ExternalLink, FileText, Phone, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User } from '../../../types';
import { sendFeeAlimtok } from '../../../services/alimtokService';
import { addClientNotification } from '../../../services/clientNotificationService';

interface Stage1ContractViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyer: User;
  onUpdateStatus: (newStatus: any) => void;
  onAdvanceToNextStage: () => void;
  onOpenContractSubTab?: () => void;
}

export default function Stage1ContractView({
  clientRequest,
  crmExt,
  activeLawyer,
  onUpdateStatus,
  onAdvanceToNextStage,
  onOpenContractSubTab,
}: Stage1ContractViewProps) {
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

  // 5년 이내 면책 이력 여부 (제595조 제5호 기각 방어)
  const hasRecentDischarge = clientRequest.financialProfile?.income === 0 && (clientRequest.financialProfile?.debtTotal || 0) > 1000000000;

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
    toast.success('방문/서면 계약 체결이 완료 처리되었습니다. [Gate 1 통과]');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 게이트키퍼 안내 배너 */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xs ${
        isContractSigned 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
          : 'bg-amber-50/90 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isContractSigned ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
            {isContractSigned ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-black flex items-center gap-2">
              {isContractSigned ? 'Gate 1 통과 완료 (수임 계약 체결)' : 'Gate 1 대기중: 수임 계약이 선행되어야 서류 수합을 개시할 수 있습니다'}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {isContractSigned 
                ? '전자계약 또는 방문 서명이 완료되어 Stage 2(서류·부채증명 발급)로 진입할 수 있습니다.'
                : '똑생·리걸플로 실무 기준: 의뢰인과의 위임계약 및 착수금 약정 후 본격적인 서류 요청이 진행됩니다.'}
            </div>
          </div>
        </div>

        {isContractSigned ? (
          <button
            onClick={onAdvanceToNextStage}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer shrink-0"
          >
            <span>Stage 2 (서류 허브)로 이동</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleConfirmInPersonContract}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer shrink-0"
          >
            <UserCheck className="w-4 h-4" />
            <span>방문/대면 계약 완료 처리</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌측 7열: AI 사전 자격 진단 & 법원 실비 계산기 */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. AI 사건 종합 진단 카드 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <Sparkles className="w-4 h-4 text-brand" />
                <span>개인회생 신청 적격성 AI 1차 진단</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                신청 적격 판정
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-slate-500 block">총 채무액</span>
                <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                  {((clientRequest.financialProfile?.debtTotal || 0) * 10000).toLocaleString()}원
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">월 평균 소득</span>
                <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                  {((clientRequest.financialProfile?.income || 0) * 10000).toLocaleString()}원
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">소득 형태</span>
                <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                  {isBusinessDebtor ? '영업소득자' : '급여소득자'}
                </span>
              </div>
            </div>

            {/* 법적 결격사유 사전 스크리닝 (채무자회생법 제595조 제5호) */}
            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
              <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">채무자회생법 제595조 결격사유 사전 검증:</span>
                <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
                  신청일 기준 최근 5년 이내 면책(파산/개인회생) 사실이 없으며, 담보부채무 15억 이하, 무담보채무 10억 이하의 개인회생 개시신청 요건을 충족합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 2. 2026 법원 실비(인지대·송달료) 자동 계산기 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <Calculator className="w-4 h-4 text-brand" />
                <span>법원 실비 정밀 계산기 (2026 전자소송 기준)</span>
              </div>
              <span className="text-[11px] text-slate-500">법원 예납 실비 자동 산출</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  예상 채권자 수 (금융사 + 대부 + 개인)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={creditorCount}
                    onChange={e => setCreditorCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <span className="text-slate-500 font-medium">개 채권처</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  외부 회생위원 선임 대상 여부
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-2 text-slate-800">
                  <input
                    type="checkbox"
                    checked={isBusinessDebtor}
                    onChange={e => setIsBusinessDebtor(e.target.checked)}
                    className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand"
                  />
                  <span>영업소득자 (예납금 15만원 추가)</span>
                </label>
              </div>
            </div>

            {/* 실비 산출 내역 상세 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>전자소송 인지대 (개시 27,000 + 금지 1,800)</span>
                <span className="font-mono font-bold text-slate-900">{stampFee.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>송달료 (5,200원 × [10회 + {creditorCount}곳 × 8회 = {10 + creditorCount * 8}회])</span>
                <span className="font-mono font-bold text-slate-900">{deliveryFee.toLocaleString()}원</span>
              </div>
              {trusteeDeposit > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>외부회생위원 예납금</span>
                  <span className="font-mono font-bold text-slate-900">{trusteeDeposit.toLocaleString()}원</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-slate-900">
                <span>법원 납부 실비 합계</span>
                <span className="text-brand font-mono">{totalCourtCost.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 우측 5열: 수임료 분납 스케줄러 & 전자계약 발송 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                <Coins className="w-4 h-4 text-brand" />
                <span>수임료 약정 및 분납 스케줄</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700">
                최대 6회 분납
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">착수금 (계약 시 선납)</label>
                <div className="relative">
                  <input
                    type="number"
                    step={50000}
                    value={retainerFee}
                    onChange={e => setRetainerFee(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-right pr-8"
                  />
                  <span className="absolute right-3 top-2 text-slate-400">원</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">월 분납금</label>
                  <div className="relative">
                    <input
                      type="number"
                      step={50000}
                      value={monthlyFee}
                      onChange={e => setMonthlyFee(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-right pr-8"
                    />
                    <span className="absolute right-3 top-2 text-slate-400">원</span>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">분납 횟수</label>
                  <select
                    value={installmentMonths}
                    onChange={e => setInstallmentMonths(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    <option value={1}>일시납 (0회)</option>
                    <option value={2}>2회 분납</option>
                    <option value={3}>3회 분납</option>
                    <option value={4}>4회 분납</option>
                    <option value={5}>5회 분납</option>
                    <option value={6}>6회 분납</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 총액 요약 박스 */}
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>법원 실비</span>
                <span className="font-mono">{totalCourtCost.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>변호사 수임료 합계</span>
                <span className="font-mono">{totalLawyerFee.toLocaleString()}원</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-black text-sm text-emerald-400">
                <span>의뢰인 총 청구액</span>
                <span className="font-mono text-base">{grandTotal.toLocaleString()}원</span>
              </div>
            </div>

            {/* 전자계약 발송 버튼 & 방문계약 확인 */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleSendElectronicContract}
                className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 press-scale cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>카카오 알림톡 모바일 전자계약서 발송</span>
              </button>

              <button
                onClick={handleConfirmInPersonContract}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4 text-slate-500" />
                <span>사무소 방문 서면계약 완료 처리</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
