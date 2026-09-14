// src/components/lawyer/filing/CreditorManagementModal.tsx
// ============================================================
// [대법원 전산양식 R02] 개인회생 채권자목록 실시간 추가·수정·삭제 및 CSV 추출 모달
// - 채권자 목록 테이블 (우선권/담보부/신용 구분)
// - 50대 금융기관 프리셋 검색을 통한 원클릭 채권자 추가
// - 채권 원금, 발생이자, 송달장소 즉시 수정 및 삭제
// - 대법원 전자소송 UTF-8 BOM CSV 즉시 다운로드
// ============================================================

import React, { useState, useMemo } from 'react';
import { 
  X, Plus, Trash2, Edit3, Save, FileSpreadsheet, Download, 
  Search, ShieldAlert, CheckCircle2, AlertCircle, Building2,
  DollarSign, MapPin, ArrowUpDown, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { RepaymentCreditor } from '../../../services/repayment/repaymentTypes';
import { CREDITOR_DIRECTORY, type CreditorDirectoryItem } from '../../../services/court/creditorAddressDirectory';
import { CourtBatchFilingService } from '../../../services/court/CourtBatchFilingService';

interface CreditorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
}

export default function CreditorManagementModal({
  isOpen,
  onClose,
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
}: CreditorManagementModalProps) {
  if (!isOpen) return null;

  const clientName = clientRequest.clientName || '신청인';
  const currentPlan = crmExt.repaymentPlan;
  
  // 초기 채권자 목록 세팅
  const [creditors, setCreditors] = useState<RepaymentCreditor[]>(() => {
    return (currentPlan?.creditors || []).map((c, i) => ({
      ...c,
      creditorNumber: c.creditorNumber || i + 1,
    }));
  });

  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 편집 중인 채권자 (신규 추가 시 id: 'new')
  const [editingCreditor, setEditingCreditor] = useState<Partial<RepaymentCreditor> | null>(null);

  // 디렉토리 자동완성 검색
  const [dirSearch, setDirSearch] = useState('');
  const [showDirDropdown, setShowDirDropdown] = useState(false);

  const filteredDirectory = useMemo(() => {
    if (!dirSearch.trim()) return CREDITOR_DIRECTORY.slice(0, 10);
    const q = dirSearch.toLowerCase();
    return CREDITOR_DIRECTORY.filter(item => 
      item.officialName.toLowerCase().includes(q) ||
      item.alias.some(a => a.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [dirSearch]);

  // 통계 집계
  const stats = useMemo(() => {
    const count = creditors.length;
    const totalPrincipal = creditors.reduce((sum, c) => sum + (Number(c.principal) || 0), 0);
    const totalInterest = creditors.reduce((sum, c) => sum + (Number(c.interest) || 0), 0);
    const totalDebt = totalPrincipal + totalInterest;
    return { count, totalPrincipal, totalInterest, totalDebt };
  }, [creditors]);

  // 검색 필터링된 채권자 목록
  const displayedCreditors = useMemo(() => {
    if (!searchTerm.trim()) return creditors;
    const q = searchTerm.toLowerCase();
    return creditors.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.debtCauseDetail && c.debtCauseDetail.toLowerCase().includes(q))
    );
  }, [creditors, searchTerm]);

  // 새 채권자 추가 모드 열기
  const handleOpenAddCreditor = () => {
    setEditingCreditor({
      id: `creditor-${Date.now()}`,
      creditorNumber: creditors.length + 1,
      name: '',
      principal: 10000000,
      interest: 0,
      isSecured: false,
      isPriority: false,
      isUnconfirmed: false,
      debtCauseDetail: '신용대출',
      borrowedDate: new Date().toISOString().split('T')[0],
      address: '',
      serviceAddress: '',
      representative: '',
      allocationRatio: 0,
      monthlyRepayment: 0,
      totalRepayment: 0,
      repaymentRate: 0,
    });
    setDirSearch('');
    setShowDirDropdown(false);
  };

  // 기존 채권자 편집 모드 열기
  const handleOpenEditCreditor = (creditor: RepaymentCreditor) => {
    setEditingCreditor({ ...creditor });
    setDirSearch(creditor.name);
    setShowDirDropdown(false);
  };

  // 프리셋 선택 시 채권자 정보 자동 입력
  const handleSelectPreset = (item: CreditorDirectoryItem) => {
    setEditingCreditor(prev => ({
      ...prev,
      name: item.officialName,
      representative: item.representative,
      address: item.address,
      serviceAddress: item.serviceAddress,
      isPriority: item.isPriorityDefault || false,
    }));
    setDirSearch(item.officialName);
    setShowDirDropdown(false);
  };

  // 편집 중인 채권자 저장 (목록에 반영)
  const handleSaveEditingCreditor = () => {
    if (!editingCreditor || !editingCreditor.name?.trim()) {
      toast.error('채권자명을 반드시 입력해 주세요.');
      return;
    }

    const principalNum = Number(editingCreditor.principal) || 0;
    const interestNum = Number(editingCreditor.interest) || 0;

    const finalizedCreditor: RepaymentCreditor = {
      id: editingCreditor.id || `creditor-${Date.now()}`,
      creditorNumber: editingCreditor.creditorNumber || creditors.length + 1,
      name: editingCreditor.name.trim(),
      principal: principalNum,
      interest: interestNum,
      isSecured: Boolean(editingCreditor.isSecured),
      securedValue: editingCreditor.isSecured ? (Number(editingCreditor.securedValue) || 0) : undefined,
      isPriority: Boolean(editingCreditor.isPriority),
      isUnconfirmed: Boolean(editingCreditor.isUnconfirmed),
      debtCauseDetail: editingCreditor.debtCauseDetail || '신용대출',
      borrowedDate: editingCreditor.borrowedDate || new Date().toISOString().split('T')[0],
      address: editingCreditor.address || '',
      serviceAddress: editingCreditor.serviceAddress || editingCreditor.address || '',
      representative: editingCreditor.representative || '',
      allocationRatio: editingCreditor.allocationRatio || 0,
      monthlyRepayment: editingCreditor.monthlyRepayment || 0,
      totalRepayment: editingCreditor.totalRepayment || 0,
      repaymentRate: editingCreditor.repaymentRate || 0,
    };

    setCreditors(prev => {
      const exists = prev.some(c => c.id === finalizedCreditor.id);
      if (exists) {
        return prev.map(c => c.id === finalizedCreditor.id ? finalizedCreditor : c);
      } else {
        return [...prev, finalizedCreditor].map((c, i) => ({ ...c, creditorNumber: i + 1 }));
      }
    });

    setEditingCreditor(null);
    toast.success(`'${finalizedCreditor.name}' 채권정보가 반영되었습니다.`);
  };

  // 채권자 삭제
  const handleDeleteCreditor = (id: string, name: string) => {
    if (!window.confirm(`'${name}' 채권사를 채권자목록에서 완전히 삭제하시겠습니까?`)) {
      return;
    }

    setCreditors(prev => {
      const next = prev.filter(c => c.id !== id);
      return next.map((c, i) => ({ ...c, creditorNumber: i + 1 }));
    });
    toast.info(`'${name}' 채권사가 삭제되었습니다.`);
  };

  // 대법원 전자소송 규격 CSV 다운로드
  const handleDownloadCsv = () => {
    if (creditors.length === 0) {
      toast.warning('등록된 채권자가 없습니다.');
      return;
    }
    const csv = CourtBatchFilingService.generateCourtCreditorCsv(creditors, clientName);
    CourtBatchFilingService.downloadCsv(csv, `[대법원전자소송]_${clientName}_채권자목록_등록양식.csv`);
    toast.success('대법원 전자소송 UTF-8 BOM CSV 파일이 다운로드되었습니다.');
  };

  // 전체 변경사항 최종 서버/CRM 저장
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      const totalPrincipal = creditors.reduce((sum, c) => sum + (Number(c.principal) || 0), 0);
      const totalInterest = creditors.reduce((sum, c) => sum + (Number(c.interest) || 0), 0);

      const updatedPlan = {
        ...(currentPlan || ({} as any)),
        creditors,
        totalPrincipal,
        totalInterest,
        totalDebt: totalPrincipal + totalInterest,
      };

      await onUpdateCrmExt({
        repaymentPlan: updatedPlan
      });

      toast.success('개인회생 채권자목록(R02)이 성공적으로 저장되었습니다.');
      onClose();
    } catch (err) {
      console.error('Failed to save creditors:', err);
      toast.error('채권자목록 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
        <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] max-h-[calc(100vh-2.5rem)] animate-fadeIn">
        {/* 상단 헤더 */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">
                  개인회생 채권자목록 관리 및 편집 (R02)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  대법원 전자소송 규격
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                채권자 추가/수정/삭제 및 원금·이자·송달주소를 검증하고 대법원 제출용 CSV를 추출합니다.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 통계 요약 바 */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
          <div className="bg-white p-3 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-medium">총 채권자수</span>
            <div className="text-base font-extrabold text-slate-900 mt-0.5">{stats.count}개소</div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-medium">채무 원금 합계</span>
            <div className="text-base font-extrabold text-blue-700 mt-0.5">{stats.totalPrincipal.toLocaleString()}원</div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-medium">개시전 이자 합계</span>
            <div className="text-base font-extrabold text-amber-700 mt-0.5">{stats.totalInterest.toLocaleString()}원</div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-slate-200">
            <span className="text-slate-500 font-medium">총 채무액 합계</span>
            <div className="text-base font-extrabold text-emerald-700 mt-0.5">{stats.totalDebt.toLocaleString()}원</div>
          </div>
        </div>

        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* 상단 툴바 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="채권자명, 차용원인 검색..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer press-scale"
              >
                <Download className="w-3.5 h-3.5" />
                <span>대법원 CSV 다운로드</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddCreditor}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer press-scale"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>채권자 추가</span>
              </button>
            </div>
          </div>

          {/* 채권자 추가 / 수정 폼 드로어 */}
          {editingCreditor && (
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-blue-900 text-xs flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>{editingCreditor.id?.startsWith('creditor-') ? '신규 채권자 등록' : `'${editingCreditor.name}' 채권정보 수정`}</span>
                </h4>
                <button 
                  type="button" 
                  onClick={() => setEditingCreditor(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 디렉토리 검색 프리셋 */}
              <div className="relative">
                <label className="block text-slate-700 font-bold mb-1">
                  금융기관·공공기관 공식 프리셋 검색 (원클릭 자동완성)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dirSearch}
                    onChange={(e) => {
                      setDirSearch(e.target.value);
                      setShowDirDropdown(true);
                    }}
                    onFocus={() => setShowDirDropdown(true)}
                    placeholder="예: 국민은행, 현대카드, 산와머니, SBI 등 입력..."
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirDropdown(prev => !prev)}
                    className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-bold flex items-center gap-1"
                  >
                    <span>목록</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showDirDropdown && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-300 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredDirectory.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPreset(item)}
                        className="w-full text-left p-2.5 hover:bg-blue-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{item.officialName}</span>
                          <span className="text-[10px] text-slate-500 ml-2">대표: {item.representative}</span>
                          <p className="text-[11px] text-slate-400 truncate">{item.serviceAddress}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold shrink-0">
                          {item.categoryLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 채권 세부 입력 필드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">채권자 정식 명칭 *</label>
                  <input
                    type="text"
                    value={editingCreditor.name || ''}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 주식회사 국민은행"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">채권 원금 (원) *</label>
                  <input
                    type="number"
                    value={editingCreditor.principal ?? ''}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, principal: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">개시전 이자 (원)</label>
                  <input
                    type="number"
                    value={editingCreditor.interest ?? ''}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, interest: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">차용원인</label>
                  <input
                    type="text"
                    value={editingCreditor.debtCauseDetail || ''}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, debtCauseDetail: e.target.value }))}
                    placeholder="예: 신용대출, 카드론, 물품대금"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">차용일자</label>
                  <input
                    type="date"
                    value={editingCreditor.borrowedDate || ''}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, borrowedDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">법인 대표자</label>
                  <input
                    type="text"
                    value={editingCreditor.representative || ''}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, representative: e.target.value }))}
                    placeholder="예: 은행장 이재근"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">법원 우편물 송달장소 주소 *</label>
                <input
                  type="text"
                  value={editingCreditor.serviceAddress || ''}
                  onChange={(e) => setEditingCreditor(prev => ({ ...prev, serviceAddress: e.target.value }))}
                  placeholder="대법원 전자소송 송달용 본점 또는 송달팀 주소"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* 채권 성격 체크박스 */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingCreditor.isSecured)}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, isSecured: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span className="font-bold text-slate-800 text-xs">별제권부(담보부) 채권</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingCreditor.isPriority)}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, isPriority: e.target.checked }))}
                    className="rounded text-amber-600"
                  />
                  <span className="font-bold text-slate-800 text-xs">일반 우선권 채권 (국세/지방세/4대보험)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingCreditor.isUnconfirmed)}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, isUnconfirmed: e.target.checked }))}
                    className="rounded text-slate-600"
                  />
                  <span className="font-bold text-slate-800 text-xs">미확정 채권 (보증채무 등)</span>
                </label>
              </div>

              {editingCreditor.isSecured && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                  <span className="text-xs font-bold text-amber-900 shrink-0">담보물 예상 환가액:</span>
                  <input
                    type="number"
                    value={editingCreditor.securedValue ?? ''}
                    onChange={(e) => setEditingCreditor(prev => ({ ...prev, securedValue: Number(e.target.value) }))}
                    placeholder="담보물 가액"
                    className="w-48 px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-mono text-xs"
                  />
                  <span className="text-[11px] text-amber-700">※ 별제권 행사 후 부족액만 일반회생채권으로 안분됩니다.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCreditor(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  입력 취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditingCreditor}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>목록에 반영</span>
                </button>
              </div>
            </div>
          )}

          {/* 채권자 목록 테이블 */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">채권자명 / 차용원인</th>
                  <th className="p-3 w-24 text-center">구분</th>
                  <th className="p-3 text-right">채무원금</th>
                  <th className="p-3 text-right">개시전이자</th>
                  <th className="p-3">법원 송달장소</th>
                  <th className="p-3 w-20 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCreditors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      등록된 채권자가 없습니다. 상단 [+ 채권자 추가] 버튼을 눌러 채권자를 등록해 주세요.
                    </td>
                  </tr>
                ) : (
                  displayedCreditors.map((creditor, idx) => (
                    <tr key={creditor.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-mono font-bold text-slate-400">
                        {creditor.creditorNumber || idx + 1}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{creditor.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {creditor.debtCauseDetail || '신용대출'} · {creditor.borrowedDate || '일자 미상'}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {creditor.isPriority ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">
                            우선권
                          </span>
                        ) : creditor.isSecured ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                            담보부
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px]">
                            신용
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {Number(creditor.principal).toLocaleString()}원
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {Number(creditor.interest || 0).toLocaleString()}원
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={creditor.serviceAddress}>
                        {creditor.serviceAddress || '-'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCreditor(creditor)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors cursor-pointer"
                            title="채권 수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCreditor(creditor.id, creditor.name)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors cursor-pointer"
                            title="채권 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 하단 버튼 영역 */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer press-scale"
          >
            닫기
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer press-scale"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '저장 중...' : '채권자목록 전체 저장 (CRM 반영)'}</span>
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
