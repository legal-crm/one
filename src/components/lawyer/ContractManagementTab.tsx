import React, { useState, useMemo } from 'react';
import { FileSignature, Clock, CheckCircle2, Plus, Search, Eye, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import type { ElectronicContract, ContractStatus } from '../../types';
import { CONTRACT_STATUS_CONFIG } from '../../types';
import { loadContracts, saveContract, deleteContract, createContract, seedMockContracts } from '../../services/contractService';
import ContractWizard from './ContractWizard';

interface Props {
  lawyerName: string;
  lawFirmName: string;
}

export default function ContractManagementTab({ lawyerName, lawFirmName }: Props) {
  const dialog = useDialog();
  const [contracts, setContracts] = useState<ElectronicContract[]>(() => { seedMockContracts(); return loadContracts(); });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContract, setEditingContract] = useState<ElectronicContract | null>(null);

  const refreshContracts = () => setContracts(loadContracts());

  const filtered = useMemo(() => {
    let list = contracts;
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.clientName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    return list;
  }, [contracts, statusFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: contracts.length,
    drafting: contracts.filter(c => c.status === 'drafting').length,
    signing: contracts.filter(c => ['pending_sign', 'client_review', 'signing'].includes(c.status)).length,
    completed: contracts.filter(c => c.status === 'completed').length,
    cancelled: contracts.filter(c => c.status === 'cancelled').length,
  }), [contracts]);

  const handleNewContract = () => {
    const contract = createContract({ clientId: `new-${Date.now()}`, clientName: '', clientPhone: '', lawyerName, lawFirmName });
    setEditingContract(contract);
    refreshContracts();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: '계약서 삭제',
      message: '이 계약서를 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;
    deleteContract(id);
    refreshContracts();
    toast.success('계약서가 삭제되었습니다');
  };

  if (editingContract) {
    return <ContractWizard contract={editingContract} onClose={() => { setEditingContract(null); refreshContracts(); }} onSave={(c) => { saveContract(c); refreshContracts(); }} />;
  }

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* ── 헤더 통계 (CRM과 동일 패턴) ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <FileSignature className="w-6 h-6 text-brand" />
              <span>전자 계약 관리</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">팀 전체의 계약 진행 상황을 관리합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshContracts} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer" title="새로고침"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={handleNewContract} className="flex items-center gap-2 px-4 py-2.5 bg-[#1E3A5F] text-white font-bold rounded-xl hover:bg-[#162d4a] transition-colors cursor-pointer whitespace-nowrap min-h-[44px] shadow-xs text-sm">
              <Plus className="w-4 h-4" /> 새 계약
            </button>
          </div>
        </div>

        {/* 통계 카드 (CRM과 동일 모노크롬 스타일) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{stats.total}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">전체 계약</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight tabular-nums">{stats.drafting}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">✏️ 작성중</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${stats.signing > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{stats.signing}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">⏳ 서명 진행중</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${stats.completed > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{stats.completed}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">✅ 계약 완료</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 text-center">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${stats.cancelled > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{stats.cancelled}</div>
            <div className="text-xs text-slate-500 font-bold mt-1">❌ 취소</div>
          </div>
        </div>
      </div>

      {/* ── 빠른 필터 (CRM과 동일) ── */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all', label: '전체 계약', icon: '📋', count: stats.total },
          { key: 'drafting', label: '작성중', icon: '✏️', count: stats.drafting },
          { key: 'signing', label: '서명 진행', icon: '⏳', count: stats.signing },
          { key: 'completed', label: '완료', icon: '✅', count: stats.completed },
        ] as const).map(f => (
          <button key={f.key} onClick={() => { setStatusFilter(f.key === 'signing' ? 'pending_sign' : f.key); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer border ${
              (f.key === 'all' && statusFilter === 'all') ||
              (f.key === 'drafting' && statusFilter === 'drafting') ||
              (f.key === 'signing' && statusFilter === 'pending_sign') ||
              (f.key === 'completed' && statusFilter === 'completed')
                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}>
            <span>{f.icon}</span>
            <span>{f.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-black ${
              (f.key === 'all' && statusFilter === 'all') ||
              (f.key === 'drafting' && statusFilter === 'drafting') ||
              (f.key === 'signing' && statusFilter === 'pending_sign') ||
              (f.key === 'completed' && statusFilter === 'completed')
                ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* ── 검색 (CRM과 동일 카드 래퍼) ── */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full sm:max-w-xs">
          <input type="text" placeholder="고객명 또는 사건ID 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400" />
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        </div>
        <div className="flex flex-wrap gap-2.5 w-full sm:w-auto justify-end items-center">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-700 font-medium">
            <option value="all">상태: 전체</option>
            {(Object.entries(CONTRACT_STATUS_CONFIG) as [ContractStatus, any][]).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 테이블 (CRM과 동일) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">고객명</th>
              <th className="text-left p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">사건 ID</th>
              <th className="text-left p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">담당자</th>
              <th className="text-right p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">수임료</th>
              <th className="text-center p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">진행상태</th>
              <th className="text-left p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">최근 업데이트 ↑</th>
              <th className="text-center p-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center">
                <FileSignature className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-400 mt-2 font-medium">계약 건이 없습니다</p>
                <button onClick={handleNewContract} className="mt-3 text-xs text-brand font-bold hover:underline cursor-pointer">+ 새 계약 작성하기</button>
              </td></tr>
            ) : filtered.map(c => {
              const cfg = CONTRACT_STATUS_CONFIG[c.status];
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-800 text-sm">{c.clientName || '(미입력)'}</div>
                    {c.clientPhone && <div className="text-xs text-slate-400 mt-0.5">{c.clientPhone}</div>}
                  </td>
                  <td className="p-3.5 text-brand font-semibold text-sm">{c.id}</td>
                  <td className="p-3.5 text-slate-600 text-sm">{c.lawyerName}</td>
                  <td className="p-3.5 text-right font-bold text-sm text-slate-800">{c.totalFee > 0 ? <><span className="text-brand">{(c.totalFee * 10000).toLocaleString()}</span>원</> : '-'}</td>
                  <td className="p-3.5 text-center">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cfg.bgColor} ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                  </td>
                  <td className="p-3.5 text-sm text-slate-500">{new Date(c.updatedAt).toLocaleDateString('ko-KR')}</td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditingContract(c)} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap transition-colors"><Eye className="w-3.5 h-3.5" /> 문서보기/편집</button>
                      <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 cursor-pointer transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
