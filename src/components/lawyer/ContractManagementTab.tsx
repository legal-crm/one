import React, { useState, useMemo } from 'react';
import { FileSignature, Clock, CheckCircle2, Plus, Search, Filter, Eye, Edit2, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract, ContractStatus } from '../../types';
import { CONTRACT_STATUS_CONFIG } from '../../types';
import { loadContracts, saveContract, deleteContract, createContract, seedMockContracts } from '../../services/contractService';
import ContractWizard from './ContractWizard';

interface Props {
  lawyerName: string;
  lawFirmName: string;
}

export default function ContractManagementTab({ lawyerName, lawFirmName }: Props) {
  const [contracts, setContracts] = useState<ElectronicContract[]>(() => { seedMockContracts(); return loadContracts(); });
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');
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

  const kpi = useMemo(() => ({
    total: contracts.length,
    signing: contracts.filter(c => ['pending_sign', 'client_review', 'signing'].includes(c.status)).length,
    completed: contracts.filter(c => c.status === 'completed').length,
  }), [contracts]);

  const handleNewContract = () => {
    const contract = createContract({ clientId: `new-${Date.now()}`, clientName: '', clientPhone: '', lawyerName, lawFirmName });
    setEditingContract(contract);
    refreshContracts();
  };

  const handleDelete = (id: string) => {
    if (!confirm('이 계약서를 삭제하시겠습니까?')) return;
    deleteContract(id);
    refreshContracts();
    toast.success('계약서가 삭제되었습니다');
  };

  if (editingContract) {
    return <ContractWizard contract={editingContract} onClose={() => { setEditingContract(null); refreshContracts(); }} onSave={(c) => { saveContract(c); refreshContracts(); }} />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><FileSignature className="w-6 h-6 text-brand" /> 전자 계약 관리</h2>
          <p className="text-sm text-slate-500 mt-1">팀 전체의 계약 진행 상황을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshContracts} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer" title="새로고침"><RefreshCw className="w-4.5 h-4.5" /></button>
          <button onClick={handleNewContract} className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 transition-colors cursor-pointer whitespace-nowrap min-h-[44px] shadow-sm">
            <Plus className="w-4 h-4" /> 새 계약
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: FileSignature, label: '전체 계약 건수', value: kpi.total, color: 'text-brand', bg: 'bg-brand/10' },
          { icon: Clock, label: '서명 진행중', value: kpi.signing, color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: CheckCircle2, label: '계약 완료', value: kpi.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className={`p-2.5 rounded-xl ${card.bg}`}><card.icon className={`w-5 h-5 ${card.color}`} /></div>
            <div>
              <p className="text-2xl font-black text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 font-medium">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 필터 + 검색 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {(['all', 'drafting', 'pending_sign', 'completed', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${statusFilter === s ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {s === 'all' ? '전체' : CONTRACT_STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="고객명, 사건ID 검색" className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none w-64" />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left p-4 font-bold text-slate-500 text-xs">고객명</th>
              <th className="text-left p-4 font-bold text-slate-500 text-xs">사건 ID</th>
              <th className="text-left p-4 font-bold text-slate-500 text-xs">담당자</th>
              <th className="text-right p-4 font-bold text-slate-500 text-xs">수임료</th>
              <th className="text-center p-4 font-bold text-slate-500 text-xs">진행상태</th>
              <th className="text-left p-4 font-bold text-slate-500 text-xs">최근 업데이트 ↑</th>
              <th className="text-center p-4 font-bold text-slate-500 text-xs">관리</th>
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
                <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-bold text-slate-800">{c.clientName || '(미입력)'}</td>
                  <td className="p-4 text-brand font-medium text-xs">{c.id}</td>
                  <td className="p-4 text-slate-600 text-xs">{c.lawyerName}</td>
                  <td className="p-4 text-right font-bold text-slate-800">{c.totalFee > 0 ? `${(c.totalFee * 10000).toLocaleString()}원` : '-'}</td>
                  <td className="p-4 text-center">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="p-4 text-xs text-slate-500">{new Date(c.updatedAt).toLocaleDateString('ko-KR')}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditingContract(c)} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap"><Eye className="w-3.5 h-3.5" /> 문서보기/편집</button>
                      <button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
