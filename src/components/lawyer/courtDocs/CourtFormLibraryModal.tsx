/**
 * CourtFormLibraryModal.tsx
 * 법원 양식 라이브러리 — 60종 양식 브라우저 + 편집 + 인쇄/PDF 저장
 */

import { useState, useEffect, useRef } from 'react';
import { 
  X, Search, Printer, Download, FileText, 
  FolderOpen, ChevronRight, Edit3, Eye, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';

interface CourtFormEntry {
  id: string;
  name: string;
  dCode: string | null;
  category: string;
  fileName: string;
  html: string;
}

interface CourtFormLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  '개인회생신청': { label: '개인회생 신청', icon: '📋', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  '채권자관련': { label: '채권자 관련', icon: '👥', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  '변제계획': { label: '변제계획', icon: '📊', color: 'bg-green-50 text-green-700 border-green-200' },
  '보전처분': { label: '보전처분', icon: '🛡️', color: 'bg-red-50 text-red-700 border-red-200' },
  '간이양식': { label: '간이양식', icon: '📝', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  '면책': { label: '면책', icon: '✅', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  '파산': { label: '파산', icon: '⚖️', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  '기타': { label: '기타', icon: '📄', color: 'bg-gray-50 text-gray-700 border-gray-200' },
};

export default function CourtFormLibraryModal({ isOpen, onClose }: CourtFormLibraryModalProps) {
  const [forms, setForms] = useState<CourtFormEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<CourtFormEntry | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // 양식 라이브러리 로드
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/court-forms-library.json')
      .then(res => res.json())
      .then((data: CourtFormEntry[]) => {
        setForms(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error('양식 라이브러리를 불러오지 못했습니다');
        setLoading(false);
      });
  }, [isOpen]);

  // 필터링
  const filtered = forms.filter(f => {
    if (selectedCategory && f.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return f.name.toLowerCase().includes(q) || (f.dCode?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  // 카테고리별 그룹
  const categories = [...new Set(forms.map(f => f.category))];
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = forms.filter(f => f.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  // 인쇄
  const handlePrint = () => {
    if (!selectedForm || !printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('팝업이 차단되었습니다. 팝업을 허용해 주세요.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedForm.name}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 portrait; margin: 45mm 20mm 30mm 20mm; }
            body {
              margin: 0; padding: 0;
              font-family: 'Batang', 'BatangChe', '바탕', serif;
              font-size: 16px; line-height: 2.0; color: #000;
              -webkit-print-color-adjust: exact;
            }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            td, th { border: 1px solid #000; padding: 6px 8px; }
            h2 { text-align: center; font-size: 20px; letter-spacing: 0.15em; }
            .editable-field { background: #f0f0f0; min-width: 60px; display: inline-block; }
            @media print { .editable-field { background: transparent; } }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white w-[95vw] h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-3 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold">법원 양식 라이브러리</h2>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-lg">
                {forms.length}종
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedForm && (
                <>
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      isEditMode ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {isEditMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {isEditMode ? '편집 중' : '미리보기'}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    인쇄 / PDF
                  </button>
                </>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* 좌측 사이드바: 카테고리 + 양식 목록 */}
            <aside className="w-80 border-r bg-slate-50 flex flex-col overflow-hidden">
              {/* 검색 */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="양식명 또는 D코드 검색..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              {/* 카테고리 필터 */}
              <div className="p-3 border-b space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-sm transition ${
                    !selectedCategory ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <span>전체</span>
                  <span className="text-xs">{forms.length}</span>
                </button>
                {categories.map(cat => {
                  const info = CATEGORY_LABELS[cat] || CATEGORY_LABELS['기타'];
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-sm transition ${
                        selectedCategory === cat ? `${info.color} font-medium border` : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span>{info.icon} {info.label}</span>
                      <span className="text-xs">{categoryCounts[cat]}</span>
                    </button>
                  );
                })}
              </div>

              {/* 양식 리스트 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {loading ? (
                  <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                    양식 로딩 중...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                    <FileText className="w-8 h-8 mb-2 opacity-50" />
                    검색 결과가 없습니다
                  </div>
                ) : (
                  filtered.map(form => (
                    <button
                      key={form.id + form.fileName}
                      onClick={() => { setSelectedForm(form); setIsEditMode(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition flex items-center gap-2 ${
                        selectedForm?.fileName === form.fileName
                          ? 'bg-blue-100 text-blue-800 font-medium'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <FileText className="w-4 h-4 flex-shrink-0 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{form.name}</div>
                        {form.dCode && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{form.dCode}</div>
                        )}
                      </div>
                      <ChevronRight className="w-3 h-3 flex-shrink-0 text-slate-300" />
                    </button>
                  ))
                )}
              </div>
            </aside>

            {/* 우측 메인: A4 프리뷰 */}
            <main className="flex-1 bg-slate-200 overflow-y-auto p-6 flex justify-center">
              {selectedForm ? (
                <div 
                  ref={printRef}
                  contentEditable={isEditMode}
                  suppressContentEditableWarning
                  className="bg-white max-w-[210mm] min-h-[297mm] w-full shadow-xl font-serif text-[16px] leading-[2.0] text-black"
                  style={{ padding: '170px 76px 113px 76px' }}
                  dangerouslySetInnerHTML={{ __html: selectedForm.html }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FolderOpen className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">양식을 선택하세요</p>
                  <p className="text-sm mt-1">좌측 목록에서 법원 양식을 클릭하면 미리보기/편집할 수 있습니다</p>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
