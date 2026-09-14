import React, { useState } from 'react';
import { ShieldCheck, Scale, AlertTriangle, CheckCircle2, User, Clock, FileText, Check } from 'lucide-react';

export interface AttorneyReviewData {
  isReviewed: boolean;
  reviewerName: string;
  firmName: string;
  reviewedAt: string;
  disclaimerAgreed: boolean;
  notes?: string;
}

interface LawyerAttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reviewData: AttorneyReviewData) => void;
  clientName: string;
  monthlyPayment: number;
  totalDebt: number;
  courtName: string;
  lawyerName?: string;
  firmName?: string;
}

export const LawyerAttestationModal: React.FC<LawyerAttestationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  monthlyPayment,
  totalDebt,
  courtName,
  lawyerName = '김회생 변호사',
  firmName = '법무법인 케어'
}) => {
  const [checkedPayment, setCheckedPayment] = useState(false);
  const [checkedCourt, setCheckedCourt] = useState(false);
  const [checkedEndorse, setCheckedEndorse] = useState(false);

  if (!isOpen) return null;

  const allChecked = checkedPayment && checkedCourt && checkedEndorse;

  const handleConfirm = () => {
    if (!allChecked) return;
    onConfirm({
      isReviewed: true,
      reviewerName: lawyerName,
      firmName: firmName,
      reviewedAt: new Date().toISOString(),
      disclaimerAgreed: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-indigo-300 tracking-wide uppercase">Legal Compliance Gate</span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                AI 정밀분석 변호사 직접 검수 및 승인
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-10">
            대한민국 변호사법(제109조 및 제34조)과 대한변협 AI 가이드라인에 따라, 본 AI 분석 결과는 <strong>담당 변호사의 직접 검토 및 확인</strong>을 거쳐야만 의뢰인에게 발송될 수 있습니다.
          </p>
        </div>

        {/* 요약 바 */}
        <div className="bg-indigo-50/70 border-b border-indigo-100 px-6 py-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-medium">의뢰인: <strong className="text-slate-900">{clientName}님</strong></span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 font-medium">관할: <strong className="text-indigo-900">{courtName}</strong></span>
          </div>
          <div className="text-right font-mono font-bold text-slate-800">
            추천 월 {monthlyPayment.toLocaleString()}원
          </div>
        </div>

        {/* 검수 체크리스트 본문 */}
        <div className="p-6 space-y-3.5">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>변호사 직접 검토 필수 확인 항목 (전체 선택 필수)</span>
          </div>

          {/* 체크 1 */}
          <label className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
            checkedPayment 
              ? 'bg-indigo-50/50 border-indigo-300 shadow-xs' 
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
          }`}>
            <input 
              type="checkbox"
              checked={checkedPayment}
              onChange={(e) => setCheckedPayment(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <span>1. 월 변제금 및 청산가치 계산 결과 직접 검토</span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">필수</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                AI가 산출한 월 변제금({monthlyPayment.toLocaleString()}원)과 재산 평가액이 의뢰인의 실제 소득·재산 및 법정 최저생계비 기준에 부합함을 검토 완료했습니다.
              </p>
            </div>
          </label>

          {/* 체크 2 */}
          <label className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
            checkedCourt 
              ? 'bg-indigo-50/50 border-indigo-300 shadow-xs' 
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
          }`}>
            <input 
              type="checkbox"
              checked={checkedCourt}
              onChange={(e) => setCheckedCourt(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <span>2. 관할 법원 실무준칙 및 보정 리스크 검증</span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">필수</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {courtName} 실무준칙(주식·코인 손실금 처리, 생계비 추가 인정 기준 등) 및 향후 예상되는 보정권고 사항을 법률 전문가의 시각에서 직접 검증 및 보완했습니다.
              </p>
            </div>
          </label>

          {/* 체크 3 */}
          <label className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
            checkedEndorse 
              ? 'bg-indigo-50/50 border-indigo-300 shadow-xs' 
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
          }`}>
            <input 
              type="checkbox"
              checked={checkedEndorse}
              onChange={(e) => setCheckedEndorse(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <span>3. 담당 변호사 명의의 공인 의견서 발행 및 책임 승인</span>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">필수</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                본 제안서는 <strong>{firmName} {lawyerName}</strong>의 명의와 책임으로 발행되며, 의뢰인 열람 보고서에 검수 변호사 실명과 검토 완료 직인이 표기됨에 동의합니다.
              </p>
            </div>
          </label>

          {/* 검수자 서명 메타데이터 표시 */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700">
                변
              </div>
              <div>
                <span className="font-bold text-slate-900">{firmName} {lawyerName}</span>
                <span className="text-[11px] text-slate-500 ml-1.5">(대한변협 등록 변호사)</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{new Date().toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer min-h-[44px]"
          >
            더 검토하기 (닫기)
          </button>
          
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allChecked}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 min-h-[44px] cursor-pointer ${
              allChecked
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>변호사 확인 완료 및 최종 발송</span>
          </button>
        </div>

      </div>
    </div>
  );
};
