import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Phone, PhoneCall, Plus, Upload, Settings, EyeOff, Search, 
  Clock, AlertTriangle, CheckCircle2, Sparkles, Filter, MoreHorizontal,
  ChevronDown, ChevronUp, Calendar, Send, Trash2, ArrowRight, MessageSquare,
  ShieldCheck, RefreshCw, PhoneForwarded, Flame, UserCheck, ExternalLink, Edit3,
  CalendarClock, X, Check
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
import { sendQuickSmsOrCopy } from '../../../services/communicationService';
import { useDialog } from '../../common/DialogProvider';
import { localYmd } from '../../../utils/localDate';

import SalesDashboardWidget from './SalesDashboardWidget';
import CaseBriefingBanner from './CaseBriefingBanner';
import SalesLeadDetailView from './SalesLeadDetailView';
import NewLeadModal from './NewLeadModal';
import ImportLeadsModal from './ImportLeadsModal';
import LeadConversionModal from './LeadConversionModal';
import StatusVisibilityModal from './StatusVisibilityModal';
import SalesSettingsModal from './SalesSettingsModal';

interface SalesLeadsTabProps {
  activeLawyer: User;
  staffMembers: StaffMember[];
  lawyers: User[];
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  onNavigateToCrm?: (clientId: string) => void;
}

// 기획서 4.7 5대 상태 탭 + 전체
export type SalesLeadTabStatus = 'all' | 'new' | 'callback' | 'no_answer' | 'in_progress' | 'converted';

export default function SalesLeadsTab({
  activeLawyer,
  staffMembers,
  lawyers,
  requests,
  setRequests,
  onNavigateToCrm,
}: SalesLeadsTabProps) {
  const dialog = useDialog();
  const [leads, setLeads] = useState<SalesLead[]>(() => loadSalesLeads());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<SalesLeadTabStatus>('all');
  const [selectedPath, setSelectedPath] = useState<string>('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // 모달 상태
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [conversionTargetLead, setConversionTargetLead] = useState<SalesLead | null>(null);

  // 통화 결과 등록 모달 상태 (기획서: 행의 '통화 결과' 버튼 하나로 기록)
  const [callModalTargetLead, setCallModalTargetLead] = useState<SalesLead | null>(null);
  const [callResultType, setCallResultType] = useState<'connected' | 'no_answer' | 'callback' | 'rejected' | 'wrong_number'>('no_answer');
  const [callMemo, setCallMemo] = useState('');
  const [callbackDateTime, setCallbackDateTime] = useState('');

  // 행별 더보기 메뉴 열림 상태
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const selectedLead = useMemo(() => {
    return leads.find(l => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  const inboundPaths = useMemo(() => loadInboundPaths(), [isSettingsModalOpen]);

  // 필터링된 리드 목록 (기획서 4.7 5대 탭)
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // 1. 검색어 필터
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

      // 3. 상태 탭 5종 필터
      if (selectedStatus === 'new' && l.status !== 'new') return false;
      if (selectedStatus === 'callback' && l.status !== 'callback') return false;
      if (selectedStatus === 'no_answer' && !['no_answer_1', 'no_answer_2', 'no_answer_3', 'no_answer'].includes(l.status)) return false;
      if (selectedStatus === 'in_progress' && l.status !== 'in_progress') return false;
      if (selectedStatus === 'converted' && l.status !== 'converted') return false;

      return true;
    });
  }, [leads, searchTerm, selectedStatus, selectedPath]);

  // 상태 카운트 집계
  const statusCounts = useMemo(() => {
    let newCount = 0;
    let callbackCount = 0;
    let noAnswerCount = 0;
    let inProgressCount = 0;
    let convertedCount = 0;

    leads.forEach(l => {
      if (l.status === 'new') newCount++;
      else if (l.status === 'callback') callbackCount++;
      else if (['no_answer_1', 'no_answer_2', 'no_answer_3', 'no_answer'].includes(l.status)) noAnswerCount++;
      else if (l.status === 'in_progress') inProgressCount++;
      else if (l.status === 'converted') convertedCount++;
    });

    return {
      all: leads.length,
      new: newCount,
      callback: callbackCount,
      no_answer: noAnswerCount,
      in_progress: inProgressCount,
      converted: convertedCount,
    };
  }, [leads]);

  // 통화 결과 저장 확정
  const handleSaveCallResult = () => {
    if (!callModalTargetLead) return;

    const updated = logLeadCall(
      callModalTargetLead.id,
      { id: activeLawyer.id, name: activeLawyer.name },
      callResultType,
      callMemo.trim() || undefined,
      callResultType === 'callback' ? callbackDateTime : undefined
    );

    if (updated) {
      setLeads(prev => prev.map(l => l.id === callModalTargetLead.id ? { ...updated } : l));
      toast.success(`통화 결과 기록이 완료되었습니다.`);
    }

    setCallModalTargetLead(null);
    setCallMemo('');
    setCallbackDateTime('');
  };

  // 리드 삭제
  const handleDelete = async (leadId: string, name: string) => {
    const confirmed = await dialog.confirm({
      title: '영업 리드 삭제',
      message: `${name} 고객 리드를 삭제하시겠습니까? 삭제된 리드는 복구되지 않습니다.`,
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
    setRequests(prev => [newRequest, ...prev]);
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
          {[
            { id: 'all' as const, label: '전체', count: statusCounts.all },
            { id: 'new' as const, label: '신규 접수', count: statusCounts.new },
            { id: 'callback' as const, label: '재통화 예정', count: statusCounts.callback },
            { id: 'no_answer' as const, label: '부재', count: statusCounts.no_answer },
            { id: 'in_progress' as const, label: '상담 중', count: statusCounts.in_progress },
            { id: 'converted' as const, label: '이관 완료', count: statusCounts.converted },
          ].map(tab => {
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
                <th className="py-3.5 px-3 w-[13%] text-center">진행 상태</th>
                <th className="py-3.5 px-3 w-[14%] text-center">통화 시도 / 예약</th>
                <th className="py-3.5 px-4 w-[18%] text-center">관리 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-bold text-slate-600">조건에 맞는 영업 DB가 없습니다.</p>
                    <p className="text-xs text-slate-400">새로운 DB를 등록하거나 검색 필터를 초기화해 보세요.</p>
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
                      </td>

                      {/* 2. 유입 경로 / 등록일 */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800 text-xs block">
                          {lead.inboundPath || '직접 인입'}
                        </span>
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
                          <span>{statusConfig.emoji}</span>
                          <span>{statusConfig.label}</span>
                        </span>
                      </td>

                      {/* 5. 통화 시도 / 예약일자 */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="text-xs font-bold text-slate-700 block">
                          {lead.callCount}회 시도
                        </span>
                        {lead.callbackTime ? (
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                            예약: {lead.callbackTime.slice(5, 16)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      {/* 6. 관리 액션 (주 버튼: 통화 결과 기록 + ⋯) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 기획서 4.7 핵심: 행의 '통화 결과' 버튼 하나로 부재/재통화/성공 등 기록 */}
                          <button
                            type="button"
                            onClick={() => {
                              setCallModalTargetLead(lead);
                              setCallResultType(lead.status === 'callback' ? 'callback' : 'no_answer');
                              setCallbackDateTime(lead.callbackTime || `${localYmd()}T14:00`);
                            }}
                            className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-[0.98]"
                            title="통화 결과 기록"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>통화 결과</span>
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
                                    <span>정식 고객으로 이전</span>
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
                                  <span>DB 삭제</span>
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

      {/* ── 4. 통화 결과 등록 모달 (기획서 4.7: 부재, 재통화 예약, 상담 성공, 거절, 결번) ── */}
      {callModalTargetLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold">
                  [{callModalTargetLead.customerName}] 통화 결과 기록
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCallModalTargetLead(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{callModalTargetLead.customerName}</div>
                  <div className="text-slate-500 font-mono mt-0.5">{callModalTargetLead.phone}</div>
                </div>
                <div className="text-right text-slate-400">
                  <span>누적 통화 {callModalTargetLead.callCount}회</span>
                </div>
              </div>

              {/* 결과 선택 5종 버튼 */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">통화 결과 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'no_answer' as const, label: '부재중 (부재 카운트+1)', color: 'text-amber-800 bg-amber-50 border-amber-300' },
                    { id: 'callback' as const, label: '재통화 예약 (시간지정)', color: 'text-blue-800 bg-blue-50 border-blue-300' },
                    { id: 'connected' as const, label: '상담 성공 (1차 상담중)', color: 'text-emerald-800 bg-emerald-50 border-emerald-300' },
                    { id: 'rejected' as const, label: '상담 거절 / 취소', color: 'text-slate-700 bg-slate-100 border-slate-300' },
                    { id: 'wrong_number' as const, label: '결번 / 번호 오류', color: 'text-rose-800 bg-rose-50 border-rose-300' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCallResultType(opt.id)}
                      className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                        callResultType === opt.id
                          ? `${opt.color} ring-2 ring-blue-500 shadow-2xs`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 재통화 예약 선택 시 날짜/시간 인풋 표시 */}
              {callResultType === 'callback' && (
                <div className="space-y-1.5 bg-blue-50/50 p-3.5 rounded-xl border border-blue-200 animate-fadeIn">
                  <label className="font-bold text-blue-900 flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-blue-600" />
                    <span>재통화 예약 일시</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={callbackDateTime}
                    onChange={e => setCallbackDateTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* 메모 입력 */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">통화 메모</label>
                <input
                  type="text"
                  value={callMemo}
                  onChange={e => setCallMemo(e.target.value)}
                  placeholder="예: 18시 퇴근 후 통화 희망, 최근 채무 비중 큼"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 text-xs"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCallModalTargetLead(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveCallResult}
                className="px-4 py-2 text-xs font-bold text-white bg-[#1E3A5F] hover:bg-[#152a45] rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                통화 결과 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. 단건 등록 모달 ── */}
      <NewLeadModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        activeLawyer={activeLawyer}
        staffMembers={staffMembers}
        lawyers={lawyers}
        onCreated={(newLead) => {
          setLeads(prev => [newLead, ...prev]);
        }}
      />

      {/* ── 6. 엑셀 대량 등록 모달 ── */}
      <ImportLeadsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeLawyer={activeLawyer}
        staffMembers={staffMembers}
        lawyers={lawyers}
        onImportSuccess={(newLeads) => {
          setLeads(prev => [...newLeads, ...prev]);
        }}
      />

      {/* ── 7. 영업 설정 모달 ── */}
      <SalesSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
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
