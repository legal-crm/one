import React, { useState, useRef } from 'react';
import { 
  X, Save, RotateCcw, BookmarkPlus, Eye, Edit3, 
  Sparkles, Check, AlertCircle, HelpCircle, Highlighter, 
  Bold, Type, ShieldAlert 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ContractDocument, ContractDocType } from '../../types';
import { CONTRACT_DOC_TYPES } from '../../types';
import { 
  LEGAL_QUICK_SNIPPETS, 
  saveLawyerCustomTemplate, 
  applyTemplatePlaceholders,
  STANDARD_LEGAL_TEMPLATES 
} from '../../services/contractTemplateService';
import { HighlightedDocumentViewer } from '../common/HighlightedDocumentViewer';

interface Props {
  isOpen: boolean;
  doc: ContractDocument | null;
  contractContext: {
    clientName: string;
    clientPhone: string;
    clientAddress?: string;
    lawyerName: string;
    lawFirmName: string;
    totalFee: number;
    contractDate?: string;
  };
  onClose: () => void;
  onSave: (updatedDoc: ContractDocument) => void;
}

export const ContractDocEditModal: React.FC<Props> = ({
  isOpen,
  doc,
  contractContext,
  onClose,
  onSave,
}) => {
  if (!isOpen || !doc) return null;

  const [title, setTitle] = useState(doc.title);
  const [type, setType] = useState<ContractDocType>(doc.type);
  const [signatureRequired, setSignatureRequired] = useState<'client' | 'lawyer' | 'both' | 'none'>(doc.signatureRequired);
  const [content, setContent] = useState(doc.content || '');
  const [requireConfirmation, setRequireConfirmation] = useState(Boolean(doc.requiredConfirmationText));
  const [confirmationText, setConfirmationText] = useState(doc.requiredConfirmationText || '');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [showSnippets, setShowSnippets] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 커서 위치 또는 선택 텍스트에 문자열 삽입/감싸기
  const insertTextAtCursor = (prefix: string, suffix: string = '') => {
    const el = textareaRef.current;
    if (!el) {
      setContent(prev => prev + prefix + suffix);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = prefix + (selected || '') + suffix;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    // 포커스 복원 및 커서 위치 재지정
    setTimeout(() => {
      el.focus();
      const newPos = start + prefix.length + (selected ? selected.length : 0);
      el.setSelectionRange(newPos, newPos);
    }, 10);
  };

  // 노란 형광펜 감싸기
  const handleApplyYellowHighlighter = () => {
    insertTextAtCursor('==', '==');
    toast.info('노란 형광펜 하이라이트가 적용되었습니다.');
  };

  // 연두 형광펜 감싸기
  const handleApplyGreenHighlighter = () => {
    insertTextAtCursor('==g:', '==');
    toast.info('연두 형광펜 하이라이트가 적용되었습니다.');
  };

  // 진하게 (볼드)
  const handleApplyBold = () => {
    insertTextAtCursor('**', '**');
  };

  // 치환 태그 삽입
  const handleInsertTag = (tag: string) => {
    insertTextAtCursor(tag);
  };

  // 현재 의뢰인 실데이터로 즉시 치환
  const handleApplyRealData = () => {
    const replaced = applyTemplatePlaceholders(content, contractContext);
    setContent(replaced);
    toast.success('태그가 현재 계약서의 실제 정보로 치환되었습니다.');
  };

  // 특약 스니펫 삽입
  const handleAppendSnippet = (snippetText: string) => {
    setContent(prev => prev.trim() + snippetText);
    toast.success('특약 조항이 본문 하단에 추가되었습니다.');
    setShowSnippets(false);
  };

  // 기본 표준 양식으로 복원
  const handleResetToDefault = () => {
    const std = STANDARD_LEGAL_TEMPLATES.find(t => t.type === doc.type);
    if (std) {
      setContent(std.content);
      if (std.requiredConfirmationText) {
        setRequireConfirmation(true);
        setConfirmationText(std.requiredConfirmationText);
      }
      toast.info(`[${std.title}] 표준 양식으로 복원되었습니다.`);
    } else {
      toast.error('해당 문서의 기본 표준 양식을 찾을 수 없습니다.');
    }
  };

  // 현재 문서를 우리 사무소 맞춤 문서함(서식 보관함)에 저장
  const handleSaveToLibrary = () => {
    if (!title.trim()) {
      toast.error('문서 제목을 입력해 주세요.');
      return;
    }
    saveLawyerCustomTemplate({
      title: `${title} (사무소 맞춤)`,
      description: `${contractContext.lawFirmName || '당소'} 맞춤 등록 서식`,
      category: 'custom',
      type,
      content,
      signatureRequired,
      requiredConfirmationText: requireConfirmation ? confirmationText : undefined,
      tags: ['사무소양식', '맞춤서식'],
    });
    toast.success('사무소 문서함(서식 보관함)에 새 양식으로 저장되었습니다!');
  };

  // 모달 저장 완료
  const handleSave = () => {
    if (!title.trim()) {
      toast.error('문서 제목을 입력해 주세요.');
      return;
    }

    const updated: ContractDocument = {
      ...doc,
      title,
      type,
      signatureRequired,
      content,
      requiredConfirmationText: requireConfirmation ? confirmationText.trim() : undefined,
    };

    onSave(updated);
    toast.success('문서 내용이 저장되었습니다.');
    onClose();
  };

  // 추천 확약 문구 프리셋
  const confirmationPresets = [
    '총 수임료 및 분납 일정을 확인하였습니다',
    '기한이익 상실 및 실비 정산 특약을 확인하였습니다',
    '면책 불허가 사유를 고지받았으며 성실히 임하겠습니다',
    '부채증명서 발급 대행 및 실비 정산에 동의합니다',
    '배우자 재산 소명 및 자료 제출에 협조하겠습니다',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>계약 문서 내용 및 특약 상세 편집</span>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                  {CONTRACT_DOC_TYPES[type]?.label || '문서'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                변호사 사무실 고유의 조항, 특약, 중요 하이라이트 및 고객 직접 확약 문구를 커스텀합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 뷰 모드 토글 */}
            <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'edit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>에디터</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>미리보기</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 모달 본문 (스크롤 영역) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* 1. 기본 메타데이터 설정 (제목, 서명 대상, 유형) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">문서 제목</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-brand"
                placeholder="문서 제목 입력"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">서명 필요 대상</label>
              <select
                value={signatureRequired}
                onChange={e => setSignatureRequired(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-brand"
              >
                <option value="both">양측 서명 (변호사 + 의뢰인)</option>
                <option value="client">의뢰인만 서명</option>
                <option value="lawyer">변호사만 서명</option>
                <option value="none">서명 불필요 (확인용 안내문)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">문서 유형 분류</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-brand"
              >
                {Object.entries(CONTRACT_DOC_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. 에디터 툴바 (형광펜, 볼드, 치환태그, 특약 스니펫) */}
          {viewMode === 'edit' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                
                {/* 형광펜 및 볼드 서식 버튼 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                    <span>강조 서식:</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleApplyYellowHighlighter}
                    title="선택한 텍스트에 노란 형광펜을 적용합니다 (약관규제법 제3조 중요사항)"
                    className="flex items-center gap-1 px-2.5 py-1 bg-yellow-200 hover:bg-yellow-300 text-amber-950 font-black rounded-lg cursor-pointer transition-colors shadow-xs"
                  >
                    <span>노란 형광펜</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyGreenHighlighter}
                    title="선택한 텍스트에 연두 형광펜을 적용합니다"
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
                  >
                    <span>연두 형광펜</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyBold}
                    title="선택한 텍스트를 진하게 표시합니다"
                    className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 text-slate-800 font-black border border-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    <Bold className="w-3.5 h-3.5" />
                    <span>진하게</span>
                  </button>
                </div>

                {/* 특약 추가 & 실데이터 치환 버튼 */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSnippets(!showSnippets)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg cursor-pointer transition-colors border border-indigo-200"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>자주 쓰는 특약 삽입</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyRealData}
                    title="입력된 모든 {{태그}}를 실제 의뢰인/변호사 정보로 변환합니다"
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    <Type className="w-3.5 h-3.5 text-slate-500" />
                    <span>실제값 치환</span>
                  </button>
                </div>
              </div>

              {/* 스마트 치환 태그 빠른 삽입 바 */}
              <div className="flex items-center gap-1.5 flex-wrap px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
                <span className="text-slate-400 font-bold">스마트 태그:</span>
                {[
                  { tag: '{{의뢰인명}}', label: '의뢰인명' },
                  { tag: '{{의뢰인연락처}}', label: '연락처' },
                  { tag: '{{법무법인}}', label: '법무법인' },
                  { tag: '{{변호사명}}', label: '변호사명' },
                  { tag: '{{총수임료}}', label: '총수임료' },
                  { tag: '{{계약일자}}', label: '계약일자' },
                ].map(item => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    className="px-2 py-0.5 bg-white hover:bg-brand/10 hover:text-brand text-slate-600 font-medium rounded border border-slate-200 cursor-pointer transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 특약 스니펫 팝업 패널 */}
              {showSnippets && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 animate-fadeIn text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900">클릭 시 본문 하단에 원클릭으로 조항이 삽입됩니다:</span>
                    <button onClick={() => setShowSnippets(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {LEGAL_QUICK_SNIPPETS.map(snip => (
                      <button
                        key={snip.id}
                        type="button"
                        onClick={() => handleAppendSnippet(snip.text)}
                        className="text-left p-2.5 bg-white hover:bg-indigo-100/50 border border-indigo-100 rounded-lg transition-colors cursor-pointer group"
                      >
                        <p className="font-bold text-slate-800 group-hover:text-indigo-900">{snip.title}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{snip.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. 본문 에디터 OR 실시간 렌더링 미리보기 */}
          {viewMode === 'edit' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>문서 본문 내용 (형광펜 마크업: <code className="bg-slate-100 px-1 py-0.5 rounded text-amber-700">==강조문구==</code>)</span>
                <span>{content.length.toLocaleString()}자 / {content.split('\n').length}줄</span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={15}
                className="w-full p-4 border border-slate-200 rounded-2xl font-mono text-xs sm:text-sm text-slate-800 leading-relaxed bg-white focus:outline-brand shadow-2xs"
                placeholder="계약 조항 및 문서 내용을 입력하세요."
              />
            </div>
          ) : (
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 max-h-[420px] overflow-y-auto">
              <div className="mb-4 pb-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">실제 고객 열람 및 서명 시 렌더링 형태:</span>
                <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                  형광펜 마킹 적용됨
                </span>
              </div>
              <HighlightedDocumentViewer
                content={applyTemplatePlaceholders(content, contractContext)}
                requiredConfirmationText={requireConfirmation ? confirmationText : undefined}
              />
            </div>
          )}

          {/* 4. [핵심] 고객 직접 타이핑 확약 문구 설정 (금융·보험사 벤치마킹) */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requireConfirmation}
                  onChange={e => setRequireConfirmation(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>고객 직접 확약 문구 타이핑(덧쓰기) 필수 요구</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.2 rounded font-bold">
                      법적 부인방지
                    </span>
                  </span>
                  <p className="text-[11px] text-amber-800/90 mt-0.5">
                    의뢰인이 스마트폰 서명 시, 아래 지정한 문구를 직접 자필로 타이핑해야만 서명이 완료됩니다.
                  </p>
                </div>
              </label>
            </div>

            {requireConfirmation && (
              <div className="space-y-2 pt-2 border-t border-amber-200/60">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={e => setConfirmationText(e.target.value)}
                    placeholder="예: 총 수임료 및 분납 일정을 확인하였습니다"
                    className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-950 focus:outline-amber-600"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-amber-800">추천 문구:</span>
                  {confirmationPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setConfirmationText(preset)}
                      className="text-[10px] px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md cursor-pointer transition-colors"
                    >
                      "{preset}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* 모달 하단 푸터 액션 바 */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200"
              title="대한변협 및 법률 기본 표준 서식으로 본문을 되돌립니다"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>기본양식 복원</span>
            </button>

            <button
              type="button"
              onClick={handleSaveToLibrary}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-indigo-700 hover:bg-indigo-100/70 bg-indigo-50 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-indigo-200"
              title="현재 수정한 문구를 우리 사무소 맞춤 양식함에 저장하여 다음에도 1클릭으로 사용합니다"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>문서함에 양식으로 저장</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200/70 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              취소
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap min-h-[40px]"
            >
              <Check className="w-4 h-4" />
              <span>수정 완료 및 적용</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
