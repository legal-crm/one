import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MessageSquare, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { createSharedReport, SHARE_MAX_ATTEMPTS } from '../../services/sharedReportService';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { Button, Callout, FormField, Modal, inputClass } from './ui';
import { cn } from '../../utils/cn';

interface ReportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: RehabCalculationResult;
  userInput: RehabUserInput;
  /** 층 순서. 리포트 팝업(z-60) 위에 뜨므로 기본 z-[70] */
  zIndexClassName?: string;
}

/**
 * 채무 정리 리포트 공유 (비밀번호로 보호된 링크)
 * - 키트 Modal(ESC·포커스 가두기·모바일 하단 시트), PIN 입력은 FormField(라벨 연결)
 * - 이전: role 없는 오버레이, 라벨 없는 입력, 28px 닫기 버튼, 복사 실패 처리 없음
 */
export default function ReportShareModal({ isOpen, onClose, result, userInput, zIndexClassName = 'z-[70]' }: ReportShareModalProps) {
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'setup' | 'result'>('setup');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // 닫으면 처음 상태로 (다시 열 때 예전 링크·비밀번호가 남아 있지 않게)
  useEffect(() => {
    if (!isOpen) {
      setStep('setup');
      setPin('');
      setShareUrl('');
      setCopied(false);
    }
  }, [isOpen]);

  const handleGenerateLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      toast.error('비밀번호 숫자 6자리를 입력해 주세요.');
      return;
    }

    // 식별 정보(이름·주소)는 공유 링크에 포함하지 않음 — 링크 유출 시 개인 식별 방지
    const payload = JSON.stringify({
      result: {
        status: result.status,
        statusReason: result.statusReason,
        // 공유 화면의 '예상 월 변제금·기간'에 필요 (이전: 빠져 있어 항상 '정보 없음')
        monthlyPayment: result.monthlyPayment,
        repaymentMonths: result.repaymentMonths,
        debtReductionRate: result.debtReductionRate,
        totalRepayment: result.totalRepayment,
        totalDebtReduction: result.totalDebtReduction,
        liquidationValue: result.liquidationValue,
        courtName: result.courtName,
        processingMonths: result.processingMonths,
        baseLivingCost: result.baseLivingCost,
        aiAdvice: result.aiAdvice,
        preferred: (result as any).preferred,
      },
      userInput: {
        age: userInput.age,
        monthlyIncome: userInput.monthlyIncome,
        totalDebt: userInput.totalDebt,
        myAssets: userInput.myAssets,
        spouseAssets: userInput.spouseAssets,
        deposit: userInput.deposit,
        familySize: userInput.familySize,
        maritalStatus: userInput.maritalStatus,
        riskFactor: userInput.riskFactor,
        speculativeLoss: userInput.speculativeLoss,
        gamblingLoss: userInput.gamblingLoss,
        legalActions: userInput.legalActions,
      },
    });

    try {
      setIsCreating(true);
      // 암호문은 서버에만 보관, 링크에는 무작위 ID만 포함 (PIN 5회 오입력 시 잠금)
      const shareId = await createSharedReport(payload, pin);
      const origin = window.location.origin + window.location.pathname;
      setShareUrl(`${origin}#share=${shareId}`);
      setStep('result');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '공유 링크를 만들지 못했어요.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('링크를 복사했어요.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.');
    }
  };

  const handleSMS = () => {
    const text = `[my김변] 비밀번호로 보호된 채무 정리 리포트예요.\n\n비밀번호(6자리)는 따로 전달받아 입력해 주세요.\n리포트 링크: ${shareUrl}`;
    window.open(`sms:?body=${encodeURIComponent(text)}`);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: 'my김변 채무 정리 리포트', text: '비밀번호로 보호된 채무 정리 리포트예요.', url: shareUrl });
    } catch (err) {
      // 사용자가 공유 창을 닫은 경우(AbortError)는 안내하지 않는다
      if ((err as DOMException)?.name !== 'AbortError') toast.error('공유 창을 열지 못했어요. 링크를 복사해 보내 주세요.');
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="리포트 공유"
      description={
        step === 'setup'
          ? '받는 사람이 열 때 입력할 숫자 6자리 비밀번호를 정해 주세요. 이름·주소는 링크에 담기지 않아요.'
          : undefined
      }
      icon={<KeyRound className="h-5 w-5" />}
      size="sm"
      mobile="sheet"
      zIndexClassName={zIndexClassName}
      footer={
        step === 'setup' ? (
          <Button type="submit" form="report-share-form" fullWidth loading={isCreating} disabled={pin.length !== 6}>
            {isCreating ? '링크 만드는 중' : '공유 링크 만들기'}
          </Button>
        ) : (
          <Button variant="secondary" fullWidth onClick={onClose}>
            닫기
          </Button>
        )
      }
    >
      {step === 'setup' ? (
        <form id="report-share-form" onSubmit={handleGenerateLink}>
          <FormField label="공유 비밀번호 (숫자 6자리)" required hint={`비밀번호를 ${SHARE_MAX_ATTEMPTS}회 잘못 입력하면 링크가 잠기고, 링크는 7일 뒤 만료돼요.`}>
            {(p) => (
              <input
                {...p}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={cn(inputClass, 'text-center text-xl font-bold tracking-[0.5em]')}
              />
            )}
          </FormField>
        </form>
      ) : (
        <div className="space-y-4">
          <Callout tone="success" title="공유 링크를 만들었어요">
            비밀번호 <strong className="font-bold tabular-nums">{pin}</strong>는 링크와 <strong>다른 방법</strong>으로 전달해 주세요. (예: 링크는 문자, 비밀번호는 전화)
          </Callout>
          <FormField label="공유 링크">
            {(p) => (
              <input {...p} type="text" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className={cn(inputClass, 'text-sm')} />
            )}
          </FormField>
          <div className={cn('grid gap-2', canNativeShare ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
            <Button
              variant="secondary"
              onClick={handleCopy}
              leftIcon={copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            >
              {copied ? '복사했어요' : '링크 복사'}
            </Button>
            <Button variant="secondary" onClick={handleSMS} leftIcon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}>
              문자로 보내기
            </Button>
            {canNativeShare && (
              <Button variant="secondary" onClick={handleNativeShare} leftIcon={<Share2 className="h-4 w-4" aria-hidden="true" />}>
                다른 앱으로
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
