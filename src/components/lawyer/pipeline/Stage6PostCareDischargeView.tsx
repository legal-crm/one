import React, { useState } from 'react';
import { 
  ShieldCheck, Banknote, Calendar, CheckCircle2, 
  Send, ExternalLink, Award, FileText, AlertCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';

interface Stage6PostCareDischargeViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onOpenPostCareModal?: () => void;
}

export default function Stage6PostCareDischargeView({
  clientRequest,
  crmExt,
  onOpenPostCareModal,
}: Stage6PostCareDischargeViewProps) {
  const [commencedDate, setCommencedDate] = useState('2026.04.15');
  const [virtualAccount, setVirtualAccount] = useState('신한은행 110-384-918231 (법원 전용)');
  const [creditorsMeetingDate, setCreditorsMeetingDate] = useState('2026.07.20 14:00 (제3법정)');
  const [paidMonths, setPaidMonths] = useState(12);
  const totalMonths = 36;

  const clientName = clientRequest.clientName || '신청인';

  const handleSendPaymentGuide = () => {
    addClientNotification({
      type: 'status_change',
      title: `[적립금 납부 안내] ${clientName}님, 법원 가상계좌(${virtualAccount})로 당월 변제금 입금을 진행해주세요.`,
      emoji: '🏦',
      linkTab: 'diagnosis',
    });
    toast.success(`${clientName}님께 가상계좌 납부 일정 알림톡이 발송되었습니다.`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Next Action Hero Card ── */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-purple-600 text-white shadow-xs shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  Stage 06 핵심 작업
                </span>
                <span className="text-sm font-black tracking-tight">
                  법원 가상계좌 납부 일정 및 채권자집회 출석을 지도하세요.
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                개시결정 후 90일 이내 가상계좌 적립금 납부 누락을 방지하고 집회 기일에 맞춰 고객에게 사전 알림톡을 발송합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {onOpenPostCareModal && (
              <button
                type="button"
                onClick={onOpenPostCareModal}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <Banknote className="w-4 h-4" />
                <span>개시·사후관리 모달 열기 (Major)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendPaymentGuide}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Send className="w-3.5 h-3.5 text-purple-600" />
              <span>가상계좌 안내톡 발송</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. 가상계좌 및 채권자집회 정보 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <span className="font-bold text-slate-500 block">법원 가상계좌 정보</span>
          <div className="font-mono font-black text-base text-slate-900">{virtualAccount}</div>
          <p className="text-[11px] text-slate-500">인가결정 전 매월 변제금을 적립하는 법원 보관금 계좌</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <span className="font-bold text-slate-500 block">채권자집회 기일</span>
          <div className="font-mono font-black text-base text-slate-900">{creditorsMeetingDate}</div>
          <p className="text-[11px] text-slate-500">신분증 지참 필수, 1회 불출석 시 기각 사유가 되므로 지도 철저</p>
        </div>
      </div>
    </div>
  );
}
