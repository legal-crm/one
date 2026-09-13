import React, { useState, useEffect } from 'react';
import { 
  X, Send, RotateCcw, Edit3, Sparkles, Smartphone, 
  ShieldCheck, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { sendAlimtok } from '../../../services/alimtokService';
import { addClientNotification } from '../../../services/clientNotificationService';
import type { AlimtokMilestone } from '../../../types';

interface AlimtalkSendConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone: string;
  templateTitle: string;
  templateDesc?: string;
  emoji?: string;
  defaultMessage: string;
  firmName?: string;
  lawyerName?: string;
  stageNumber?: number;
  milestone?: AlimtokMilestone;
  onSent?: (sentMessage: string) => void;
}

export default function AlimtalkSendConfirmModal({
  isOpen,
  onClose,
  clientName,
  clientPhone,
  templateTitle,
  templateDesc,
  emoji = '💬',
  defaultMessage,
  firmName = '법무법인',
  lawyerName = '담당 변호사',
  stageNumber,
  milestone = 'consult_booked',
  onSent,
}: AlimtalkSendConfirmModalProps) {
  const [customMessage, setCustomMessage] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const [fallbackSms, setFallbackSms] = useState(true);

  useEffect(() => {
    setCustomMessage(defaultMessage);
  }, [defaultMessage]);

  if (!isOpen) return null;

  const isCustomized = customMessage.trim() !== defaultMessage.trim();

  const handleReset = () => {
    setCustomMessage(defaultMessage);
    toast.info('기본 템플릿 문구로 복원되었습니다.');
  };

  const handleSend = async () => {
    if (!customMessage.trim()) {
      toast.error('발송할 알림톡 메시지 내용을 입력해주세요.');
      return;
    }

    setIsSending(true);

    try {
      // 1. 팝빌 알림톡 연동 API 호출
      const cleanPhone = clientPhone.replace(/[^0-9]/g, '');
      await sendAlimtok(
        cleanPhone,
        milestone,
        {
          clientName,
          firmName,
          lawyerName,
        },
        {
          receiverName: clientName,
          customText: customMessage,
          altSubject: `[${firmName}] ${templateTitle}`,
          altContent: customMessage,
        }
      );

      // 2. 의뢰인 포털 모바일 알림 동기화
      addClientNotification({
        type: 'status_change',
        title: customMessage.split('\n')[0] || `[알림] ${templateTitle}`,
        emoji,
        linkTab: 'diagnosis',
      });

      // 3. 콜백 호출
      if (onSent) {
        onSent(customMessage);
      }

      toast.success(`${clientName}님께 '${templateTitle}' 알림톡이 성공적으로 발송되었습니다.`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || '알림톡 발송 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* 모달 헤더 */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAE100] text-[#391B1B] flex items-center justify-center font-black text-xs shadow-xs">
              TALK
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-white">카카오 알림톡 발송 확인</h3>
                {stageNumber && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-200 font-bold border border-blue-400/30">
                    Stage 0{stageNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {templateTitle} · 발송 전 문안 검토 및 직접 편집
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 영역 */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 수신인 및 발송 채널 정보 바 */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">수신 대상자</span>
              <span className="font-bold text-slate-900 text-xs">
                {clientName} 고객 ({clientPhone || '연락처 없음'})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">발송 채널</span>
              <span className="font-bold text-[#391B1B] bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1">
                <span>💬 카카오 알림톡</span>
                <span className="text-slate-500 font-normal">(미수신 시 LMS 자동 대체)</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">발송 명의</span>
              <span className="text-slate-700 font-medium text-[11px]">
                {firmName} {lawyerName}
              </span>
            </div>
          </div>

          {/* 알림톡 문구 수정 & 말풍선 미리보기 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>발송 문안 검토 (직접 수정 가능)</span>
              </label>
              <div className="flex items-center gap-2">
                {isCustomized && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
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

            {/* 카카오톡 말풍선 스타일 편집 뷰어 */}
            <div className="bg-[#FAE100] rounded-2xl p-4 shadow-inner space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-[#391B1B]/80 font-bold border-b border-[#391B1B]/10 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#391B1B] text-white flex items-center justify-center font-black text-[8px]">
                    TALK
                  </div>
                  <span>{firmName} 회생파산 지원센터</span>
                </div>
                <span className="text-[10px] opacity-75">알림톡 도착</span>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <textarea
                    rows={8}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full bg-white rounded-xl rounded-tl-none p-3 text-xs leading-relaxed text-slate-900 border border-yellow-300 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 shadow-xs resize-none font-sans"
                    placeholder="알림톡 발송 내용을 입력하세요."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#391B1B]/90 font-medium px-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#391B1B]" />
                  텍스트를 직접 수정하여 고객 맞춤 안내를 전송할 수 있습니다.
                </span>
                {isCustomized && (
                  <span className="font-bold text-amber-950 bg-yellow-300 px-1.5 py-0.5 rounded text-[10px]">
                    ✏️ 내용 수정됨
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 대체 문자 발송 옵션 */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-xs font-bold">
              <input
                type="checkbox"
                checked={fallbackSms}
                onChange={(e) => setFallbackSms(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <span>카카오톡 미수신 시 LMS/SMS 대체 발송</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">실패 방지 보장</span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-bold text-xs text-slate-600 cursor-pointer press-scale transition-colors whitespace-nowrap"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !customMessage.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#FAE100] hover:bg-[#F4D700] text-[#391B1B] font-extrabold text-xs shadow-xs cursor-pointer press-scale transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? '알림톡 발송 중...' : '카카오 알림톡 즉시 발송'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
