import React from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import type { RehabCalculationResult } from '../../../rehab-chatbot-package/services/calculationService';
import { Button, EmptyState } from '../ui';
import { formatKoreanWon } from '../ui/form';

/**
 * 내 관리방 '내 채무' 요약 (내 상황 체크 결과)
 * 의뢰인 화면에는 예상 월 변제금·감면율·신청 가능성 같은 판단을 보여 주지 않는다
 * (변호사법 제109조, 10-23·10-24 결정). 정리한 사실만 보여 주고, 판단은 변호사 검토 제안서에서 본다.
 * (이전: 예상 월 변제금·감면율·감면액·'신청 가능성 있음' 배지를 보여 줬음)
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

export default function DebtSummaryPanel({ result, onEdit, onStartCheck, compact = false }: DebtSummaryPanelProps) {
  if (!result) {
    return (
      <EmptyState
        compact
        icon={<ShieldCheck className="w-6 h-6" />}
        title="아직 내 상황 체크를 하지 않았어요"
        description="질문에 답하면 채무·소득·재산을 한곳에 정리해 드려요. 약 3분이면 됩니다."
        action={<Button onClick={onStartCheck}>내 상황 체크하기</Button>}
      />
    );
  }

  const totalDebt = Math.max(0, (result.totalRepayment || 0) + (result.totalDebtReduction || 0));
  const items: { label: string; value: string }[] = [
    { label: '정리한 총 채무', value: formatLargeWon(totalDebt) },
    ...(result.courtName ? [{ label: '주소지 기준 법원(참고)', value: result.courtName }] : []),
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm font-bold text-slate-900">내가 정리한 내용</p>
      <dl className={compact ? 'grid grid-cols-1 gap-2.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3">
            <dt className="text-xs font-bold text-slate-600">{it.label}</dt>
            <dd className="mt-1 text-base sm:text-lg font-extrabold text-slate-900 tabular-nums break-keep">{it.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-600 leading-relaxed break-keep">
        월 변제금과 변제 기간은 상담한 변호사가 내 자료를 검토한 뒤 보내는 '변호사 검토 제안서'에서 확인할 수 있어요.
      </p>
      <Button variant="secondary" fullWidth={compact} onClick={onEdit} leftIcon={<FileText className="w-4 h-4" aria-hidden="true" />}>
        내 채무 정보 보기·수정
      </Button>
    </div>
  );
}
