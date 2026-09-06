import React, { useState, useMemo } from 'react';
import { 
  X, FolderKanban, Plus, Search, Check, Trash2, Edit2, 
  Copy, ExternalLink, BookmarkCheck, FileText, Sparkles, 
  ShieldCheck, ArrowRight, Eye 
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import type { ContractDocType } from '../../types';
import { CONTRACT_DOC_TYPES } from '../../types';
import { 
  STANDARD_LEGAL_TEMPLATES, 
  loadLawyerCustomTemplates, 
  saveLawyerCustomTemplate, 
  deleteLawyerCustomTemplate,
  LawyerContractTemplate,
  PlaceholderVariables,
  applyTemplatePlaceholders
} from '../../services/contractTemplateService';
import { HighlightedDocumentViewer } from '../common/HighlightedDocumentViewer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (tpl: LawyerContractTemplate) => void;
  contractContext?: PlaceholderVariables;
  lawyerName?: string;
  lawFirmName?: string;
}

export const ContractDocLibraryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  contractContext = {},
  lawyerName = '담당 변호사',
  lawFirmName = '법무법인',
}) => {
  const dialog = useDialog();

  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(STANDARD_LEGAL_TEMPLATES[0]?.id || '');
  const [customTemplates, setCustomTemplates] = useState<LawyerContractTemplate[]>(() => loadLawyerCustomTemplates());

  // 커스텀 양식 신규 등록/편집 폼 상태
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<ContractDocType>('custom');
  const [formSignatureRequired, setFormSignatureRequired] = useState<'client' | 'lawyer' | 'both' | 'none'>('both');
  const [formContent, setFormContent] = useState('');
  const [formConfirmationText, setFormConfirmationText] = useState('');

  const refreshCustom = () => {
    setCustomTemplates(loadLawyerCustomTemplates());
  };

  if (!isOpen) return null;

  // 현재 탭의 템플릿 목록 필터링
  const currentList = activeTab === 'standard' ? STANDARD_LEGAL_TEMPLATES : customTemplates;

  const filteredTemplates = currentList.filter(tpl => {
    if (categoryFilter !== 'all' && tpl.category !== categoryFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        tpl.title.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        (tpl.tags && tpl.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    return true;
  });

  const selectedTemplate = currentList.find(t => t.id === selectedTemplateId) || filteredTemplates[0] || currentList[0];

  // 계약서에 추가
  const handleAddToContract = (tpl: LawyerContractTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(tpl);
      toast.success(`[${tpl.title}] 문서가 계약서에 추가되었습니다.`);
      onClose();
    }
  };

  // 표준 양식을 내 커스텀 양식으로 복사하여 저장
  const handleForkStandard = (tpl: LawyerContractTemplate) => {
    const forked = saveLawyerCustomTemplate({
      title: `${tpl.title} (복사본)`,
      description: `${lawFirmName} 맞춤형 양식`,
      category: tpl.category,
      type: tpl.type,
      signatureRequired: tpl.signatureRequired,
      requiredConfirmationText: tpl.requiredConfirmationText,
      content: tpl.content,
      tags: [...(tpl.tags || []), '맞춤수정'],
    });
    refreshCustom();
    setActiveTab('custom');
    setSelectedTemplateId(forked.id);
    toast.success('사무소 맞춤 양식함으로 복사되었습니다. 자유롭게 편집하세요!');
  };

  // 커스텀 양식 삭제
  const handleDeleteCustom = async (id: string, title: string) => {
    const confirmed = await dialog.confirm({
      title: '양식 삭제',
      message: `"${title}" 양식을 문서함에서 완전히 삭제하시겠습니까?`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    deleteLawyerCustomTemplate(id);
    refreshCustom();
    toast.success('양식이 삭제되었습니다.');
  };

  // 폼 열기 (신규 등록 or 수정)
  const handleOpenForm = (tpl?: LawyerContractTemplate) => {
    if (tpl) {
      setFormId(tpl.id);
      setFormTitle(tpl.title);
      setFormDescription(tpl.description);
      setFormType(tpl.type);
      setFormSignatureRequired(tpl.signatureRequired);
      setFormContent(tpl.content);
      setFormConfirmationText(tpl.requiredConfirmationText || '');
    } else {
      setFormId(null);
      setFormTitle('');
      setFormDescription('');
      setFormType('custom');
      setFormSignatureRequired('both');
      setFormContent(`새 양식 제목\n\n위임인: {{의뢰인명}}\n수임인: {{법무법인}} {{변호사명}}\n\n제 1 조 (목적)\n본 조항의 내용을 입력하세요.`);
      setFormConfirmationText('');
    }
    setIsFormOpen(true);
  };

  // 폼 저장
  const handleSaveForm = () => {
    if (!formTitle.trim()) {
      toast.error('양식 제목을 입력해 주세요.');
      return;
    }
    const saved = saveLawyerCustomTemplate({
      id: formId || undefined,
      title: formTitle.trim(),
      description: formDescription.trim() || `${lawFirmName} 맞춤 서식`,
      category: 'custom',
      type: formType,
      signatureRequired: formSignatureRequired,
      requiredConfirmationText: formConfirmationText.trim() || undefined,
      content: formContent,
      tags: ['사무소양식'],
    });

    refreshCustom();
    setSelectedTemplateId(saved.id);
    setIsFormOpen(false);
    toast.success('사무소 맞춤 양식이 저장되었습니다.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>계약 문서함 (서식 보관함)</span>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {activeTab === 'standard' ? '대한변협·법률 표준 11종' : `사무소 등록 ${customTemplates.length}종`}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                변호사 사무소에 필요한 정식 법률 양식을 탐색하고, 우리 사무실 전용 서식을 관리합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 상단 탭 및 툴바 */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          
          {/* 탭 버튼 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setActiveTab('standard'); setCategoryFilter('all'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'standard'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>법률 표준 서식 ({STANDARD_LEGAL_TEMPLATES.length})</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('custom'); setCategoryFilter('all'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'custom'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>우리 사무소 맞춤 양식 ({customTemplates.length})</span>
            </button>
          </div>

          {/* 검색 & 액션 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="서식명 또는 태그 검색..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-brand focus:bg-white"
              />
            </div>

            {activeTab === 'custom' && (
              <button
                type="button"
                onClick={() => handleOpenForm()}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs whitespace-nowrap cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>새 양식 등록</span>
              </button>
            )}
          </div>
        </div>

        {/* 본문 2열 레이아웃: 좌측 리스트 + 우측 상세 미리보기 */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">

          {/* 좌측 서식 목록 (5열) */}
          <div className="md:col-span-5 flex flex-col h-[520px] bg-slate-50/50">
            
            {/* 카테고리 칩 필터 (표준 탭일 때) */}
            {activeTab === 'standard' && (
              <div className="p-3 border-b border-slate-100 flex items-center gap-1 overflow-x-auto text-[11px]">
                {[
                  { id: 'all', label: '전체' },
                  { id: 'contract', label: '위임계약' },
                  { id: 'consent', label: '동의서' },
                  { id: 'power_of_attorney', label: '위임장' },
                  { id: 'special_terms', label: '특약·약정' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      categoryFilter === cat.id
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* 카드 목록 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredTemplates.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <p className="text-xs text-slate-400">검색 조건에 맞는 서식이 없습니다.</p>
                  {activeTab === 'custom' && (
                    <button
                      onClick={() => handleOpenForm()}
                      className="text-xs text-brand font-bold underline cursor-pointer"
                    >
                      새 맞춤 양식 등록하기
                    </button>
                  )}
                </div>
              ) : (
                filteredTemplates.map(tpl => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-white border-[#1E3A5F] shadow-sm ring-1 ring-[#1E3A5F]/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                            <span>{CONTRACT_DOC_TYPES[tpl.type]?.emoji || '📄'}</span>
                            <span>{tpl.title}</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {tpl.description}
                          </p>
                        </div>

                        {/* 서명 주체 뱃지 */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          tpl.signatureRequired === 'both' ? 'bg-indigo-50 text-indigo-700' :
                          tpl.signatureRequired === 'client' ? 'bg-amber-50 text-amber-700' :
                          tpl.signatureRequired === 'lawyer' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {tpl.signatureRequired === 'both' ? '양측 서명' :
                           tpl.signatureRequired === 'client' ? '의뢰인 서명' :
                           tpl.signatureRequired === 'lawyer' ? '변호사 서명' : '서명 불필요'}
                        </span>
                      </div>

                      {/* 하단 태그 및 확약 문구 표시 */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1 flex-wrap">
                          {tpl.tags?.map((t, idx) => (
                            <span key={idx} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>

                        {tpl.requiredConfirmationText && (
                          <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            ✍️ 직접확약 요구
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* 우측 상세 미리보기 및 액션 (7열) */}
          <div className="md:col-span-7 flex flex-col h-[520px] bg-white">
            {selectedTemplate ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* 상단 액션 바 */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>{selectedTemplate.title}</span>
                      {selectedTemplate.isCustom && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          사무소 맞춤
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedTemplate.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 표준 서식일 때: 내 양식으로 복사 */}
                    {activeTab === 'standard' && (
                      <button
                        type="button"
                        onClick={() => handleForkStandard(selectedTemplate)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        title="이 서식을 복사하여 우리 사무소 전용 양식으로 수정합니다"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>내 양식으로 복사</span>
                      </button>
                    )}

                    {/* 맞춤 서식일 때: 수정 & 삭제 */}
                    {activeTab === 'custom' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenForm(selectedTemplate)}
                          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="양식 수정"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(selectedTemplate.id, selectedTemplate.title)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="양식 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* 계약서에 추가 (onSelectTemplate 콜백이 있을 때) */}
                    {onSelectTemplate && (
                      <button
                        type="button"
                        onClick={() => handleAddToContract(selectedTemplate)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors whitespace-nowrap min-h-[38px]"
                      >
                        <Check className="w-4 h-4" />
                        <span>+ 계약서에 추가</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 미리보기 본문 */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 font-sans space-y-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400">
                        서약/형광펜 마커가 적용된 실제 렌더링 화면
                      </span>
                      <span className="text-[11px] text-slate-400">
                        본문 글자 수: {selectedTemplate.content.length.toLocaleString()}자
                      </span>
                    </div>

                    <HighlightedDocumentViewer
                      content={applyTemplatePlaceholders(selectedTemplate.content, {
                        ...contractContext,
                        lawyerName,
                        lawFirmName,
                      })}
                      requiredConfirmationText={selectedTemplate.requiredConfirmationText}
                    />
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                선택된 서식이 없습니다.
              </div>
            )}
          </div>

        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/70 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>모든 서식은 전자서명법 제3조 및 약관규제법 제3조 설명의무 요건을 준수합니다.</span>
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer transition-colors"
          >
            닫기
          </button>
        </div>

      </div>

      {/* 맞춤 서식 신규 등록/수정 서브 모달 */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h3 className="text-sm font-black text-slate-900">
                {formId ? '사무소 맞춤 양식 수정' : '새 사무소 맞춤 양식 등록'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">양식 제목</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="예: 당소 표준 위임계약서 (성공보수 포함)"
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">양식 설명</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="간단한 양식 용도 및 설명"
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">서명 필요 주체</label>
                  <select
                    value={formSignatureRequired}
                    onChange={e => setFormSignatureRequired(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  >
                    <option value="both">양측 서명 (변호사+의뢰인)</option>
                    <option value="client">의뢰인만 서명</option>
                    <option value="lawyer">변호사만 서명</option>
                    <option value="none">서명 불필요</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">필수 직접 확약 타이핑 문구 (선택)</label>
                  <input
                    type="text"
                    value={formConfirmationText}
                    onChange={e => setFormConfirmationText(e.target.value)}
                    placeholder="예: 특약 내용을 확인하였습니다"
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-600">양식 본문 (형광펜 마킹: ==텍스트==)</label>
                  <span className="text-[11px] text-slate-400">태그: &#123;&#123;의뢰인명&#125;&#125;, &#123;&#123;총수임료&#125;&#125;</span>
                </div>
                <textarea
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  rows={10}
                  className="w-full p-3 font-mono text-xs border rounded-xl bg-slate-50 focus:bg-white leading-relaxed"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-slate-600 font-bold rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                className="px-5 py-2 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl cursor-pointer shadow-xs"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
