import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings } from '../services/settingsService';
import { 
  AppSettings, LeibnizTable, CourtRegionMapItem, RegionKey, 
  CourtConfig, YearlyPolicy, HousingCostRule 
} from '../types';
import { 
  Save, ShieldAlert, Calculator, MapPin, DollarSign, 
  Home, Gavel, Trash2, CheckCircle2, AlertTriangle, Info, Plus
} from 'lucide-react';
import { toast } from 'sonner';

// ─── 아이콘 래퍼 (lucide에 Table 아이콘이 없을 경우 대비) ───
const TableIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>
  </svg>
);

import { DEFAULT_SETTINGS } from '../constants';

type SettingsTab = 'policy' | 'income' | 'coeffs' | 'region' | 'housing' | 'deductions' | 'court_char';

interface RehabSettingsPanelProps {
  mode?: 'admin' | 'lawyer';  // 'admin' = full edit (default), 'lawyer' = read-only except court_char
}

const formatNumberWithComma = (value: number | undefined): string => {
  if (value === undefined || value === null) return '0';
  return value.toLocaleString('ko-KR');
};

const parseCommaToNumber = (str: string): number => {
  return Number(str.replace(/,/g, '')) || 0;
};

const RehabSettingsPanel: React.FC<RehabSettingsPanelProps> = ({ mode = 'admin' }) => {
  const isReadOnly = mode === 'lawyer';
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('policy');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [courtSearch, setCourtSearch] = useState<string>('');
  const availableYears = [2025, 2026, 2027, 2028, 2029, 2030];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      
      let changed = false;
      const updatedConfigs = { ...data.courtConfigs };
      for (const [court, defaultConfig] of Object.entries(DEFAULT_SETTINGS.courtConfigs)) {
        if (!updatedConfigs[court]) {
          updatedConfigs[court] = { ...defaultConfig };
          changed = true;
        } else if (!updatedConfigs[court].description && defaultConfig.description) {
          updatedConfigs[court].description = defaultConfig.description;
          changed = true;
        }
      }

      // 2025년/2026년 최신 공식 데이터 자동 동기화 마이그레이션
      const needs2026Sync = !data.yearlyPolicies[2026] 
        || data.yearlyPolicies[2026].medianIncome.values[1] !== 2564238 
        || data.yearlyPolicies[2026].housingCostLimits?.Seoul?.[1]?.additionalLimit !== 589208
        || data.yearlyPolicies[2026].medicalCostIncludedInMedian?.[1] !== 64619
        || data.yearlyPolicies[2026].educationCost?.includedInMedian !== 89627;
      const needs2025Sync = !data.yearlyPolicies[2025] || data.yearlyPolicies[2025].medianIncome.values[5] !== 7108192;
      if (needs2026Sync || needs2025Sync) {
        data.yearlyPolicies[2025] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.yearlyPolicies[2025]));
        data.yearlyPolicies[2026] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.yearlyPolicies[2026]));
        for (const yearStr of Object.keys(data.yearlyPolicies)) {
          const yr = Number(yearStr);
          if (yr > 2026 && DEFAULT_SETTINGS.yearlyPolicies[yr]) {
            data.yearlyPolicies[yr].housingCostLimits = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.yearlyPolicies[yr].housingCostLimits));
            data.yearlyPolicies[yr].medicalCostIncludedInMedian = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.yearlyPolicies[yr].medicalCostIncludedInMedian));
            data.yearlyPolicies[yr].educationCost = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.yearlyPolicies[yr].educationCost));
            data.yearlyPolicies[yr].specialEducationCost = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.yearlyPolicies[yr].specialEducationCost));
          }
        }
        changed = true;
      }
      
      const migratedData = changed ? { ...data, courtConfigs: updatedConfigs } : data;
      if (changed) {
        await updateSettings(migratedData);
      }
      
      setSettings(migratedData);
      if (!availableYears.includes(selectedYear)) {
        setSelectedYear(availableYears[0]);
      }
    } catch (e) {
      console.error(e);
      toast.error('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      toast.success('회생/파산 계산 정책이 성공적으로 저장되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const addMapItem = () => {
    if (!settings) return;
    const newItem: CourtRegionMapItem = {
      keyword: '',
      court: '서울회생법원',
      region: 'Seoul'
    };
    setSettings({
      ...settings,
      courtRegionMap: [...settings.courtRegionMap, newItem]
    });
  };

  const removeMapItem = (index: number) => {
    if (!settings) return;
    const newMap = settings.courtRegionMap.filter((_, idx) => idx !== index);
    setSettings({ ...settings, courtRegionMap: newMap });
  };

  const handleAddCourt = () => {
    const courtName = prompt('추가할 법원명을 입력하세요 (예: 춘천지방법원 강릉지원):');
    if (!courtName || !courtName.trim() || !settings) return;
    
    const trimmed = courtName.trim();
    if (settings.courtConfigs[trimmed]) {
      toast.error('이미 존재하는 법원입니다.');
      return;
    }
    
    setSettings({
      ...settings,
      courtConfigs: {
        ...settings.courtConfigs,
        [trimmed]: {
          description: '',
          includeSpouseProperty: true,
          includeCryptoStock: true,
          allow24Month: false,
          allowAdditionalLivingCost: true,
          allowOtherLivingCost: false
        }
      }
    });
    toast.success(`${trimmed}이(가) 추가되었습니다.`);
  };

  const updateCourtConfig = (courtName: string, field: keyof CourtConfig, value: any) => {
    if (!settings) return;
    const newCourtConfigs = { ...settings.courtConfigs };
    if (!newCourtConfigs[courtName]) {
      newCourtConfigs[courtName] = {
        description: '',
        includeSpouseProperty: true,
        includeCryptoStock: true,
        allow24Month: false,
        allowAdditionalLivingCost: true,
        allowOtherLivingCost: false
      };
    }
    newCourtConfigs[courtName] = {
      ...newCourtConfigs[courtName],
      [field]: value
    };
    setSettings({ ...settings, courtConfigs: newCourtConfigs });
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-500">회생/파산 정책 기준을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const currentYearPolicy = settings.yearlyPolicies[selectedYear];
  const inputClass = `w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:ring-2 focus:ring-brand/20 focus:border-brand focus:bg-white outline-none transition-all disabled:bg-slate-100/80 disabled:text-slate-600 disabled:cursor-not-allowed`;
  const labelClass = "block text-xs font-bold text-slate-700 mb-1.5";
  const cardClass = "bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5";

  // ═══════════════════════════════════════════════════
  // TAB 1: 기본 정책 (Pmin)
  // ═══════════════════════════════════════════════════
  const renderPolicyTab = () => (
    <div className="space-y-6">
      {/* Pmin Rules */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <ShieldAlert className="text-brand w-5 h-5" />
              법정 최저 변제액 (Pmin) 규칙
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              채무 총액 구간에 따라 법정에서 요구하는 최소 변제 기준액을 계산하는 공식입니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-1.5">
            <label className={labelClass}>기준 채무액 (Threshold)</label>
            <div className="relative">
              <input 
                type="text" 
                className={inputClass} 
                disabled={isReadOnly} 
                value={formatNumberWithComma(settings.policy.pminThreshold)} 
                onChange={e => setSettings({...settings, policy: {...settings.policy, pminThreshold: parseCommaToNumber(e.target.value)}})} 
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">기준액 기준 분기점</span>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-1.5">
            <label className={labelClass}>기준 미만 적용 비율</label>
            <div className="relative">
              <input 
                type="number" 
                step="0.01" 
                className={inputClass} 
                disabled={isReadOnly} 
                value={settings.policy.pminRateBelow} 
                onChange={e => setSettings({...settings, policy: {...settings.policy, pminRateBelow: Number(e.target.value)}})} 
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">배 (5%)</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">예: 0.05 = 총채무의 5%</span>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-1.5">
            <label className={labelClass}>기준 이상 적용 비율</label>
            <div className="relative">
              <input 
                type="number" 
                step="0.01" 
                className={inputClass} 
                disabled={isReadOnly} 
                value={settings.policy.pminRateAbove} 
                onChange={e => setSettings({...settings, policy: {...settings.policy, pminRateAbove: Number(e.target.value)}})} 
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">배 (3%)</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">예: 0.03 = 초과액의 3%</span>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-1.5">
            <label className={labelClass}>기준 이상 고정 가산금</label>
            <div className="relative">
              <input 
                type="text" 
                className={inputClass} 
                disabled={isReadOnly} 
                value={formatNumberWithComma(settings.policy.pminFixedAbove)} 
                onChange={e => setSettings({...settings, policy: {...settings.policy, pminFixedAbove: parseCommaToNumber(e.target.value)}})} 
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">기준액 초과 시 기본 가산</span>
          </div>
        </div>
      </div>

      {/* Spouse Income Based Child Dependent Criteria */}
      <div className={cardClass}>
        <div>
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <DollarSign className="text-brand w-5 h-5" />
            미성년 자녀 부양가족 인정 기준
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            배우자 소득 수준에 따라 미성년 자녀를 본인의 부양가족으로 인정하는 비율을 설정합니다. (본인 소득 대비 배우자 소득 비율 기준)
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h4 className="text-xs font-extrabold text-brand uppercase">구간 1: 배우자 소득 낮음</h4>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">전액 인정</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>배우자 소득 비율 미만 기준 (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={Math.round((settings.policy.spouseIncomeRatioUnder ?? 0.7) * 100)} 
                    onChange={e => setSettings({...settings, policy: {...settings.policy, spouseIncomeRatioUnder: Number(e.target.value) / 100}})} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>자녀 부양가족 인정 비율 (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={Math.round((settings.policy.spouseIncomeRatioUnderRate ?? 1.0) * 100)} 
                    onChange={e => setSettings({...settings, policy: {...settings.policy, spouseIncomeRatioUnderRate: Number(e.target.value) / 100}})} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h4 className="text-xs font-extrabold text-brand uppercase">구간 2: 배우자 소득 비슷</h4>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">50% 공동 분담</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>배우자 소득 비율 이하 기준 (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={Math.round((settings.policy.spouseIncomeRatioBetween ?? 1.3) * 100)} 
                    onChange={e => setSettings({...settings, policy: {...settings.policy, spouseIncomeRatioBetween: Number(e.target.value) / 100}})} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>자녀 부양가족 인정 비율 (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={Math.round((settings.policy.spouseIncomeRatioBetweenRate ?? 0.5) * 100)} 
                    onChange={e => setSettings({...settings, policy: {...settings.policy, spouseIncomeRatioBetweenRate: Number(e.target.value) / 100}})} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/70 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h4 className="text-xs font-extrabold text-brand uppercase">구간 3: 배우자 소득 높음</h4>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">미인정 (0%)</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>배우자 소득 초과 시 인정 비율 (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={Math.round((settings.policy.spouseIncomeRatioOverRate ?? 0.0) * 100)} 
                    onChange={e => setSettings({...settings, policy: {...settings.policy, spouseIncomeRatioOverRate: Number(e.target.value) / 100}})} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                배우자의 소득이 구간 2를 초과하여 충분히 높을 경우, 자녀 부양가족을 배우자가 담당하는 것으로 산정합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // TAB 2: 기준 중위소득
  // ═══════════════════════════════════════════════════
  const renderIncomeTab = () => (
    <div className={cardClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <TableIcon className="text-brand w-5 h-5" />
            {selectedYear}년 가구원 수별 기준 중위소득 및 최저 생계비
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            개인회생 변제금 산정의 기준이 되는 법정 중위소득(100%)과 인정 생계비(60%) 기준표입니다.
          </p>
        </div>
        <span className="bg-brand/10 text-brand text-xs font-black px-3 py-1.5 rounded-full whitespace-nowrap">
          {selectedYear}년 고시 기준
        </span>
      </div>
      
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-xs">
              <th className="py-3.5 px-4">가구원 수</th>
              <th className="py-3.5 px-4">기준 중위소득 (100%)</th>
              <th className="py-3.5 px-4 bg-brand/5 text-brand">개인회생 인정 생계비 (60%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5, 6].map(size => {
              const val = currentYearPolicy.medianIncome.values[size] || 0;
              const livingCost = Math.round(val * 0.6);
              return (
                <tr key={size} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-black text-slate-900">{size}인 가구</td>
                  <td className="py-3.5 px-4">
                    <div className="relative max-w-xs">
                      <input 
                        type="text" 
                        disabled={isReadOnly}
                        className={inputClass}
                        value={formatNumberWithComma(val)} 
                        onChange={e => {
                          const newPolicies = {...settings.yearlyPolicies};
                          newPolicies[selectedYear].medianIncome.values[size] = parseCommaToNumber(e.target.value);
                          setSettings({...settings, yearlyPolicies: newPolicies});
                        }} 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 bg-brand/5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-brand">{formatNumberWithComma(livingCost)}</span>
                      <span className="text-xs font-bold text-slate-500">원</span>
                      <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-extrabold ml-1">자동 계산</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // TAB 3: 계수 및 한도 (라이프니츠)
  // ═══════════════════════════════════════════════════
  const renderCoeffsTab = () => (
    <div className={cardClass}>
      <div>
        <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
          <Calculator className="text-brand w-5 h-5" />
          라이프니츠 계수 (현재가치 할인 계수)
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          변제 기간별 총 변제금의 현재가치를 산출하기 위해 적용하는 복리 할인 계수입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {[24, 36, 48, 60].map(m => (
          <div key={m} className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900">{m}개월 변제</span>
              <span className="text-[10px] font-extrabold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">{m / 12}년</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                step="0.0001" 
                className={inputClass} 
                disabled={isReadOnly}
                value={settings.leibniz[`m${m}` as keyof LeibnizTable] || 0} 
                onChange={e => setSettings({ ...settings, leibniz: {...settings.leibniz, [`m${m}`]: Number(e.target.value)} })} 
              />
            </div>
            <p className="text-[11px] text-slate-400">m{m} 현재가치 계수</p>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // TAB 4: 지역/법원/보증금
  // ═══════════════════════════════════════════════════
  const renderRegionTab = () => {
    const filteredMap = settings.courtRegionMap.filter(item => {
      const matchRegion = regionFilter === 'all' || item.region === regionFilter;
      const matchSearch = !courtSearch || item.keyword.includes(courtSearch) || item.court.includes(courtSearch);
      return matchRegion && matchSearch;
    });

    return (
      <div className="space-y-6">
        {/* Deposit Rules */}
        <div className={cardClass}>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <DollarSign className="text-brand w-5 h-5" />
              {selectedYear}년 지역별 소액보증금 및 최우선 변제금 공제 기준
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              주택임대차보호법에 따른 소액임차보증금 범위와 청산가치에서 면제되는 최우선 변제금액입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['Seoul', 'Overcrowded', 'Metro', 'Others'] as RegionKey[]).map(r => (
              <div key={r} className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <h4 className="font-black text-slate-900 text-sm">
                    {r === 'Seoul' ? '서울특별시' : r === 'Overcrowded' ? '과밀억제권역' : r === 'Metro' ? '광역시' : '기타 지역'}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">{r}</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>소액보증금 적용 한도</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        disabled={isReadOnly}
                        className={inputClass} 
                        value={formatNumberWithComma(currentYearPolicy.depositRules[r]?.limit || 0)}
                        onChange={e => {
                          const newPolicies = {...settings.yearlyPolicies};
                          if(!newPolicies[selectedYear].depositRules[r]) newPolicies[selectedYear].depositRules[r] = {limit:0, deduct:0};
                          newPolicies[selectedYear].depositRules[r].limit = parseCommaToNumber(e.target.value);
                          setSettings({...settings, yearlyPolicies: newPolicies});
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>최우선 변제 공제금액</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        disabled={isReadOnly}
                        className={inputClass} 
                        value={formatNumberWithComma(currentYearPolicy.depositRules[r]?.deduct || 0)}
                        onChange={e => {
                          const newPolicies = {...settings.yearlyPolicies};
                          if(!newPolicies[selectedYear].depositRules[r]) newPolicies[selectedYear].depositRules[r] = {limit:0, deduct:0};
                          newPolicies[selectedYear].depositRules[r].deduct = parseCommaToNumber(e.target.value);
                          setSettings({...settings, yearlyPolicies: newPolicies});
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map Table */}
        <div className={cardClass}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="text-brand w-5 h-5" />
                행정구역 — 관할 법원 및 권역 매핑 ({settings.courtRegionMap.length}개)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                주소 키워드에 따라 관할 법원과 주택임대차 권역(서울/과밀/광역시/기타)을 자동 매핑합니다.
              </p>
            </div>
            {(!isReadOnly) && (
              <button 
                onClick={addMapItem} 
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                매핑 규칙 추가
              </button>
            )}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input 
              type="text"
              placeholder="행정구역 또는 법원명 검색..."
              value={courtSearch}
              onChange={e => setCourtSearch(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            />
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="all">전체 권역</option>
              <option value="Seoul">서울</option>
              <option value="Overcrowded">과밀억제권역</option>
              <option value="Metro">광역시</option>
              <option value="Others">기타</option>
            </select>
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 text-slate-700 text-xs font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">행정구역 (주소 키워드)</th>
                  <th className="py-3 px-4">관할 법원</th>
                  <th className="py-3 px-4">지역 권역 구분</th>
                  {(!isReadOnly) && <th className="py-3 px-4 text-center">삭제</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMap.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4">
                      <input 
                        type="text" 
                        disabled={isReadOnly}
                        className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand outline-none text-slate-900 font-bold text-xs py-1 ${isReadOnly ? 'cursor-not-allowed' : ''}`} 
                        value={item.keyword}
                        onChange={e => {
                          const newMap = [...settings.courtRegionMap];
                          newMap[idx].keyword = e.target.value;
                          setSettings({...settings, courtRegionMap: newMap});
                        }}
                        placeholder="예: 수원시, 강남구"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <input 
                        type="text" 
                        disabled={isReadOnly}
                        className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand outline-none text-slate-800 text-xs font-medium py-1 ${isReadOnly ? 'cursor-not-allowed' : ''}`} 
                        value={item.court}
                        onChange={e => {
                          const newMap = [...settings.courtRegionMap];
                          newMap[idx].court = e.target.value;
                          setSettings({...settings, courtRegionMap: newMap});
                        }}
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <select 
                        disabled={isReadOnly}
                        className={`bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 p-1.5 ${isReadOnly ? 'cursor-not-allowed' : ''}`}
                        value={item.region}
                        onChange={e => {
                          const newMap = [...settings.courtRegionMap];
                          newMap[idx].region = e.target.value as RegionKey;
                          setSettings({...settings, courtRegionMap: newMap});
                        }}
                      >
                        <option value="Seoul">서울</option>
                        <option value="Overcrowded">과밀억제권역</option>
                        <option value="Metro">광역시</option>
                        <option value="Others">기타</option>
                      </select>
                    </td>
                    {(!isReadOnly) && (
                      <td className="py-2.5 px-4 text-center">
                        <button onClick={() => removeMapItem(idx)} className="text-red-500 hover:text-red-700 text-xs font-bold p-1">
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  // TAB 5: 주거비 한도
  // ═══════════════════════════════════════════════════
  const renderHousingTab = () => {
    const handleHousingChange = (region: RegionKey, size: number, field: keyof HousingCostRule, value: number) => {
      if (!settings) return;
      const newPolicies = {...settings.yearlyPolicies};
      const policy = newPolicies[selectedYear];
      if(!policy.housingCostLimits[region]) policy.housingCostLimits[region] = {};
      if(!policy.housingCostLimits[region][size]) policy.housingCostLimits[region][size] = { additionalLimit: 0, includedInMedian: 0, totalLimit: 0 };
      
      const rule = policy.housingCostLimits[region][size];
      (rule as any)[field] = value;
      rule.totalLimit = (rule.additionalLimit || 0) + (rule.includedInMedian || 0);

      setSettings({...settings, yearlyPolicies: newPolicies});
    };

    const isUnconfirmedYear = selectedYear > 2026;
    
    return (
      <div className="space-y-6">
        {isUnconfirmedYear ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4.5 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-amber-900 text-sm">{selectedYear}년 주거비 한도 — 정부 미발표</h4>
              <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                주거비 인정 한도는 매년 정부가 고시하여 발표합니다. {selectedYear}년 기준은 아직 발표되지 않았으므로 
                발표 전까지 임시 기준값이 적용됩니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4.5 flex items-start gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-emerald-900 text-sm">{selectedYear}년 주거비 한도 — 정부 발표 확정 데이터</h4>
              <p className="text-emerald-700 text-xs mt-1 leading-relaxed">
                아래 금액은 {selectedYear}년 정부 고시 기준 공식 확정 데이터입니다.
              </p>
            </div>
          </div>
        )}

        {(['Seoul', 'Overcrowded', 'Metro', 'Others'] as RegionKey[]).map(r => (
          <div key={r} className={cardClass}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Home className="text-brand w-5 h-5" />
                {r === 'Seoul' ? '서울특별시' : r === 'Overcrowded' ? '과밀억제권역' : r === 'Metro' ? '광역시' : '기타 지역'}
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {selectedYear}년 주거비 기준
              </span>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-xs">
                    <th className="py-3.5 px-4">가구원 수</th>
                    <th className="py-3.5 px-4">추가 주거비 인정 한도</th>
                    <th className="py-3.5 px-4">중위소득 60% 포함분</th>
                    <th className="py-3.5 px-4 bg-brand/5 text-brand">주거비 총 인정 한도 (합계)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[1, 2, 3, 4].map(size => {
                    const rule = currentYearPolicy.housingCostLimits[r]?.[size] || { additionalLimit: 0, includedInMedian: 0, totalLimit: 0 };
                    return (
                      <tr key={size} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-900">{size}인 가구</td>
                        <td className="py-3.5 px-4">
                          <div className="relative max-w-xs">
                            <input 
                              type="text" 
                              disabled={isReadOnly}
                              className={inputClass} 
                              value={formatNumberWithComma(rule.additionalLimit)} 
                              onChange={e => handleHousingChange(r, size, 'additionalLimit', parseCommaToNumber(e.target.value))} 
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="relative max-w-xs">
                            <input 
                              type="text" 
                              disabled={isReadOnly}
                              className={inputClass} 
                              value={formatNumberWithComma(rule.includedInMedian)} 
                              onChange={e => handleHousingChange(r, size, 'includedInMedian', parseCommaToNumber(e.target.value))} 
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 bg-brand/5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-brand">{formatNumberWithComma(rule.totalLimit)}</span>
                            <span className="text-xs font-bold text-slate-500">원</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  // TAB 6: 공제 기준
  // ═══════════════════════════════════════════════════
  const renderDeductionsTab = () => {
    if (!currentYearPolicy?.assetExemptions) {
      return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
          <p className="text-sm font-bold text-slate-500">선택된 연도의 공제 기준 데이터가 없습니다.</p>
        </div>
      );
    }

    const handleNestedChange = (category: keyof YearlyPolicy, field: string, value: number) => {
      if (!settings) return;
      const newPolicies = { ...settings.yearlyPolicies };
      const policy = newPolicies[selectedYear];

      if (category === 'medicalCostIncludedInMedian') {
        (policy[category] as any)[field] = value;
      } else {
        (policy[category as 'assetExemptions' | 'educationCost' | 'specialEducationCost'] as any)[field] = value;
        if (category === 'educationCost' || category === 'specialEducationCost') {
          const cat = policy[category as 'educationCost' | 'specialEducationCost'];
          cat.totalLimit = (cat.additionalLimit || 0) + (cat.includedInMedian || 0);
        }
      }
      setSettings({ ...settings, yearlyPolicies: newPolicies });
    };

    return (
      <div className="space-y-6">
        {/* 1. 재산 공제액 기준 */}
        <div className={cardClass}>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <ShieldAlert className="text-brand w-5 h-5" />
              {selectedYear}년 재산 공제액 기준 (압류금지 재산 등)
            </h3>
            <p className="text-xs text-slate-500 mt-1">청산가치 산정 시 차감되는 법정 면제재산 및 기본 생계용 재산 공제액입니다.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-1.5">
              <label className={labelClass}>소액 임차보증금 공제 한도</label>
              <div className="relative">
                <input 
                  type="text" 
                  className={inputClass} 
                  disabled={isReadOnly} 
                  value={formatNumberWithComma(currentYearPolicy.assetExemptions.smallDeposit)} 
                  onChange={e => handleNestedChange('assetExemptions', 'smallDeposit', parseCommaToNumber(e.target.value))} 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
              </div>
            </div>

            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-1.5">
              <label className={labelClass}>기본 생계비 재산 공제액 (압류금지 채권 등)</label>
              <div className="relative">
                <input 
                  type="text" 
                  className={inputClass} 
                  disabled={isReadOnly} 
                  value={formatNumberWithComma(currentYearPolicy.assetExemptions.basicLivingCost)} 
                  onChange={e => handleNestedChange('assetExemptions', 'basicLivingCost', parseCommaToNumber(e.target.value))} 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 추가 의료비 중위소득 포함분 */}
        <div className={cardClass}>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <DollarSign className="text-brand w-5 h-5" />
              {selectedYear}년 가구원 수별 의료비 중위소득 60% 포함분
            </h3>
            <p className="text-xs text-slate-500 mt-1">월 실지출 의료비 중 법정 생계비에 이미 포함되어 있는 기준 금액입니다.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map(size => (
              <div key={size} className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 space-y-1">
                <label className="text-[11px] font-black text-slate-700 block">{size}인 가구</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={formatNumberWithComma(currentYearPolicy.medicalCostIncludedInMedian[size] || 0)} 
                    onChange={e => handleNestedChange('medicalCostIncludedInMedian', String(size), parseCommaToNumber(e.target.value))} 
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">원</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. 고소득자 및 성년자녀 기준 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={cardClass}>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Calculator className="text-brand w-5 h-5" />
              고소득자 기타 생계비 한도 기준
            </h3>
            <p className="text-xs text-slate-500">소득이 높고 변제율이 우수한 채무자의 추가 생계비 인정 조건입니다.</p>
            <div className="space-y-3 pt-1">
              <div>
                <label className={labelClass}>소득 기준 배율 (예: 1.5 = 중위소득의 150%)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  className={inputClass} 
                  disabled={isReadOnly} 
                  value={currentYearPolicy.highIncomeEarnerMultiplier}
                  onChange={e => { 
                    const newPolicies = { ...settings.yearlyPolicies }; 
                    newPolicies[selectedYear].highIncomeEarnerMultiplier = Number(e.target.value); 
                    setSettings({ ...settings, yearlyPolicies: newPolicies }); 
                  }} 
                />
              </div>
              <div>
                <label className={labelClass}>최소 변제율 기준 (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="1" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={(currentYearPolicy.highIncomeRepaymentRateThreshold || 0) * 100}
                    onChange={e => { 
                      const newPolicies = { ...settings.yearlyPolicies }; 
                      newPolicies[selectedYear].highIncomeRepaymentRateThreshold = Number(e.target.value) / 100; 
                      setSettings({ ...settings, yearlyPolicies: newPolicies }); 
                    }} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Info className="text-brand w-5 h-5" />
              성년 자녀 부양가족 인정 기준
            </h3>
            <p className="text-xs text-slate-500">
              만 {currentYearPolicy.adultChildDependentCriteria.minAge}세 ~ {currentYearPolicy.adultChildDependentCriteria.maxAge}세 미만 성년자녀의 연간 소득 기준입니다.
            </p>
            <div className="space-y-3 pt-1">
              <div>
                <label className={labelClass}>연간 종합 소득금액 합계 한도</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={formatNumberWithComma(currentYearPolicy.adultChildDependentCriteria.incomeLimit)}
                    onChange={e => { 
                      const newPolicies = { ...settings.yearlyPolicies }; 
                      newPolicies[selectedYear].adultChildDependentCriteria.incomeLimit = parseCommaToNumber(e.target.value); 
                      setSettings({ ...settings, yearlyPolicies: newPolicies }); 
                    }} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>근로소득만 있는 경우 총급여액 한도</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className={inputClass} 
                    disabled={isReadOnly} 
                    value={formatNumberWithComma(currentYearPolicy.adultChildDependentCriteria.grossIncomeLimit)}
                    onChange={e => { 
                      const newPolicies = { ...settings.yearlyPolicies }; 
                      newPolicies[selectedYear].adultChildDependentCriteria.grossIncomeLimit = parseCommaToNumber(e.target.value); 
                      setSettings({ ...settings, yearlyPolicies: newPolicies }); 
                    }} 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">원</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  // TAB 7: 법원 성격
  // ═══════════════════════════════════════════════════
  const renderCourtCharTab = () => {
    const courtsFromMap = settings.courtRegionMap.map(item => item.court);
    const courtsFromConfig = Object.keys(settings.courtConfigs);
    const allCourts = Array.from(new Set([...courtsFromMap, ...courtsFromConfig])).sort();
    
    return (
      <div className={cardClass}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <Gavel className="text-brand w-5 h-5" />
              법원별 실무 성향 및 심사 기준 관리
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full ml-1">사무소 설정 가능</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              각 법원별 배우자 재산 반영률, 주식/코인 청산가치 반영 여부, 24개월 단축 적용 여부를 관리합니다.
            </p>
          </div>
          <button 
            onClick={handleAddCourt} 
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.98] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            새 법원 추가
          </button>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block max-h-[600px] overflow-y-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 text-slate-700 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-44">법원명</th>
                <th className="py-3.5 px-4">특징 및 실무 메모</th>
                <th className="py-3.5 px-2 text-center text-xs w-24">배우자 재산<br/>50% 반영</th>
                <th className="py-3.5 px-2 text-center text-xs w-24">코인/주식<br/>청산가치</th>
                <th className="py-3.5 px-2 text-center text-xs w-24">24개월<br/>단축 가능</th>
                <th className="py-3.5 px-2 text-center text-xs w-24">추가 생계비<br/>인정</th>
                <th className="py-3.5 px-2 text-center text-xs w-24">기타 생계비<br/>인정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allCourts.map((court: string) => {
                const config = settings.courtConfigs[court] || {
                  description: '',
                  includeSpouseProperty: true,
                  includeCryptoStock: true,
                  allow24Month: false,
                  allowAdditionalLivingCost: true,
                  allowOtherLivingCost: false
                };
                
                return (
                  <tr key={court} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-black text-slate-900 text-xs">{court}</td>
                    <td className="py-3 px-4">
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" 
                        placeholder="법원 특징 및 보정 경향 입력..."
                        value={config.description}
                        onChange={e => updateCourtConfig(court, 'description', e.target.value)}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-brand focus:ring-brand/20 border-slate-300 cursor-pointer" 
                        checked={config.includeSpouseProperty} 
                        onChange={e => updateCourtConfig(court, 'includeSpouseProperty', e.target.checked)}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-brand focus:ring-brand/20 border-slate-300 cursor-pointer" 
                        checked={config.includeCryptoStock} 
                        onChange={e => updateCourtConfig(court, 'includeCryptoStock', e.target.checked)}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-brand focus:ring-brand/20 border-slate-300 cursor-pointer" 
                        checked={config.allow24Month} 
                        onChange={e => updateCourtConfig(court, 'allow24Month', e.target.checked)}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-brand focus:ring-brand/20 border-slate-300 cursor-pointer" 
                        checked={config.allowAdditionalLivingCost} 
                        onChange={e => updateCourtConfig(court, 'allowAdditionalLivingCost', e.target.checked)}
                      />
                    </td>
                    <td className="py-3 px-2 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-brand focus:ring-brand/20 border-slate-300 cursor-pointer" 
                        checked={config.allowOtherLivingCost} 
                        onChange={e => updateCourtConfig(court, 'allowOtherLivingCost', e.target.checked)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {allCourts.map((court: string) => {
            const config = settings.courtConfigs[court] || {
              description: '',
              includeSpouseProperty: true,
              includeCryptoStock: true,
              allow24Month: false,
              allowAdditionalLivingCost: true,
              allowOtherLivingCost: false
            };
            
            return (
              <div key={court} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <Gavel size={15} className="text-brand"/> {court}
                  </h4>
                </div>
                
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">특징 및 메모</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:ring-2 focus:ring-brand/20 outline-none" 
                    placeholder="법원 특징 입력..."
                    value={config.description}
                    onChange={e => updateCourtConfig(court, 'description', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded text-brand border-slate-300" 
                      checked={config.includeSpouseProperty} 
                      onChange={e => updateCourtConfig(court, 'includeSpouseProperty', e.target.checked)}
                    />
                    <span className="text-[11px] font-bold text-slate-700">배우자 재산 50%</span>
                  </label>
                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded text-brand border-slate-300" 
                      checked={config.includeCryptoStock} 
                      onChange={e => updateCourtConfig(court, 'includeCryptoStock', e.target.checked)}
                    />
                    <span className="text-[11px] font-bold text-slate-700">코인/주식 청산</span>
                  </label>
                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded text-brand border-slate-300" 
                      checked={config.allow24Month} 
                      onChange={e => updateCourtConfig(court, 'allow24Month', e.target.checked)}
                    />
                    <span className="text-[11px] font-bold text-slate-700">24개월 단축</span>
                  </label>
                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded text-brand border-slate-300" 
                      checked={config.allowAdditionalLivingCost} 
                      onChange={e => updateCourtConfig(court, 'allowAdditionalLivingCost', e.target.checked)}
                    />
                    <span className="text-[11px] font-bold text-slate-700">추가 생계비</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  // 탭 정의 & 메인 렌더
  // ═══════════════════════════════════════════════════
  const tabs: { id: SettingsTab; label: string; icon: React.FC<any> }[] = [
    { id: 'policy', label: '기본 정책 (Pmin)', icon: ShieldAlert },
    { id: 'income', label: '기준 중위소득', icon: TableIcon },
    { id: 'coeffs', label: '계수 및 한도', icon: Calculator },
    { id: 'region', label: '지역/법원/보증금', icon: MapPin },
    { id: 'housing', label: '주거비 한도', icon: Home },
    { id: 'deductions', label: '공제 기준', icon: DollarSign },
    { id: 'court_char', label: '법원 성격', icon: Gavel },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-brand" />
            <span>{isReadOnly ? '회생/파산 계산 기준 확인' : '회생/파산 정책 및 계산 기준 설정'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isReadOnly 
              ? '개인회생 변제금 산출 및 AI 분석에 적용되는 플랫폼 기본 정책값입니다. 법원 성격 탭에서 개별 사무실 실무 기준을 설정할 수 있습니다.' 
              : '챗봇 상담 및 보고서 산출에 사용되는 핵심 정책 기준값을 관리합니다.'}
          </p>
        </div>
        {(!isReadOnly || activeTab === 'court_char') && (
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl hover:bg-brand-hover font-bold shadow-sm transition-all text-xs sm:text-sm disabled:opacity-50 active:scale-[0.98] whitespace-nowrap cursor-pointer"
          >
            <Save size={15} /> 
            <span>{saving ? '저장 중...' : '설정 저장'}</span>
          </button>
        )}
      </div>

      {/* Lawyer Mode Banner */}
      {isReadOnly && activeTab !== 'court_char' && (
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
          <Info className="w-5 h-5 text-brand shrink-0" />
          <p className="text-xs font-bold text-blue-950 leading-relaxed">
            플랫폼 공통 법정 기준값입니다. 기준값 수정이 필요한 경우 총괄 관리자에게 문의하세요.
            (<strong className="text-brand">법원 성격</strong> 탭의 성향 설정은 사무소별로 직접 수정 가능합니다.)
          </p>
        </div>
      )}

      {/* Subtab Bar */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-xs">
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto p-0.5 scrollbar-hide">
          {tabs.map((tab) => {
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  isCurrent 
                    ? 'bg-[#1E3A5F] text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <tab.icon size={14} className={isCurrent ? 'text-white' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {isReadOnly && tab.id === 'court_char' && (
                  <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md ml-1">수정가능</span>
                )}
              </button>
            );
          })}
        </div>
        
        {['income', 'region', 'housing', 'deductions'].includes(activeTab) && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-xl self-end sm:self-auto shadow-xs">
            <span className="text-[11px] font-bold text-slate-500">기준 연도:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-slate-900 text-xs font-black outline-none cursor-pointer"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'court_char' ? (
        renderCourtCharTab()
      ) : (
        <fieldset disabled={isReadOnly} className={isReadOnly ? "space-y-6" : "space-y-6"}>
          {activeTab === 'policy' && renderPolicyTab()}
          {activeTab === 'income' && renderIncomeTab()}
          {activeTab === 'coeffs' && renderCoeffsTab()}
          {activeTab === 'region' && renderRegionTab()}
          {activeTab === 'housing' && renderHousingTab()}
          {activeTab === 'deductions' && renderDeductionsTab()}
        </fieldset>
      )}
    </div>
  );
};

export default RehabSettingsPanel;
