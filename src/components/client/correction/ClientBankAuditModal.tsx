import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Sparkles, 
  ChevronDown, ChevronUp, RefreshCw, Printer, Send, Save, ArrowRight, 
  ShieldCheck, Check, Clock, Plus, HelpCircle, FileText, Info, 
  Search, ShieldAlert, Sparkle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';
import PrintableHighValueAuditModal from '../../common/PrintableHighValueAuditModal';
import { 
  AUDIT_PRESET_TEMPLATES, 
  getStoredBankAuditData, 
  saveStoredBankAuditData, 
  submitBankAuditToLawyer, 
  calculateAuditStats, 
  parseExcelBankStatement, 
  parseRawBankStatementText 
} from '../../../services/bankAuditService';
import type { AuditTransactionItem, BankStatementAuditData } from '../../../types/bankAuditTypes';

interface ClientBankAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  clientName?: string;
  caseNumber?: string;
  courtName?: string;
  onSubmittedSuccess?: () => void;
}

export default function ClientBankAuditModal({
  isOpen,
  onClose,
  clientId = 'client-default',
  clientName = '김채무',
  caseNumber = '2026개회 108492호',
  courtName = '서울회생법원',
  onSubmittedSuccess
}: ClientBankAuditModalProps) {
  // 전체 데이터셋 상태
  const [auditData, setAuditData] = useState<BankStatementAuditData | null>(null);
  
  // 소명 기준 금액 (기본 100만 원 이상)
  const [threshold, setThreshold] = useState<number>(1000000);
  
  // 필터 (전체 / 미작성 건만 / 완료 건만)
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNRESOLVED' | 'RESOLVED'>('ALL');
  
  // 인쇄 및 PDF 미리보기 모달 열림 상태
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  
  // 엑셀/텍스트 등록 드롭다운 열림 상태
  const [showImportSection, setShowImportSection] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');
  
  // 검색어
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. 데이터 로드 및 로컬스토리지 실시간 이벤트 구독
  useEffect(() => {
    if (!isOpen) return;

    const data = getStoredBankAuditData(clientId, clientName);
    setAuditData(data);
    if (data.thresholdAmount) {
      setThreshold(data.thresholdAmount);
    }

    const handleSyncEvent = (e: any) => {
      if (e.detail?.clientId === clientId && e.detail?.data) {
        setAuditData(e.detail.data);
      }
    };

    window.addEventListener('bank_audit_updated', handleSyncEvent);
    return () => {
      window.removeEventListener('bank_audit_updated', handleSyncEvent);
    };
  }, [isOpen, clientId, clientName]);

  if (!isOpen || !auditData) return null;

  // 100만 원 이상 대상 항목들
  const targetItems = auditData.items.filter(item => item.amount >= threshold);
  const totalTargetCount = targetItems.length;
  const resolvedCount = targetItems.filter(item => item.explanation && item.explanation.trim().length > 0).length;
  const unresolvedCount = totalTargetCount - resolvedCount;
  const progressPercent = totalTargetCount > 0 ? Math.round((resolvedCount / totalTargetCount) * 100) : 100;
  const totalAmountSum = targetItems.reduce((acc, curr) => acc + curr.amount, 0);

  // 필터링된 표시 목록
  const displayedItems = targetItems.filter(item => {
    const hasExpl = item.explanation && item.explanation.trim().length > 0;
    if (filterMode === 'UNRESOLVED' && hasExpl) return false;
    if (filterMode === 'RESOLVED' && !hasExpl) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.counterparty.toLowerCase().includes(q);
      const matchBank = item.bankOrCard.toLowerCase().includes(q);
      const matchExpl = item.explanation.toLowerCase().includes(q);
      if (!matchName && !matchBank && !matchExpl) return false;
    }

    return true;
  });

  // ═══ 핸들러: 원터치 칩 클릭 적용 ═══
  const handleApplyPreset = (itemId: string, templateText: string, evidenceType: string) => {
    const updatedItems = auditData.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          explanation: templateText,
          evidenceType,
          isResolved: true
        };
      }
      return item;
    });

    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: updatedItems
    };

    setAuditData(updatedData);
    saveStoredBankAuditData(updatedData);
    toast.success('원터치 소명 사유가 입력되었습니다.', { duration: 1500 });
  };

  // ═══ 핸들러: 소명 문구 직접 입력 ═══
  const handleExplanationChange = (itemId: string, text: string) => {
    const updatedItems = auditData.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          explanation: text,
          isResolved: text.trim().length > 0
        };
      }
      return item;
    });

    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: updatedItems
    };

    setAuditData(updatedData);
    saveStoredBankAuditData(updatedData);
  };

  // ═══ 핸들러: 고객 메모 입력 ═══
  const handleClientNoteChange = (itemId: string, note: string) => {
    const updatedItems = auditData.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          clientNote: note
        };
      }
      return item;
    });

    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: updatedItems
    };

    setAuditData(updatedData);
    saveStoredBankAuditData(updatedData);
  };

  // ═══ 핸들러: 증빙 자료 수정 ═══
  const handleEvidenceChange = (itemId: string, evidence: string) => {
    const updatedItems = auditData.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          evidenceType: evidence
        };
      }
      return item;
    });

    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: updatedItems
    };

    setAuditData(updatedData);
    saveStoredBankAuditData(updatedData);
  };

  // ═══ 핸들러: 임시 저장 ═══
  const handleSaveDraft = () => {
    saveStoredBankAuditData(auditData);
    toast.success('작성하신 내용이 안전하게 임시 저장되었습니다.');
  };

  // ═══ 핸들러: 변호사에게 최종 제출 ═══
  const handleSubmitToLawyer = () => {
    if (unresolvedCount > 0) {
      const confirmSubmit = window.confirm(
        `아직 소명이 작성되지 않은 내역이 ${unresolvedCount}건 남아있습니다.\n현재 상태로 변호사님께 제출하시겠습니까? (미작성 건은 변호사 상담 시 추가 검토됩니다)`
      );
      if (!confirmSubmit) return;
    }

    const updated = submitBankAuditToLawyer(clientId);
    setAuditData(updated);
    toast.success('소명표가 담당 변호사에게 성공적으로 제출되었습니다!', {
      description: '변호사 검토 및 법률적 보정서 결합 후 법원에 접수됩니다.'
    });

    if (onSubmittedSuccess) {
      onSubmittedSuccess();
    }
  };

  // ═══ 핸들러: 엑셀 파일 업로드 파싱 ═══
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const file = files[0];
      const parsedItems = await parseExcelBankStatement(file, threshold);
      if (parsedItems.length === 0) {
        toast.error('파일에서 100만 원 이상 출금 거래를 찾지 못했습니다.');
        return;
      }

      // 기존 항목과 병합
      const mergedItems = [...parsedItems, ...auditData.items];
      const updatedData: BankStatementAuditData = {
        ...auditData,
        items: mergedItems
      };

      setAuditData(updatedData);
      saveStoredBankAuditData(updatedData);
      setShowImportSection(false);
      toast.success(`${parsedItems.length}건의 100만 원 이상 출금 내역을 새로 등록했습니다!`);
    } catch (err) {
      console.error(err);
      toast.error('엑셀 파일 분석 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ═══ 핸들러: 텍스트 붙여넣기 파싱 ═══
  const handlePasteParse = () => {
    if (!pasteText.trim()) {
      toast.error('거래내역 텍스트를 입력해주세요.');
      return;
    }

    const parsed = parseRawBankStatementText(pasteText, threshold);
    if (parsed.length === 0) {
      toast.error('입력된 텍스트에서 100만 원 이상 출금 내역을 식별하지 못했습니다.');
      return;
    }

    const merged = [...parsed, ...auditData.items];
    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: merged
    };

    setAuditData(updatedData);
    saveStoredBankAuditData(updatedData);
    setPasteText('');
    setShowImportSection(false);
    toast.success(`${parsed.length}건의 100만 원 이상 출금 내역이 추가되었습니다.`);
  };

  const isSubmitted = auditData.status === 'submitted' || auditData.status === 'lawyer_approved';
  const isApproved = auditData.status === 'lawyer_approved';

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
        <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">

          {/* ════ 1. 모달 상단 헤더 ════ */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-t-2xl shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                    법원 보정명령 1순위 소명자료
                  </span>
                  {isApproved ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      변호사 점검 완료 (법원 제출 준비됨)
                    </span>
                  ) : isSubmitted ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      변호사 검토 대기 중
                    </span>
                  ) : null}
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  100만 원 이상 출금 거래 사용처 소명표
                </h2>
                <p className="text-xs sm:text-[13px] text-blue-100/80 leading-relaxed">
                  회생위원은 큰 금액의 출금 내역에 대해 재산 은닉이나 편파변제가 없는지 확인합니다. 아래 거래를 누르고 <strong>알맞은 사유를 터치</strong>해 주세요.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 진척도 바 & 통계 */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-200">
                  소명 진척도 ({resolvedCount}/{totalTargetCount}건 완료)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/15 font-extrabold text-white text-[11px]">
                  {progressPercent}%
                </span>
              </div>
              <div className="text-slate-300 text-[11px]">
                100만 원 이상 총 출금액: <strong className="text-white text-xs">{totalAmountSum.toLocaleString()}원</strong>
              </div>
            </div>

            {/* 프로그레스 바 */}
            <div className="w-full bg-black/30 rounded-full h-2 mt-2 overflow-hidden border border-white/10">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* ════ 2. 툴바 및 필터 바 ════ */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* 상태 탭 필터 */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  filterMode === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                전체 ({totalTargetCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('UNRESOLVED')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  filterMode === 'UNRESOLVED'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700 hover:bg-amber-50'
                }`}
              >
                <span>미소명 ({unresolvedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('RESOLVED')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  filterMode === 'RESOLVED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50'
                }`}
              >
                <span>소명완료 ({resolvedCount})</span>
              </button>
            </div>

            {/* 우측 툴 버튼군 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportSection(!showImportSection)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-500" />
                <span>거래내역 추가</span>
                {showImportSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                title="법원 제출 서식 인쇄 또는 PDF 미리보기"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>미리보기 & 인쇄</span>
              </button>
            </div>
          </div>

          {/* ════ 2-1. 거래내역 파일/텍스트 추가 접이식 섹션 ════ */}
          {showImportSection && (
            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  은행 엑셀 파일 또는 모바일 뱅킹 텍스트 붙여넣기
                </span>
                <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  ※ 100만 원 이상 출금 건만 자동 필터링됩니다
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 엑셀 파일 업로드 */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 flex flex-col items-center justify-center text-center">
                  <p className="text-slate-600 dark:text-slate-400 mb-2">
                    은행 홈페이지에서 받은 <strong>엑셀 파일(.xlsx, .xls)</strong>을 올려주세요.
                  </p>
                  <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs">
                    <Upload className="w-4 h-4" />
                    <span>엑셀 파일 선택</span>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </label>
                </div>

                {/* 텍스트 붙여넣기 */}
                <div className="space-y-1.5">
                  <textarea
                    rows={2}
                    placeholder="모바일 뱅킹 거래내역을 복사하여 여기에 붙여넣으세요... (예: 2025-11-20 김철수 1,200,000)"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handlePasteParse}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    붙여넣은 거래내역 자동 추출
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════ 3. 본문: 100만 원 이상 거래 카드 목록 ════ */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-100 dark:bg-slate-950">
            {displayedItems.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {filterMode === 'UNRESOLVED' ? '모든 100만 원 이상 거래의 소명이 완료되었습니다!' : '소명 대상 거래가 없습니다.'}
                </h4>
                <p className="text-xs text-slate-500">
                  {filterMode === 'UNRESOLVED' ? '하단의 [변호사에게 제출하기] 버튼을 눌러 점검을 요청하세요.' : '새로운 거래내역을 추가하려면 상단의 [거래내역 추가]를 이용하세요.'}
                </p>
              </div>
            ) : (
              displayedItems.map((item, index) => {
                const isResolved = item.isResolved && item.explanation && item.explanation.trim().length > 0;
                const isDanger = item.riskCategory === 'DANGER_SPECULATION' || item.riskCategory === 'DANGER_LUXURY';
                const isCaution = item.riskCategory === 'CAUTION_CASH' || item.riskCategory === 'CAUTION_TRANSFER';

                return (
                  <div 
                    key={item.id}
                    className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all ${
                      isResolved 
                        ? 'border-emerald-200 dark:border-emerald-900/40 shadow-xs' 
                        : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300'
                    }`}
                  >
                    {/* 카드 상단: 거래일, 금융사, 금액, 상태 */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {item.date}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {item.bankOrCard}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                            {item.transactionType === 'WITHDRAWAL' ? '계좌출금' : 
                             item.transactionType === 'CARD_PAYMENT' ? '카드결제' : 
                             item.transactionType === 'ATM_CASH' ? 'ATM현금출금' : '입금'}
                          </span>
                          {/* 위험도 라벨 */}
                          {item.riskBadgeText && (
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isDanger 
                                ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' 
                                : isCaution 
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' 
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                            }`}>
                              {item.riskBadgeText}
                            </span>
                          )}
                        </div>

                        {/* 거래 상대방 (적요) */}
                        <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{item.counterparty}</span>
                        </div>
                      </div>

                      {/* 금액 및 완료 뱃지 */}
                      <div className="text-right shrink-0">
                        <div className="text-base sm:text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                          {item.amount.toLocaleString()}원
                        </div>
                        <div className="mt-1">
                          {isResolved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <Check className="w-3 h-3" /> 소명 완료
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              소명 필요
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 위험 주의 도움말 (코인/사치/현금 등) */}
                    {(isDanger || isCaution) && item.riskAdvice && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <strong className="font-bold">법원 회생위원 심사 유의:</strong>
                          <p className="leading-relaxed">{item.riskAdvice}</p>
                        </div>
                      </div>
                    )}

                    {/* ═══ 원터치 빠른 사유 칩 ═══ */}
                    <div className="mt-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>어디에 쓰신 돈인가요? (원터치 빠른 사유 선택):</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {AUDIT_PRESET_TEMPLATES.map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleApplyPreset(item.id, preset.templateText, preset.suggestedEvidence)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                          >
                            <span>{preset.icon}</span>
                            <span>{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 소명 문구 입력란 */}
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          구체적 사용처 소명내용 (법원 제출용):
                        </label>
                        <textarea
                          rows={2}
                          value={item.explanation}
                          onChange={(e) => handleExplanationChange(item.id, e.target.value)}
                          placeholder="위 원터치 칩을 누르거나, 실제 어디에 지출하셨는지 간략히 적어주세요..."
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed"
                        />
                      </div>

                      {/* 하단 보조 입력: 증빙 자료 & 고객 비고 메모 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                            첨부 증빙 서류:
                          </label>
                          <input
                            type="text"
                            value={item.evidenceType || ''}
                            onChange={(e) => handleEvidenceChange(item.id, e.target.value)}
                            placeholder="예: 카드영수증, 진료비계산서, 이체증 등"
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                            변호사 전달 메모 (선택사항):
                          </label>
                          <input
                            type="text"
                            value={item.clientNote || ''}
                            onChange={(e) => handleClientNoteChange(item.id, e.target.value)}
                            placeholder="변호사님께 전달할 추가 사정이 있다면 적어주세요"
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* 변호사 검토 의견이 있는 경우 표시 */}
                      {item.lawyerReviewNote && (
                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
                          <strong>변호사 검토 의견:</strong> {item.lawyerReviewNote}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* ════ 4. 하단 고정 액션 바 ════ */}
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
              💡 작성 내용이 완벽하지 않아도 괜찮습니다. 담당 변호사가 법리적으로 검토하여 보완합니다.
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* 임시저장 버튼 */}
              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>임시저장</span>
              </button>

              {/* 미리보기 & 인쇄 버튼 */}
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>미리보기/인쇄</span>
              </button>

              {/* 메인 CTA: 변호사에게 제출하기 */}
              <button
                type="button"
                onClick={handleSubmitToLawyer}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-[0.98]"
              >
                <Send className="w-4 h-4" />
                <span>변호사에게 제출하기</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 법원 공식 별지 인쇄 / PDF 미리보기 모달 */}
      <PrintableHighValueAuditModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        clientName={clientName}
        caseNumber={caseNumber}
        courtName={courtName}
        items={auditData.items}
        thresholdAmount={threshold}
        isClientView={true}
      />
    </ModalPortal>
  );
}

