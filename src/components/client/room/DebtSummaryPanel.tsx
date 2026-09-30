import React from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import type { RehabCalculationResult } from '../../../rehab-chatbot-package/services/calculationService';
import { Badge, Button, EmptyState } from '../ui';
import { formatKoreanWon } from '../ui/form';

/**
 * 내 관리방 '내 채무' 요약 (내 상황 체크 결과)
 * 숫자는 입력값 기준 예상치이며, 결과 상태도 법원 판단을 단정하지 않는 표현만 쓴다.
 */
interface DebtSummaryPanelProps {
  result?: RehabCalculationResult;
  onEdit: () => void;
  onStartCheck: () => void;
  /** 데스크톱 옆 칸처럼 좁은 곳에서는 2열로 */
  compact?: boolean;
}

/** 큰 금액은 만원 단위로 줄여 보여 준다 (반올림했으면 '약'을 붙인다) */
function formatLargeWon(won: number): string {
  const n = Math.max(0, Math.round(won || 0));
  if (n < 10000) return formatKoreanWon(n);
  const man = Math.round(n / 10000);
  return `${n % 10000 === 0 ? '' : '약 '}${man.toLocaleString('ko-KR')}만원`;
}

const STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  POSSIBLE: { label: '신청 가능성 있음', tone: 'success' },
  DIFFICULT: { label: '보완 검토 필요', tone: 'warning' },
};

export default function DebtSummaryPanel({ result, onEdit, onStartCheck, compact = false }: DebtSummaryPanelProps) {
  if (!result) {
    return (
      <EmptyState
        compact
        icon={<ShieldCheck className="w-6 h-6" />}
        title="아직 내 상황 체크를 하지 않았어요"
        description="질문에 답하면 예상 월 변제금과 감면율을 정리해 드려요. 약 3분이면 됩니다."
        action={<Button onClick={onStartCheck}>내 상황 체크하기</Button>}
      />
    );
  }

  const totalDebt = Math.max(0, (result.totalRepayment || 0) + (result.totalDebtReduction || 0));
  const status = STATUS_LABEL[result.status] || { label: '다른 제도 검토 필요', tone: 'danger' as const };
  const items: { label: string; value: string }[] = [
    { label: '총 채무', value: formatLargeWon(totalDebt) },
    { label: '예상 월 변제금', value: formatKoreanWon(Math.max(0, result.monthlyPayment || 0)) },
    { label: '예상 감면율', value: `${Math.round(result.debtReductionRate || 0)}%` },
    { label: '예상 감면액', value: formatLargeWon(result.totalDebtReduction || 0) },
    { label: '월 가용소득', value: formatKoreanWon(Math.max(0, result.availableIncome || 0)) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">예비 결과</p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <dl className={compact ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-2 sm:grid-cols-3 gap-3'}>
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3">
            <dt className="text-xs font-bold text-slate-600">{it.label}</dt>
            <dd className="mt-1 text-base sm:text-lg font-extrabold text-slate-900 tabular-nums break-keep">{it.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-600 leading-relaxed break-keep">
        입력한 정보로 계산한 예비 결과입니다. 실제 변제금·인가 여부는 법원 심리와 제출 서류에 따라 달라질 수 있습니다.
      </p>
      <Button variant="secondary" fullWidth={compact} onClick={onEdit} leftIcon={<FileText className="w-4 h-4" aria-hidden="true" />}>
        내 채무 정보 보기·수정
      </Button>
    </div>
  );
}
