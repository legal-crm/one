import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Phone, PhoneCall, Plus, Upload, Settings, EyeOff, Search, 
  Clock, AlertTriangle, CheckCircle2, Sparkles, Filter, MoreHorizontal,
  ChevronDown, ChevronUp, Calendar, Send, Trash2, ArrowRight, MessageSquare,
  ShieldCheck, RefreshCw, PhoneForwarded, Flame, UserCheck, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import type { SalesLead, LeadStatus } from '../../../types/leadTypes';
import { LEAD_STATUS_CONFIG } from '../../../types/leadTypes';
import type { User, StaffMember, ConsultRequest, CrmClientExtension } from '../../../types';
import { 
  loadSalesLeads, saveSalesLeads, saveSalesLead, deleteSalesLead, 
  bulkInsertLeads, logLeadCall, extractBriefingData, formatPhone 
} from '../../../services/leadService';
import { loadInboundPaths } from '../../../services/settingsService';

import SalesDashboardWidget from './SalesDashboardWidget';
import CaseBriefingBanner from './CaseBriefingBanner';
import NewLeadModal from './NewLeadModal';
import ImportLeadsModal from './ImportLeadsModal';
import LeadConversionModal from './LeadConversionModal';
import StatusVisibilityModal from './StatusVisibilityModal';
import SalesSettingsModal from './SalesSettingsModal';
import LeadDetailModal from './LeadDetailModal';

interface SalesLeadsTabProps {
  activeLawyer: User;
  staffMembers: StaffMember[];
  lawyers: User[];
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  onNavigateToCrm?: (clientId: string) => void;
}

export default function SalesLeadsTab({
  activeLawyer,
  staffMembers,
  lawyers,
  requests,
  setRequests,
  onNavigateToCrm,
}: SalesLeadsTabProps) {
  const [leads, setLeads] = useState<SalesLead[]>(() => loadSalesLeads());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPath, setSelectedPath] = useState<string>('all');
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  // 모달 상태
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
  const [conversionTargetLead, setConversionTargetLead] = useState<SalesLead | null>(null);
  const [detailModalLead, setDetailModalLead] = useState<SalesLead | null>(null);

  // 숨김 상태 (localStorage)
  const [hiddenStatuses, setHiddenStatuses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('legal_sales_hidden_statuses');
      return saved ? JSON.parse(saved) : ['wrong_number', 'rejected'];
    } catch {
      return ['wrong_number', 'rejected'];
    }
  });

  const toggleHiddenStatus = (status: string) => {
    setHiddenStatuses(prev => {
      const next = prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status];
      localStorage.setItem('legal_sales_hidden_statuses', JSON.stringify(next));
      return next;
    });
  };

  // 인입 경로 목록
  const inboundPaths = useMemo(() => loadInboundPaths(), [isSettingsModalOpen]);

  // 필터링된 리드 목록
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // 1. 검색어 (이름, 전화번호, 지역, 메모)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = (l.customerName || '').toLowerCase().includes(term);
        const matchPhone = (l.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        const matchRegion = (l.region || '').toLowerCase().includes(term);
        const matchMemo = (l.specialMemo || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone && !matchRegion && !matchMemo) return false;
      }

      // 2. 인입 경로 필터
      if (selectedPath !== 'all' && l.inboundPath !== selectedPath) {
        return false;
      }

      // 3. 상태 필터 (탭 클릭 시)
      if (selectedStatus === 'all') {
        // 전체 보기에서는 숨김 상태 제외
        if (hiddenStatuses.includes(l.status)) return false;
      } else if (selectedStatus === 'no_answer') {
        if (!['no_answer_1', 'no_answer_2', 'no_answer_3'].includes(l.status)) return false;
      } else if (selectedStatus === 'callback') {
        if (l.status !== 'callback') return false;
      } else if (selectedStatus === 'overdue') {
        const hasOverdue = (l.reminders || []).some(r => !r.isCompleted && new Date(r.datetime.replace(' ', 'T')).getTime() < Date.now());
        if (!hasOverdue) return false;
      } else {
        if (l.status !== selectedStatus) return false;
      }

      return true;
    });
  }, [leads, searchTerm, selectedStatus, selectedPath, hiddenStatuses]);

  // 콜 디스포지션 핸들러
  const handleCallDisposition = (
    leadId: string,
    result: 'connected' | 'no_answer' | 'callback' | 'rejected' | 'wrong_number',
    memo?: string,
    callbackTime?: string
  ) => {
    const updated = logLeadCall(
      leadId,
      { id: activeLawyer.id, name: activeLawyer.name },
      result,
      memo,
      callbackTime
    );
    if (updated) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...updated } : l));
      toast.success(`통화 결과 '${result}' 기록 완료`);
    }
  };

  // 퀵 SMS 발송 시뮬레이션
  const handleSendQuickSms = (lead: SalesLead, type: 'no_answer' | 'appointment') => {
    const text = type === 'no_answer'
      ? `[법무법인] ${lead.customerName}님, 회생·파산 무료상담 신청 주셔서 연락드렸으나 부재중으로 문자 남깁니다. 편하신 시간에 회신 주시면 변호사 직접 진단 도와드리겠습니다.`
      : `[법무법인] ${lead.customerName}님, 회생·파산 상담 전화 예약 안내드립니다. 예약 일시에 맞춰 연락드리겠습니다.`;

    toast.success(`${lead.customerName}님께 퀵 문자가 발송되었습니다.`, {
      description: text,
    });

    // 통화 메모에 문자 발송 로그 남기기
    const updated = logLeadCall(
      lead.id,
      { id: activeLawyer.id, name: activeLawyer.name },
      'no_answer',
      `[SMS발송] ${type === 'no_answer' ? '부재중 안내문자' : '예약안내문자'} 발송`
    );
    if (updated) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...updated } : l));
    }
  };

  // 리드 삭제
  const handleDelete = (leadId: string, name: string) => {
    if (window.confirm(`${name} 영업 리드를 삭제하시겠습니까?`)) {
      deleteSalesLead(leadId);
      setLeads(prev => prev.filter(l => l.id !== leadId));
      toast.success('영업 리드가 삭제되었습니다.');
    }
  };

  // 고객 승격 완료 콜백
  const handleConverted = (newRequest: ConsultRequest, newExt: CrmClientExtension, updatedLead: SalesLead) => {
    // 1. 기존 requests 배열에 신규 고객 추가
    setRequests(prev => [newRequest, ...prev]);
    // 2. 리드 목록 상태 동기화
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? { ...updatedLead } : l));
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* ── 1. Top Header & Primary Action Buttons ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <PhoneCall size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                영업 관리 <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">DB·콜 워크스페이스</span>
              </h1>
              <p className="text-xs text-slate-500">
                대량 인입 DB를 안전하게 격리 보관하고 고속 콜 영업을 진행하며, 상담 성공 시 정식 고객으로 승격합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 액션 버튼군 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer press-scale active:scale-[0.98]"
            title="상태/파트너/경로 등 환경설정"
          >
            <Settings size={14} className="text-slate-500" />
            <span>영업 환경 설정</span>
          </button>

          <button
            type="button"
            onClick={() => setIsVisibilityModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer press-scale active:scale-[0.98]"
            title="목록 표시/숨김 설정"
          >
            <EyeOff size={14} className="text-slate-500" />
            <span>보기 설정</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-violet-500/20 transition-all cursor-pointer press-scale active:scale-[0.98]"
          >
            <Upload size={14} />
            <span>대량 DB 엑셀 업로드</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-blue-500/20 transition-all cursor-pointer press-scale active:scale-[0.98]"
          >
            <Plus size={15} />
            <span>단건 신규 DB 등록</span>
          </button>
        </div>
      </div>

      {/* ── 2. 100% 독립된 영업 대시보드 (Sales Dashboard) ── */}
      <SalesDashboardWidget
        leads={leads}
        onSelectQuickFilter={key => setSelectedStatus(key)}
        activeFilter={selectedStatus}
      />

      {/* ── 3. 검색 및 필터 툴바 ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* 상태 탭 필터 */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-bold">
            {[
              { id: 'all', label: '전체 보기' },
              { id: 'new', label: '🆕 신규 DB' },
              { id: 'callback', label: '⏰ 오늘 예약' },
              { id: 'no_answer', label: '📞 부재중' },
              { id: 'in_progress', label: '💬 1차 상담중' },
              { id: 'converted', label: '⭐️ 고객 이전완료' },
              { id: 'overdue', label: '⚠️ 지연 경고' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer select-none ${
                  selectedStatus === tab.id
                    ? 'bg-slate-900 text-white font-extrabold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 인입 경로 드롭다운 */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
              value={selectedPath}
              onChange={e => setSelectedPath(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-hidden cursor-pointer"
            >
              <option value="all">전체 유입경로</option>
              {inboundPaths.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 검색창 */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="고객명, 연락처, 지역, 상담 특이사항 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* ── 4. 영업 리드 목록 (Lead List & Workspace) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-2">
          <span>검색된 영업 리드 <strong className="text-slate-800 font-extrabold">{filteredLeads.length}</strong>건</span>
          <span className="text-[11px] text-slate-400">행을 클릭하면 딥 슬레이트 브리핑 및 고속 콜 워크스페이스가 열립니다.</span>
        </div>

        {filteredLeads.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users size={24} />
            </div>
            <p className="text-sm font-extrabold text-slate-700">해당 조건의 영업 리드가 없습니다.</p>
            <p className="text-xs text-slate-400">새로운 DB를 엑셀로 업로드하거나 단건으로 등록해 보세요.</p>
          </div>
        ) : (
          filteredLeads.map(lead => {
            const isExpanded = expandedLeadId === lead.id;
            const briefingData = extractBriefingData(lead);
            const statusConfig = LEAD_STATUS_CONFIG[lead.status] || LEAD_STATUS_CONFIG.new;

            return (
              <div
                key={lead.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  isExpanded ? 'border-blue-300 shadow-md ring-2 ring-blue-500/10' : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Collapsed Row */}
                <div
                  onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1 ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}>
                      <span>{statusConfig.emoji}</span>
                      <span>{statusConfig.label}</span>
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-sm">{lead.customerName}</h3>
                        <span className="text-xs font-mono text-slate-500">{lead.phone}</span>
                        {lead.region && <span className="text-xs text-slate-400 font-normal">· {lead.region}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span>{lead.inboundPath || '직접인입'}</span>
                        {lead.batchName && <span>({lead.batchName})</span>}
                        <span>·</span>
                        <span>통화 시도 {lead.callCount}회</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: 채무/소득 및 퀵 버튼 */}
                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        채무 <strong className="text-rose-600 font-extrabold">{lead.debtTotal ? `${lead.debtTotal.toLocaleString()}만` : '-'}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        월소득 {lead.incomeNet ? `${lead.incomeNet.toLocaleString()}만` : '-'}
                      </p>
                    </div>

                      {/* Primary Action Button */}
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {lead.status === 'converted' ? (
                          <button
                            type="button"
                            onClick={() => lead.convertedClientId && onNavigateToCrm && onNavigateToCrm(lead.convertedClientId)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            <span>고객 CRM 조회</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConversionTargetLead(lead)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer press-scale active:scale-[0.98]"
                          >
                            <Sparkles size={13} />
                            <span>고객 관리로 이전</span>
                          </button>
                        )}

                        {/* ✏️ Real-time Detail Editor Button */}
                        <button
                          type="button"
                          onClick={() => setDetailModalLead(lead)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer press-scale"
                          title="고객과 통화하면서 상세 정보를 입력하고 실시간으로 수정합니다"
                        >
                          <FileText size={13} />
                          <span>상담·정보입력/수정</span>
                        </button>

                        <a
                          href={`tel:${lead.phone}`}
                          onClick={() => handleCallDisposition(lead.id, 'connected', '전화 연결 시도')}
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors cursor-pointer"
                          title="전화 걸기"
                        >
                          <Phone size={14} />
                        </a>

                        <button
                          type="button"
                          onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                          className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">
                      {/* 빠른 진입 배너 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-blue-50/90 rounded-2xl border border-blue-200">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                          <span className="text-xs font-black text-blue-950">
                            통화 중 실시간 정보 수정 워크스페이스
                          </span>
                          <span className="text-[11px] text-blue-700 hidden md:inline">
                            (인적사항, 소득, 채무, 주거, 자산, 과거이력, 통화메모 실시간 입력)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailModalLead(lead)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer press-scale"
                        >
                          <FileText size={14} />
                          <span>✏️ 통화 중 고객 정보 5대 영역 실시간 입력/수정 창 열기</span>
                        </button>
                      </div>

                      {/* 1. 딥 슬레이트 고객 종합 브리핑 보드 (복사 기능 포함) */}
                      <CaseBriefingBanner data={briefingData} />

                    {/* 2. 고속 콜 디스포지션 툴바 */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <PhoneCall size={14} className="text-blue-600" />
                          원클릭 통화 결과 기록 (콜 디스포지션)
                        </span>
                        <span className="text-[11px] text-slate-400">클릭 즉시 통화 횟수가 증가하고 상태가 전이됩니다.</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCallDisposition(lead.id, 'no_answer', '부재중 통화 시도')}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          📞 부재중
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const timeStr = prompt('재통화 예약 일시를 입력하세요 (예: 2026-09-15 14:00)');
                            if (timeStr) handleCallDisposition(lead.id, 'callback', '재통화 약속', timeStr);
                          }}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          ⏰ 재통화 예약
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCallDisposition(lead.id, 'connected', '상담 통화 진행')}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          💬 1차 상담 통화 성공
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCallDisposition(lead.id, 'rejected', '상담 거절 또는 단순변심')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          🚫 단순변심/거절
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCallDisposition(lead.id, 'wrong_number', '결번 또는 타인 번호')}
                          className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          ⚠️ 결번/오류
                        </button>

                        {/* 퀵 SMS 버튼 */}
                        <button
                          type="button"
                          onClick={() => handleSendQuickSms(lead, 'no_answer')}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer ml-auto flex items-center gap-1"
                        >
                          <Send size={12} />
                          <span>부재중 퀵 SMS</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(lead.id, lead.customerName)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer rounded-lg"
                          title="리드 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* 3. 통화 이력 타임라인 */}
                    {lead.callLogs && lead.callLogs.length > 0 && (
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                        <span className="font-extrabold text-xs text-slate-800 block">
                          📜 통화 시도 이력 ({lead.callLogs.length}건)
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {lead.callLogs.map(log => (
                            <div key={log.id} className="text-xs p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-700">[{log.result}]</span>
                                <span className="text-slate-600 ml-1.5">{log.memo || '메모 없음'}</span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {new Date(log.calledAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ({log.callerName})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── 모달 레이어 ── */}
      {isNewModalOpen && (
        <NewLeadModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onRegister={newLead => {
            saveSalesLead(newLead);
            setLeads(prev => [newLead, ...prev]);
          }}
          existingLeads={leads}
          existingRequests={requests}
        />
      )}

      {isImportModalOpen && (
        <ImportLeadsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={importedLeads => {
            bulkInsertLeads(importedLeads);
            setLeads(prev => [...importedLeads, ...prev]);
          }}
          existingLeads={leads}
          existingRequests={requests}
        />
      )}

      {Boolean(conversionTargetLead) && (
        <LeadConversionModal
          isOpen={!!conversionTargetLead}
          onClose={() => setConversionTargetLead(null)}
          lead={conversionTargetLead}
          activeLawyer={activeLawyer}
          staffMembers={staffMembers}
          lawyers={lawyers}
          onConverted={handleConverted}
          onNavigateToCrm={onNavigateToCrm}
        />
      )}

      {isVisibilityModalOpen && (
        <StatusVisibilityModal
          isOpen={isVisibilityModalOpen}
          onClose={() => setIsVisibilityModalOpen(false)}
          allStatuses={Object.keys(LEAD_STATUS_CONFIG)}
          hiddenStatuses={hiddenStatuses}
          onToggleStatus={toggleHiddenStatus}
          title="영업 리드 상태 보기 설정"
        />
      )}

      {isSettingsModalOpen && (
        <SalesSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}

      {Boolean(detailModalLead) && (
        <LeadDetailModal
          isOpen={!!detailModalLead}
          onClose={() => setDetailModalLead(null)}
          lead={detailModalLead}
          onUpdateLead={updatedLead => {
            saveSalesLead(updatedLead);
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
            setDetailModalLead(updatedLead);
          }}
          onPromoteToClient={leadToConvert => {
            setConversionTargetLead(leadToConvert);
            setDetailModalLead(null);
          }}
          activeLawyer={activeLawyer}
          existingRequests={requests}
        />
      )}
    </div>
  );
}
