import React, { useState, useEffect, useMemo } from 'react';
import { X, MessageCircle, Send, RotateCcw, Edit3, Sparkles } from 'lucide-react';
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
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const settings = loadFeeNotificationSettings();

  const bankAccountStr = `${settings.bankInfo.bankName} ${settings.bankInfo.accountNumber} (예금주: ${settings.bankInfo.accountHolder})`;
  const amountWon = installment.amount >= 10000 ? installment.amount : installment.amount * 10000;
  const remainingWon = (totalFeeManwon - totalPaidManwon) * 10000;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(installment.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = diffDays > 0 ? String(diffDays) : '0';

  const vars = useMemo(() => ({
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
  }), [firmName, lawyerName, client.clientName, installment, amountWon, remainingWon, bankAccountStr, daysLeft]);

  // 기본 템플릿 생성 문구
  const defaultTemplateText = useMemo(() => {
    return renderTemplate(selectedMilestone, vars);
  }, [selectedMilestone, vars]);

  // 템플릿 변경 시 기본 문구로 갱신
  useEffect(() => {
    if (initialMilestone) setSelectedMilestone(initialMilestone);
  }, [initialMilestone]);

  useEffect(() => {
    setCustomMessage(defaultTemplateText);
  }, [defaultTemplateText]);

  if (!isOpen) return null;

  const isCustomized = customMessage !== defaultTemplateText;

  const handleResetToDefault = () => {
    setCustomMessage(defaultTemplateText);
    toast.info('기본 템플릿 문구로 초기화되었습니다.');
  };

  const handleSend = async () => {
    if (!customMessage.trim()) {
      toast.error('발송할 메시지 내용을 입력해주세요.');
      return;
    }

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
        bankInfo: settings.bankInfo,
        customMessage: customMessage.trim(),
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
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl animate-fadeIn flex flex-col max-h-[92vh]">
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
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* 템플릿 선택 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">안내 종류 선택</label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedMilestone(opt.value)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    selectedMilestone === opt.value 
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-900 shadow-xs' 
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 발송 정보 요약 */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">안내 항목</span>
              <span className="font-bold text-slate-800">{installment.memo || `${installment.round}차`} ({amountWon.toLocaleString()}원)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">기한/납부일</span>
              <span className="font-bold text-slate-800">
                {selectedMilestone === 'fee_receipt' ? installment.paidDate || vars.paidDate : installment.dueDate}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">입금 계좌</span>
              <span className="font-medium text-slate-700 text-[11px] truncate max-w-[240px] text-right font-mono">
                {bankAccountStr}
              </span>
            </div>
          </div>

          {/* 알림톡 내용 수정 & 미리보기 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-brand" />
                <span>발송 내용 (직접 수정 가능)</span>
              </label>
              <div className="flex items-center gap-2">
                {isCustomized && (
                  <button
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    title="기본 템플릿 문구로 되돌립니다"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>기본 문구 복원</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  {customMessage.length}자
                </span>
              </div>
            </div>

            {/* 카카오 알림톡 말풍선 스타일 편집 영역 */}
            <div className="bg-[#FAE100] rounded-2xl p-3.5 shadow-inner space-y-2">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#391B1B] flex items-center justify-center shrink-0 text-white font-black text-[10px]">
                  TALK
                </div>
                <div className="flex-1">
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={9}
                    className="w-full bg-white rounded-xl rounded-tl-none p-3 text-xs leading-relaxed text-slate-900 border border-yellow-300/80 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 shadow-xs resize-none font-sans"
                    placeholder="알림톡 발송 내용을 입력하세요."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-yellow-950/80 px-1 font-medium">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-900" />
                  문구를 클릭하여 원하는 내용으로 자유롭게 수정하세요.
                </span>
                {isCustomized && (
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-1.5 py-0.2 rounded">
                    ✏️ 내용 수정됨
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !customMessage.trim()}
            className="flex-[2] min-h-[44px] rounded-xl bg-[#FAE100] px-4 py-2.5 text-xs font-bold text-[#391B1B] hover:bg-[#F4D700] transition-colors active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            {isSending ? '발송 중...' : isCustomized ? '수정된 내용으로 알림톡 발송' : '카카오 알림톡 발송'}
          </button>
        </div>
      </div>
    </div>
  );
}
