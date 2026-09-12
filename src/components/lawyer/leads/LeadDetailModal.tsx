import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Save, Phone, PhoneCall, Sparkles, Clock, AlertTriangle, 
  CheckCircle2, User, DollarSign, Home, Briefcase, Plus, Trash2, 
  Calendar, FileText, Check, ShieldCheck, History, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ChipSelect } from './ChipSelect';
import { CaseBriefingBanner } from './CaseBriefingBanner';
import type { SalesLead, AssetItem, CallLog, ReminderItem, LeadStatus } from '../../../types/leadTypes';
import { LEAD_STATUS_CONFIG } from '../../../types/leadTypes';
import { loadInboundPaths } from '../../../services/settingsService';
import { 
  saveSalesLead, logLeadCall, addLeadReminder, 
  extractBriefingData, formatPhone, normalizeBirthYear 
} from '../../../services/leadService';
import type { User as LawyerUser, ConsultRequest } from '../../../types';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: SalesLead | null;
  onUpdateLead: (updatedLead: SalesLead) => void;
  onPromoteToClient: (lead: SalesLead) => void;
  activeLawyer: LawyerUser;
  existingRequests?: ConsultRequest[];
}

export default function LeadDetailModal({
  isOpen,
  onClose,
  lead,
  onUpdateLead,
  onPromoteToClient,
  activeLawyer,
}: LeadDetailModalProps) {
  const inboundPaths = useMemo(() => loadInboundPaths(), [isOpen]);

  // Form State
  const [formData, setFormData] = useState<SalesLead | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'call_desk'>('info');

  // Real-time call desk inputs
  const [callMemoInput, setCallMemoInput] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackMemo, setCallbackMemo] = useState('');

  // New asset item inputs
  const [newAssetType, setNewAssetType] = useState('자동차');
  const [newAssetOwner, setNewAssetOwner] = useState<'본인' | '배우자' | '배우자 공동명의'>('본인');
  const [newAssetAmount, setNewAssetAmount] = useState<number>(0);
  const [newAssetLoan, setNewAssetLoan] = useState<number>(0);
  const [newAssetDesc, setNewAssetDesc] = useState('');

  // Sync form data with selected lead
  useEffect(() => {
    if (lead) {
      setFormData({ ...lead });
      setCallMemoInput('');
      setCallbackDate('');
      setCallbackMemo('');
    }
  }, [lead]);

  // Ensure all hooks are declared before any return
  const briefingData = useMemo(() => {
    if (!formData) return null;
    return extractBriefingData(formData);
  }, [formData]);

  if (!isOpen || !formData || !lead) return null;

  // Handle single field change
  const handleChange = (field: keyof SalesLead, value: any) => {
    setFormData(prev => {
      if (!prev) return null;
      return { ...prev, [field]: value, updatedAt: new Date().toISOString() };
    });
  };

  // Save changes
  const handleSave = () => {
    if (!formData.customerName.trim()) {
      toast.error('고객명을 입력해주세요.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.replace(/\D/g, '').length < 10) {
      toast.error('유효한 연락처를 입력해주세요.');
      return;
    }

    const updated = {
      ...formData,
      customerName: formData.customerName.trim(),
      phone: formatPhone(formData.phone),
      birth: normalizeBirthYear(formData.birth),
      updatedAt: new Date().toISOString(),
    };

    saveSalesLead(updated);
    onUpdateLead(updated);
    toast.success(`${updated.customerName}님의 정보가 저장되었습니다.`);
  };

  // Add Real-time Call Memo
  const handleAddCallMemo = (result: 'connected' | 'callback' | 'no_answer' | 'rejected' = 'connected') => {
    if (!callMemoInput.trim()) {
      toast.error('통화 상담 메모를 입력해주세요.');
      return;
    }

    const updatedLead = logLeadCall(
      formData.id,
      { id: activeLawyer.id, name: activeLawyer.name },
      result,
      callMemoInput.trim()
    );

    if (updatedLead) {
      // Also append to specialMemo
      const timeTag = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const newMemoText = formData.specialMemo 
        ? `${formData.specialMemo}\n[${timeTag} ${activeLawyer.name}] ${callMemoInput.trim()}`
        : `[${timeTag} ${activeLawyer.name}] ${callMemoInput.trim()}`;

      const finalLead = {
        ...updatedLead,
        specialMemo: newMemoText,
        updatedAt: new Date().toISOString(),
      };
      saveSalesLead(finalLead);
      setFormData(finalLead);
      onUpdateLead(finalLead);
      setCallMemoInput('');
      toast.success('통화 상담 메모가 타임라인에 기록되었습니다.');
    }
  };

  // Schedule Callback Reminder
  const handleAddReminder = () => {
    if (!callbackDate) {
      toast.error('재통화 예약 일시를 선택해주세요.');
      return;
    }

    const updatedLead = addLeadReminder(formData.id, {
      dueTime: callbackDate,
      memo: callbackMemo.trim() || '고객 요청 재통화 약속',
      type: 'callback',
    });

    if (updatedLead) {
      // Also log call disposition as callback
      logLeadCall(
        formData.id,
        { id: activeLawyer.id, name: activeLawyer.name },
        'callback',
        `재통화 예약: ${callbackDate} (${callbackMemo || '메모 없음'})`,
        callbackDate
      );
      saveSalesLead(updatedLead);
      setFormData(updatedLead);
      onUpdateLead(updatedLead);
      setCallbackDate('');
      setCallbackMemo('');
      toast.success('재통화 예약 리마인더가 등록되었습니다.');
    }
  };

  // Quick Disposition Buttons
  const handleQuickDisposition = (result: 'connected' | 'no_answer' | 'callback' | 'rejected' | 'wrong_number', defaultNote: string) => {
    const updatedLead = logLeadCall(
      formData.id,
      { id: activeLawyer.id, name: activeLawyer.name },
      result,
      defaultNote
    );
    if (updatedLead) {
      setFormData(updatedLead);
      onUpdateLead(updatedLead);
      toast.success(`통화 결과: '${defaultNote}' 기록 완료`);
    }
  };

  // Add Asset Item
  const handleAddAsset = () => {
    if (!newAssetDesc.trim()) {
      toast.error('자산 세부 설명을 입력해주세요.');
      return;
    }

    const newAsset: AssetItem = {
      id: `asset-${Date.now()}`,
      type: newAssetType,
      owner: newAssetOwner,
      amount: Number(newAssetAmount) || 0,
      loanAmount: Number(newAssetLoan) || 0,
      desc: newAssetDesc.trim(),
    };

    const updatedAssets = [...(formData.assets || []), newAsset];
    handleChange('assets', updatedAssets);
    setNewAssetDesc('');
    setNewAssetAmount(0);
    setNewAssetLoan(0);
    toast.success('자산 항목이 추가되었습니다.');
  };

  // Remove Asset Item
  const handleRemoveAsset = (assetId: string) => {
    const updatedAssets = (formData.assets || []).filter(a => a.id !== assetId);
    handleChange('assets', updatedAssets);
  };

  const statusConfig = LEAD_STATUS_CONFIG[formData.status] || LEAD_STATUS_CONFIG.new;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6 animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden my-auto">
        
        {/* ── Top Header Toolbar ── */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          {/* Customer Meta */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center font-black text-base shrink-0">
              <User size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-black text-white tracking-tight">{formData.customerName}</h2>
                <span className="font-mono text-xs text-blue-300 font-bold bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-500/30">
                  {formData.phone}
                </span>
                {formData.birth && (
                  <span className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg">
                    {formData.birth}년생 ({formData.gender})
                  </span>
                )}
                {formData.region && (
                  <span className="text-xs text-slate-400">
                    📍 {formData.region}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>인입경로: <strong className="text-slate-200">{formData.inboundPath || '직접인입'}</strong></span>
                {formData.batchName && <span>({formData.batchName})</span>}
                <span>·</span>
                <span>총 통화시도: <strong className="text-amber-400">{formData.callCount}회</strong></span>
              </div>
            </div>
          </div>

          {/* Actions: Direct Call, Status Change, Promote to Client, Save */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <a
              href={`tel:${formData.phone}`}
              onClick={() => handleQuickDisposition('connected', '전화 발신 연결 시도')}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Phone size={14} />
              <span>전화걸기</span>
            </a>

            {/* Status Dropdown */}
            <select
              value={formData.status}
              onChange={e => handleChange('status', e.target.value as LeadStatus)}
              className={`px-3 py-2 rounded-xl text-xs font-black border outline-hidden cursor-pointer ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}
            >
              {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key} className="bg-white text-slate-900 font-bold">
                  {cfg.emoji} {cfg.label}
                </option>
              ))}
            </select>

            {/* ⭐️ Promote to Client Button */}
            {formData.status === 'converted' ? (
              <span className="px-3 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-black flex items-center gap-1">
                <CheckCircle2 size={14} />
                <span>고객 이전완료</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleSave();
                  onPromoteToClient(formData);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer press-scale"
                title="정식 고객 CRM으로 이전 등록"
              >
                <Sparkles size={14} />
                <span>⭐️ 고객 관리로 이전</span>
              </button>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer press-scale"
            >
              <Save size={14} />
              <span>저장</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body Canvas ── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-slate-50">
          
          {/* 1. Live Synchronized Briefing Banner */}
          {briefingData && (
            <CaseBriefingBanner data={briefingData} />
          )}

          {/* 2. Main 2-Column Telemarketing Cockpit */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ══════════ LEFT COLUMN: 5 COLOR BANDS (7 Cols) ══════════ */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* 🔵 BAND 1: 기본 인적사항 및 접수 */}
              <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-xs overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 px-4 py-2.5 border-b border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      1
                    </span>
                    <h3 className="font-black text-slate-900 text-sm">
                      기본 인적사항 및 유입 정보
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                    등록일: {formData.createdAt ? new Date(formData.createdAt).toLocaleDateString() : '-'}
                  </span>
                </div>

                <div className="p-4 space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">고객명 *</label>
                      <input
                        type="text"
                        value={formData.customerName}
                        onChange={e => handleChange('customerName', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">연락처 *</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={e => handleChange('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">출생년도 (4자리)</label>
                      <input
                        type="text"
                        placeholder="예: 1988"
                        maxLength={4}
                        value={formData.birth}
                        onChange={e => handleChange('birth', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <ChipSelect
                        label="성별"
                        value={formData.gender}
                        onChange={val => handleChange('gender', val)}
                        options={['남', '여']}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">거주 지역</label>
                      <input
                        type="text"
                        placeholder="예: 서울 강남구"
                        value={formData.region}
                        onChange={e => handleChange('region', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <ChipSelect
                        label="사건 희망 유형"
                        value={formData.caseType || '개인회생'}
                        onChange={val => handleChange('caseType', val)}
                        options={['개인회생', '개인파산', '미정']}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">유입 경로</label>
                      <select
                        value={formData.inboundPath || '타사DB구매'}
                        onChange={e => handleChange('inboundPath', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 outline-hidden cursor-pointer"
                      >
                        {inboundPaths.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🟢 BAND 2: 직업 · 소득 및 부양가족 */}
              <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-xs overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 px-4 py-2.5 border-b border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      2
                    </span>
                    <h3 className="font-black text-slate-900 text-sm">
                      직업 · 소득 및 부양가족
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    월 실수령액: {formData.incomeNet ? `${formData.incomeNet.toLocaleString()}만원` : '0원'}
                  </span>
                </div>

                <div className="p-4 space-y-3.5 text-xs">
                  {/* Job Types Chips */}
                  <ChipSelect
                    label="직업 형태 (복수선택 가능)"
                    value={formData.jobTypes}
                    onChange={val => handleChange('jobTypes', val)}
                    options={['급여소득', '개인사업자', '프리랜서', '일용/아르바이트', '무직']}
                    isMulti={true}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <ChipSelect
                      label="4대보험"
                      value={formData.insurance4}
                      onChange={val => handleChange('insurance4', val)}
                      options={['가입', '미가입']}
                    />
                    <ChipSelect
                      label="결혼 여부"
                      value={formData.maritalStatus}
                      onChange={val => handleChange('maritalStatus', val)}
                      options={['미혼', '기혼', '이혼']}
                    />
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">미성년 자녀수</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          value={formData.childrenCount ?? 0}
                          onChange={e => handleChange('childrenCount', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 font-bold">명</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-bold text-emerald-900 mb-1">월 실수령액 (세후 소득)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.incomeNet ?? 0}
                          onChange={e => handleChange('incomeNet', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-emerald-300 rounded-xl bg-emerald-50/40 font-mono font-black text-emerald-800 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                        />
                        <span className="absolute right-3 top-2.5 text-emerald-600 font-bold">만원</span>
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">월 대출 원리금 납입액</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.loanMonthlyPay ?? 0}
                          onChange={e => handleChange('loanMonthlyPay', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                        />
                        <span className="absolute right-3 top-2.5 text-slate-400 font-bold">만원</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🟠 BAND 3: 주거 형태 및 보증금/월세 */}
              <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-xs overflow-hidden">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      3
                    </span>
                    <h3 className="font-black text-slate-900 text-sm">
                      주거 형태 및 보증금 / 월세
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                    {formData.housingType}
                  </span>
                </div>

                <div className="p-4 space-y-3.5 text-xs">
                  <ChipSelect
                    label="주거 구분"
                    value={formData.housingType}
                    onChange={val => handleChange('housingType', val)}
                    options={['월세', '전세', '자가', '무상거주']}
                  />

                  {formData.housingType === '월세' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">임차 보증금</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.deposit ?? 0}
                            onChange={e => handleChange('deposit', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white font-mono font-bold text-amber-900 outline-hidden"
                          />
                          <span className="absolute right-3 top-2 text-amber-700 font-bold">만원</span>
                        </div>
                      </div>
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">월 차임 (월세)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.rent ?? 0}
                            onChange={e => handleChange('rent', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white font-mono font-bold text-amber-900 outline-hidden"
                          />
                          <span className="absolute right-3 top-2 text-amber-700 font-bold">만원</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.housingType === '전세' && (
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                      <label className="block font-bold text-amber-900 mb-1">전세 보증금</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.deposit ?? 0}
                          onChange={e => handleChange('deposit', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white font-mono font-bold text-amber-900 outline-hidden"
                        />
                        <span className="absolute right-3 top-2 text-amber-700 font-bold">만원</span>
                      </div>
                    </div>
                  )}

                  {formData.housingType === '자가' && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">부동산 시세 (추정가)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.ownHousePrice ?? 0}
                            onChange={e => handleChange('ownHousePrice', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white font-mono font-bold text-amber-900 outline-hidden"
                          />
                          <span className="absolute right-3 top-2 text-amber-700 font-bold">만원</span>
                        </div>
                      </div>
                      <div>
                        <label className="block font-bold text-amber-900 mb-1">담보 대출 잔액</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.ownHouseLoan ?? 0}
                            onChange={e => handleChange('ownHouseLoan', Number(e.target.value))}
                            className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white font-mono font-bold text-amber-900 outline-hidden"
                          />
                          <span className="absolute right-3 top-2 text-amber-700 font-bold">만원</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 🟣 BAND 4: 보유 자산 목록 */}
              <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xs overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50/50 px-4 py-2.5 border-b border-purple-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      4
                    </span>
                    <h3 className="font-black text-slate-900 text-sm">
                      보유 자산 목록 (차량/부동산/예금 등)
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
                    {(formData.assets || []).length}개 등록됨
                  </span>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  {/* Existing Assets */}
                  {(formData.assets || []).length === 0 ? (
                    <p className="text-slate-400 italic py-1 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      등록된 자산 내역이 없습니다. (아래에서 추가 가능)
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formData.assets.map(asset => (
                        <div key={asset.id} className="flex items-center justify-between p-2.5 bg-purple-50/60 rounded-xl border border-purple-200">
                          <div>
                            <span className="font-bold text-purple-900">[{asset.type}] {asset.desc}</span>
                            <span className="text-slate-500 ml-2">({asset.owner})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-purple-800">
                              가액: {asset.amount?.toLocaleString() || 0}만 (대출: {asset.loanAmount?.toLocaleString() || 0}만)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAsset(asset.id)}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Asset Input Row */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="font-bold text-slate-700 flex items-center gap-1">
                      <Plus size={13} className="text-purple-600" />
                      자산 항목 추가
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <select
                        value={newAssetType}
                        onChange={e => setNewAssetType(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-bold"
                      >
                        <option value="자동차">자동차</option>
                        <option value="부동산">부동산</option>
                        <option value="예적금">예적금</option>
                        <option value="보험환급금">보험환급금</option>
                        <option value="주식/코인">주식/코인</option>
                        <option value="기타">기타</option>
                      </select>
                      <select
                        value={newAssetOwner}
                        onChange={e => setNewAssetOwner(e.target.value as any)}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-bold"
                      >
                        <option value="본인">본인 명의</option>
                        <option value="배우자">배우자 명의</option>
                        <option value="배우자 공동명의">공동 명의</option>
                      </select>
                      <input
                        type="number"
                        placeholder="시세/가액 (만원)"
                        value={newAssetAmount || ''}
                        onChange={e => setNewAssetAmount(Number(e.target.value))}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                      />
                      <input
                        type="number"
                        placeholder="담보대출 (만원)"
                        value={newAssetLoan || ''}
                        onChange={e => setNewAssetLoan(Number(e.target.value))}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="세부 차종/부동산명/설명 (예: 아반떼 2018년식 8만km)"
                        value={newAssetDesc}
                        onChange={e => setNewAssetDesc(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddAsset}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🔴 BAND 5: 채무 구조 및 과거 이력 */}
              <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-xs overflow-hidden">
                <div className="bg-gradient-to-r from-rose-50 to-pink-50/50 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      5
                    </span>
                    <h3 className="font-black text-slate-900 text-sm">
                      채무 구조 및 과거 회생/파산/신복위 이력
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                    총 채무: {formData.debtTotal ? `${formData.debtTotal.toLocaleString()}만원` : '0원'}
                  </span>
                </div>

                <div className="p-4 space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-rose-900 mb-1">총 채무액 (원금 합계)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.debtTotal ?? 0}
                          onChange={e => handleChange('debtTotal', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-rose-300 rounded-xl bg-rose-50/40 font-mono font-black text-rose-700 text-base focus:bg-white focus:ring-2 focus:ring-rose-500 outline-hidden"
                        />
                        <span className="absolute right-3 top-2.5 text-rose-600 font-bold">만원</span>
                      </div>
                    </div>
                    <div>
                      <ChipSelect
                        label="신용카드 사용 여부"
                        value={formData.creditCardUse || '사용'}
                        onChange={val => handleChange('creditCardUse', val)}
                        options={['사용', '미사용']}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">담보 대출 상세 내역</label>
                    <input
                      type="text"
                      placeholder="예: 현대캐피탈 차량할부 잔액 1,200만원"
                      value={formData.collateralLoanDesc || ''}
                      onChange={e => handleChange('collateralLoanDesc', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">과거 개인회생 / 파산 / 신용회복위 이력</label>
                    <input
                      type="text"
                      placeholder="예: 3년 전 신복위 워크아웃 신청 후 실효 / 과거 회생 이력 없음"
                      value={formData.historyDetail || ''}
                      onChange={e => handleChange('historyDetail', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">특이사항 메모 / 고객 상황 요약</label>
                    <textarea
                      rows={3}
                      placeholder="상담 중 파악된 고객 상황, 채무 증대 경위, 소명 주의사항 등을 입력하세요."
                      value={formData.specialMemo || ''}
                      onChange={e => handleChange('specialMemo', e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-hidden leading-relaxed"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* ══════════ RIGHT COLUMN: CALL DESK & REAL-TIME MEMO DOCK (5 Cols) ══════════ */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* 1. Quick Call Disposition Toolbar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <PhoneCall size={14} className="text-blue-600" />
                    원클릭 통화 결과 기록
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold">
                    통화 시도 {formData.callCount}회
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDisposition('no_answer', '부재중 통화 시도')}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>📞</span>
                    <span>부재중</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDisposition('connected', '상담 통화 성공')}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>💬</span>
                    <span>상담 통화 성공</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDisposition('rejected', '상담 거절 / 단순변심')}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>🚫</span>
                    <span>거절 / 단순변심</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDisposition('wrong_number', '결번 또는 타인 번호')}
                    className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>⚠️</span>
                    <span>결번 / 번호 오류</span>
                  </button>
                </div>
              </div>

              {/* 2. Real-time Live Consultation Memo Input */}
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-blue-900 text-xs flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-600" />
                    실시간 통화 상담 메모 작성
                  </h3>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                    통화 중 바로 기록
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={callMemoInput}
                  onChange={e => setCallMemoInput(e.target.value)}
                  placeholder="고객과 통화하면서 들은 내용을 자유롭게 기록하세요. (엔터 또는 메모 기록 버튼 클릭 시 타임라인에 누적)"
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddCallMemo('connected')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>상담 메모 기록</span>
                  </button>
                </div>
              </div>

              {/* 3. Schedule Callback Reminder */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <h3 className="font-extrabold text-purple-900 text-xs flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-600" />
                  재통화 예약 (리마인더 설정)
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">약속 일시</label>
                    <input
                      type="datetime-local"
                      value={callbackDate}
                      onChange={e => setCallbackDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">예약 메모</label>
                    <input
                      type="text"
                      placeholder="예: 서류 확인 후 오후 2시 재통화 요청"
                      value={callbackMemo}
                      onChange={e => setCallbackMemo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddReminder}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                  >
                    <Calendar size={13} />
                    <span>재통화 리마인더 등록</span>
                  </button>
                </div>
              </div>

              {/* 4. Call & Memo Timeline */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                  <History size={14} className="text-slate-600" />
                  통화 및 메모 히스토리
                </h3>

                {(formData.callLogs || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    아직 기록된 통화 이력이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {formData.callLogs.map(log => (
                      <div key={log.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">
                            {log.callerName || '상담원'} · {log.result === 'connected' ? '💬 통화 성공' : log.result === 'no_answer' ? '📞 부재중' : log.result === 'callback' ? '⏰ 예약' : '🚫 거절'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.calledAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {log.memo && (
                          <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">
                            {log.memo}
                          </p>
                        )}
                        {log.callbackScheduledAt && (
                          <p className="text-[11px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded">
                            약속일: {log.callbackScheduledAt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
