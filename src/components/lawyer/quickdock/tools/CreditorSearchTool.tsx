import React, { useState, useMemo } from 'react';
import { Search, Copy, Check, Building2, Phone, MapPin, Hash, User, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { CREDITOR_DIRECTORY, CreditorDirectoryItem } from '../../../../services/court/creditorAddressDirectory';

type CategoryFilter = 'ALL' | 'BANK' | 'CARD' | 'CAPITAL' | 'SAVINGS_BANK' | 'LOAN_NPL' | 'PUBLIC_AGENCY';

const CATEGORY_NAMES: Record<CategoryFilter, string> = {
  ALL: '전체',
  BANK: '은행',
  CARD: '카드',
  CAPITAL: '캐피탈',
  SAVINGS_BANK: '저축은행',
  LOAN_NPL: '대부/채권',
  PUBLIC_AGENCY: '공공기관',
};

export default function CreditorSearchTool() {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 검색 및 필터링
  const filteredList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return CREDITOR_DIRECTORY.filter(item => {
      // 카테고리 필터
      if (category !== 'ALL' && item.category !== category) return false;

      // 검색어 필터
      if (!term) return true;

      if (item.officialName.toLowerCase().includes(term)) return true;
      if (item.representative.toLowerCase().includes(term)) return true;
      if (item.address.toLowerCase().includes(term)) return true;
      if (item.serviceAddress.toLowerCase().includes(term)) return true;
      if (item.bizNumber.includes(term)) return true;
      if (item.alias.some(a => a.toLowerCase().includes(term))) return true;

      return false;
    });
  }, [searchTerm, category]);

  // 개별 텍스트 복사 헬퍼
  const handleCopyField = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label}이(가) 복사되었습니다.`);
  };

  // 전체 정보 복사
  const handleCopyFull = (item: CreditorDirectoryItem) => {
    const text = `[채권자 송달정보]
• 채권자명: ${item.officialName}
• 대표자: ${item.representative}
• 법인/사업자등록번호: ${item.bizNumber}
• 법원 송달장소: (${item.zipCode}) ${item.serviceAddress}
• 대표전화: ${item.phone || '해당 없음'}`;

    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    toast.success(`${item.officialName} 송달정보 전체가 복사되었습니다.`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-3.5 space-y-3 text-xs text-slate-800">
      {/* ── 상단 검색창 ── */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="채권자명, 별칭 검색 (예: 국민, 현대, 신보, 산와)"
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── 카테고리 필터 칩 ── */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
        {(Object.keys(CATEGORY_NAMES) as CategoryFilter[]).map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              category === cat
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {CATEGORY_NAMES[cat]}
          </button>
        ))}
      </div>

      {/* ── 검색 결과 목록 ── */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
          <span>검색 결과: 총 {filteredList.length}건</span>
          <span>클릭 시 해당 항목이 즉시 복사됩니다.</span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
            <p className="font-bold">일치하는 채권자가 없습니다.</p>
            <p className="text-[11px] mt-1">철자나 별칭을 확인해주세요.</p>
          </div>
        ) : (
          filteredList.map(item => (
            <div
              key={item.id}
              className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-xs transition-all space-y-2 group"
            >
              {/* 헤더: 정식 법인명 & 전체복사 버튼 */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-slate-900">
                      {item.officialName}
                    </span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded border border-indigo-200/50">
                      {item.categoryLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    검색어: {item.alias.join(', ')}
                  </p>
                </div>

                <button
                  onClick={() => handleCopyFull(item)}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer press-scale active:scale-95"
                  title="전자소송용 전체 송달정보 복사"
                >
                  {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === item.id ? '복사됨' : '전체복사'}</span>
                </button>
              </div>

              {/* 세부 필드 (각각 원클릭 복사 가능) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleCopyField(item.representative, '대표자')}
                  className="flex items-center gap-1.5 text-left p-1 rounded hover:bg-slate-100 transition-colors text-slate-700 truncate cursor-pointer"
                  title="클릭 시 대표자명 복사"
                >
                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-slate-400 shrink-0">대표자:</span>
                  <span className="font-bold text-slate-900 truncate">{item.representative}</span>
                </button>

                <button
                  onClick={() => handleCopyField(item.bizNumber, '사업자/법인번호')}
                  className="flex items-center gap-1.5 text-left p-1 rounded hover:bg-slate-100 transition-colors text-slate-700 truncate cursor-pointer"
                  title="클릭 시 등록번호 복사"
                >
                  <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-slate-400 shrink-0">등록번호:</span>
                  <span className="font-bold font-mono text-slate-900 truncate">{item.bizNumber}</span>
                </button>
              </div>

              {/* 법원 송달장소 주소 (가장 중요) */}
              <button
                onClick={() => handleCopyField(`(${item.zipCode}) ${item.serviceAddress}`, '법원 송달장소')}
                className="w-full flex items-start gap-1.5 text-left p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-200 transition-colors text-slate-700 cursor-pointer"
                title="클릭 시 송달장소 주소 복사"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-indigo-700 font-bold block">법원 송달장소 (우편번호 {item.zipCode})</span>
                  <span className="font-medium text-slate-900 text-[11px] leading-tight block">
                    {item.serviceAddress}
                  </span>
                </div>
                <Copy className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0 mt-0.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
