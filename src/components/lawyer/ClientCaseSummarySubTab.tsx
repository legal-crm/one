import React, { useState, useMemo, useEffect } from 'react';
import { Copy, Edit2, FileText, Send, Sparkles, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User, CrmNote } from '../../types';
import { generateClientSummary, injectSummaryMetadata } from '../../services/leadService';
import { extractSpecialMemoFromSummary } from '../../services/aiCallSummaryService';

interface ClientCaseSummarySubTabProps {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyer: User;
  onUpdateExt: (updated: CrmClientExtension) => void;
}

export const ClientCaseSummarySubTab: React.FC<ClientCaseSummarySubTabProps> = ({
  clientRequest,
  crmExt,
  activeLawyer,
  onUpdateExt,
}) => {
  // 본안 의뢰인 기본 요약문 자동 생성 (18개 항목)
  const generatedBasicSummary = useMemo(() => {
    return generateClientSummary(clientRequest, crmExt, activeLawyer.name);
  }, [clientRequest, crmExt, activeLawyer.name]);

  // 기본 요약문 편집 상태
  const [manualSummary, setManualSummary] = useState(generatedBasicSummary);
  const [isManualSummaryEdit, setIsManualSummaryEdit] = useState(false);

  // AI 요약문 상태 (crmExt.aiSummary 우선)
  const [aiSummaryText, setAiSummaryText] = useState(crmExt.aiSummary || '');
  const [isAiSummaryEdit, setIsAiSummaryEdit] = useState(false);

  useEffect(() => {
    if (!isManualSummaryEdit) {
      setManualSummary(generatedBasicSummary);
    }
  }, [generatedBasicSummary, isManualSummaryEdit]);

  useEffect(() => {
    if (crmExt.aiSummary && !isAiSummaryEdit) {
      setAiSummaryText(crmExt.aiSummary);
    }
  }, [crmExt.aiSummary, isAiSummaryEdit]);

  // 기본 요약문 클립보드 복사
  const handleCopyBasicSummary = () => {
    const textToCopy = isManualSummaryEdit ? manualSummary : generatedBasicSummary;
    navigator.clipboard.writeText(textToCopy);
    toast.success('사건 기본 요약문이 클립보드에 복사되었습니다.');
  };

  // AI 요약문 클립보드 복사
  const handleCopyAiSummary = () => {
    if (!aiSummaryText) return;
    navigator.clipboard.writeText(aiSummaryText);
    toast.success('AI 통화 요약문이 클립보드에 복사되었습니다.');
  };

  // AI 요약문 수정 저장
  const handleSaveAiSummary = () => {
    const updated: CrmClientExtension = {
      ...crmExt,
      aiSummary: aiSummaryText,
      lastActivityAt: new Date().toISOString(),
    };
    onUpdateExt(updated);
    setIsAiSummaryEdit(false);
    toast.success('AI 요약문 수정 사항이 저장되었습니다.');
  };

  // 특이사항 자동 추출하여 사건 메모로 전송
  const handleSendToCaseNotes = () => {
    if (!aiSummaryText) return;
    const memoContent = extractSpecialMemoFromSummary(aiSummaryText);
    const newNote: CrmNote = {
      id: `note-${Date.now()}`,
      category: 'consult',
      content: `[AI 통화 요약 특이사항]\n${memoContent}`,
      authorId: activeLawyer.id,
      authorName: activeLawyer.name,
      createdAt: new Date().toISOString(),
    };
    const updatedNotes = [newNote, ...(crmExt.notes || [])];
    const updated: CrmClientExtension = {
      ...crmExt,
      notes: updatedNotes,
      lastActivityAt: new Date().toISOString(),
    };
    onUpdateExt(updated);
    toast.success('특이사항이 사건 상담 메모에 성공적으로 등록되었습니다.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* ── LEFT: 기본 요약문 ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col min-h-[540px]">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">사건 기본 요약문</h3>
              <p className="text-[11px] text-slate-400">의뢰인 인적/소득/채무/자산 현황을 바탕으로 18개 표준 항목으로 구성됩니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!isManualSummaryEdit ? (
              <button
                type="button"
                onClick={() => {
                  setManualSummary(generatedBasicSummary);
                  setIsManualSummaryEdit(true);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Edit2 size={12} />
                <span>수정</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsManualSummaryEdit(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualSummaryEdit(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Check size={12} />
                  <span>완료</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 텍스트 뷰/에디터 */}
        <div className="flex-1 flex flex-col mb-4">
          {!isManualSummaryEdit ? (
            <pre className="w-full flex-1 p-4 bg-slate-50/80 rounded-2xl text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed border border-slate-200/70 overflow-y-auto min-h-[380px] max-h-[520px] text-slate-800 select-text">
              {manualSummary}
            </pre>
          ) : (
            <textarea
              className="w-full flex-1 p-4 bg-white rounded-2xl text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border-2 border-blue-400 focus:border-blue-600 outline-hidden resize-none min-h-[380px] max-h-[520px] text-slate-900 shadow-inner"
              value={manualSummary}
              onChange={e => setManualSummary(e.target.value)}
              placeholder="사건 기본 요약문 내용을 수정하세요..."
              autoFocus
            />
          )}
        </div>

        {/* 전체 복사하기 버튼 */}
        <button
          type="button"
          onClick={handleCopyBasicSummary}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Copy size={16} />
          <span>전체 복사하기</span>
        </button>
      </div>

      {/* ── RIGHT: AI 요약문 ── */}
      <div className="bg-purple-50/50 p-5 rounded-3xl border border-purple-100 shadow-xs flex flex-col min-h-[540px]">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-200/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-black text-purple-900 text-base">AI 통화 요약문 (Gemini 3.5)</h3>
              <p className="text-[11px] text-purple-600/80">음성 녹취 분석 결과와 화자분리([변호사/사무장] vs [의뢰인]) 대화록입니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {aiSummaryText && (
              !isAiSummaryEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    const withMeta = injectSummaryMetadata(aiSummaryText, activeLawyer.name || '담당 변호사');
                    setAiSummaryText(withMeta);
                    setIsAiSummaryEdit(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 size={12} />
                  <span>수정</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAiSummaryEdit(false)}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-purple-300 hover:bg-purple-50 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAiSummary}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Check size={12} />
                    <span>저장</span>
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* AI 요약문 본문 */}
        <div className="flex-1 flex flex-col mb-4">
          {aiSummaryText ? (
            !isAiSummaryEdit ? (
              <pre
                onClick={() => {
                  const withMeta = injectSummaryMetadata(aiSummaryText, activeLawyer.name || '담당 변호사');
                  setAiSummaryText(withMeta);
                  setIsAiSummaryEdit(true);
                }}
                className="w-full flex-1 p-4 bg-white rounded-2xl text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed border border-purple-200/80 overflow-y-auto min-h-[380px] max-h-[520px] text-slate-800 select-text cursor-text hover:border-purple-300 transition-colors"
                title="클릭하여 직접 수정"
              >
                {aiSummaryText}
              </pre>
            ) : (
              <textarea
                className="w-full flex-1 p-4 bg-white rounded-2xl text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border-2 border-purple-400 focus:border-purple-600 outline-hidden resize-none min-h-[380px] max-h-[520px] text-slate-900 shadow-inner"
                value={aiSummaryText}
                onChange={e => setAiSummaryText(e.target.value)}
                placeholder="AI 요약문을 입력하거나 수정하세요..."
                autoFocus
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/70 rounded-2xl border border-dashed border-purple-200 text-center min-h-[380px]">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-400 flex items-center justify-center mb-3">
                <Sparkles size={28} />
              </div>
              <h4 className="font-extrabold text-slate-800 text-sm mb-1">AI 통화 요약 결과가 없습니다</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                <b>[통화 및 문자]</b> 탭이나 우측 원스톱 소통 패널에서 녹음 파일을 업로드하고 Gemini 3.5 AI 분석을 실행해보세요.
              </p>
              <span className="inline-block mt-3 px-3 py-1 bg-purple-100 text-purple-700 font-bold rounded-lg text-xs">
                🎙️ Gemini 3.5 Transcribe 화자분리 전사 지원
              </span>
            </div>
          )}
        </div>

        {/* AI 하단 액션 버튼 */}
        {aiSummaryText && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyAiSummary}
                className="py-3 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <Copy size={15} />
                <span>전체 복사</span>
              </button>
              <button
                type="button"
                onClick={handleSendToCaseNotes}
                className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <Send size={15} />
                <span>사건 메모로 전송</span>
              </button>
            </div>
            <p className="text-[11px] text-center text-purple-600 font-medium">
              * 전송 시 '특이사항' 부분만 자동으로 추출되어 의뢰인의 상담 메모에 추가됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
