import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  FileSignature, Clock, CheckCircle2, Search, Eye, Trash2, 
  RefreshCw, FolderKanban, Download, AlertTriangle, Send, 
  ExternalLink, ShieldCheck, Printer, ArrowRight, User, Building2, 
  Check, X, FileText, ChevronRight, BellRing, Sparkles, Edit3, Settings2,
  MoreHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { localYmd } from '../../utils/localDate';
import { useDialog } from '../common/DialogProvider';
import type { ElectronicContract, ContractStatus } from '../../types';
import { CONTRACT_STATUS_CONFIG, CONTRACT_DOC_TYPES } from '../../types';
import { 
  loadContracts, loadContractsLocal, saveContract, deleteContract, 
  seedMockContracts 
} from '../../services/contractService';
import { syncContractToCrm } from '../../services/crmService';
import ContractWizard from './ContractWizard';
import { ContractDocLibraryModal } from './ContractDocLibraryModal';
import ApplicationDocSettingsModal from './documents/ApplicationDocSettingsModal';
import { HighlightedDocumentViewer } from '../common/HighlightedDocumentViewer';
import AuditTrailCertificate from './AuditTrailCertificate';
import ContractReminderModal from './ContractReminderModal';
import { generateCourtSubmissionPdf } from '../../services/contractPdfService';
import ContractPublicVerifierModal from '../common/ContractPublicVerifierModal';
import { feeTotalWon } from '../../utils/feeUnits';

/** 서명 진행 중 상태 */
const SIGNING_STATUSES: ReadonlyArray<ContractStatus> = ['pending_sign', 'client_review', 'signing'];

/** 체결 완료로 보는 상태 */
function isSignedContract(c: ElectronicContract): boolean {
  return c.status === 'completed' || c.status === 'signed';
}

/**
 * 의뢰인은 서명을 마쳤고 변호사 서명(체결 봉인)만 남은 계약
 */
function isAwaitingLawyerSign(c: ElectronicContract): boolean {
  if (!SIGNING_STATUSES.includes(c.status)) return false;
  return (c.documents || []).some(d => d.included && d.clientSignature);
}

/** 총 수임료(원) */
function contractFeeWon(c: ElectronicContract): number {
  return feeTotalWon(c.totalFee);
}

interface Props {
  lawyerName: string;
  lawFirmName: string;
  onNavigateToCrm?: (clientId?: string, detailTab?: any) => void;
}

export type ContractTabType = 'all' | 'signing' | 'overdue' | 'drafting' | 'completed' | 'cancelled';

export default function ContractManagementTab({ lawyerName, lawFirmName, onNavigateToCrm }: Props) {
  const dialog = useDialog();

  const [contracts, setContracts] = useState<ElectronicContract[]>(() => {
    if (import.meta.env.DEV) seedMockContracts();
    return loadContractsLocal();
  });
  const [statusFilter, setStatusFilter] = useState<ContractTabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContract, setEditingContract] = useState<ElectronicContract | null>(null);
  const [viewingContract, setViewingContract] = useState<ElectronicContract | null>(null);
  const [reminderTargetContract, setReminderTargetContract] = useState<ElectronicContract | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [docSettingsOpen, setDocSettingsOpen] = useState(false);
  const [verifyModalContract, setVerifyModalContract] = useState<ElectronicContract | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const refreshContracts = useCallback(async () => {
    const list = await loadContracts();
    if (Array.isArray(list)) {
      setContracts(list);
    }
  }, []);

  useEffect(() => {
    refreshContracts();
  }, [refreshContracts]);

  // 서명 지연 판별 (의뢰인 서명 대기 중 24시간 이상 경과)
  const isOverdue = useCallback((c: ElectronicContract) => {
    if (!SIGNING_STATUSES.includes(c.status)) return false;
    if (isAwaitingLawyerSign(c)) return false;
    const createdAtTime = new Date(c.updatedAt || c.createdAt).getTime();
    const elapsedHours = (Date.now() - createdAtTime) / (1000 * 60 * 60);
    return elapsedHours >= 24;
  }, []);

  // 통계 및 1줄 요약 지표 산출
  const stats = useMemo(() => {
    const list = Array.isArray(contracts) ? contracts : [];
    const completedList = list.filter(isSignedContract);
    const totalFeeSum = completedList.reduce((sum, c) => sum + contractFeeWon(c), 0);
    const overdueList = list.filter(isOverdue);
    const signingList = list.filter(c => SIGNING_STATUSES.includes(c.status) && !isOverdue(c));

    // 이달 체결 건수
    const currentMonth = localYmd().slice(0, 7);
    const thisMonthCompleted = completedList.filter(c => {
      const d = c.contractDate || c.createdAt.slice(0, 10);
      return d.startsWith(currentMonth);
    });
    const thisMonthFee = thisMonthCompleted.reduce((sum, c) => sum + contractFeeWon(c), 0);

    return {
      total: list.length,
      signing: list.filter(c => SIGNING_STATUSES.includes(c.status)).length,
      pendingSign: signingList.length,
      overdueCount: overdueList.length,
      drafting: list.filter(c => c.status === 'drafting').length,
      completed: completedList.length,
      cancelled: list.filter(c => c.status === 'cancelled').length,
      thisMonthCompletedCount: thisMonthCompleted.length,
      thisMonthFee,
      totalFeeSum,
    };
  }, [contracts, isOverdue]);

  // 필터링된 계약 목록
  const filtered = useMemo(() => {
    let list = Array.isArray(contracts) ? contracts : [];

    if (statusFilter === 'overdue') {
      list = list.filter(isOverdue);
    } else if (statusFilter === 'signing') {
      list = list.filter(c => SIGNING_STATUSES.includes(c.status) && !isOverdue(c));
    } else if (statusFilter === 'completed') {
      list = list.filter(isSignedContract);
    } else if (statusFilter === 'drafting') {
      list = list.filter(c => c.status === 'drafting');
    } else if (statusFilter === 'cancelled') {
      list = list.filter(c => c.status === 'cancelled');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.clientName || '').toLowerCase().includes(q) || 
        (c.id || '').toLowerCase().includes(q) ||
        (c.clientPhone || '').includes(q) ||
        (c.lawyerName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [contracts, statusFilter, searchQuery, isOverdue]);

  // 계약 삭제
  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: '계약서 삭제',
      message: '이 계약서를 완전히 삭제하시겠습니까? 진행 중인 서명이 취소됩니다.',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;
    const deleted = await deleteContract(id);
    await refreshContracts();
    if (deleted) toast.success('계약서가 삭제되었습니다');
    else toast.error('서버에서 삭제하지 못했습니다.');
  };

  // 재촉 알림톡/문구 복사 모달 오픈
  const handleSendReminder = (contract: ElectronicContract) => {
    setReminderTargetContract(contract);
  };

  // 재촉 알림톡 문구 복사 및 감사 추적 기록
  const handleConfirmSendReminder = async (
    templateKey: string,
    message: string,
    channel: 'alimtok' | 'sms' | 'both'
  ) => {
    if (!reminderTargetContract) return;
    const target = reminderTargetContract;
    const now = new Date().toISOString();
    const channelLabel = channel === 'both' ? '카카오 알림톡(SMS 대체포함)' : channel === 'alimtok' ? '카카오 알림톡' : 'SMS';

    let copied = false;
    try { await navigator.clipboard.writeText(message); copied = true; } catch { copied = false; }
    if (!copied) {
      toast.error('재촉 문구를 복사하지 못했습니다. 브라우저 클립보드 권한을 확인해 주세요.');
      return;
    }

    const updatedContract: ElectronicContract = {
      ...target,
      auditTrail: [
        ...(target.auditTrail || []),
        {
          action: '서명 재촉 문구 복사 (발송은 담당자가 직접)',
          timestamp: now,
          actor: 'lawyer',
          details: `수신 예정: ${target.clientPhone || '의뢰인'}, 채널: ${channelLabel}, 템플릿: ${templateKey}`
        }
      ],
    };

    const saved = await saveContract(updatedContract);
    if (updatedContract.clientId) {
      try { await syncContractToCrm(updatedContract.clientId, updatedContract); } catch (e) { console.warn('[Contract] CRM 동기화 실패', e); }
    }
    await refreshContracts();
    toast.success(`[${target.clientName}] 재촉 문구를 복사했습니다. ${channelLabel}로 직접 보내 주세요.${saved ? '' : ' (이력은 로컬에만 저장됨)'}`);
    setReminderTargetContract(null);
  };

  // 엑셀/CSV 회계 원장 다운로드 (UTF-8 BOM)
  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.info('다운로드할 계약 데이터가 없습니다.');
      return;
    }

    const headers = ['계약번호', '의뢰인명', '연락처', '담당변호사', '법무법인', '총수임료(원)', '계약상태', '체결일자', '문서수', '무결성검증'];
    const rows = filtered.map(c => [
      c.id,
      `"${c.clientName || '미지정'}"`,
      `"${c.clientPhone || '-'}"`,
      `"${c.lawyerName || '-'}"`,
      `"${c.lawFirmName || '-'}"`,
      contractFeeWon(c),
      isAwaitingLawyerSign(c) ? '변호사 서명 대기' : (CONTRACT_STATUS_CONFIG[c.status]?.label || c.status),
      c.contractDate || '-',
      (c.documents || []).filter(d => d.included).length,
      c.timestampToken ? '해시·시점토큰 생성' : '대기'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `전자계약_회계원장_${localYmd()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('계약 원장 CSV 파일이 다운로드되었습니다.');
  };

  if (editingContract) {
    return (
      <ContractWizard 
        contract={editingContract} 
        onClose={() => { setEditingContract(null); refreshContracts(); }} 
        onSave={async (c) => { 
          const ok = await saveContract(c); 
          if (!ok) toast.error('서버에 저장하지 못했습니다.');
          if (c.clientId) {
            try { await syncContractToCrm(c.clientId, c); } catch (e) { console.warn('[Contract] CRM 동기화 실패', e); }
          }
          refreshContracts(); 
        }} 
      />
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* ── 1. 헤더: 타이틀 + 액션 버튼 + 요약 한 줄 (기획서 4.7) ── */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase bg-blue-50 text-[#1E3A5F] px-2.5 py-0.5 rounded-md">
                계약 작업 큐
              </span>
              <span className="text-xs text-slate-400">· 수임 계약 작성은 사건 2단계에서 진행합니다</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
              <FileSignature className="w-6 h-6 text-[#1E3A5F]" />
              <span>계약 현황</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={refreshContracts} 
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200 active:scale-[0.98]" 
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* 원장 CSV 추출 */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200 active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>원장 CSV</span>
            </button>

            {/* 서식 보관함 */}
            <button
              onClick={() => setLibraryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200 active:scale-[0.98]"
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-500" />
              <span>서식 보관함</span>
            </button>

            {/* CRM 이동 안내 주 버튼 (단색 네이비) */}
            <button 
              onClick={() => {
                if (onNavigateToCrm) {
                  onNavigateToCrm();
                  toast.info('사건 관리 화면으로 이동합니다. 계약을 체결할 의뢰인을 선택해 주세요.');
                }
              }} 
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer active:scale-[0.98]"
            >
              <User className="w-3.5 h-3.5" />
              <span>사건 2단계에서 계약 작성</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── 요약 한 줄 (기획서 4.7: 이달 체결 n건 · 체결 수임료 · 서명 대기 n건) ── */}
        <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">이달 체결:</span>
              <span className="font-black text-slate-900">{stats.thisMonthCompletedCount}건</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">체결 확정 수임료:</span>
              <span className="font-black text-blue-700">{stats.totalFeeSum.toLocaleString()}원</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">서명 대기:</span>
              <span className="font-bold text-amber-700">{stats.signing}건</span>
            </div>
          </div>

          {stats.overdueCount > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>서명 지연 24시간 초과 {stats.overdueCount}건 (골든타임 주의)</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. 보기 탭 5종 + 검색창 (기획서 4.7) ── */}
      <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* 보기 탭 5개 + 전체 */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold scrollbar-none pb-1 md:pb-0">
          {[
            { id: 'all' as const, label: '전체', count: stats.total },
            { id: 'signing' as const, label: '서명 대기', count: stats.pendingSign },
            { id: 'overdue' as const, label: '서명 지연 (24h+)', count: stats.overdueCount, isAlert: true },
            { id: 'drafting' as const, label: '작성 중', count: stats.drafting },
            { id: 'completed' as const, label: '체결 완료', count: stats.completed },
            { id: 'cancelled' as const, label: '취소', count: stats.cancelled },
          ].map(tab => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 active:scale-[0.98] ${
                  isSelected
                    ? tab.isAlert ? 'bg-rose-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
                    : tab.isAlert && tab.count > 0 
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' 
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

        {/* 검색창 */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="의뢰인명, 연락처, 계약번호..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 text-slate-900 placeholder-slate-400"
          />
        </div>
      </div>

      {/* ── 3. 원장 테이블 (기획서 4.7 6열 정제) ── */}
      {/* 6열: 의뢰인(연락처 한 줄) · 사건 단계 · 수임료(분납 회차) · 서명 진행 막대(0/5) · 상태 · ⋯ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[840px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-black text-slate-600 uppercase tracking-wider">
                <th className="p-3.5 w-[22%]">의뢰인 (연락처)</th>
                <th className="p-3.5 w-[14%] text-center">사건 단계</th>
                <th className="p-3.5 w-[16%] text-right">수임료 (회차)</th>
                <th className="p-3.5 w-[18%] text-center">서명 진행 막대</th>
                <th className="p-3.5 w-[14%] text-center">상태</th>
                <th className="p-3.5 w-[16%] text-center">작업 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-bold text-slate-600">조건에 맞는 전자 계약 내역이 없습니다.</p>
                    <p className="text-xs text-slate-400">사건 2단계에서 새 계약을 작성하거나 필터를 변경해 보세요.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const awaitingLawyer = isAwaitingLawyerSign(c);
                  const overdue = isOverdue(c);
                  const includedDocsCount = (c.documents || []).filter(d => d.included).length || 5;
                  const signedDocsCount = (c.documents || []).filter(d => d.included && d.clientSignature).length;
                  const progressPct = includedDocsCount > 0 ? Math.round((signedDocsCount / includedDocsCount) * 100) : 0;

                  // 상태 레이블 및 색상
                  let statusBadge = { label: '대기', color: 'text-slate-600 bg-slate-100', emoji: '📄' };
                  if (c.status === 'completed' || c.status === 'signed') {
                    statusBadge = { label: '체결 완료', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200', emoji: '✅' };
                  } else if (overdue) {
                    statusBadge = { label: '서명 지연 (24h+)', color: 'text-rose-700 bg-rose-50 border border-rose-200', emoji: '⚠️' };
                  } else if (awaitingLawyer) {
                    statusBadge = { label: '변호사 서명 대기', color: 'text-blue-700 bg-blue-50 border border-blue-200', emoji: '🖊️' };
                  } else if (c.status === 'drafting') {
                    statusBadge = { label: '작성 중', color: 'text-purple-700 bg-purple-50 border border-purple-200', emoji: '📝' };
                  } else if (c.status === 'cancelled') {
                    statusBadge = { label: '취소', color: 'text-slate-500 bg-slate-100 border border-slate-200', emoji: '✕' };
                  } else {
                    statusBadge = { label: '의뢰인 서명 대기', color: 'text-amber-700 bg-amber-50 border border-amber-200', emoji: '⏳' };
                  }

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. 의뢰인 (연락처 한 줄) */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{c.clientName || '성명 미지정'}</span>
                          {c.isBusiness && (
                            <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-bold">
                              사업자
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                          <span>{c.clientPhone || '연락처 없음'}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400 font-sans">{c.contractDate || c.createdAt.slice(0, 10)}</span>
                        </div>
                      </td>

                      {/* 2. 사건 단계 */}
                      <td className="p-3.5 text-center">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          2단계 수임계약
                        </span>
                      </td>

                      {/* 3. 수임료 (분납 회차) */}
                      <td className="p-3.5 text-right">
                        <span className="font-black text-slate-900 text-sm block">
                          {contractFeeWon(c).toLocaleString()}원
                        </span>
                        <span className="text-xs text-slate-500">
                          {c.feeSchedule && c.feeSchedule.length > 0 ? `${c.feeSchedule.length}회차 분납` : '일시납'}
                        </span>
                      </td>

                      {/* 4. 서명 진행 막대 (0/5) */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-xs text-slate-700">
                            {signedDocsCount}/{includedDocsCount} 서명 ({progressPct}%)
                          </span>
                          <div className="w-28 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full transition-all ${
                                progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-slate-300'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 5. 상태 */}
                      <td className="p-3.5 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 ${statusBadge.color}`}>
                          <span>{statusBadge.emoji}</span>
                          <span>{statusBadge.label}</span>
                        </span>
                      </td>

                      {/* 6. 행별 단일 주 버튼 + 더보기(⋯) (기획서 4.7) */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 상태별 단일 주 버튼 */}
                          {isSignedContract(c) ? (
                            <button
                              onClick={() => generateCourtSubmissionPdf(c)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1 active:scale-[0.98] cursor-pointer shadow-2xs"
                              title="법원제출용 통합 PDF 다운로드"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>법원 PDF</span>
                            </button>
                          ) : (c.status === 'signing' || overdue) && !awaitingLawyer ? (
                            <button
                              onClick={() => handleSendReminder(c)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1 active:scale-[0.98] cursor-pointer shadow-2xs"
                              title="골든타임 서명 재촉 문구 복사"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>재요청</span>
                            </button>
                          ) : c.status === 'drafting' ? (
                            <button
                              onClick={() => setEditingContract(c)}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1 active:scale-[0.98] cursor-pointer shadow-2xs"
                              title="계약서 수정하기"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>계속 작성</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setViewingContract(c)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all flex items-center gap-1 active:scale-[0.98] cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>열람</span>
                            </button>
                          )}

                          {/* 더보기 (⋯) 드롭다운 */}
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === c.id ? null : c.id)}
                              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                              title="더보기 옵션"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {activeMenuId === c.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 space-y-0.5 animate-fadeIn text-left">
                                <button
                                  onClick={() => { setViewingContract(c); setActiveMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>계약서 전문 열람</span>
                                </button>

                                {c.blockchainAnchor && (
                                  <button
                                    onClick={() => { setVerifyModalContract(c); setActiveMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>블록체인 검증</span>
                                  </button>
                                )}

                                {onNavigateToCrm && (
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onNavigateToCrm(c.clientId, 'contracts');
                                      toast.info(`[${c.clientName}] 의뢰인의 사건 화면으로 이동합니다.`);
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                                    <span>사건 2단계 이동</span>
                                  </button>
                                )}

                                <div className="border-t border-slate-100 my-1" />

                                <button
                                  onClick={() => { setActiveMenuId(null); handleDelete(c.id); }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>계약 삭제</span>
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

      {/* ── 4. 사무소 문서함 (서식 보관함) 모달 ── */}
      <ContractDocLibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        lawyerName={lawyerName}
        lawFirmName={lawFirmName}
      />

      {/* ── 5. 신청서류 마스터 설정 모달 ── */}
      <ApplicationDocSettingsModal
        isOpen={docSettingsOpen}
        onClose={() => setDocSettingsOpen(false)}
      />

      {/* ── 6. 계약서 전문 열람 전용 뷰어 모달 ── */}
      {viewingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* 뷰어 헤더 */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A5F] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>{viewingContract.lawFirmName} 위임 계약서 전문</span>
                    <span className="text-xs font-normal text-slate-400 font-mono">({viewingContract.id})</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    위임인: {viewingContract.clientName} ({viewingContract.clientPhone}) | 체결 상태: {isAwaitingLawyerSign(viewingContract) ? '변호사 서명 대기' : CONTRACT_STATUS_CONFIG[viewingContract.status]?.label}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isSignedContract(viewingContract) && (
                  <button
                    onClick={() => generateCourtSubmissionPdf(viewingContract)}
                    className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#152a45] text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>법원제출 PDF</span>
                  </button>
                )}
                <button
                  onClick={() => setViewingContract(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 뷰어 본문 */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white">
              <HighlightedDocumentViewer 
                contract={viewingContract} 
                lawyerName={lawyerName} 
                lawFirmName={lawFirmName} 
                revealFullName={true}
              />
              <AuditTrailCertificate contract={viewingContract} />
            </div>
          </div>
        </div>
      )}

      {/* ── 7. 골든타임 재촉 알림톡 모달 ── */}
      {reminderTargetContract && (
        <ContractReminderModal
          contract={reminderTargetContract}
          isOpen={!!reminderTargetContract}
          onClose={() => setReminderTargetContract(null)}
          onConfirmSend={handleConfirmSendReminder}
        />
      )}

      {/* ── 8. 블록체인 검증 모달 ── */}
      {verifyModalContract && (
        <ContractPublicVerifierModal
          contract={verifyModalContract}
          isOpen={!!verifyModalContract}
          onClose={() => setVerifyModalContract(null)}
        />
      )}
    </div>
  );
}
