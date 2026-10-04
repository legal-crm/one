import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, UserCheck, Scale, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { SalesLead } from '../../../types/leadTypes';
import type { CaseType, User, StaffMember } from '../../../types';
import { convertLeadToClient } from '../../../services/leadService';
import ModalPortal from '../../common/ModalPortal';

interface LeadConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: SalesLead | null;
  activeLawyer: User;
  staffMembers: StaffMember[];
  lawyers: User[];
  onConverted: (newRequest: any, newExt: any, updatedLead: SalesLead) => void;
  onNavigateToCrm?: (newClientId: string) => void;
  existingRequests?: any[];
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
  existingRequests = [],
}: LeadConversionModalProps) {
  const [caseType, setCaseType] = useState<CaseType>('개인회생');
  const [assignedLawyerId, setAssignedLawyerId] = useState<string>(activeLawyer.id);
  const [assignedStaffId, setAssignedStaffId] = useState<string>('');
  const [consultMemo, setConsultMemo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      // CaseType의 파산 값은 '파산' (이전: 타입에 없는 '개인파산'으로 저장)
      setCaseType((lead as any).caseType === '파산' || (lead as any).caseType === '개인파산' ? '파산' as CaseType : '개인회생');
      setAssignedLawyerId(activeLawyer.id);
      setConsultMemo(lead.specialMemo || '');
    }
  }, [lead, activeLawyer.id]);

  const handleConvert = async () => {
    if (!lead || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { newRequest, newExt, updatedLead, serverSaved } = await convertLeadToClient(
        lead,
        { id: activeLawyer.id, name: activeLawyer.name },
        {
          assignedLawyerId,
          assignedStaffId: assignedStaffId || undefined,
          caseType,
          consultMemo,
          existingRequests,
        }
      );

      onConverted(newRequest, newExt, updatedLead);
      if (!serverSaved) {
        toast.warning(`${lead.customerName}님을 사건으로 전환했지만 서버 저장에 실패했습니다. 이 기기에만 저장되어 있으니 네트워크 확인 후 다시 저장해 주세요.`);
      } else {
        toast.success(`${lead.customerName}님의 영업 리드가 정식 사건으로 성공적으로 전환되었습니다.`);
      }
      onClose();

      // 기획서 2-8: 전환 후 자동으로 사건 워크스페이스 직행
      if (onNavigateToCrm) {
        onNavigateToCrm(newRequest.id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || '사건 전환 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-4 flex min-h-full items-center justify-center animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
          {/* Header */}
          <div className="shrink-0 px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white flex items-center justify-between">
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">영업 리드 → 정식 사건 전환</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                  Lead → Case
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                영업 상담이 성사된 리드를 사건 관리 워크스페이스(1단계 상담·제안)로 즉시 전환합니다.
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
              <div><span className="text-slate-400 block text-xs">총 채무액</span><strong className="text-rose-600 font-black text-sm">{lead.debtTotal ? `${lead.debtTotal.toLocaleString()}만` : '-'}</strong></div>
              <div><span className="text-slate-400 block text-xs">월 실급여</span><strong className="text-emerald-700 font-extrabold text-sm">{lead.incomeNet ? `${lead.incomeNet.toLocaleString()}만` : '-'}</strong></div>
              <div><span className="text-slate-400 block text-xs">거주지</span><span className="font-bold text-slate-800">{lead.region || '-'}</span></div>
              <div><span className="text-slate-400 block text-xs">통화 시도</span><span className="font-bold text-slate-800">{lead.callCount}회 완료</span></div>
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
                  onClick={() => setCaseType('파산')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    caseType === '파산'
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

            {/* 기획서 2-8: 이관·미이관 항목 표시 */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <span className="font-bold text-xs text-slate-800 block">
                전환 데이터 정합성 명세 (이관 항목 vs 신규 생성 항목)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-emerald-200/80 space-y-1.5 shadow-2xs">
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    온전히 이관되는 항목
                  </span>
                  <ul className="text-slate-600 space-y-1 pl-4 list-disc">
                    <li>의뢰인 성명, 휴대폰 번호, 거주지</li>
                    <li>총 채무액, 소득, 부양가족 데이터</li>
                    <li>지금까지의 모든 통화 상담 기록 히스토리</li>
                    <li>실무진 인계 메모 및 특약 희망사항</li>
                  </ul>
                </div>
                <div className="p-3 bg-white rounded-xl border border-blue-200/80 space-y-1.5 shadow-2xs">
                  <span className="font-bold text-blue-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    새로 초기화·부여되는 항목
                  </span>
                  <ul className="text-slate-600 space-y-1 pl-4 list-disc">
                    <li>사건 워크스페이스 1단계(상담·제안) 배정</li>
                    <li>지정된 전담 변호사 및 사무장 매핑</li>
                    <li>사건번호는 법원 정식 접수 시 부여</li>
                    <li>CRM 사건 ID 신규 발급</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
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
            <span>{isSubmitting ? '사건 전환 중...' : '사건으로 전환하고 워크스페이스 열기'}</span>
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
