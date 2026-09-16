import React, { useMemo } from 'react';
import { Calendar, FileText, CheckCircle, Clock, Plus, Trash2, CreditCard, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { SalesLead, Partner } from '../../../types/leadTypes';
import { calculateCommission, formatKoreanMoney } from '../../../services/leadService';

interface CaseSettlementTabProps {
  lead: SalesLead;
  partner?: Partner;
  onUpdateLead: (updated: SalesLead) => void;
}

export const CaseSettlementTab: React.FC<CaseSettlementTabProps> = ({
  lead,
  partner,
  onUpdateLead,
}) => {
  // 예상 수당 계산
  const commission = useMemo(() => {
    return calculateCommission(lead.contractFee || 0, partner?.rules);
  }, [lead.contractFee, partner?.rules]);

  // 입금 히스토리 (depositHistory가 없으면 1차, 2차 레거시 필드 매핑)
  const depositHistory = useMemo(() => {
    if (lead.depositHistory && lead.depositHistory.length > 0) {
      return lead.depositHistory;
    }
    return [
      { date: lead.deposit1Date || '', amount: lead.deposit1Amount || 0 },
      { date: lead.deposit2Date || '', amount: lead.deposit2Amount || 0 },
    ];
  }, [lead.depositHistory, lead.deposit1Date, lead.deposit1Amount, lead.deposit2Date, lead.deposit2Amount]);

  // 총 누적 입금액 계산
  const totalDeposited = useMemo(() => {
    return depositHistory.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [depositHistory]);

  // 필드 단건 업데이트
  const handleFieldChange = (field: keyof SalesLead, value: any) => {
    const updated: SalesLead = {
      ...lead,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    onUpdateLead(updated);
  };

  // 입금 항목 추가
  const handleAddDeposit = () => {
    const nextHistory = [...depositHistory, { date: new Date().toISOString().split('T')[0], amount: 0 }];
    const updated: SalesLead = {
      ...lead,
      depositHistory: nextHistory,
      updatedAt: new Date().toISOString(),
    };
    onUpdateLead(updated);
    toast.success(`${nextHistory.length}차 입금 항목이 추가되었습니다.`);
  };

  // 입금 항목 수정
  const handleUpdateDeposit = (index: number, patch: Partial<{ date: string; amount: number }>) => {
    const nextHistory = depositHistory.map((item, idx) => {
      if (idx === index) {
        return { ...item, ...patch };
      }
      return item;
    });

    const updated: SalesLead = {
      ...lead,
      depositHistory: nextHistory,
      // 1차, 2차 레거시 동기화
      deposit1Date: nextHistory[0]?.date,
      deposit1Amount: nextHistory[0]?.amount,
      deposit2Date: nextHistory[1]?.date,
      deposit2Amount: nextHistory[1]?.amount,
      updatedAt: new Date().toISOString(),
    };
    onUpdateLead(updated);
  };

  // 입금 항목 삭제 (3차 이상부터 삭제 가능)
  const handleRemoveDeposit = (index: number) => {
    if (depositHistory.length <= 2) {
      toast.error('기본 1차 및 2차 입금 항목은 삭제할 수 없습니다.');
      return;
    }
    const nextHistory = depositHistory.filter((_, idx) => idx !== index);
    const updated: SalesLead = {
      ...lead,
      depositHistory: nextHistory,
      updatedAt: new Date().toISOString(),
    };
    onUpdateLead(updated);
    toast.success('입금 항목이 삭제되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* ── 1. 정산 배치 정보 카드 ── */}
      <div className="bg-blue-50/70 p-5 md:p-6 rounded-3xl border border-blue-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
          <h3 className="font-extrabold text-blue-900 text-base flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            정산 배치 정보
          </h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            {partner?.name || '자체 마케팅'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">정산 주차</span>
            <span className="font-black text-slate-800 text-sm">
              {lead.contractAt ? `${lead.contractAt.slice(0, 7)} 정산` : '미배정 (계약일 입력 필요)'}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">정산 기간</span>
            <span className="font-bold text-slate-700 text-sm">
              {lead.contractAt ? `${lead.contractAt} 기준 월간` : '-'}
            </span>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 block mb-0.5">정산 상태</span>
            <span className="inline-flex items-center gap-1 font-extrabold text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle size={12} />
              {lead.contractFee && lead.contractFee > 0 ? '수임 확정' : '상담 진행중'}
            </span>
          </div>
        </div>

        <p className="text-xs text-blue-700/80 pt-1">
          💡 계약완료일 입력 시 해당 주차의 정산 배치에 자동으로 포함되어 세무 및 수수료 정산에 반영됩니다.
        </p>
      </div>

      {/* ── 2. 계약 및 수임료 카드 ── */}
      <div className="bg-emerald-50/50 p-5 md:p-6 rounded-3xl border border-emerald-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
          <h3 className="font-extrabold text-emerald-950 text-base flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-700" />
            계약 및 수임료
          </h3>
          <span className="text-xs text-emerald-800 font-medium">수임 계약 조건 및 예상 수당</span>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Left: 날짜 및 분납 개월 */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                계약완료일 (정산기준)
              </label>
              <input
                type="date"
                className="w-full p-2.5 text-xs sm:text-sm font-semibold border border-emerald-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                value={lead.contractAt || ''}
                onChange={e => handleFieldChange('contractAt', e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-emerald-900">
                  분납 개월
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                  <input
                    type="checkbox"
                    className="accent-blue-600 rounded cursor-pointer"
                    checked={lead.useCapital || false}
                    onChange={e => handleFieldChange('useCapital', e.target.checked)}
                  />
                  <span>캐피탈 연계</span>
                </label>
              </div>
              <select
                className="w-full p-2.5 text-xs sm:text-sm font-semibold border border-emerald-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                value={lead.installmentMonths || ''}
                onChange={e => handleFieldChange('installmentMonths', e.target.value)}
              >
                <option value="">선택하세요</option>
                {!lead.useCapital && <option value="완납">완납 (일시불)</option>}
                {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                  <option key={num} value={`${num}개월`}>{num}개월 분납</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: 총 수임료 및 수당 */}
          <div className="bg-white p-4 rounded-2xl border border-emerald-200 flex flex-col justify-between shadow-2xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                총 수임료 (만원 단위)
              </label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full p-2.5 text-base font-black border border-slate-300 rounded-xl focus:border-emerald-600 outline-hidden text-right pr-12"
                  value={lead.contractFee || ''}
                  placeholder="0"
                  onChange={e => handleFieldChange('contractFee', Number(e.target.value) || 0)}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">만원</span>
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {[150, 180, 200, 250, 300].map(fee => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => handleFieldChange('contractFee', fee)}
                    className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg transition-colors cursor-pointer"
                  >
                    {fee}만
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">예상 수당 (Commission):</span>
              <span className={`text-xl font-black ${commission > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                {commission.toLocaleString()}만원
              </span>
            </div>

            {commission === 0 && (lead.contractFee || 0) > 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2">
                ⚠️ 적용된 수당 정책이 없거나 0원입니다. 제휴처 설정을 확인해주세요.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. 입금 내역 카드 ── */}
      <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">입금 내역</h3>
            <p className="text-xs text-slate-400">착수금 및 분납금 입금 일자와 금액을 관리합니다.</p>
          </div>
          <button
            type="button"
            onClick={handleAddDeposit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus size={14} />
            <span>추가 ({depositHistory.length + 1}차)</span>
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          {depositHistory.map((deposit, idx) => (
            <div key={idx} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 relative group">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-700 px-2 py-0.5 bg-white rounded-lg border border-slate-200">
                  {idx + 1}차 입금
                </span>
                {idx >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDeposit(idx)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                    title="삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">금액 (만원)</label>
                  <input
                    type="number"
                    className="w-full p-2 text-xs sm:text-sm font-black border border-slate-300 rounded-xl bg-white focus:border-blue-500 outline-hidden"
                    value={deposit.amount || ''}
                    placeholder="0"
                    onChange={e => handleUpdateDeposit(idx, { amount: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">입금일</label>
                  <input
                    type="date"
                    className="w-full p-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:border-blue-500 outline-hidden"
                    value={deposit.date || ''}
                    onChange={e => handleUpdateDeposit(idx, { date: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
          <span className="font-bold text-sm text-slate-700">총 누적 입금액:</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-600">
              {totalDeposited.toLocaleString()}
            </span>
            <span className="text-sm font-bold text-blue-600">만원</span>
            {lead.contractFee && lead.contractFee > 0 && (
              <span className="text-xs text-slate-400 ml-2">
                (수임료 대비 {Math.round((totalDeposited / lead.contractFee) * 100)}% 완료)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
