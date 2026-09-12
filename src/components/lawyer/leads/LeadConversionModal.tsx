import React, { useState } from 'react';
import { X, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, UserCheck, Scale, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { SalesLead } from '../../../types/leadTypes';
import type { CaseType, User, StaffMember } from '../../../types';
import { convertLeadToClient } from '../../../services/leadService';

interface LeadConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: SalesLead | null;
  activeLawyer: User;
  staffMembers: StaffMember[];
  lawyers: User[];
  onConverted: (newRequest: any, newExt: any, updatedLead: SalesLead) => void;
  onNavigateToCrm?: (newClientId: string) => void;
}

export default function LeadConversionModal({
  isOpen,
  onClose,
  lead,
  activeLawyer,
  staffMembers,
  lawyers,
  onConverted,
  onNavigateToCrm,
}: LeadConversionModalProps) {
  if (!isOpen || !lead) return null;

  const [caseType, setCaseType] = useState<CaseType>(
    lead.caseType === '개인파산' ? '개인파산' : '개인회생'
  );
  const [assignedLawyerId, setAssignedLawyerId] = useState<string>(activeLawyer.id);
  const [assignedStaffId, setAssignedStaffId] = useState<string>('');
  const [consultMemo, setConsultMemo] = useState<string>(lead.specialMemo || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConvert = () => {
    setIsSubmitting(true);
    try {
      const { newRequest, newExt, updatedLead } = convertLeadToClient(
        lead,
        { id: activeLawyer.id, name: activeLawyer.name },
        {
          assignedLawyerId,
          assignedStaffId: assignedStaffId || undefined,
          caseType,
          consultMemo,
        }
      );

      onConverted(newRequest, newExt, updatedLead);
      toast.success(
        `⭐️ ${lead.customerName}님이 정식 고객 DB로 승격되었습니다!`,
        {
          action: onNavigateToCrm ? {
            label: '고객 CRM 바로가기',
            onClick: () => onNavigateToCrm(newRequest.id),
          } : undefined,
          duration: 6000,
        }
      );
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('고객 이전 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">정식 고객 DB로 승격 이전</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                  Lead → Client
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                유의미한 상담이 성사된 리드를 고객 관리(CRM) 파이프라인으로 이전합니다.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* 고객 요약 카드 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">{lead.customerName}</span>
                <span className="text-slate-500 font-mono">{lead.phone}</span>
              </div>
              <span className="font-bold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                출처: {lead.inboundPath || '영업DB'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 pt-0.5">
              <div><span className="text-slate-400 block text-[11px]">총 채무액</span><strong className="text-rose-600 font-black text-sm">{lead.debtTotal ? `${lead.debtTotal.toLocaleString()}만` : '-'}</strong></div>
              <div><span className="text-slate-400 block text-[11px]">월 실급여</span><strong className="text-emerald-700 font-extrabold text-sm">{lead.incomeNet ? `${lead.incomeNet.toLocaleString()}만` : '-'}</strong></div>
              <div><span className="text-slate-400 block text-[11px]">거주지</span><span className="font-bold text-slate-800">{lead.region || '-'}</span></div>
              <div><span className="text-slate-400 block text-[11px]">통화 시도</span><span className="font-bold text-slate-800">{lead.callCount}회 완료</span></div>
            </div>
          </div>

          {/* 승격 옵션 설정 */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Scale size={14} className="text-emerald-600" />
                사건 구분 확정
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCaseType('개인회생')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    caseType === '개인회생'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  개인회생 (소득활동 및 변제)
                </button>
                <button
                  type="button"
                  onClick={() => setCaseType('개인파산')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    caseType === '개인파산'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  개인파산 (면책 중심)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">담당 변호사 지정</label>
                <select
                  value={assignedLawyerId}
                  onChange={e => setAssignedLawyerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {lawyers.map(l => (
                    <option key={l.id} value={l.id}>{l.name} 변호사</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">전담 사무장/직원 (선택)</label>
                <select
                  value={assignedStaffId}
                  onChange={e => setAssignedStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- 미지정 (추후 배정) --</option>
                  {staffMembers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <FileText size={14} className="text-slate-600" />
                초기 상담 인계 메모 (변호사/실무진 전달사항)
              </label>
              <textarea
                rows={3}
                value={consultMemo}
                onChange={e => setConsultMemo(e.target.value)}
                placeholder="통화 중 파악된 고객의 긴급도, 채권 추심 여부, 주요 질문 사항 등을 입력하세요."
                className="w-full px-3.5 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/60 resize-none outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-emerald-950">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-extrabold text-xs">데이터 무손실 100% 이관 보장</p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  인적사항, 채무 및 재산 정보, 과거 이력, 그리고 <strong>지금까지의 모든 통화 기록</strong>이 고객 CRM의 타임라인으로 온전히 이관됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConvert}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm shadow-emerald-500/20 transition-all cursor-pointer press-scale active:scale-[0.98] flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            <span>{isSubmitting ? '이전 처리 중...' : '고객 관리(CRM)로 이전 확정'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
