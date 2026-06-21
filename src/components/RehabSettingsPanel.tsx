import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings } from '../services/settingsService';
import { 
  AppSettings, LeibnizTable, CourtRegionMapItem, RegionKey, 
  CourtConfig, YearlyPolicy, HousingCostRule 
} from '../types';
import { 
  Save, ShieldAlert, Calculator, MapPin, DollarSign, 
  Home, Gavel, Trash2 
} from 'lucide-react';

// ─── 아이콘 래퍼 (lucide에 Table 아이콘이 없을 경우 대비) ───
const TableIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>
  </svg>
);

type SettingsTab = 'policy' | 'income' | 'coeffs' | 'region' | 'housing' | 'deductions' | 'court_char';

const RehabSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('policy');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const availableYears = [2025, 2026, 2027, 2028, 2029, 2030];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      setSettings(data);
      if (!availableYears.includes(selectedYear)) {
        setSelectedYear(availableYears[0]);
      }
    } catch (e) {
      console.error(e);
      alert('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSettings(settings);
      alert('정책 설정이 저장되었습니다.');
    } catch (e) {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // ─── 핸들러 ───

  const addMapItem = () => {
    if (!settings) return;
    const newItem: CourtRegionMapItem = { keyword: '', court: '서울회생법원', region: 'Seoul' };
    setSettings({ ...settings, courtRegionMap: [newItem, ...settings.courtRegionMap] });
  };

  const removeMapItem = (index: number) => {
    if (!settings) return;
    const newMap = settings.courtRegionMap.filter((_, i) => i !== index);
    setSettings({ ...settings, courtRegionMap: newMap });
  };

  const handleAddCourt = () => {
    if (!settings) return;
    const newCourtName = prompt("추가할 법원 이름을 입력하세요:");
    if (newCourtName && newCourtName.trim() !== "") {
      const trimmedName = newCourtName.trim();
      const courtsFromMap = settings.courtRegionMap.map(item => item.court);
      const courtsFromConfig = Object.keys(settings.courtConfigs);
      const allKnownCourts = new Set([...courtsFromMap, ...courtsFromConfig]);

      if (allKnownCourts.has(trimmedName)) {
        alert("이미 존재하는 법원입니다.");
        return;
      }

      const newCourtConfigs = { ...settings.courtConfigs };
      newCourtConfigs[trimmedName] = {
        description: '',
        includeSpouseProperty: true,
        includeCryptoStock: true,
        allow24Month: false,
        allowAdditionalLivingCost: true,
        allowOtherLivingCost: false
      };
      setSettings({ ...settings, courtConfigs: newCourtConfigs });
    }
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

  // ─── 로딩 ───

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">정책 설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const currentYearPolicy = settings.yearlyPolicies[selectedYear];
  const inputClass = "w-full p-2 bg-slate-950 border border-slate-700 rounded text-slate-200 focus:ring-2 focus:ring-blue-500 text-sm";
  const labelClass = "block text-sm font-medium text-slate-400 mb-1";

  // ═══════════════════════════════════════════════════
  // TAB 1: 기본 정책 (Pmin)
  // ═══════════════════════════════════════════════════
  const renderPolicyTab = () => (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
          <ShieldAlert className="text-blue-500" size={20} />
          법정 최저 변제액 (Pmin) 규칙
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>기준 채무액 (Threshold)</label>
            <input type="number" className={inputClass} value={settings.policy.pminThreshold} 
              onChange={e => setSettings({...settings, policy: {...settings.policy, pminThreshold: Number(e.target.value)}})} />
          </div>
          <div>
            <label className={labelClass}>기준 미만 적용 비율</label>
            <input type="number" step="0.01" className={inputClass} value={settings.policy.pminRateBelow} 
              onChange={e => setSettings({...settings, policy: {...settings.policy, pminRateBelow: Number(e.target.value)}})} />
          </div>
          <div>
            <label className={labelClass}>기준 이상 적용 비율</label>
            <input type="number" step="0.01" className={inputClass} value={settings.policy.pminRateAbove} 
              onChange={e => setSettings({...settings, policy: {...settings.policy, pminRateAbove: Number(e.target.value)}})} />
          </div>
          <div>
            <label className={labelClass}>기준 이상 가산금 (Fixed)</label>
            <input type="number" className={inputClass} value={settings.policy.pminFixedAbove} 
              onChange={e => setSettings({...settings, policy: {...settings.policy, pminFixedAbove: Number(e.target.value)}})} />
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // TAB 2: 기준 중위소득
  // ═══════════════════════════════════════════════════
  const renderIncomeTab = () => (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2 text-white">
          <TableIcon className="text-green-500" size={20} />
          {selectedYear}년 기준 중위소득
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="bg-slate-950">
            <tr>
              <th className="px-4 py-2">가구원 수</th>
              <th className="px-4 py-2">기준 중위소득 (100%)</th>
              <th className="px-4 py-2">생계비 기준 (60%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {[1, 2, 3, 4, 5, 6].map(size => (
              <tr key={size}>
                <td className="px-4 py-3 font-medium">{size}인 가구</td>
                <td className="px-4 py-3">
                  <input type="number" className={inputClass + " p-1"} value={currentYearPolicy.medianIncome.values[size] || 0} onChange={e => {
                    const newPolicies = {...settings.yearlyPolicies};
                    newPolicies[selectedYear].medianIncome.values[size] = Number(e.target.value);
                    setSettings({...settings, yearlyPolicies: newPolicies});
                  }} />
                </td>
                <td className="px-4 py-3 text-slate-500">{Math.round((currentYearPolicy.medianIncome.values[size] || 0) * 0.6).toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // TAB 3: 계수 및 한도 (라이프니츠)
  // ═══════════════════════════════════════════════════
  const renderCoeffsTab = () => (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-white">
        <Calculator className="text-purple-500" size={20} />
        라이프니츠 계수
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          {[24, 36, 48, 60].map(m => (
            <div key={m} className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{m}개월</span>
              <input type="number" step="0.01" className="w-32 p-2 bg-slate-950 border border-slate-700 rounded text-white text-sm" 
                value={settings.leibniz[`m${m}` as keyof LeibnizTable] || 0} 
                onChange={e => setSettings({ ...settings, leibniz: {...settings.leibniz, [`m${m}`]: Number(e.target.value)} })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // TAB 4: 지역/법원/보증금
  // ═══════════════════════════════════════════════════
  const renderRegionTab = () => (
    <div className="space-y-8">
      {/* Deposit Rules */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <DollarSign className="text-emerald-500" size={20} />
            {selectedYear}년 지역별 보증금 면제 기준
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['Seoul', 'Overcrowded', 'Metro', 'Others'] as RegionKey[]).map(r => (
            <div key={r} className="bg-slate-950 p-4 rounded-lg border border-slate-700">
              <h4 className="font-bold text-white mb-2">
                {r === 'Seoul' ? '서울특별시' : r === 'Overcrowded' ? '과밀억제권역' : r === 'Metro' ? '광역시' : '그 외'}
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500 block">소액보증금 범위</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded text-sm p-1 text-white" 
                    value={currentYearPolicy.depositRules[r]?.limit || 0}
                    onChange={e => {
                      const newPolicies = {...settings.yearlyPolicies};
                      if(!newPolicies[selectedYear].depositRules[r]) newPolicies[selectedYear].depositRules[r] = {limit:0, deduct:0};
                      newPolicies[selectedYear].depositRules[r].limit = Number(e.target.value);
                      setSettings({...settings, yearlyPolicies: newPolicies});
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block">최우선 변제금액</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded text-sm p-1 text-white" 
                    value={currentYearPolicy.depositRules[r]?.deduct || 0}
                    onChange={e => {
                      const newPolicies = {...settings.yearlyPolicies};
                      if(!newPolicies[selectedYear].depositRules[r]) newPolicies[selectedYear].depositRules[r] = {limit:0, deduct:0};
                      newPolicies[selectedYear].depositRules[r].deduct = Number(e.target.value);
                      setSettings({...settings, yearlyPolicies: newPolicies});
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map Table */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <MapPin className="text-orange-500" size={20} />
            행정구역 - 법원 매핑
          </h3>
          <button onClick={addMapItem} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            + 규칙 추가
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-lg">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 sticky top-0">
              <tr>
                <th className="px-4 py-2">행정구역 (키워드)</th>
                <th className="px-4 py-2">관할 법원</th>
                <th className="px-4 py-2">지역 구분</th>
                <th className="px-4 py-2">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {settings.courtRegionMap.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2">
                    <input 
                      type="text" 
                      className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-white text-sm" 
                      value={item.keyword}
                      onChange={e => {
                        const newMap = [...settings.courtRegionMap];
                        newMap[idx].keyword = e.target.value;
                        setSettings({...settings, courtRegionMap: newMap});
                      }}
                      placeholder="예: 수원시"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="text" 
                      className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-white text-sm" 
                      value={item.court}
                      onChange={e => {
                        const newMap = [...settings.courtRegionMap];
                        newMap[idx].court = e.target.value;
                        setSettings({...settings, courtRegionMap: newMap});
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select 
                      className="bg-slate-950 border border-slate-700 rounded text-xs text-white p-1"
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
                      <option value="Others">그 외</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => removeMapItem(idx)} className="text-red-400 hover:text-red-300 text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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
    
    return (
      <div className="space-y-6">
        {(['Seoul', 'Overcrowded', 'Metro', 'Others'] as RegionKey[]).map(r => (
          <div key={r} className="bg-slate-900 p-6 rounded-xl border border-slate-800">
            <h3 className="font-bold text-lg mb-4 text-white">
              {r === 'Seoul' ? '서울특별시' : r === 'Overcrowded' ? '과밀억제권역' : r === 'Metro' ? '광역시' : '그 외 지역'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="px-4 py-2">가구원 수</th>
                    <th className="px-4 py-2">추가 주거비 인정 한도</th>
                    <th className="px-4 py-2">중위소득 60% 포함분</th>
                    <th className="px-4 py-2">주거비 총 인정 한도 (자동)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[1, 2, 3, 4].map(size => {
                    const rule = currentYearPolicy.housingCostLimits[r]?.[size] || { additionalLimit: 0, includedInMedian: 0, totalLimit: 0 };
                    return (
                      <tr key={size}>
                        <td className="px-4 py-3 font-medium">{size}인 가구</td>
                        <td className="px-4 py-3">
                          <input type="number" className={inputClass} value={rule.additionalLimit} onChange={e => handleHousingChange(r, size, 'additionalLimit', Number(e.target.value))} />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" className={inputClass} value={rule.includedInMedian} onChange={e => handleHousingChange(r, size, 'includedInMedian', Number(e.target.value))} />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" className={inputClass + " bg-slate-950 text-slate-500"} value={rule.totalLimit} readOnly />
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
      return <div className="p-4 text-slate-500">선택된 연도의 공제 기준 데이터가 없습니다. 설정을 초기화하거나 다른 연도를 선택해주세요.</div>;
    }

    const handleNestedChange = (category: keyof YearlyPolicy, field: string, value: string) => {
      if (!settings) return;
      const newPolicies = { ...settings.yearlyPolicies };
      const policy = newPolicies[selectedYear];

      if (category === 'medicalCostIncludedInMedian') {
        (policy[category] as any)[field] = Number(value);
      } else {
        (policy[category as 'assetExemptions' | 'educationCost' | 'specialEducationCost'] as any)[field] = Number(value);
        // Recalculate total for education costs
        if (category === 'educationCost' || category === 'specialEducationCost') {
          const cat = policy[category as 'educationCost' | 'specialEducationCost'];
          cat.totalLimit = (cat.additionalLimit || 0) + (cat.includedInMedian || 0);
        }
      }
      setSettings({ ...settings, yearlyPolicies: newPolicies });
    };

    return (
      <div className="space-y-6">
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 className="font-bold text-lg mb-4 text-white">재산 산정 시 공제 금액</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>예금/적금 (현금 포함)</label>
              <input type="number" className={inputClass} value={currentYearPolicy.assetExemptions.deposit} onChange={e => handleNestedChange('assetExemptions', 'deposit', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>보험해약 환급금</label>
              <input type="number" className={inputClass} value={currentYearPolicy.assetExemptions.insurance} onChange={e => handleNestedChange('assetExemptions', 'insurance', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 className="font-bold text-lg mb-4 text-white">자녀 교육비 인정 범위 (월)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>추가 교육비 인정 한도</label>
              <input type="number" className={inputClass} value={currentYearPolicy.educationCost.additionalLimit} onChange={e => handleNestedChange('educationCost', 'additionalLimit', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>기준 중위소득 60% 포함분</label>
              <input type="number" className={inputClass} value={currentYearPolicy.educationCost.includedInMedian} onChange={e => handleNestedChange('educationCost', 'includedInMedian', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>총 인정 한도 (자동계산)</label>
              <input type="number" className={inputClass + " bg-slate-950 text-slate-500"} value={currentYearPolicy.educationCost.totalLimit} readOnly />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 className="font-bold text-lg mb-4 text-white">특수 교육비 인정 범위 (월)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>추가 교육비 인정 한도</label>
              <input type="number" className={inputClass} value={currentYearPolicy.specialEducationCost.additionalLimit} onChange={e => handleNestedChange('specialEducationCost', 'additionalLimit', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>기준 중위소득 60% 포함분</label>
              <input type="number" className={inputClass} value={currentYearPolicy.specialEducationCost.includedInMedian} onChange={e => handleNestedChange('specialEducationCost', 'includedInMedian', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>총 인정 한도 (자동계산)</label>
              <input type="number" className={inputClass + " bg-slate-950 text-slate-500"} value={currentYearPolicy.specialEducationCost.totalLimit} readOnly />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 className="font-bold text-lg mb-4 text-white">고정 의료비 (중위소득 60% 포함분)</h3>
          <p className="text-sm text-slate-500 mb-4 -mt-2">의료비는 기준 중위소득 60%에 포함된 금액을 초과하는 부분에 대해 인정됩니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(size => (
              <div key={size}>
                <label className={labelClass}>{size}인 가구</label>
                <input type="number" className={inputClass} value={currentYearPolicy.medicalCostIncludedInMedian[size] || 0} onChange={e => handleNestedChange('medicalCostIncludedInMedian', String(size), e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 className="font-bold text-lg mb-4 text-white">고소득자 기타 생계비 한도 기준</h3>
          <p className="text-sm text-slate-500 mb-4 -mt-2">월 소득이 기준 중위소득의 N배를 초과하고, 변제율이 기준 이상인 채무자를 대상으로 합니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>소득 기준 배율 (예: 1.5 = 150%)</label>
              <input type="number" step="0.1" className={inputClass} value={currentYearPolicy.highIncomeEarnerMultiplier}
                onChange={e => { const newPolicies = { ...settings.yearlyPolicies }; newPolicies[selectedYear].highIncomeEarnerMultiplier = Number(e.target.value); setSettings({ ...settings, yearlyPolicies: newPolicies }); }} />
            </div>
            <div>
              <label className={labelClass}>최소 변제율 기준 (%)</label>
              <input type="number" step="1" className={inputClass} value={(currentYearPolicy.highIncomeRepaymentRateThreshold || 0) * 100}
                onChange={e => { const newPolicies = { ...settings.yearlyPolicies }; newPolicies[selectedYear].highIncomeRepaymentRateThreshold = Number(e.target.value) / 100; setSettings({ ...settings, yearlyPolicies: newPolicies }); }} />
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
          <h3 className="font-bold text-lg mb-4 text-white">성년 자녀 부양가족 인정 기준</h3>
          <p className="text-sm text-slate-500 mb-4 -mt-2">
            만 {currentYearPolicy.adultChildDependentCriteria.minAge}세 이상 ~ 만 {currentYearPolicy.adultChildDependentCriteria.maxAge}세 미만 자녀의 소득 기준입니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>소득금액의 합계액 (연간)</label>
              <input type="number" className={inputClass} value={currentYearPolicy.adultChildDependentCriteria.incomeLimit}
                onChange={e => { const newPolicies = { ...settings.yearlyPolicies }; newPolicies[selectedYear].adultChildDependentCriteria.incomeLimit = Number(e.target.value); setSettings({ ...settings, yearlyPolicies: newPolicies }); }} />
            </div>
            <div>
              <label className={labelClass}>근로소득만 있는 경우 총급여액 (연간)</label>
              <input type="number" className={inputClass} value={currentYearPolicy.adultChildDependentCriteria.grossIncomeLimit}
                onChange={e => { const newPolicies = { ...settings.yearlyPolicies }; newPolicies[selectedYear].adultChildDependentCriteria.grossIncomeLimit = Number(e.target.value); setSettings({ ...settings, yearlyPolicies: newPolicies }); }} />
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
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <Gavel className="text-yellow-500" size={20} />
            법원별 성향 관리 <span className="hidden sm:inline text-sm font-normal text-slate-500">(계산 및 보고서 반영)</span>
          </h3>
          <button onClick={handleAddCourt} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 whitespace-nowrap">
            + 법원 추가
          </button>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block max-h-[600px] overflow-y-auto border border-slate-700 rounded-lg">
          <table className="w-full text-left text-sm text-slate-300 relative">
            <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-bold text-white w-40">법원명</th>
                <th className="px-4 py-3 font-bold text-white">특징 / 메모</th>
                <th className="px-2 py-3 text-center text-xs w-24">배우자 재산<br/>50% 반영</th>
                <th className="px-2 py-3 text-center text-xs w-24">코인/주식<br/>청산가치</th>
                <th className="px-2 py-3 text-center text-xs w-24">24개월<br/>변제 가능</th>
                <th className="px-2 py-3 text-center text-xs w-24">추가 생계비<br/>반영</th>
                <th className="px-2 py-3 text-center text-xs w-24">기타 생계비<br/>반영</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
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
                  <tr key={court} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-white">{court}</td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-slate-300 text-xs" 
                        placeholder="법원 특징 입력..."
                        value={config.description}
                        onChange={e => updateCourtConfig(court, 'description', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox" className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500" 
                        checked={config.includeSpouseProperty} 
                        onChange={e => updateCourtConfig(court, 'includeSpouseProperty', e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox" className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500" 
                        checked={config.includeCryptoStock} 
                        onChange={e => updateCourtConfig(court, 'includeCryptoStock', e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox" className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500" 
                        checked={config.allow24Month} 
                        onChange={e => updateCourtConfig(court, 'allow24Month', e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox" className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500" 
                        checked={config.allowAdditionalLivingCost} 
                        onChange={e => updateCourtConfig(court, 'allowAdditionalLivingCost', e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox" className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-blue-500" 
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
        <div className="md:hidden space-y-4">
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
              <div key={court} className="bg-slate-950 p-5 rounded-xl border border-slate-700 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-1">
                  <h4 className="font-bold text-white text-lg flex items-center gap-2">
                    <Gavel size={16} className="text-slate-400"/> {court}
                  </h4>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">특징 / 메모</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:ring-1 focus:ring-blue-500 outline-none" 
                    placeholder="법원 특징 입력..."
                    value={config.description}
                    onChange={e => updateCourtConfig(court, 'description', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1">
                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded bg-slate-950 border-slate-600 text-blue-600 focus:ring-blue-500" 
                      checked={config.includeSpouseProperty} 
                      onChange={e => updateCourtConfig(court, 'includeSpouseProperty', e.target.checked)}
                    />
                    <span className="text-xs font-medium text-slate-300">배우자 재산 50%</span>
                  </label>
                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded bg-slate-950 border-slate-600 text-blue-600 focus:ring-blue-500" 
                      checked={config.includeCryptoStock} 
                      onChange={e => updateCourtConfig(court, 'includeCryptoStock', e.target.checked)}
                    />
                    <span className="text-xs font-medium text-slate-300">코인/주식 청산가치</span>
                  </label>
                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded bg-slate-950 border-slate-600 text-blue-600 focus:ring-blue-500" 
                      checked={config.allow24Month} 
                      onChange={e => updateCourtConfig(court, 'allow24Month', e.target.checked)}
                    />
                    <span className="text-xs font-medium text-slate-300">24개월 변제 가능</span>
                  </label>
                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors">
                    <input type="checkbox" className="w-4 h-4 rounded bg-slate-950 border-slate-600 text-blue-600 focus:ring-blue-500" 
                      checked={config.allowAdditionalLivingCost} 
                      onChange={e => updateCourtConfig(court, 'allowAdditionalLivingCost', e.target.checked)}
                    />
                    <span className="text-xs font-medium text-slate-300">추가 생계비 반영</span>
                  </label>
                  <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors col-span-2">
                    <input type="checkbox" className="w-4 h-4 rounded bg-slate-950 border-slate-600 text-blue-600 focus:ring-blue-500" 
                      checked={config.allowOtherLivingCost} 
                      onChange={e => updateCourtConfig(court, 'allowOtherLivingCost', e.target.checked)}
                    />
                    <span className="text-xs font-medium text-slate-300">기타 생계비 반영</span>
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
    { id: 'policy', label: '기본 정책', icon: ShieldAlert },
    { id: 'income', label: '기준 중위소득', icon: TableIcon },
    { id: 'coeffs', label: '계수 및 한도', icon: Calculator },
    { id: 'region', label: '지역/법원/보증금', icon: MapPin },
    { id: 'housing', label: '주거비 한도', icon: Home },
    { id: 'deductions', label: '공제 기준', icon: DollarSign },
    { id: 'court_char', label: '법원 성격', icon: Gavel },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-400" />
            회생/파산 정책 및 계산 기준 설정
          </h2>
          <p className="text-xs text-slate-400 mt-1">챗봇 상담 및 보고서 산출에 사용되는 핵심 정책값을 관리합니다.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg shadow-blue-900/30 transition-all text-sm disabled:opacity-50"
        >
          <Save size={16} /> {saving ? '저장 중...' : '변경사항 저장'}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'bg-slate-800 text-white' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <tab.icon size={14} className={activeTab === tab.id ? 'text-blue-400' : ''} />
              {tab.label}
            </button>
          ))}
        </div>
        
        {['income', 'region', 'housing', 'deductions'].includes(activeTab) && (
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-500"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'policy' && renderPolicyTab()}
      {activeTab === 'income' && renderIncomeTab()}
      {activeTab === 'coeffs' && renderCoeffsTab()}
      {activeTab === 'region' && renderRegionTab()}
      {activeTab === 'housing' && renderHousingTab()}
      {activeTab === 'deductions' && renderDeductionsTab()}
      {activeTab === 'court_char' && renderCourtCharTab()}
    </div>
  );
};

export default RehabSettingsPanel;
