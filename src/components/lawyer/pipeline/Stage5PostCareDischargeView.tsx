import React, { useState } from 'react';
import { 
  ShieldCheck, Landmark, Users, Calendar, AlertTriangle, 
  CheckCircle2, BellRing, Download, ExternalLink, ArrowRight,
  Clock, Award, FileText, Send, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';

interface Stage5PostCareDischargeViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onAdvanceToNextStage?: () => void;
  onOpenPostCareModal?: () => void;
}

export default function Stage5PostCareDischargeView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenPostCareModal,
}: Stage5PostCareDischargeViewProps) {
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const defaultMonthly = crmExt?.decisionSummary?.monthlyPayment 
    || crmExt?.decisionSummary?.monthlyRepayment 
    || clientRequest.financialProfile?.monthlyRepayment 
    || 650000;
  const defaultTotalMonths = crmExt?.decisionSummary?.repaymentPeriodMonths || 36;
  const paidCount = crmExt?.repaymentSchedule 
    ? crmExt.repaymentSchedule.filter(r => r.status === 'paid').length 
    : 12;

  const [isConditionalApproval, setIsConditionalApproval] = useState(false);
  const [hasCreditorObjection, setHasCreditorObjection] = useState(false);
  const [paidMonths, setPaidMonths] = useState(paidCount);
  const [totalMonths, setTotalMonths] = useState(defaultTotalMonths);
  const [monthlyPayment, setMonthlyPayment] = useState(defaultMonthly);
  const [isDischargeFiled, setIsDischargeFiled] = useState(false);

  const clientName = clientRequest.clientName || '신청인';

  const virtualAccount = crmExt?.courtCase?.courtVirtualAccount 
    || crmExt?.repaymentSchedule?.[0]?.virtualAccount 
    || '법원 가상계좌 (인가결정 후 발급 예정)';
  const virtualAccountDepositor = `${courtName} 회생위원`;

  const meetingDateStr = crmExt?.courtCase?.creditorMeetingDate || '기일 지정 대기중';
  const meetingLocationStr = crmExt?.courtCase?.creditorMeetingDate 
    ? `${courtName} 제3별관 204호` 
    : '법원 심리 후 개시결정문에 기재 예정';

  // 가상계좌 알림톡 발송
  const handleSendVirtualAccount = () => {
    toast.success(`${clientName}님께 법원 가상계좌(${virtualAccount}) 및 인가 전 적립금 납부 스케줄 안내 알림톡이 발송되었습니다.`);
  };

  // 집회 출석 지도 알림톡 발송
  const handleSendCreditorMeetingNotice = () => {
    toast.success(`${clientName}님께 채권자집회 기일(${meetingDateStr}) 출석 지도 및 준비물 안내 알림톡이 발송되었습니다.`);
  };

  // 대법원 제출용 면책신청서 원클릭 생성
  const handleGenerateDischargePetition = () => {
    setIsDischargeFiled(true);
    toast.success('36회차 성실 변제 완료 검증! [대법원 제출용 개인회생 면책신청서]가 성공적으로 생성되었습니다.');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 안내 바 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900">
              Stage 5. 개시결정·인가·변제수행 및 최종 별도 면책 신청
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
              인가 후 사후관리 진행중
            </span>
          </div>
          <p className="text-xs text-slate-500">
            법원 가상계좌 인가 전 적립금 관리, 채권조사확정재판 대응, 36개월 납부 관리 및 최종 별도 면책 신청을 총괄합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {paidMonths >= totalMonths ? (
            <button
              onClick={handleGenerateDischargePetition}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>🏆 최종 면책신청서 원클릭 생성</span>
            </button>
          ) : (
            <button
              onClick={() => setPaidMonths(totalMonths)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer text-[11px]"
            >
              <span>(테스트: 36회차 완납 시뮬레이션)</span>
            </button>
          )}
        </div>
      </div>

      {/* ⚠️ 똑생 & korea.legal 핵심 강조: 별도 면책 신청 필수 안내 배너 */}
      <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 text-purple-950 flex items-start justify-between gap-4 text-xs shadow-xs">
        <div className="flex items-start gap-3">
          <Award className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-sm text-purple-900 flex items-center gap-2">
              <span>법률상 필수: 변제 완료 후 "별도 면책 신청" 의무 (채무자회생법 제624조)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-200/70 font-bold text-purple-900">
                자동 면책 불가
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              36개월간 변제금을 모두 성실히 납부하여도 자동으로 사건이 면책 종결되지 않습니다. 반드시 채무자 또는 대리인이 <strong>법원에 면책신청서를 별도로 제출</strong>해야 법원의 면책결정(자연채무화)이 내려집니다.
            </p>
          </div>
        </div>

        {paidMonths >= totalMonths && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg shrink-0">
            면책신청 대상자
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 좌측 7열: 법원 가상계좌/인가전적립금 & 36개월 납부 트래커 */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. 법원 가상계좌 및 인가 전 적립금 트래커 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-brand" />
                <span className="text-xs font-black text-slate-900">
                  법원 가상계좌 & 인가 전 적립금 관리 (개시결정 즉시 가동)
                </span>
              </div>
              <button
                onClick={handleSendVirtualAccount}
                className="text-brand font-bold text-xs hover:underline flex items-center gap-1 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>계좌 알림톡 발송</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">회생위원 지정 가상계좌</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {virtualAccount} {virtualAccount.includes('발급 예정') ? '' : `(예금주: ${virtualAccountDepositor})`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">월 변제금 / 납입 지정일</span>
                <span className="font-bold text-slate-900">
                  매월 25일 / <span className="text-brand font-mono">{monthlyPayment.toLocaleString()}원</span>
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-slate-600 font-bold">인가 전 적립금 납부 현황</span>
                <span className="text-emerald-700 font-extrabold bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                  3회차 완납 (연체 없음) ✓
                </span>
              </div>
            </div>
          </div>

          {/* 2. 36개월 변제금 납부 트래커 & 3회 연체 폐지 방어 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand" />
                <span className="text-xs font-black text-slate-900">
                  36개월 변제 수행 트래커 (3회 연체 시 폐지 경고)
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-brand">
                {paidMonths} / {totalMonths}회차 ({Math.round((paidMonths / totalMonths) * 100)}%)
              </span>
            </div>

            {/* 게이지 바 */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(paidMonths / totalMonths) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>납부 누적액: {(paidMonths * monthlyPayment).toLocaleString()}원</span>
              <span>잔여 변제액: {((totalMonths - paidMonths) * monthlyPayment).toLocaleString()}원</span>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">3회 이상 누적 연체 시 절차 폐지 주의:</span>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  실직·질병으로 연체 위기 발생 시 즉시 '변제계획 변경신청' 또는 '특별면책(채무자회생법 제624조 제2항)'을 신청해야 폐지를 막을 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 우측 5열: 채권자집회/채권조사확정재판 & 조건부인가 관리 */}
        <div className="lg:col-span-5 space-y-6">
          {/* 3. 채권자집회 기일 & 채권조사확정재판 대응 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                <span className="text-xs font-black text-slate-900">
                  채권자집회 & 채권조사확정재판
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700">
                기일 확정
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 block">채권자집회 일시 및 장소</span>
                <span className="font-extrabold text-slate-900 text-sm block">
                  {meetingDateStr} {meetingDateStr !== '기일 지정 대기중' ? meetingLocationStr : ''}
                </span>
                <p className="text-slate-500 text-[11px] pt-1">
                  * 본인 신분증 필참. 결의 절차가 아니므로 채권자 불출석 시에도 인가 요건 확인 후 20분 내 종료.
                </p>
                <button
                  onClick={handleSendCreditorMeetingNotice}
                  className="mt-2 w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-xs transition-all cursor-pointer"
                >
                  집회 출석 지도 알림톡 발송
                </button>
              </div>

              {/* korea.legal 특화: 채권조사확정재판 대응 서면 */}
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-rose-950">
                    채권자 이의: 개인회생채권조사확정재판
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-200 text-rose-800">
                    이의 1건
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  현대카드(주)에서 채권 원리금 120만원 이의 신청서 접수됨.
                </p>
                <button
                  onClick={() => toast.info('채권조사확정재판 답변서 작성 양식이 열렸습니다.')}
                  className="w-full py-1.5 bg-white border border-rose-300 text-rose-700 font-bold rounded-lg text-xs hover:bg-rose-50 transition-all cursor-pointer"
                >
                  채권조사확정재판 답변서 작성
                </button>
              </div>
            </div>
          </div>

          {/* 4. 조건부 인가 사건 연간 소득신고 리마인더 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900">
                조건부 인가 사건 사후관리 (매년 7월 보고)
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={isConditionalApproval}
                  onChange={e => setIsConditionalApproval(e.target.checked)}
                  className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand"
                />
                <span className="font-bold text-slate-700">조건부 인가</span>
              </label>
            </div>

            {isConditionalApproval ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
                <span className="font-bold block">매년 7월 15일 연간 소득·재산 변동 보고</span>
                <p className="text-slate-600 text-[11px]">
                  전년도 소득금액증명원 및 재산변동 내역 미보고 시 즉시 인가 폐지 대상이 되므로, 알림톡 자동 예약이 가동되었습니다. (보고 기한 D-285)
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                일반 인가 사건은 매년 정기 소득 보고 의무가 면제됩니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
