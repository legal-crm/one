import React, { useState, useMemo } from 'react';
import { 
  X, Plus, Trash2, CheckCircle2, AlertTriangle, Building2, CreditCard, 
  MapPin, ShieldAlert, Sparkles, ArrowRight, Info, Check, HelpCircle, Landmark, Car, Home
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../common/ModalPortal';
import { 
  DebtIntakeRuleService,
  POPULAR_CREDITORS_PRESET,
  MAJOR_4_BANKS,
  REGIONAL_CREDIT_GUARANTEE_REGIONS,
  type ClientDebtIntakeEntry,
  type CreditorCategoryType,
  type DebtCollateralType,
  type ClientDebtIntakePayload
} from '../../services/repayment/debtIntakeRuleService';

interface ClientDebtIntakeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  onComplete?: (entries: ClientDebtIntakeEntry[]) => void;
}

export default function ClientDebtIntakeWizardModal({
  isOpen,
  onClose,
  clientId,
  clientName = '의뢰인',
  clientPhone = '010-0000-0000',
  onComplete
}: ClientDebtIntakeWizardModalProps) {
  if (!isOpen) return null;

  // 기존 저장된 내역 불러오기 (없으면 기본 샘플)
  const existingIntake = useMemo(() => {
    return DebtIntakeRuleService.getClientIntake(clientId);
  }, [clientId]);

  const [entries, setEntries] = useState<ClientDebtIntakeEntry[]>(() => {
    if (existingIntake && existingIntake.entries.length > 0) {
      return existingIntake.entries;
    }
    // 기본 추천 3개
    return [
      {
        id: `entry_${Date.now()}_1`,
        category: 'BANK',
        institutionName: '국민은행',
        hasSeparateCreditCard: true,
        collateralType: 'NONE',
      },
      {
        id: `entry_${Date.now()}_2`,
        category: 'MUTUAL_FINANCE',
        institutionName: '새마을금고',
        branchName: '',
        collateralType: 'NONE',
      },
      {
        id: `entry_${Date.now()}_3`,
        category: 'SAVINGS_BANK',
        institutionName: 'OK저축은행',
        collateralType: 'NONE',
      }
    ];
  });

  // 검색어 및 필터
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CreditorCategoryType | 'ALL'>('ALL');
  const [customNameInput, setCustomNameInput] = useState('');

  // 현재 편집 중인 항목 ID
  const [activeEntryId, setActiveEntryId] = useState<string>(entries[0]?.id || '');

  // 빠른 추가
  const handleAddPreset = (presetName: string, category: CreditorCategoryType) => {
    const isAlready = entries.some(e => e.institutionName === presetName);
    if (isAlready) {
      toast.info(`'${presetName}'은(는) 이미 목록에 추가되어 있습니다.`);
      return;
    }

    const is4Bank = MAJOR_4_BANKS.some(b => b.bankName === presetName);
    const newEntry: ClientDebtIntakeEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      institutionName: presetName,
      hasSeparateCreditCard: is4Bank,
      nonghyupType: presetName === '농협' ? 'CENTRAL' : undefined,
      collateralType: 'NONE',
    };

    setEntries(prev => [...prev, newEntry]);
    setActiveEntryId(newEntry.id);
    toast.success(`'${presetName}'이(가) 추가되었습니다. 지점명이나 카드 분리 여부를 확인해 주세요.`);
  };

  // 직접 입력 추가
  const handleAddCustom = () => {
    if (!customNameInput.trim()) {
      toast.error('금융기관 또는 대여인 이름을 입력해 주세요.');
      return;
    }
    const name = customNameInput.trim();
    const is4Bank = MAJOR_4_BANKS.some(b => b.bankName === name);

    const newEntry: ClientDebtIntakeEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: 'LOAN_OTHER',
      institutionName: name,
      hasSeparateCreditCard: is4Bank,
      collateralType: 'NONE',
    };

    setEntries(prev => [...prev, newEntry]);
    setActiveEntryId(newEntry.id);
    setCustomNameInput('');
    toast.success(`'${name}'이(가) 추가되었습니다.`);
  };

  // 삭제
  const handleDeleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    if (activeEntryId === id) {
      setActiveEntryId(entries.find(e => e.id !== id)?.id || '');
    }
  };

  // 수정
  const handleUpdateEntry = (id: string, updates: Partial<ClientDebtIntakeEntry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  // 프리셋 필터링
  const filteredPresets = useMemo(() => {
    return POPULAR_CREDITORS_PRESET.filter(p => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchQuery = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  // 최종 저장
  const handleSaveAndSubmit = () => {
    if (entries.length === 0) {
      toast.error('최소 1곳 이상의 금융기관 또는 채권자를 입력해 주세요.');
      return;
    }

    // 유효성 체크: 새마을금고/신협/단위농협 지점명 미입력 알림
    for (const e of entries) {
      const name = e.institutionName;
      const needsBranch = name.includes('새마을금고') || name.includes('신협') || (name.includes('농협') && e.nonghyupType === 'LOCAL');
      if (needsBranch && !e.branchName?.trim()) {
        toast.warning(`'${name}'의 대출 지점명(지역명)을 입력해 주셔야 금융기관에서 부채증명서 발급이 가능합니다.`);
        setActiveEntryId(e.id);
        return;
      }
    }

    const payload: ClientDebtIntakePayload = {
      clientId,
      clientName,
      clientPhone,
      submittedAt: new Date().toISOString(),
      entries,
      confirmedByClient: true,
    };

    DebtIntakeRuleService.saveClientIntake(payload);
    if (onComplete) {
      onComplete(entries);
    }
    toast.success('부채증명서 발급용 세부 정보가 변호사 사무소에 성공적으로 전송되었습니다!');
    onClose();
  };

  // 총 발급 건수 계산 (카드 분리 반영)
  const totalIssueCount = useMemo(() => {
    return DebtIntakeRuleService.convertIntakeToAgencyCreditorRows(entries).length;
  }, [entries]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
          
          {/* 상단 헤더 */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-extrabold text-lg">
                📑
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-white">
                    부채증명서 발급 금융사 세부 확인
                  </h3>
                  <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                    실무 검증 필수
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  신청인: <strong className="text-white">{clientName}</strong>님 · 지점명과 카드 분리 여부를 알려주시면 사무소에서 즉시 발급 대행을 진행합니다.
                </p>
              </div>
            </div>

            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 안내 알림 배너 */}
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200/80 flex items-start gap-2.5 shrink-0 text-xs text-amber-900 leading-relaxed">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>💡 왜 지점명과 카드 분리를 체크해야 하나요?</strong><br />
              금융기관마다 발급 지침이 다릅니다. 국민·우리·신한·하나는 <strong>대출과 카드가 별도 발급</strong>되며, 새마을금고·신협·단위농협은 <strong>지점명을 모르면 발급이 거절</strong>되기 때문에 정확한 확인이 필요합니다.
            </div>
          </div>

          {/* 모달 본문 영역 (2열 레이아웃: 좌측 채권자 목록 및 세부설정, 우측 금융사 검색/추가) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-50/50">
            
            {/* 좌측: 등록된 채권사 및 실무 7대 규칙 설정 카드 (7열) */}
            <div className="lg:col-span-7 space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  <span>내 채권기관 목록</span>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    {entries.length}곳 (발급 {totalIssueCount}건)
                  </span>
                </h4>
                <span className="text-[11px] text-slate-400">카드를 누르면 세부 옵션을 수정합니다</span>
              </div>

              {entries.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-2">
                  <Landmark className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-xs text-slate-600">아직 등록된 금융기관이 없습니다.</p>
                  <p className="text-[11px] text-slate-400">우측의 [자주 찾는 금융사]에서 클릭하여 추가해 주세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry, idx) => {
                    const isMajor4 = MAJOR_4_BANKS.some(b => b.bankName === entry.institutionName);
                    const isNonghyup = entry.institutionName.includes('농협');
                    const isMutual = entry.institutionName.includes('새마을금고') || entry.institutionName.includes('신협') || entry.institutionName.includes('미소금융');
                    const isCreditGuarantee = entry.institutionName.includes('신용보증재단');
                    const isSavingsRisk = entry.institutionName.includes('OK저축') || entry.institutionName.includes('페퍼저축');

                    return (
                      <div 
                        key={entry.id}
                        className={`bg-white rounded-2xl p-4 border transition-all shadow-xs ${
                          activeEntryId === entry.id 
                            ? 'border-blue-500 ring-2 ring-blue-500/10' 
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* 상단: 금융사명 & 삭제 버튼 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-extrabold text-sm text-slate-900">
                              {entry.institutionName}
                            </span>
                            {entry.branchName && (
                              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                {entry.branchName}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-slate-300 hover:text-rose-600 p-1 rounded-lg cursor-pointer transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* ── 규칙별 동적 문답 옵션 ── */}
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                          
                          {/* [Rule 1] 4대 시중은행 카드 분리 체크 */}
                          {isMajor4 && (
                            <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-2.5 flex items-start gap-2">
                              <CreditCard className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              <div className="flex-1 text-xs">
                                <label className="font-bold text-blue-900 flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!entry.hasSeparateCreditCard}
                                    onChange={e => handleUpdateEntry(entry.id, { hasSeparateCreditCard: e.target.checked })}
                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span>신용카드 결제금액(잔여 할부/후불교통 등)도 남아있습니다</span>
                                </label>
                                <p className="text-[11px] text-blue-700 mt-0.5">
                                  체크 시 은행과 카드사 2건으로 분리 발급 신청서가 자동 생성됩니다.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* [Rule 2] 농협 중앙회 vs 지역단위농협/축협 구분 */}
                          {isNonghyup && (
                            <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-2.5 space-y-2 text-xs">
                              <div className="font-bold text-emerald-950 flex items-center gap-1">
                                <span>농협 기관 종류를 선택해 주세요:</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEntry(entry.id, { nonghyupType: 'CENTRAL' })}
                                  className={`py-1.5 px-2 rounded-lg font-bold border text-xs cursor-pointer ${
                                    entry.nonghyupType === 'CENTRAL' 
                                      ? 'bg-emerald-600 text-white border-emerald-600' 
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  NH농협은행 (중앙회)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateEntry(entry.id, { nonghyupType: 'LOCAL' })}
                                  className={`py-1.5 px-2 rounded-lg font-bold border text-xs cursor-pointer ${
                                    entry.nonghyupType === 'LOCAL' 
                                      ? 'bg-emerald-600 text-white border-emerald-600' 
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  지역농협 / 축협 (단위농협)
                                </button>
                              </div>

                              {entry.nonghyupType === 'LOCAL' && (
                                <div className="space-y-1 pt-1">
                                  <label className="font-bold text-rose-700 flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>대출받으신 지점명 (필수):</span>
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="예: 송파농협 가락지점, 안양축협 등"
                                    value={entry.branchName || ''}
                                    onChange={e => handleUpdateEntry(entry.id, { branchName: e.target.value })}
                                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-rose-300 bg-white focus:ring-1 focus:ring-rose-500"
                                  />
                                </div>
                              )}

                              <label className="font-bold text-emerald-900 flex items-center gap-1.5 cursor-pointer pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={!!entry.hasSeparateCreditCard}
                                  onChange={e => handleUpdateEntry(entry.id, { hasSeparateCreditCard: e.target.checked })}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span>농협카드 결제대금도 남아있습니다 (카드 분리 발급)</span>
                              </label>
                            </div>
                          )}

                          {/* [Rule 3] 새마을금고 / 신협 / 미소금융 지점명 필수 */}
                          {isMutual && (
                            <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-2.5 space-y-1.5 text-xs">
                              <label className="font-bold text-amber-950 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-amber-700" />
                                <span>대출받으신 지점명(법인명)을 입력해 주세요 (필수):</span>
                              </label>
                              <input
                                type="text"
                                placeholder="예: 삼성새마을금고, 관악신협, 미소금융 종로지점 등"
                                value={entry.branchName || ''}
                                onChange={e => handleUpdateEntry(entry.id, { branchName: e.target.value })}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white focus:ring-1 focus:ring-amber-500"
                              />
                              <p className="text-[11px] text-amber-700">
                                ※ 각 지점(금고)이 독립된 법인이므로 지점명을 모르면 부채증명서 발급이 불가능합니다.
                              </p>
                            </div>
                          )}

                          {/* [Rule 4] 신용보증재단 지역 선택 */}
                          {isCreditGuarantee && !entry.institutionName.includes('중앙회') && (
                            <div className="bg-indigo-50/70 border border-indigo-200/70 rounded-xl p-2.5 space-y-1.5 text-xs">
                              <label className="font-bold text-indigo-950">
                                관할 지역 재단을 선택해 주세요 (사업장/주소지 기준):
                              </label>
                              <select
                                value={entry.guaranteeRegion || '서울신용보증재단'}
                                onChange={e => handleUpdateEntry(entry.id, { guaranteeRegion: e.target.value })}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white font-bold"
                              >
                                {REGIONAL_CREDIT_GUARANTEE_REGIONS.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* [Rule 6 & 7] 담보 여부 라디오 & 저축은행 리스크 가이드 */}
                          <div className="pt-1">
                            <span className="text-[11px] font-bold text-slate-500 block mb-1">
                              대출 유형 (담보 여부):
                            </span>
                            <div className="grid grid-cols-3 gap-1.5 text-xs">
                              {[
                                { key: 'NONE', label: '신용대출' },
                                { key: 'HOUSING', label: '주택(자가) 담보' },
                                { key: 'VEHICLE', label: '차량 담보' },
                              ].map(col => (
                                <button
                                  key={col.key}
                                  type="button"
                                  onClick={() => handleUpdateEntry(entry.id, { collateralType: col.key as DebtCollateralType })}
                                  className={`py-1 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    entry.collateralType === col.key
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {col.label}
                                </button>
                              ))}
                            </div>

                            {/* 오케이/페퍼저축은행 담보 경매/공매 위험 알림 */}
                            {isSavingsRisk && entry.collateralType !== 'NONE' && (
                              <div className="mt-2 bg-rose-50 border border-rose-200 rounded-xl p-2 text-[11px] text-rose-900 leading-snug flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <strong>⚠️ 법적 주의사항 안내:</strong> 해당 저축은행은 회생 인가 후에도 담보물(주택 경매, 차량 공매)을 임의 처리한 실사례가 발생하고 있습니다. 변호사님이 안전하게 재산을 지킬 수 있도록 부채발급 제외 여부를 정밀 검토합니다.
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 우측: 자주 찾는 금융사 빠른 추가 & 직접 입력 패널 (5열) */}
            <div className="lg:col-span-5 space-y-3.5">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center justify-between">
                  <span>➕ 금융기관 빠른 추가</span>
                </h4>

                {/* 검색 인풋 */}
                <input
                  type="text"
                  placeholder="금융기관 이름 검색 (예: 국민, 신협, 현대...)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />

                {/* 카테고리 필터 버튼 */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'ALL', label: '전체' },
                    { key: 'BANK', label: '시중은행' },
                    { key: 'MUTUAL_FINANCE', label: '새마을/신협' },
                    { key: 'SAVINGS_BANK', label: '저축은행' },
                    { key: 'CARD_CAPITAL', label: '카드/캐피탈' },
                    { key: 'PUBLIC_POLICY', label: '공공/보증' },
                    { key: 'LOAN_OTHER', label: '대부업체/사채' }
                  ].map(c => (
                    <button
                      key={c.key}
                      onClick={() => setSelectedCategory(c.key as any)}
                      className={`text-[11px] px-2 py-0.8 rounded-lg border transition-all cursor-pointer ${
                        selectedCategory === c.key
                          ? 'bg-blue-600 text-white font-bold border-blue-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* 프리셋 버튼 리스트 (스크롤) */}
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {filteredPresets.map(preset => {
                    const isAdded = entries.some(e => e.institutionName === preset.name);
                    return (
                      <button
                        key={preset.name}
                        onClick={() => handleAddPreset(preset.name, preset.category)}
                        disabled={isAdded}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                          isAdded 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-slate-50/70 hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-800'
                        }`}
                      >
                        <span className="font-bold">{preset.name}</span>
                        {isAdded ? (
                          <span className="text-[10px] text-slate-400">추가됨</span>
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 직접 입력 영역 */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    목록에 없는 개인 채권자 / 영세 대부업체 직접 입력:
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="채권자명 (예: 산와머니, 개인 홍길동, OO대부)"
                      value={customNameInput}
                      onChange={e => setCustomNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                    <button
                      onClick={handleAddCustom}
                      className="px-3 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer press-scale shrink-0"
                    >
                      추가
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 bg-slate-100/80 p-2 rounded-lg leading-relaxed">
                    💡 <strong>대부업체 팁:</strong> 상호가 바뀌었거나 기억이 잘 안 나시는 경우, <strong>이자 보내시는 계좌주명</strong>이나 <strong>대출 당시 상호</strong>를 적어주셔도 대행업체에서 원장 조회를 통해 현재 채권사를 추적하여 발급받을 수 있습니다.
                  </p>
                </div>

              </div>

              {/* 하단 요약 정보 카드 */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>등록 채권기관:</span>
                  <strong className="text-white">{entries.length}곳</strong>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>분리 발급 예정 부채증명서:</span>
                  <strong className="text-emerald-400 font-extrabold">{totalIssueCount}건</strong>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  ※ 작성 완료 시 변호사 어드민의 부채증명서 대행 신청서에 100% 자동 채워집니다.
                </div>
              </div>
            </div>

          </div>

          {/* 모달 하단 액션 버튼 */}
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
            >
              닫기 (임시보관)
            </button>
            <button
              onClick={handleSaveAndSubmit}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 press-scale cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>부채 세부정보 입력 완료 및 사무소 전송</span>
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
}
