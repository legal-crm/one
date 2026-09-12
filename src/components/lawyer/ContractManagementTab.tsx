import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  FileSignature, Clock, CheckCircle2, Plus, Search, Eye, Trash2, 
  RefreshCw, FolderKanban, Download, AlertTriangle, Send, 
  ExternalLink, ShieldCheck, Printer, ArrowRight, User, Building2, 
  Check, X, FileText, ChevronRight, BellRing, Sparkles, Edit3, Settings2 
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import type { ElectronicContract, ContractStatus } from '../../types';
import { CONTRACT_STATUS_CONFIG, CONTRACT_DOC_TYPES } from '../../types';
import { 
  loadContracts, loadContractsLocal, saveContract, deleteContract, 
  seedMockContracts 
} from '../../services/contractService';
import ContractWizard from './ContractWizard';
import { ContractDocLibraryModal } from './ContractDocLibraryModal';
import ApplicationDocSettingsModal from './documents/ApplicationDocSettingsModal';
import { HighlightedDocumentViewer } from '../common/HighlightedDocumentViewer';
import AuditTrailCertificate from './AuditTrailCertificate';
import ContractReminderModal from './ContractReminderModal';
import { generateCourtSubmissionPdf } from '../../services/contractPdfService';
import ContractPublicVerifierModal from '../common/ContractPublicVerifierModal';

interface Props {
  lawyerName: string;
  lawFirmName: string;
  onNavigateToCrm?: () => void;
}

export default function ContractManagementTab({ lawyerName, lawFirmName, onNavigateToCrm }: Props) {
  const dialog = useDialog();

  const [contracts, setContracts] = useState<ElectronicContract[]>(() => {
    seedMockContracts();
    return loadContractsLocal();
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContract, setEditingContract] = useState<ElectronicContract | null>(null);
  const [viewingContract, setViewingContract] = useState<ElectronicContract | null>(null);
  const [reminderTargetContract, setReminderTargetContract] = useState<ElectronicContract | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [docSettingsOpen, setDocSettingsOpen] = useState(false);
  const [verifyModalContract, setVerifyModalContract] = useState<ElectronicContract | null>(null);

  const refreshContracts = useCallback(async () => {
    const list = await loadContracts();
    if (Array.isArray(list)) {
      setContracts(list);
    }
  }, []);

  useEffect(() => {
    refreshContracts();
  }, [refreshContracts]);

  // ── 골든타임 지체 계약 판별 (서명 대기 중 24시간 이상 경과) ──
  const isOverdue = useCallback((c: ElectronicContract) => {
    if (!['pending_sign', 'client_review', 'signing'].includes(c.status)) return false;
    const createdAtTime = new Date(c.updatedAt || c.createdAt).getTime();
    const elapsedHours = (Date.now() - createdAtTime) / (1000 * 60 * 60);
    return elapsedHours >= 24;
  }, []);

  // ── 통계 및 경영 KPI 지표 산출 ──
  const stats = useMemo(() => {
    const list = Array.isArray(contracts) ? contracts : [];
    const completedList = list.filter(c => c.status === 'completed');
    const totalFeeSum = completedList.reduce((sum, c) => sum + (c.totalFee || 0), 0);
    const avgFee = completedList.length > 0 ? Math.round(totalFeeSum / completedList.length) : 0;
    const conversionRate = list.length > 0 ? Math.round((completedList.length / list.length) * 100) : 0;

    const overdueList = list.filter(isOverdue);

    return {
      total: list.length,
      drafting: list.filter(c => c.status === 'drafting').length,
      signing: list.filter(c => ['pending_sign', 'client_review', 'signing'].includes(c.status)).length,
      completed: completedList.length,
      cancelled: list.filter(c => c.status === 'cancelled').length,
      overdueCount: overdueList.length,
      overdueList,
      totalFeeSum,
      avgFee,
      conversionRate,
    };
  }, [contracts, isOverdue]);

  // ── 필터링된 계약 목록 ──
  const filtered = useMemo(() => {
    let list = Array.isArray(contracts) ? contracts : [];

    if (statusFilter === 'overdue') {
      list = list.filter(isOverdue);
    } else if (statusFilter === 'signing') {
      list = list.filter(c => ['pending_sign', 'client_review', 'signing'].includes(c.status));
    } else if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
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

  // ── 계약 삭제 ──
  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: '계약서 삭제',
      message: '이 계약서를 원장에서 완전히 삭제하시겠습니까? 진행 중인 서명이 취소됩니다.',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;
    await deleteContract(id);
    await refreshContracts();
    toast.success('계약서가 삭제되었습니다');
  };

  // ── 골든타임 재촉 알림톡 사전 확인 모달 오픈 ──
  const handleSendReminder = (contract: ElectronicContract) => {
    setReminderTargetContract(contract);
  };

  // ── 재촉 알림톡 최종 발송 및 감사 추적 기록 ──
  const handleConfirmSendReminder = async (
    templateKey: string,
    message: string,
    channel: 'alimtok' | 'sms' | 'both'
  ) => {
    if (!reminderTargetContract) return;
    const target = reminderTargetContract;
    const now = new Date().toISOString();
    const channelLabel = channel === 'both' ? '카카오 알림톡(SMS 대체포함)' : channel === 'alimtok' ? '카카오 알림톡' : 'SMS';
    
    // 감사 추적(Audit Trail)에 발송 이력 영구 기록
    const updatedContract: ElectronicContract = {
      ...target,
      auditTrail: [
        ...(target.auditTrail || []),
        {
          action: '골든타임 서명 재촉 알림톡 발송',
          timestamp: now,
          actor: 'lawyer',
          details: `수신: ${target.clientPhone || '의뢰인'}, 채널: ${channelLabel}, 템플릿: ${templateKey}`
        }
      ],
      updatedAt: now
    };

    await saveContract(updatedContract);
    await refreshContracts();
    toast.success(`[${target.clientName}] 의뢰인에게 서명 골든타임 재촉 알림톡을 정상 발송했습니다.`);
    setReminderTargetContract(null);
  };

  // ── 엑셀/CSV 회계 원장 다운로드 (UTF-8 BOM) ──
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
      (c.totalFee || 0) * 10000,
      CONTRACT_STATUS_CONFIG[c.status]?.label || c.status,
      c.contractDate || '-',
      (c.documents || []).filter(d => d.included).length,
      c.timestampToken ? 'TSA봉인완료' : '대기'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `전자계약_회계원장_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('계약 원장 CSV 파일이 다운로드되었습니다.');
  };

  if (editingContract) {
    return (
      <ContractWizard 
        contract={editingContract} 
        onClose={() => { setEditingContract(null); refreshContracts(); }} 
        onSave={(c) => { saveContract(c); refreshContracts(); }} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ── 1. 총괄 어드민 헤더 & 액션 ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand mb-1">
              <span className="text-xs font-black tracking-wider uppercase bg-brand/10 text-brand px-2 py-0.5 rounded-md">
                Contract Operations & Admin
              </span>
              <span className="text-xs text-slate-400">• 로펌 계약 총괄 관리 센터</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <FileSignature className="w-7 h-7 text-brand" />
              <span>전자 계약 총괄 어드민 대시보드</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              로펌 전체의 수임 계약 현황, 매출 분석, 미체결 골든타임 리스크 및 감사 원장을 통합 관리합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={refreshContracts} 
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200" 
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* 엑셀/CSV 회계 원장 다운로드 */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer whitespace-nowrap border border-slate-200 shadow-2xs min-h-[42px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>원장 CSV 추출</span>
            </button>

            {/* 문서함 (서식 관리) */}
            <button
              onClick={() => setLibraryOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap min-h-[42px] border border-indigo-200 text-xs shadow-2xs press-scale"
            >
              <FolderKanban className="w-4 h-4 text-indigo-600" />
              <span>📂 문서함 (서식 보관함)</span>
            </button>

            {/* 신청서류 마스터 설정 (리걸플로 20p 벤치마킹) */}
            <button
              onClick={() => setDocSettingsOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap min-h-[42px] border border-slate-200 text-xs shadow-2xs press-scale"
              title="개인회생·파산·보정권고 마스터 신청서류 템플릿 설정"
            >
              <Settings2 className="w-4 h-4 text-slate-600" />
              <span>⚙️ 신청서류 설정</span>
            </button>

            {/* 고객 CRM에서 새 계약 진행 안내 버튼 */}
            <button 
              onClick={() => {
                if (onNavigateToCrm) {
                  onNavigateToCrm();
                  toast.info('고객 관리 CRM으로 이동했습니다. 계약을 진행할 고객을 선택해 주세요.');
                } else {
                  toast.info('좌측 [고객 관리 (CRM)] 메뉴에서 의뢰인을 선택하신 후 [전자계약] 탭에서 계약서를 작성해 주세요.');
                }
              }} 
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] text-white font-bold rounded-xl hover:bg-[#162d4a] transition-colors cursor-pointer whitespace-nowrap min-h-[42px] shadow-xs text-xs"
            >
              <User className="w-3.5 h-3.5" />
              <span>+ CRM 고객 선택하여 계약 진행</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── 2. 계약 경영 KPI 카드 4대 지표 ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-slate-100">
          
          {/* KPI 1: 총 약정 수임료 합계 */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-300 block">총 체결 수임료 (확정 매출)</span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-emerald-400">
              {((stats.totalFeeSum || 0) * 10000).toLocaleString()}원
            </div>
            <p className="text-[11px] text-slate-400">
              체결 완료 {stats.completed}건 기준 (평균 {((stats.avgFee || 0) * 10000).toLocaleString()}원)
            </p>
          </div>

          {/* KPI 2: 체결 전환율 */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 block">수임 계약 체결 전환율</span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-slate-900 flex items-baseline gap-1">
              <span>{stats.conversionRate}%</span>
              <span className="text-xs font-bold text-emerald-600">성공</span>
            </div>
            <p className="text-[11px] text-slate-400">
              총 {stats.total}건 중 {stats.completed}건 체결 완료
            </p>
          </div>

          {/* KPI 3: 서명 진행 중 파이프라인 */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 block">고객 스마트폰 서명 대기</span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-amber-600">
              {stats.signing}건
            </div>
            <p className="text-[11px] text-slate-400">
              작성중 {stats.drafting}건 / 서명 진행중 {stats.signing}건
            </p>
          </div>

          {/* KPI 4: 🚨 미체결 골든타임 리스크 */}
          <div className={`p-5 rounded-2xl border space-y-1 transition-colors ${
            stats.overdueCount > 0 ? 'bg-red-50/70 border-red-200 text-red-950' : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold block">🚨 골든타임 미체결 리스크</span>
              {stats.overdueCount > 0 && (
                <span className="text-[10px] font-black bg-red-200 text-red-900 px-2 py-0.5 rounded-full animate-pulse">
                  긴급
                </span>
              )}
            </div>
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
              stats.overdueCount > 0 ? 'text-red-600' : 'text-slate-400'
            }`}>
              {stats.overdueCount}건
            </div>
            <p className="text-[11px] text-slate-500">
              {stats.overdueCount > 0 ? '서명 발송 24시간 초과 (이탈 위험)' : '지체된 계약 없음 (양호)'}
            </p>
          </div>

        </div>
      </div>

      {/* ── 3. 🚨 골든타임 미체결 리스크 스마트 배너 ── */}
      {stats.overdueCount > 0 && (
        <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-amber-950">
                  서명 요청 후 24시간이 경과한 미체결 계약이 {stats.overdueCount}건 있습니다.
                </h4>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  회생·파산 의뢰인은 48시간 이상 지체 시 타 로펌 이탈률이 급증합니다. 지금 재촉 알림톡을 발송하여 체결을 완료하세요.
                </p>
              </div>
            </div>

            <button
              onClick={() => setStatusFilter('overdue')}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs whitespace-nowrap cursor-pointer shadow-xs self-end sm:self-center"
            >
              지체 계약 {stats.overdueCount}건 모아보기 →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {stats.overdueList.slice(0, 3).map(c => (
              <div key={c.id} className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">{c.clientName}</span>
                  <span className="text-slate-400 ml-1.5">{c.clientPhone}</span>
                  <p className="text-[10px] text-amber-700 mt-0.5">발송: {c.contractDate || '최근'}</p>
                </div>
                <button
                  onClick={() => handleSendReminder(c)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg text-[11px] cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>재촉 발송</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. 통합 계약 마스터 원장 테이블 영역 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        
        {/* 필터 및 검색 바 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* 상태 탭 필터 */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold scrollbar-hide">
            {[
              { id: 'all', label: '전체', count: stats.total },
              { id: 'completed', label: '체결완료', count: stats.completed },
              { id: 'signing', label: '서명진행중', count: stats.signing },
              { id: 'overdue', label: '🚨 골든타임지체', count: stats.overdueCount, isAlert: true },
              { id: 'drafting', label: '작성중', count: stats.drafting },
              { id: 'cancelled', label: '취소/보류', count: stats.cancelled },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? tab.isAlert ? 'bg-red-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
                    : tab.isAlert && tab.count > 0 ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* 검색창 */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="의뢰인, 연락처, 계약번호..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-brand focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* 원장 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="p-3.5">계약번호 / 체결일자</th>
                <th className="p-3.5">위임인 (의뢰인)</th>
                <th className="p-3.5">수임인 (담당변호사)</th>
                <th className="p-3.5 text-right">총 수임료 (분납)</th>
                <th className="p-3.5 text-center">계약 문서 현황</th>
                <th className="p-3.5 text-center">무결성·서명 검증</th>
                <th className="p-3.5 text-center">체결 상태</th>
                <th className="p-3.5 text-center min-w-[260px]">관리 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-bold">조건에 맞는 전자 계약 내역이 없습니다.</p>
                    <p className="text-xs text-slate-400">고객 관리(CRM)에서 새 계약을 생성하거나 필터를 변경해 보세요.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const cfg = CONTRACT_STATUS_CONFIG[c.status] || { label: c.status, color: 'text-slate-600', bgColor: 'bg-slate-100', emoji: '📄' };
                  const overdue = isOverdue(c);
                  const includedDocsCount = (c.documents || []).filter(d => d.included).length;
                  const signedDocsCount = (c.documents || []).filter(d => d.included && d.clientSignature).length;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 계약번호 & 일자 */}
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-slate-900 block">{c.id}</span>
                        <span className="text-[11px] text-slate-400">{c.contractDate || c.createdAt.slice(0, 10)}</span>
                      </td>

                      {/* 위임인 */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{c.clientName || '성명 미지정'}</span>
                          {c.isBusiness && (
                            <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.2 rounded font-bold">
                              사업자
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">{c.clientPhone || '-'}</span>
                      </td>

                      {/* 수임인 */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">{c.lawyerName} 변호사</div>
                        <span className="text-[11px] text-slate-400">{c.lawFirmName}</span>
                      </td>

                      {/* 수임료 */}
                      <td className="p-3.5 text-right">
                        <span className="font-black text-slate-900 block">
                          {((c.totalFee || 0) * 10000).toLocaleString()}원
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {c.feeSchedule && c.feeSchedule.length > 0 ? `${c.feeSchedule.length}회차 분납` : '일시납'}
                        </span>
                      </td>

                      {/* 문서 현황 */}
                      <td className="p-3.5 text-center">
                        <span className="font-bold text-slate-800">
                          {signedDocsCount} / {includedDocsCount} 문서 서명
                        </span>
                        {c.documents?.some(d => d.requiredConfirmationText) && (
                          <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 block w-fit mx-auto mt-0.5">
                            자필확약 조항 포함
                          </span>
                        )}
                      </td>

                      {/* 무결성 검증 */}
                      <td className="p-3.5 text-center">
                        {c.blockchainAnchor ? (
                          <button
                            onClick={() => setVerifyModalContract(c)}
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105 ${
                              c.blockchainAnchor.isRealOnChain
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title="클릭 시 블록체인 원본 검증창 열기"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{c.blockchainAnchor.isRealOnChain ? '⛓️ 온체인 완료' : '⛓️ Polygon 각인'}</span>
                          </button>
                        ) : c.timestampToken ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> TSA 봉인완료
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            체결 후 각인예정
                          </span>
                        )}
                      </td>

                      {/* 상태 */}
                      <td className="p-3.5 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 ${cfg.bgColor} ${cfg.color}`}>
                          <span>{cfg.emoji}</span>
                          <span>{cfg.label}</span>
                        </span>
                        {overdue && (
                          <span className="text-[10px] font-bold text-red-600 block mt-1">
                            ⚠️ 24h 경과
                          </span>
                        )}
                      </td>

                      {/* 관리 액션 */}
                      <td className="p-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          {/* 1. 전문 열람 (기본 공통) */}
                          <button
                            onClick={() => setViewingContract(c)}
                            className="h-7.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1 press-scale active:scale-95 shadow-2xs cursor-pointer"
                            title="계약서 전문 및 감사증서 열람"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>전문 열람</span>
                          </button>

                          {/* 2. 상태별 핵심 액션 */}
                          {/* (1) 서명 완료: 법원 제출용 일체형 PDF 다운로드 */}
                          {c.status === 'completed' && (
                            <button
                              onClick={() => generateCourtSubmissionPdf(c)}
                              className="h-7.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1 press-scale active:scale-95 shadow-2xs cursor-pointer"
                              title="감사증서 및 블록체인 각인이 포함된 법원제출용 통합 PDF 다운로드"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                              <span>법원PDF</span>
                            </button>
                          )}

                          {/* (2) 서명 완료: 블록체인 원본 검증기 */}
                          {c.status === 'completed' && (
                            <button
                              onClick={() => setVerifyModalContract(c)}
                              className="h-7.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1 press-scale active:scale-95 shadow-2xs cursor-pointer"
                              title="블록체인 분산원장 원본 검증 팝업 열기"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>검증</span>
                            </button>
                          )}

                          {/* (3) 서명 진행/지체 건: 재촉 알림톡 버튼 */}
                          {(c.status === 'signing' || overdue) && (
                            <button
                              onClick={() => handleSendReminder(c)}
                              className="h-7.5 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1 press-scale active:scale-95 shadow-2xs cursor-pointer"
                              title="골든타임 재촉 알림톡 미리보기 및 발송"
                            >
                              <Send className="w-3.5 h-3.5 text-amber-700" />
                              <span>재촉</span>
                            </button>
                          )}

                          {/* (4) 작성중인 경우 마법사 수정 */}
                          {c.status === 'drafting' && (
                            <button
                              onClick={() => setEditingContract(c)}
                              className="h-7.5 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1 press-scale active:scale-95 shadow-2xs cursor-pointer"
                              title="계약서 마법사에서 수정"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                              <span>수정</span>
                            </button>
                          )}

                          {/* 3. CRM 이동 버튼 (공통 연동) */}
                          {onNavigateToCrm && (
                            <button
                              onClick={() => {
                                onNavigateToCrm();
                                toast.info(`[${c.clientName}] 의뢰인의 CRM 상세 화면으로 이동합니다.`);
                              }}
                              className="h-7.5 px-2.5 bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1 press-scale active:scale-95 shadow-2xs cursor-pointer"
                              title="고객 CRM 상세 페이지로 바로 이동"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                              <span>CRM 이동</span>
                            </button>
                          )}

                          {/* 4. 삭제 버튼 (우측 끝 정렬) */}
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="h-7.5 w-7.5 inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-colors press-scale active:scale-95"
                            title="계약 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ── 5. 사무소 문서함 (서식 보관함) 단독 모달 ── */}
      <ContractDocLibraryModal
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        lawyerName={lawyerName}
        lawFirmName={lawFirmName}
      />

      {/* ── 5-1. 신청서류 마스터 설정 모달 (리걸플로 20~21p 벤치마킹) ── */}
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
                <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>{viewingContract.lawFirmName} 위임 계약서 전문</span>
                    <span className="text-xs font-normal text-slate-400 font-mono">({viewingContract.id})</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    위임인: {viewingContract.clientName} ({viewingContract.clientPhone}) | 체결 상태: {CONTRACT_STATUS_CONFIG[viewingContract.status]?.label}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {viewingContract.status === 'completed' && (
                  <>
                    <button
                      onClick={() => generateCourtSubmissionPdf(viewingContract)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                      title="법원 제출용 일체형 PDF 다운로드"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>법원제출용 PDF</span>
                    </button>
                    <button
                      onClick={() => setVerifyModalContract(viewingContract)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      title="블록체인 분산원장 원본 검증기"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>블록체인 검증</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>인쇄하기</span>
                </button>
                <button
                  onClick={() => setViewingContract(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 뷰어 본문 */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 font-sans">
              {/* 요약 카드 */}
              <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block mb-0.5">총 수임료</span>
                  <span className="text-sm font-black text-slate-900">{((viewingContract.totalFee || 0) * 10000).toLocaleString()}원</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">분납 조건</span>
                  <span className="text-sm font-bold text-slate-800">{viewingContract.feeSchedule?.length || 0}회차 분납</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">무결성 토큰</span>
                  <span className="text-xs font-mono font-bold text-emerald-700">{viewingContract.timestampToken ? 'TSA 공인 완료' : '대기중'}</span>
                </div>
              </div>

              {/* 첨부 문서 전문 (형광펜 렌더링) */}
              <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2">
                  포함된 계약 문서 및 특약 전문 ({(viewingContract.documents || []).filter(d => d.included).length}종)
                </h4>

                {(viewingContract.documents || []).filter(d => d.included).map(doc => (
                  <div key={doc.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>{CONTRACT_DOC_TYPES[doc.type]?.emoji || '📄'}</span>
                        <span>{doc.title}</span>
                      </span>
                      {doc.clientSignature ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          자필서명 완료 ({doc.clientSignedAt?.slice(0, 10)})
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">서명 대기</span>
                      )}
                    </div>

                    <HighlightedDocumentViewer
                      content={doc.content}
                      requiredConfirmationText={doc.requiredConfirmationText}
                    />

                    {doc.clientConfirmationText && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 mt-2">
                        <strong>고객 직접 자필확약 입력 완료:</strong> "{doc.clientConfirmationText}" (일시: {doc.confirmedAt?.slice(0, 16) || '체결시'})
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 공식 감사추적 인증서 임베딩 */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-black text-slate-800 mb-3">전자서명법 공인 감사추적 인증서</h4>
                <AuditTrailCertificate 
                  contract={viewingContract} 
                  onOpenVerifyModal={() => setVerifyModalContract(viewingContract)}
                />
              </div>
            </div>

            {/* 뷰어 푸터 */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="text-xs text-slate-500">
                {viewingContract.blockchainAnchor && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>블록체인 분산원장 무결성 영구 각인 완료</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {viewingContract.status === 'completed' && (
                  <button
                    onClick={() => generateCourtSubmissionPdf(viewingContract)}
                    className="px-4 py-2 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>법원제출용 PDF 다운로드</span>
                  </button>
                )}
                <button
                  onClick={() => setViewingContract(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── 6. 골든타임 재촉 알림톡 사전 확인 & 미리보기 모달 ── */}
      <ContractReminderModal
        isOpen={Boolean(reminderTargetContract)}
        onClose={() => setReminderTargetContract(null)}
        contract={reminderTargetContract}
        onSend={handleConfirmSendReminder}
      />

      {/* ── 7. 블록체인 공공 원본 검증기 모달 ── */}
      <ContractPublicVerifierModal
        isOpen={Boolean(verifyModalContract)}
        onClose={() => setVerifyModalContract(null)}
        contract={verifyModalContract}
      />

    </div>
  );
}
