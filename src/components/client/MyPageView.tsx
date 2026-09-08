import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Edit2, Check, X, Shield, AlertTriangle, Users, DollarSign, Home, CreditCard, Scale, Sparkles, HelpCircle, Save, ArrowLeft, Coins, Percent, Plus, Trash2, FileText, Upload, Camera, CheckCircle, Clock, ChevronRight, Bell, CheckCircle2, XCircle, RotateCcw, Send, Download, ExternalLink, ChevronDown, ChevronUp, FileCheck } from 'lucide-react';
import type { ConsultRequest, ConsultProposal, CrmStatus, FeeInstallment, DocumentReviewStatus, DocumentCheckItem, DocumentRequest, DocumentFile, ElectronicContract } from '../../types';
import { CRM_STATUS_CONFIG, DOC_REVIEW_STATUS_CONFIG } from '../../types';
import type { RehabCalculationResult } from '../../rehab-chatbot-package/services/calculationService';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import { loadClientNotifications, markAsRead, markAllAsRead, getUnreadCount } from '../../services/clientNotificationService';
import type { ClientNotification } from '../../services/clientNotificationService';
import { submitClientDocument } from '../../services/crmService';
import MobileScanner from '../lawyer/MobileScanner';
import { loadFeeNotificationSettings } from '../../services/alimtokService';
import { loadContractsLocal } from '../../services/contractService';
import { generateCourtSubmissionPdf } from '../../services/contractPdfService';
import RehabCompanionView from './companion/RehabCompanionView';
import PremiumProposalReportModal from '../common/PremiumProposalReportModal';

interface MyPageViewProps {
  userAlias: string;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  
  // 동적 진단 데이터 연동
  activeRequest?: ConsultRequest;
  activeResult?: RehabCalculationResult;
  onUpdateFinancialProfile: (updatedProfile: any) => void;
  onStartDiagnosis?: () => void;
  
  requests: ConsultRequest[];
  onNavigateToChat: (reqId?: string) => void;
  isCompact?: boolean;
  initialSubTab?: 'companion' | 'diagnosis' | 'settings';
}

export default function MyPageView({
  userAlias, setUserAlias,
  isEditingAlias, setIsEditingAlias,
  tempAlias, setTempAlias,
  activeRequest,
  activeResult,
  onUpdateFinancialProfile,
  onStartDiagnosis,
  requests,
  onNavigateToChat,
  isCompact = false,
  initialSubTab
}: MyPageViewProps) {
  const dialog = useDialog();

  // 마이페이지 3대 서브 탭 (기본값: 'companion' - 회생완주동행 메인, initialSubTab 지원)
  const [mypageTab, setMypageTab] = useState<'companion' | 'diagnosis' | 'settings'>(initialSubTab || 'companion');

  useEffect(() => {
    if (initialSubTab) {
      setMypageTab(initialSubTab);
    }
  }, [initialSubTab]);

  // 다중 전달사항 로컬 편집 상태
  const [newNoteInput, setNewNoteInput] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  
  // UI 갱신을 위한 강제 렌더링 트리거
  const [refreshTick, setRefreshTick] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  
  // 진단서 상세 항목 수정 폼 접기/펼치기 상태 (컴팩트 모드에서는 항상 펼침)
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  
  const feeSettings = useMemo(() => loadFeeNotificationSettings(), []);

  // 프리미엄 제안서/7p 리포트 모달 열림 상태
  const [selectedProposalForReport, setSelectedProposalForReport] = useState<any | null>(null);

  // 모든 상담 요청에 포함된 변호사 제안서 취합
  const allProposals = useMemo(() => {
    const list: { req: ConsultRequest; proposal: ConsultProposal }[] = [];
    const reqs = (Array.isArray(requests) && requests.length > 0) ? requests : (activeRequest ? [activeRequest] : []);
    reqs.forEach(r => {
      if (!r) return;
      (r.proposals || []).forEach(p => {
        if (!p) return;
        list.push({ req: r, proposal: p });
      });
    });
    return list;
  }, [requests, activeRequest]);

  // 체결된 또는 진행 중인 전자수임계약서 조회
  const clientContract = useMemo(() => {
    try {
      const contracts = loadContractsLocal();
      const reqId = activeRequest?.id || requests[0]?.id;
      return contracts.find((c: ElectronicContract) => 
        (reqId && (c.clientId === reqId || c.clientRefId === reqId)) ||
        (profile?.phone && c.clientPhone && c.clientPhone.replace(/[^0-9]/g, '') === profile.phone.replace(/[^0-9]/g, '')) ||
        (c.clientName && (profile?.name || userAlias) && (c.clientName === profile?.name || c.clientName === userAlias))
      ) || contracts[0] || null;
    } catch {
      return null;
    }
  }, [activeRequest, requests, activeRequest?.financialProfile, userAlias, refreshTick]);

  const profile = activeRequest?.financialProfile;

  const handleAddMypageNote = () => {
    if (!newNoteInput.trim() || !profile) return;
    const currentNotes = profile?.clientNotes || (profile?.clientNote ? [profile.clientNote] : []);
    handleFieldChange('clientNotes', [...currentNotes, newNoteInput.trim()]);
    setNewNoteInput('');
  };

  const handleSaveMypageNote = (idx: number) => {
    if (!editingNoteValue.trim() || !profile) return;
    const currentNotes = profile?.clientNotes || (profile?.clientNote ? [profile.clientNote] : []);
    const updated = currentNotes.map((note, i) => i === idx ? editingNoteValue.trim() : note);
    handleFieldChange('clientNotes', updated);
    setEditingNoteIndex(null);
    setEditingNoteValue('');
  };

  const handleDeleteMypageNote = async (idx: number) => {
    if (!profile) return;
    const confirmed = await dialog.confirm({
      title: '전달사항 메모 삭제',
      message: '해당 전달사항 메모를 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    const currentNotes = profile?.clientNotes || (profile?.clientNote ? [profile.clientNote] : []);
    const updated = currentNotes.filter((_, i) => i !== idx);
    handleFieldChange('clientNotes', updated);
    toast.success('전달사항 메모가 삭제되었습니다.');
  };

  // 세부 데이터 핸들러
  const handleFieldChange = (field: string, value: any) => {
    onUpdateFinancialProfile({
      ...profile,
      [field]: value
    });
  };

  const handleDebtChange = (debtTypeField: string, val: number) => {
    const updatedDebtTypes = {
      ...profile.debtTypes,
      [debtTypeField]: val
    };
    
    // 총 채무액 합산
    const totalDebt = (updatedDebtTypes.banks || 0) + (updatedDebtTypes.cards || 0) + (updatedDebtTypes.personals || 0) + (profile.priorityDebt || 0);

    onUpdateFinancialProfile({
      ...profile,
      debtTypes: updatedDebtTypes,
      debtTotal: totalDebt
    });
  };

  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined) return '0원';
    if (amount === 0) return '0원';
    const absAmount = Math.abs(amount);
    
    // 세션 저장/화면 만원단위 호환
    let valInWon = absAmount;
    if (absAmount < 100000) {
      // 만원 단위인 경우 원 단위로 보정해 포맷
      valInWon = absAmount * 10000;
    }
    
    const eok = Math.floor(valInWon / 100000000);
    const remainder = valInWon % 100000000;
    const man = Math.floor(remainder / 10000);

    let res = '';
    if (eok > 0) res += `${eok}억 `;
    if (man > 0) res += `${man.toLocaleString()}만`;
    return `${res}원`.trim();
  };

  const totalDebtValue = profile 
    ? (profile.totalDebt || profile.debtTotal || ((profile.debtTypes?.banks || 0) + (profile.debtTypes?.cards || 0) + (profile.debtTypes?.personals || 0) + (profile.priorityDebt || 0)))
    : 0;

  // 진단서 0~6번 상세 폼 렌더러
  const renderBlueprintEditForm = () => {
    if (!profile) return null;
    return (
      <div className="space-y-5 pt-3 border-t border-slate-150 dark:border-slate-800 animate-fadeIn text-left">
        {/* 0. 연령 및 거주/근무지 관할 법원 설정 */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">0. 연령 및 거주지 / 근무지 관할 법원 설정</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">나이 (만)</label>
              <input 
                type="number" 
                value={profile.age || 0} 
                onChange={(e) => handleFieldChange('age', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">성별</label>
              <select
                value={profile.gender || ''}
                onChange={(e) => handleFieldChange('gender', e.target.value || undefined)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
              >
                <option value="">미선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">거주지역 / 거주지 주소</label>
              <input 
                type="text" 
                value={profile.residenceRegion || profile.address || ''} 
                onChange={(e) => {
                  handleFieldChange('residenceRegion', e.target.value);
                  handleFieldChange('address', e.target.value);
                }} 
                placeholder="서울특별시, 경기도 남양주시 등"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">거주지 관할 회생 법원</label>
              <select 
                value={profile.selectedCourt || '서울회생법원'} 
                onChange={(e) => handleFieldChange('selectedCourt', e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              >
                {['서울회생법원', '수원회생법원', '부산회생법원', '인천지방법원', '대전지방법원', '대구지방법원', '광주지방법원', '전주지방법원', '청주지방법원', '춘천지방법원', '창원지방법원', '제주지방법원', '의정부지방법원'].map(court => (
                  <option key={court} value={court}>{court}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">근무지역 / 사업장 주소</label>
              <input 
                type="text" 
                value={profile.workLocation || ''} 
                onChange={(e) => handleFieldChange('workLocation', e.target.value)} 
                placeholder="서울특별시 강남구, 경기도 성남시 등"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">근무지 관할 회생 법원</label>
              <select 
                value={profile.workplaceCourt || profile.selectedCourt || '서울회생법원'} 
                onChange={(e) => handleFieldChange('workplaceCourt', e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              >
                {['서울회생법원', '수원회생법원', '부산회생법원', '인천지방법원', '대전지방법원', '대구지방법원', '광주지방법원', '전주지방법원', '청주지방법원', '춘천지방법원', '창원지방법원', '제주지방법원', '의정부지방법원'].map(court => (
                  <option key={court} value={court}>{court}</option>
                ))}
              </select>
            </div>
          </div>
          <span className="text-[11.5px] text-[#7264FF] font-semibold block pt-0.5">
            💡 <strong>관할 법원 팁</strong>: 개인회생은 <strong>거주지 관할 법원</strong>과 <strong>근무지(사업장) 관할 법원</strong> 중 의뢰인에게 유리한 법원을 자유롭게 선택하여 신청할 수 있습니다.
          </span>
        </div>

        {/* 1. 소득 및 고용 정보 */}
        <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">1. 소득 및 고용 형태</h4>
          <div className="space-y-1">
            <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">고용 형태</label>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {[
                { label: '직장인', value: 'salary' },
                { label: '사업자', value: 'business' },
                { label: '프리랜서', value: 'freelancer' },
                { label: '직장+사업', value: 'both' },
                { label: '일용직', value: 'daily' },
                { label: '무직', value: 'none' },
                { label: '기초수급자', value: 'basic_recipient' },
              ].map(item => {
                const currentEmp = profile.employmentType || (profile.jobType === 'SALARIED' ? 'salary' : profile.jobType === 'BUSINESS' ? 'business' : 'salary');
                const isSelected = currentEmp === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      handleFieldChange('employmentType', item.value);
                      handleFieldChange('jobType', item.value === 'business' ? 'BUSINESS' : 'SALARIED');
                    }}
                    className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                      isSelected
                      ? 'bg-brand border-brand text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">세후 실수령 소득 (월급, 만 원)</label>
              <input 
                type="number" 
                value={profile.income || 0} 
                onChange={(e) => handleFieldChange('income', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">월 고정 지출 (통신/보험/교통 등, 만 원)</label>
              <input 
                type="number" 
                value={profile.monthlyFixedExpenses || 0} 
                onChange={(e) => handleFieldChange('monthlyFixedExpenses', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
          </div>
        </div>

        {/* 2. 가족 구성 */}
        <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">2. 가족 구성</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">결혼 상태</label>
              <select
                value={profile.maritalStatus || 'SINGLE'}
                onChange={(e) => handleFieldChange('maritalStatus', e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
              >
                <option value="SINGLE">미혼</option>
                <option value="MARRIED">기혼</option>
                <option value="DIVORCED">이혼</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">만 19세 미만 자녀 수 (명)</label>
              <input 
                type="number" 
                value={profile.minorChildren || 0} 
                onChange={(e) => {
                  const minor = Math.max(0, Number(e.target.value));
                  handleFieldChange('minorChildren', minor);
                  const other = profile.otherDependents || 0;
                  handleFieldChange('dependents', minor + other);
                }} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">기타 부양가족 수 (명)</label>
              <input 
                type="number" 
                value={profile.otherDependents !== undefined ? profile.otherDependents : (profile.dependents ? Math.max(0, profile.dependents - (profile.minorChildren || 0)) : 0)} 
                onChange={(e) => {
                  const other = Math.max(0, Number(e.target.value));
                  handleFieldChange('otherDependents', other);
                  handleFieldChange('dependents', (profile.minorChildren || 0) + other);
                }} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
          </div>

          {/* 기혼 시 배우자 소득 */}
          {profile.maritalStatus === 'MARRIED' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">배우자 월 소득 (만 원)</label>
                <input 
                  type="number" 
                  value={profile.spouseIncome || 0} 
                  onChange={(e) => handleFieldChange('spouseIncome', Math.max(0, Number(e.target.value)))} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">배우자 소유 재산액 (만 원)</label>
                <input 
                  type="number" 
                  value={profile.spouseAsset || 0} 
                  onChange={(e) => handleFieldChange('spouseAsset', Math.max(0, Number(e.target.value)))} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                />
                <span className="text-[11px] text-slate-500 block">※ 법원 실무준칙에 따라 기혼 시 배우자 자산의 50%가 반영될 수 있습니다.</span>
              </div>
            </div>
          )}

          {/* 이혼 시 양육비 */}
          {profile.maritalStatus === 'DIVORCED' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">양육비 수령액 (월, 만 원)</label>
                <input 
                  type="number" 
                  value={profile.childSupportReceived || 0} 
                  onChange={(e) => handleFieldChange('childSupportReceived', Math.max(0, Number(e.target.value)))} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">양육비 지급액 (월, 만 원)</label>
                <input 
                  type="number" 
                  value={profile.childSupportPaid || 0} 
                  onChange={(e) => handleFieldChange('childSupportPaid', Math.max(0, Number(e.target.value)))} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. 주거 및 자산 */}
        <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">3. 주거 유형 및 재산 가치 설정</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">거주 주택 유형</label>
              <select
                value={profile.housingType || (profile.rentalDeposit !== undefined && profile.rentalDeposit > 0 ? 'rent' : 'free')}
                onChange={(e) => {
                  const val = e.target.value;
                  handleFieldChange('housingType', val);
                  if (val === 'free') {
                    handleFieldChange('rentalDeposit', 0);
                    handleFieldChange('rentCost', 0);
                  } else if (val === 'rent') {
                    if (!profile.rentalDeposit) handleFieldChange('rentalDeposit', 1000);
                    handleFieldChange('housingContractHolder', profile.housingContractHolder || 'self');
                  } else if (val === 'jeonse') {
                    if (!profile.rentalDeposit) handleFieldChange('rentalDeposit', 10000);
                    handleFieldChange('rentCost', 0);
                    handleFieldChange('housingContractHolder', profile.housingContractHolder || 'self');
                  } else if (val === 'owned' || val === 'dormitory') {
                    handleFieldChange('rentalDeposit', 0);
                    handleFieldChange('rentCost', 0);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
              >
                <option value="rent">월세 (보증금+월세)</option>
                <option value="jeonse">전세 (보증금만)</option>
                <option value="owned">자가 (본인 소유)</option>
                <option value="free">무상 거주 (보증금 없음)</option>
                <option value="dormitory">기숙사 / 사택</option>
              </select>
            </div>

            {profile.rentalDeposit !== undefined && profile.rentalDeposit > 0 && (
              <>
                <div className="space-y-1">
                  <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">임대차 계약 명의자</label>
                  <select
                    value={profile.housingContractHolder || 'self'}
                    onChange={(e) => {
                      const val = e.target.value as 'self' | 'spouse' | 'others';
                      if (val === 'others') {
                        handleFieldChange('housingContractHolder', 'others');
                        handleFieldChange('rentalDeposit', 0);
                        handleFieldChange('rentCost', 0);
                        handleFieldChange('depositLoan', 0);
                        handleFieldChange('housingType', 'free');
                      } else {
                        handleFieldChange('housingContractHolder', val);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    <option value="self">본인</option>
                    <option value="spouse">배우자</option>
                    <option value="others">지인, 가족, 회사 등 (무상거주 처리)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">임차 보증금 (만 원)</label>
                  <input 
                    type="number" 
                    value={profile.rentalDeposit || 0} 
                    onChange={(e) => handleFieldChange('rentalDeposit', Math.max(0, Number(e.target.value)))} 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">월세 (만 원)</label>
              <input 
                type="number" 
                value={profile.rentCost || 0} 
                onChange={(e) => handleFieldChange('rentCost', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">보증금 대출금 (만 원)</label>
              <input 
                type="number" 
                value={profile.depositLoan || 0} 
                onChange={(e) => handleFieldChange('depositLoan', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">본인 재산 총액 (만 원)</label>
              <input 
                type="number" 
                value={profile.myAssets || 0} 
                onChange={(e) => handleFieldChange('myAssets', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
              <span className="text-[11px] text-slate-500 block">※ 예금, 보험 해지환급금, 자동차 시세 등 본인 명의 자산 합계</span>
            </div>

            {profile.maritalStatus !== 'MARRIED' && (
              <div className="space-y-1">
                <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">배우자 소유 재산액 (만 원)</label>
                <input 
                  type="number" 
                  value={profile.spouseAsset || 0} 
                  onChange={(e) => handleFieldChange('spouseAsset', Math.max(0, Number(e.target.value)))} 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">예상 퇴직금 (만 원)</label>
              <input 
                type="number" 
                value={profile.retirementPay || 0} 
                onChange={(e) => handleFieldChange('retirementPay', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">퇴직연금 가입 종류</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '퇴직연금 (DB/DC)', value: 'pension' },
                  { label: '일반 퇴직금', value: 'none' },
                  { label: '잘 모름', value: 'unknown' }
                ].map(item => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleFieldChange('retirementPensionType', item.value)}
                    className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                      profile.retirementPensionType === item.value
                      ? 'bg-brand border-brand text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {profile.retirementPensionType === 'pension' && (
                <span className="text-[12px] text-[#10B981] block mt-1">
                  🛡️ 법률 보호 확인: 퇴직연금 가입 상태이므로 자산 반영에서 완전히 배제(0% 가산)됩니다.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. 추가 생계비 */}
        <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">4. 추가 생계비 (월 기준)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">의료비 (만 원)</label>
              <input 
                type="number" 
                value={profile.medicalCost || 0} 
                onChange={(e) => handleFieldChange('medicalCost', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">교육비 (만 원)</label>
              <input 
                type="number" 
                value={profile.educationCost || 0} 
                onChange={(e) => handleFieldChange('educationCost', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">특수교육비 (만 원)</label>
              <input 
                type="number" 
                value={profile.specialEducationCost || 0} 
                onChange={(e) => handleFieldChange('specialEducationCost', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
              <span className="text-[11px] text-slate-500 block">※ 장애인 자녀 등 특수교육 관련 지출</span>
            </div>
          </div>
        </div>

        {/* 5. 채무 구성 */}
        <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">5. 채무 구성 설정</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">은행 대출 (만 원)</label>
              <input 
                type="number" 
                value={profile.debtTypes?.banks || 0} 
                onChange={(e) => handleDebtChange('banks', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">카드사/캐피탈 (만 원)</label>
              <input 
                type="number" 
                value={profile.debtTypes?.cards || 0} 
                onChange={(e) => handleDebtChange('cards', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">저축은행/대부업/기타 (만 원)</label>
              <input 
                type="number" 
                value={profile.debtTypes?.personals || 0} 
                onChange={(e) => handleDebtChange('personals', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">국세/세금 체납 (만 원)</label>
              <input 
                type="number" 
                value={profile.priorityDebt || 0} 
                onChange={(e) => handleFieldChange('priorityDebt', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
              <span className="text-[11px] text-[#EF4444] block">※ 국세 체납 채무는 우선변제 채무에 해당하여 회생 변제금에서 우선 순위 공제됩니다.</span>
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">최근 1년 이내 신규 대출액 (만 원)</label>
              <input 
                type="number" 
                value={profile.debtTypes?.recentLoans || 0} 
                onChange={(e) => {
                  const updatedDebtTypes = { ...profile.debtTypes, recentLoans: Math.max(0, Number(e.target.value)) };
                  handleFieldChange('debtTypes', updatedDebtTypes);
                }} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block">※ 1년 이내 신규 대출이 총 채무의 30% 초과 시 법관 정밀 검토 대상이 됩니다.</span>
            </div>
          </div>
        </div>

        {/* 6. 투자/사행성 채무 및 특수 조건 */}
        <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-850 pt-4">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">6. 투자/사행성 채무 및 특수 조건</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">주식/코인 투자 손실액 (만 원)</label>
              <input 
                type="number" 
                value={profile.speculativeLoss || 0} 
                onChange={(e) => handleFieldChange('speculativeLoss', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">도박/사행성 손실 채무액 (만 원)</label>
              <input 
                type="number" 
                value={profile.gamblingLoss || 0} 
                onChange={(e) => handleFieldChange('gamblingLoss', Math.max(0, Number(e.target.value)))} 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">24개월 특례 조건</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: '해당 없음', value: 'none' },
                { label: '기초수급자', value: 'basic_recipient' },
                { label: '중증장애인', value: 'severe_disability' },
                { label: '65세 이상 고령', value: 'elderly' },
                { label: '한부모 가족', value: 'single_parent' },
                { label: '전세사기 피해자', value: 'rent_fraud' },
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleFieldChange('specialCondition', item.value)}
                  className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                    (profile.specialCondition || 'none') === item.value
                    ? 'bg-brand border-brand text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {profile.specialCondition && profile.specialCondition !== 'none' && (
              <span className="text-[12px] text-[#10B981] block mt-1">
                ✅ 24개월 특례 조건 해당: 변제기간이 36개월에서 24개월로 단축됩니다.
              </span>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">현재 법적 조치 상황</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { label: '추심 전화/문자', value: 'collection_call' },
                { label: '법원 지급명령', value: 'court_order' },
                { label: '계좌/채권 압류', value: 'seizure' },
                { label: '부동산 압류', value: 'property_seizure' },
                { label: '신용등급 하락', value: 'credit_drop' },
                { label: '급여 압류', value: 'wage_garnishment' },
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    const current = profile.legalActions || [];
                    const updated = current.includes(item.value)
                      ? current.filter(v => v !== item.value)
                      : [...current, item.value];
                    handleFieldChange('legalActions', updated);
                  }}
                  className={`py-2 px-1 rounded-xl border text-[10.5px] font-bold transition-all cursor-pointer ${
                    (profile.legalActions || []).includes(item.value)
                    ? 'bg-red-500 border-red-500 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-855'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 block">※ 해당 항목을 클릭하여 선택/해제합니다. 복수 선택 가능합니다.</span>
          </div>
        </div>

        {/* 저장 완료 및 취소 버튼 */}
        <div className="border-t border-slate-150 dark:border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!isCompact && (
            <button
              type="button"
              onClick={() => setIsEditingBlueprint(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              수정 닫기
            </button>
          )}
          {isCompact && (
            <button
              type="button"
              onClick={() => onNavigateToChat()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              채팅으로 돌아가기
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.8 },
                colors: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b']
              });
              toast.success('진단서가 성공적으로 저장되었습니다!', {
                description: '가계 재정 및 채무 조정 지표가 실시간으로 갱신되었습니다.',
                duration: 3500,
              });
              if (!isCompact) setIsEditingBlueprint(false);
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs md:text-sm font-extrabold shadow-md hover:shadow-brand-sm transition-all cursor-pointer active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            진단서 수정 저장 완료
          </button>
        </div>
      </div>
    );
  };

  // 의뢰인 추가 메모 및 문의사항 렌더러
  const renderClientNotes = () => {
    if (!profile) return null;
    return (
      <div className="space-y-3 pt-3 border-t border-slate-150 dark:border-slate-800 text-left">
        <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">의뢰인 전달사항 및 문의 메모</h4>
        
        {/* 입력 및 추가 버튼 */}
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newNoteInput}
            onChange={(e) => setNewNoteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddMypageNote();
              }
            }}
            placeholder="변호사에게 추가로 전달하고 싶은 특이사항이나 질문을 입력하세요."
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
          />
          <button
            type="button"
            onClick={handleAddMypageNote}
            className="px-4 py-3 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer shrink-0 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>추가</span>
          </button>
        </div>

        {/* 등록된 메모 목록 */}
        {(profile.clientNotes && profile.clientNotes.length > 0) ? (
          <div className="space-y-2">
            {profile.clientNotes.map((note, index) => (
              <div 
                key={index}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 flex items-center justify-between gap-3 text-xs font-semibold"
              >
                {editingNoteIndex === index ? (
                  <div className="flex-1 flex gap-2">
                    <input 
                      type="text"
                      value={editingNoteValue}
                      onChange={(e) => setEditingNoteValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveMypageNote(index);
                        }
                      }}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-850 dark:text-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveMypageNote(index)}
                      className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingNoteIndex(null)}
                      className="px-2.5 py-1.5 bg-slate-400 hover:bg-slate-500 text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-slate-850 dark:text-slate-200 leading-relaxed break-all">
                      • {note}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteIndex(index);
                          setEditingNoteValue(note);
                        }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                        title="수정"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMypageNote(index)}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            등록된 전달사항이 없습니다. 변호사에게 전달할 내용을 입력해 두시면 상담 시 함께 확인합니다.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={isCompact ? "space-y-6 animate-fadeIn text-left" : "max-w-5xl mx-auto space-y-6 animate-fadeIn text-left"}>

      {/* Header / Stealth Badge & Assigned Lawyer */}
      {!isCompact && (
        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              안전한 가명 보호 적용 중
            </span>
            <span className="text-[12px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              변호사 실시간 연결됨
            </span>
          </div>
          {isEditingAlias ? (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (tempAlias.trim()) {
                  setUserAlias(tempAlias.trim());
                }
                setIsEditingAlias(false);
              }}
              className="flex items-center gap-2 pt-1 animate-fadeIn"
            >
              <span className="text-xl md:text-2xl">👤</span>
              <input 
                type="text" 
                value={tempAlias}
                onChange={(e) => setTempAlias(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-base md:text-lg font-bold focus:ring-1 focus:ring-brand focus:outline-none w-44 md:w-52 text-slate-850 dark:text-white"
                placeholder="새 가명 입력"
                maxLength={12}
                autoFocus
              />
              <button 
                type="submit"
                className="bg-brand text-white font-bold p-2.5 rounded-xl text-xs hover:bg-brand-hover transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-sm"
                title="저장"
              >
                <Check className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => setIsEditingAlias(false)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 p-2.5 rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 flex items-center justify-center cursor-pointer border border-slate-200 dark:border-slate-700"
                title="취소"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>👤 <span className="text-brand dark:text-brand-light">{userAlias || '회원'}</span> 님의 안심 마이페이지</span>
              <button 
                type="button"
                onClick={() => {
                  setTempAlias(userAlias || '회원');
                  setIsEditingAlias(true);
                }}
                className="text-slate-500 hover:text-brand dark:hover:text-brand-light p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-880 transition-all shrink-0 cursor-pointer"
                title="가명(이름) 수정"
              >
                <Edit2 className="w-4.5 h-4.5" />
              </button>
            </h2>
          )}
          <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
            채무 사실 노출 방지를 위해 의뢰인 정보는 암호화 가명으로 처리되며, 변호사단과의 1:1 비밀 매칭 대화방이 실시간 보호받고 있습니다.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl p-4 shrink-0 flex flex-col justify-between gap-3 w-full md:w-[280px]">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">전담 지정 변호인</span>
            <div className="flex items-center gap-2">
              <img 
                src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=256" 
                alt="이소민 변호사" 
                className="w-8 h-8 rounded-lg object-cover" 
              />
              <div className="text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">이소민 변호사</span>
                <span className="text-[11px] text-[#7e7e8f] font-semibold block">서울/경기 도산 전문</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const req = requests[0];
              onNavigateToChat(req?.id);
            }}
            className="w-full text-center py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>1:1 비공개 상담방 입장</span>
          </button>
        </div>
      </div>
      )}

      {/* ═══ 마이페이지 3대 서브 탭 바 ═══ */}
      {!isCompact && (
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-750">
          <button
            type="button"
            onClick={() => setMypageTab('companion')}
            className={`flex-1 py-3 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mypageTab === 'companion'
                ? 'bg-white dark:bg-slate-900 text-brand shadow-sm border border-slate-200/60 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🌱</span>
            <span>회생·파산 완주동행</span>
            <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-bold ml-0.5">
              3~5년 관리
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMypageTab('diagnosis')}
            className={`flex-1 py-3 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mypageTab === 'diagnosis'
                ? 'bg-white dark:bg-slate-900 text-brand shadow-sm border border-slate-200/60 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>📋</span>
            <span>내 채무진단 & 서류</span>
            {allProposals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-blue-600 text-white ml-0.5 animate-pulse">
                {allProposals.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMypageTab('settings')}
            className={`flex-1 py-3 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mypageTab === 'settings'
                ? 'bg-white dark:bg-slate-900 text-brand shadow-sm border border-slate-200/60 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>🔔</span>
            <span>알림함 & 설정</span>
          </button>
        </div>
      )}

      {/* ═══ 탭 1: 회생·파산 완주동행 (메인 허브) ═══ */}
      {mypageTab === 'companion' && (
        <RehabCompanionView
          userAlias={userAlias}
          onNavigateToChat={onNavigateToChat}
        />
      )}

      {/* ═══ 탭 3: 알림 수신함 & 설정 ═══ */}
      {mypageTab === 'settings' && !isCompact && (() => {

        const notifications = loadClientNotifications();
        const unread = notifications.filter(n => !n.isRead).length;
        return (
          <div className="bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500"><Bell className="w-5 h-5" /></div>
                알림
                {unread > 0 && (
                  <span className="text-[11px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{unread}개 새 알림</span>
                )}
              </h3>
              {unread > 0 && (
                <button
                  onClick={() => { markAllAsRead(); toast.success('모든 알림을 읽음 처리했습니다'); }}
                  className="text-[11px] text-brand font-bold hover:underline cursor-pointer"
                >
                  모두 읽음
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="text-center py-6">
                <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 mt-2 font-medium">아직 알림이 없습니다</p>
                <p className="text-[11px] text-slate-400 mt-1">사건 진행 변경, 메시지, 서류 요청 등의 알림이 여기에 표시됩니다</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {notifications.map((n: ClientNotification) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) markAsRead(n.id);
                    }}
                    className={`flex gap-3 p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                      !n.isRead ? 'border-brand/20 bg-brand/5' : 'border-slate-100 bg-slate-50/50'
                    }`}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{n.emoji || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-bold truncate ${!n.isRead ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand shrink-0 animate-pulse" />}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-slate-300 mt-1">
                        {(() => {
                          const diff = Date.now() - new Date(n.createdAt).getTime();
                          if (diff < 60000) return '방금 전';
                          if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
                          if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
                          return `${Math.floor(diff / 86400000)}일 전`;
                        })()}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg self-start shrink-0 ${
                      n.type === 'new_message' ? 'bg-blue-50 text-blue-600' :
                      n.type === 'status_change' ? 'bg-emerald-50 text-emerald-600' :
                      n.type === 'document_request' ? 'bg-purple-50 text-purple-600' :
                      n.type === 'fee_reminder' ? 'bg-amber-50 text-amber-600' :
                      n.type === 'notice' ? 'bg-slate-100 text-slate-500' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {n.type === 'new_message' ? '💬 메시지' :
                       n.type === 'status_change' ? '📊 진행' :
                       n.type === 'document_request' ? '📁 서류' :
                       n.type === 'fee_reminder' ? '💰 수임료' :
                       n.type === 'notice' ? '📢 공지' : '🔔 알림'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ 탭 2: 채무 진단 & 법원 서류 제출 ═══ */}
      {mypageTab === 'diagnosis' && (
        <div className="space-y-6 animate-fadeIn">
          {/* 💡 변호사 맞춤 제안서 도착 안내 배너 (내 관리방 유도 - 중복 카드 완전 제거) */}
          {allProposals.length > 0 && (
            <div className="bg-gradient-to-r from-slate-900 via-[#1E3A5F] to-slate-900 border border-blue-500/40 rounded-2xl p-4 md:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-amber-300 shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm md:text-base text-white">변호사 맞춤 제안서 & 정밀 진단 리포트 도착</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-xs font-bold border border-blue-400/30">
                      {allProposals.length}건
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    변호사 제안서 비교, 7p 법률의견서 열람 및 1:1 비밀 상담은 <strong>내 관리방</strong>에서 진행하실 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToChat(allProposals[0]?.req?.id)}
                className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-[0.98] shrink-0"
              >
                <MessageSquare className="w-4 h-4" />
                <span>내 관리방에서 확인 & 상담하기</span>
                <ChevronRight className="w-4 h-4 text-white/70" />
              </button>
            </div>
          )}

          {!profile ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 mx-auto bg-brand/10 rounded-full flex items-center justify-center text-brand">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">아직 자가진단 분석 기록이 없습니다</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              1분 만에 나의 채무를 정리하고 탕감 가능성을 시뮬레이션해 보세요.
            </p>
            <button
              type="button"
              onClick={onStartDiagnosis}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>1분 채무상황 체크하기</span>
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-fadeIn">
            {/* ════ [!isCompact 모드] 마이페이지 본연의 3대 자산·서류 보관함 ════ */}
            {!isCompact && (() => {
              // CRM 데이터 읽기 (변호사 CRM과 동일 localStorage 공유)
              const getCrmData = () => {
                try { return JSON.parse(localStorage.getItem('legal_crm_data') || '{}'); } catch { return {}; }
              };
              const reqId = activeRequest?.id || requests[0]?.id;
              const crmExt = reqId ? (getCrmData()[reqId] || null) : null;
              const currentStatus: CrmStatus = crmExt?.crmStatus || 'requested';
              const feeSchedule: FeeInstallment[] = Array.isArray(crmExt?.feeSchedule) ? crmExt.feeSchedule : [];
              const totalFee: number = crmExt?.totalFee || 0;
              const checklist: DocumentCheckItem[] = Array.isArray(crmExt?.documents) ? crmExt.documents : [];
              const uploadedFiles: DocumentFile[] = Array.isArray(crmExt?.uploadedFiles) ? crmExt.uploadedFiles : [];
              const docRequests: DocumentRequest[] = Array.isArray(crmExt?.documentRequests) ? crmExt.documentRequests : [];
              const totalPaid = feeSchedule
                .filter((f: FeeInstallment) => f && f.status === 'paid')
                .reduce((s: number, f: FeeInstallment) => s + (f.amount || 0), 0);

              const handleFileUpload = async (files: FileList | null, linkedDocId?: string) => {
                if (!files || files.length === 0 || !reqId) return;
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  const reader = new FileReader();
                  reader.onload = async (e) => {
                    const dataUrl = e.target?.result as string;
                    const fileObj = {
                      name: file.name,
                      category: 'other',
                      uploadedAt: new Date().toISOString(),
                      fileSize: file.size,
                      mimeType: file.type,
                      dataUrl,
                      uploadSource: 'client',
                      linkedDocId
                    };
                    await submitClientDocument(reqId, fileObj as any, linkedDocId);
                    setRefreshTick(c => c + 1);
                  };
                  reader.readAsDataURL(file);
                }
                toast.success(`${files.length}개 파일이 제출되었습니다`);
              };

              const submittedCount = checklist.filter(d => ['submitted', 'approved', 'under_review', 'resubmitted'].includes(d.reviewStatus || '')).length;

              // 진행 단계 정의 (cancelled 제외)
              const PROGRESS_STEPS: CrmStatus[] = ['requested', 'consulting', 'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];
              const currentIdx = PROGRESS_STEPS.indexOf(currentStatus);

              return (
                <div className="space-y-8">
                  {/* ── Pillar 1: 나의 가계 재정 & 채무 진단서 원안 (My Financial Blueprint) ── */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                    {/* 헤더 & 컨트롤 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-150 dark:border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-brand/10 text-brand">
                            <Scale className="w-5 h-5" />
                          </span>
                          <h3 className="font-black text-lg md:text-xl text-slate-900 dark:text-white">
                            나의 가계 재정 & 채무 진단서 원안
                          </h3>
                          <span className="text-[11px] bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                            자가진단 원본
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          자가진단 시 입력한 재정·채무 데이터 원본입니다. 변호사가 사건을 검토하는 기준이 되며 언제든지 수정할 수 있습니다.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>진단서 인쇄/PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingBlueprint(prev => !prev)}
                          className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-[0.98]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{isEditingBlueprint ? '수정창 닫기' : '상세 항목 수정하기'}</span>
                          {isEditingBlueprint ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* 4대 주요 지표 카드 */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">총 채무액 (원금)</span>
                        <p className="text-base md:text-xl font-black text-slate-900 dark:text-white mt-1">
                          {formatCurrency(totalDebtValue)}
                        </p>
                        <span className="text-[10px] text-slate-400 block mt-0.5">금융권 원금 합산</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">예상 탕감액</span>
                          {activeResult && activeResult.debtReductionRate > 0 && (
                            <span className="text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                              {activeResult.debtReductionRate}% 감면
                            </span>
                          )}
                        </div>
                        <p className="text-base md:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                          {activeResult ? formatCurrency(activeResult.totalDebtReduction) : '-'}
                        </p>
                        <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 block mt-0.5">원금 탕감 가능액</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/20">
                        <span className="text-[11px] font-bold text-brand dark:text-brand-light block">예상 월 변제금</span>
                        <p className="text-base md:text-xl font-black text-brand dark:text-brand-light mt-1">
                          {activeResult ? formatCurrency(activeResult.monthlyPayment) : '-'}
                        </p>
                        <span className="text-[10px] text-brand/70 block mt-0.5">36개월 기준 산정</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                        <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 block">법정 인정 생계비</span>
                        <p className="text-base md:text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
                          {activeResult ? formatCurrency(activeResult.recognizedLivingCost) : '-'}
                        </p>
                        <span className="text-[10px] text-purple-600/70 dark:text-purple-400/70 block mt-0.5">
                          {(profile?.dependents || 0) + 1}인 가구 기준
                        </span>
                      </div>
                    </div>

                    {/* 가계 재정 & 채무 세부 명세 요약표 */}
                    <div className="bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-4 md:p-5 border border-slate-150 dark:border-slate-800 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-500" />
                          가계 재정 및 채무 세부 명세 요약
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">단위: 만 원</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800/80">
                          <span className="text-[11px] text-slate-400 block">월 평균 소득</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                            {(profile?.monthlyIncome || 0).toLocaleString()}만원
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {profile?.incomeType === 'salary' ? '근로소득자' : profile?.incomeType === 'business' ? '사업소득자' : profile?.incomeType === 'freelancer' ? '프리랜서' : '기타'}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800/80">
                          <span className="text-[11px] text-slate-400 block">부양가족 / 가구원</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                            {(profile?.dependents || 0) + 1}인 가구
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            본인 외 부양 {profile?.dependents || 0}명
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800/80">
                          <span className="text-[11px] text-slate-400 block">주거형태 / 보증금</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                            {profile?.housingType === 'rent' ? '월세' : profile?.housingType === 'jeonse' ? '전세' : profile?.housingType === 'owned' ? '자가' : '무상거주'}
                            {profile?.rentalDeposit ? ` (${profile.rentalDeposit.toLocaleString()}만)` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            월세 {profile?.rentCost ? `${profile.rentCost.toLocaleString()}만원` : '0원'}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-150 dark:border-slate-800/80">
                          <span className="text-[11px] text-slate-400 block">재산 총액 (청산가치)</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                            {activeResult ? formatCurrency(activeResult.liquidationValue) : `${(profile?.myAssets || 0).toLocaleString()}만원`}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            최우선 변제 공제 반영
                          </span>
                        </div>
                      </div>
                      
                      {/* 금융권별 세부 내역 */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap gap-2 text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400 font-bold self-center">채무 구성:</span>
                        <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          은행 <strong>{(profile?.debtTypes?.banks || 0).toLocaleString()}만</strong>
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          카드/캐피탈 <strong>{(profile?.debtTypes?.cards || 0).toLocaleString()}만</strong>
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          대부/개인 <strong>{(profile?.debtTypes?.personals || 0).toLocaleString()}만</strong>
                        </span>
                        {(profile?.priorityDebt || 0) > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 font-bold">
                            세금 체납 {profile?.priorityDebt?.toLocaleString()}만
                          </span>
                        )}
                        {(profile?.speculativeLoss || 0) > 0 && (
                          <span className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 font-bold">
                            투자손실 {profile?.speculativeLoss?.toLocaleString()}만
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 접이식 상세 수정 폼 */}
                    {isEditingBlueprint && (
                      <div className="pt-4 border-t border-slate-150 dark:border-slate-800 animate-fadeIn">
                        {renderBlueprintEditForm()}
                      </div>
                    )}

                    {/* 의뢰인 전달사항 메모 */}
                    {renderClientNotes()}
                  </div>

                  {/* ── Pillar 2: 내 사건 진행상황 & 법원 제출 필수 서류함 (Document Vault) ── */}
                  <div className="space-y-6">
                    {/* 1. 사건 진행상황 트래커 */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-brand/10 text-brand"><CheckCircle className="w-5 h-5" /></div>
                          내 사건 진행상황
                        </h3>
                        <span className="text-[11px] bg-brand/10 text-brand px-2.5 py-1 rounded-full font-bold">
                          {CRM_STATUS_CONFIG[currentStatus]?.emoji} {CRM_STATUS_CONFIG[currentStatus]?.label}
                        </span>
                      </div>

                      {/* 프로그레스 바 */}
                      <div className="relative">
                        <div className="absolute top-5 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 z-0" />
                        <div className="absolute top-5 left-6 h-0.5 bg-brand z-0 transition-all duration-700" style={{ width: `${currentIdx >= 0 ? (currentIdx / (PROGRESS_STEPS.length - 1)) * (100 - 10) : 0}%` }} />

                        {/* 단계 노드 */}
                        <div className="relative z-10 flex justify-between">
                          {PROGRESS_STEPS.map((step, i) => {
                            const cfg = CRM_STATUS_CONFIG[step];
                            const isDone = i <= currentIdx;
                            const isCurrent = i === currentIdx;
                            return (
                              <div key={step} className="flex flex-col items-center" style={{ width: `${100 / PROGRESS_STEPS.length}%` }}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all duration-500 ${
                                  isCurrent ? 'bg-brand border-brand text-white shadow-md shadow-brand/30 scale-110 animate-pulse' :
                                  isDone ? 'bg-brand/10 border-brand text-brand dark:bg-brand/20' :
                                  'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                                }`}>
                                  {isDone && !isCurrent ? <Check className="w-4 h-4" /> : <span className="text-sm">{cfg.emoji}</span>}
                                </div>
                                <span className={`text-[9px] md:text-[10px] font-bold mt-1.5 text-center leading-tight ${isCurrent ? 'text-brand' : isDone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                                  {cfg.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 현재 단계 안내 메시지 */}
                      <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3">
                        <span className="text-2xl">{CRM_STATUS_CONFIG[currentStatus]?.emoji}</span>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">현재 단계: {CRM_STATUS_CONFIG[currentStatus]?.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {currentStatus === 'requested' && '상담 신청이 접수되었습니다. 변호사 상담 수락을 기다리고 있습니다.'}
                            {currentStatus === 'consulting' && '담당 변호사와 초기 상담이 진행 중입니다. 채팅방에서 문의하세요.'}
                            {currentStatus === 'contracted' && '수임 계약이 완료되었습니다. 필요 서류를 준비해 주세요.'}
                            {currentStatus === 'document' && '서류 수집 중입니다. 아래에서 서류를 업로드하실 수 있습니다.'}
                            {currentStatus === 'filed' && '법원에 신청서가 접수되었습니다. 보정 요청이 있을 수 있습니다.'}
                            {currentStatus === 'commenced' && '법원의 개시결정이 내려졌습니다. 변제 계획에 따라 진행됩니다.'}
                            {currentStatus === 'repaying' && '변제금을 매월 법원에 납부하는 단계입니다.'}
                            {currentStatus === 'discharged' && '🎉 면책 결정이 확정되었습니다! 잔여 채무가 면제됩니다.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. 필수 서류 제출 */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-500 dark:bg-purple-950/40"><FileText className="w-5 h-5" /></div>
                          필수 서류 제출
                        </h3>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full">{submittedCount} / 15 제출 완료</span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(submittedCount / 15) * 100}%` }} />
                      </div>

                      {/* 필수 서류 목록 */}
                      <div className="space-y-3">
                        {checklist.map(item => {
                          const status = item.reviewStatus || 'not_submitted';
                          const config = DOC_REVIEW_STATUS_CONFIG[status] || DOC_REVIEW_STATUS_CONFIG.not_submitted;
                          return (
                            <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${config.bgColor} ${config.color} ${config.borderColor}`}>
                                    {config.emoji} {config.label}
                                  </span>
                                </div>
                                {status === 'rejected' && item.rejectionReason && (
                                  <p className="text-xs text-red-500 mt-1.5 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-100 dark:border-red-900/40">
                                    반려 사유: {item.rejectionReason}
                                  </p>
                                )}
                              </div>
                              
                              {['not_submitted', 'rejected'].includes(status) && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-brand transition-all cursor-pointer active:scale-[0.98]">
                                    <Upload className="w-3.5 h-3.5" />
                                    업로드
                                    <input type="file" className="hidden" accept="image/*,.pdf" multiple onChange={(e) => handleFileUpload(e.target.files, item.id)} />
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 추가 요청 서류 */}
                      {docRequests.length > 0 && (
                        <div className="mt-8 space-y-4">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            변호사 추가 요청 서류
                          </h4>
                          <div className="space-y-3">
                            {docRequests.map(req => (
                              <div key={req.id} className="p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{req.documentLabel}</p>
                                  {req.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{req.description}</p>}
                                </div>
                                {!req.fulfilled ? (
                                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-hover transition-all cursor-pointer active:scale-[0.98] shrink-0 whitespace-nowrap">
                                    <Upload className="w-3.5 h-3.5" />
                                    제출하기
                                    <input type="file" className="hidden" accept="image/*,.pdf" multiple onChange={(e) => handleFileUpload(e.target.files, req.linkedDocId || req.id)} />
                                  </label>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800 px-2.5 py-1 rounded-lg shrink-0">
                                    ✅ 제출완료
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 자율 업로드 영역 */}
                      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">기타 서류 제출</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand hover:bg-brand/5 transition-all cursor-pointer group active:scale-[0.98]">
                            <Upload className="w-5 h-5 text-slate-400 group-hover:text-brand transition-colors" />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-brand">파일 선택</span>
                            <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" multiple onChange={(e) => handleFileUpload(e.target.files)} />
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowScanner(true)}
                            className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all cursor-pointer group active:scale-[0.98]"
                          >
                            <Camera className="w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors" />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-purple-600">서류 스캔</span>
                          </button>
                        </div>
                        {uploadedFiles.length > 0 && (
                          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
                            {uploadedFiles.filter(f => !f.linkedDocId).map((f) => (
                              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                                <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{f.name}</p>
                                  <p className="text-[10px] text-slate-400">{new Date(f.uploadedAt).toLocaleDateString('ko')}</p>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-800 shrink-0">제출됨</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 flex items-start gap-1.5 mt-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>제출된 서류는 담당 변호사가 확인합니다. 민감한 개인정보가 포함된 서류도 암호화되어 안전하게 보호됩니다.</span>
                      </p>

                      {/* MobileScanner 모달 */}
                      <MobileScanner
                        isOpen={showScanner}
                        onClose={() => setShowScanner(false)}
                        onCapture={async (scanned) => {
                          const docFile: DocumentFile = {
                            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            name: scanned.name,
                            category: 'other',
                            uploadedAt: new Date().toISOString(),
                            uploadedBy: '의뢰인',
                            fileSize: scanned.fileSize,
                            mimeType: scanned.mimeType,
                            dataUrl: scanned.dataUrl,
                            uploadSource: 'client',
                            reviewStatus: 'submitted',
                          };
                          await submitClientDocument(reqId!, docFile);
                          setRefreshTick(t => t + 1);
                          toast.success(`${scanned.name} 스캔 제출 완료`);
                        }}
                      />
                    </div>
                  </div>

                  {/* ── Pillar 3: 정식 수임계약서 및 수임료 보관함 (Contract & Fee Vault) ── */}
                  <div className="space-y-6">
                    {/* 공인 전자계약서 카드 */}
                    {clientContract ? (
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-150 dark:border-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-brand/10 text-brand">
                              <FileCheck className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                                정식 수임 전자계약서
                                <span className="text-[11px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">
                                  {clientContract.status === 'signed' ? '✅ 전자서명 체결완료' : '⏳ 서명 진행중'}
                                </span>
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                계약번호: <span className="font-mono">{clientContract.contractNumber || clientContract.id}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  generateCourtSubmissionPdf(clientContract);
                                  toast.success('법원 제출용 정식 계약서 PDF가 다운로드되었습니다.');
                                } catch (err) {
                                  toast.error('PDF 생성 중 오류가 발생했습니다.');
                                }
                              }}
                              className="min-h-[40px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>법원 제출용 일체형 PDF 다운로드</span>
                            </button>
                          </div>
                        </div>

                        {/* 계약 상세 스펙 그리드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
                            <span className="text-[11px] text-slate-400 block">수임 사건명</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                              {clientContract.caseType || clientContract.title || '개인회생 정식 사건'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
                            <span className="text-[11px] text-slate-400 block">담당 변호사</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                              {clientContract.lawyerName ? `${clientContract.lawyerName} 변호사` : '법무법인 로앤 담당변호사'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800">
                            <span className="text-[11px] text-slate-400 block">체결 및 효력 발생일</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">
                              {clientContract.signedAt ? new Date(clientContract.signedAt).toLocaleDateString('ko-KR') : (clientContract.createdAt ? new Date(clientContract.createdAt).toLocaleDateString('ko-KR') : '체결 대기')}
                            </span>
                          </div>
                        </div>

                        {/* 전자서명 진본성 검증 안내 배너 */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-150 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300">
                              전자서명법 제3조에 따라 공인 암호화 해시(SHA-256)가 적용된 법적 효력을 갖는 전자계약서입니다.
                            </span>
                          </div>
                          {clientContract.contractUrl && (
                            <a
                              href={clientContract.contractUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand hover:underline font-bold inline-flex items-center gap-1 shrink-0 text-xs"
                            >
                              <span>계약서 전문 열람</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-250 dark:border-slate-800 rounded-3xl p-6 text-center space-y-2">
                        <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">체결된 정식 수임계약서가 없습니다</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          담당 변호사와 1:1 상담 후 전자계약서가 발송되면 이곳에서 계약서를 열람하고 법원 제출용 PDF를 다운로드하실 수 있습니다.
                        </p>
                      </div>
                    )}

                    {/* 수임료 납부 현황 (읽기 전용) */}
                    {totalFee > 0 && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40"><DollarSign className="w-5 h-5" /></div>
                            수임료 납부 현황
                          </h3>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            totalPaid >= totalFee ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}>
                            {totalPaid >= totalFee ? '✅ 완납' : `${Math.round((totalPaid / totalFee) * 100)}% 납부`}
                          </span>
                        </div>

                        {/* 총액 및 프로그레스 */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">총 수임료</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{totalFee.toLocaleString()}만원</span>
                          </div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${(totalPaid / totalFee) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">납부 완료 {totalPaid.toLocaleString()}만원</span>
                            <span className={`font-bold ${totalFee - totalPaid > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              잔여 {(totalFee - totalPaid).toLocaleString()}만원
                            </span>
                          </div>
                        </div>

                        {/* 로펌 입금 계좌 안내 및 원클릭 복사 */}
                        {(() => {
                          const bankInfo = feeSettings?.bankInfo || { bankName: '신한은행', accountNumber: '110-542-897612', accountHolder: '법무법인 로앤' };
                          const { bankName = '신한은행', accountNumber = '110-542-897612', accountHolder = '법무법인 로앤' } = bankInfo;
                          const fullAccount = `${bankName} ${accountNumber} (${accountHolder})`;
                          return (
                            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 tracking-wide uppercase">입금 지정 계좌</span>
                                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                                  {bankName} <span className="text-emerald-900 dark:text-emerald-300">{accountNumber}</span> <span className="text-xs font-sans text-slate-600 dark:text-slate-400 font-normal">({accountHolder})</span>
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(fullAccount);
                                  toast.success('계좌번호가 클립보드에 복사되었습니다.');
                                }}
                                className="self-start sm:self-center px-3.5 py-2 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1.5"
                              >
                                <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>계좌번호 복사</span>
                              </button>
                            </div>
                          );
                        })()}

                        {/* 분납 스케줄 목록 */}
                        {feeSchedule.length > 0 && (
                          <div className="space-y-2">
                            {feeSchedule.map((inst: FeeInstallment) => {
                              const isPast = new Date(inst.dueDate) < new Date() && inst.status === 'pending';
                              return (
                                <div key={inst.id} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                                  inst.status === 'paid' ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20' :
                                  isPast ? 'border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20' :
                                  'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                }`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                    inst.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                                    isPast ? 'bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400' :
                                    'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                  }`}>
                                    {inst.status === 'paid' ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-600 dark:text-slate-300">{(inst as any).memo || `${inst.round}차`}</span>
                                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{inst.amount.toLocaleString()}만원</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      📅 {inst.dueDate}
                                      {inst.paidDate && <span className="text-emerald-600 dark:text-emerald-400 font-medium"> → {inst.paidDate} 납부완료</span>}
                                      {isPast && <span className="text-red-500 dark:text-red-400 font-bold"> (납부일 경과)</span>}
                                    </p>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                                    inst.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' :
                                    isPast ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300' :
                                    'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                  }`}>
                                    {inst.status === 'paid' ? '✅ 완료' : isPast ? '⚠️ 미납' : '⏳ 예정'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>수임료 납부에 관한 문의는 담당 변호사에게 채팅으로 연락해 주세요.</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ════ [isCompact 모드] 내 관리방 우측 슬라이드 패널 ════ */}
            {isCompact && (
              <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 text-left">
                <div className="border-b border-slate-150 dark:border-slate-800 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Scale className="w-5 h-5 text-brand" />
                      나의 상세 진단 정보 조회 및 수정
                    </h3>
                    <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">
                      내용을 자유롭게 수정해 보세요. 변제금 및 채무조정 지표가 실시간으로 갱신됩니다.
                    </p>
                  </div>
                  <span className="text-[11px] bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded font-bold">
                    단위: 만 원
                  </span>
                </div>

                {/* 0~6번 상세 폼 및 전달사항 메모 */}
                {renderBlueprintEditForm()}
                {renderClientNotes()}
              </div>
            )}
          </div>
        )}
      </div>
      )}

  {/* 프리미엄 제안서 & 7p AI 진단서 모달 */}
  {selectedProposalForReport && (
    <PremiumProposalReportModal
      isOpen={!!selectedProposalForReport}
      onClose={() => setSelectedProposalForReport(null)}
      proposal={selectedProposalForReport}
      clientInfo={activeRequest || requests[0]}
    />
  )}
</div>
  );
}





