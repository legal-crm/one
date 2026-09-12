import React, { useState, useMemo } from 'react';
import { 
  X, Plus, Search, Trash2, ArrowUp, ArrowDown, RotateCcw, 
  Check, Edit3, ExternalLink, HelpCircle, ShieldCheck, 
  Sparkles, FileText, CheckCircle2, AlertCircle, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ApplicationDocTemplateService, 
  APPLICATION_CATEGORIES, 
  type ApplicationDocMasterItem, 
  type DocCategoryKey 
} from '../../../services/documents/applicationDocTemplateService';

interface ApplicationDocSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ApplicationDocSettingsModal({
  isOpen,
  onClose,
  onSaved
}: ApplicationDocSettingsModalProps) {
  if (!isOpen) return null;

  const [activeCategory, setActiveCategory] = useState<DocCategoryKey>('REHAB_SALARIED');
  const [searchQuery, setSearchQuery] = useState('');
  const [templates, setTemplates] = useState<ApplicationDocMasterItem[]>(() => {
    return ApplicationDocTemplateService.getTemplates();
  });

  // 새 서류 추가 모드
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAgency, setNewAgency] = useState('정부24 / 주민센터');
  const [newAgencyUrl, setNewAgencyUrl] = useState('');
  const [newTips, setNewTips] = useState('');
  const [newIsRequired, setNewIsRequired] = useState(true);
  const [newIsThirdPartyMasking, setNewIsThirdPartyMasking] = useState(false);

  // 개별 서류 수정 모드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAgency, setEditAgency] = useState('');
  const [editAgencyUrl, setEditAgencyUrl] = useState('');
  const [editTips, setEditTips] = useState('');
  const [editIsRequired, setEditIsRequired] = useState(true);
  const [editIsThirdPartyMasking, setEditIsThirdPartyMasking] = useState(false);

  const refreshList = () => {
    setTemplates(ApplicationDocTemplateService.getTemplates());
    if (onSaved) onSaved();
  };

  // 현재 선택된 카테고리의 서류 목록 필터링
  const currentCategoryDocs = useMemo(() => {
    return templates
      .filter(item => item.category === activeCategory)
      .sort((a, b) => a.order - b.order)
      .filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.agency.toLowerCase().includes(q) ||
          item.tips.toLowerCase().includes(q)
        );
      });
  }, [templates, activeCategory, searchQuery]);

  // 새 서류 등록
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('서류명을 입력해 주세요.');
      return;
    }

    ApplicationDocTemplateService.addTemplate({
      name: newName.trim(),
      category: activeCategory,
      agency: newAgency.trim() || '정부24 / 주민센터',
      agencyUrl: newAgencyUrl.trim() || undefined,
      tips: newTips.trim() || '관공서 또는 온라인을 통해 발급받아 첨부해 주세요.',
      isRequired: newIsRequired,
      isThirdPartyMasking: newIsThirdPartyMasking
    });

    toast.success(`'${newName}' 서류가 ${APPLICATION_CATEGORIES.find(c => c.key === activeCategory)?.label} 목록에 추가되었습니다.`);
    setIsAdding(false);
    setNewName('');
    setNewAgency('정부24 / 주민센터');
    setNewAgencyUrl('');
    setNewTips('');
    setNewIsRequired(true);
    setNewIsThirdPartyMasking(false);
    refreshList();
  };

  // 서류 수정 시작
  const handleStartEdit = (item: ApplicationDocMasterItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditAgency(item.agency);
    setEditAgencyUrl(item.agencyUrl || '');
    setEditTips(item.tips);
    setEditIsRequired(item.isRequired);
    setEditIsThirdPartyMasking(!!item.isThirdPartyMasking);
  };

  // 서류 수정 저장
  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) {
      toast.error('서류명을 입력해 주세요.');
      return;
    }

    ApplicationDocTemplateService.updateTemplate(id, {
      name: editName.trim(),
      agency: editAgency.trim(),
      agencyUrl: editAgencyUrl.trim() || undefined,
      tips: editTips.trim(),
      isRequired: editIsRequired,
      isThirdPartyMasking: editIsThirdPartyMasking
    });

    toast.success('신청서류 설정이 저장되었습니다.');
    setEditingId(null);
    refreshList();
  };

  // 서류 삭제
  const handleDelete = (id: string, name: string) => {
    if (confirm(`'${name}' 서류를 마스터 목록에서 삭제하시겠습니까?`)) {
      ApplicationDocTemplateService.deleteTemplate(id);
      toast.success(`'${name}' 서류가 삭제되었습니다.`);
      refreshList();
    }
  };

  // 순서 이동
  const handleMove = (id: string, direction: 'UP' | 'DOWN') => {
    ApplicationDocTemplateService.moveTemplateOrder(id, direction);
    refreshList();
  };

  // 기본 표준 데이터셋 복원
  const handleReset = () => {
    if (confirm('모든 신청서류 템플릿을 신우법무사/리걸플로 표준 기본 데이터셋(22종)으로 초기화하시겠습니까? (직접 추가한 커스텀 항목은 초기화됩니다)')) {
      ApplicationDocTemplateService.resetToDefaults();
      toast.success('표준 신청서류 데이터셋으로 복원되었습니다.');
      refreshList();
    }
  };

  const currentCatInfo = APPLICATION_CATEGORIES.find(c => c.key === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* 상단 헤더 */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-black text-lg">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  신청서류 마스터 설정 (LegalFlow Engine)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand/10 text-brand border border-brand/20">
                  사무소 공통 서류 템플릿
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                사건 및 소득 유형에 따라 의뢰인이 제출할 필수 서류와 발급 팁을 미리 설정하여 원클릭 배포합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all flex items-center gap-1 cursor-pointer press-scale"
              title="리걸플로 표준 템플릿으로 초기화"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>표준 복원</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 카테고리 탭 (리걸플로 그림 2-10 벤치마킹) */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-1.5 overflow-x-auto shrink-0">
          {APPLICATION_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                setIsAdding(false);
                setEditingId(null);
              }}
              className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeCategory === cat.key
                  ? 'bg-white text-brand shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>{cat.badge}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* 안내 및 액션 바 (검색 + 추가 버튼) */}
        <div className="px-6 py-3.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              {currentCatInfo?.description}
            </span>
            <span className="text-xs font-black text-brand bg-brand/10 px-2 py-0.5 rounded-full">
              총 {currentCategoryDocs.length}개 서류
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="서류명, 발급처, 팁 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-brand focus:bg-white transition-all"
              />
            </div>

            <button
              onClick={() => setIsAdding(true)}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 press-scale cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 서류 추가</span>
            </button>
          </div>
        </div>

        {/* 메인 콘텐츠: 서류 리스트 테이블 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* 새 서류 추가 폼 카드 */}
          {isAdding && (
            <form 
              onSubmit={handleAddSubmit}
              className="p-4 bg-brand/5 border border-brand/20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-brand flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>[{currentCatInfo?.label}] 새 신청서류 등록</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  취소
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">서류 공식 명칭 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 주민등록등본, 급여명세서"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-brand"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">발급처 기관 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 정부24, 국세청 홈택스"
                    value={newAgency}
                    onChange={e => setNewAgency(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-brand"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">온라인 발급 링크 (URL)</label>
                  <input
                    type="url"
                    placeholder="https://www.gov.kr/..."
                    value={newAgencyUrl}
                    onChange={e => setNewAgencyUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-brand"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">발급 팁 및 의뢰인 주의사항 안내문</label>
                <input
                  type="text"
                  placeholder="예: 과거 주소 전체 변동사항 포함, 5년 치 전국단위 모든세목 표시 발급"
                  value={newTips}
                  onChange={e => setNewTips(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-brand"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={newIsRequired}
                      onChange={e => setNewIsRequired(e.target.checked)}
                      className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand"
                    />
                    <span>법정 필수 서류로 지정</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      checked={newIsThirdPartyMasking}
                      onChange={e => setNewIsThirdPartyMasking(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 border-amber-300 focus:ring-amber-500"
                    />
                    <span>제3자 주민번호 뒷자리 마스킹(******) 대상</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-black text-xs rounded-xl shadow-xs transition-all press-scale cursor-pointer"
                >
                  저장하고 목록에 추가
                </button>
              </div>
            </form>
          )}

          {/* 테이블 영역 */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="p-3 text-center w-14">순번</th>
                  <th className="p-3 w-48">서류명</th>
                  <th className="p-3 w-40">발급처</th>
                  <th className="p-3">발급 팁 & 의뢰인 안내사항</th>
                  <th className="p-3 text-center w-24">구분</th>
                  <th className="p-3 text-center w-28">순서/관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {currentCategoryDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      등록된 신청서류가 없습니다. [+ 새 서류 추가] 버튼을 눌러 등록해 보세요.
                    </td>
                  </tr>
                ) : (
                  currentCategoryDocs.map((item, idx) => {
                    const isEditing = editingId === item.id;

                    if (isEditing) {
                      return (
                        <tr key={item.id} className="bg-amber-50/40">
                          <td className="p-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={editAgency}
                              onChange={e => setEditAgency(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                            <input
                              type="url"
                              placeholder="URL"
                              value={editAgencyUrl}
                              onChange={e => setEditAgencyUrl(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] mt-1 text-blue-600"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={editTips}
                              onChange={e => setEditTips(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                            <div className="mt-1 flex items-center gap-2">
                              <label className="text-[10px] font-bold text-amber-800 flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editIsThirdPartyMasking}
                                  onChange={e => setEditIsThirdPartyMasking(e.target.checked)}
                                  className="w-3 h-3 text-amber-600 rounded"
                                />
                                <span>제3자 마스킹 필수</span>
                              </label>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <select
                              value={editIsRequired ? 'required' : 'optional'}
                              onChange={e => setEditIsRequired(e.target.value === 'required')}
                              className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold"
                            >
                              <option value="required">필수</option>
                              <option value="optional">해당자</option>
                            </select>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                                title="저장"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                                title="취소"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-900 block">{item.name}</span>
                          {item.isThirdPartyMasking && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded inline-flex items-center gap-1 mt-0.5">
                              <ShieldCheck className="w-3 h-3 text-amber-600" />
                              <span>제3자 마스킹</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-700">{item.agency}</div>
                          {item.agencyUrl && (
                            <a
                              href={item.agencyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                            >
                              <span>발급 사이트</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="text-slate-600 text-xs leading-relaxed">
                            {item.tips}
                          </p>
                        </td>
                        <td className="p-3 text-center">
                          {item.isRequired ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              필수
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              해당자
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleMove(item.id, 'UP')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              title="위로 이동"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMove(item.id, 'DOWN')}
                              disabled={idx === currentCategoryDocs.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              title="아래로 이동"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                              title="수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 모달 하단 푸터 */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>설정한 서류 템플릿은 CRM Stage 2 및 의뢰인 모바일 앱(웹)에 실시간 자동 반영됩니다.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all press-scale cursor-pointer"
          >
            설정 닫기
          </button>
        </div>

      </div>
    </div>
  );
}
