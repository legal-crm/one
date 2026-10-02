import React, { useState, useMemo } from 'react';
import { Search, Copy, Check, MapPin, Hash, User, ListPlus, ListChecks, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { CREDITOR_DIRECTORY, CreditorDirectoryItem } from '../../../../services/court/creditorAddressDirectory';
import { setDockShared, useDockShared } from '../dockShared';
import { copyText, useCopyFeedback } from '../clipboard';

type CategoryFilter = 'ALL' | 'BASKET' | CreditorDirectoryItem['category'];

const CATEGORY_NAMES: Record<Exclude<CategoryFilter, 'BASKET'>, string> = {
  ALL: '전체',
  BANK: '은행',
  CARD: '카드',
  CAPITAL: '캐피탈',
  SAVINGS_BANK: '저축은행',
  LOAN_NPL: '대부/채권',
  PUBLIC_AGENCY: '공공기관',
};

const CAUTION = '※ 참고용 주소록입니다. 대표자·본점 주소는 법인등기사항증명서로 최신 여부를 확인하세요.';

export default function CreditorSearchTool() {
  const shared = useDockShared();
  const basket = shared.creditorBasket;
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const { copiedKey, copy } = useCopyFeedback();

  const basketItems = useMemo(
    () => basket.map(id => CREDITOR_DIRECTORY.find(c => c.id === id)).filter((c): c is CreditorDirectoryItem => !!c),
    [basket],
  );

  // 검색 및 필터링
  const filteredList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return CREDITOR_DIRECTORY.filter(item => {
      if (category === 'BASKET' && !basket.includes(item.id)) return false;
      if (category !== 'ALL' && category !== 'BASKET' && item.category !== category) return false;
      if (!term) return true;
      return (
        item.officialName.toLowerCase().includes(term) ||
        item.representative.toLowerCase().includes(term) ||
        item.address.toLowerCase().includes(term) ||
        item.serviceAddress.toLowerCase().includes(term) ||
        item.bizNumber.includes(term) ||
        item.alias.some(a => a.toLowerCase().includes(term))
      );
    });
  }, [searchTerm, category, basket]);

  const toggleBasket = (item: CreditorDirectoryItem) => {
    const inBasket = basket.includes(item.id);
    setDockShared({ creditorBasket: inBasket ? basket.filter(id => id !== item.id) : [...basket, item.id] });
    toast.success(inBasket ? `목록에서 뺐습니다: ${item.officialName}` : `채권자 목록에 담았습니다: ${item.officialName}`);
  };

  const handleCopyField = (text: string, label: string) => {
    copyText(text, `${label}을(를) 복사했습니다.`);
  };

  const fullInfo = (item: CreditorDirectoryItem) => `• 채권자명: ${item.officialName}
• 대표자: ${item.representative}
• 법인/사업자등록번호: ${item.bizNumber}
• 법원 송달장소: (${item.zipCode}) ${item.serviceAddress}
• 대표전화: ${item.phone || '해당 없음'}`;

  const handleCopyFull = (item: CreditorDirectoryItem) => {
    copy(`[채권자 송달정보]\n${fullInfo(item)}\n${CAUTION}`, `${item.officialName} 송달정보를 복사했습니다.`, item.id);
  };

  const handleCopyBasket = () => {
    if (basketItems.length === 0) return;
    const lines = basketItems.map((item, i) =>
      `${i + 1}. ${item.officialName} (${item.bizNumber})\n   송달장소: (${item.zipCode}) ${item.serviceAddress}\n   대표자: ${item.representative}`,
    );
    copy(`[채권자 송달정보 목록 · ${basketItems.length}곳]\n${lines.join('\n')}\n${CAUTION}`, `담은 채권자 ${basketItems.length}곳의 송달정보를 복사했습니다.`, 'basket');
  };

  const handleApplyCount = () => {
    setDockShared({ creditorCount: basketItems.length });
    toast.success(`송달료 계산기의 채권자 수를 ${basketItems.length}곳으로 반영했습니다.`);
  };

  const handleClearBasket = () => {
    setDockShared({ creditorBasket: [] });
    if (category === 'BASKET') setCategory('ALL');
    toast.info('담은 채권자 목록을 비웠습니다.');
  };

  return (
    <div className="p-3.5 space-y-3 text-xs text-slate-800">
      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-2 py-1.5 leading-snug">
        참고용 주소록입니다. 대표자 변경·본점 이전이 잦으므로 채권자목록 작성 전 법인등기사항증명서로 반드시 확인하세요.
      </p>

      {/* ── 담은 채권자 바 ── */}
      {basketItems.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-indigo-950 flex items-center gap-1">
              <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
              담은 채권자 {basketItems.length}곳
            </span>
            <button
              type="button"
              onClick={handleClearBasket}
              className="text-xs font-bold text-slate-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              비우기
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleCopyBasket}
              className="py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer press-scale whitespace-nowrap"
            >
              {copiedKey === 'basket' ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
              {copiedKey === 'basket' ? '복사됨' : '목록 전체 복사'}
            </button>
            <button
              type="button"
              onClick={handleApplyCount}
              className="py-1.5 rounded-xl bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-bold cursor-pointer press-scale whitespace-nowrap"
            >
              송달료 채권자 수 반영
            </button>
          </div>
        </div>
      )}

      {/* ── 검색창 ── */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" aria-hidden="true" />
        <input
          type="search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="채권자명, 별칭 검색 (예: 국민, 현대, 신보)"
          aria-label="채권자 검색"
          className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            aria-label="검색어 지우기"
            className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── 카테고리 필터 칩 ── */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1" role="radiogroup" aria-label="채권자 분류">
        {(Object.keys(CATEGORY_NAMES) as Exclude<CategoryFilter, 'BASKET'>[]).map(cat => (
          <button
            key={cat}
            type="button"
            role="radio"
            aria-checked={category === cat}
            onClick={() => setCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              category === cat ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {CATEGORY_NAMES[cat]}
          </button>
        ))}
        {basketItems.length > 0 && (
          <button
            type="button"
            role="radio"
            aria-checked={category === 'BASKET'}
            onClick={() => setCategory('BASKET')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              category === 'BASKET' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
            }`}
          >
            담은 목록 ({basketItems.length})
          </button>
        )}
      </div>

      {/* ── 검색 결과 목록 ── */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>검색 결과: 총 {filteredList.length}건</span>
          <span>항목을 누르면 복사됩니다.</span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-6 text-center text-slate-600 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <p className="font-bold">일치하는 채권자가 없습니다.</p>
            <p className="text-xs text-slate-500">철자나 별칭을 확인하거나 분류를 ‘전체’로 바꿔 보세요.</p>
            {(searchTerm || category !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCategory('ALL');
                }}
                className="mt-1 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer press-scale"
              >
                검색 초기화
              </button>
            )}
          </div>
        ) : (
          filteredList.map(item => {
            const inBasket = basket.includes(item.id);
            return (
              <div
                key={item.id}
                className={`p-3 bg-white border rounded-2xl hover:shadow-xs transition-all space-y-2 ${
                  inBasket ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs text-slate-900">{item.officialName}</span>
                      <span className="text-xs bg-indigo-50 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200/50 shrink-0">
                        {item.categoryLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">검색어: {item.alias.join(', ')}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleBasket(item)}
                      aria-pressed={inBasket}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer press-scale ${
                        inBasket ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                      }`}
                      title={inBasket ? '채권자 목록에서 빼기' : '채권자 목록에 담기'}
                    >
                      {inBasket ? <Check className="w-3 h-3" aria-hidden="true" /> : <ListPlus className="w-3 h-3" aria-hidden="true" />}
                      {inBasket ? '담김' : '담기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFull(item)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer press-scale"
                      title="전자소송용 전체 송달정보 복사"
                    >
                      {copiedKey === item.id ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                      <span>{copiedKey === item.id ? '복사됨' : '전체복사'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleCopyField(item.representative, '대표자')}
                    className="flex items-center gap-1.5 text-left p-1 rounded hover:bg-slate-100 transition-colors text-slate-700 truncate cursor-pointer"
                    title="클릭 시 대표자명 복사"
                  >
                    <User className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                    <span className="text-slate-500 shrink-0">대표자:</span>
                    <span className="font-bold text-slate-900 truncate">{item.representative}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyField(item.bizNumber, '사업자/법인번호')}
                    className="flex items-center gap-1.5 text-left p-1 rounded hover:bg-slate-100 transition-colors text-slate-700 truncate cursor-pointer"
                    title="클릭 시 등록번호 복사"
                  >
                    <Hash className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                    <span className="text-slate-500 shrink-0">등록번호:</span>
                    <span className="font-bold font-mono text-slate-900 truncate">{item.bizNumber}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyField(`(${item.zipCode}) ${item.serviceAddress}`, '법원 송달장소')}
                  className="w-full flex items-start gap-1.5 text-left p-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-200 transition-colors text-slate-700 cursor-pointer"
                  title="클릭 시 송달장소 주소 복사"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="text-xs text-indigo-800 font-bold block">법원 송달장소 (우편번호 {item.zipCode})</span>
                    <span className="font-medium text-slate-900 text-xs leading-tight block">{item.serviceAddress}</span>
                  </span>
                  <Copy className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
