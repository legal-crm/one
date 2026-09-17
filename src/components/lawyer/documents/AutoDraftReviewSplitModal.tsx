import React, { useState } from 'react';
import {
  X, CheckCircle2, AlertTriangle, Info, FileText, Sparkles,
  ShieldCheck, ArrowRight, Eye, Edit3, Check, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import type { AutoDraftFormItem } from '../../../services/documents/filingAutoDraftEngine';

interface AutoDraftReviewSplitModalProps {
  formItem: AutoDraftFormItem;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (formCode: string) => void;
  onRejectSupplement: (formCode: string, reason: string) => void;
  onOpenFullEditor?: (formCode: string) => void;
  onPreviewCourtForm?: (formCode: string) => void;
}

export default function AutoDraftReviewSplitModal({
  formItem,
  isOpen,
  onClose,
  onApprove,
  onRejectSupplement,
  onOpenFullEditor,
  onPreviewCourtForm,
}: AutoDraftReviewSplitModalProps) {
  const [supplementNote, setSupplementNote] = useState('');
  const [showSupplementInput, setShowSupplementInput] = useState(false);

  if (!isOpen) return null;

  const isApproved = formItem.reviewStatus === 'REVIEWED_APPROVED';

  const handleApproveClick = () => {
    onApprove(formItem.code);
    toast.success(`[${formItem.code}] ${formItem.name} 변호사 검토 및 승인이 완료되었습니다.`);
    onClose();
  };

  const handleSupplementSubmit = () => {
    if (!supplementNote.trim()) {
      toast.error('보완 요청 사항을 입력해주세요.');
      return;
    }
    onRejectSupplement(formItem.code, supplementNote.trim());
    toast.warning(`[${formItem.code}] 보완 요청이 등록되었습니다.`);
    setShowSupplementInput(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-black rounded-lg">
              {formItem.code}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{formItem.name}</h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                  {formItem.badge}
                </span>
                {isApproved ? (
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Check className="w-3 h-3" /> 변호사 승인 완료
                  </span>
                ) : (
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3" /> 검토 대기 (옵션 A 필수)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                원천 서류 파싱 기반 AI 1차 자동 초안 대조 및 변호사 검토 스튜디오
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 모달 바디: 좌우 분할 대조 뷰 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* AI 신뢰도 및 요약 카드 */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/60 border border-blue-100 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-blue-950">AI 추출 신뢰도 지수</span>
                  <span className="text-xs font-black px-2 py-0.5 bg-blue-600 text-white rounded-md">
                    {formItem.confidenceScore}% 신뢰도
                  </span>
                </div>
                <p className="text-xs text-blue-900/90 mt-1 font-medium">
                  {formItem.summaryNote}
                </p>
              </div>
            </div>

            {formItem.reviewedAt && (
              <div className="text-right shrink-0">
                <span className="text-[11px] text-slate-400 block">최근 승인일시</span>
                <span className="text-xs font-semibold text-emerald-700">
                  {new Date(formItem.reviewedAt).toLocaleDateString()} ({formItem.reviewedBy || '담당 변호사'})
                </span>
              </div>
            )}
          </div>

          {/* 주의/경고 플래그 알림 (보정 대비) */}
          {formItem.riskFlags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                법원 보정명령 대비 사전 점검 항목 ({formItem.riskFlags.length}건)
              </h4>
              <div className="space-y-1.5">
                {formItem.riskFlags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      flag.level === 'ALERT'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : flag.level === 'WARNING'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    {flag.level === 'ALERT' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : flag.level === 'WARNING' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <span className="font-semibold">{flag.message}</span>
                      {flag.targetField && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-mono text-slate-600 border border-black/5">
                          필드: {flag.targetField}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 좌우 대조 분할 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 좌측: 원천 서류 매핑 및 추출 근거 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                  원천 1·2차 증빙 서류 ({formItem.sourceDocuments.length}종)
                </span>
                <span className="text-[11px] text-slate-500">OCR 자동 파싱</span>
              </div>
              <ul className="space-y-2">
                {formItem.sourceDocuments.map((doc, i) => (
                  <li key={i} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                    <span className="font-medium text-slate-700">{doc}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                      정상 매핑됨
                    </span>
                  </li>
                ))}
              </ul>
              <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
                💡 원천 서류의 원본 이미지나 스캔 PDF 원문은 법원 제출 시 <strong>[R07 첨부서류 일체]</strong>에 전산 번들링됩니다.
              </div>
            </div>

            {/* 우측: 초안 생성 페이로드 핵심 요약 */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-800">
                  작성된 전산 필드 데이터
                </span>
                <span className="text-[11px] text-blue-600 font-semibold">
                  대법원 규격 바인딩
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {Object.entries(formItem.draftPayload).map(([k, v], idx) => {
                  if (typeof v === 'object' && v !== null) {
                    return (
                      <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-500 font-medium block text-[11px] mb-1">{k}</span>
                        <div className="text-slate-800 font-mono text-[11px] max-h-24 overflow-y-auto">
                          {JSON.stringify(v, null, 2)}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">{k}</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {typeof v === 'boolean' ? (v ? '예 (적합)' : '아니오 (검토필요)') : String(v)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 보완 요청 입력 폼 (접혔다 펴짐) */}
          {showSupplementInput && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 animate-in fade-in">
              <label className="text-xs font-bold text-amber-900 block">
                사무원 또는 의뢰인에게 보완 지시사항 작성
              </label>
              <textarea
                value={supplementNote}
                onChange={(e) => setSupplementNote(e.target.value)}
                placeholder="예: 현대캐피탈 부채증명서의 이자 계산 기준일자가 1개월 전입니다. 최신 기준일로 재발급 요청해주세요."
                className="w-full text-xs p-3 rounded-xl border border-amber-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplementInput(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSupplementSubmit}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-500 cursor-pointer whitespace-nowrap"
                >
                  보완 지시 등록
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            {onPreviewCourtForm && (
              <button
                type="button"
                onClick={() => {
                  onPreviewCourtForm(formItem.code);
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                A4 법원 양식 미리보기
              </button>
            )}

            {onOpenFullEditor && (
              <button
                type="button"
                onClick={() => {
                  onOpenFullEditor(formItem.code);
                  onClose();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                전용 에디터로 수정
              </button>
            )}

            {!showSupplementInput && (
              <button
                type="button"
                onClick={() => setShowSupplementInput(true)}
                className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                보완 요청
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleApproveClick}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap press-scale ${
                isApproved
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproved ? '검토 승인 완료됨 (재확인)' : '변호사 검토 완료 및 서식 승인'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
