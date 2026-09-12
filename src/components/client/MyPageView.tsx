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
import { validateUploadFile } from '../../utils/fileSecurity';
import { applyCourtSubmissionWatermark } from '../../utils/documentWatermark';
import { calculateKoreanAgeInfo, parseFamilyDocument } from '../../services/documents/familyParserService';
import type { FamilyMemberItem } from '../../types/incomeExpenseTypes';
import { LEGALFLOW_REHAB_STAGES, LEGALFLOW_BANKRUPTCY_STAGES } from '../../types';
import CreditorMeetingGuideModal from './companion/CreditorMeetingGuideModal';
const ClientStatementModal = React.lazy(() => import('./statement/ClientStatementModal'));
const ClientPropertyIntakeModal = React.lazy(() => import('./property/ClientPropertyIntakeModal'));

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
  // 법원 진술서 모달 열림 상태
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  // 법원 재산상황표(D5102) 모달 열림 상태
  const [isPropertyIntakeModalOpen, setIsPropertyIntakeModalOpen] = useState(false);
  
  const feeSettings = useMemo(() => loadFeeNotificationSettings(), []);

  // 프리미엄 제안서/7p 리포트 모달 열림 상태
  const [selectedProposalForReport, setSelectedProposalForReport] = useState<any | null>(null);
  // 채권자집회 출석 가이드 모달 상태
  const [isCreditorMeetingModalOpen, setIsCreditorMeetingModalOpen] = useState(false);
  // 별도 면책신청(제624조) 대행 요청 상태
  const [isDischargeRequested, setIsDischargeRequested] = useState(false);
  // 보정 소명자료 업로드 영역 열림 상태
  const [isCorrectionUploadOpen, setIsCorrectionUploadOpen] = useState(false);

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
      ) || null;
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

  // ── 등본/가족관계 서류 자동 파싱 상태 & 핸들러 ──
  const [isParsingClientFamilyDoc, setIsParsingClientFamilyDoc] = useState(false);
  const clientFamilyDocInputRef = React.useRef<HTMLInputElement>(null);

  const handleClientFamilyDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingClientFamilyDoc(true);
    try {
      const result = await parseFamilyDocument(file);
      if (result.ok && result.extractedMembers?.length > 0) {
        const parsedMembers = result.extractedMembers;
        
        // 미성년 자녀 자동 집계
        const minorChildren = parsedMembers.filter(m => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
        const otherDependents = parsedMembers.filter(m => !m.relationship.includes('본인') && !m.relationship.includes('자') && !m.relationship.includes('녀') && m.isEligibleDependent).length;
        
        // 배우자 확인
        const hasSpouse = parsedMembers.some(m => m.relationship.includes('배우자'));
        
        onUpdateFinancialProfile({
          ...profile,
          familyMembers: parsedMembers,
          minorChildren,
          otherDependents,
          dependents: minorChildren + otherDependents,
          maritalStatus: hasSpouse ? 'MARRIED' : (profile?.maritalStatus || 'SINGLE'),
        });
        toast.success(`✨ ${result.docTitle} 자동 인식 완료! 가족 ${parsedMembers.length}명이 반영되고 자녀 나이가 자동 계산되었습니다.`);
      } else {
        toast.error('서류에서 가족 정보를 명확히 인식하지 못했습니다. 수기로 입력해 주세요.');
      }
    } catch (err: any) {
      toast.error('서류 파싱 중 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsParsingClientFamilyDoc(false);
      if (clientFamilyDocInputRef.current) {
        clientFamilyDocInputRef.current.value = '';
      }
    }
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
        {/* 0. 의뢰인 인적사항 및 거주지 / 근무지 관할 법원 설정 */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">0. 의뢰인 기본 인적사항 및 관할 법원 설정</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">의뢰인 성명 / 안심가명</label>
              <input 
                type="text" 
                value={profile.clientName || profile.name || userAlias || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  handleFieldChange('clientName', val);
                  handleFieldChange('name', val);
                  setUserAlias(val);
                }} 
                placeholder="홍길동 또는 안심가명"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">연락처 (휴대폰 번호)</label>
              <input 
                type="tel" 
                value={profile.phone || activeRequest?.phone || ''} 
                onChange={(e) => handleFieldChange('phone', e.target.value)} 
                placeholder="010-0000-0000"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
          </div>

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

        {/* 2. 가족 구성 (매뉴얼 3-5 실무 기준) */}
        <div className="space-y-4 border-t border-slate-100 dark:border-slate-850 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2 flex items-center gap-1.5">
              <span>2. 가족관계 및 부양가족 정밀 산정</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                만 나이 자동계산 & 등본 연동
              </span>
            </h4>

            {/* 등본/가족관계 서류 자동 파싱 버튼 */}
            <div>
              <input
                type="file"
                ref={clientFamilyDocInputRef}
                onChange={handleClientFamilyDocUpload}
                accept="image/*,application/pdf"
                className="hidden"
              />
              <button
                type="button"
                disabled={isParsingClientFamilyDoc}
                onClick={() => clientFamilyDocInputRef.current?.click()}
                className="px-2.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer press-scale shadow-xs disabled:opacity-50"
                title="등본이나 가족관계증명서를 첨부하면 가족 성명, 생년월일, 자녀 나이가 자동 파싱됩니다."
              >
                {isParsingClientFamilyDoc ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>서류 AI 분석 중...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-emerald-200" />
                    <span>📑 등본/가족증명서 자동 파싱</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 1) 혼인 여부 (기혼 / 별거 / 미혼 / 이혼 - 그림 3-6) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-850 space-y-3">
            <div>
              <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                혼인 여부
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '기혼', value: 'MARRIED' },
                  { label: '별거 (기혼)', value: 'MARRIED_SEPARATED' },
                  { label: '미혼', value: 'SINGLE' },
                  { label: '이혼', value: 'DIVORCED' },
                ].map(item => {
                  const currentMarital = profile.isSeparated 
                    ? 'MARRIED_SEPARATED' 
                    : (profile.maritalStatus === 'MARRIED' || profile.maritalStatus === 'married' ? 'MARRIED' : profile.maritalStatus === 'DIVORCED' || profile.maritalStatus === 'divorced' ? 'DIVORCED' : 'SINGLE');
                  const isSelected = currentMarital === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        if (item.value === 'MARRIED_SEPARATED') {
                          handleFieldChange('maritalStatus', 'MARRIED');
                          handleFieldChange('isSeparated', true);
                        } else if (item.value === 'MARRIED') {
                          handleFieldChange('maritalStatus', 'MARRIED');
                          handleFieldChange('isSeparated', false);
                        } else {
                          handleFieldChange('maritalStatus', item.value);
                          handleFieldChange('isSeparated', false);
                        }
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-brand border-brand text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 기혼인 경우: 배우자 경제활동 여부 및 월평균 순수입액 */}
            {(profile.maritalStatus === 'MARRIED' || profile.maritalStatus === 'married') && (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">배우자 경제활동 여부</span>
                    <span className="text-[11px] text-slate-500">배우자가 소득 활동을 하고 있다면 토글을 켜주세요.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0);
                      handleFieldChange('spouseIsWorking', !current);
                      if (current) {
                        handleFieldChange('spouseIncome', 0);
                      } else if (!profile.spouseIncome) {
                        handleFieldChange('spouseIncome', 200);
                      }
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      (profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0)) ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      (profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0)) ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {(profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">배우자 월평균 순수입액 (만 원)</label>
                      <input
                        type="number"
                        value={profile.spouseIncome || 0}
                        onChange={e => handleFieldChange('spouseIncome', Math.max(0, Number(e.target.value)))}
                        placeholder="예: 250"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">배우자 소유 재산액 (만 원)</label>
                      <input
                        type="number"
                        value={profile.spouseAsset || 0}
                        onChange={e => handleFieldChange('spouseAsset', Math.max(0, Number(e.target.value)))}
                        placeholder="예: 1000"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 이혼인 경우 양육비 수령/지급 */}
            {(profile.maritalStatus === 'DIVORCED' || profile.maritalStatus === 'divorced') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 mt-2">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">월 양육비 수령액 (만 원)</label>
                  <input
                    type="number"
                    value={profile.childSupportReceived || 0}
                    onChange={e => handleFieldChange('childSupportReceived', Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">월 양육비 지급액 (만 원)</label>
                  <input
                    type="number"
                    value={profile.childSupportPaid || 0}
                    onChange={e => handleFieldChange('childSupportPaid', Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 text-xs font-bold focus:ring-1 focus:ring-brand"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2) 미성년 자녀 수 (동거 / 비동거 스텝퍼 - 그림 3-6) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-850 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 동거 중인 미성년 자녀 수 */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">동거 중인 미성년 자녀 수</span>
                  <span className="text-[10.5px] text-slate-400">부양가족 100% 반영 대상</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, (profile.minorChildren || 0) - 1);
                      handleFieldChange('minorChildren', cur);
                      handleFieldChange('dependents', cur + (profile.otherDependents || 0));
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold text-sm text-brand">{profile.minorChildren || 0}명</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = (profile.minorChildren || 0) + 1;
                      handleFieldChange('minorChildren', cur);
                      handleFieldChange('dependents', cur + (profile.otherDependents || 0));
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 비동거 중인 미성년 자녀 수 */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">비동거 중인 미성년 자녀 수</span>
                  <span className="text-[10.5px] text-slate-400">이혼 양육권 분리 자녀 등</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, (profile.nonCohabitingMinorChildren || 0) - 1);
                      handleFieldChange('nonCohabitingMinorChildren', cur);
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-bold text-sm text-slate-700 dark:text-slate-200">{profile.nonCohabitingMinorChildren || 0}명</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = (profile.nonCohabitingMinorChildren || 0) + 1;
                      handleFieldChange('nonCohabitingMinorChildren', cur);
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3) 동거여부 토글 버튼군 (부, 모, 배우자, 부모 부양여부 - 그림 3-7) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-850 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">동거 및 부양 여부</span>
              <span className="text-[10.5px] text-slate-500">실질 동거 및 부양 시 활성화</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'cohabitingFather', label: '부 (아버지)', desc: '동거 중' },
                { key: 'cohabitingMother', label: '모 (어머니)', desc: '동거 중' },
                { key: 'cohabitingSpouse', label: '배우자', desc: '동거 중' },
                { key: 'supportParents', label: '부모 부양', desc: '실질 부양 인정' },
              ].map(toggleItem => {
                const isChecked = !!(profile as any)[toggleItem.key];
                return (
                  <button
                    key={toggleItem.key}
                    type="button"
                    onClick={() => {
                      handleFieldChange(toggleItem.key, !isChecked);
                      if (toggleItem.key === 'supportParents') {
                        const add = !isChecked ? 1 : 0;
                        handleFieldChange('otherDependents', add);
                        handleFieldChange('dependents', (profile.minorChildren || 0) + add);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850'
                    }`}
                  >
                    <span className="block text-xs font-bold">{toggleItem.label}</span>
                    <span className="text-[10px] opacity-80">{isChecked ? '✓ 체크됨' : toggleItem.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4) 개별 가족 구성원 리스트 (자녀 생년월일 & 만 나이 자동계산) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-850 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  가족 구성원 명세 (자녀 생년월일 & 만 나이)
                </span>
                <span className="text-[10.5px] text-slate-500">
                  생년월일을 입력하면 미성년자 나이가 자동으로 계산되어 부양가족에 산정됩니다.
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const currentList = profile.familyMembers || [];
                  const newM: FamilyMemberItem = {
                    id: `client_fam_${Date.now()}`,
                    relationship: '자',
                    name: `자녀 ${currentList.length + 1}`,
                    birthDate: '2016.03.15',
                    cohabitationStatus: '동거',
                    cohabitationPeriod: '출생시부터',
                    isSupportedByDebtor: true,
                    hasIncome: false,
                    jobAndIncomeDetail: '학생 / 미성년자',
                    isEligibleDependent: true,
                  };
                  const updated = [...currentList, newM];
                  handleFieldChange('familyMembers', updated);
                  // 미성년 자녀 수 자동 카운트 갱신
                  const minorCount = updated.filter((m: any) => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
                  handleFieldChange('minorChildren', minorCount);
                  handleFieldChange('dependents', minorCount + (profile.otherDependents || 0));
                }}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer press-scale shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>가족 추가</span>
              </button>
            </div>

            {/* 구성원 카드 리스트 */}
            <div className="space-y-2">
              {(!profile.familyMembers || profile.familyMembers.length === 0) ? (
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-500">
                  등록된 가족 구성원이 없습니다. 상단의 <strong>[📑 등본/가족증명서 자동 파싱]</strong> 버튼이나 <strong>[+ 가족 추가]</strong>를 눌러주세요.
                </div>
              ) : (
                profile.familyMembers.map((member: FamilyMemberItem, idx: number) => {
                  const ageInfo = calculateKoreanAgeInfo(member.birthDate);
                  return (
                    <div key={member.id || idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <input
                          type="text"
                          value={member.relationship}
                          onChange={e => {
                            const val = e.target.value;
                            const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? { ...m, relationship: val } : m);
                            handleFieldChange('familyMembers', updated);
                          }}
                          className="w-14 p-1.5 border border-slate-200 dark:border-slate-800 rounded text-center font-bold bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          placeholder="관계"
                        />
                        <input
                          type="text"
                          value={member.name}
                          onChange={e => {
                            const val = e.target.value;
                            const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? { ...m, name: val } : m);
                            handleFieldChange('familyMembers', updated);
                          }}
                          className="w-20 p-1.5 border border-slate-200 dark:border-slate-800 rounded font-medium bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                          placeholder="성명"
                        />
                      </div>

                      {/* 생년월일 & 만 나이 */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={member.birthDate}
                          placeholder="YYYY.MM.DD"
                          onChange={e => {
                            const val = e.target.value;
                            const newAge = calculateKoreanAgeInfo(val);
                            const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? {
                              ...m,
                              birthDate: val,
                              parsedAge: newAge.fullAge,
                              isMinor: newAge.isMinor,
                              isEligibleDependent: newAge.defaultEligibleDependent
                            } : m);
                            handleFieldChange('familyMembers', updated);

                            // 미성년 자녀 수 자동 재집계
                            const minorCount = updated.filter((m: any) => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
                            handleFieldChange('minorChildren', minorCount);
                            handleFieldChange('dependents', minorCount + (profile.otherDependents || 0));
                          }}
                          className="w-28 p-1.5 border border-slate-200 dark:border-slate-800 rounded font-mono text-center font-bold bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        />
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ageInfo.badgeColorClass}`}>
                          {ageInfo.badgeText}
                        </span>
                      </div>

                      {/* 동거 여부 및 삭제 */}
                      <div className="flex items-center gap-2">
                        <select
                          value={member.cohabitationStatus}
                          onChange={e => {
                            const val = e.target.value as any;
                            const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? { ...m, cohabitationStatus: val } : m);
                            handleFieldChange('familyMembers', updated);
                          }}
                          className="p-1.5 border border-slate-200 dark:border-slate-850 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs"
                        >
                          <option value="동거">동거</option>
                          <option value="별거">별거</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = profile.familyMembers!.filter((_: any, i: number) => i !== idx);
                            handleFieldChange('familyMembers', updated);
                            const minorCount = updated.filter((m: any) => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
                            handleFieldChange('minorChildren', minorCount);
                            handleFieldChange('dependents', minorCount + (profile.otherDependents || 0));
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 5) 추가생계비 및 추가지출 사유 (그림 3-8 완벽 구현) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-850 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  추가생계비 및 추가지출 사유 신청
                </span>
                <span className="text-[10.5px] text-slate-500">
                  기준중위소득 60%를 초과하는 필수 주거비, 의료비, 교육비 등 추가 공제를 신청합니다.
                </span>
              </div>

              {/* 5대 항목 추가 버튼군 (그림 3-8) */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { category: 'living' as const, label: '+생계비' },
                  { category: 'housing' as const, label: '+주거비' },
                  { category: 'medical' as const, label: '+의료비' },
                  { category: 'education' as const, label: '+교육비' },
                  { category: 'other' as const, label: '+기타' },
                ].map(btn => (
                  <button
                    key={btn.category}
                    type="button"
                    onClick={() => {
                      const currentList = profile.extraExpensesList || [];
                      const categoryName = btn.category === 'living' ? '생계비' :
                                           btn.category === 'housing' ? '주거비' :
                                           btn.category === 'medical' ? '의료비' :
                                           btn.category === 'education' ? '교육비' : '기타';
                      const newItem = {
                        id: `extra_${Date.now()}_${btn.category}`,
                        category: btn.category,
                        categoryLabel: categoryName,
                        amount: 30, // 기본 30만원
                        reason: ''
                      };
                      handleFieldChange('extraExpensesList', [...currentList, newItem]);
                    }}
                    className="px-2 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-lg cursor-pointer press-scale"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 추가생계비 행 리스트 */}
            <div className="space-y-2">
              {(!profile.extraExpensesList || profile.extraExpensesList.length === 0) ? (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-[11px] text-slate-400">
                  추가생계비 신청 항목이 없습니다. 기준 생계비 외에 지속 지출되는 비용이 있다면 위의 <strong>[+주거비], [+의료비]</strong> 등을 클릭해 등록하세요.
                </div>
              ) : (
                profile.extraExpensesList.map((item, index) => (
                  <div key={item.id || index} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = profile.extraExpensesList!.filter((_, i) => i !== index);
                        handleFieldChange('extraExpensesList', updated);
                      }}
                      className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center font-bold cursor-pointer shrink-0"
                      title="항목 삭제"
                    >
                      -
                    </button>

                    <span className="w-16 px-2 py-1 bg-slate-100 dark:bg-slate-800 font-bold text-center rounded text-slate-700 dark:text-slate-300 shrink-0">
                      {item.categoryLabel}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] text-slate-500 font-medium">추가 생계비:</span>
                      <input
                        type="number"
                        value={item.amount || 0}
                        onChange={e => {
                          const val = Math.max(0, Number(e.target.value));
                          const updated = profile.extraExpensesList!.map((x, i) => i === index ? { ...x, amount: val } : x);
                          handleFieldChange('extraExpensesList', updated);
                        }}
                        className="w-20 p-1.5 border border-slate-200 dark:border-slate-800 rounded font-bold text-right bg-slate-50 dark:bg-slate-950"
                      />
                      <span className="text-slate-600 font-bold">만 원</span>
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <input
                        type="text"
                        value={item.reason || ''}
                        placeholder="추가지출 사유 (예: 월세 기준주거비 초과분, 만성질환 정기 약제비 등)"
                        onChange={e => {
                          const val = e.target.value;
                          const updated = profile.extraExpensesList!.map((x, i) => i === index ? { ...x, reason: val } : x);
                          handleFieldChange('extraExpensesList', updated);
                        }}
                        className="w-full p-1.5 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950 text-xs"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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

  // ══════════════════════════════════════════════════════════════════════
  // [isCompact 모드] 내 관리방 우측 슬라이드 패널 전용 뷰
  // (완주동행, 서류함 등 다른 정보 없이, 내상황체크 개인정보 & 현황 채무만 집중 표시)
  // ══════════════════════════════════════════════════════════════════════
  if (isCompact) {
    if (!profile) {
      return (
        <div className="p-8 text-center space-y-4 animate-fadeIn text-left">
          <div className="w-14 h-14 mx-auto bg-brand/10 rounded-full flex items-center justify-center text-brand">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white text-center">아직 자가진단 기록이 없습니다</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed text-center">
            내 상황 체크하기를 먼저 진행해 주시면 채무 및 인적사항을 바로 확인하고 수정하실 수 있습니다.
          </p>
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onStartDiagnosis}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>1분 채무상황 체크하기</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 md:p-6 space-y-6 text-left animate-fadeIn">
        {/* 상단 안내 배너 */}
        <div className="bg-gradient-to-r from-brand/10 via-indigo-50/50 to-purple-50/40 dark:from-slate-800 dark:to-slate-850 p-4 rounded-2xl border border-brand/20">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand shrink-0" />
            <h3 className="font-black text-sm md:text-base text-slate-900 dark:text-white">
              내 상황체크 자가진단 원안 & 채무 현황
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            자가진단 시 입력했던 인적사항과 가계 재정, 채무 내역입니다. 수정하시면 상단의 변제율 및 변호사 검토 데이터가 실시간으로 재계산됩니다.
          </p>
        </div>

        {/* 4대 주요 지표 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">총 채무액 (원금)</span>
            <p className="text-base md:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {formatCurrency(totalDebtValue)}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">예상 탕감액</span>
            <p className="text-base md:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {activeResult ? formatCurrency(activeResult.totalDebtReduction) : '-'}
              {activeResult && activeResult.debtReductionRate > 0 && (
                <span className="text-xs font-bold text-emerald-600 ml-1">({activeResult.debtReductionRate}%)</span>
              )}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/20">
            <span className="text-[11px] font-bold text-brand dark:text-brand-light block">예상 월 변제금</span>
            <p className="text-base md:text-lg font-black text-brand dark:text-brand-light mt-0.5">
              {activeResult ? formatCurrency(activeResult.monthlyPayment) : '-'}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40">
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 block">인정 생계비</span>
            <p className="text-base md:text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
              {activeResult ? formatCurrency(activeResult.recognizedLivingCost) : '-'}
            </p>
          </div>
        </div>

        {/* 0~6번 상세 폼 (누락 없이 전부 편집 가능) */}
        {renderBlueprintEditForm()}

        {/* 7번 의뢰인 특이사항 및 전달 메모 */}
        {renderClientNotes()}

        {/* 하단 저장 & 닫기 액션 */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5 flex items-center justify-between gap-3 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-2 z-10">
          <button
            type="button"
            onClick={() => onNavigateToChat()}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => {
              confetti({
                particleCount: 90,
                spread: 70,
                origin: { y: 0.8 },
                colors: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b']
              });
              toast.success('진단 정보가 실시간 저장되었습니다!', {
                description: '상단의 예상 변제금과 채무조정 지표가 갱신되었습니다.',
                duration: 3500,
              });
            }}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-xs md:text-sm font-extrabold shadow-md hover:shadow-brand-sm transition-all cursor-pointer active:scale-[0.98]"
          >
            <Save className="w-4 h-4" />
            진단서 수정 저장 완료
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn text-left">

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
      {!isCompact && mypageTab === 'companion' && (
        <RehabCompanionView
          userAlias={userAlias}
          clientId={activeRequest?.id || requests[0]?.id}
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
                let validCount = 0;
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  const validation = validateUploadFile(file);
                  if (!validation.isValid) {
                    toast.error(`[${file.name}] ${validation.error}`);
                    continue;
                  }
                  validCount++;
                  const reader = new FileReader();
                  reader.onload = async (e) => {
                    let dataUrl = e.target?.result as string;
                    let fileSize = file.size;
                    let mimeType = file.type;

                    // 신분증/인감 등 이미지 서류인 경우 법원 제출용 비가역 반투명 워터마크 자동 합성 (주민번호 13자리 온전 보존)
                    if (file.type.startsWith('image/')) {
                      try {
                        const watermarked = await applyCourtSubmissionWatermark(dataUrl, {
                          clientName: userAlias || activeRequest?.name || '신청인',
                          requestId: reqId,
                          isIdCardOrSeal: true
                        });
                        dataUrl = watermarked.dataUrl;
                        fileSize = watermarked.fileSize;
                        mimeType = watermarked.mimeType;
                      } catch (wmErr) {
                        console.warn('[Watermark Synthesis Error]', wmErr);
                      }
                    }

                    const fileObj = {
                      name: file.name,
                      category: 'other',
                      uploadedAt: new Date().toISOString(),
                      fileSize,
                      mimeType,
                      dataUrl,
                      uploadSource: 'client',
                      linkedDocId
                    };
                    await submitClientDocument(reqId, fileObj as any, linkedDocId);
                    setRefreshTick(c => c + 1);
                  };
                  reader.readAsDataURL(file);
                }
                if (validCount > 0) {
                  toast.success(`${validCount}개 파일이 안전하게 제출되었습니다`);
                }
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
                            {(profile?.monthlyIncome || profile?.income || 0).toLocaleString()}만원
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {(profile?.incomeType || profile?.employmentType || profile?.jobType) === 'salary' || (profile?.jobType === 'SALARIED') ? '근로소득자' : (profile?.incomeType || profile?.employmentType || profile?.jobType) === 'business' || (profile?.jobType === 'BUSINESS') ? '사업소득자' : (profile?.incomeType || profile?.employmentType || profile?.jobType) === 'freelancer' || (profile?.jobType === 'FREELANCER') ? '프리랜서' : '소득자'}
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
                    {/* 1. 사건 진행상황 트래커 (13단계 파이프라인 & 5대 실무 안심 허브) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
                      {(() => {
                        const thirteenStage = crmExt?.thirteenStage;
                        const isBk = activeRequest?.caseType === 'bankruptcy' || activeRequest?.category === 'individual_bankruptcy';
                        const thirteenStages = isBk ? LEGALFLOW_BANKRUPTCY_STAGES : LEGALFLOW_REHAB_STAGES;
                        const currentThirteenIdx = thirteenStage ? thirteenStages.findIndex(s => s.id === thirteenStage) : -1;
                        const currentThirteenConfig = currentThirteenIdx >= 0 ? thirteenStages[currentThirteenIdx] : null;

                        return (
                          <div className="space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-brand/10 text-brand"><CheckCircle className="w-5 h-5" /></div>
                                내 사건 진행상황
                                {currentThirteenConfig && (
                                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                                    {currentThirteenIdx + 1}/13단계: {currentThirteenConfig.label}
                                  </span>
                                )}
                              </h3>
                              <span className="text-[11px] bg-brand/10 text-brand px-2.5 py-1 rounded-full font-bold self-start sm:self-auto">
                                {CRM_STATUS_CONFIG[currentStatus]?.emoji} {CRM_STATUS_CONFIG[currentStatus]?.label}
                              </span>
                            </div>

                            {/* 프로그레스 바 (13단계 정밀 진행 바) */}
                            <div className="relative pt-2 pb-1">
                              <div className="absolute top-7 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 z-0" />
                              <div 
                                className="absolute top-7 left-6 h-0.5 bg-brand z-0 transition-all duration-700" 
                                style={{ 
                                  width: currentThirteenIdx >= 0 
                                    ? `${(currentThirteenIdx / (thirteenStages.length - 1)) * 90}%` 
                                    : `${currentIdx >= 0 ? (currentIdx / (PROGRESS_STEPS.length - 1)) * 90 : 0}%` 
                                }} 
                              />

                              {/* 단계 노드 (주요 마일스톤) */}
                              <div className="relative z-10 flex justify-between overflow-x-auto no-scrollbar py-1">
                                {PROGRESS_STEPS.map((step, i) => {
                                  const cfg = CRM_STATUS_CONFIG[step];
                                  const isDone = i <= currentIdx;
                                  const isCurrent = i === currentIdx;
                                  return (
                                    <div key={step} className="flex flex-col items-center shrink-0 min-w-[52px]" style={{ width: `${100 / PROGRESS_STEPS.length}%` }}>
                                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base border-2 transition-all duration-500 ${
                                        isCurrent ? 'bg-brand border-brand text-white shadow-md shadow-brand/30 scale-110 animate-pulse' :
                                        isDone ? 'bg-brand/10 border-brand text-brand dark:bg-brand/20' :
                                        'bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                                      }`}>
                                        {isDone && !isCurrent ? <Check className="w-4 h-4" /> : <span className="text-xs">{cfg.emoji}</span>}
                                      </div>
                                      <span className={`text-[9px] md:text-[10px] font-bold mt-1.5 text-center leading-tight ${isCurrent ? 'text-brand' : isDone ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                                        {cfg.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* 현재 단계 상세 안내 메시지 */}
                            <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3">
                              <span className="text-2xl mt-0.5">
                                {currentThirteenConfig ? '⚖️' : CRM_STATUS_CONFIG[currentStatus]?.emoji}
                              </span>
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                  현재 심리 상태: {currentThirteenConfig ? `${currentThirteenConfig.label} (${currentThirteenIdx + 1}/13단계)` : CRM_STATUS_CONFIG[currentStatus]?.label}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                  {thirteenStage === 'consult_waiting' && '상담 신청이 접수되었습니다. 도산전문 변호사가 배정되어 사건 검토를 준비 중입니다.'}
                                  {thirteenStage === 'consult_completed' && '담당 변호사와 1:1 상담이 완료되었습니다. 맞춤 채무조정 계획을 확인해 주세요.'}
                                  {thirteenStage === 'contract_done' && '정식 수임계약이 완료되었습니다. 관공서 필수 서류 및 AI 음성 진술서를 준비해 주세요.'}
                                  {thirteenStage === 'doc_prep' && '법원 제출 필수 서류를 수집 중입니다. 아래 서류함에서 파일을 안전하게 업로드해 주세요.'}
                                  {thirteenStage === 'petition_drafting' && '담당 변호사팀이 8대 서식과 변제계획안, 채권자목록을 정밀하게 작성 중입니다.'}
                                  {thirteenStage === 'petition_submitted' && '회생법원에 개시신청서가 정식 접수되었습니다. 사건번호가 부여되어 심리가 시작되었습니다.'}
                                  {thirteenStage === 'prohibition_order' && '🎉 법원의 금지명령이 인용되었습니다! 모든 채권자의 빚 독촉과 압류가 법적으로 전면 금지됩니다.'}
                                  {thirteenStage === 'correction_period' && '⚠️ 법원 회생위원의 보정권고가 도착했습니다. 아래 보정 창구에서 요청 소명자료를 업로드해 주세요.'}
                                  {thirteenStage === 'commencement' && '🔍 법원의 개인회생 개시결정이 내려졌습니다! 법원 가상계좌로 인가 전 변제금 적립이 시작됩니다.'}
                                  {thirteenStage === 'creditor_meeting' && '🏛️ 법원 출석 채권자집회 기일이 지정되었습니다. 아래 채권자집회 가이드를 반드시 확인해 주세요.'}
                                  {thirteenStage === 'confirmation' && '🎉 변제계획 인가결정이 최종 확정되었습니다! 이제 변제금을 성실히 납부하시면 면책을 받으실 수 있습니다.'}
                                  {thirteenStage === 'completed' && '🎉 36개월 성실 변제가 완주되었습니다! 법원에 별도 면책신청서를 제출하여 최종 면책 결정을 받으세요.'}
                                  {!thirteenStage && (
                                    currentStatus === 'requested' ? '상담 신청이 접수되었습니다. 변호사 상담 수락을 기다리고 있습니다.' :
                                    currentStatus === 'consulting' ? '담당 변호사와 초기 상담이 진행 중입니다. 채팅방에서 문의하세요.' :
                                    currentStatus === 'contracted' ? '수임 계약이 완료되었습니다. 필요 서류를 준비해 주세요.' :
                                    currentStatus === 'document' ? '서류 수집 중입니다. 아래에서 서류를 업로드하실 수 있습니다.' :
                                    currentStatus === 'filed' ? '법원에 신청서가 접수되었습니다. 보정 요청이 있을 수 있습니다.' :
                                    currentStatus === 'commenced' ? '법원의 개시결정이 내려졌습니다. 변제 계획에 따라 진행됩니다.' :
                                    currentStatus === 'repaying' ? '변제금을 매월 법원에 납부하는 단계입니다.' :
                                    '🎉 면책 결정이 확정되었습니다! 잔여 채무가 면제됩니다.'
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ═══ [기능 3] 금지명령 인용 안심 축하 & 1초 독촉방어 문자 복사 카드 ═══ */}
                      {(crmExt?.thirteenStage === 'prohibition_order' || crmExt?.courtCase?.caseNumber || currentStatus === 'filed') && (
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 border border-emerald-500/40 text-white shadow-lg space-y-3.5 animate-fadeIn">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-xl shrink-0">
                                🛡️
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-sm md:text-base text-white">
                                    법원 금지명령 인용 (채권자 독촉·압류 전면 금지)
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950">
                                    법적 효력 발생
                                  </span>
                                </div>
                                <p className="text-xs text-emerald-200 mt-0.5">
                                  {crmExt?.courtCase?.courtName || '서울회생법원'} · 사건번호: <span className="font-mono font-bold text-white">{crmExt?.courtCase?.caseNumber || '2026개회108492'}</span>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const court = crmExt?.courtCase?.courtName || '서울회생법원';
                                const cNo = crmExt?.courtCase?.caseNumber || '2026개회108492';
                                const msg = `[개인회생 금지명령 송달 안내]\n본인은 ${court}에 개인회생(사건번호: ${cNo})을 정식 접수하여 법원으로부터 금지명령을 송달받았습니다.\n채무자회생법 제593조에 따라 일체의 변제요구, 전화/방문 추심 및 급여·통장 압류가 법적으로 전면 금지됩니다.\n모든 문의는 본인의 법률대리인(법무법인 로앤)으로 연락 바랍니다.`;
                                navigator.clipboard.writeText(msg);
                                toast.success('1초 독촉방어 문자가 클립보드에 복사되었습니다! 채권자 전화/문자에 바로 전송하세요.');
                              }}
                              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale shrink-0"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-950" />
                              <span>1초 독촉방어 문자 복사</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-emerald-100/80 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-emerald-500/20">
                            💡 채권추심원으로부터 독촉 전화나 문자가 오면 위 <strong>[1초 독촉방어 문자 복사]</strong> 버튼을 눌러 문자메시지로 그대로 전송하세요. 채무자회생법 제593조 위반 시 채권자에게 과태료가 부과되므로 즉시 추심이 중단됩니다.
                          </p>
                        </div>
                      )}

                      {/* ═══ [기능 2] 법원 보정권고 (14일 기한) 긴급 소명자료 협업 창구 ═══ */}
                      {(crmExt?.thirteenStage === 'correction_period' || (crmExt?.correctionOrders && crmExt.correctionOrders.length > 0)) && (
                        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 space-y-4 animate-fadeIn">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-sm md:text-base text-amber-950 dark:text-amber-200">
                                    법원 회생위원 보정권고 심리 진행중
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                                    제출 기한: D-10
                                  </span>
                                </div>
                                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                                  회생위원이 제출 서류에 대한 구체적 소명(최근 1년 대출금 사용처, 100만원 이상 통장 거래내역, 카드사용내역 등)을 요청했습니다.
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsCorrectionUploadOpen(prev => !prev)}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale shrink-0"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{isCorrectionUploadOpen ? '소명창 닫기' : '소명자료 즉시 제출하기'}</span>
                            </button>
                          </div>

                          {isCorrectionUploadOpen && (
                            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 space-y-3 animate-fadeIn">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                📂 변호사 요청 보정 소명 증빙파일 첨부 (영수증, 통장 사본, 메모 등)
                              </span>
                              <div className="flex items-center gap-3">
                                <label className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer transition-all">
                                  <Upload className="w-4 h-4 text-amber-600" />
                                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">소명 파일 선택 (사진 또는 PDF)</span>
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*,.pdf" 
                                    multiple 
                                    onChange={(e) => {
                                      handleFileUpload(e.target.files, 'correction_proof');
                                      toast.success('보정 소명자료가 담당 변호사 사무소로 즉시 전달되었습니다.');
                                    }} 
                                  />
                                </label>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight">
                                * 업로드하신 소명자료는 담당 변호사가 법원 제출용 7대 소명표에 반영하여 법원에 보정서로 접수합니다.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ═══ [기능 5] 채권자집회 출석 안내 카드 ═══ */}
                      {(crmExt?.thirteenStage === 'creditor_meeting') && (
                        <div className="p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                              🏛️
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm md:text-base text-indigo-950 dark:text-indigo-200">
                                  채권자집회 기일 출석 안내
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                  신분증 필수 지참
                                </span>
                              </div>
                              <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-0.5">
                                {crmExt?.courtCase?.courtName || '서울회생법원'} 회생법정 · 신청인 본인 출석 필수 (소요시간 3~5분)
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsCreditorMeetingModalOpen(true)}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale shrink-0 whitespace-nowrap"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>채권자집회 출석 완벽 가이드 보기</span>
                          </button>
                        </div>
                      )}

                      {/* ═══ [기능 5] 36회차 완납 시 채무자회생법 제624조 별도 면책신청서 원클릭 대행 요청 ═══ */}
                      {(currentStatus === 'repaying' || currentStatus === 'commenced' || crmExt?.thirteenStage === 'confirmation' || crmExt?.thirteenStage === 'completed') && (
                        <div className="p-5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                              🏆
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm md:text-base text-purple-950 dark:text-purple-200">
                                  채무자회생법 제624조 "별도 면책신청" 연동
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900">
                                  자동 면책 불가
                                </span>
                              </div>
                              <p className="text-xs text-purple-800 dark:text-purple-300 mt-0.5 leading-relaxed">
                                36개월간 변제금을 모두 납부하셔도 자동으로 종결되지 않으며, 법원에 별도 면책신청서를 접수해야 최종 면책결정이 내려집니다.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsDischargeRequested(true);
                              toast.success('담당 변호사에게 개인회생 면책신청서 제출이 성공적으로 위임 요청되었습니다.');
                            }}
                            disabled={isDischargeRequested}
                            className={`px-4 py-2.5 text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 press-scale shrink-0 whitespace-nowrap ${
                              isDischargeRequested 
                                ? 'bg-emerald-600 text-white cursor-default' 
                                : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{isDischargeRequested ? '✅ 면책신청 위임 접수완료' : '🏆 변호사에게 별도 면책신청 위임하기'}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. 필수 서류 제출 */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                      
                      {/* 🌟 법원 진술서 고객 간편 작성 (음성 STT + Gemini AI 도우미) 배너 */}
                      <div className="p-5 md:p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl text-white shadow-lg space-y-4 border border-indigo-700/40">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0">
                              🎙️
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-base md:text-lg text-white">
                                  말로 편하게 작성하는 법원 진술서
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-slate-950 font-sans">
                                  Gemini 2.5 AI
                                </span>
                              </div>
                              <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                                진술서는 고객님이 직접 작성해야 하는 유일한 서류입니다. 마이크를 켜고 편하게 말씀하시면 제미나이가 법원 양식으로 완성하여 변호사에게 자동 전달합니다.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsStatementModalOpen(true)}
                            className="px-5 py-3 bg-white text-indigo-950 hover:bg-indigo-50 font-black text-xs md:text-sm rounded-2xl shadow-md transition-all cursor-pointer press-scale shrink-0 flex items-center justify-center gap-2"
                          >
                            <span>🎙️ 진술서 말로 작성하기</span>
                            <ChevronRight className="w-4 h-4 text-indigo-600" />
                          </button>
                        </div>
                      </div>

                      {/* 📋 법원 제출용 재산상황표(D5102) 기초자료 간편 작성 배너 (리걸플로 7-4 벤치마킹) */}
                      <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl text-white shadow-lg space-y-4 border border-indigo-500/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0">
                              📋
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-base md:text-lg text-white">
                                  법원 제출용 재산상황표(D5102) 작성하기
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white font-sans">
                                  대법원 규격
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                                예금·보험, 자동차, 임차보증금, 부동산, 사업설비 등 6대 재산 사실관계를 간편하게 입력하시면 담당 변호사에게 안전하게 전달되어 법원 서류로 완성됩니다.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsPropertyIntakeModalOpen(true)}
                            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm rounded-2xl shadow-md transition-all cursor-pointer press-scale shrink-0 flex items-center justify-center gap-2"
                          >
                            <span>📋 재산상황표 작성하기</span>
                            <ChevronRight className="w-4 h-4 text-indigo-200" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-500 dark:bg-purple-950/40"><FileText className="w-5 h-5" /></div>
                          관공서 필수 서류 발급 제출
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
                        clientName={userAlias || activeRequest?.name || '신청인'}
                        requestId={reqId}
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

  {/* 🎙️ 법원 제출용 진술서 작성 모달 (Gemini AI 도우미) */}
  {isStatementModalOpen && (
    <React.Suspense fallback={null}>
      <ClientStatementModal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        clientId={activeRequest?.id || requests[0]?.id || 'client-self'}
        clientName={profile?.name || userAlias || '신청인'}
        caseType={activeRequest?.caseType === 'bankruptcy' || activeRequest?.category === 'individual_bankruptcy' ? 'bankruptcy' : 'rehab'}
        courtName={activeRequest?.court || '서울회생법원'}
        totalDebtAmount={profile?.debtTotal || 5000}
        monthlyIncome={profile?.income || 250}
        onSuccessSubmitted={() => {
          setRefreshTick(c => c + 1);
        }}
      />
    </React.Suspense>
  )}

  {/* 📋 법원 제출용 재산상황표(D5102) 기초자료 작성 모달 (리걸플로 7-4 벤치마킹) */}
  {isPropertyIntakeModalOpen && (
    <React.Suspense fallback={null}>
      <ClientPropertyIntakeModal
        isOpen={isPropertyIntakeModalOpen}
        onClose={() => setIsPropertyIntakeModalOpen(false)}
        clientId={activeRequest?.id || requests[0]?.id || 'client-self'}
        clientName={profile?.name || userAlias || '신청인'}
        onSyncToLawyerCrm={() => {
          setRefreshTick(c => c + 1);
        }}
      />
    </React.Suspense>
  )}

  {/* 🏛️ 채권자집회 출석 완벽 가이드 모달 */}
  <CreditorMeetingGuideModal
    isOpen={isCreditorMeetingModalOpen}
    onClose={() => setIsCreditorMeetingModalOpen(false)}
    courtName={activeRequest?.court || '서울회생법원'}
    caseNumber={(activeRequest as any)?.caseNumber || '2026개회108492'}
  />
</div>
  );
}





