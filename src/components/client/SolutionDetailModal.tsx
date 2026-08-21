import React from 'react';
import {
  X, Scale, Shield, AlertTriangle,
  ArrowRight, Landmark, RefreshCw
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
export type SolutionType = 'rehab' | 'bankruptcy' | 'credit' | 'representation' | 'tax';

interface SolutionDetailModalProps {
  solutionType: SolutionType;
  onClose: () => void;
  onStartDiagnosis: () => void;
  onApplyConsult: (title: string, content: string) => void;
}

// ─── Icon Resolver ───────────────────────────────────────────────────────────
const getIcon = (type: SolutionType) => {
  const map: Record<SolutionType, string> = {
    rehab: '⚖️', bankruptcy: '🔓', credit: '🏦', representation: '🛡️', tax: '📊',
  };
  return map[type];
};

// ─── Solution Data (간소화) ──────────────────────────────────────────────────
const solutions: Record<SolutionType, {
  title: string;
  summary: string;
  keyPoints: string[];
  ctaTitle: string;
  ctaContent: string;
}> = {
  rehab: {
    title: '개인회생',
    summary: '정기적 소득이 있는 분이 법원에 신청하는 채무조정 절차입니다. 3~5년간 일정 금액을 변제하면 나머지 채무가 면책될 수 있습니다.',
    keyPoints: [
      '무담보 5억, 담보 10억 이하 채무 대상',
      '매월 일정액 변제 → 나머지 면책 가능',
      '재산을 유지하면서 진행 가능',
    ],
    ctaTitle: '개인회생 관련 상담 문의',
    ctaContent: '개인회생 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  bankruptcy: {
    title: '개인파산',
    summary: '소득이 없거나 매우 적어 갚을 능력이 없는 경우, 법원 심사를 거쳐 채무를 면책받을 수 있는 절차입니다.',
    keyPoints: [
      '소득이 없거나 극히 적은 경우 신청 가능',
      '면책 결정 시 채무 책임 면제',
      '세금·벌금 등 일부 비면책 채권 존재',
    ],
    ctaTitle: '개인파산 관련 상담 문의',
    ctaContent: '개인파산 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  credit: {
    title: '신용회복',
    summary: '신용회복위원회를 통해 은행·카드사 등 금융기관 채무의 이자 감면, 상환 기간 조정 등을 신청할 수 있는 제도입니다.',
    keyPoints: [
      '법원 절차 없이 진행 가능',
      '접수 시 추심 중지 요청',
      '사채 등 비금융 채무는 대상 제외',
    ],
    ctaTitle: '신용회복 관련 상담 문의',
    ctaContent: '신용회복 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  representation: {
    title: '채무자대리',
    summary: '변호사를 대리인으로 선임하면 채권자가 직접 연락할 수 없게 됩니다. 과도한 추심으로 고통받는 경우 활용할 수 있습니다.',
    keyPoints: [
      '대리인 선임 후 직접 추심 차단',
      '불법 추심 시 법적 대응 가능',
      '채무 자체의 감면은 별도 절차 필요',
    ],
    ctaTitle: '채무자대리 관련 상담 문의',
    ctaContent: '채무자대리인 제도에 대한 정보를 확인한 후 상담을 문의합니다.',
  },
  tax: {
    title: '세금체납',
    summary: '체납 세금의 소멸시효, 압류 해제, 분할납부 등을 검토할 수 있습니다. 세금은 회생·파산으로 면책되지 않아 별도 대응이 필요합니다.',
    keyPoints: [
      '징수권 소멸시효 확인 가능',
      '부당 압류 해제 요청 가능',
      '납기 연장·분할납부 신청 가능',
    ],
    ctaTitle: '세금 체납 관련 상담 문의',
    ctaContent: '세금 체납 관련 정보를 확인한 후 상담을 문의합니다.',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function SolutionDetailModal({
  solutionType,
  onClose,
  onStartDiagnosis,
  onApplyConsult,
}: SolutionDetailModalProps) {
  const data = solutions[solutionType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 bg-[#0F2440] text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center text-2xl backdrop-blur-sm shrink-0">
              {getIcon(solutionType)}
            </div>
            <h3 className="text-xl font-extrabold tracking-tight">{data.title}</h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto text-left flex-1">
          <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{data.summary}</p>

          <div className="space-y-2.5">
            {data.keyPoints.map((point, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0F766E] mt-2 shrink-0" />
                <span className="text-sm sm:text-base text-slate-800 dark:text-slate-200 font-semibold">{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            닫기
          </button>
          <button
            onClick={() => {
              onClose();
              onStartDiagnosis();
            }}
            className="flex-1 px-5 py-3.5 bg-[#1E3A5F] hover:bg-[#162D4A] text-white rounded-xl text-base font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 whitespace-nowrap shadow-sm cursor-pointer"
          >
            채무 체크 시작하기
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center pb-3 px-4">
          이 화면은 일반 정보 안내이며, 이용 가능 여부를 판단하지 않습니다.
        </p>
      </div>
    </div>
  );
}
