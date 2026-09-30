import React, { useState } from 'react';
import { Check, Upload, FileText, Trash2, Wallet } from 'lucide-react';
import { RepaymentRoundItem, RepaymentVerificationStatus } from '../../../types';
import { updateRepaymentRound } from '../../../services/companionService';
import { toast } from 'sonner';
import { validateUploadFile } from '../../../utils/fileSecurity';
import { localYmd } from '../../../utils/localDate';
import { Button, FormField, Modal, buttonClassName, inputClass } from '../ui';
import { cn } from '../../../utils/cn';

interface RepaymentPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roundItem: RepaymentRoundItem | null;
  courtVirtualAccount?: string;
  clientId?: string;
}

// 납부 확인 근거(이모지 대신 글로 구분)
const OPTIONS: { id: RepaymentVerificationStatus; label: string; desc: string; selected: string }[] = [
  { id: 'self_marked', label: '냈어요', desc: '증빙 파일 없이 입금했다고 직접 표시해요', selected: 'border-amber-500 bg-amber-50' },
  { id: 'receipt_uploaded', label: '냈어요 · 이체확인증 첨부', desc: '계좌 이체 내역이나 송금 영수증을 함께 보관해요', selected: 'border-blue-500 bg-blue-50' },
  { id: 'court_confirmed', label: '법원 자료에서 납부를 확인했어요', desc: '전자소송이나 변제현황조회서에 납부가 반영된 것을 확인했어요', selected: 'border-emerald-500 bg-emerald-50' },
  { id: 'overdue_check_needed', label: '아직 못 냈어요', desc: '납부일이 지났지만 아직 내지 못했어요', selected: 'border-red-400 bg-red-50' },
];

const monthDay = (ymd?: string) => (ymd && ymd.length >= 10 ? `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : '');

function RepaymentPaymentModalInner({
  isOpen,
  onClose,
  onSuccess,
  roundItem,
  courtVirtualAccount = '',
  clientId
}: RepaymentPaymentModalProps) {
  const item = roundItem as RepaymentRoundItem;
  const [status, setStatus] = useState<RepaymentVerificationStatus>(item.status === 'pending' ? 'self_marked' : item.status);
  // 로컬 날짜(이전: toISOString()의 UTC 날짜라 새벽에는 하루 전 날짜가 들어감)
  const [paidDate, setPaidDate] = useState<string>(item.paidDate || localYmd());
  const [memo, setMemo] = useState<string>(item.memo || '');
  const [receiptFile, setReceiptFile] = useState<{ name: string; dataUrl: string } | null>(
    item.receiptName ? { name: item.receiptName, dataUrl: item.receiptDataUrl || '' } : null
  );

  const needsFile = status === 'receipt_uploaded' || status === 'court_confirmed';
  const isPaidStatus = status !== 'overdue_check_needed';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateUploadFile(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptFile({ name: file.name, dataUrl: event.target?.result as string });
      setStatus('receipt_uploaded');
      toast.success(`'${file.name}'을(를) 첨부했어요.`);
    };
    reader.onerror = () => toast.error('파일을 열지 못했어요. 다른 파일로 다시 시도해 주세요.');
    reader.readAsDataURL(file);
  };

  const handleSave = (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      const saved = updateRepaymentRound(item.round, status, receiptFile || undefined, memo, clientId, isPaidStatus ? paidDate : undefined);
      if (!saved) {
        toast.error('사건 정보를 찾지 못해 저장하지 못했습니다. 사건을 먼저 등록해 주세요.');
        return;
      }
      toast.success(`${item.round}회차 납부 기록을 이 기기에 저장했어요.`);
      onSuccess();
      onClose();
    } catch {
      toast.error('납부 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      mobile="sheet"
      icon={<Check className="w-5 h-5" />}
      title={`${item.round}회차 납부 기록`}
      description={`납부 예정일 ${monthDay(item.dueDate)} · ${(item.scheduledAmount || 0).toLocaleString('ko-KR')}원`}
      closeLabel="납부 기록 닫기"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" form="repayment-record-form" leftIcon={<Check className="w-4 h-4" aria-hidden="true" />}>
            기록 저장
          </Button>
        </>
      }
    >
      <form id="repayment-record-form" onSubmit={handleSave} className="space-y-5">
        {courtVirtualAccount && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
              법원 가상계좌
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums break-all select-all">{courtVirtualAccount}</p>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-slate-800">이번 회차는 어떻게 됐나요?</legend>
          {OPTIONS.map(opt => (
            <label
              key={opt.id}
              className={cn(
                'flex items-start gap-3 min-h-11 rounded-2xl border p-3.5 cursor-pointer transition-colors',
                status === opt.id ? opt.selected : 'border-slate-200 bg-white hover:bg-slate-50'
              )}
            >
              <input
                type="radio"
                name="verificationStatus"
                value={opt.id}
                checked={status === opt.id}
                onChange={() => setStatus(opt.id)}
                className="mt-0.5 w-5 h-5 shrink-0 accent-brand"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">{opt.label}</span>
                <span className="mt-0.5 block text-xs text-slate-600 leading-relaxed">{opt.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {needsFile && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-800">이체확인증·영수증 파일</p>
            {receiptFile ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-800 truncate">{receiptFile.name}</span>
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setReceiptFile(null)}
                  leftIcon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
                  aria-label={`${receiptFile.name} 첨부 삭제`}
                  className="shrink-0 text-red-700"
                >
                  삭제
                </Button>
              </div>
            ) : (
              <label className={buttonClassName('secondary', 'md', 'w-full border-dashed cursor-pointer focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2')}>
                <Upload className="w-4 h-4" aria-hidden="true" />
                사진이나 PDF 선택
                <input type="file" accept="image/*,.pdf" className="sr-only" onChange={handleFileUpload} />
              </label>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isPaidStatus && (
            <FormField label="실제 납부일">
              {(p) => <input {...p} type="date" value={paidDate} max={localYmd()} onChange={(e) => setPaidDate(e.target.value)} className={inputClass} />}
            </FormField>
          )}
          <FormField label="메모" optional>
            {(p) => (
              <input
                {...p}
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 급여 받은 날 바로 이체"
                className={inputClass}
              />
            )}
          </FormField>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          남긴 기록은 이 기기에 저장되는 개인 기록이에요. 법원의 공식 변제 현황과 다를 수 있어요.
        </p>
      </form>
    </Modal>
  );
}

// Rules of Hooks: isOpen 가드는 훅을 쓰는 본문 바깥에서 처리 (열고 닫을 때 훅 개수 불일치 크래시 방지)
export default function RepaymentPaymentModal(props: RepaymentPaymentModalProps) {
  if (!props.isOpen || !props.roundItem) return null;
  return <RepaymentPaymentModalInner {...props} />;
}
