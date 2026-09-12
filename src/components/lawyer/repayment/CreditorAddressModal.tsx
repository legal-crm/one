import React, { useState, useEffect } from 'react';
import { X, MapPin, Sparkles, Building2, Search, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { RepaymentCreditor } from '../../../services/repayment/repaymentTypes';
import { matchCreditorPreset, searchCreditorAddress, type CreditorDirectoryItem } from '../../../services/court/creditorAddressDirectory';

interface CreditorAddressModalProps {
  isOpen: boolean;
  creditor: RepaymentCreditor | null;
  onClose: () => void;
  onSave: (updated: RepaymentCreditor) => void;
}

export default function CreditorAddressModal({
  isOpen,
  creditor,
  onClose,
  onSave,
}: CreditorAddressModalProps) {
  if (!isOpen || !creditor) return null;

  const [formState, setFormState] = useState({
    name: creditor.name || '',
    zipCode: creditor.zipCode || '',
    address: creditor.address || '',
    serviceAddress: creditor.serviceAddress || '',
    representative: creditor.representative || '',
    bizNumber: creditor.bizNumber || '',
    debtCauseDetail: creditor.debtCauseDetail || '대여금 / 신용대출',
    borrowedDate: creditor.borrowedDate || '2023-01-01',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // 프리셋 자동 매칭
  const matchedPreset = matchCreditorPreset(creditor.name);
  const searchResults = searchQuery.trim() ? searchCreditorAddress(searchQuery) : [];

  const handleApplyPreset = (preset: CreditorDirectoryItem) => {
    setFormState(prev => ({
      ...prev,
      name: preset.officialName,
      zipCode: preset.zipCode,
      address: preset.address,
      serviceAddress: preset.serviceAddress,
      representative: preset.representative,
      bizNumber: preset.bizNumber,
    }));
    setShowSearchDropdown(false);
    toast.success(`'${preset.officialName}' 공식 송달주소가 적용되었습니다!`);
  };

  const handleSave = () => {
    if (!formState.address.trim()) {
      toast.error('채권자 본점 주소 또는 송달장소를 입력해 주세요.');
      return;
    }

    onSave({
      ...creditor,
      name: formState.name,
      zipCode: formState.zipCode.trim(),
      address: formState.address.trim(),
      serviceAddress: formState.serviceAddress.trim() || formState.address.trim(),
      representative: formState.representative.trim(),
      bizNumber: formState.bizNumber.trim(),
      debtCauseDetail: formState.debtCauseDetail.trim(),
      borrowedDate: formState.borrowedDate,
    });

    toast.success(`'${formState.name}' 법원 송달주소가 저장되었습니다.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-sm">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <span>채권자 법원 송달주소 관리</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  #{creditor.creditorNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                대법원 전자소송 채권자목록 제출 및 법원 우편 송달용 필수 정보
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 바디 영역 */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* 1. 추천 DB 프리셋 원클릭 반영 바 */}
          {matchedPreset && (
            <div className="bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-200 text-indigo-950 flex items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <div className="text-xs font-black flex items-center gap-1.5 text-indigo-900">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>공식 금융기관 DB 일치: {matchedPreset.officialName}</span>
                </div>
                <div className="text-[11px] text-slate-600 truncate max-w-md">
                  {matchedPreset.address} (우: {matchedPreset.zipCode}) · {matchedPreset.representative}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleApplyPreset(matchedPreset)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-xs cursor-pointer press-scale"
              >
                원클릭 적용
              </button>
            </div>
          )}

          {/* 2. 금융기관 검색 (DB 직접 조회) */}
          <div className="relative">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              🏢 주요 금융기관 송달지 검색 (은행/카드/캐피탈/저축은행/공공기관 50+ DB)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="예: 국민은행, 신한카드, 현대캐피탈, 캠코, 건강보험공단..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleApplyPreset(item)}
                    className="w-full p-2.5 text-left hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        {item.officialName}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">({item.categoryLabel})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-sm">
                        {item.address} (우: {item.zipCode})
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 px-2 py-0.5 rounded bg-indigo-50">
                      선택
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. 주소 및 법인 상세 입력 폼 */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                채권자명 (정식 법인명 또는 개인 성명) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: 주식회사 국민은행, 홍길동"
                className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  우편번호 (5자리)
                </label>
                <input
                  type="text"
                  value={formState.zipCode}
                  onChange={(e) => setFormState(prev => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="예: 07331"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  대표자 (대표이사 등)
                </label>
                <input
                  type="text"
                  value={formState.representative}
                  onChange={(e) => setFormState(prev => ({ ...prev, representative: e.target.value }))}
                  placeholder="예: 은행장 이재근"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                본점 소재지 / 주민등록상 주소 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formState.address}
                onChange={(e) => setFormState(prev => ({ ...prev, address: e.target.value }))}
                placeholder="예: 서울특별시 영등포구 의사당대로 141 (여의도동)"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                법원 우편물 송달장소 (우편물 수령처)
              </label>
              <input
                type="text"
                value={formState.serviceAddress}
                onChange={(e) => setFormState(prev => ({ ...prev, serviceAddress: e.target.value }))}
                placeholder="본점과 동일하거나 특정 지점/부서 지정 시 입력 (미입력 시 본점 주소 적용)"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  사업자/법인등록번호
                </label>
                <input
                  type="text"
                  value={formState.bizNumber}
                  onChange={(e) => setFormState(prev => ({ ...prev, bizNumber: e.target.value }))}
                  placeholder="예: 201-81-47789"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  차용원인
                </label>
                <input
                  type="text"
                  value={formState.debtCauseDetail}
                  onChange={(e) => setFormState(prev => ({ ...prev, debtCauseDetail: e.target.value }))}
                  placeholder="예: 대여금 / 신용대출"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>법원 필수 송달 절차 안내</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                법원은 개시결정문, 채권자목록, 변제계획안을 알고 있는 모든 채권자에게 우편으로 직접 송달합니다.
                채권양도(NPL)된 채권의 경우 최종 양수인의 정확한 송달 주소를 기재해야 절차 지연(주소보정명령)을 방지할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 모달 하단 버튼 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all cursor-pointer press-scale flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>송달주소 저장 완료</span>
          </button>
        </div>
      </div>
    </div>
  );
}
