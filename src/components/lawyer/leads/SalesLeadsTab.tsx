import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Phone, PhoneCall, Plus, Upload, Settings, EyeOff, Search, 
  Clock, AlertTriangle, CheckCircle2, Sparkles, Filter, MoreHorizontal,
  ChevronDown, ChevronUp, Calendar, Send, Trash2, ArrowRight, MessageSquare,
  ShieldCheck, RefreshCw, PhoneForwarded, Flame, UserCheck, ExternalLink, Edit3,
  CalendarClock, X, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { SalesLead } from '../../../types/leadTypes';
import { LEAD_STATUS_CONFIG, LEAD_CLOSE_REASON_LABEL } from '../../../types/leadTypes';
import { isTodayQueue, queueBucket, sortQueue } from '../../../services/sales/leadRules';
import { loadSalesSettings, subscribeSalesSettings } from '../../../services/sales/salesSettingsService';
import { getCachedVendors, listVendors, subscribeVendors } from '../../../services/sales/salesVendorService';
import LeadOutcomeModal from './LeadOutcomeModal';
import SalesVendorsModal from './SalesVendorsModal';
import SalesStatsModal from './SalesStatsModal';
import type { User, StaffMember, ConsultRequest, CrmClientExtension } from '../../../types';
import { 
  loadSalesLeads, saveSalesLeads, saveSalesLead, deleteSalesLead, 
  bulkInsertLeads,
  subscribeSalesLeads, syncSalesLeadsFromServer, getSalesLeadSyncState
} from '../../../services/leadService';
import { loadInboundPaths } from '../../../services/settingsService';
import { sendQuickSmsOrCopy } from '../../../services/communicationService';
import { useDialog } from '../../common/DialogProvider';
import { listOfficeMembers, type OfficeMember } from '../../../services/office/officeService';
import { supabase, isSupabaseConfigured } from '../../../supabaseClient';
import { localYmd } from '../../../utils/localDate';

import SalesLeadDetailView from './SalesLeadDetailView';
import NewLeadModal from './NewLeadModal';
import ImportLeadsModal from './ImportLeadsModal';
import LeadConversionModal from './LeadConversionModal';
import SalesSettingsModal from './SalesSettingsModal';
import LeadIntakeSourcesModal from './LeadIntakeSourcesModal';

const fmtWhen = (iso?: string) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

interface SalesLeadsTabProps {
  activeLawyer: User;
  staffMembers: StaffMember[];
  lawyers: User[];
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  onNavigateToCrm?: (clientId: string) => void;
  /** 서버 사무소 ID (담당자 목록·배정) */
  officeId?: string;
  /** 리드 배정 권한 (sales.manage) */
  canAssignLeads?: boolean;
  /** 서버 사무소 권한표 (소통 기록) */
  officePermissions?: Record<string, string> | null;
}

// 오늘 할 일 + 상태 6개 + 전체 (SL-4)
export type SalesLeadTabStatus = 'today' | 'all' | 'new' | 'no_answer' | 'callback' | 'counseling' | 'converted' | 'closed';

export default function SalesLeadsTab({
  activeLawyer,
  staffMembers,
  lawyers,
  requests,
  setRequests,
  onNavigateToCrm,
  officeId,
  canAssignLeads = false,
  officePermissions,
}: SalesLeadsTabProps) {
  const dialog = useDialog();
  const [leads, setLeads] = useState<SalesLead[]>(() => loadSalesLeads());
  // 리드 원본은 서버(sales_leads). 탭을 열 때 다시 읽고, 서버 값이 바뀌면 목록을 갈아 끼운다
  const [syncState, setSyncState] = useState(() => getSalesLeadSyncState());
  useEffect(() => {
    const unsub = subscribeSalesLeads(() => {
      setLeads(loadSalesLeads());
      setSyncState(getSalesLeadSyncState());
    });
    void syncSalesLeadsFromServer();
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<SalesLeadTabStatus>('today');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [closeReasonFilter, setCloseReasonFilter] = useState<string>('all');
  const [isVendorsOpen, setIsVendorsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  // 영업 설정·거래처는 서버 값 (SL-12·SL-15)
  const [, setSettingsTick] = useState(0);
  const [vendors, setVendors] = useState(() => getCachedVendors());
  useEffect(() => {
    const u1 = subscribeSalesSettings(() => setSettingsTick(t => t + 1));
    const u2 = subscribeVendors(() => setVendors(getCachedVendors()));
    if (officeId) {
      void loadSalesSettings(officeId).then(r => { if (r.ok === false) toast.error(`영업 설정을 불러오지 못했어요: ${r.message}`); });
      void listVendors(officeId);
    }
    return () => { u1(); u2(); };
  }, [officeId]);
  // 1분마다 대기열 시각 다시 판정
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNowTick(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  const [selectedPath, setSelectedPath] = useState<string>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  // 담당자 (SL-3): 사무소 구성원 중 배정, '내 담당만' 보기
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [myUserId, setMyUserId] = useState<string>('');
  const [onlyMine, setOnlyMine] = useState(false);
  useEffect(() => {
    if (!officeId || !isSupabaseConfigured) return;
    let cancelled = false;
    listOfficeMembers(officeId).then(r => { if (!cancelled && r.ok) setMembers(r.data.filter(m => m.status === 'active')); });
    supabase.auth.getUser().then(({ data }) => { if (!cancelled) setMyUserId(data.user?.id || ''); });
    return () => { cancelled = true; };
  }, [officeId]);
  const assignLead = (lead: SalesLead, userId: string) => {
    const m = members.find(x => x.userId === userId);
    const updated: SalesLead = { ...lead, assigneeUserId: userId || undefined, assigneeId: m?.id || undefined, assigneeName: m?.displayName || undefined, updatedAt: new Date().toISOString() };
    saveSalesLead(updated);
    setLeads(prev => prev.map(l => (l.id === lead.id ? updated : l)));
    toast.success(m ? `${lead.customerName}님 담당을 ${m.displayName}님으로 정했습니다.` : '담당자를 비웠습니다.');
  };

  // 모달 상태
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [conversionTargetLead, setConversionTargetLead] = useState<SalesLead | null>(null);

  // 통화 결과 등록 모달 상태 (기획서: 행의 '통화 결과' 버튼 하나로 기록)
  const [callModalTargetLead, setCallModalTargetLead] = useState<SalesLead | null>(null);

  // 행별 더보기 메뉴 열림 상태
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const selectedLead = useMemo(() => {
    return leads.find(l => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  const inboundPaths = useMemo(() => loadInboundPaths(), [isSettingsModalOpen]);

  // 필터링된 리드 목록 (기획서 4.7 5대 탭)
  const filteredLeads = useMemo(() => {
    const now = new Date(nowTick);
    const list = leads.filter(l => {
      // 1. 검색어 필터
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = (l.customerName || '').toLowerCase().includes(term);
        const matchPhone = (l.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        const matchRegion = (l.region || '').toLowerCase().includes(term);
        const matchMemo = (l.specialMemo || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone && !matchRegion && !matchMemo) return false;
      }

      // 1-1. 내 담당만
      if (onlyMine && myUserId && l.assigneeUserId !== myUserId) return false;

      // 2. 인입 경로 필터
      if (selectedPath !== 'all' && l.inboundPath !== selectedPath) {
        return false;
      }

      // 3. 거래처
      if (selectedVendor !== 'all' && (selectedVendor === 'none' ? !!l.vendorId : l.vendorId !== selectedVendor)) return false;

      // 4. 상태 탭
      if (selectedStatus === 'today') return isTodayQueue(l, now);
      if (selectedStatus !== 'all' && l.status !== selectedStatus) return false;
      if (selectedStatus === 'closed' && closeReasonFilter !== 'all' && l.closeReason !== closeReasonFilter) return false;

      return true;
    });
    return selectedStatus === 'today' ? sortQueue(list, now) : list;
  }, [leads, searchTerm, selectedStatus, selectedPath, selectedVendor, closeReasonFilter, onlyMine, myUserId, nowTick]);

  // 상태 카운트 집계
  const statusCounts = useMemo(() => {
    const now = new Date(nowTick);
    const c: Record<SalesLeadTabStatus, number> = { today: 0, all: leads.length, new: 0, no_answer: 0, callback: 0, counseling: 0, converted: 0, closed: 0 };
    leads.forEach(l => {
      if (isTodayQueue(l, now)) c.today++;
      if (l.status in c) c[l.status as SalesLeadTabStatus]++;
    });
    return c;
  }, [leads, nowTick]);
  const vendorName = (id?: string) => (id ? vendors.find(v => v.id === id)?.name || '거래처' : '');

  // 리드 삭제
  const handleDelete = async (leadId: string, name: string) => {
    const confirmed = await dialog.confirm({
      title: '영업 리드 삭제',
      message: `${name} 고객 리드를 휴지통으로 옮길까요? 30일 뒤 완전히 지워져요.`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    });
    if (confirmed) {
      deleteSalesLead(leadId);
      setLeads(prev => prev.filter(l => l.id !== leadId));
      toast.success('영업 리드가 삭제되었습니다.');
    }
  };

  // 고객 승격 완료 콜백
  const handleConverted = (newRequest: ConsultRequest, newExt: CrmClientExtension, updatedLead: SalesLead) => {
    // 서버 사건('case-…')은 사건 관리 목록이 서버에서 다시 읽는다 — 화면 메모리 상담 요청을 만들지 않는다
    if (!newRequest.id.startsWith('case-')) setRequests(prev => [newRequest, ...prev]);
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? { ...updatedLead } : l));
  };

  // 상세 뷰 열림 시
  if (selectedLead) {
    return (
      <div className="animate-fadeIn pb-16">
        <SalesLeadDetailView
          lead={selectedLead}
          activeLawyer={activeLawyer}
          staffMembers={staffMembers}
          lawyers={lawyers}
          onBack={() => setSelectedLeadId(null)}
          onUpdateLead={(updated) => {
            setLeads(prev => prev.map(l => l.id === updated.id ? { ...updated } : l));
          }}
          onPromoteToClient={(l) => setConversionTargetLead(l)}
          onNavigateToCrm={onNavigateToCrm}
          officeId={officeId}
          officePermissions={officePermissions}
        />

        <LeadConversionModal
          isOpen={!!conversionTargetLead}
          onClose={() => setConversionTargetLead(null)}
          lead={conversionTargetLead}
          activeLawyer={activeLawyer}
          staffMembers={staffMembers}
          lawyers={lawyers}
          onConverted={handleConverted}
          onNavigateToCrm={onNavigateToCrm}
          existingRequests={requests}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn pb-16">
      {!syncState.loaded && (
        <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" aria-label="영업 DB 불러오는 중" />
      )}
      {syncState.error && (
        <div role="alert" className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{syncState.error}</span>
          <button onClick={() => void syncSalesLeadsFromServer()} className="px-3 py-2 rounded-xl bg-white border border-rose-300 font-bold whitespace-nowrap cursor-pointer active:scale-[0.98]">다시 불러오기</button>
        </div>
      )}
      {/* ── 1. 헤더: 타이틀 + 주요 액션 버튼 (신규 등록, 엑셀 업로드, 설정) ── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase bg-blue-50 text-[#1E3A5F] px-2.5 py-0.5 rounded-md">
              영업 DB 큐
            </span>
            <span className="text-xs text-slate-400">· 인입 DB 격리 보관 및 통화 결과 관리</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-[#1E3A5F]" />
            <span>영업 DB 관리</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedStatus('today')}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
          >
            <Clock className="w-3.5 h-3.5" /> 오늘 할 일 {statusCounts.today}건
          </button>
          {officeId && (
            <button type="button" onClick={() => setIsStatsOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap">통계</button>
          )}
          {officeId && (
            <button type="button" onClick={() => setIsVendorsOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap">거래처(광고대행사)</button>
          )}
          {officeId && canAssignLeads && (
            <button
              type="button"
              onClick={() => setIsIntakeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
            >
              자동 접수 주소
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98]"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>경로/환경 설정</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>엑셀 대량 등록</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>단건 DB 등록</span>
          </button>
        </div>
      </div>

      {/* ── 2. 상태 탭 5종 + 검색/유입경로 툴바 (기획서 4.7) ── */}
      {/* 상태 탭: 신규 · 재통화 예정 · 부재 · 상담 중 · 이관 완료 (+ 전체) */}
      <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold scrollbar-none">
          {([
            { id: 'today', label: '오늘 할 일' },
            { id: 'all', label: '전체' },
            { id: 'new', label: '신규' },
            { id: 'no_answer', label: '부재' },
            { id: 'callback', label: '재통화 약속' },
            { id: 'counseling', label: '상담 중' },
            { id: 'converted', label: '이관 완료' },
            { id: 'closed', label: '종료' },
          ] as Array<{ id: SalesLeadTabStatus; label: string }>).map(t => ({ ...t, count: statusCounts[t.id] })).map(tab => {
            const isSelected = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-[#1E3A5F] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 검색 및 인입경로 */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="고객명, 연락처, 지역, 메모..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 text-slate-900 placeholder-slate-400"
            />
          </div>

          {selectedStatus === 'closed' && (
            <select aria-label="종료 사유" value={closeReasonFilter} onChange={e => setCloseReasonFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer">
              <option value="all">종료 사유: 전체</option>
              {Object.entries(LEAD_CLOSE_REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          {vendors.length > 0 && (
            <select aria-label="거래처" value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer">
              <option value="all">거래처: 전체</option>
              <option value="none">자체 광고</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {myUserId && members.length > 0 && (
            <button type="button" onClick={() => setOnlyMine(v => !v)} aria-pressed={onlyMine} className={`px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer active:scale-[0.98] ${onlyMine ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>내 담당만</button>
          )}
          <select
            value={selectedPath}
            onChange={e => setSelectedPath(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">유입경로: 전체</option>
            {inboundPaths.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 3. 영업 DB 테이블 (기획서 4.7: 아코디언 대신 표 형태 + 행별 통화 결과 버튼) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-black text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-[22%]">고객명 (연락처)</th>
                <th className="py-3.5 px-3 w-[15%]">유입 경로 / 등록일</th>
                <th className="py-3.5 px-3 w-[18%] text-right">채무 / 월소득</th>
                <th className="py-3.5 px-3 w-[13%] text-center">상태</th>
                <th className="py-3.5 px-3 w-[14%] text-center">다음 연락</th>
                <th className="py-3.5 px-4 w-[18%] text-center">관리 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-bold text-slate-600">{selectedStatus === 'today' ? '오늘 연락할 리드가 없어요.' : '조건에 맞는 리드가 없어요.'}</p>
                    <p className="text-xs text-slate-500">리드를 등록하거나 '자동 접수 주소'로 광고 리드를 받아 보세요. 검색·필터를 바꿔 볼 수도 있어요.</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => {
                  const statusConfig = LEAD_STATUS_CONFIG[lead.status] || LEAD_STATUS_CONFIG.new;

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. 고객명 (연락처 한 줄) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span 
                            onClick={() => setSelectedLeadId(lead.id)}
                            className="font-bold text-sm text-slate-900 hover:text-blue-700 hover:underline cursor-pointer"
                            title="고객 상세 패널 열기"
                          >
                            {lead.customerName}
                          </span>
                          {lead.region && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                              {lead.region}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                          <span>{lead.phone}</span>
                        </div>
                        {members.length > 0 && (
                          canAssignLeads ? (
                            <select
                              aria-label={`${lead.customerName} 담당자`}
                              value={lead.assigneeUserId || ''}
                              onChange={(e) => assignLead(lead, e.target.value)}
                              className="mt-1 max-w-[180px] text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700"
                            >
                              <option value="">담당자 없음</option>
                              {members.map(m => <option key={m.id} value={m.userId}>{m.displayName}</option>)}
                            </select>
                          ) : (
                            <span className="mt-1 inline-block text-xs text-slate-500">담당: {lead.assigneeName || '없음'}</span>
                          )
                        )}
                      </td>

                      {/* 2. 유입 경로 / 등록일 */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800 text-xs block">
                          {lead.inboundPath || '직접 등록'}
                        </span>
                        {lead.vendorId && <span className="text-[11px] text-slate-500 block">{vendorName(lead.vendorId)}</span>}
                        <span className="text-xs text-slate-400">
                          {lead.createdAt.slice(0, 10)}
                        </span>
                      </td>

                      {/* 3. 채무 / 월소득 */}
                      <td className="py-3.5 px-3 text-right">
                        <span className="font-black text-rose-600 text-sm block">
                          {lead.debtTotal ? `${lead.debtTotal.toLocaleString()}만원` : '-'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {lead.incomeNet ? `월 ${lead.incomeNet.toLocaleString()}만원` : '소득 미기재'}
                        </span>
                      </td>

                      {/* 4. 진행 상태 */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}>
                          {statusConfig.label}{lead.status === 'no_answer' && lead.noAnswerCount ? ` ${lead.noAnswerCount}차` : ''}
                        </span>
                        {lead.status === 'closed' && lead.closeReason && (
                          <span className="block text-[11px] text-slate-500 mt-1">{LEAD_CLOSE_REASON_LABEL[lead.closeReason] || lead.closeReason}{lead.closeDetail ? ` · ${lead.closeDetail}` : ''}</span>
                        )}
                        {!!lead.reinquiryCount && <span className="block text-[11px] text-indigo-700 mt-1">재문의 {lead.reinquiryCount}회</span>}
                      </td>

                      {/* 5. 다음 연락 */}
                      <td className="py-3.5 px-3 text-center">
                        {(() => {
                          const b = queueBucket(lead, new Date(nowTick));
                          if (lead.status === 'closed' && lead.closeReason === 'later' && lead.recontactOn) return <span className="text-xs font-bold text-slate-700">{lead.recontactOn} 다시 연락</span>;
                          if (lead.status === 'new') return <span className="text-xs font-bold text-blue-700">첫 연락 전</span>;
                          if (!lead.nextAttemptAt) return <span className="text-xs text-slate-400">-</span>;
                          return (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded inline-block ${b === 'overdue' ? 'bg-rose-50 text-rose-700' : b === 'due' ? 'bg-amber-50 text-amber-800' : 'text-slate-700'}`}>
                              {b === 'overdue' ? '지남 · ' : b === 'due' ? '지금 · ' : ''}{fmtWhen(lead.nextAttemptAt)}
                            </span>
                          );
                        })()}
                        <span className="block text-[11px] text-slate-500 mt-0.5">통화 {lead.callCount || 0}회</span>
                      </td>

                      {/* 6. 관리 액션 (주 버튼: 통화 결과 기록 + ⋯) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 기획서 4.7 핵심: 행의 '통화 결과' 버튼 하나로 부재/재통화/성공 등 기록 */}
                          <button
                            type="button"
                            onClick={() => setCallModalTargetLead(lead)}
                            disabled={lead.status === 'converted'}
                            className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-[0.98]"
                            title="통화 결과 적기"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>결과 적기</span>
                          </button>

                          {/* ⋯ 더보기 메뉴 */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveMenuId(activeMenuId === lead.id ? null : lead.id)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                              title="더보기 옵션"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {activeMenuId === lead.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 space-y-0.5 animate-fadeIn text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setSelectedLeadId(lead.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>상세 정보 수정</span>
                                </button>

                                {lead.status !== 'converted' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      setConversionTargetLead(lead);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>사건 관리로 이관</span>
                                  </button>
                                )}

                                {lead.status === 'converted' && lead.convertedClientId && onNavigateToCrm && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onNavigateToCrm(lead.convertedClientId!);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                                    <span>사건 CRM 열기</span>
                                  </button>
                                )}

                                <div className="border-t border-slate-100 my-1" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDelete(lead.id, lead.customerName);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>휴지통으로</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. 결과 적기 (SL-3) ── */}
      {callModalTargetLead && (
        <LeadOutcomeModal
          lead={callModalTargetLead}
          caller={{ id: activeLawyer.id, name: activeLawyer.name }}
          officeName={activeLawyer.firmName || activeLawyer.name}
          onClose={() => setCallModalTargetLead(null)}
          onSaved={(updated) => setLeads(prev => prev.map(l => (l.id === updated.id ? { ...updated } : l)))}
        />
      )}

      {isVendorsOpen && officeId && (
        <SalesVendorsModal officeId={officeId} canManage={canAssignLeads} leads={leads} onClose={() => setIsVendorsOpen(false)} />
      )}
      {isStatsOpen && officeId && (
        <SalesStatsModal officeId={officeId} onClose={() => setIsStatsOpen(false)} />
      )}

      {/* ── 5. 단건 등록 모달 ── */}
      {/* (이전: 모달에 없는 activeLawyer/onCreated 등을 넘겨 onRegister가 undefined → 등록 시 오류·미저장) */}
      <NewLeadModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onRegister={(newLead) => {
          saveSalesLead(newLead);
          setLeads(prev => [newLead, ...prev]);
        }}
        existingLeads={leads}
        existingRequests={requests}
      />

      {/* ── 6. 엑셀 대량 등록 모달 ── */}
      <ImportLeadsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(newLeads) => {
          const inserted = bulkInsertLeads(newLeads);
          if (inserted === 0 && newLeads.length > 0) return false;
          setLeads(prev => [...newLeads, ...prev]);
          return true;
        }}
        existingLeads={leads}
        existingRequests={requests}
      />

      {isIntakeModalOpen && officeId && (
        <LeadIntakeSourcesModal
          officeId={officeId}
          onClose={() => setIsIntakeModalOpen(false)}
          onReceived={() => void syncSalesLeadsFromServer()}
        />
      )}

      {/* ── 7. 영업 설정 모달 ── */}
      <SalesSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        canManage={canAssignLeads || !officeId}
      />

      {/* ── 8. 고객 승격 모달 ── */}
      <LeadConversionModal
        isOpen={!!conversionTargetLead}
        onClose={() => setConversionTargetLead(null)}
        lead={conversionTargetLead}
        activeLawyer={activeLawyer}
        staffMembers={staffMembers}
        lawyers={lawyers}
        onConverted={handleConverted}
        onNavigateToCrm={onNavigateToCrm}
        existingRequests={requests}
      />
    </div>
  );
}
