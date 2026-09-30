import React, { useState } from 'react';
import { X, Send, CheckCircle, ShieldAlert, FileText, ArrowRight, HeartHandshake, Lightbulb } from 'lucide-react';
import { CrisisReasonType, LifeCrisisReport } from '../../../types';
import { submitLifeCrisisReport } from '../../../services/companionService';
import { toast } from 'sonner';
import { updateCrmClientExtension, getCrmClientSync } from '../../../services/crmService';

interface LifeCrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  /** 마이김변 의뢰 ID — 있으면 담당 변호사 CRM에 기록 */
  clientId?: string;
  onNavigateToSupport?: () => void;
}

const CRISIS_REASONS: Array<{ type: CrisisReasonType; label: string; desc: string }> = [
  { type: 'income_reduction', label: '소득 감소 / 사업 부진', desc: '급여 삭감, 매출 급감 등으로 상환 여력 부족' },
  { type: 'job_loss', label: '실직 / 권고사직 / 폐업', desc: '직장을 잃거나 사업을 폐업하여 소득 단절' },
  { type: 'medical_expense', label: '중대 질병 / 의료비 과다', desc: '본인 또는 가족의 수술·입원비로 목돈 지출' },
  { type: 'housing_increase', label: '주거비 급증 / 전세 피해', desc: '월세 인상 또는 전세보증금 미반환 사고' },
  { type: 'family_care', label: '가족 돌봄 / 부양의무', desc: '부모님 요양 또는 자녀 양육비 급증' },
  { type: 'auto_transfer_fail', label: '자동이체 오류 / 잔고 부족', desc: '계좌 압류 또는 출금 오류로 인한 연체 위험' },
  { type: 'other', label: '기타 사유', desc: '기타 불가피한 경제적 사정변경' },
];

function LifeCrisisModalInner({
  isOpen,
  onClose,
  caseId,
  clientId,
  onNavigateToSupport
}: LifeCrisisModalProps) {

  const [selectedReason, setSelectedReason] = useState<CrisisReasonType>('income_reduction');
  const [estimatedShortage, setEstimatedShortage] = useState<number>(0);
  const [deliveredToLawyer, setDeliveredToLawyer] = useState(false);
  const [description, setDescription] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('상황을 구체적으로 적어주시면 더 정확한 법률·복지 안내가 가능합니다.');
      return;
    }

    const currentReasonObj = CRISIS_REASONS.find(r => r.type === selectedReason);

    const report = submitLifeCrisisReport({
      caseId,
      reason: selectedReason,
      reasonLabel: currentReasonObj?.label || '사정변경',
      estimatedShortage: Number(estimatedShortage) || 0,
      description: description.trim(),
    });

    // 마이김변 의뢰가 있으면 담당 변호사 CRM에 기록 (없으면 이 기기에만 저장됨을 사실대로 안내)
    let delivered = false;
    if (clientId) {
      const prev = (getCrmClientSync(clientId) as any)?.lifeCrisisReports || [];
      delivered = await updateCrmClientExtension(clientId, { lifeCrisisReports: [report, ...prev].slice(0, 20) } as any);
    }
    setDeliveredToLawyer(delivered);
    setIsSubmitted(true);
    if (delivered) toast.success('작성하신 내용을 담당 변호사에게 전달했습니다.');
    else toast.info('내용을 이 기기에 저장했습니다. 담당 변호사·사무소에는 직접 연락해 주세요.', { duration: 5000 });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-left max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
              <HeartHandshake className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                사정변경 상담·지원 요청
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                변제금 마련이 어려우실 땐 고금리 대출 대신 공적 구제와 변호사 상담을 먼저 찾으세요.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            aria-label="닫기"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 space-y-6 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                {deliveredToLawyer ? '담당 변호사에게 전달했습니다' : '이 기기에 기록했습니다'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {deliveredToLawyer ? '담당 변호사가 내용을 확인하고 변제계획 변경신청 등 대응 방법을 안내합니다.' : '작성하신 내용은 담당 변호사·사무소에 자동 전달되지 않습니다. 납부일 전에 직접 연락해 상의해 주세요.'} 지금 이용할 수 있는 공적 지원제도도 확인해 보세요.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left space-y-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <span>먼저 확인해 볼 지원과 절차</span>
              </span>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                <li>보건복지부 긴급복지지원 — 위기가구 생계·의료 지원 (보건복지상담센터 129)</li>
                <li>고용노동부 국민취업지원제도 — 구직촉진수당 (고객상담센터 1350)</li>
                <li>변제계획 변경신청 검토 — 소득이 줄어든 경우 담당 변호사와 상의</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToSupport) onNavigateToSupport();
                }}
                className="min-h-11 px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>공적 복지 지원제도 확인하기</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-left">
            
            {/* 사유 선택 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                어려움의 주된 원인을 선택해 주세요
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CRISIS_REASONS.map((r) => (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => setSelectedReason(r.type)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedReason === r.type
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      {r.label}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 block mt-0.5">
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 예상 부족액 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                이번 달 예상 부족액 (원)
              </label>
              <input
                type="number"
                value={estimatedShortage}
                onChange={(e) => setEstimatedShortage(Number(e.target.value))}
                step={50000}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
              <span className="text-xs text-amber-800 dark:text-amber-400 font-bold block">
                약 {(estimatedShortage || 0).toLocaleString()}원 부족 예상
              </span>
            </div>

            {/* 구체적 상황 작성 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                구체적인 사정 및 변동 내역
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="예: 지난달 회사 권고사직으로 인해 이번 달 소득이 없으며, 구직활동 중이나 이번 달 10일 변제금 납부가 곤란한 상태입니다."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* 안심 안내문구 */}
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                마이김변은 무단으로 상환유예를 단정하지 않으며, 정리된 사정변경 자료를 토대로 법적 가능성과 긴급 복지 혜택을 안전하게 안내합니다.
              </span>
            </div>

            {/* 모달 하단 버튼 */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                className="min-h-11 px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{clientId ? '담당 변호사에게 알리기' : '내 상황 기록하기'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}

// Rules of Hooks: isOpen 가드는 훅을 쓰는 본문 바깥에서 처리
export default function LifeCrisisModal(props: LifeCrisisModalProps) {
  if (!props.isOpen) return null;
  return <LifeCrisisModalInner {...props} />;
}
