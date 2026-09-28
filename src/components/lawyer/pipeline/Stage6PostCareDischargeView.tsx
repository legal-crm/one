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
  // 사건 데이터에서만 가져옴 (이전: 모든 의뢰인에게 같은 가짜 계좌 '신한은행 110-384-918231'·집회일·12회 납입을 표시)
  const ds = crmExt?.decisionSummary;
  const cc: any = crmExt?.courtCase || {};
  const virtualAccount = ds?.virtualAccountNumber
    ? `${ds.virtualAccountBank || ''} ${ds.virtualAccountNumber}`.trim()
    : (cc.courtVirtualAccount || '');
  const creditorsMeetingDate: string = cc.creditorMeetingDate || '';

  const clientName = clientRequest.clientName || '신청인';

  const handleSendPaymentGuide = () => {
    if (!virtualAccount) {
      toast.error('등록된 법원 가상계좌가 없습니다. 개시결정 요약에서 가상계좌를 먼저 등록해 주세요.');
      return;
    }
    addClientNotification({
      type: 'status_change',
      title: `[적립금 납부 안내] ${clientName}님, 법원 가상계좌(${virtualAccount})로 당월 변제금 입금을 진행해주세요.`,
      emoji: '🏦',
      linkTab: 'diagnosis',
    });
    // 알림톡은 발송하지 않음 — 의뢰인 앱 알림만 등록 (이전: '알림톡이 발송되었습니다')
    toast.success(`${clientName}님 앱에 가상계좌 납부 안내 알림을 등록했습니다.`);
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
                가상계좌 적립금 납부 누락을 방지하고 채권자집회 기일 전에 의뢰인에게 출석을 안내하세요.
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
              <span>가상계좌 안내 (앱 알림)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. 가상계좌 및 채권자집회 정보 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <span className="font-bold text-slate-500 block">법원 가상계좌 정보</span>
          <div className="font-mono font-black text-base text-slate-900">{virtualAccount || '미등록'}</div>
          <p className="text-[11px] text-slate-500">인가결정 전 매월 변제금을 적립하는 법원 보관금 계좌</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <span className="font-bold text-slate-500 block">채권자집회 기일</span>
          <div className="font-mono font-black text-base text-slate-900">{creditorsMeetingDate || '기일 미등록'}</div>
          <p className="text-[11px] text-slate-500">신분증 지참 필수. 불출석 시 절차상 불이익이 있을 수 있으니 사전에 안내하세요.</p>
        </div>
      </div>
    </div>
  );
}
