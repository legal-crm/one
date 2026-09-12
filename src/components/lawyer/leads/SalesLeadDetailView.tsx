import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, Phone, PhoneCall, Copy, CheckCircle2, Sparkles, Building, AlertCircle,
  Calendar, Clock, Plus, Trash2, CalendarClock, MessageSquare, Send, Zap, ExternalLink,
  ShieldAlert, UserCheck, Home, CreditCard, ChevronDown, ChevronUp, FileText, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  SalesLead, LeadStatus, AssetItem, CreditLoanItem, 
  LeadMemoItem, ReminderItem, ReminderType, CallLog, LeadStatusLog 
} from '../../../types/leadTypes';
import { LEAD_STATUS_CONFIG } from '../../../types/leadTypes';
import type { User, StaffMember, ConsultRequest, CrmClientExtension } from '../../../types';
import { 
  CASE_TYPES, JOB_TYPES, HOUSING_TYPES, HOUSING_DETAILS, 
  ASSET_TYPES, ASSET_OWNERS 
} from '../../../types';
import { 
  saveSalesLead, logLeadCall, extractBriefingData, 
  formatPhone, normalizeBirthYear 
} from '../../../services/leadService';
import { loadPartners, loadInboundPaths } from '../../../services/settingsService';
import CaseBriefingBanner from './CaseBriefingBanner';
import { CaseDetailAiSummary } from './CaseDetailAiSummary';
import { CaseCallsSmsTab } from './CaseCallsSmsTab';

interface SalesLeadDetailViewProps {
  lead: SalesLead;
  activeLawyer: User;
  staffMembers: StaffMember[];
  lawyers: User[];
  onBack: () => void;
  onUpdateLead: (updated: SalesLead) => void;
  onPromoteToClient: (lead: SalesLead) => void;
  onNavigateToCrm?: (clientId: string) => void;
}

const HISTORY_TYPES = ['없음', '개인회생', '개인파산', '신용회복'];
const RENT_CONTRACTORS = ['본인', '배우자'];
const FREE_HOUSING_OWNERS = ['부모', '자녀', '친척', '지인'];

export default function SalesLeadDetailView({
  lead,
  activeLawyer,
  staffMembers,
  lawyers,
  onBack,
  onUpdateLead,
  onPromoteToClient,
  onNavigateToCrm,
}: SalesLeadDetailViewProps) {
  const [currentLead, setCurrentLead] = useState<SalesLead>(lead);
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'calls'>('info');
  const [dockTab, setDockTab] = useState<'reminders' | 'ai_summary'>('reminders');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isSavedPulsing, setIsSavedPulsing] = useState(false);

  // 파트너 및 인입경로
  const partners = useMemo(() => loadPartners(), []);
  const inboundPaths = useMemo(() => loadInboundPaths(), []);

  // Sync state if lead prop changes
  useEffect(() => {
    setCurrentLead(lead);
  }, [lead]);

  // 실시간 저장 헬퍼
  const persistLead = useCallback((updated: SalesLead) => {
    setCurrentLead(updated);
    saveSalesLead(updated);
    onUpdateLead(updated);
    setIsSavedPulsing(true);
    setTimeout(() => setIsSavedPulsing(false), 1200);
  }, [onUpdateLead]);

  // 필드 단건 업데이트
  const handleFieldUpdate = (field: keyof SalesLead | string, value: any) => {
    const updated: SalesLead = {
      ...currentLead,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    persistLead(updated);
  };

  // 다중 필드 일괄 업데이트
  const handleBatchUpdate = (patch: Partial<SalesLead>) => {
    const updated: SalesLead = {
      ...currentLead,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    persistLead(updated);
  };

  // 1차 상태 변경 및 상태 전이 로그 기록
  const handleStatusChange = (newStatus: LeadStatus) => {
    if (newStatus === currentLead.status) return;
    const oldStatusLabel = LEAD_STATUS_CONFIG[currentLead.status]?.label || currentLead.status;
    const newStatusLabel = LEAD_STATUS_CONFIG[newStatus]?.label || newStatus;

    const logItem: LeadStatusLog = {
      logId: `log-${Date.now()}`,
      fromStatus: oldStatusLabel,
      toStatus: newStatusLabel,
      changedAt: new Date().toISOString(),
      memo: `담당자(${activeLawyer.name})가 상태를 변경했습니다.`,
    };

    const updated: SalesLead = {
      ...currentLead,
      status: newStatus,
      statusLogs: [logItem, ...(currentLead.statusLogs || [])],
      updatedAt: new Date().toISOString(),
    };
    persistLead(updated);
    toast.success(`상태가 '${newStatusLabel}'(으)로 변경되었습니다.`);
  };

  // 전화번호 복사
  const handleCopyPhone = () => {
    if (!currentLead.phone) return;
    navigator.clipboard.writeText(currentLead.phone.replace(/[^0-9]/g, ''));
    setCopiedPhone(true);
    toast.success('전화번호가 복사되었습니다.');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // ── 4번 자산/부채 관리용 상태 & 핸들러 ──
  const [newAsset, setNewAsset] = useState<Partial<AssetItem>>({ 
    owner: '본인', type: '자동차', amount: 0, loanAmount: 0, desc: '' 
  });
  const [newCreditLoan, setNewCreditLoan] = useState<Partial<CreditLoanItem>>({ 
    desc: '', amount: 0 
  });

  const handleAddAsset = () => {
    if (!newAsset.amount && !newAsset.loanAmount) {
      toast.error('자산 시세 또는 담보대출금을 입력해주세요.');
      return;
    }
    const item: AssetItem = {
      id: `asset-${Date.now()}`,
      owner: (newAsset.owner as any) || '본인',
      type: newAsset.type || '기타',
      amount: Number(newAsset.amount || 0),
      loanAmount: Number(newAsset.loanAmount || 0),
      desc: newAsset.desc || '',
    };
    const currentAssets = currentLead.assets || [];
    handleFieldUpdate('assets', [...currentAssets, item]);
    setNewAsset({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, desc: '' });
    toast.success('보유 자산 항목이 추가되었습니다.');
  };

  const handleRemoveAsset = (id: string) => {
    const next = (currentLead.assets || []).filter(a => a.id !== id);
    handleFieldUpdate('assets', next);
    toast.success('자산 항목이 삭제되었습니다.');
  };

  const handleAddCreditLoan = () => {
    if (!newCreditLoan.amount) {
      toast.error('대출 금액을 입력해주세요.');
      return;
    }
    const item: CreditLoanItem = {
      id: `loan-${Date.now()}`,
      desc: newCreditLoan.desc || '신용대출',
      amount: Number(newCreditLoan.amount || 0),
    };
    const currentLoans = currentLead.creditLoans || [];
    const nextLoans = [...currentLoans, item];
    // 자동 총 채무액 재계산
    const newDebtTotal = nextLoans.reduce((sum, l) => sum + l.amount, 0);
    handleBatchUpdate({ creditLoans: nextLoans, debtTotal: newDebtTotal });
    setNewCreditLoan({ desc: '', amount: 0 });
    toast.success('신용대출 내역이 추가되었습니다.');
  };

  const handleRemoveCreditLoan = (id: string) => {
    const next = (currentLead.creditLoans || []).filter(l => l.id !== id);
    const newDebtTotal = next.reduce((sum, l) => sum + l.amount, 0);
    handleBatchUpdate({ creditLoans: next, debtTotal: newDebtTotal });
    toast.success('대출 내역이 삭제되었습니다.');
  };

  // 담보대출 자동 집계 문자열
  const autoCollateralString = useMemo(() => {
    const list: string[] = [];
    if (currentLead.housingType === '자가' && (currentLead.ownHouseLoan || 0) > 0) {
      list.push(`주택담보대출 ${currentLead.ownHouseLoan?.toLocaleString()}만원`);
    }
    if (currentLead.depositLoanAmount && currentLead.depositLoanAmount > 0) {
      list.push(`보증금대출 ${currentLead.depositLoanAmount?.toLocaleString()}만원`);
    }
    (currentLead.assets || []).forEach(a => {
      if (a.loanAmount > 0) {
        list.push(`${a.type}(${a.owner}) 담보 ${a.loanAmount.toLocaleString()}만원`);
      }
    });
    return list.length > 0 ? list.join(' / ') : '담보대출 내역 없음';
  }, [currentLead]);

  // ── 우측 독: 리마인더 상태 & 핸들러 ──
  const [remDate, setRemDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remHour, setRemHour] = useState('10');
  const [remMinute, setRemMinute] = useState('00');
  const [remType, setRemType] = useState<ReminderType>('통화');
  const [remContent, setRemContent] = useState('');
  const [newMemoInput, setNewMemoInput] = useState('');

  const handleAddReminder = () => {
    if (!remDate) {
      toast.error('예약 날짜를 선택해주세요.');
      return;
    }
    const dt = `${remDate} ${remHour}:${remMinute}`;
    const item: ReminderItem = {
      id: `rem-${Date.now()}`,
      datetime: dt,
      type: remType,
      content: remContent || `${remType} 예약`,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    const nextReminders = [...(currentLead.reminders || []), item];
    handleBatchUpdate({
      reminders: nextReminders,
      status: currentLead.status === 'new' ? 'callback' : currentLead.status,
    });
    setRemContent('');
    toast.success(`일정(${dt})이 예약되었습니다.`);
  };

  const handleQuickAddReminder = (offsetDays: number, label: string) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toISOString().slice(0, 10);
    const dt = `${dateStr} ${remHour}:${remMinute}`;
    const item: ReminderItem = {
      id: `rem-${Date.now()}`,
      datetime: dt,
      type: '통화',
      content: `${label} 재통화 예약`,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    const nextReminders = [...(currentLead.reminders || []), item];
    handleBatchUpdate({
      reminders: nextReminders,
      status: 'callback',
    });
    toast.success(`${label} (${dateStr} ${remHour}:${remMinute}) 통화가 예약되었습니다.`);
  };

  const handleToggleReminderCompleted = (id: string) => {
    const next = (currentLead.reminders || []).map(r => 
      r.id === id ? { ...r, isCompleted: !r.isCompleted } : r
    );
    handleFieldUpdate('reminders', next);
  };

  const handleDeleteReminder = (id: string) => {
    const next = (currentLead.reminders || []).map(r => r).filter(r => r.id !== id);
    handleFieldUpdate('reminders', next);
    toast.success('리마인더가 삭제되었습니다.');
  };

  // 상담 메모 추가
  const handleAddConsultMemo = () => {
    if (!newMemoInput.trim()) {
      toast.error('상담 메모 내용을 입력해주세요.');
      return;
    }
    const item: LeadMemoItem = {
      id: `memo-${Date.now()}`,
      content: newMemoInput.trim(),
      createdAt: new Date().toISOString(),
      authorId: activeLawyer.id,
      authorName: activeLawyer.name,
    };
    const nextMemos = [item, ...(currentLead.memos || [])];
    const combinedSpecialMemo = currentLead.specialMemo 
      ? `[${new Date().toLocaleDateString('ko-KR')}] ${newMemoInput.trim()}\n${currentLead.specialMemo}`
      : newMemoInput.trim();

    handleBatchUpdate({
      memos: nextMemos,
      specialMemo: combinedSpecialMemo,
    });
    setNewMemoInput('');
    toast.success('상담 메모가 저장되었습니다.');
  };

  const handleDeleteMemo = (memoId: string) => {
    const next = (currentLead.memos || []).filter(m => m.id !== memoId);
    handleFieldUpdate('memos', next);
    toast.success('상담 메모가 삭제되었습니다.');
  };

  // 통화 디스포지션 원클릭 기록
  const handleQuickCallDisposition = (
    result: 'connected' | 'no_answer' | 'callback' | 'rejected' | 'wrong_number',
    memo?: string
  ) => {
    const updated = logLeadCall(
      currentLead.id,
      { id: activeLawyer.id, name: activeLawyer.name },
      result,
      memo
    );
    if (updated) {
      persistLead(updated);
      toast.success(`통화 결과 '${result}' 기록 완료 (총 ${updated.callCount}회 통화)`);
    }
  };

  // 퀵 SMS 발송 시뮬레이션
  const handleSendQuickSms = (type: 'no_answer' | 'appointment') => {
    const text = type === 'no_answer'
      ? `[법무법인] ${currentLead.customerName}님, 회생·파산 무료상담 신청 주셔서 연락드렸으나 부재중으로 문자 남깁니다. 편하신 시간에 회신 주시면 변호사 직접 진단 도와드리겠습니다.`
      : `[법무법인] ${currentLead.customerName}님, 회생·파산 상담 전화 예약 안내드립니다. 예약 일시에 맞춰 연락드리겠습니다.`;

    toast.success(`${currentLead.customerName}님께 퀵 문자가 발송되었습니다.`, {
      description: text,
    });

    logLeadCall(
      currentLead.id,
      { id: activeLawyer.id, name: activeLawyer.name },
      'no_answer',
      `[SMS발송] ${type === 'no_answer' ? '부재중 안내문자' : '예약안내문자'} 발송`
    );
  };

  const briefingData = extractBriefingData(currentLead);
  const statusCfg = LEAD_STATUS_CONFIG[currentLead.status] || LEAD_STATUS_CONFIG.new;

  return (
    <div className="space-y-4 animate-fadeIn pb-24">
      {/* ── 1. Top Executive Navigation & Control Bar ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 md:p-5 shadow-xs sticky top-0 z-30 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Back button + Badges + Customer Info */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer press-scale active:scale-[0.98]"
            >
              <ArrowLeft size={16} />
              <span>영업 목록</span>
            </button>

            {/* Badges */}
            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
              {currentLead.caseType || '개인회생'}
            </span>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {currentLead.inboundPath || '직접인입'}
            </span>

            {/* Customer Headline */}
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                {currentLead.customerName}
              </h1>
              
              {/* Phone + 1-Click Copy + Tel link */}
              <div className="flex items-center gap-1 bg-slate-100/80 px-2.5 py-1 rounded-xl border border-slate-200">
                <a
                  href={`tel:${currentLead.phone}`}
                  onClick={() => handleQuickCallDisposition('connected', '전화 연결 시도')}
                  className="font-mono text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  title="전화 걸기"
                >
                  <Phone size={12} className="text-emerald-500" />
                  <span>{currentLead.phone}</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="p-1 hover:bg-white rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                  title="전화번호 복사"
                >
                  {copiedPhone ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* Right: 1차 상태 Select + CTA Promotion Button */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* 1차 상태 셀렉터 */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-400 hidden sm:inline">1차 상태:</label>
              <select
                value={currentLead.status}
                onChange={e => handleStatusChange(e.target.value as LeadStatus)}
                className={`px-3 py-2 text-xs font-extrabold rounded-xl border cursor-pointer outline-hidden transition-all ${statusCfg.bgColor} ${statusCfg.color} ${statusCfg.borderColor}`}
              >
                {(Object.keys(LEAD_STATUS_CONFIG) as LeadStatus[]).map(key => (
                  <option key={key} value={key}>
                    {LEAD_STATUS_CONFIG[key].emoji} {LEAD_STATUS_CONFIG[key].label}
                  </option>
                ))}
              </select>
            </div>

            {/* 고객 관리로 이전 CTA */}
            {currentLead.status === 'converted' ? (
              <button
                type="button"
                onClick={() => currentLead.convertedClientId && onNavigateToCrm && onNavigateToCrm(currentLead.convertedClientId)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>고객 CRM 열기</span>
                <ExternalLink size={12} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPromoteToClient(currentLead)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer press-scale active:scale-[0.98]"
              >
                <Sparkles size={14} />
                <span>⭐️ 고객 관리로 이전</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Top Executive Dark Case Briefing Banner (4 Monotone Charcoal Panels) ── */}
      <CaseBriefingBanner data={briefingData} defaultExpanded={true} />

      {/* ── 3. Sub-Tab Switcher ── */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-2xl overflow-x-auto shadow-2xs">
        {[
          { id: 'info', label: '📝 고객 정보 수정 (실시간 자동저장)' },
          { id: 'calls', label: '💬 통화 및 문자 타임라인' },
          { id: 'timeline', label: '⏱ 상태 변경 타임라인' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-xs md:text-sm font-extrabold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 4. Sub-Tab 1: Dual Workspace (Left: Pure CRM Form vs Right: Sticky Action Dock) ── */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-12 gap-5 items-start">
          
          {/* ============================================================ */}
          {/* [영역 1] 순수 고객 입력 정보 허브 (Col 1~8 / 12, 약 67%)      */}
          {/* ============================================================ */}
          <div className="col-span-12 xl:col-span-8 bg-slate-50/60 rounded-3xl border border-slate-200 p-4 md:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h2 className="font-extrabold text-slate-900 text-sm md:text-base">
                  고객 상황 및 채무 입력 정보 (CRM 폼)
                </h2>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">직접 수정 가능</span>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-extrabold border transition-all ${
                isSavedPulsing 
                  ? 'bg-emerald-600 text-white border-emerald-600 scale-105 shadow-sm'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
              }`}>
                ✓ 실시간 자동 저장
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              
              {/* 좌측 폼 열: 1. 기본 인적사항, 2. 직업/소득/가족, 3. 주거 형태 */}
              <div className="space-y-4">
                
                {/* ── CARD 1: 🔵 기본 인적사항 및 접수 ── */}
                <div className="bg-white rounded-2xl border-2 border-blue-200/90 shadow-2xs overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50/40 px-4 py-2.5 border-b border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        1
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        기본 인적사항 및 접수
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                      접수: {currentLead.createdAt ? currentLead.createdAt.slice(0, 10) : '-'}
                    </span>
                  </div>

                  <div className="p-4 space-y-3.5 text-xs">
                    {/* 거래처 & 유입경로 (2열) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          거래처 (법률사무소)
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                          value={currentLead.partnerId || ''}
                          onChange={e => handleFieldUpdate('partnerId', e.target.value)}
                        >
                          <option value="">거래처 선택 (기본)</option>
                          {partners.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          유입 경로
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                          value={currentLead.inboundPath || ''}
                          onChange={e => handleFieldUpdate('inboundPath', e.target.value)}
                        >
                          <option value="">유입경로 선택</option>
                          {inboundPaths.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 사전 고객 정보 (리드 수집 정보) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                        <AlertCircle size={13} className="text-blue-500" />
                        <span>사전 고객 정보 (웹 리드 수집)</span>
                      </label>
                      <textarea
                        value={currentLead.preInfo || ''}
                        onChange={e => handleFieldUpdate('preInfo', e.target.value)}
                        placeholder="사전 인입 폼 데이터 (예: 채무 5,000만, 실급여 250만 등)"
                        rows={2}
                        className="w-full p-2.5 border border-indigo-100 rounded-xl text-xs bg-indigo-50/40 text-slate-800 outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* 사건 유형 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">사건 유형</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['개인회생', '개인파산', '새출발기금', '신용회복'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleFieldUpdate('caseType', opt)}
                            className={`py-1.5 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                              currentLead.caseType === opt
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {opt === '새출발기금' ? '새출발' : opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 이름 & 연락처 (2열) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">이름</label>
                        <input
                          type="text"
                          value={currentLead.customerName || ''}
                          onChange={e => handleFieldUpdate('customerName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">연락처</label>
                        <input
                          type="text"
                          value={currentLead.phone || ''}
                          onChange={e => handleFieldUpdate('phone', formatPhone(e.target.value))}
                          placeholder="010-0000-0000"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                        />
                      </div>
                    </div>

                    {/* 출생년도 & 성별 (2열) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">출생년도 (4자리 또는 2자리)</label>
                        <input
                          type="text"
                          value={currentLead.birth || ''}
                          onChange={e => handleFieldUpdate('birth', e.target.value)}
                          onBlur={() => {
                            const normalized = normalizeBirthYear(currentLead.birth);
                            if (normalized !== currentLead.birth) handleFieldUpdate('birth', normalized);
                          }}
                          placeholder="예: 85 또는 1985"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">성별</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {['남', '여'].map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => handleFieldUpdate('gender', g)}
                              className={`py-2 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                                currentLead.gender === g
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CARD 2: 🟢 직업 · 소득 및 부양가족 ── */}
                <div className="bg-white rounded-2xl border-2 border-emerald-200/90 shadow-2xs overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50/40 px-4 py-2.5 border-b border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        2
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        직업 · 소득 및 부양가족
                      </h3>
                    </div>
                    {currentLead.incomeNet > 0 && (
                      <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded font-extrabold">
                        월 소득: {currentLead.incomeNet.toLocaleString()}만원
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-3.5 text-xs">
                    {/* 직업 형태 (복수선택 가능) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        직업 형태 (복수 선택 가능)
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {JOB_TYPES.map(j => {
                          const isSelected = (currentLead.jobTypes || []).includes(j);
                          return (
                            <button
                              key={j}
                              type="button"
                              onClick={() => {
                                const current = currentLead.jobTypes || [];
                                const next = isSelected 
                                  ? current.filter(x => x !== j)
                                  : [...current, j];
                                handleFieldUpdate('jobTypes', next);
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {j}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 월 실수령액 (만원) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        월 세후 소득 (실수령액)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={currentLead.incomeNet || ''}
                          onChange={e => handleFieldUpdate('incomeNet', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-12 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">만원</span>
                      </div>
                    </div>

                    {/* 4대보험 & 결혼여부 (2열) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">4대보험</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {['가입', '미가입'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleFieldUpdate('insurance4', opt)}
                              className={`py-1.5 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                                currentLead.insurance4 === opt
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">결혼여부</label>
                        <div className="grid grid-cols-3 gap-1">
                          {['미혼', '기혼', '이혼'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleFieldUpdate('maritalStatus', opt)}
                              className={`py-1.5 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                                currentLead.maritalStatus === opt
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 미성년 자녀 수 (기혼/이혼 시) */}
                    {currentLead.maritalStatus !== '미혼' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          미성년 자녀 수
                        </label>
                        <div className="flex gap-1 flex-wrap">
                          {[0, 1, 2, 3, 4, 5].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleFieldUpdate('childrenCount', num)}
                              className={`flex-1 min-w-[42px] py-1.5 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                                currentLead.childrenCount === num
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {num}명
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── CARD 3: 🟠 주거 형태 및 주거비 ── */}
                <div className="bg-white rounded-2xl border-2 border-amber-200/90 shadow-2xs overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50/40 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        3
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        주거 형태 및 주거비
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                      {currentLead.housingType || '미지정'} {currentLead.housingDetail && `(${currentLead.housingDetail})`}
                    </span>
                  </div>

                  <div className="p-4 space-y-3.5 text-xs">
                    {/* 거주형태 & 주거상세 (2열) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">거주형태</label>
                        <div className="grid grid-cols-2 gap-1">
                          {HOUSING_TYPES.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleFieldUpdate('housingType', opt)}
                              className={`py-1.5 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                                currentLead.housingType === opt
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">주거상세</label>
                        <select
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
                          value={currentLead.housingDetail || ''}
                          onChange={e => handleFieldUpdate('housingDetail', e.target.value)}
                        >
                          <option value="">주거형태 선택</option>
                          {HOUSING_DETAILS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* 거주형태별 조건부 상세 블록 */}
                    {currentLead.housingType === '자가' ? (
                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">집 시세 (만원)</label>
                            <input
                              type="number"
                              value={currentLead.ownHousePrice || ''}
                              onChange={e => handleFieldUpdate('ownHousePrice', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">집 담보 대출 (만원)</label>
                            <input
                              type="number"
                              value={currentLead.ownHouseLoan || ''}
                              onChange={e => handleFieldUpdate('ownHouseLoan', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-hidden"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">집 명의자</label>
                          <div className="flex gap-1.5">
                            {['본인', '배우자', '배우자 공동명의'].map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleFieldUpdate('ownHouseOwner', opt)}
                                className={`flex-1 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                                  currentLead.ownHouseOwner === opt
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : currentLead.housingType === '무상거주' ? (
                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">집 명의자 (무상제공자)</label>
                        <div className="flex gap-1.5">
                          {FREE_HOUSING_OWNERS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleFieldUpdate('freeHousingOwner', opt)}
                              className={`flex-1 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                                currentLead.freeHousingOwner === opt
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-white text-slate-700 border-slate-200'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">보증금 (만원)</label>
                            <input
                              type="number"
                              value={currentLead.deposit || ''}
                              onChange={e => handleFieldUpdate('deposit', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">보증금 대출 (만원)</label>
                            <input
                              type="number"
                              value={currentLead.depositLoanAmount || ''}
                              onChange={e => handleFieldUpdate('depositLoanAmount', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-hidden"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">월세 (만원)</label>
                          <input
                            type="number"
                            value={currentLead.rent || ''}
                            onChange={e => handleFieldUpdate('rent', Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">임대차 계약인</label>
                          <div className="flex gap-2">
                            {RENT_CONTRACTORS.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleFieldUpdate('rentContractor', opt)}
                                className={`flex-1 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                                  currentLead.rentContractor === opt
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 거주지역 (관할법원 연계) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">거주지역 (관할법원 연계)</label>
                      <input
                        type="text"
                        value={currentLead.region || ''}
                        onChange={e => handleFieldUpdate('region', e.target.value)}
                        placeholder="예: 서울 강남 / 수원 팔달 / 부산 해운대"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* 우측 폼 열: 4. 자산 및 부채 관리, 5. 과거 이력 & 상태 변경 기록 */}
              <div className="space-y-4">
                
                {/* ── CARD 4: 🔴 자산 및 부채 관리 ── */}
                <div className="bg-white rounded-2xl border-2 border-rose-200/90 shadow-2xs overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-50 to-pink-50/40 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        4
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        자산 및 부채 관리
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded">
                      대출 {currentLead.creditLoans?.length || 0}건 | 자산 {currentLead.assets?.length || 0}건
                    </span>
                  </div>

                  <div className="p-4 space-y-3.5 text-xs">
                    {/* 4-A: 보유 자산 목록 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>🚗 보유 자산 목록</span>
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.2 rounded-full text-[11px] font-bold">
                            {currentLead.assets?.length || 0}건
                          </span>
                        </span>
                      </div>

                      {/* 등록된 자산 리스트 */}
                      <div className="space-y-1.5 mb-2.5 max-h-40 overflow-y-auto pr-1">
                        {(!currentLead.assets || currentLead.assets.length === 0) ? (
                          <p className="text-xs text-slate-400 text-center py-2.5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            등록된 자산이 없습니다.
                          </p>
                        ) : (
                          currentLead.assets.map((asset: AssetItem) => (
                            <div key={asset.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 truncate">
                                  <span className="text-blue-600 font-bold mr-1">[{asset.owner}]</span>
                                  <span>{asset.type}</span>
                                  {asset.desc && <span className="text-slate-400 font-normal ml-1">({asset.desc})</span>}
                                </div>
                                <div className="flex gap-2.5 text-xs text-slate-600 mt-0.5">
                                  <span>시세: <b>{asset.amount > 0 ? `${asset.amount.toLocaleString()}만` : '0'}</b></span>
                                  {asset.loanAmount > 0 && <span className="text-rose-600 font-bold">담보: {asset.loanAmount.toLocaleString()}만</span>}
                                </div>
                              </div>
                              <button 
                                type="button"
                                onClick={() => handleRemoveAsset(asset.id)} 
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* 자산 인라인 추가 박스 */}
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-800 outline-hidden"
                            value={newAsset.owner}
                            onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}
                          >
                            {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <select
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-800 outline-hidden"
                            value={newAsset.type}
                            onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                          >
                            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="시세 (만원)"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 outline-hidden"
                            value={newAsset.amount || ''}
                            onChange={e => setNewAsset({ ...newAsset, amount: Number(e.target.value) })}
                          />
                          <input
                            type="number"
                            placeholder="담보대출 (만원)"
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 outline-hidden"
                            value={newAsset.loanAmount || ''}
                            onChange={e => setNewAsset({ ...newAsset, loanAmount: Number(e.target.value) })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="상세 설명 (차종, 지목 등)"
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 outline-hidden"
                            value={newAsset.desc || ''}
                            onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={handleAddAsset}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>추가</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 4-B: 신용대출 목록 */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>💳 신용대출 내역</span>
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.2 rounded-full text-[11px] font-bold">
                            {currentLead.creditLoans?.length || 0}건
                          </span>
                        </span>
                      </div>

                      {/* 등록된 신용대출 리스트 */}
                      <div className="space-y-1.5 mb-2.5 max-h-36 overflow-y-auto pr-1">
                        {(!currentLead.creditLoans || currentLead.creditLoans.length === 0) ? (
                          <p className="text-xs text-slate-400 text-center py-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            등록된 신용대출이 없습니다.
                          </p>
                        ) : (
                          currentLead.creditLoans.map((loan: CreditLoanItem) => (
                            <div key={loan.id} className="bg-rose-50/50 p-2.5 rounded-xl border border-rose-200/70 flex justify-between items-center text-xs">
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-slate-900">{loan.desc || '신용대출'}</span>
                                <span className="text-rose-600 font-extrabold ml-2">
                                  {loan.amount > 0 ? `${loan.amount.toLocaleString()}만원` : '0원'}
                                </span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveCreditLoan(loan.id)} 
                                className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* 신용대출 인라인 추가 바 */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="대출처 (예: 햇살론, 카카오)"
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 outline-hidden"
                          value={newCreditLoan.desc || ''}
                          onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                        />
                        <input
                          type="number"
                          placeholder="금액(만원)"
                          className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 outline-hidden text-right font-bold"
                          value={newCreditLoan.amount || ''}
                          onChange={e => setNewCreditLoan({ ...newCreditLoan, amount: Number(e.target.value) })}
                        />
                        <button
                          type="button"
                          onClick={handleAddCreditLoan}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>추가</span>
                        </button>
                      </div>
                    </div>

                    {/* 담보대출 자동 집계 배너 */}
                    <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs">
                      <span className="font-bold text-indigo-700">담보대출 자동 집계: </span>
                      <span className="text-slate-700 font-medium">{autoCollateralString}</span>
                    </div>

                    {/* 신용카드 사용 & 사용금액 (2열) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">신용카드 사용</label>
                        <div className="grid grid-cols-2 gap-1">
                          {['사용', '미사용'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleFieldUpdate('creditCardUse', opt)}
                              className={`py-1.5 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                                currentLead.creditCardUse === opt
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {currentLead.creditCardUse === '사용' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">카드 사용 금액 (만원)</label>
                          <input
                            type="number"
                            value={currentLead.creditCardAmount || ''}
                            onChange={e => handleFieldUpdate('creditCardAmount', Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white outline-hidden"
                          />
                        </div>
                      )}
                    </div>

                    {/* 총 채무액 & 월 대출 상환액 (2열) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">총 채무액 (만원)</label>
                        <input
                          type="number"
                          value={currentLead.debtTotal || ''}
                          onChange={e => handleFieldUpdate('debtTotal', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-rose-600 bg-white outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">월 총 대출 상환액 (만원)</label>
                        <input
                          type="number"
                          value={currentLead.loanMonthlyPay || ''}
                          onChange={e => handleFieldUpdate('loanMonthlyPay', Number(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-amber-700 bg-white outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CARD 5: 🟣 과거 이력 및 상태 변경 기록 ── */}
                <div className="bg-white rounded-2xl border-2 border-indigo-200/90 shadow-2xs overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50/40 px-4 py-2.5 border-b border-indigo-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        5
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        과거 이력 및 상태 변경 기록
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700">
                      히스토리 관리
                    </span>
                  </div>

                  <div className="p-4 space-y-3.5 text-xs">
                    {/* 회생 / 파산 / 회복 과거 이력 */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        회생 / 파산 / 회복 과거 이력
                      </label>
                      <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {HISTORY_TYPES.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleFieldUpdate('historyType', opt)}
                            className={`py-1.5 text-xs rounded-xl font-bold transition-all border cursor-pointer ${
                              currentLead.historyType === opt
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      {currentLead.historyType && currentLead.historyType !== '없음' && (
                        <textarea
                          className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 outline-hidden focus:ring-2 focus:ring-indigo-500 h-20 leading-relaxed resize-none"
                          value={currentLead.historyMemo || ''}
                          onChange={e => handleFieldUpdate('historyMemo', e.target.value)}
                          placeholder="이력 상세 내용을 입력하세요. (사건번호, 법원, 면책여부, 실패사유 등)"
                        />
                      )}
                    </div>

                    {/* 상태 변경 이력 타임라인 (최근 5건) */}
                    {currentLead.statusLogs && currentLead.statusLogs.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                          <CalendarClock size={14} className="text-indigo-600" />
                          <span>상태 변경 타임라인</span>
                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            {currentLead.statusLogs.length}건
                          </span>
                        </label>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {currentLead.statusLogs.slice(0, 5).map(log => (
                            <div key={log.logId} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 line-through text-[11px] px-1.5 py-0.5 bg-slate-200 rounded">{log.fromStatus}</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="font-bold text-indigo-600 text-xs px-2 py-0.5 bg-indigo-50 rounded border border-indigo-200">{log.toStatus}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">{log.changedAt.slice(2, 16).replace('T', ' ')}</span>
                              </div>
                              {log.memo && (
                                <p className="text-slate-600 text-[11px] bg-white p-1.5 rounded-lg border border-slate-100 mt-1">
                                  {log.memo}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* ============================================================ */}
          {/* [영역 2] 업무 액션 & 리마인더 & 상담이력 독 (Col 9~12, Sticky)  */}
          {/* ============================================================ */}
          <div className="col-span-12 xl:col-span-4 space-y-4 xl:sticky xl:top-24">
            
            {/* 우측 독 탭 스위처 (리마인더 vs AI 통화 요약) */}
            <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setDockTab('reminders')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  dockTab === 'reminders'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar size={13} className={dockTab === 'reminders' ? 'text-amber-500' : 'text-slate-400'} />
                <span>리마인더 & 이력</span>
                {(currentLead.reminders || []).filter(r => !r.isCompleted).length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                    {(currentLead.reminders || []).filter(r => !r.isCompleted).length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDockTab('ai_summary')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  dockTab === 'ai_summary'
                    ? 'bg-white text-purple-900 shadow-xs'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                <Sparkles size={13} className={dockTab === 'ai_summary' ? 'text-purple-600' : 'text-slate-400'} />
                <span>AI 요약 & 대화록</span>
                {currentLead.aiSummary && (
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                )}
              </button>
            </div>

            {dockTab === 'ai_summary' ? (
              <CaseDetailAiSummary
                lead={currentLead}
                onUpdateLead={persistLead}
              />
            ) : (
              /* 리마인더 & 상담 이력 카드 */
              <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      📅 리마인더 및 상담 이력
                    </h3>
                  </div>
                  {(currentLead.reminders || []).filter(r => !r.isCompleted).length > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                      대기 {(currentLead.reminders || []).filter(r => !r.isCompleted).length}건
                    </span>
                  )}
                </div>

              {/* 1. 다음 일정 등록 */}
              <div className="space-y-2.5 p-3 bg-amber-50/50 rounded-2xl border border-amber-200/70">
                <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1">
                  <Calendar size={13} className="text-amber-600" />
                  다음 통화 / 미팅 일정 등록
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={remDate}
                    onChange={e => setRemDate(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white outline-hidden"
                  />
                  <div className="flex gap-1 items-center">
                    <select
                      value={remHour}
                      onChange={e => setRemHour(e.target.value)}
                      className="flex-1 px-1.5 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white outline-hidden"
                    >
                      {Array.from({ length: 14 }, (_, i) => String(i + 8).padStart(2, '0')).map(h => (
                        <option key={h} value={h}>{h}시</option>
                      ))}
                    </select>
                    <select
                      value={remMinute}
                      onChange={e => setRemMinute(e.target.value)}
                      className="flex-1 px-1.5 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white outline-hidden"
                    >
                      {['00', '10', '20', '30', '40', '50'].map(m => (
                        <option key={m} value={m}>{m}분</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <select
                    value={remType}
                    onChange={e => setRemType(e.target.value as ReminderType)}
                    className="w-24 px-2 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white outline-hidden"
                  >
                    {['통화', '출장미팅', '방문미팅', '입금', '문자', '기타'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="메모 (예: 회생 절차 서류 안내)"
                    value={remContent}
                    onChange={e => setRemContent(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddReminder}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Plus size={13} />
                    <span>추가</span>
                  </button>
                </div>

                {/* ⚡ 빠른 선택 버튼군 */}
                <div className="pt-1.5 border-t border-amber-200/60 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-amber-800 font-bold flex items-center gap-0.5 mr-1">
                    <Zap size={12} className="text-amber-600" />
                    빠른선택:
                  </span>
                  {[
                    { label: '내일', days: 1 },
                    { label: '모레', days: 2 },
                    { label: '일주일', days: 7 },
                    { label: '이주일', days: 14 },
                    { label: '한달', days: 30 },
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleQuickAddReminder(p.days, p.label)}
                      className="px-2 py-0.5 text-[11px] font-bold bg-white text-amber-800 border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. 등록된 리마인더 목록 */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  예약된 리마인더 ({currentLead.reminders?.length || 0}건)
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {(!currentLead.reminders || currentLead.reminders.length === 0) ? (
                    <p className="text-xs text-slate-400 text-center py-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      등록된 예약 일정이 없습니다.
                    </p>
                  ) : (
                    currentLead.reminders.map((r: ReminderItem) => (
                      <div
                        key={r.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                          r.isCompleted
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-amber-50/40 border-amber-200/80 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={r.isCompleted}
                            onChange={() => handleToggleReminderCompleted(r.id)}
                            className="w-4 h-4 text-amber-600 rounded-md cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-800">{r.datetime}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                {r.type}
                              </span>
                            </div>
                            <p className={`text-slate-600 truncate mt-0.5 ${r.isCompleted ? 'line-through text-slate-400' : ''}`}>
                              {r.content || '일정'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteReminder(r.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. 상담 특이사항 실시간 작성 */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-blue-600" />
                  실시간 상담 내용 추가
                </span>
                <textarea
                  value={newMemoInput}
                  onChange={e => setNewMemoInput(e.target.value)}
                  placeholder="고객과의 통화 내용, 채무 발생 사유, 면책 가능성 등을 입력하세요..."
                  rows={3}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden resize-none leading-relaxed"
                />
                <button
                  type="button"
                  onClick={handleAddConsultMemo}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer press-scale active:scale-[0.98]"
                >
                  <Send size={13} />
                  <span>상담 내용 추가</span>
                </button>
              </div>

              {/* 4. 누적 상담 메모 이력 */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  누적 상담 메모 이력 ({currentLead.memos?.length || 0}건)
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(!currentLead.memos || currentLead.memos.length === 0) ? (
                    <p className="text-xs text-slate-400 text-center py-2.5 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      등록된 상담 메모가 없습니다.
                    </p>
                  ) : (
                    currentLead.memos.map((m: LeadMemoItem) => (
                      <div key={m.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-bold text-slate-600">{m.authorName || '상담원'}</span>
                          <div className="flex items-center gap-2">
                            <span>{m.createdAt.slice(2, 16).replace('T', ' ')}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMemo(m.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {m.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
            )}

          </div>

        </div>
      )}

      {/* ── 5. Sub-Tab 2: 상태 변경 타임라인 ── */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarClock size={18} className="text-indigo-600" />
                상태 전이 및 변경 타임라인
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                신규 인입부터 부재중, 상담중, 고객 전환까지 모든 상태 변경 내역을 추적합니다.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(!currentLead.statusLogs || currentLead.statusLogs.length === 0) ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                기록된 상태 전이 이력이 없습니다.
              </div>
            ) : (
              currentLead.statusLogs.map((log, idx) => (
                <div key={log.logId || idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="line-through text-slate-400 text-xs">{log.fromStatus}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-black text-indigo-700 text-xs px-2 py-0.5 bg-indigo-50 rounded-lg border border-indigo-200">
                          {log.toStatus}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {log.changedAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    {log.memo && (
                      <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 mt-1.5">
                        {log.memo}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 6. Sub-Tab 3: 통화 및 문자 실시간 타임라인 & 문자 발송 ── */}
      {activeTab === 'calls' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-6 shadow-xs">
          <CaseCallsSmsTab
            lead={currentLead}
            onUpdateLead={persistLead}
          />
        </div>
      )}

    </div>
  );
}
