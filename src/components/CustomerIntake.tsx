import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Trash2, ArrowRight, User as UserIcon,
  Briefcase, Home, DollarSign, FileText, MapPin, 
  CreditCard, Calendar, HeartPulse, Scale, CheckSquare, 
  AlertTriangle, List, Calculator
} from 'lucide-react';
import { 
  DebtItem, AssetDetail, IntakeData, CaseType, IncomeSource, 
  IncomeType, AssetType, AssetOwner, PayType, AppSettings, 
  DebtType, FeeLoanInfo, ConsultationLog
} from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { 
  formatNumber, calculateManAge, detectJurisdiction, 
  generateDateOptions, formatKoreanCurrency 
} from '../utils';
import { calculateRehabPlan } from '../rehabEngine';

// --- MoneyInput inline helper component ---
interface MoneyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: number;
  onValueChange: (val: number) => void;
  label?: string;
  placeholder?: string;
  unit?: number;
}

const MoneyInput: React.FC<MoneyInputProps> = ({ 
  value, onValueChange, label, className, unit = 1, placeholder, ...props 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    const num = Number(raw);
    if (!isNaN(num)) {
      onValueChange(num * unit);
    }
  };

  const displayValue = value > 0 ? (value / unit) : '';

  return (
    <div className={className}>
      {label && <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</label>}
      <div className="relative">
        <input
          {...props}
          type="text"
          value={displayValue ? Number(displayValue).toLocaleString('ko-KR') : ''}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pr-12 text-right font-medium text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all placeholder-slate-400 dark:placeholder-slate-600 text-xs shadow-sm"
        />
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <span className="text-slate-400 dark:text-slate-500 text-xs">{unit === 10000 ? '만원' : '원'}</span>
        </div>
      </div>
      {value > 0 && (
        <p className="text-[10px] text-blue-400 mt-0.5 text-right font-medium">
          {formatKoreanCurrency(value)}
        </p>
      )}
    </div>
  );
};

// --- Main CustomerIntake Component ---
interface CustomerIntakeProps {
  onSubmit: (data: IntakeData) => void;
  onCancel?: () => void;
  initialData?: IntakeData;
}

export const CustomerIntake: React.FC<CustomerIntakeProps> = ({ 
  onSubmit, onCancel, initialData 
}) => {
  const settings: AppSettings = DEFAULT_SETTINGS;
  const [activeSection, setActiveSection] = useState<number>(1);
  const [residenceSuggestions, setResidenceSuggestions] = useState<string[]>([]);
  const [workplaceSuggestions, setWorkplaceSuggestions] = useState<string[]>([]);

  const { years, months, days } = generateDateOptions();
  const availableYears = [2025, 2026, 2027, 2028, 2029, 2030];

  // --- Form State ---
  const [clientData, setClientData] = useState({
    name: initialData?.clientName || '',
    phone: initialData?.phoneNumber || '',
    birthYear: initialData?.birthDate.split('-')[0] || '1987',
    birthMonth: String(initialData?.birthDate ? parseInt(initialData.birthDate.split('-')[1], 10) : 1),
    birthDay: String(initialData?.birthDate ? parseInt(initialData.birthDate.split('-')[2], 10) : 1),
    consultDate: initialData?.consultDate || new Date().toISOString().split('T')[0],
    applyYear: initialData?.applyYear || new Date().getFullYear(),
    dbVendor: initialData?.dbVendor || '온라인광고',
    caseNumber: initialData?.caseNumber || '',
    portalPassword: initialData?.portalPassword || '',
    
    prevHistoryExists: initialData?.prevHistory.exists || false,
    prevCaseNumber: initialData?.prevHistory.caseNumber || '',
    prevDischargeYear: initialData?.prevHistory.dischargeYear || '',

    caseType: (initialData?.caseType as CaseType) || 'individual_rehab',
    residence: initialData?.residence || '', 
    workplace: initialData?.workplace || '', 
    selectedCourt: initialData?.selectedCourt || '',
    
    isSingleParent: initialData?.specialCircumstances.singleParent || false,
    isBasicLivelihood: initialData?.specialCircumstances.basicLivelihood || false,
    isRentFraud: initialData?.specialCircumstances.rentFraud || false,
    isSevereDisability: initialData?.specialCircumstances.severeDisability || false,
  });

  const [familyData, setFamilyData] = useState({
    maritalStatus: initialData?.maritalStatus || 'single',
    childSupportCost: initialData?.childSupportCost || 0,
    spouseIncome: initialData?.spouseIncome || 0,
    minorChildren: initialData?.minorChildren || 0,
    minorChildrenFullRecognition: initialData?.minorChildrenFullRecognition || false,
    adultChildrenCount: initialData?.adultChildrenCount || 0,
    adultChildrenDetails: (initialData?.adultChildrenDetails || []).map(d => {
      const parts = d.birthDate.split('-');
      return { 
        year: parts[0] || '1995', 
        month: String(parseInt(parts[1] || '1', 10)), 
        day: String(parseInt(parts[2] || '1', 10)) 
      };
    }),
    otherDependents: initialData?.otherDependents || 0,
    monthlyLivingCost: initialData?.monthlyLivingCost || 0,
    monthlyRent: initialData?.monthlyRent || 0, 
    monthlyInsurance: initialData?.monthlyInsurance || 0,
    expUtilities: initialData?.extraLivingCost.utilities || 0,
    expEducation: initialData?.extraLivingCost.education || 0,
    expSpecialEdu: initialData?.extraLivingCost.specialEducation || 0,
    expMedical: initialData?.extraLivingCost.medical || 0,
    expOther: initialData?.extraLivingCost.other || 0,
    expHighIncomeExtraLimit: initialData?.extraLivingCost.highIncomeExtraLimit || 0,
  });

  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(
    initialData?.incomeSources.map(i => ({ ...i, id: i.id || `inc-${Math.random()}` })) || [
      { id: 'inc-1', type: 'worker', amount: 0, tenureYears: 0, payType: 'bank' }
    ]
  );

  const [assets, setAssets] = useState<AssetDetail[]>(
    initialData?.assets.map(a => ({ ...a, id: a.id || `asset-${Math.random()}` })) || [
      { id: 'asset-initial-1', owner: 'self', type: 'deposit', description: '주거지 임대보증금', marketValue: 0, loanBalance: 0, hasPledge: false, isExempt: false },
      { id: 'asset-initial-2', owner: 'self', type: 'vehicle', description: '주요 운행 차량', marketValue: 0, loanBalance: 0, hasPledge: false, isExempt: false }
    ]
  );

  const [debts, setDebts] = useState<DebtItem[]>(
    initialData?.debts.map(d => ({ ...d, id: d.id || `debt-${Math.random()}` })) || [
      { id: `debt-${Date.now()}`, creditor: '', principal: 0, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false }
    ]
  );

  const [memoText, setMemoText] = useState<string>(initialData?.consultationLogs?.[0]?.content || '');

  useEffect(() => {
    setFamilyData(prev => {
      const currentCount = prev.adultChildrenDetails.length;
      const targetCount = prev.adultChildrenCount;
      if (currentCount === targetCount) return prev;

      let newDetails = [...prev.adultChildrenDetails];
      if (targetCount > currentCount) {
        for (let i = 0; i < targetCount - currentCount; i++) {
          newDetails.push({ year: '1995', month: '1', day: '1' });
        }
      } else {
        newDetails = newDetails.slice(0, targetCount);
      }
      return { ...prev, adultChildrenDetails: newDetails };
    });
  }, [familyData.adultChildrenCount]);

  const formattedBirthDate = useMemo(() => 
    `${clientData.birthYear}-${clientData.birthMonth.padStart(2,'0')}-${clientData.birthDay.padStart(2,'0')}`,
    [clientData.birthYear, clientData.birthMonth, clientData.birthDay]
  );

  const manAge = useMemo(() => 
    calculateManAge(formattedBirthDate, clientData.consultDate),
    [formattedBirthDate, clientData.consultDate]
  );

  const recommendedCourts = useMemo<string[]>(() => {
    const courts = new Set<string>();
    if (clientData.residence) {
      const res = detectJurisdiction(clientData.residence, settings.courtRegionMap);
      if (res && res.court !== '기타지방법원') courts.add(res.court);
    }
    if (clientData.workplace) {
      const work = detectJurisdiction(clientData.workplace, settings.courtRegionMap);
      if (work && work.court !== '기타지방법원') courts.add(work.court);
    }
    return Array.from(courts);
  }, [clientData.residence, clientData.workplace, settings]);

  useEffect(() => {
    if (recommendedCourts.length > 0) {
      setClientData(prev => ({ ...prev, selectedCourt: recommendedCourts[0] }));
    } else {
      setClientData(prev => ({ ...prev, selectedCourt: '서울회생법원' }));
    }
  }, [recommendedCourts]);

  // Handle address input and suggestions
  const handleAddressChange = (field: 'residence' | 'workplace', value: string) => {
    setClientData(prev => ({ ...prev, [field]: value }));
    if (value.length > 0 && settings?.courtRegionMap) {
      const uniqueKeywords = Array.from(new Set(settings.courtRegionMap.map(item => item.keyword)));
      const matches = uniqueKeywords
        .filter((k: string) => k.includes(value))
        .slice(0, 10);
      if (field === 'residence') setResidenceSuggestions(matches);
      else setWorkplaceSuggestions(matches);
    } else {
      setResidenceSuggestions([]);
      setWorkplaceSuggestions([]);
    }
  };

  const handleSuggestionClick = (field: 'residence' | 'workplace', value: string) => {
    setClientData(prev => ({ ...prev, [field]: value }));
    setResidenceSuggestions([]);
    setWorkplaceSuggestions([]);
  };

  // Asset helpers
  const addAsset = () => {
    setAssets([...assets, { id: `asset-${Date.now()}`, owner: 'self', type: 'other', description: '', marketValue: 0, loanBalance: 0, hasPledge: false, isExempt: false }]);
  };
  const updateAsset = (id: string, field: keyof Omit<AssetDetail, 'id'>, value: any) => {
    setAssets(assets.map(a => a.id === id ? { ...a, [field]: value } : a));
  };
  const removeAsset = (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
  };
  
  // Debt helpers
  const addDebt = () => {
    setDebts([...debts, { id: `debt-${Date.now()}`, creditor: '', principal: 0, interest: 0, type: 'unsecured', isGamblingOrLuxury: false, isRecent: false }]);
  };
  const updateDebt = (id: string, field: keyof Omit<DebtItem, 'id'>, value: any) => {
    setDebts(debts.map(d => d.id === id ? { ...d, [field]: value } : d));
  };
  const removeDebt = (id: string) => {
    if (debts.length > 1) {
      setDebts(debts.filter(d => d.id !== id));
    }
  };
  
  // Income helpers
  const addIncomeSource = () => {
    setIncomeSources([...incomeSources, { id: `inc-${Date.now()}`, type: 'worker', amount: 0, tenureYears: 0, payType: 'bank' }]);
  };
  const updateIncomeSource = (id: string, field: keyof Omit<IncomeSource, 'id'>, value: any) => {
    setIncomeSources(incomeSources.map(inc => inc.id === id ? { ...inc, [field]: value } : inc));
  };
  const removeIncomeSource = (id: string) => {
    if (incomeSources.length <= 1) return;
    setIncomeSources(incomeSources.filter(inc => inc.id !== id));
  };

  const buildPayload = (): IntakeData => {
    const formattedAdultChildren = familyData.adultChildrenDetails.map(d => ({
      birthDate: `${d.year}-${d.month.padStart(2,'0')}-${d.day.padStart(2,'0')}`
    }));

    return {
      clientName: clientData.name,
      phoneNumber: clientData.phone,
      portalPassword: clientData.portalPassword,
      birthDate: formattedBirthDate,
      consultDate: clientData.consultDate,
      applyYear: clientData.applyYear,
      dbVendor: clientData.dbVendor,
      caseType: clientData.caseType,
      residence: clientData.residence,
      workplace: clientData.workplace,
      selectedCourt: clientData.selectedCourt || '기타지방법원',
      prevHistory: { exists: clientData.prevHistoryExists, caseNumber: clientData.prevCaseNumber, dischargeYear: clientData.prevDischargeYear },
      maritalStatus: familyData.maritalStatus as any,
      spouseIncome: familyData.spouseIncome,
      childSupportCost: familyData.childSupportCost,
      minorChildren: familyData.minorChildren,
      minorChildrenFullRecognition: familyData.minorChildrenFullRecognition,
      adultChildrenCount: familyData.adultChildrenCount,
      adultChildrenDetails: formattedAdultChildren,
      otherDependents: familyData.otherDependents,
      incomeSources: incomeSources,
      monthlyLivingCost: familyData.monthlyLivingCost,
      monthlyRent: familyData.monthlyRent,
      monthlyInsurance: familyData.monthlyInsurance,
      extraLivingCost: { 
        utilities: familyData.expUtilities, 
        education: familyData.expEducation, 
        specialEducation: familyData.expSpecialEdu, 
        medical: familyData.expMedical, 
        other: familyData.expOther, 
        highIncomeExtraLimit: familyData.expHighIncomeExtraLimit 
      },
      specialCircumstances: { 
        singleParent: clientData.isSingleParent, 
        basicLivelihood: clientData.isBasicLivelihood, 
        rentFraud: clientData.isRentFraud, 
        severeDisability: clientData.isSevereDisability 
      },
      assets,
      debts,
      consultationLogs: memoText.trim() ? [
        {
          id: `memo-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          consultantId: 'client',
          consultantName: clientData.name || '의뢰인',
          content: memoText
        }
      ] : [],
      feeTotal: 0,
      feeInstallments: 1,
      feeStartDate: new Date().toISOString().split('T')[0],
      feeLoanInfo: undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeSection < 6) {
      setActiveSection(s => Math.min(6, s + 1));
      return;
    }

    if (!clientData.name || !clientData.phone) {
      alert("기본 정보(고객명, 전화번호)는 필수 입력 사항입니다.");
      setActiveSection(1);
      return;
    }

    onSubmit(buildPayload());
  };

  // --- Real-Time Calculations (실시간 계산 연동) ---
  const currentPayload = useMemo(() => buildPayload(), [
    clientData, familyData, incomeSources, assets, debts, memoText
  ]);

  const rehabResult = useMemo(() => 
    calculateRehabPlan(currentPayload, settings),
    [currentPayload, settings]
  );

  const calculatedLivingCost = useMemo(() => {
    const yearPolicy = settings.yearlyPolicies[clientData.applyYear] || settings.yearlyPolicies[2025];
    const totalDeps = familyData.minorChildren + (familyData.adultChildrenCount || 0) + familyData.otherDependents;
    const householdSize = 1 + totalDeps;
    const medianIncomeValues = yearPolicy.medianIncome.values;
    let baseMedianIncome: number;

    if (householdSize > 6) {
      baseMedianIncome = medianIncomeValues[6] + (householdSize - 6) * yearPolicy.medianIncome.incrementOver7;
    } else {
      baseMedianIncome = medianIncomeValues[householdSize] || medianIncomeValues[1];
    }
    return Math.round(baseMedianIncome * 0.6);
  }, [settings, clientData.applyYear, familyData]);

  const inputClass = "w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all text-xs font-semibold shadow-sm focus:outline-none";
  const labelClass = "block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1";

  // --- Tab sections rendering ---
  const renderSection1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>고객명 *</label>
          <input type="text" className={inputClass} value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} placeholder="가명/실명 입력" required />
        </div>
        <div>
          <label className={labelClass}>전화번호 *</label>
          <input type="text" className={inputClass} value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} placeholder="010-0000-0000" required />
        </div>
        
        <div className="md:col-span-2">
          <label className={labelClass}>생년월일 *</label>
          <div className="flex gap-2 items-center">
            <select className={inputClass} value={clientData.birthYear} onChange={e => setClientData({...clientData, birthYear: e.target.value})}>
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select className={inputClass} value={clientData.birthMonth} onChange={e => setClientData({...clientData, birthMonth: e.target.value})}>
              {months.map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select className={inputClass} value={clientData.birthDay} onChange={e => setClientData({...clientData, birthDay: e.target.value})}>
              {days.map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
            <div className="px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              만 {manAge}세
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-100/50 dark:bg-slate-800/20 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <div className="relative">
             <label className={labelClass}>실거주지 주소 (시/구/군)</label>
             <input type="text" className={inputClass} value={clientData.residence} onChange={e => handleAddressChange('residence', e.target.value)} placeholder="예: 수원시 영통구" autoComplete="off" />
             {residenceSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
                    {residenceSuggestions.map(suggestion => (
                        <li key={suggestion} onMouseDown={() => handleSuggestionClick('residence', suggestion)} className="p-2.5 text-xs text-slate-750 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 cursor-pointer"> {suggestion} </li>
                    ))}
                </ul>
            )}
          </div>
          <div className="relative">
             <label className={labelClass}>직장 소재지 주소 (시/구/군)</label>
             <input type="text" className={inputClass} value={clientData.workplace} onChange={e => handleAddressChange('workplace', e.target.value)} placeholder="예: 서울 강남구" autoComplete="off" />
             {workplaceSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
                    {workplaceSuggestions.map(suggestion => (
                        <li key={suggestion} onMouseDown={() => handleSuggestionClick('workplace', suggestion)} className="p-2.5 text-xs text-slate-750 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 cursor-pointer"> {suggestion} </li>
                    ))}
                </ul>
            )}
          </div>

        </div>

        <div className="md:col-span-2 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={clientData.prevHistoryExists}
              onChange={e => setClientData({...clientData, prevHistoryExists: e.target.checked})}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-bold text-xs text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">개인회생 또는 파산 기진행 이력 있음</span>
          </label>
          
          {clientData.prevHistoryExists && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 animate-fadeIn">
              <div>
                <label className={labelClass}>기존 사건 번호</label>
                <input type="text" className={inputClass} value={clientData.prevCaseNumber} onChange={e => setClientData({...clientData, prevCaseNumber: e.target.value})} placeholder="예: 2020개회12345" />
              </div>
              <div>
                <label className={labelClass}>최종 면책/결정 연도</label>
                <input type="text" className={inputClass} value={clientData.prevDischargeYear} onChange={e => setClientData({...clientData, prevDischargeYear: e.target.value})} placeholder="예: 2023" />
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2 p-4 border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-950/10 rounded-xl">
          <h4 className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-1.5">
            <Scale size={14} /> 취약계층 특별 고려 사항 (체크 시 24개월 최단기 변제 자격 부합)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={clientData.isSingleParent} onChange={e => setClientData({...clientData, isSingleParent: e.target.checked})} className="w-3.5 h-3.5 rounded border-purple-700 bg-slate-900 text-purple-600 focus:ring-purple-500" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-350">한부모 가족지원</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={clientData.isBasicLivelihood} onChange={e => setClientData({...clientData, isBasicLivelihood: e.target.checked})} className="w-3.5 h-3.5 rounded border-purple-700 bg-slate-900 text-purple-600 focus:ring-purple-500" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-350">기초생활수급자</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={clientData.isRentFraud} onChange={e => setClientData({...clientData, isRentFraud: e.target.checked})} className="w-3.5 h-3.5 rounded border-purple-700 bg-slate-900 text-purple-600 focus:ring-purple-500" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-350">전세사기 피해자</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={clientData.isSevereDisability} onChange={e => setClientData({...clientData, isSevereDisability: e.target.checked})} className="w-3.5 h-3.5 rounded border-purple-700 bg-slate-900 text-purple-600 focus:ring-purple-500" />
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-350">중증 장애인</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSection2 = () => {
    const handleAdultChildDetailChange = (index: number, field: 'year' | 'month' | 'day', value: string) => {
      setFamilyData(prev => {
        const newDetails = [...prev.adultChildrenDetails];
        newDetails[index] = { ...newDetails[index], [field]: value };
        return { ...prev, adultChildrenDetails: newDetails };
      });
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <label className={labelClass}>혼인 상태</label>
            <select className={inputClass} value={familyData.maritalStatus} onChange={e => setFamilyData({...familyData, maritalStatus: e.target.value})}><option value="single">미혼/미혼 1인가구</option><option value="married">법률 기혼</option><option value="divorced">이혼/사실혼 파탄</option></select>
          </div>
          <div>
            <label className={labelClass}>부양 미성년 자녀 수</label>
            <select className={inputClass} value={familyData.minorChildren} onChange={e => setFamilyData({...familyData, minorChildren: Number(e.target.value)})}>{Array.from({length:8}).map((_,i) => <option key={i} value={i}>{i}명</option>)}</select>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 rounded" checked={familyData.minorChildrenFullRecognition} onChange={e => setFamilyData({...familyData, minorChildrenFullRecognition: e.target.checked})} /> <span className="text-[11px] font-semibold text-slate-450">자녀에 대한 부양 권리 완전 단독 인정 (배우자 장애/부재 등)</span></label>
          </div>
          <div>
            <label className={labelClass}>부양 성년 자녀 수</label>
            <select className={inputClass} value={familyData.adultChildrenCount} onChange={e => setFamilyData({...familyData, adultChildrenCount: Number(e.target.value)})}>{Array.from({length:6}).map((_,i) => <option key={i} value={i}>{i}명</option>)}</select>
          </div>
          <div>
            <label className={labelClass}>기타 동거/직계존속 부양가족 수</label>
            <select className={inputClass} value={familyData.otherDependents} onChange={e => setFamilyData({...familyData, otherDependents: Number(e.target.value)})}>{Array.from({length:6}).map((_,i) => <option key={i} value={i}>{i}명</option>)}</select>
          </div>
          <div className="col-span-2 text-center py-2 bg-blue-50/50 dark:bg-slate-950/60 border border-blue-100 dark:border-slate-800 rounded-lg"><span className="text-blue-400 font-extrabold text-xs">총 인정 부양가족 수 (자동연동): {rehabResult.client.dependents}명</span></div>
        </div>

        {familyData.adultChildrenCount > 0 && (
          <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-350">성년 자녀 생년월일</h4>
            {familyData.adultChildrenDetails.map((child, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-[10px] text-slate-500 w-12 font-bold">자녀 {index + 1}</span>
                <select className={inputClass} value={child.year} onChange={e => handleAdultChildDetailChange(index, 'year', e.target.value)}>{years.map(y => <option key={y} value={y}>{y}년</option>)}</select>
                <select className={inputClass} value={child.month} onChange={e => handleAdultChildDetailChange(index, 'month', e.target.value)}>{months.map(m => <option key={m} value={m}>{m}월</option>)}</select>
                <select className={inputClass} value={child.day} onChange={e => handleAdultChildDetailChange(index, 'day', e.target.value)}>{days.map(d => <option key={d} value={d}>{d}일</option>)}</select>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><HeartPulse size={16} className="text-pink-500" /> 기본 및 특별 생계비 공제 신청 (월 기준)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>월세 주거 비용</label>
              <MoneyInput unit={10000} value={familyData.monthlyRent} onValueChange={v => setFamilyData({...familyData, monthlyRent: v})} />
            </div>
            <div>
              <label className={labelClass}>실수령 월 보장성 보험료</label>
              <MoneyInput unit={10000} value={familyData.monthlyInsurance} onValueChange={v => setFamilyData({...familyData, monthlyInsurance: v})} />
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl space-y-3 border border-slate-200 dark:border-slate-800">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-350">기타 개별적 법원 추가 공제 비용 (만원)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><MoneyInput label="전기/가스/수도료" unit={10000} value={familyData.expUtilities} onValueChange={v => setFamilyData({...familyData, expUtilities: v})} /></div>
              <div><MoneyInput label="일반 자녀교육비" unit={10000} value={familyData.expEducation} onValueChange={v => setFamilyData({...familyData, expEducation: v})} /></div>
              <div><MoneyInput label="특수 아동교육비" unit={10000} value={familyData.expSpecialEdu} onValueChange={v => setFamilyData({...familyData, expSpecialEdu: v})} /></div>
              <div><MoneyInput label="장기 고정의료비" unit={10000} value={familyData.expMedical} onValueChange={v => setFamilyData({...familyData, expMedical: v})} /></div>
              <div><MoneyInput label="기타 소명추가비" unit={10000} value={familyData.expOther} onValueChange={v => setFamilyData({...familyData, expOther: v})} /></div>
              <div>
                <label className={labelClass}>수동 생계비 지정 (만원)</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-medium text-slate-800 dark:text-slate-200 text-xs focus:ring-1 focus:ring-blue-500" 
                  placeholder={`자동 산출: ${formatNumber(calculatedLivingCost)}원`} 
                  value={familyData.monthlyLivingCost > 0 ? (familyData.monthlyLivingCost / 10000) : ''} 
                  onChange={e => setFamilyData({...familyData, monthlyLivingCost: Number(e.target.value.replace(/,/g, '')) * 10000})} 
                />
                <span className="text-[9px] text-slate-500 text-right block mt-0.5">* 미지정 시 법정 중위소득 60% 자동 산정</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSection3 = () => {
    const incomeTypeLabels: Record<IncomeType, string> = { 
      worker: '급여 소득 (4대보험 가입)', 
      worker_no_ins: '급여 소득 (4대보험 미가입)', 
      freelancer: '프리랜서 및 위촉 계약', 
      business: '개인 사업체 운영', 
      unemployed: '일시 무직/일용임시근로' 
    };
    const payTypeLabels: Record<PayType, string> = { bank: '금융기관 계좌 수령', cash: '수기/현금 수령', crypto: '코인/가상거래 수령' };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1"><Briefcase size={16} /> 월 소득 입증 정보</h3>
          <button type="button" onClick={addIncomeSource} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-700 transition-all font-bold"><Plus size={14} /> 소득원 추가</button>
        </div>
        {incomeSources.map((source, idx) => (
          <div key={source.id} className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 relative space-y-3">
            {incomeSources.length > 1 && (
              <button type="button" onClick={() => removeIncomeSource(source.id)} className="absolute top-3 right-3 p-1 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>직업군 분류</label>
                <select className={inputClass} value={source.type} onChange={e => updateIncomeSource(source.id, 'type', e.target.value as IncomeType)}>
                  {Object.entries(incomeTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div>
                <MoneyInput label="월 평균 세후 소득" unit={10000} value={source.amount} onValueChange={v => updateIncomeSource(source.id, 'amount', v)} />
              </div>
              <div>
                <label className={labelClass}>현직장 근속/개업 연수</label>
                <select className={inputClass} value={source.tenureYears} onChange={e => updateIncomeSource(source.id, 'tenureYears', Number(e.target.value))}>
                  {Array.from({length:31}).map((_,i) => <option key={i} value={i}>{i === 0 ? '1년 미만 신입' : `${i}년 차`}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>급여 수령 거래 방식</label>
                <select className={inputClass} value={source.payType} onChange={e => updateIncomeSource(source.id, 'payType', e.target.value as PayType)}>
                  {Object.entries(payTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
        <div className="text-right py-2 text-sm font-extrabold bg-slate-100 dark:bg-slate-950/80 px-4 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
          <span className="text-slate-500 dark:text-slate-400">의뢰인 합산 월 총소득: </span>
          <span className="text-slate-800 dark:text-white ml-2 text-base">{formatKoreanCurrency(rehabResult.client.monthlyIncome)}</span>
        </div>
      </div>
    );
  };
  
  const renderSection4 = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white flex items-center gap-1"><Home size={16} /> 보유 자산 정보</h3>
        <button type="button" onClick={addAsset} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-700 transition-all font-bold"><Plus size={14} /> 자산 추가</button>
      </div>
      {assets.map((asset) => (
        <div key={asset.id} className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 relative space-y-3">
          <button type="button" onClick={() => removeAsset(asset.id)} className="absolute top-3 right-3 p-1 text-slate-500 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>명의 소유자</label>
              <select className={inputClass} value={asset.owner} onChange={e => updateAsset(asset.id, 'owner', e.target.value as AssetOwner)}><option value="self">본인 단독 명의</option><option value="spouse">배우자 공동/단독 명의</option></select>
            </div>
            <div>
              <label className={labelClass}>자산 카테고리</label>
              <select className={inputClass} value={asset.type} onChange={e => updateAsset(asset.id, 'type', e.target.value as AssetType)}><option value="deposit">주거용 임대보증금</option><option value="realestate">부동산 건물/분양권</option><option value="vehicle">자가 보유 승용차량</option><option value="insurance">보장성 보험 해약환급금</option><option value="severance">기업 퇴직금 예상액</option><option value="stock">증권/주식/코인 자산</option><option value="other">기타 유가자산</option></select>
            </div>
            <div>
              <label className={labelClass}>상세 품목 기술</label>
              <input type="text" className={inputClass} value={asset.description} onChange={e => updateAsset(asset.id, 'description', e.target.value)} placeholder="예: 국민은행 전세보증금" />
            </div>
            <div>
              <MoneyInput label="현재 시세/평가액" unit={10000} value={asset.marketValue} onValueChange={v => updateAsset(asset.id, 'marketValue', v)} />
            </div>
            <div>
              <MoneyInput label="담보 저당 대출 잔액" unit={10000} value={asset.loanBalance} onValueChange={v => updateAsset(asset.id, 'loanBalance', v)} />
            </div>
            <div className="md:pt-5 flex flex-col gap-2 justify-center">
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-300 font-bold select-none">
                <input type="checkbox" className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-650 text-blue-500" checked={asset.hasPledge} onChange={e => updateAsset(asset.id, 'hasPledge', e.target.checked)} />
                담보 질권 설정 대출액 차감 반영
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-300 font-bold select-none">
                <input type="checkbox" className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-650 text-blue-500" checked={asset.isExempt} onChange={e => updateAsset(asset.id, 'isExempt', e.target.checked)} />
                면제 재산으로 청산가치 합산 제외
              </label>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderSection5 = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white flex items-center gap-1"><DollarSign size={16} /> 총 대출 채무 세부 정보</h3>
        <button type="button" onClick={addDebt} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-blue-700 transition-all font-bold"><Plus size={14} /> 채권자 추가</button>
      </div>
      {debts.map((debt) => (
        <div key={debt.id} className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 relative">
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr,1.5fr,1fr,1.5fr,0.5fr] gap-3 items-end">
            <div>
              <label className={labelClass}>금융사/채권 기관명</label>
              <input type="text" className={inputClass} placeholder="예: 국민카드" value={debt.creditor} onChange={e => updateDebt(debt.id, 'creditor', e.target.value)} />
            </div>
            <div>
              <MoneyInput label="총 잔여 원리금 합산액" unit={10000} value={debt.principal} onValueChange={v => updateDebt(debt.id, 'principal', v)} />
            </div>
            <div>
              <label className={labelClass}>채무 저당 성격</label>
              <select className={inputClass} value={debt.type} onChange={e => updateDebt(debt.id, 'type', e.target.value as DebtType)}><option value="unsecured">신용 대출/카드 채무</option><option value="secured">담보부 대출 채무</option><option value="tax">국세/지방세 및 공과 체납</option></select>
            </div>
            
            <div className="flex items-center gap-2 h-9">
              <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-600 dark:text-slate-350 font-bold select-none" title="도박, 선물옵션, 주식/코인 투자 용도 대출">
                <input type="checkbox" className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-blue-500" checked={debt.isGamblingOrLuxury} onChange={e => updateDebt(debt.id, 'isGamblingOrLuxury', e.target.checked)} /> 
                주식/선물/코인
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-600 dark:text-slate-350 font-bold select-none" title="최근 1년 이내 실행 대출">
                <input type="checkbox" className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-blue-500" checked={debt.isRecent} onChange={e => updateDebt(debt.id, 'isRecent', e.target.checked)} /> 
                최근 1년 채무
              </label>
            </div>

            <button type="button" onClick={() => removeDebt(debt.id)} className="p-2 text-red-500 hover:bg-red-950/30 rounded-lg disabled:opacity-30 flex items-center justify-center transition-colors mb-0.5 border border-slate-800 hover:border-red-900" disabled={debts.length <= 1}><Trash2 size={16}/></button>
          </div>
        </div>
      ))}
      <div className="text-right py-2 text-sm font-extrabold bg-slate-100 dark:bg-slate-950/80 px-4 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
        <span className="text-slate-500 dark:text-slate-400">총 합산 채무 잔액: </span>
        <span className="text-red-400 ml-2 text-base">{formatKoreanCurrency(rehabResult.base.debtTotal)}</span>
      </div>
    </div>
  );

  const renderSection6 = () => (
    <div className="space-y-4 animate-fadeIn">
      {/* 특이사항 및 궁금한 사항 입력 영역 */}
      <div className="bg-white dark:bg-slate-900/60 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 space-y-3">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <FileText size={14} className="text-blue-500" />
          <span>특이사항 및 궁금한 사항 (변호사 전달용)</span>
        </label>
        <textarea
          rows={6}
          value={memoText}
          onChange={e => setMemoText(e.target.value)}
          placeholder="개인적인 특이사항(예: 주위 사실 노출 우려, 독촉 위기, 직장 노출 우려 등)이나 담당 변호사에게 특별히 궁금한 질문을 자유롭게 적어주세요. 자세히 소명해 주실수록 더욱 정밀하고 신속한 법률 대응이 개시됩니다."
          className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 text-xs font-semibold placeholder-slate-400 dark:placeholder-slate-600 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-sm focus:border-blue-500"
        />
      </div>
    </div>
  );

  const tabs = [
    { id: 1, label: '기본/사건', icon: UserIcon },
    { id: 2, label: '생계비/공제', icon: HeartPulse },
    { id: 3, label: '소득/직업', icon: Briefcase },
    { id: 4, label: '자산', icon: Home },
    { id: 5, label: '채무', icon: DollarSign },
    { id: 6, label: '메모/전달', icon: CheckSquare },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="text-blue-500" size={24} />
            <span>정밀 채무 분석 (상세 재정 데이터 입력)</span>
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">정밀한 재정 데이터 기입을 통해 법원 기준 AI 변제 전략이 즉시 산출됩니다.</p>
        </div>
        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel}
            className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-750 px-3 py-1.5 rounded-lg font-bold"
          >
            취소
          </button>
        )}
      </div>

      {/* Tabs visual selector */}
      <div className="bg-slate-100 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button 
            key={tab.id} 
            type="button"
            onClick={() => setActiveSection(tab.id)} 
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs shrink-0 transition-all ${
              activeSection === tab.id 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800/80">
          {activeSection === 1 && renderSection1()}
          {activeSection === 2 && renderSection2()}
          {activeSection === 3 && renderSection3()}
          {activeSection === 4 && renderSection4()}
          {activeSection === 5 && renderSection5()}
          {activeSection === 6 && renderSection6()}
          
          <div className="mt-6 flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button 
              type="button" 
              onClick={() => setActiveSection(Math.max(1, activeSection - 1))} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${ 
                activeSection === 1 ? 'text-slate-300 dark:text-slate-650 cursor-not-allowed' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white' 
              }`} 
              disabled={activeSection === 1}
            > 
              이전 단계 
            </button>
            {activeSection < 6 ? (
              <button 
                type="submit" 
                className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-1.5"
              > 
                <span>다음 단계로</span> 
                <ArrowRight size={14} /> 
              </button>
            ) : (
              <button 
                type="submit" 
                className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-extrabold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/20"
              > 
                <CheckSquare size={14} /> 
                <span>정밀 분석 완료 및 결과 확인</span> 
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
