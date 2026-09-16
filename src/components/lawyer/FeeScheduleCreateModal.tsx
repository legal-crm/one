import React, { useState, useMemo } from 'react';
import { X, Calendar, DollarSign, Calculator, Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConsultRequest, FeeInstallment } from '../../types';
import ModalPortal from '../common/ModalPortal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clients: ConsultRequest[];
  selectedClientId?: string;
  onSaveSchedule: (clientId: string, totalFee: number, schedule: FeeInstallment[]) => Promise<void> | void;
}

export default function FeeScheduleCreateModal({
  isOpen,
  onClose,
  clients,
  selectedClientId: initialClientId,
  onSaveSchedule,
}: Props) {
  const [targetClientId, setTargetClientId] = useState<string>(initialClientId || (clients[0]?.id || ''));
  const [totalFeeWon, setTotalFeeWon] = useState<number>(2500000);
  const [downPaymentWon, setDownPaymentWon] = useState<number>(1000000);
  const [installmentMonths, setInstallmentMonths] = useState<number>(3);
  const [monthlyDueDay, setMonthlyDueDay] = useState<number>(10);
  const [startYearMonth, setStartYearMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // 자동 계산된 분납 스케줄
  const [previewSchedule, setPreviewSchedule] = useState<FeeInstallment[]>([]);
  const [isGenerated, setIsGenerated] = useState<boolean>(false);

  // 대상 의뢰인 변경 시 동기화
  React.useEffect(() => {
    if (initialClientId) {
      setTargetClientId(initialClientId);
    }
  }, [initialClientId]);

  // 분납 일정 자동 생성 로직
  const handleGenerateSchedule = () => {
    if (totalFeeWon <= 0) {
      toast.error('총 수임료를 0원 이상 입력해주세요.');
      return;
    }
    if (downPaymentWon > totalFeeWon) {
      toast.error('착수금이 총 수임료보다 클 수 없습니다.');
      return;
    }

    const remainingAmount = totalFeeWon - downPaymentWon;
    const schedule: FeeInstallment[] = [];

    // 1. 착수금 (선납 완료 상태)
    if (downPaymentWon > 0) {
      schedule.push({
        id: `inst-${Date.now()}-0`,
        round: 1,
        amount: downPaymentWon,
        dueDate: new Date().toISOString().split('T')[0],
        paidDate: new Date().toISOString().split('T')[0],
        status: 'paid',
        memo: '착수금 (계약 선납)',
        paymentMethod: '계좌이체',
      });
    }

    // 2. 나머지 잔금 분납
    if (remainingAmount > 0 && installmentMonths > 0) {
      const perMonthBase = Math.floor(remainingAmount / installmentMonths);
      const remainder = remainingAmount - (perMonthBase * installmentMonths);

      const [yearStr, monthStr] = startYearMonth.split('-');
      let currentYear = parseInt(yearStr, 10);
      let currentMonth = parseInt(monthStr, 10);

      for (let i = 0; i < installmentMonths; i++) {
        // 마지막 회차에 단수 절사 차액 합산
        const amount = i === installmentMonths - 1 ? perMonthBase + remainder : perMonthBase;
        
        // 날짜 계산 (말일 초과 방지)
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const effectiveDay = Math.min(monthlyDueDay, daysInMonth);
        const dueDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;

        schedule.push({
          id: `inst-${Date.now()}-${i + 1}`,
          round: schedule.length + 1,
          amount,
          dueDate,
          status: 'pending',
          memo: `${i + 1}회차 분납`,
        });

        // 다음 달로 증가
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    }

    setPreviewSchedule(schedule);
    setIsGenerated(true);
    toast.success(`총 ${schedule.length}회차 분납 일정이 생성되었습니다.`);
  };

  // 회차별 수기 수정 핸들러
  const handleAmountChange = (index: number, newAmount: number) => {
    setPreviewSchedule(prev => {
      const next = [...prev];
      next[index] = { ...next[index], amount: Math.max(0, newAmount) };
      return next;
    });
  };

  const handleDueDateChange = (index: number, newDate: string) => {
    setPreviewSchedule(prev => {
      const next = [...prev];
      next[index] = { ...next[index], dueDate: newDate };
      return next;
    });
  };

  const handleMemoChange = (index: number, newMemo: string) => {
    setPreviewSchedule(prev => {
      const next = [...prev];
      next[index] = { ...next[index], memo: newMemo };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setPreviewSchedule(prev => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((item, idx) => ({ ...item, round: idx + 1 }));
    });
  };

  const handleAddItem = () => {
    setPreviewSchedule(prev => {
      const last = prev[prev.length - 1];
      const newRound = prev.length + 1;
      let nextDueDate = new Date().toISOString().split('T')[0];
      if (last?.dueDate) {
        const d = new Date(last.dueDate);
        d.setMonth(d.getMonth() + 1);
        nextDueDate = d.toISOString().split('T')[0];
      }
      return [
        ...prev,
        {
          id: `inst-custom-${Date.now()}`,
          round: newRound,
          amount: 300000,
          dueDate: nextDueDate,
          status: 'pending',
          memo: `${newRound}회차 추가 분납`,
        }
      ];
    });
  };

  // 총 합계 검증
  const totalCalculated = useMemo(() => {
    return previewSchedule.reduce((sum, item) => sum + item.amount, 0);
  }, [previewSchedule]);

  // 최종 저장
  const handleSave = async () => {
    if (!targetClientId) {
      toast.error('의뢰인을 선택해주세요.');
      return;
    }
    if (previewSchedule.length === 0) {
      toast.error('분납 일정을 생성해주세요.');
      return;
    }

    try {
      await onSaveSchedule(targetClientId, totalCalculated, previewSchedule);
      toast.success('수임료 분납 일정이 성공적으로 저장되었습니다.');
      onClose();
    } catch (e: any) {
      toast.error('분납 일정 저장 중 오류가 발생했습니다: ' + (e?.message || e));
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
          
          {/* 헤더 */}
          <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">수임료 분납 일정 등록 / 재설정</h3>
                <p className="text-xs text-slate-400">착수금과 잔금 분납 개월 수를 입력하면 자동으로 매월 일정을 계산합니다.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 바디 스크롤 영역 */}
          <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
            
            {/* 1. 의뢰인 선택 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">대상 의뢰인 선택</label>
              <select
                value={targetClientId}
                onChange={e => setTargetClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-hidden"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.clientName || '고객'} {c.phone ? `(${c.phone})` : ''} - {c.caseType === 'bankruptcy' ? '개인파산' : '개인회생'}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. 금액 및 분납 조건 설정 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">총 수임료 (원)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="100000"
                    value={totalFeeWon}
                    onChange={e => setTotalFeeWon(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₩</span>
                </div>
                <p className="text-[11px] text-slate-500">{(totalFeeWon / 10000).toLocaleString()}만 원</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">계약 착수금 (원)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="100000"
                    value={downPaymentWon}
                    onChange={e => setDownPaymentWon(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-emerald-600 font-bold">₩</span>
                </div>
                <p className="text-[11px] text-slate-500">{(downPaymentWon / 10000).toLocaleString()}만 원 (계약 당일 수납)</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">잔금 분납 개월 수</label>
                <select
                  value={installmentMonths}
                  onChange={e => setInstallmentMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  <option value={1}>1개월 (일시 잔금)</option>
                  <option value={2}>2개월 분납</option>
                  <option value={3}>3개월 분납 (가장 흔함)</option>
                  <option value={4}>4개월 분납</option>
                  <option value={5}>5개월 분납</option>
                  <option value={6}>6개월 분납 (표준)</option>
                  <option value={8}>8개월 분납</option>
                  <option value={10}>10개월 분납 (장기)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">매월 납부 지정일 (급여일 등)</label>
                <div className="flex gap-2">
                  <select
                    value={monthlyDueDay}
                    onChange={e => setMonthlyDueDay(Number(e.target.value))}
                    className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    {[5, 10, 15, 20, 25, 28, 30].map(day => (
                      <option key={day} value={day}>매월 {day}일</option>
                    ))}
                  </select>
                  <input
                    type="month"
                    value={startYearMonth}
                    onChange={e => setStartYearMonth(e.target.value)}
                    className="w-1/2 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 계산 실행 버튼 */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateSchedule}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all press-scale cursor-pointer"
              >
                <Calculator className="w-4 h-4" />
                <span>분납 회차 자동 생성하기</span>
              </button>
            </div>

            {/* 3. 생성된 분납 회차 테이블 및 직접 편집 */}
            {isGenerated && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>분납 회차별 일정 미리보기</span>
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      총 {previewSchedule.length}회차
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>회차 추가</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-14 text-center">회차</th>
                        <th className="py-2.5 px-3">항목 / 메모</th>
                        <th className="py-2.5 px-3 w-32">납부 예정일</th>
                        <th className="py-2.5 px-3 w-32 text-right">금액 (원)</th>
                        <th className="py-2.5 px-3 w-20 text-center">상태</th>
                        <th className="py-2.5 px-2 w-10 text-center">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {previewSchedule.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">{item.round}차</td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.memo || ''}
                              onChange={e => handleMemoChange(idx, e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="date"
                              value={item.dueDate}
                              onChange={e => handleDueDateChange(idx, e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              step="50000"
                              value={item.amount}
                              onChange={e => handleAmountChange(idx, Number(e.target.value))}
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-right text-slate-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.status === 'paid' ? '납부완료' : '대기중'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-right text-slate-500">
                          합계 금액 (입력 총액: ₩{totalFeeWon.toLocaleString()})
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-600 font-black">
                          ₩{totalCalculated.toLocaleString()}
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-center">
                          {totalCalculated === totalFeeWon ? (
                            <span className="text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> 일치
                            </span>
                          ) : (
                            <span className="text-[11px] text-rose-500 font-bold flex items-center justify-center gap-1">
                              <AlertCircle className="w-3 h-3" /> 차액 발생
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

          </div>

          {/* 푸터 액션 버튼 */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={previewSchedule.length === 0}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#1E3A5F] hover:bg-[#163152] disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5 press-scale cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>분납 일정 최종 저장</span>
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
}
