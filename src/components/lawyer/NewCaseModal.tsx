import React, { useState, useMemo, useCallback } from 'react';
import { X, UserPlus, ChevronDown, ChevronUp, AlertTriangle, Check, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IntakeChannel, INTAKE_CHANNEL_CONFIG, CrmStatus, CRM_STATUS_CONFIG, CASE_TYPES, JOB_TYPES, HOUSING_TYPES, HOUSING_DETAILS, ASSET_TYPES, ASSET_OWNERS } from '../../types';
import type { CaseType } from '../../types';
import { formatPhone, checkDuplicatePhone, normalizeBirthYear } from '../../services/crmService';

export interface NewCaseData {
  clientName: string;
  phone: string;
  debtTotal: number;
  income: number;
  intakeChannel: IntakeChannel;
  channelDetail?: string;
  initialStatus: CrmStatus;
  caseType?: CaseType;
  birth?: string;
  gender?: '남' | '여';
  region?: string;
  jobTypes?: string[];
  insurance4?: '가입' | '미가입';
  maritalStatus?: '미혼' | '기혼' | '이혼';
  childrenCount?: number;
  housingType?: string;
  housingDetail?: string;
  deposit?: number;
  rent?: number;
  ownHousePrice?: number;
  ownHouseLoan?: number;
  assets?: Array<{ id: string; owner: string; type: string; amount: number; loanAmount: number; desc: string }>;
  creditLoans?: Array<{ id: string; amount: number; desc: string }>;
  loanMonthlyPay?: number;
  specialMemo?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: NewCaseData) => void;
  existingRequests: Array<{ id: string; clientName?: string; phone?: string; status?: string }>;
}

export default function NewCaseModal({ isOpen, onClose, onRegister, existingRequests }: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    s1: true,
    s2: false,
    s3: false,
    s4: false,
    s5: false
  });

  const [formData, setFormData] = useState<Partial<NewCaseData>>({
    intakeChannel: Object.keys(INTAKE_CHANNEL_CONFIG)[0] as IntakeChannel,
    initialStatus: 'ST02' as CrmStatus,
    clientName: '',
    phone: '',
    jobTypes: [],
    assets: [],
    creditLoans: [],
  });

  const [duplicateWarning, setDuplicateWarning] = useState<{name: string, status: string} | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleChange = (field: keyof NewCaseData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    handleChange('phone', formatted);
    
    if (formatted.replace(/[^0-9]/g, '').length >= 10) {
      const dup = checkDuplicatePhone(formatted, existingRequests);
      if (dup) {
        setDuplicateWarning({ name: dup.clientName || '이름없음', status: dup.status || '알 수 없음' });
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleBirthBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      handleChange('birth', normalizeBirthYear(val));
    }
  };

  const toggleJobType = (job: string) => {
    setFormData(prev => {
      const current = prev.jobTypes || [];
      return {
        ...prev,
        jobTypes: current.includes(job) ? current.filter(j => j !== job) : [...current, job]
      };
    });
  };

  const addAsset = () => {
    setFormData(prev => ({
      ...prev,
      assets: [
        ...(prev.assets || []),
        { id: Math.random().toString(36).substr(2, 9), owner: ASSET_OWNERS[0], type: ASSET_TYPES[0], amount: 0, loanAmount: 0, desc: '' }
      ]
    }));
  };

  const removeAsset = (id: string) => {
    setFormData(prev => ({
      ...prev,
      assets: (prev.assets || []).filter(a => a.id !== id)
    }));
  };

  const updateAsset = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      assets: (prev.assets || []).map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const addCreditLoan = () => {
    setFormData(prev => ({
      ...prev,
      creditLoans: [
        ...(prev.creditLoans || []),
        { id: Math.random().toString(36).substr(2, 9), amount: 0, desc: '' }
      ]
    }));
  };

  const removeCreditLoan = (id: string) => {
    setFormData(prev => ({
      ...prev,
      creditLoans: (prev.creditLoans || []).filter(l => l.id !== id)
    }));
  };

  const updateCreditLoan = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      creditLoans: (prev.creditLoans || []).map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  const validateBase = (isSimple: boolean) => {
    const name = formData.clientName?.trim() || (isSimple ? '이름없음' : '');
    const phoneNum = (formData.phone || '').replace(/[^0-9]/g, '');
    
    if (!isSimple && !formData.clientName?.trim()) {
      toast.error('고객명을 입력해주세요.');
      return false;
    }
    if (phoneNum.length < 10) {
      toast.error('유효한 전화번호를 입력해주세요.');
      return false;
    }
    return { name, phoneNum };
  };

  const handleSimpleRegister = () => {
    const valid = validateBase(true);
    if (!valid) return;

    onRegister({
      ...formData,
      clientName: valid.name,
      phone: formData.phone || '',
      debtTotal: formData.debtTotal || 0,
      income: formData.income || 0,
      intakeChannel: formData.intakeChannel as IntakeChannel,
      initialStatus: formData.initialStatus as CrmStatus,
    } as NewCaseData);
    
    onClose();
  };

  const handleFullRegister = () => {
    const valid = validateBase(false);
    if (!valid) return;

    onRegister({
      ...formData,
      clientName: valid.name,
      phone: formData.phone || '',
      debtTotal: formData.debtTotal || 0,
      income: formData.income || 0,
      intakeChannel: formData.intakeChannel as IntakeChannel,
      initialStatus: formData.initialStatus as CrmStatus,
    } as NewCaseData);

    onClose();
  };

  if (!isOpen) return null;

  const renderSectionHeader = (id: string, title: string) => (
    <button 
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
    >
      <span className="font-semibold text-slate-800">{title}</span>
      {expandedSections[id] ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <UserPlus className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">새 사건 등록</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: 기본 정보 */}
          <div className="space-y-4">
            {renderSectionHeader('s1', '기본 정보')}
            {expandedSections.s1 && (
              <div className="p-4 space-y-4 border border-slate-100 rounded-2xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">유입 채널</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(INTAKE_CHANNEL_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => handleChange('intakeChannel', key)}
                        className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                          formData.intakeChannel === key 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {config.emoji} {config.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">채널 상세 메모</label>
                  <textarea 
                    value={formData.channelDetail || ''}
                    onChange={(e) => handleChange('channelDetail', e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30 resize-none h-20"
                    placeholder="채널 관련 상세 내용을 입력하세요..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">사건 유형</label>
                  <div className="flex flex-wrap gap-2">
                    {CASE_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => handleChange('caseType', type)}
                        className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                          formData.caseType === type 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">고객명 <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      value={formData.clientName || ''}
                      onChange={(e) => handleChange('clientName', e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                      placeholder="고객명 입력"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">전화번호 <span className="text-red-500">*</span></label>
                    <input 
                      type="tel"
                      value={formData.phone || ''}
                      onChange={handlePhoneChange}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>

                {duplicateWarning && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>이미 등록된 전화번호입니다. (고객명: {duplicateWarning.name} / 상태: {CRM_STATUS_CONFIG[duplicateWarning.status as CrmStatus]?.label || duplicateWarning.status})</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">출생년도</label>
                    <input 
                      type="text"
                      value={formData.birth || ''}
                      onChange={(e) => handleChange('birth', e.target.value)}
                      onBlur={handleBirthBlur}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                      placeholder="예: 1980"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">성별</label>
                    <div className="flex gap-2">
                      {['남', '여'].map(g => (
                        <button
                          key={g}
                          onClick={() => handleChange('gender', g)}
                          className={`flex-1 py-3 rounded-xl text-sm transition-colors ${
                            formData.gender === g
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">지역</label>
                  <input 
                    type="text"
                    value={formData.region || ''}
                    onChange={(e) => handleChange('region', e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                    placeholder="예: 서울시 강남구"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: 직업 · 소득 */}
          <div className="space-y-4">
            {renderSectionHeader('s2', '직업 · 소득')}
            {expandedSections.s2 && (
              <div className="p-4 space-y-4 border border-slate-100 rounded-2xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">직업 유형</label>
                  <div className="flex flex-wrap gap-2">
                    {JOB_TYPES.map(job => (
                      <label key={job} className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                        <input 
                          type="checkbox"
                          checked={(formData.jobTypes || []).includes(job)}
                          onChange={() => toggleJobType(job)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">{job}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">월 소득(만원)</label>
                    <input 
                      type="number"
                      value={formData.income || ''}
                      onChange={(e) => handleChange('income', parseInt(e.target.value) || 0)}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">4대보험</label>
                    <div className="flex gap-2">
                      {['가입', '미가입'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => handleChange('insurance4', opt)}
                          className={`flex-1 py-3 rounded-xl text-sm transition-colors ${
                            formData.insurance4 === opt
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">결혼 여부</label>
                  <div className="flex gap-2">
                    {['미혼', '기혼', '이혼'].map(m => (
                      <button
                        key={m}
                        onClick={() => handleChange('maritalStatus', m)}
                        className={`flex-1 py-3 rounded-xl text-sm transition-colors ${
                          formData.maritalStatus === m
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {['기혼', '이혼'].includes(formData.maritalStatus || '') && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">자녀 수</label>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                        <button
                          key={num}
                          onClick={() => handleChange('childrenCount', num)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                            formData.childrenCount === num
                              ? 'bg-blue-600 text-white shadow-md' 
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: 주거 정보 */}
          <div className="space-y-4">
            {renderSectionHeader('s3', '주거 정보')}
            {expandedSections.s3 && (
              <div className="p-4 space-y-4 border border-slate-100 rounded-2xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">주거 형태</label>
                  <div className="flex flex-wrap gap-2">
                    {HOUSING_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => handleChange('housingType', type)}
                        className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                          formData.housingType === type
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">주거 상세</label>
                  <div className="flex flex-wrap gap-2">
                    {HOUSING_DETAILS.map(detail => (
                      <button
                        key={detail}
                        onClick={() => handleChange('housingDetail', detail)}
                        className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                          formData.housingDetail === detail
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {detail}
                      </button>
                    ))}
                  </div>
                </div>

                {['월세', '전세'].includes(formData.housingDetail || '') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">보증금(만원)</label>
                      <input 
                        type="number"
                        value={formData.deposit || ''}
                        onChange={(e) => handleChange('deposit', parseInt(e.target.value) || 0)}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    {formData.housingDetail === '월세' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">월세(만원)</label>
                        <input 
                          type="number"
                          value={formData.rent || ''}
                          onChange={(e) => handleChange('rent', parseInt(e.target.value) || 0)}
                          className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.housingDetail === '자가' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">자가 시세(만원)</label>
                      <input 
                        type="number"
                        value={formData.ownHousePrice || ''}
                        onChange={(e) => handleChange('ownHousePrice', parseInt(e.target.value) || 0)}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">담보 대출(만원)</label>
                      <input 
                        type="number"
                        value={formData.ownHouseLoan || ''}
                        onChange={(e) => handleChange('ownHouseLoan', parseInt(e.target.value) || 0)}
                        className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: 채무 · 자산 */}
          <div className="space-y-4">
            {renderSectionHeader('s4', '채무 · 자산')}
            {expandedSections.s4 && (
              <div className="p-4 space-y-6 border border-slate-100 rounded-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">총 채무액(만원)</label>
                    <input 
                      type="number"
                      value={formData.debtTotal || ''}
                      onChange={(e) => handleChange('debtTotal', parseInt(e.target.value) || 0)}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">월 대출 납입(만원)</label>
                    <input 
                      type="number"
                      value={formData.loanMonthlyPay || ''}
                      onChange={(e) => handleChange('loanMonthlyPay', parseInt(e.target.value) || 0)}
                      className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">자산 목록</label>
                    <button onClick={addAsset} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                      <Plus className="w-4 h-4" /> 추가
                    </button>
                  </div>
                  {(formData.assets || []).map((asset) => (
                    <div key={asset.id} className="p-3 bg-slate-50 rounded-xl space-y-3 relative pr-10">
                      <button 
                        onClick={() => removeAsset(asset.id)}
                        className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <select 
                          value={asset.owner}
                          onChange={(e) => updateAsset(asset.id, 'owner', e.target.value)}
                          className="p-2 rounded-lg border border-slate-200 text-sm"
                        >
                          {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select 
                          value={asset.type}
                          onChange={(e) => updateAsset(asset.id, 'type', e.target.value)}
                          className="p-2 rounded-lg border border-slate-200 text-sm"
                        >
                          {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input 
                          type="number"
                          placeholder="금액(만원)"
                          value={asset.amount || ''}
                          onChange={(e) => updateAsset(asset.id, 'amount', parseInt(e.target.value) || 0)}
                          className="p-2 rounded-lg border border-slate-200 text-sm"
                        />
                        <input 
                          type="number"
                          placeholder="담보대출(만원)"
                          value={asset.loanAmount || ''}
                          onChange={(e) => updateAsset(asset.id, 'loanAmount', parseInt(e.target.value) || 0)}
                          className="p-2 rounded-lg border border-slate-200 text-sm"
                        />
                      </div>
                      <input 
                        type="text"
                        placeholder="상세 설명 (예: 차량번호, 부동산 주소 등)"
                        value={asset.desc || ''}
                        onChange={(e) => updateAsset(asset.id, 'desc', e.target.value)}
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">신용대출 목록</label>
                    <button onClick={addCreditLoan} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                      <Plus className="w-4 h-4" /> 추가
                    </button>
                  </div>
                  {(formData.creditLoans || []).map((loan) => (
                    <div key={loan.id} className="p-3 bg-slate-50 rounded-xl relative pr-10 flex gap-3">
                      <button 
                        onClick={() => removeCreditLoan(loan.id)}
                        className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <input 
                        type="number"
                        placeholder="대출금액(만원)"
                        value={loan.amount || ''}
                        onChange={(e) => updateCreditLoan(loan.id, 'amount', parseInt(e.target.value) || 0)}
                        className="w-1/3 p-2 rounded-lg border border-slate-200 text-sm"
                      />
                      <input 
                        type="text"
                        placeholder="대출기관 등 설명"
                        value={loan.desc || ''}
                        onChange={(e) => updateCreditLoan(loan.id, 'desc', e.target.value)}
                        className="flex-1 p-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: 메모 */}
          <div className="space-y-4">
            {renderSectionHeader('s5', '메모')}
            {expandedSections.s5 && (
              <div className="p-4 space-y-4 border border-slate-100 rounded-2xl">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">상담 특이사항</label>
                  <textarea 
                    value={formData.specialMemo || ''}
                    onChange={(e) => handleChange('specialMemo', e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/30 resize-none h-32"
                    placeholder="상담 중 확인된 특이사항이나 전달사항을 입력하세요..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white rounded-b-3xl grid grid-cols-2 gap-4">
          <button
            onClick={handleSimpleRegister}
            className="flex items-center justify-center min-h-[44px] px-6 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-all press-scale"
          >
            간편 등록
          </button>
          <button
            onClick={handleFullRegister}
            className="flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium shadow-sm hover:shadow-md transition-all press-scale whitespace-nowrap"
          >
            <Check className="w-5 h-5" />
            등록하기
          </button>
        </div>
      </div>
    </div>
  );
}
