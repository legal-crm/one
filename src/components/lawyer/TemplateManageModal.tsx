import React, { useState } from 'react';
import { 
  X, Plus, Trash2, Edit2, Check, RotateCcw, 
  FileText, Scale, MessageSquare, AlertCircle 
} from 'lucide-react';
import { useProposalTemplates, OpinionTemplate, FeePreset, QASnippet } from '../../hooks/useProposalTemplates';
import { useDialog } from '../common/DialogProvider';
import { formatCurrency } from '../../rehab-chatbot-package/services/calculationService';

interface TemplateManageModalProps {
  lawyerId?: string;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'opinion' | 'fee' | 'qa';
}

export const TemplateManageModal: React.FC<TemplateManageModalProps> = ({
  lawyerId = 'default',
  isOpen,
  onClose,
  defaultTab = 'opinion'
}) => {
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<'opinion' | 'fee' | 'qa'>(defaultTab);
  
  const {
    opinionTemplates,
    feePresets,
    qaSnippets,
    addOpinionTemplate,
    updateOpinionTemplate,
    deleteOpinionTemplate,
    addFeePreset,
    updateFeePreset,
    deleteFeePreset,
    addQaSnippet,
    updateQaSnippet,
    deleteQaSnippet,
    resetToDefault
  } = useProposalTemplates(lawyerId);

  // Form states for creating/editing
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Opinion Template Form
  const [opTitle, setOpTitle] = useState('');
  const [opContent, setOpContent] = useState('');
  const [opNotes, setOpNotes] = useState('');

  // Fee Preset Form
  const [feeLabel, setFeeLabel] = useState('');
  const [feeTotal, setFeeTotal] = useState('');
  const [feeDown, setFeeDown] = useState('');
  const [feeInst, setFeeInst] = useState(5);
  const [feeCourt, setFeeCourt] = useState('300000');
  const [feeMemo, setFeeMemo] = useState('');

  // QA Snippet Form
  const [qaKeyword, setQaKeyword] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');

  if (!isOpen) return null;

  const resetForms = () => {
    setIsEditing(false);
    setEditingId(null);
    setOpTitle('');
    setOpContent('');
    setOpNotes('');
    setFeeLabel('');
    setFeeTotal('');
    setFeeDown('');
    setFeeInst(5);
    setFeeCourt('300000');
    setFeeMemo('');
    setQaKeyword('');
    setQaAnswer('');
  };

  const handleStartEditOpinion = (tpl: OpinionTemplate) => {
    setEditingId(tpl.id);
    setOpTitle(tpl.title);
    setOpContent(tpl.content);
    setOpNotes(tpl.recommendedNotes?.join('\n') || '');
    setIsEditing(true);
  };

  const handleSaveOpinion = () => {
    if (!opTitle.trim() || !opContent.trim()) return;
    const notesArray = opNotes.split('\n').map(n => n.trim()).filter(Boolean);
    
    if (editingId) {
      updateOpinionTemplate(editingId, {
        title: opTitle,
        content: opContent,
        recommendedNotes: notesArray
      });
    } else {
      addOpinionTemplate({
        title: opTitle,
        category: 'custom',
        content: opContent,
        recommendedNotes: notesArray
      });
    }
    resetForms();
  };

  const handleStartEditFee = (fee: FeePreset) => {
    setEditingId(fee.id);
    setFeeLabel(fee.label);
    setFeeTotal(fee.totalFee.toString());
    setFeeDown(fee.downPayment.toString());
    setFeeInst(fee.installments);
    setFeeCourt(fee.courtDeposit.toString());
    setFeeMemo(fee.memo || '');
    setIsEditing(true);
  };

  const handleSaveFee = () => {
    const total = parseInt(feeTotal.replace(/,/g, ''), 10);
    const down = parseInt(feeDown.replace(/,/g, ''), 10) || 0;
    const court = parseInt(feeCourt.replace(/,/g, ''), 10) || 300000;
    if (!feeLabel.trim() || isNaN(total)) return;

    if (editingId) {
      updateFeePreset(editingId, {
        label: feeLabel,
        totalFee: total,
        downPayment: down,
        installments: feeInst,
        courtDeposit: court,
        memo: feeMemo
      });
    } else {
      addFeePreset({
        label: feeLabel,
        totalFee: total,
        downPayment: down,
        installments: feeInst,
        courtDeposit: court,
        memo: feeMemo
      });
    }
    resetForms();
  };

  const handleStartEditQA = (snip: QASnippet) => {
    setEditingId(snip.id);
    setQaKeyword(snip.keyword);
    setQaAnswer(snip.answer);
    setIsEditing(true);
  };

  const handleSaveQA = () => {
    if (!qaKeyword.trim() || !qaAnswer.trim()) return;
    if (editingId) {
      updateQaSnippet(editingId, {
        keyword: qaKeyword,
        answer: qaAnswer
      });
    } else {
      addQaSnippet({
        keyword: qaKeyword,
        answer: qaAnswer
      });
    }
    resetForms();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/20 flex items-center justify-center text-brand">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">제안서 템플릿 & 수임료 패키지 설정</h2>
              <p className="text-xs text-slate-400">우리 사무실 전용 소견 템플릿, 수임료 프리셋, 자주 묻는 질문 답변을 관리합니다.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0">
          <button
            onClick={() => { setActiveTab('opinion'); resetForms(); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] ${
              activeTab === 'opinion' 
                ? 'border-brand text-brand bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            소견 템플릿 ({opinionTemplates.length})
          </button>
          <button
            onClick={() => { setActiveTab('fee'); resetForms(); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] ${
              activeTab === 'fee' 
                ? 'border-brand text-brand bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            수임료 패키지 ({feePresets.length})
          </button>
          <button
            onClick={() => { setActiveTab('qa'); resetForms(); }}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] ${
              activeTab === 'qa' 
                ? 'border-brand text-brand bg-white' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            자주 묻는 질문 Q&A ({qaSnippets.length})
          </button>

          <div className="ml-auto flex items-center">
            <button
              onClick={async () => {
                const confirmed = await dialog.confirm({
                  title: '기본값 복원',
                  message: '모든 템플릿과 설정을 초기 기본값으로 되돌리시겠습니까?\n기존에 커스텀 추가된 항목들이 초기화됩니다.',
                  confirmText: '기본값 복원',
                  variant: 'warning'
                });
                if (confirmed) {
                  resetToDefault();
                  resetForms();
                }
              }}
              className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              기본값 복원
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: OPINION TEMPLATES */}
          {activeTab === 'opinion' && (
            <div className="space-y-4">
              {!isEditing && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-500 font-medium">상황별로 변호사 소견 및 추천 특이사항을 저장해 두고 원클릭으로 불러올 수 있습니다.</span>
                  <button
                    onClick={() => { resetForms(); setIsEditing(true); }}
                    className="flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-all active:scale-[0.98] whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    새 템플릿 등록
                  </button>
                </div>
              )}

              {isEditing ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5 animate-fadeIn">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingId ? '소견 템플릿 수정' : '새 소견 템플릿 등록'}
                    </h3>
                    <button onClick={resetForms} className="text-xs text-slate-500 hover:text-slate-800">취소</button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">템플릿 명칭 (예: 코인/주식 손실형, 고령자 파산형)</label>
                    <input
                      type="text"
                      value={opTitle}
                      onChange={e => setOpTitle(e.target.value)}
                      placeholder="템플릿 제목 입력"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">변호사 종합 의견 내용 (고객 제안서에 자동 삽입)</label>
                    <textarea
                      value={opContent}
                      onChange={e => setOpContent(e.target.value)}
                      placeholder="제안서 본문에 들어갈 소견 문구를 작성하세요."
                      rows={6}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">추천 특이사항 칩 (줄바꿈으로 구분, 선택사항)</label>
                    <textarea
                      value={opNotes}
                      onChange={e => setOpNotes(e.target.value)}
                      placeholder="예시:&#10;투자 손실금 소명 자료 철저 준비 필요&#10;청산가치 반영 방어를 위한 사용처 소명"
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={resetForms}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveOpinion}
                      className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      저장하기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {opinionTemplates.map(tpl => (
                    <div 
                      key={tpl.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4.5 hover:border-slate-300 hover:shadow-xs transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{tpl.title}</span>
                          {tpl.isCustom ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand/10 text-brand">사무실 전용</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">기본 제공</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditOpinion(tpl)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="수정"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              const confirmed = await dialog.confirm({
                                title: '소견 템플릿 삭제',
                                message: `'${tpl.title}' 템플릿을 삭제하시겠습니까?`,
                                confirmText: '삭제',
                                variant: 'danger'
                              });
                              if (confirmed) {
                                deleteOpinionTemplate(tpl.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {tpl.content}
                      </p>

                      {tpl.recommendedNotes && tpl.recommendedNotes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {tpl.recommendedNotes.map((note, i) => (
                            <span key={i} className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                              • {note}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FEE PRESETS */}
          {activeTab === 'fee' && (
            <div className="space-y-4">
              {!isEditing && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-500 font-medium">자주 제시하는 수임료 및 분납 패키지를 등록해두면 클릭 한 번으로 자동 입력됩니다.</span>
                  <button
                    onClick={() => { resetForms(); setIsEditing(true); }}
                    className="flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-all active:scale-[0.98] whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    새 수임료 패키지 등록
                  </button>
                </div>
              )}

              {isEditing ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5 animate-fadeIn">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingId ? '수임료 패키지 수정' : '새 수임료 패키지 등록'}
                    </h3>
                    <button onClick={resetForms} className="text-xs text-slate-500 hover:text-slate-800">취소</button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">패키지 명칭 (예: 기본형 150만 5회 분납)</label>
                    <input
                      type="text"
                      value={feeLabel}
                      onChange={e => setFeeLabel(e.target.value)}
                      placeholder="패키지 이름 입력"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">총 수임료 (원)</label>
                      <input
                        type="text"
                        value={feeTotal}
                        onChange={e => setFeeTotal(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="1500000"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">착수금 (원)</label>
                      <input
                        type="text"
                        value={feeDown}
                        onChange={e => setFeeDown(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="300000"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">분납 횟수</label>
                      <select
                        value={feeInst}
                        onChange={e => setFeeInst(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                          <option key={n} value={n}>{n === 1 ? '일시납' : `${n}회 분납`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">법원 예납금 (원)</label>
                      <input
                        type="text"
                        value={feeCourt}
                        onChange={e => setFeeCourt(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="300000"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">고객 안내 메모 (송달료 포함 여부 등)</label>
                    <input
                      type="text"
                      value={feeMemo}
                      onChange={e => setFeeMemo(e.target.value)}
                      placeholder="예: 착수금 30만원 결제 후 매월 24만원씩 5회 분납 (송달료 포함)"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={resetForms}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveFee}
                      className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      저장하기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {feePresets.map(fee => {
                    const monthly = fee.installments > 0 
                      ? Math.max(0, Math.floor((fee.totalFee - fee.downPayment) / fee.installments))
                      : 0;
                    return (
                      <div
                        key={fee.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 hover:shadow-xs transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{fee.label}</span>
                            {fee.isCustom && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand/10 text-brand">전용</span>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleStartEditFee(fee)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async () => {
                                const confirmed = await dialog.confirm({
                                  title: '수임료 패키지 삭제',
                                  message: `'${fee.label}' 패키지를 삭제하시겠습니까?`,
                                  confirmText: '삭제',
                                  variant: 'danger'
                                });
                                if (confirmed) {
                                  deleteFeePreset(fee.id);
                                }
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-2.5 text-xs space-y-1 font-mono">
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-sans">총 수임료</span>
                            <span className="font-bold text-slate-900">{formatCurrency(fee.totalFee)}원</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-sans">착수금 / 분납</span>
                            <span className="text-brand font-bold">
                              착수 {formatCurrency(fee.downPayment)}원 + 월 {formatCurrency(monthly)}원 ({fee.installments}회)
                            </span>
                          </div>
                        </div>

                        {fee.memo && (
                          <p className="text-[11px] text-slate-500 truncate" title={fee.memo}>
                            💬 {fee.memo}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QA SNIPPETS */}
          {activeTab === 'qa' && (
            <div className="space-y-4">
              {!isEditing && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-500 font-medium">고객이 자주 묻는 질문(직장 통보, 카드 정지, 추심 중단 등)에 대한 표준 답변 문구를 등록합니다.</span>
                  <button
                    onClick={() => { resetForms(); setIsEditing(true); }}
                    className="flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-all active:scale-[0.98] whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    새 Q&A 답변 등록
                  </button>
                </div>
              )}

              {isEditing ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5 animate-fadeIn">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                      {editingId ? 'Q&A 답변 스니펫 수정' : '새 Q&A 답변 스니펫 등록'}
                    </h3>
                    <button onClick={resetForms} className="text-xs text-slate-500 hover:text-slate-800">취소</button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">키워드/제목 (예: 직장/가족 비밀 보장, 카드 정지 시점)</label>
                    <input
                      type="text"
                      value={qaKeyword}
                      onChange={e => setQaKeyword(e.target.value)}
                      placeholder="버튼에 표시될 키워드"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">변호사 답변 내용 (원클릭 삽입)</label>
                    <textarea
                      value={qaAnswer}
                      onChange={e => setQaAnswer(e.target.value)}
                      placeholder="답변 내용을 작성하세요."
                      rows={4}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={resetForms}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveQA}
                      className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      저장하기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {qaSnippets.map(snip => (
                    <div
                      key={snip.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 hover:shadow-xs transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-brand"></span>
                          {snip.keyword}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditQA(snip)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={async () => {
                              const confirmed = await dialog.confirm({
                                title: 'Q&A 답변 삭제',
                                message: `'${snip.keyword}' 답변을 삭제하시겠습니까?`,
                                confirmText: '삭제',
                                variant: 'danger'
                              });
                              if (confirmed) {
                                deleteQaSnippet(snip.id);
                              }
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                        {snip.answer}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            * 변경사항은 변호사 사무실 로컬 설정에 자동 저장됩니다.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
          >
            설정 완료
          </button>
        </div>
      </div>
    </div>
  );
};
