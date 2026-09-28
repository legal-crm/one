import React, { useState } from 'react';
import { 
  X, Landmark, Calendar, AlertTriangle, CheckCircle2, 
  Copy, ArrowRight, ShieldCheck, Users, Clock, Send,
  AlertOctagon, Scale, ShieldAlert, Sparkles, MessageSquare, Printer, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { CourtVirtualAccountPlan, CreditorsMeetingPlan, RepealDefensePetitionType } from '../../../types/courtPetitionTypes';
import { getCourtRepealStandard, loadRehabCompanionCase, evaluateOverdueRisk } from '../../../services/companionService';
import { getOfficeProfile } from '../../../services/lawyer/officeProfile';
import RepealDefensePetitionModal from './RepealDefensePetitionModal';
import ModalPortal from '../../common/ModalPortal';

interface PostCommencementManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

function PostCommencementManagementModalInner({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = ''
}: PostCommencementManagementModalProps) {

  // 모든 값은 실제 사건 데이터에서만 가져온다 (이전: '서울회생법원'·'2026개회 (접수 준비중)'·월 1,246,666원·
  //  가짜 가상계좌 '신한은행 562-901-8849201 (회생위원 홍길동)'·가짜 납부 이력·가짜 집회기일·가짜 이의신청이 모든 의뢰인에게 표시)
  const clientName = clientRequest.clientName || '신청인';
  const ds = crmExt.decisionSummary;
  const cc: any = crmExt.courtCase || {};
  const courtName = cc.courtName || ds?.courtName || clientRequest.court || '';
  const caseNumber = cc.caseNumber || ds?.caseNumber || (clientRequest as any).caseNumber || '';
  const courtLabel = courtName || '관할 법원';
  const caseLabel = caseNumber || '(사건번호 미등록)';
  const monthlyRepayment = crmExt.repaymentPlan?.monthlyRepaymentTotal || 0;
  const signature = `대리인 ${getOfficeProfile(activeLawyerName).firmName || '법률사무소'}${activeLawyerName ? ` (${activeLawyerName} 변호사)` : ''}`;
  const saved = (crmExt as any).postCommencementPlan as { accountPlan?: CourtVirtualAccountPlan; meetingPlan?: CreditorsMeetingPlan } | undefined;

  const [activeTab, setActiveTab] = useState<'virtual_account' | 'meeting' | 'objections' | 'repeal_defense'>('virtual_account');
  const [petitionModalOpen, setPetitionModalOpen] = useState(false);
  const [selectedPetitionType, setSelectedPetitionType] = useState<RepealDefensePetitionType>('REPAYMENT_PLAN_MODIFICATION');
  const [isSaving, setIsSaving] = useState(false);

  const courtThreshold = getCourtRepealStandard(courtName);
  // 실제 미납 의심 회차 (의뢰인 회생동행 납부기록 기준). 기록이 없으면 0 — 아래 선택기는 '가정' 시뮬레이션용
  const recordedOverdue = (() => {
    try {
      const cs = loadRehabCompanionCase(clientRequest.id);
      return cs ? evaluateOverdueRisk(cs).overdueCount : 0;
    } catch { return 0; }
  })();
  const [overdueRoundsCount, setOverdueRoundsCount] = useState(recordedOverdue);
  const totalOverdueAmount = overdueRoundsCount * monthlyRepayment;

  // 1. 법원 가상계좌 및 소급 적립금 플랜 (저장본 → 개시결정 요약 → 빈 값)
  const [accountPlan, setAccountPlan] = useState<CourtVirtualAccountPlan>(() => saved?.accountPlan || {
    courtName,
    caseNumber,
    virtualAccountBank: ds?.virtualAccountBank || '',
    virtualAccountNumber: ds?.virtualAccountNumber || cc.courtVirtualAccount || '',
    accountHolder: '',
    monthlyPayment: monthlyRepayment,
    paymentDayOfMonth: 0,
    commencementDate: ds?.commencementDate || '',
    retroactiveStartMonth: '',
    accumulatedMonths: 0,
    totalAccumulatedDue: 0,
    scheduleItems: [],
  });

  // 2. 채권자집회 플랜 (저장본 → 사건 정보 → 빈 값)
  const [meetingPlan, setMeetingPlan] = useState<CreditorsMeetingPlan>(() => saved?.meetingPlan || {
    meetingDate: cc.creditorMeetingDate || '',
    meetingPlace: '',
    dDay: 0,
    preparationChecklist: {
      bringIdCard: true,
      bringNoticeLetter: true,
      dressCodeNotice: true,
      noLateWarning: true
    },
    objections: [],
  });

  const hasAccount = !!accountPlan.virtualAccountNumber.trim();
  const accountLine = hasAccount
    ? `${accountPlan.virtualAccountBank} ${accountPlan.virtualAccountNumber}${accountPlan.accountHolder ? ` (예금주: ${accountPlan.accountHolder})` : ''}`
    : '(법원 가상계좌 미등록 — 개시결정 통지서의 계좌를 확인하세요)';

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${okMsg} 자동 발송되지 않으니 카카오톡·문자로 직접 보내 주세요.`);
    } catch {
      toast.error('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.');
    }
  };

  // 계좌·집회 정보 저장 (이전: onUpdateCrmExt를 받고도 호출하지 않아 모달을 닫으면 입력이 사라짐)
  const handleSavePlans = async () => {
    setIsSaving(true);
    try {
      await onUpdateCrmExt({
        postCommencementPlan: { accountPlan, meetingPlan, updatedAt: new Date().toISOString() },
      } as any);
      toast.success('가상계좌·채권자집회 정보를 사건에 저장했습니다.');
    } catch (err) {
      console.error('[PostCommencement] 저장 실패', err);
      toast.error('저장하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // 1. [1~2회 주의] 가상계좌 분납 권고문
  const handleCopyPartialPayNotice = () => {
    const text = `[${courtLabel} 개인회생 변제금 미납 주의 및 분납 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseLabel}\n\n` +
      `현재 변제금 납부가 지연되고 있어 안내드립니다.\n\n` +
      `• 월 변제금 전액이 어렵다면 가능한 금액부터 법원 가상계좌로 나누어 입금하는 방법을 검토할 수 있습니다. (분납 처리 방식은 회생위원 안내를 따릅니다)\n` +
      `• 입금계좌: ${accountLine}\n\n` +
      `미납이 누적되면 법원이 변제계획 불수행을 이유로 절차 폐지를 검토할 수 있으니(채무자회생법 제621조), 사정이 생기면 바로 사무소로 연락해 주세요.\n` +
      signature;
    copyText(text, '1~2회 미납 주의·분납 안내문을 복사했습니다.');
  };

  // 2. [누적 경고] 폐지 위험 안내문
  const handleCopyWarningNotice = () => {
    const text = `[긴급: ${courtLabel} 개인회생 변제금 미납 누적 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseLabel}\n\n` +
      `귀하의 변제금이 ${overdueRoundsCount}회차분(${totalOverdueAmount.toLocaleString()}원) 미납된 것으로 확인됩니다. 미납이 계속되면 법원이 개인회생절차 폐지를 검토할 수 있습니다(채무자회생법 제621조).\n\n` +
      `[폐지되면]\n` +
      `• 인가된 변제계획에 따른 채무조정 효과를 더 이상 누릴 수 없게 됩니다.\n` +
      `• 채권자의 추심·강제집행이 다시 가능해질 수 있습니다.\n\n` +
      `【요청 사항】\n` +
      `1. 가능한 금액을 법원 가상계좌로 입금해 주세요. (${accountLine})\n` +
      `2. 실직·급여 감소·질병 등 사정이 있으면 바로 사무소로 연락해 주세요. 변제계획 변경신청 등 대응 방법을 검토합니다.\n\n` +
      signature;
    copyText(text, '미납 누적 경고문을 복사했습니다.');
  };

  // 3. [사정변경] 변제계획 변경 및 특별면책 안내문
  const handleCopyChangeSpecialNotice = () => {
    const text = `[${courtLabel} 개인회생 사정변경 시 구제 절차 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseLabel}\n\n` +
      `소득 감소, 실직, 질병 등으로 월 ${monthlyRepayment.toLocaleString()}원의 변제금 납부가 어려운 경우 다음 절차를 검토할 수 있습니다.\n\n` +
      `1. 【변제계획 변경신청 (채무자회생법 제619조)】\n` +
      `• 인가 후 사정이 바뀌면 변제계획 변경을 신청할 수 있습니다(월 변제금 조정 등). 변경 허가 여부는 법원이 판단합니다.\n\n` +
      `2. 【특별면책 (채무자회생법 제624조 제2항)】\n` +
      `• 책임질 수 없는 사유로 변제를 완료하지 못했고, 이미 변제한 금액이 파산 시 배당액(청산가치) 이상이며, 변제계획 변경이 불가능한 경우 법원이 면책결정을 할 수 있습니다. 비면책채권은 면책되지 않습니다.\n\n` +
      `증빙서류(급여명세서, 퇴직증명서, 진단서 등)를 준비하시어 사무소로 연락 주시기 바랍니다.\n` +
      signature;
    copyText(text, '변제계획 변경·특별면책 안내문을 복사했습니다.');
  };

  // 4. [폐지결정 후] 즉시항고 안내문
  const handleCopyImmediateAppealNotice = () => {
    const text = `[긴급: 개인회생 폐지결정에 대한 즉시항고 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseLabel}\n\n` +
      `법원이 개인회생절차 폐지결정을 했습니다. 폐지결정에 불복하려면 즉시항고 기간 안에 즉시항고장을 제출해야 합니다. 공고가 있는 경우 공고일부터 14일이며(채무자회생법 제13조 제2항), 정확한 기한은 결정문·공고를 보고 사무소가 확인해 드립니다.\n\n` +
      `【준비 사항】\n` +
      `1. 미납 변제금: ${totalOverdueAmount.toLocaleString()}원 (사무소 확인 금액 기준)\n` +
      `2. 입금 가상계좌: ${accountLine}\n` +
      `3. 입금 후 이체확인증을 사무소로 보내 주세요.\n\n` +
      `미납금을 완납하고 즉시항고를 해도 폐지결정이 취소되는지는 항고법원이 판단합니다. 기간이 지나면 즉시항고를 할 수 없으니 바로 연락 주십시오.\n` +
      signature;
    copyText(text, '즉시항고 안내문을 복사했습니다.');
  };

  const openPetitionEditor = (type: RepealDefensePetitionType) => {
    setSelectedPetitionType(type);
    setPetitionModalOpen(true);
  };

  // 가상계좌 안내문 복사
  const handleCopyAccountNotice = () => {
    if (!hasAccount) {
      toast.error('법원 가상계좌가 등록되지 않았습니다. 계좌번호를 먼저 입력해 주세요.');
      return;
    }
    const text = `[${courtLabel} 개인회생 변제금 납부 가상계좌 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `사건번호: ${caseLabel}\n\n` +
      `개시결정에 따라 법원이 지정한 변제금 납부 가상계좌입니다.\n` +
      `• 입금은행: ${accountPlan.virtualAccountBank}\n` +
      `• 계좌번호: ${accountPlan.virtualAccountNumber}\n` +
      (accountPlan.accountHolder ? `• 예금주: ${accountPlan.accountHolder}\n` : '') +
      `• 월 변제금: ${accountPlan.monthlyPayment.toLocaleString()}원\n` +
      (accountPlan.paymentDayOfMonth ? `• 매월 변제기일: 매월 ${accountPlan.paymentDayOfMonth}일\n` : '') +
      (accountPlan.accumulatedMonths > 0
        ? `\n[적립금 안내]\n개시결정 이후 누적된 ${accountPlan.accumulatedMonths}회차분(${accountPlan.totalAccumulatedDue.toLocaleString()}원)의 납부 방법은 회생위원 안내를 따라 주세요.`
        : '') +
      `\n\n${signature}`;
    copyText(text, '가상계좌 안내문을 복사했습니다.');
  };

  // 채권자집회 참석 안내문 복사
  const handleCopyMeetingNotice = () => {
    if (!meetingPlan.meetingDate) {
      toast.error('채권자집회 기일이 등록되지 않았습니다. 기일을 먼저 입력해 주세요.');
      return;
    }
    const text = `[${courtLabel} 채권자집회 기일 출석 안내]\n\n` +
      `신청인: ${clientName} 님\n` +
      `• 일시: ${meetingPlan.meetingDate}\n` +
      (meetingPlan.meetingPlace ? `• 장소: ${meetingPlan.meetingPlace}\n` : '') +
      `\n⚠️ 채무자 본인이 반드시 출석해야 합니다. 정당한 사유 없이 출석하지 않으면 절차 진행에 불이익(폐지 등)이 생길 수 있습니다. 부득이한 사정이 있으면 기일 전에 사무소로 알려 주세요.\n\n` +
      `【준비물·유의사항】\n` +
      `1. 신분증(주민등록증/운전면허증)\n` +
      `2. 법원 채권자집회 기일통지서\n` +
      `3. 단정한 복장\n` +
      `4. 기일 시작 전 여유 있게 도착\n\n` +
      signature;
    copyText(text, '채권자집회 안내문을 복사했습니다.');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
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
                사건: {caseLabel} · 신청인: {clientName} · 월 변제금: {monthlyRepayment > 0 ? `${monthlyRepayment.toLocaleString()}원` : '변제계획안 미저장'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSavePlans}
            disabled={isSaving}
            className="ml-auto mr-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            {isSaving ? '저장 중…' : '계좌·집회 정보 저장'}
          </button>
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
                    <span className="text-slate-500">예금주</span>
                    <input
                      type="text"
                      value={accountPlan.accountHolder}
                      onChange={(e) => setAccountPlan({ ...accountPlan, accountHolder: e.target.value })}
                      placeholder="통지서상 예금주"
                      className="font-bold text-right bg-white px-2 py-0.5 rounded border border-slate-200"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">매월 변제기일</span>
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={accountPlan.paymentDayOfMonth || ''}
                      onChange={(e) => setAccountPlan({ ...accountPlan, paymentDayOfMonth: Math.max(0, Math.min(31, Number(e.target.value) || 0)) })}
                      placeholder="일"
                      className="w-16 font-bold text-right bg-white px-2 py-0.5 rounded border border-slate-200"
                    />
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
                    <span>개시 후 누적 회차</span>
                    <input
                      type="number"
                      min={0}
                      value={accountPlan.accumulatedMonths}
                      onChange={(e) => {
                        const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        setAccountPlan({ ...accountPlan, accumulatedMonths: n, totalAccumulatedDue: n * accountPlan.monthlyPayment });
                      }}
                      className="w-16 font-mono font-bold text-right bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-800"
                    />
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
                    {accountPlan.scheduleItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          등록된 납부 기록이 없습니다. 회차별 납부 확인은 의뢰인 회생동행 화면(납부 히트맵)의 기록을 기준으로 합니다.
                        </td>
                      </tr>
                    )}
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
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                    <label className="flex items-center gap-1">기일
                      <input
                        type="text"
                        value={meetingPlan.meetingDate}
                        onChange={(e) => setMeetingPlan({ ...meetingPlan, meetingDate: e.target.value })}
                        placeholder="예: 2026-11-05 14:00"
                        className="px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-900"
                      />
                    </label>
                    <label className="flex items-center gap-1">장소
                      <input
                        type="text"
                        value={meetingPlan.meetingPlace}
                        onChange={(e) => setMeetingPlan({ ...meetingPlan, meetingPlace: e.target.value })}
                        placeholder="통지서상 법정"
                        className="px-2 py-0.5 rounded border border-slate-200 text-slate-900"
                      />
                    </label>
                  </div>
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
                  <span>채권자집회는 채무자 본인 출석이 원칙입니다</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-900">
                  정당한 사유 없이 불출석하면 절차 진행에 불이익(폐지 등)이 생길 수 있습니다. 불이익의 내용은 재판부가 판단합니다. 부득이한 사정이 있으면 기일 전에 법원에 알리도록 안내하세요.
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
                    <span className="font-bold text-slate-900">여유 있게 도착</span>
                    <p className="text-[11px] text-slate-500">기일 시작 전 법정 앞에서 대기 (지각하면 불출석으로 처리될 수 있음)</p>
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
                    채권자목록 이의기간 중 접수된 채권양도/명의변경 및 금액 이의 기록 (채권조사확정재판 대응 기능은 아직 없습니다)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {meetingPlan.objections.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    등록된 채권자 이의·채권양도 신고가 없습니다.
                  </div>
                )}
                {meetingPlan.objections.map(obj => (
                  <div key={obj.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{obj.creditorName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                          {obj.objectionType === 'DEBT_TRANSFER' ? '채권양도신고' : '금액이의'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${obj.status === 'ANSWERED' ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'}`}>
                        {obj.status === 'ANSWERED' ? '답변 완료' : '답변 준비'}
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
                          참고용 일반 경향
                        </span>
                        <span className="text-xs text-amber-300 font-bold">
                          {courtThreshold.courtName}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-white mt-0.5">
                        변제금 미납 폐지 위험 참고 판정 (기록된 미납 {recordedOverdue}회)
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
                    <span className="text-xs text-slate-400 pl-2 font-semibold">미납 회차(가정):</span>
                    <select
                      value={overdueRoundsCount}
                      onChange={(e) => setOverdueRoundsCount(Number(e.target.value))}
                      className="bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-red-500"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map(n => (
                        <option key={n} value={n}>{n}회차 미납{n === recordedOverdue ? ' (기록 기준)' : ''}</option>
                      ))}
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
                      {courtThreshold.leniencyLevel === 'HIGH_FLEXIBLE' ? '비교적 유연한 경향' : courtThreshold.leniencyLevel === 'MODERATE' ? '보통' : '비교적 엄격한 경향'} (재판부마다 다름)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                    <span className="text-slate-400 text-[11px] block">폐지결정 즉시항고 기간</span>
                    <span className="text-base font-black text-emerald-400">
                      공고일부터 14일
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      제13조 제2항 · 기산일은 결정문·공고로 확인
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
                  <span className="text-xs text-slate-500">초안 · [대괄호] 빈칸 직접 작성</span>
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
                        책임질 수 없는 사유로 변제를 마치지 못했고, 변제한 총액이 청산가치 이상이며, 변경이 불가능할 때 면책결정을 구합니다.
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
                          공고일부터 14일
                        </span>
                        <span className="text-xs font-bold text-red-600">폐지결정 불복</span>
                      </div>
                      <h5 className="font-extrabold text-sm text-slate-900">
                        폐지결정 즉시항고장
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        폐지결정에 불복해 취소를 구합니다. 미납금 완납 등 사정을 소명하며, 인용 여부는 항고법원이 판단합니다.
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
                    <span>의뢰인 전송용 안내문 4종 (복사 후 직접 발송)</span>
                  </h4>
                  <span className="text-xs text-slate-500">자동 발송 아님</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900">① 1~2회 미납 주의 & 가상계좌 분납 안내</div>
                      <p className="text-slate-500 text-[11px]">가능한 금액부터 입금 권고 (분납 방식은 회생위원 안내)</p>
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
                      <div className="font-bold text-slate-900">② 미납 누적 경고문</div>
                      <p className="text-slate-500 text-[11px]">폐지 검토 가능성 안내 및 사정 소명 요청</p>
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
                      <div className="font-bold text-slate-900">④ 폐지결정 즉시항고 안내문</div>
                      <p className="text-slate-500 text-[11px]">즉시항고 기간·준비사항 안내 (결과 보장 아님)</p>
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
  </ModalPortal>
  );
}

/** 닫힌 상태에서는 내부 훅을 실행하지 않도록 바깥에서 먼저 분기 (Rules of Hooks: 조건부 return을 훅보다 앞에 두지 않음) */
export default function PostCommencementManagementModal(props: React.ComponentProps<typeof PostCommencementManagementModalInner>) {
  if (!props.isOpen) return null;
  return <PostCommencementManagementModalInner {...props} />;
}
