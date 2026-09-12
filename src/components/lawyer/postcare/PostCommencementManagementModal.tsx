import React, { useState } from 'react';
import { 
  X, Landmark, Calendar, AlertTriangle, CheckCircle2, 
  Copy, ArrowRight, ShieldCheck, Users, Clock, Send,
  AlertOctagon, Scale, ShieldAlert, Sparkles, MessageSquare, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { CourtVirtualAccountPlan, CreditorsMeetingPlan, RepealDefensePetitionType } from '../../../types/courtPetitionTypes';
import { getCourtRepealStandard } from '../../../services/companionService';
import RepealDefensePetitionModal from './RepealDefensePetitionModal';

interface PostCommencementManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

export default function PostCommencementManagementModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '김변호'
}: PostCommencementManagementModalProps) {
  if (!isOpen) return null;

  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const caseNumber = crmExt.courtCase?.caseNumber || (clientRequest as any).caseNumber || '2026개회 (접수 준비중)';
  const monthlyRepayment = crmExt.repaymentPlan?.monthlyRepaymentTotal || 1246666;

  const [activeTab, setActiveTab] = useState<'virtual_account' | 'meeting' | 'objections' | 'repeal_defense'>('virtual_account');
  const [petitionModalOpen, setPetitionModalOpen] = useState(false);
  const [selectedPetitionType, setSelectedPetitionType] = useState<RepealDefensePetitionType>('REPAYMENT_PLAN_MODIFICATION');

  const courtThreshold = getCourtRepealStandard(courtName);
  const [overdueRoundsCount, setOverdueRoundsCount] = useState(3);
  const totalOverdueAmount = overdueRoundsCount * monthlyRepayment;

  // 1. [1~2회 주의] 가상계좌 분납 권고문
  const handleCopyPartialPayNotice = () => {
    const text = `[${courtName} 개인회생 변제금 미납 주의 및 분납 납부 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseNumber}\n\n` +
      `현재 변제금 납부가 지연되고 있어 안내드립니다.\n\n` +
      `💡 [법원 가상계좌 분납 실전 팁]\n` +
      `• 개인회생 변제금은 일반 대출과 달리 '연체이자'가 전혀 발생하지 않습니다.\n` +
      `• 1회차 전액 납부가 어렵더라도 10만원, 20만원 등 가능한 금액부터 법원 가상계좌로 나누어 입금(분납)하실 수 있습니다.\n` +
      `• 입금계좌: ${accountPlan.virtualAccountBank} ${accountPlan.virtualAccountNumber} (예금주: ${accountPlan.accountHolder})\n\n` +
      `3회 이상 연체 시 법원의 폐지 절차가 진행되므로, 소액이라도 가상계좌로 분할 입금하여 연체 누적을 방지해 주시기 바랍니다.\n` +
      `대리인 법률사무소 (${activeLawyerName} 변호사)`;

    navigator.clipboard.writeText(text);
    toast.success('📱 1~2회 미납 주의 및 분납 권고문이 복사되었습니다!');
  };

  // 2. [3회 경고] 폐지예고 통지 대비 긴급 안내문
  const handleCopyWarningNotice = () => {
    const text = `[🚨 긴급 경고: ${courtName} 개인회생 폐지 위험 통지]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseNumber}\n\n` +
      `귀하의 변제금이 ${overdueRoundsCount}회차(${totalOverdueAmount.toLocaleString()}원) 미납되어, ${courtName}에서 '개인회생 폐지예정 통지서' 발송 및 직권 폐지 심리에 착수할 예정입니다.\n\n` +
      `⚠️ [미납 시 법적 조치]\n` +
      `• 폐지 결정 시 인가된 채무조정 효력이 즉시 상실됩니다.\n` +
      `• 채권자들의 원금+이자 청구 및 급여/통장 압류가 즉시 재개됩니다.\n\n` +
      `【긴급 대응 요청】\n` +
      `1. 오늘 중으로 가능한 금액을 법원 가상계좌로 즉시 일부라도 입금하십시오.\n` +
      `2. 실직, 급여 삭감, 질병 등 사유가 있으시면 즉시 당 사무소로 연락하여 '변제계획 변경신청' 또는 '특별면책'을 진행해야 합니다.\n\n` +
      `대리인 법률사무소 (${activeLawyerName} 변호사)`;

    navigator.clipboard.writeText(text);
    toast.success('📱 3회 폐지예고 긴급 경고문이 복사되었습니다!');
  };

  // 3. [사정변경] 변제계획 변경 및 특별면책 안내문
  const handleCopyChangeSpecialNotice = () => {
    const text = `[${courtName} 개인회생 긴급 사정변경 및 구제신청 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseNumber}\n\n` +
      `소득 감소, 실직, 중증 질환 등으로 기존 월 ${monthlyRepayment.toLocaleString()}원의 변제금 납부가 도저히 불가능한 경우, 법원에 다음과 같은 법적 구제 절차를 신청할 수 있습니다.\n\n` +
      `1. 【변제계획 변경신청 (채무자회생법 제619조)】\n` +
      `• 실직·소득감소·부양가족 증가 증빙 시 월 변제금을 하향 감액하거나 기간 연장\n\n` +
      `2. 【특별면책 신청 (채무자회생법 제624조 제2항)】\n` +
      `• 중증 질환, 사고 등 불가항력 사유로 근로능력을 상실하였고, 이미 납부한 금액이 청산가치를 초과한 경우 남은 빚 전액 즉시 면책\n\n` +
      `증빙서류(급여명세서, 퇴직증명서, 진단서 등)를 준비하시어 당 사무소로 신속히 연락 주시기 바랍니다.\n` +
      `대리인 법률사무소 (${activeLawyerName} 변호사)`;

    navigator.clipboard.writeText(text);
    toast.success('📱 변제계획변경·특별면책 구제 안내문이 복사되었습니다!');
  };

  // 4. [14일 골든타임] 즉시항고 비상대응문
  const handleCopyImmediateAppealNotice = () => {
    const text = `[🚨 비상 상황: 개인회생 폐지결정 취소 및 14일 즉시항고 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseNumber}\n\n` +
      `법원에서 개인회생 폐지 결정이 공고되었습니다.\n` +
      `하지만 대한민국 법원 전자공고일로부터 단 '14일 이내(불변기간)'에 즉시항고장 제출과 함께 밀린 변제금을 전액 완납하시면, 폐지결정이 취소되고 개인회생 절차가 원래대로 기적처럼 부활합니다!\n\n` +
      `【즉시항고 3대 필수 지침】\n` +
      `1. 미납 총액: ${totalOverdueAmount.toLocaleString()}원\n` +
      `2. 입금 가상계좌: ${accountPlan.virtualAccountBank} ${accountPlan.virtualAccountNumber}\n` +
      `3. 완납 후 즉시 이체확인증을 당 사무소로 전송해 주시면 법원에 즉시항고장을 긴급 접수합니다.\n\n` +
      `14일이 지나면 사건이 영구 폐지되어 재신청 외에는 방법이 없습니다. 1분 1초가 시급하니 즉시 연락 주십시오.\n` +
      `대리인 법률사무소 (${activeLawyerName} 변호사)`;

    navigator.clipboard.writeText(text);
    toast.success('📱 14일 즉시항고 골든타임 비상대응문이 복사되었습니다!');
  };

  const openPetitionEditor = (type: RepealDefensePetitionType) => {
    setSelectedPetitionType(type);
    setPetitionModalOpen(true);
  };

  // 1. 법원 가상계좌 및 소급 적립금 플랜
  const [accountPlan, setAccountPlan] = useState<CourtVirtualAccountPlan>({
    courtName,
    caseNumber,
    virtualAccountBank: '신한은행',
    virtualAccountNumber: '562-901-8849201',
    accountHolder: `${courtName} (회생위원 홍길동)`,
    monthlyPayment: monthlyRepayment,
    paymentDayOfMonth: 25,
    commencementDate: '2026-05-10',
    retroactiveStartMonth: '2026-02',
    accumulatedMonths: 3, // 3회차 누적
    totalAccumulatedDue: monthlyRepayment * 3,
    scheduleItems: [
      { round: 1, yearMonth: '2026-02', amount: monthlyRepayment, isPaid: true, paidDate: '2026-05-12' },
      { round: 2, yearMonth: '2026-03', amount: monthlyRepayment, isPaid: true, paidDate: '2026-05-12' },
      { round: 3, yearMonth: '2026-04', amount: monthlyRepayment, isPaid: false },
      { round: 4, yearMonth: '2026-05', amount: monthlyRepayment, isPaid: false },
    ]
  });

  // 2. 채권자집회 플랜
  const [meetingPlan, setMeetingPlan] = useState<CreditorsMeetingPlan>({
    meetingDate: '2026-07-15 14:00',
    meetingPlace: `${courtName} 본관 제3법정`,
    dDay: 42,
    preparationChecklist: {
      bringIdCard: true,
      bringNoticeLetter: true,
      dressCodeNotice: true,
      noLateWarning: true
    },
    objections: [
      {
        id: 'obj-1',
        creditorName: '하나카드 주식회사',
        objectionType: 'DEBT_TRANSFER',
        content: '2026.04.10.자로 주식회사 고려신용정보(유동화전문회사)로 채권이 양도되어 양도인 명의변경 신청함.',
        responseDraft: '양도통지서 및 양수인의 계좌 내역을 확인하여 제4차 채권자목록의 채권자 명의를 유동화회사로 수정 반영함.',
        status: 'ANSWERED'
      }
    ]
  });

  // 가상계좌 안내문 카카오톡 복사
  const handleCopyAccountNotice = () => {
    const text = `[${courtName} 개인회생 변제금 전용 가상계좌 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseNumber}\n\n` +
      `개시결정에 따라 법원에서 부여된 공식 변제금 납부 가상계좌입니다.\n` +
      `• 입금은행: ${accountPlan.virtualAccountBank}\n` +
      `• 계좌번호: ${accountPlan.virtualAccountNumber}\n` +
      `• 예금주: ${accountPlan.accountHolder}\n` +
      `• 월 변제금: ${accountPlan.monthlyPayment.toLocaleString()}원\n` +
      `• 매월 변제기일: 매월 ${accountPlan.paymentDayOfMonth}일\n\n` +
      `🚨 [소급 변제금 유의사항]\n` +
      `개시결정 지연으로 누적된 ${accountPlan.accumulatedMonths}회차분(${accountPlan.totalAccumulatedDue.toLocaleString()}원)을 지정 기일 내에 전액 완납하셔야 최종 변제인가결정이 내려집니다.`;

    navigator.clipboard.writeText(text);
    toast.success('📱 의뢰인 전송용 법원 가상계좌 안내문이 복사되었습니다!');
  };

  // 채권자집회 참석 안내문 카카오톡 복사
  const handleCopyMeetingNotice = () => {
    const text = `[${courtName} 채권자집회 기일 출석 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `• 일시: ${meetingPlan.meetingDate}\n` +
      `• 장소: ${meetingPlan.meetingPlace}\n\n` +
      `⚠️ [중요 경고: 불출석 시 즉시 폐지]\n` +
      `채권자집회에 정당한 사유 없이 불출석할 경우, 채무자회생법에 따라 개인회생 신청이 즉각 기각·폐지됩니다.\n\n` +
      `【집회 출석 4대 필수 수칙】\n` +
      `1. 신분증(주민등록증/운전면허증) 필참\n` +
      `2. 법원 채권자집회 통지서 지참\n` +
      `3. 단정한 복장 (슬리퍼/모자 금지)\n` +
      `4. 기일 시작 10분 전 반드시 법정 입정\n\n` +
      `궁금하신 사항은 대리인 법률사무소로 문의해 주시기 바랍니다.`;

    navigator.clipboard.writeText(text);
    toast.success('📱 채권자집회 의뢰인 안내문이 복사되었습니다!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              🏦
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                개시결정 이후 사후관리 센터 (가상계좌 & 집회 & 이의대응)
              </h3>
              <p className="text-[11px] text-slate-400">
                사건: {caseNumber} · 신청인: {clientName} · 월 변제금: {monthlyRepayment.toLocaleString()}원
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4">
          {[
            { key: 'virtual_account', label: '1. 법원 가상계좌 & 소급적립금', icon: '💳' },
            { key: 'meeting', label: '2. 채권자집회 출석 가이드', icon: '🏛️' },
            { key: 'objections', label: '3. 채권자 이의신청 대응', icon: '⚖️' },
            { key: 'repeal_defense', label: '4. 🚨 미납·폐지방어 & 즉시항고', icon: '🚨' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`py-3 px-3.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                activeTab === t.key 
                  ? 'text-emerald-700 border-emerald-600 bg-white shadow-xs' 
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* ══════════ [1탭] 법원 가상계좌 & 소급적립금 ══════════ */}
          {activeTab === 'virtual_account' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    법원 지정 변제금 가상계좌 등록 및 소급 납부 스케줄
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    개시결정 통지서에 부여된 공식 계좌를 등록하고 누적 변제금을 관리합니다.
                  </p>
                </div>
                <button
                  onClick={handleCopyAccountNotice}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>가상계좌 카톡 안내문 복사</span>
                </button>
              </div>

              {/* 가상계좌 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 block">법원 가상계좌 정보</span>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">입금 은행</span>
                    <input 
                      type="text" 
                      value={accountPlan.virtualAccountBank} 
                      onChange={(e) => setAccountPlan({ ...accountPlan, virtualAccountBank: e.target.value })}
                      className="font-bold text-right bg-white px-2 py-0.5 rounded border border-slate-200"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">가상계좌번호</span>
                    <input 
                      type="text" 
                      value={accountPlan.virtualAccountNumber} 
                      onChange={(e) => setAccountPlan({ ...accountPlan, virtualAccountNumber: e.target.value })}
                      className="font-mono font-bold text-right bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-600"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">예금주 (회생위원)</span>
                    <span className="font-bold text-slate-800">{accountPlan.accountHolder}</span>
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2 text-amber-950">
                  <span className="font-bold block flex items-center gap-1">
                    <Clock className="w-4 h-4 text-amber-700" />
                    소급 누적 변제금 계산기
                  </span>
                  <div className="flex justify-between items-center py-1 border-b border-amber-200/70">
                    <span>월 변제금</span>
                    <span className="font-mono font-bold">{accountPlan.monthlyPayment.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-amber-200/70">
                    <span>개시 지연 누적 회차</span>
                    <span className="font-mono font-bold text-amber-800">{accountPlan.accumulatedMonths}회차분</span>
                  </div>
                  <div className="flex justify-between items-center py-1 font-bold">
                    <span>일괄 소급 완납 필요 총액</span>
                    <span className="font-mono text-base text-rose-600">{accountPlan.totalAccumulatedDue.toLocaleString()}원</span>
                  </div>
                </div>
              </div>

              {/* 회차별 납부 스케줄 표 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="p-3">회차</th>
                      <th className="p-3">귀속월</th>
                      <th className="p-3 text-right">변제예정금</th>
                      <th className="p-3 text-center">납부상태</th>
                      <th className="p-3">납부일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accountPlan.scheduleItems.map(item => (
                      <tr key={item.round} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold">제{item.round}회차</td>
                        <td className="p-3 font-mono">{item.yearMonth}</td>
                        <td className="p-3 text-right font-mono font-bold">{item.amount.toLocaleString()}원</td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            item.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700 animate-pulse'
                          }`}>
                            {item.isPaid ? '납부완료' : '미납(소급대상)'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono">{item.paidDate || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ [2탭] 채권자집회 출석 가이드 ══════════ */}
          {activeTab === 'meeting' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    채권자집회 기일 관리 및 의뢰인 출석 수칙
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    기일: <strong className="text-slate-900">{meetingPlan.meetingDate}</strong> · 장소: {meetingPlan.meetingPlace}
                  </p>
                </div>
                <button
                  onClick={handleCopyMeetingNotice}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>집회안내 카톡 복사</span>
                </button>
              </div>

              {/* 긴급 경고 배너 */}
              <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-2xl text-rose-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>채권자집회 불출석 시 즉시 사건 폐지(기각) 경고</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-900">
                  채무자회생법 실무상 채무자 본인이 정당한 사유(입원 등 불가항력 제외) 없이 집회에 불출석하면 재판부는 즉시 폐지결정을 내립니다. 10분 전 반드시 법정에 입정하도록 사전 안내해야 합니다.
                </p>
              </div>

              {/* 4대 체크리스트 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">1</span>
                  <div>
                    <span className="font-bold text-slate-900">신분증 필참</span>
                    <p className="text-[11px] text-slate-500">주민등록증 또는 운전면허증 (모바일 신분증 가능)</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">2</span>
                  <div>
                    <span className="font-bold text-slate-900">통지서 지참</span>
                    <p className="text-[11px] text-slate-500">법원에서 우편 송달된 채권자집회 기일통지서</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">3</span>
                  <div>
                    <span className="font-bold text-slate-900">단정한 복장</span>
                    <p className="text-[11px] text-slate-500">슬리퍼, 반바지, 모자 착용 금지</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">4</span>
                  <div>
                    <span className="font-bold text-slate-900">10분 전 입정</span>
                    <p className="text-[11px] text-slate-500">지각 시 신원확인 불가로 불출석 처리</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ [3탭] 채권자 이의신청 대응 ══════════ */}
          {activeTab === 'objections' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    채권자 이의신청 & 채권양도 신고 대응
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    채권자목록 이의기간 중 접수된 채권양도/명의변경 및 금액 이의에 대한 답변서 작성
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {meetingPlan.objections.map(obj => (
                  <div key={obj.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{obj.creditorName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                          {obj.objectionType === 'DEBT_TRANSFER' ? '채권양도신고' : '금액이의'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        답변서 제출완료
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                      <strong>이의 내용:</strong> {obj.content}
                    </p>
                    <p className="text-slate-700 leading-relaxed bg-blue-50 p-3 rounded-xl border border-blue-200 text-blue-950">
                      <strong>대리인 답변 및 조치:</strong> {obj.responseDraft}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════ [4탭] 🚨 미납·폐지방어 & 즉시항고 ══════════ */}
          {activeTab === 'repeal_defense' && (
            <div className="space-y-6">
              
              {/* 상단: 관할 법원별 미납 폐지 기준 & 위험도 진단 카드 */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-red-600 text-white shrink-0">
                      <AlertOctagon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-500 text-white">
                          도산재판부 실무 기준
                        </span>
                        <span className="text-xs text-amber-300 font-bold">
                          {courtThreshold.courtName}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-white mt-0.5">
                        변제금 미납 폐지 위험도 정밀 판정기
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                    <span className="text-xs text-slate-400 pl-2 font-semibold">미납 회차 설정:</span>
                    <select
                      value={overdueRoundsCount}
                      onChange={(e) => setOverdueRoundsCount(Number(e.target.value))}
                      className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-red-500"
                    >
                      <option value={1}>1회차 미납 (단순 주의)</option>
                      <option value={2}>2회차 미납 (주의 경고)</option>
                      <option value={3}>3회차 미납 (폐지예고 통지)</option>
                      <option value={4}>4회차 미납 (직권 폐지 착수)</option>
                      <option value={5}>5회차 이상 (폐지공고 / 항고 비상)</option>
                    </select>
                  </div>
                </div>

                {/* 게이지 및 임계치 정보 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[11px] block">현재 누적 미납액</span>
                    <span className="text-base font-black text-amber-400">
                      {totalOverdueAmount.toLocaleString()}원
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      월 {monthlyRepayment.toLocaleString()}원 × {overdueRoundsCount}회
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[11px] block">관할 법원 폐지 임계치</span>
                    <span className="text-base font-black text-red-400">
                      {courtThreshold.repealRiskRounds}회 이상 연체 시
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {courtThreshold.courtName.includes('서울') ? '서울(4~5회 유예)' : '지방(3회 엄격)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[11px] block">폐지 공고 시 골든타임</span>
                    <span className="text-base font-black text-emerald-400">
                      14일 이내 (불변기간)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      완납 영수증 + 즉시항고장 접수
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-300 leading-relaxed">
                  💡 <strong className="text-white">{courtThreshold.courtName} 실무 동향:</strong> {courtThreshold.description}
                </div>
              </div>

              {/* 3대 폐지방어 법원 서식 생성 센터 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-brand" />
                    <span>3대 법원 구제 서식 원클릭 생성 및 인쇄</span>
                  </h4>
                  <span className="text-xs text-slate-500">대법원 전산 양식 규격</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* 서식 1: 변제계획 변경신청서 */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 transition-all shadow-xs flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                          법 제619조
                        </span>
                        <span className="text-xs font-bold text-slate-700">소득감소·실직</span>
                      </div>
                      <h5 className="font-extrabold text-sm text-slate-900">
                        변제계획 변경신청서
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        월 소득 급감, 권고사직, 부양가족 증가 시 월 변제금을 하향 조정하거나 상환 기간을 연장합니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPetitionEditor('REPAYMENT_PLAN_MODIFICATION')}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>신청서 작성 / 출력</span>
                    </button>
                  </div>

                  {/* 서식 2: 특별면책 신청서 */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-purple-400 transition-all shadow-xs flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                          법 제624조 제2항
                        </span>
                        <span className="text-xs font-bold text-slate-700">질병·불가항력</span>
                      </div>
                      <h5 className="font-extrabold text-sm text-slate-900">
                        특별면책 신청서
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        중증 질환, 사고 등으로 변제 불능 상태이고 기납부 변제액이 청산가치 이상인 경우 잔여 채무 전액 면책.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPetitionEditor('SPECIAL_DISCHARGE')}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>신청서 작성 / 출력</span>
                    </button>
                  </div>

                  {/* 서식 3: 즉시항고장 */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-red-400 transition-all shadow-xs flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800">
                          14일 불변기간
                        </span>
                        <span className="text-xs font-bold text-red-600">폐지결정 취소</span>
                      </div>
                      <h5 className="font-extrabold text-sm text-slate-900">
                        폐지결정 즉시항고장
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        법원의 폐지 공고 후 14일 이내 미납금을 완납하고 폐지 결정을 전격 취소시켜 회생을 부활시킵니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openPetitionEditor('IMMEDIATE_APPEAL')}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>항고장 작성 / 출력</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* 의뢰인 맞춤 카카오톡 독촉/안내문 4종 원클릭 복사 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>의뢰인 전송용 맞춤 카카오톡 안내문 4종 (원클릭 복사)</span>
                  </h4>
                  <span className="text-xs text-slate-500">상황별 전문 문안</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900">① 1~2회 미납 주의 & 가상계좌 분납 안내</div>
                      <p className="text-slate-500 text-[11px]">무이자 고지 및 1만원 단위 쪼개기 입금 권고</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPartialPayNotice}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>복사</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900">② 3회 폐지예고 통지 대비 긴급 독촉문</div>
                      <p className="text-slate-500 text-[11px]">법원 폐지예고 통지 전 긴급 소명 요청</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyWarningNotice}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>복사</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900">③ 변제계획변경 & 특별면책 구제 안내문</div>
                      <p className="text-slate-500 text-[11px]">급여감소·질환 의뢰인용 증빙서류 안내</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyChangeSpecialNotice}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>복사</span>
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900">④ 14일 즉시항고 골든타임 비상대응문</div>
                      <p className="text-slate-500 text-[11px]">폐지공고 즉시 일시완납 및 항고장 안내</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyImmediateAppealNotice}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>복사</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>

        {/* 3대 폐지방어 법원 서식 모달 */}
        <RepealDefensePetitionModal
          isOpen={petitionModalOpen}
          onClose={() => setPetitionModalOpen(false)}
          petitionType={selectedPetitionType}
          clientRequest={clientRequest}
          crmExt={crmExt}
          activeLawyerName={activeLawyerName}
          overdueCount={overdueRoundsCount}
          totalOverdueAmount={totalOverdueAmount}
        />
      </div>
    </div>
  );
}
