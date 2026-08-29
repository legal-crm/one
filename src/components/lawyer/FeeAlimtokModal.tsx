import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { FeeInstallment, AlimtokMilestone, ALIMTOK_MILESTONE_CONFIG } from '../../types';
import { sendFeeAlimtok, loadFeeNotificationSettings, renderTemplate } from '../../services/alimtokService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  client: { id: string; clientName: string; phone: string };
  installment: FeeInstallment;
  totalFeeManwon: number;
  totalPaidManwon: number;
  firmName: string;
  lawyerName: string;
  onSent?: (milestone: AlimtokMilestone) => void;
  initialMilestone?: AlimtokMilestone;
}

const TEMPLATE_OPTIONS: { value: AlimtokMilestone; label: string }[] = [
  { value: 'fee_upcoming', label: '납부 사전 안내 (D-3)' },
  { value: 'fee_due', label: '당일 납부 안내' },
  { value: 'fee_overdue', label: '연체 미납 안내' },
  { value: 'fee_receipt', label: '입금 확인 영수증' },
];

export default function FeeAlimtokModal({ 
  isOpen, 
  onClose, 
  client, 
  installment, 
  totalFeeManwon, 
  totalPaidManwon,
  firmName,
  lawyerName,
  onSent,
  initialMilestone
}: Props) {
  const [selectedMilestone, setSelectedMilestone] = useState<AlimtokMilestone>(initialMilestone || 'fee_upcoming');
  const [isSending, setIsSending] = useState(false);
  const settings = loadFeeNotificationSettings();

  useEffect(() => {
    if (initialMilestone) setSelectedMilestone(initialMilestone);
  }, [initialMilestone]);

  if (!isOpen) return null;

  const bankAccountStr = `${settings.bankInfo.bankName} ${settings.bankInfo.accountNumber} (예금주: ${settings.bankInfo.accountHolder})`;
  const amountWon = installment.amount >= 10000 ? installment.amount : installment.amount * 10000;
  const remainingWon = (totalFeeManwon - totalPaidManwon) * 10000;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(installment.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = diffDays > 0 ? String(diffDays) : '0';

  const vars = {
    firmName: firmName || '법무법인',
    lawyerName: lawyerName || '담당 변호사',
    clientName: client.clientName,
    feeRound: installment.memo || `${installment.round}차 분납`,
    feeAmount: amountWon.toLocaleString(),
    dueDate: installment.dueDate,
    paidDate: installment.paidDate || new Date().toISOString().split('T')[0],
    remainingFee: remainingWon.toLocaleString(),
    bankAccount: bankAccountStr,
    daysLeft,
    trackingUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/my`,
  };

  const previewText = renderTemplate(selectedMilestone, vars);
  const config = ALIMTOK_MILESTONE_CONFIG[selectedMilestone];

  const handleSend = async () => {
    setIsSending(true);
    try {
      const res = await sendFeeAlimtok({
        clientId: client.id,
        clientName: client.clientName,
        phone: client.phone,
        firmName,
        lawyerName,
        milestone: selectedMilestone,
        installment,
        remainingFeeManwon: totalFeeManwon - totalPaidManwon,
        bankInfo: settings.bankInfo
      });
      if (res.ok) {
        toast.success('알림톡 발송 성공');
        onSent?.(selectedMilestone);
        onClose();
      } else {
        toast.error(`발송 실패: ${res.error || '알 수 없는 오류'}`);
      }
    } catch (e) {
      toast.error('발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl animate-fadeIn flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">수임료 안내 알림톡</h2>
              <p className="text-xs text-slate-500">{client.clientName} 님에게 발송</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-5 pr-1">
          {/* 템플릿 선택 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">안내 종류 선택</label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedMilestone(opt.value)}
                  className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                    selectedMilestone === opt.value 
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-800' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 발송 정보 요약 */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">안내 항목</span>
              <span className="font-bold text-slate-800">{installment.memo || `${installment.round}차`} ({amountWon.toLocaleString()}원)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">기한/납부일</span>
              <span className="font-bold text-slate-800">
                {selectedMilestone === 'fee_receipt' ? installment.paidDate || vars.paidDate : installment.dueDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">입금 계좌</span>
              <span className="font-medium text-slate-700 text-xs truncate max-w-[200px] text-right">
                {bankAccountStr}
              </span>
            </div>
          </div>

          {/* 알림톡 미리보기 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">미리보기</label>
            <div className="bg-[#FAE100] rounded-2xl p-4 flex gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-full bg-[#391B1B] flex items-center justify-center shrink-0 text-white font-bold text-xs">
                TALK
              </div>
              <div className="flex-1 bg-white rounded-2xl rounded-tl-none p-3 shadow-sm text-sm whitespace-pre-wrap text-slate-800">
                {previewText}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.98]"
          >
            취소
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-[2] min-h-[44px] rounded-xl bg-[#FAE100] px-4 py-2.5 text-sm font-bold text-[#391B1B] hover:bg-[#F4D700] transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {isSending ? '발송 중...' : '카카오 알림톡 발송'}
          </button>
        </div>
      </div>
    </div>
  );
}
