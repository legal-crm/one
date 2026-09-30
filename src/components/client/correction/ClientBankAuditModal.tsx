import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, ChevronDown, ChevronUp, Printer, Send, Check, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../common/DialogProvider';
import PrintableHighValueAuditModal from '../../common/PrintableHighValueAuditModal';
import { Badge, Button, Callout, DocModal, EmptyState, FormField, buildSubmitConfirm, buttonClassName, inputClass, textareaClass } from '../ui';
import { cn } from '../../../utils/cn';
import { 
  AUDIT_PRESET_TEMPLATES, 
  getStoredBankAuditData, 
  saveStoredBankAuditData, 
  submitBankAuditToLawyer, 
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
  /** 제출 시 변호사 CRM(서버)에 동기화 — 성공 여부 반환 */
  onSyncToCrm?: (data: BankStatementAuditData) => Promise<boolean>;
}

/** '[…기재]' 안내 문구가 남아 있으면 미작성으로 간주 */
const isExplanationComplete = (text?: string) =>
  !!text && text.trim().length > 0 && !/\[[^\]]*기재[^\]]*\]/.test(text);

const THRESHOLD_OPTIONS = [300000, 500000, 1000000];

const txKey = (i: AuditTransactionItem) => `${i.date}|${i.counterparty}|${i.amount}`;
function mergeWithoutDuplicates(incoming: AuditTransactionItem[], existing: AuditTransactionItem[]): AuditTransactionItem[] {
  const seen = new Set(existing.map(txKey));
  return [...incoming.filter(i => !seen.has(txKey(i))), ...existing];
}

export default function ClientBankAuditModal({
  isOpen,
  onClose,
  clientId = 'client-default',
  clientName = '신청인',
  caseNumber = '',
  // 관할 법원을 모르면 비워 둔다(이전: '서울회생법원'이 인쇄본에 찍힘)
  courtName = '',
  onSubmittedSuccess,
  onSyncToCrm
}: ClientBankAuditModalProps) {
  const dialog = useDialog();
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
  // 마지막 자동 저장 시각(모든 입력은 바뀔 때마다 이 기기에 저장된다)
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 이 기기에 저장하고 저장 시각 표시
  const persist = (d: BankStatementAuditData) => {
    saveStoredBankAuditData(d);
    setSavedAt(Date.now());
  };

  const thresholdLabel = `${(threshold / 10000).toLocaleString()}만 원`;
  const handleThresholdChange = (value: number) => {
    setThreshold(value);
    const updated = { ...auditData, thresholdAmount: value };
    setAuditData(updated);
    persist(updated);
  };

  // 기준 금액 이상 대상 항목들
  const targetItems = auditData.items.filter(item => item.amount >= threshold);
  const totalTargetCount = targetItems.length;
  const resolvedCount = targetItems.filter(item => isExplanationComplete(item.explanation)).length;
  const unresolvedCount = totalTargetCount - resolvedCount;
  const progressPercent = totalTargetCount > 0 ? Math.round((resolvedCount / totalTargetCount) * 100) : 100;
  const totalAmountSum = targetItems.reduce((acc, curr) => acc + curr.amount, 0);

  // 필터링된 표시 목록
  const displayedItems = targetItems.filter(item => {
    const hasExpl = isExplanationComplete(item.explanation);
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
          // 안내 문구([…기재])를 실제 내용으로 바꿔야 작성 완료로 인정
          isResolved: isExplanationComplete(templateText)
        };
      }
      return item;
    });

    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: updatedItems
    };

    setAuditData(updatedData);
    persist(updatedData);
    toast.success(isExplanationComplete(templateText) ? '소명 사유 예시를 넣었습니다. 사실과 맞게 수정해 주세요.' : '예시 문구의 [ ] 부분을 실제 내용으로 바꿔 주세요.', { duration: 2500 });
  };

  // ═══ 핸들러: 소명 문구 직접 입력 ═══
  const handleExplanationChange = (itemId: string, text: string) => {
    const updatedItems = auditData.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          explanation: text,
          isResolved: isExplanationComplete(text)
        };
      }
      return item;
    });

    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: updatedItems
    };

    setAuditData(updatedData);
    persist(updatedData);
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
    persist(updatedData);
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
    persist(updatedData);
  };

  // ═══ 핸들러: 변호사에게 제출(제출 전 요약 확인) ═══
  const handleSubmitToLawyer = async () => {
    if (isSubmitting) return;
    const ok = await dialog.confirm(
      buildSubmitConfirm({
        title: '소명표를 변호사에게 제출할까요?',
        lines: [
          totalTargetCount > 0
            ? `${thresholdLabel} 이상 출금 ${totalTargetCount}건 · 총 ${totalAmountSum.toLocaleString()}원`
            : `${thresholdLabel} 이상 출금 거래 없음`,
          totalTargetCount > 0 ? `소명 작성 ${resolvedCount}건${unresolvedCount > 0 ? ` · 아직 안 쓴 거래 ${unresolvedCount}건` : ''}` : null,
        ],
        note: [
          unresolvedCount > 0 ? '아직 안 쓴 거래는 변호사 상담 때 추가로 확인합니다.' : '',
          '제출하면 담당 변호사 사건 기록에 저장되고, 변호사가 검토해 보완을 요청하거나 법원 제출용으로 정리합니다.',
        ].filter(Boolean).join('\n'),
        confirmText: unresolvedCount > 0 ? '그대로 제출' : '제출하기',
      })
    );
    if (!ok) return;

    setIsSubmitting(true);
    try {
      const updated = submitBankAuditToLawyer(clientId);
      setAuditData(updated);
      setSavedAt(Date.now());
      const synced = onSyncToCrm ? await onSyncToCrm(updated) : false;
      if (!synced) {
        toast.warning('소명표는 이 기기에 저장되었지만 서버 전송에 실패했습니다. 잠시 후 다시 제출해 주세요.');
        return;
      }
      toast.success('소명표를 담당 변호사 사건 기록에 제출했습니다.', {
        description: '변호사가 검토 후 필요한 보완을 요청하거나 법원 제출용으로 정리합니다.'
      });
      onSubmittedSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('제출 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
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
        toast.error(`파일에서 ${thresholdLabel} 이상 출금 거래를 찾지 못했습니다.`);
        return;
      }

      // 기존 항목과 병합 (같은 날짜·거래처·금액은 중복 등록하지 않음)
      const mergedItems = mergeWithoutDuplicates(parsedItems, auditData.items);
      const updatedData: BankStatementAuditData = {
        ...auditData,
        items: mergedItems
      };

      setAuditData(updatedData);
      persist(updatedData);
      setShowImportSection(false);
      toast.success(`${parsedItems.length}건의 ${thresholdLabel} 이상 출금 내역을 새로 등록했습니다.`);
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
      toast.error(`입력된 텍스트에서 ${thresholdLabel} 이상 출금 내역을 찾지 못했습니다.`);
      return;
    }

    const merged = mergeWithoutDuplicates(parsed, auditData.items);
    const updatedData: BankStatementAuditData = {
      ...auditData,
      items: merged
    };

    setAuditData(updatedData);
    persist(updatedData);
    setPasteText('');
    setShowImportSection(false);
    toast.success(`${parsed.length}건의 ${thresholdLabel} 이상 출금 내역이 추가되었습니다.`);
  };

  const isSubmitted = auditData.status === 'submitted' || auditData.status === 'lawyer_approved';
  const isApproved = auditData.status === 'lawyer_approved';

  const filterTabs: { id: 'ALL' | 'UNRESOLVED' | 'RESOLVED'; label: string }[] = [
    { id: 'ALL', label: `전체 ${totalTargetCount}` },
    { id: 'UNRESOLVED', label: `소명 필요 ${unresolvedCount}` },
    { id: 'RESOLVED', label: `소명 완료 ${resolvedCount}` },
  ];

  const txTypeLabel = (t: AuditTransactionItem['transactionType']) =>
    t === 'WITHDRAWAL' ? '계좌 출금' : t === 'CARD_PAYMENT' ? '카드 결제' : t === 'ATM_CASH' ? 'ATM 현금 출금' : '입금';

  const toggleClass = (active: boolean) =>
    cn(
      'min-h-11 px-3.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-colors',
      active ? 'bg-brand text-white border-brand' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
    );

  return (
    <>
      <DocModal
        open={isOpen}
        onClose={onClose}
        onBeforeClose={() => !isSubmitting}
        closeLabel="소명표 닫기"
        icon={<FileSpreadsheet className="w-5 h-5" />}
        title={`${thresholdLabel} 이상 출금 소명표`}
        description="큰 금액이 나간 거래마다 실제로 어디에 썼는지 사실대로 적어 주세요."
        badges={
          isApproved ? (
            <Badge tone="success" icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}>변호사 점검 완료</Badge>
          ) : isSubmitted ? (
            <Badge tone="warning" icon={<Clock className="w-3 h-3" aria-hidden="true" />}>변호사 검토 대기</Badge>
          ) : null
        }
        saveState={savedAt ? { status: 'saved', at: savedAt } : { status: 'idle' }}
        saveTarget="device"
        idleLabel="입력하면 이 기기에 자동 저장돼요"
        subHeader={
          <div className="bg-white px-4 sm:px-6 py-3 space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                <span className="font-bold text-slate-800">
                  {totalTargetCount > 0 ? (
                    <>
                      소명 {resolvedCount}/{totalTargetCount}건 <span className="text-brand tabular-nums">{progressPercent}%</span>
                    </>
                  ) : (
                    '아직 소명할 거래가 없어요'
                  )}
                </span>
                {totalTargetCount > 0 && <span className="text-xs text-slate-600 tabular-nums">총 출금액 {totalAmountSum.toLocaleString()}원</span>}
              </div>
              <div
                className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden"
                role="progressbar"
                aria-label="소명 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={totalTargetCount > 0 ? progressPercent : 0}
              >
                <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${totalTargetCount > 0 ? progressPercent : 0}%` }} />
              </div>
            </div>
            <div role="group" aria-label="거래 보기" className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {filterTabs.map(t => (
                <button key={t.id} type="button" aria-pressed={filterMode === t.id} onClick={() => setFilterMode(t.id)} className={toggleClass(filterMode === t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPrintModal(true)} leftIcon={<Printer className="w-4 h-4" aria-hidden="true" />}>
              미리보기·인쇄
            </Button>
            <Button onClick={handleSubmitToLawyer} loading={isSubmitting} leftIcon={<Send className="w-4 h-4" aria-hidden="true" />}>
              {isSubmitted ? '다시 제출하기' : '변호사에게 제출'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 소명 기준 금액 (관할 법원·회생위원 요청 기준에 맞춰 변경) */}
          <section aria-labelledby="audit-threshold-title" className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <h3 id="audit-threshold-title" className="text-sm font-bold text-slate-900">소명 기준 금액</h3>
              <p className="mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">
                관할 법원이나 회생위원이 요청한 기준에 맞춰 고르세요. 기준 이상 출금만 소명 대상이 됩니다.
              </p>
            </div>
            <div role="group" aria-label="소명 기준 금액" className="flex flex-wrap gap-2">
              {THRESHOLD_OPTIONS.map(v => (
                <button key={v} type="button" aria-pressed={threshold === v} onClick={() => handleThresholdChange(v)} className={toggleClass(threshold === v)}>
                  {(v / 10000).toLocaleString('ko-KR')}만 원 이상
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed break-keep">
              회생위원은 큰 금액의 출금에 재산 은닉이나 편파변제가 없는지 확인합니다. 예시 문구를 눌러도 [ ] 부분은 직접 채워야 해요.
            </p>
          </section>

          {/* 거래 목록 머리: 거래내역 추가(파일·붙여넣기) 열고 닫기 */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">
              {thresholdLabel} 이상 출금 {totalTargetCount}건
            </h3>
            <Button
              variant="secondary"
              onClick={() => setShowImportSection(v => !v)}
              aria-expanded={showImportSection}
              aria-controls="audit-import"
              leftIcon={<Upload className="w-4 h-4" aria-hidden="true" />}
              rightIcon={showImportSection ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
              className="shrink-0"
            >
              거래내역 추가
            </Button>
          </div>

          {/* 거래내역 파일/텍스트 추가 */}
          {showImportSection && (
            <section id="audit-import" aria-labelledby="audit-import-title" className="rounded-2xl border border-brand/20 bg-brand-light/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="audit-import-title" className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <FileSpreadsheet className="w-4 h-4 text-brand" aria-hidden="true" />
                  은행 엑셀 파일 또는 거래내역 붙여넣기
                </h3>
                <span className="text-xs text-slate-600">{thresholdLabel} 이상 출금만 골라 담아요</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 flex flex-col items-center justify-center text-center gap-2.5">
                  <p className="text-sm text-slate-700 break-keep">
                    은행 홈페이지에서 받은 <strong>엑셀 파일(.xlsx, .xls, .csv)</strong>을 올려 주세요.
                  </p>
                  <label className={buttonClassName('primary', 'md', 'focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2')}>
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    엑셀 파일 선택
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="space-y-2">
                  <FormField label="모바일 뱅킹 거래내역 붙여넣기">
                    {(p) => (
                      <textarea
                        {...p}
                        rows={3}
                        placeholder="예: 2025-11-20 김철수 1,200,000"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        className={cn(textareaClass, 'min-h-24')}
                      />
                    )}
                  </FormField>
                  <Button variant="secondary" fullWidth onClick={handlePasteParse}>
                    붙여넣은 내역에서 찾기
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* 기준 금액 이상 거래 목록 */}
          {displayedItems.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 className="w-6 h-6" />}
              title={filterMode === 'UNRESOLVED' && totalTargetCount > 0 ? `${thresholdLabel} 이상 거래를 모두 소명했어요` : '소명할 거래가 없어요'}
              description={
                filterMode === 'UNRESOLVED' && totalTargetCount > 0
                  ? "아래 '변호사에게 제출'을 눌러 점검을 요청해 주세요."
                  : '은행 엑셀 파일을 올리거나 모바일 뱅킹 거래내역을 붙여 넣으면 기준 금액 이상 출금만 골라 담아요.'
              }
              className="rounded-2xl border border-slate-200 bg-white"
            />
          ) : (
            <ul className="space-y-3">
              {displayedItems.map((item, index) => {
                const isResolved = item.isResolved && item.explanation && item.explanation.trim().length > 0;
                const isDanger = item.riskCategory === 'DANGER_SPECULATION' || item.riskCategory === 'DANGER_LUXURY';
                const isCaution = item.riskCategory === 'CAUTION_CASH' || item.riskCategory === 'CAUTION_TRANSFER';

                return (
                  <li
                    key={item.id}
                    className={cn('rounded-2xl border bg-white p-4 sm:p-5', isResolved ? 'border-emerald-200' : 'border-slate-200')}
                  >
                    {/* 거래일·금융사·금액·상태 */}
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-bold text-slate-600">#{index + 1}</span>
                          <span className="font-semibold text-slate-700 tabular-nums">{item.date}</span>
                          <Badge tone="neutral">{item.bankOrCard}</Badge>
                          <Badge tone="info">{txTypeLabel(item.transactionType)}</Badge>
                          {item.riskBadgeText && (
                            <Badge tone={isDanger ? 'danger' : isCaution ? 'warning' : 'neutral'}>{item.riskBadgeText}</Badge>
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 break-keep">{item.counterparty}</h3>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">{item.amount.toLocaleString()}원</p>
                        <div className="mt-1">
                          {isResolved ? (
                            <Badge tone="success" icon={<Check className="w-3 h-3" aria-hidden="true" />}>소명 완료</Badge>
                          ) : (
                            <Badge tone="warning">소명 필요</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 회생위원이 자세히 보는 거래(코인·사치·현금 등) */}
                    {(isDanger || isCaution) && item.riskAdvice && (
                      <Callout tone="warning" title="회생위원이 자세히 볼 수 있는 거래예요" className="mt-3">
                        {item.riskAdvice}
                      </Callout>
                    )}

                    {/* 예시 사유 */}
                    <div className="mt-3.5 space-y-2">
                      <p className="text-sm font-bold text-slate-800">어디에 쓴 돈인가요? 예시를 누르면 칸에 채워져요</p>
                      <div className="flex flex-wrap gap-1.5">
                        {AUDIT_PRESET_TEMPLATES.map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleApplyPreset(item.id, preset.templateText, preset.suggestedEvidence)}
                            className="min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-brand hover:text-brand transition-colors"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 소명 내용·증빙·메모 */}
                    <div className="mt-3 space-y-3">
                      <FormField label="실제 사용처(법원 제출용)">
                        {(p) => (
                          <textarea
                            {...p}
                            rows={2}
                            value={item.explanation}
                            onChange={(e) => handleExplanationChange(item.id, e.target.value)}
                            placeholder="예시를 누르거나, 실제로 어디에 썼는지 적어 주세요"
                            className={cn(textareaClass, 'min-h-20')}
                          />
                        )}
                      </FormField>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField label="증빙 서류" optional>
                          {(p) => (
                            <input
                              {...p}
                              type="text"
                              value={item.evidenceType || ''}
                              onChange={(e) => handleEvidenceChange(item.id, e.target.value)}
                              placeholder="예: 카드 영수증, 진료비 계산서, 이체 확인증"
                              className={inputClass}
                            />
                          )}
                        </FormField>
                        <FormField label="변호사에게 전할 메모" optional>
                          {(p) => (
                            <input
                              {...p}
                              type="text"
                              value={item.clientNote || ''}
                              onChange={(e) => handleClientNoteChange(item.id, e.target.value)}
                              placeholder="더 알려 드릴 사정이 있으면 적어 주세요"
                              className={inputClass}
                            />
                          )}
                        </FormField>
                      </div>

                      {item.lawyerReviewNote && (
                        <Callout tone="info" title="변호사 검토 의견">
                          {item.lawyerReviewNote}
                        </Callout>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            작성 내용이 정확하지 않아도 괜찮아요. 담당 변호사가 검토하면서 함께 보완합니다.
          </p>
        </div>
      </DocModal>

      {/* 법원 제출용 별지 미리보기·인쇄 — 소명표 창 위에 뜨는 창 */}
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
    </>
  );
}
