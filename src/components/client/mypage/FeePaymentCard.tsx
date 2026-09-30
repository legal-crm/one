import { CalendarDays, Check, Clock, CreditCard, HelpCircle, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { localYmd } from '../../../utils/localDate';
import { feeAmountWon } from '../../../services/alimtokService';
import type { FeeInstallment } from '../../../types';
import { Badge, Button, Card } from '../ui';
import { cn } from '../../../utils/cn';
import type { MyPageModel } from './useMyPageModel';
import type { MyCaseData } from './myCaseData';

/**
 * 내 사건 탭: 수임료 납부 현황·입금 계좌·분납 일정 (MyPageView에서 분리)
 * - 상태는 글자 배지로(이전: '✅ 완료/⚠️ 미납/⏳ 예정' 이모지), 10~11px 글자·옅은 회색 글자 정리, 진행 막대에 progressbar 역할
 */
export default function FeePaymentCard({ vm, cd }: { vm: MyPageModel; cd: MyCaseData }) {
  const { feeSettings } = vm;
  const { feeSchedule, totalFee, totalPaid } = cd;
  if (!(totalFee > 0)) return null;

  const paidPct = Math.max(0, Math.min(100, Math.round((totalPaid / totalFee) * 100)));
  const remaining = Math.max(0, totalFee - totalPaid);

  // 입금계좌는 사무소 설정값만 사용 (이전: 설정이 없으면 가짜 계좌 '신한은행 110-542-897612 (법무법인 로앤)'을 의뢰인에게 표시)
  // 주의: 사무소 설정은 사무소 브라우저에 저장되므로 의뢰인 화면에는 보통 비어 있음 → 안내 문구 표시
  const { bankName = '', accountNumber = '', accountHolder = '' } = feeSettings?.bankInfo || {};
  const hasAccount = !!bankName.trim() && !!accountNumber.trim();
  const fullAccount = `${bankName} ${accountNumber}${accountHolder ? ` (${accountHolder})` : ''}`;

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(fullAccount);
      toast.success('계좌번호를 복사했어요.');
    } catch {
      toast.error('복사하지 못했어요. 계좌번호를 직접 적어 주세요.');
    }
  };

  return (
    <Card as="section" aria-labelledby="mypage-fee-title" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="mypage-fee-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700" aria-hidden="true">
            <Wallet className="h-5 w-5" />
          </span>
          수임료 납부 현황
        </h3>
        <Badge tone={totalPaid >= totalFee ? 'success' : 'warning'}>{totalPaid >= totalFee ? '완납' : `${paidPct}% 납부`}</Badge>
      </div>

      {/* 총액 및 진행 막대 */}
      <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">총 수임료</span>
          <span className="font-bold text-slate-900 tabular-nums">{totalFee.toLocaleString('ko-KR')}원</span>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="수임료 납부 진행"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={paidPct}
        >
          <div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${paidPct}%` }} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span className="font-bold text-emerald-700 tabular-nums">납부 {totalPaid.toLocaleString('ko-KR')}원</span>
          <span className={cn('font-bold tabular-nums', remaining > 0 ? 'text-red-700' : 'text-emerald-700')}>남은 금액 {remaining.toLocaleString('ko-KR')}원</span>
        </div>
      </div>

      {/* 입금 계좌 */}
      {hasAccount ? (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-bold text-emerald-800">입금 계좌</p>
            <p className="break-all text-sm font-bold text-slate-900">
              {bankName} <span className="font-mono">{accountNumber}</span>
              {accountHolder && <span className="ml-1 text-sm font-normal text-slate-600">({accountHolder})</span>}
            </p>
          </div>
          <Button variant="secondary" onClick={copyAccount} className="self-start sm:self-center" leftIcon={<CreditCard className="h-4 w-4" aria-hidden="true" />}>
            계좌번호 복사
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 break-keep">
          입금 계좌는 담당 사무소가 직접 안내한 계좌를 확인해 주세요. 사무소 안내와 다른 계좌로 입금을 요청받으면 사무소에 먼저 확인해 주세요.
        </p>
      )}

      {/* 분납 일정 */}
      {feeSchedule.length > 0 && (
        <ul className="space-y-2" aria-label="분납 일정">
          {feeSchedule.map((inst: FeeInstallment) => {
            const isPast = String(inst.dueDate || '') < localYmd() && inst.status === 'pending';
            const paid = inst.status === 'paid';
            return (
              <li
                key={inst.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5',
                  paid ? 'border-emerald-200 bg-emerald-50/50' : isPast ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    paid ? 'bg-emerald-100 text-emerald-700' : isPast ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500',
                  )}
                  aria-hidden="true"
                >
                  {paid ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2">
                    <span className="text-sm font-bold text-slate-600">{(inst as any).memo || `${inst.round}차`}</span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">{feeAmountWon(inst).toLocaleString('ko-KR')}원</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>납부일 {inst.dueDate}</span>
                    {inst.paidDate && <span className="font-medium text-emerald-700">· {inst.paidDate} 납부</span>}
                    {isPast && <span className="font-bold text-red-700">· 납부일 지남</span>}
                  </p>
                </div>
                <Badge tone={paid ? 'success' : isPast ? 'danger' : 'neutral'} className="shrink-0">
                  {paid ? '완료' : isPast ? '미납' : '예정'}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-1.5 text-sm text-slate-600">
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span>수임료 납부에 관한 문의는 담당 변호사에게 채팅으로 연락해 주세요.</span>
      </p>
    </Card>
  );
}
