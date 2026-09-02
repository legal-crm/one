import React, { useState } from 'react';
import { X, Check, Upload, FileText, AlertCircle, Calendar, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { RepaymentRoundItem, RepaymentVerificationStatus } from '../../../types';
import { updateRepaymentRound } from '../../../services/companionService';
import { toast } from 'sonner';

interface RepaymentPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roundItem: RepaymentRoundItem | null;
  courtVirtualAccount?: string;
}

export default function RepaymentPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  roundItem,
  courtVirtualAccount = '신한은행 110-***-849201'
}: RepaymentPaymentModalProps) {
  if (!isOpen || !roundItem) return null;

  const [status, setStatus] = useState<RepaymentVerificationStatus>(
    roundItem.status === 'pending' ? 'self_marked' : roundItem.status
  );
  const [paidDate, setPaidDate] = useState<string>(
    roundItem.paidDate || new Date().toISOString().split('T')[0]
  );
  const [memo, setMemo] = useState<string>(roundItem.memo || '');
  const [receiptFile, setReceiptFile] = useState<{ name: string; dataUrl: string } | null>(
    roundItem.receiptName ? { name: roundItem.receiptName, dataUrl: roundItem.receiptDataUrl || '' } : null
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptFile({
        name: file.name,
        dataUrl: event.target?.result as string
      });
      setStatus('receipt_uploaded');
      toast.success(`${file.name} 증빙 파일이 첨부되었습니다.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      updateRepaymentRound(
        roundItem.round,
        status,
        receiptFile || undefined,
        memo
      );
      toast.success(`${roundItem.round}회차 납부 기록이 갱신되었습니다.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('납부 기록 저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-left">
        
        {/* 모달 헤더 */}
        <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-brand bg-brand/10 dark:bg-brand/20 px-2.5 py-0.5 rounded-full">
                {roundItem.round}회차 변제금
              </span>
              <span className="text-xs text-slate-500 font-medium">
                납부 예정일: {roundItem.dueDate}
              </span>
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
              납부 확인 및 증빙 영수증 등록
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          
          {/* 예정 금액 및 가상계좌 카드 */}
          <div className="p-4 rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/15 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">이번 회차 납부 예정액</span>
              <span className="text-base font-black text-brand dark:text-brand-light">
                {roundItem.scheduledAmount.toLocaleString()}원
              </span>
            </div>
            {courtVirtualAccount && (
              <div className="pt-2 border-t border-brand/10 flex items-center justify-between text-xs">
                <span className="text-slate-500">법원 전용계좌</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 select-all">
                  {courtVirtualAccount}
                </span>
              </div>
            )}
          </div>

          {/* 4단계 확인 근거 선택 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              납부 확인 근거 선택
            </label>
            
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                status === 'court_confirmed'
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}>
                <input
                  type="radio"
                  name="verificationStatus"
                  value="court_confirmed"
                  checked={status === 'court_confirmed'}
                  onChange={() => setStatus('court_confirmed')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">
                    🟢 법원 자료 기준 확인 완료
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    대한민국 법원 전자소송 또는 변제현황조회서에서 납부가 반영된 상태
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                status === 'receipt_uploaded'
                  ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}>
                <input
                  type="radio"
                  name="verificationStatus"
                  value="receipt_uploaded"
                  checked={status === 'receipt_uploaded'}
                  onChange={() => setStatus('receipt_uploaded')}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block">
                    🔵 은행 이체확인증 / 영수증 첨부
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    계좌 이체 내역서 또는 송금 영수증을 첨부하여 증빙 보관
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                status === 'self_marked'
                  ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}>
                <input
                  type="radio"
                  name="verificationStatus"
                  value="self_marked"
                  checked={status === 'self_marked'}
                  onChange={() => setStatus('self_marked')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">
                    🟡 고객 직접 확인 (입금 완료 표시)
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    증빙 파일 없이 본인이 입금 완료했음을 자가 체크
                  </span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                status === 'overdue_check_needed'
                  ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}>
                <input
                  type="radio"
                  name="verificationStatus"
                  value="overdue_check_needed"
                  checked={status === 'overdue_check_needed'}
                  onChange={() => setStatus('overdue_check_needed')}
                  className="mt-1 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 block">
                    🔴 납부 확인 필요 / 미납 주의
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    변제일이 도래했으나 납부되지 않아 재확인이 필요한 상태
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 증빙 파일 업로드 영역 */}
          {['receipt_uploaded', 'court_confirmed'].includes(status) && (
            <div className="space-y-2 animate-fadeIn">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                영수증 / 이체확인증 파일
              </label>
              {receiptFile ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                      {receiptFile.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptFile(null)}
                    className="text-xs text-red-500 hover:underline shrink-0 font-bold"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand hover:bg-brand/5 transition-all cursor-pointer">
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">이체확인증/영수증 사진 선택</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, PDF 지원</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          )}

          {/* 실제 납부일자 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">납부 일자</label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">메모 (선택)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 급여 입금 후 즉시 이체"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 leading-relaxed">
            * 입력하신 납부 정보는 고객님의 자율 기록 및 증빙 보관용이며, 법원의 공식 변제현황과 차이가 있을 수 있습니다.
          </div>

          {/* 모달 버튼 */}
          <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>납부 기록 저장</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
