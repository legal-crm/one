import React, { useState, useMemo, useRef } from 'react';
import { 
  X, Upload, FileSpreadsheet, Download, Printer, Filter, 
  CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, ArrowUpDown, 
  Search, RefreshCw, Plus, Check, Copy, ChevronRight, AlertOctagon,
  DollarSign, FileText, Landmark, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import type { AuditTransactionItem, AuditRiskCategory } from '../../types/bankAuditTypes';
import { 
  AUDIT_PRESET_TEMPLATES, 
  generateSampleBankTransactions, 
  calculateAuditStats, 
  parseExcelBankStatement, 
  parseRawBankStatementText,
  exportAuditStatementToExcel
} from '../../services/bankAuditService';

interface BankStatementAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  caseNumber?: string;
  courtName?: string;
  onSyncToCrmCorrection?: (resolvedItems: AuditTransactionItem[]) => void;
  isClientMode?: boolean; // 의뢰인 마이페이지용 모드 여부
}

export default function BankStatementAuditModal({
  isOpen,
  onClose,
  clientName = '신청인',
  caseNumber = '2026개회 108492호',
  courtName = '서울회생법원',
  onSyncToCrmCorrection,
  isClientMode = false
}: BankStatementAuditModalProps) {
  if (!isOpen) return null;

  // 거래내역 목록 상태 (초기값으로 현실적인 실무 1년치 샘플 데이터 로드)
  const [items, setItems] = useState<AuditTransactionItem[]>(() => generateSampleBankTransactions());

  // 필터 상태
  const [thresholdAmount, setThresholdAmount] = useState<number>(500000); // 기본 50만원 이상
  const [customThresholdInput, setCustomThresholdInput] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'WITHDRAWAL' | 'CARD_PAYMENT' | 'ATM_CASH'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRESOLVED' | 'RESOLVED'>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'DANGER_ONLY' | 'CAUTION_ONLY'>('ALL');
  const [sortBy, setSortBy] = useState<'AMOUNT_DESC' | 'DATE_DESC' | 'RISK_FIRST'>('AMOUNT_DESC');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 텍스트 붙여넣기 모드 토글
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // 인쇄 모드 상태
  const [isPrintPreview, setIsPrintPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 통계 계산
  const stats = useMemo(() => calculateAuditStats(items, thresholdAmount), [items, thresholdAmount]);

  // 필터링 및 정렬된 목록
  const filteredItems = useMemo(() => {
    let list = items.filter(item => {
      // 1. 금액 기준 필터
      if (thresholdAmount > 0 && item.amount < thresholdAmount) return false;

      // 2. 거래 구분 필터
      if (typeFilter !== 'ALL' && item.transactionType !== typeFilter) return false;

      // 3. 소명 상태 필터
      if (statusFilter === 'RESOLVED' && (!item.isResolved || !item.explanation.trim())) return false;
      if (statusFilter === 'UNRESOLVED' && (item.isResolved && item.explanation.trim())) return false;

      // 4. 위험도 필터
      if (riskFilter === 'DANGER_ONLY' && item.riskCategory !== 'DANGER_SPECULATION' && item.riskCategory !== 'DANGER_LUXURY') return false;
      if (riskFilter === 'CAUTION_ONLY' && item.riskCategory !== 'CAUTION_CASH' && item.riskCategory !== 'CAUTION_TRANSFER') return false;

      // 5. 검색어 (상대방명 또는 금융기관)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.counterparty.toLowerCase().includes(q);
        const matchBank = item.bankOrCard.toLowerCase().includes(q);
        const matchExpl = item.explanation.toLowerCase().includes(q);
        if (!matchName && !matchBank && !matchExpl) return false;
      }

      return true;
    });

    // 정렬
    return list.sort((a, b) => {
      if (sortBy === 'AMOUNT_DESC') return b.amount - a.amount;
      if (sortBy === 'DATE_DESC') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'RISK_FIRST') {
        const weight = (cat: AuditRiskCategory) => {
          if (cat === 'DANGER_SPECULATION' || cat === 'DANGER_LUXURY') return 3;
          if (cat === 'CAUTION_CASH' || cat === 'CAUTION_TRANSFER') return 2;
          return 1;
        };
        return weight(b.riskCategory) - weight(a.riskCategory);
      }
      return 0;
    });
  }, [items, thresholdAmount, typeFilter, statusFilter, riskFilter, sortBy, searchQuery]);

  // 개별 소명 문구 수정
  const handleExplanationChange = (id: string, text: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          explanation: text,
          isResolved: text.trim().length > 0
        };
      }
      return item;
    }));
  };

  // 프리셋 원클릭 적용
  const handleApplyPreset = (id: string, presetTemplateText: string, suggestedEvidence: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          explanation: presetTemplateText,
          evidenceType: suggestedEvidence,
          isResolved: true
        };
      }
      return item;
    }));
    toast.success('표준 소명 문구가 적용되었습니다.');
  };

  // 증빙 서류명 수정
  const handleEvidenceChange = (id: string, evidence: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, evidenceType: evidence };
      }
      return item;
    }));
  };

  // 파일 업로드 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info(`${file.name} 파일을 분석하는 중입니다...`);
      let parsed: AuditTransactionItem[] = [];

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsed = await parseExcelBankStatement(file);
      } else {
        const text = await file.text();
        parsed = parseRawBankStatementText(text);
      }

      if (parsed.length > 0) {
        setItems(parsed);
        toast.success(`총 ${parsed.length}건의 거래내역을 성공적으로 불러왔습니다!`);
      } else {
        toast.error('파일에서 유효한 거래내역을 추출하지 못했습니다. 형식을 확인해 주세요.');
      }
    } catch (err) {
      console.error(err);
      toast.error('파일 파싱 중 오류가 발생했습니다.');
    }
  };

  // 텍스트 붙여넣기 파싱
  const handleApplyPastedText = () => {
    if (!pasteText.trim()) return;
    const parsed = parseRawBankStatementText(pasteText);
    if (parsed.length > 0) {
      setItems(parsed);
      setShowPasteArea(false);
      setPasteText('');
      toast.success(`총 ${parsed.length}건의 거래내역이 입력되었습니다.`);
    } else {
      toast.error('붙여넣은 텍스트에서 금액 및 거래 정보를 인식하지 못했습니다.');
    }
  };

  // 샘플 데이터 다시 로드
  const handleReloadSample = () => {
    setItems(generateSampleBankTransactions());
    toast.success('KB국민은행 및 신한카드 1년치 샘플 데이터(25건)를 불러왔습니다.');
  };

  // 엑셀 다운로드
  const handleExportExcel = () => {
    exportAuditStatementToExcel(items, clientName, caseNumber, thresholdAmount);
    toast.success(`${clientName}_${thresholdAmount / 10000}만원이상_소명서.xlsx 파일이 다운로드되었습니다.`);
  };

  // CRM 보정센터 동기화
  const handleSyncToCrm = () => {
    if (onSyncToCrmCorrection) {
      const resolved = items.filter(i => i.isResolved && i.amount >= thresholdAmount);
      onSyncToCrmCorrection(resolved);
      toast.success(`소명 완료된 ${resolved.length}건이 보정센터 7대 소명표에 자동 반영되었습니다!`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200">
        
        {/* ═══ 1. 헤더 & 사건 정보 ═══ */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0 shadow-sm">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  1차 보정명령 필수 서식
                </span>
                <span className="text-xs text-slate-300 font-bold">
                  {courtName} • {caseNumber}
                </span>
                <span className="text-xs text-indigo-300 font-semibold">
                  신청인: {clientName}
                </span>
              </div>
              <h3 className="text-base md:text-lg font-black text-white mt-0.5">
                통장 및 신용카드 거래내역 소명 자동화 허브 (30만·50만·100만 원 이상)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="hidden sm:flex px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>엑셀 다운로드</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintPreview(!isPrintPreview)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrintPreview ? '편집 모드' : '법원 인쇄용 보기'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ 2. 스마트 통계 스코어보드 바 ═══ */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0 text-xs">
          
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">총 거래내역</span>
            <span className="text-sm md:text-base font-black text-slate-900 dark:text-white">
              {stats.totalCount}건
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              합계: {(stats.totalAmount / 10000).toLocaleString()}만 원
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
            <span className="text-blue-700 dark:text-blue-300 block text-[11px] font-bold">
              {thresholdAmount / 10000}만 원 이상 소명 대상
            </span>
            <span className="text-sm md:text-base font-black text-blue-900 dark:text-blue-200">
              {stats.thresholdCount}건
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5 font-medium">
              대상액: {(stats.thresholdAmount / 10000).toLocaleString()}만 원
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
            <div className="flex items-center justify-between">
              <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-bold">소명 완료율</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{stats.resolvedRate}%</span>
            </div>
            <div className="w-full bg-emerald-200/60 dark:bg-emerald-900/60 rounded-full h-2 mt-1.5 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.resolvedRate}%` }}
              />
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1 font-medium">
              {stats.resolvedCount}건 작성완료 / {stats.unresolvedCount}건 미소명
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
            <span className="text-red-700 dark:text-red-300 block text-[11px] font-bold">
              🔴 사행성·사치 감지
            </span>
            <span className="text-sm md:text-base font-black text-red-600 dark:text-red-400">
              {stats.dangerCount}건
            </span>
            <span className="text-[10px] text-red-500 block mt-0.5">
              주식·코인·도박·유흥주점
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 col-span-2 md:col-span-1">
            <span className="text-amber-700 dark:text-amber-300 block text-[11px] font-bold">
              🟡 주의 (현금·친족송금)
            </span>
            <span className="text-sm md:text-base font-black text-amber-600 dark:text-amber-400">
              {stats.cautionCount}건
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">
              ATM현금인출·편파변제의심
            </span>
          </div>

        </div>

        {/* ═══ 3. 컨트롤 툴바 (금액 필터, 검색, 파일 업로드) ═══ */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shrink-0 text-xs">
          
          {/* 1행: 금액 기준 필터 칩 & 샘플/업로드 액션 */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* 금액 기준 칩 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 dark:text-slate-400 font-bold mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>법원 소명 기준:</span>
              </span>
              {[
                { label: '전체 거래', val: 0 },
                { label: '30만 원 이상', val: 300000 },
                { label: '50만 원 이상', val: 500000 },
                { label: '100만 원 이상', val: 1000000 },
                { label: '200만 원 이상', val: 2000000 },
              ].map(f => (
                <button
                  key={f.val}
                  type="button"
                  onClick={() => setThresholdAmount(f.val)}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all whitespace-nowrap ${
                    thresholdAmount === f.val
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-1">
                <input
                  type="number"
                  placeholder="직접 입력(만 원)"
                  value={customThresholdInput}
                  onChange={(e) => {
                    setCustomThresholdInput(e.target.value);
                    const parsed = Number(e.target.value) * 10000;
                    if (parsed >= 0) setThresholdAmount(parsed);
                  }}
                  className="w-28 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* 업로드 및 샘플 로더 버튼 */}
            <div className="flex items-center gap-2 flex-wrap">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>엑셀/CSV 파일 열기</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPasteArea(!showPasteArea)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>붙여넣기</span>
              </button>

              <button
                type="button"
                onClick={handleReloadSample}
                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="1년치 KB국민은행 및 신한카드 25건 샘플을 로드합니다"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>샘플 데이터 로드</span>
              </button>
            </div>

          </div>

          {/* 텍스트 복사-붙여넣기 영역 (토글 시 노출) */}
          {showPasteArea && (
            <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  📋 엑셀이나 은행 사이트에서 복사한 표를 그대로 붙여넣으세요 (일자, 거래처, 금액 등)
                </span>
                <button
                  type="button"
                  onClick={() => setShowPasteArea(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={3}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="예: 2025-08-10	이마트	385,000&#10;2025-08-25	월세	650,000"
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleApplyPastedText}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer shadow-sm"
                >
                  파싱하여 목록에 적용
                </button>
              </div>
            </div>
          )}

          {/* 2행: 세부 필터 (유형, 상태, 위험도, 검색어, 정렬) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              >
                <option value="ALL">모든 거래 구분</option>
                <option value="WITHDRAWAL">계좌 출금·이체만</option>
                <option value="CARD_PAYMENT">신용·체크카드만</option>
                <option value="ATM_CASH">ATM 현금인출만</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              >
                <option value="ALL">소명 상태 전체</option>
                <option value="UNRESOLVED">🔴 소명 미작성 건만</option>
                <option value="RESOLVED">🟢 소명 완료 건만</option>
              </select>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as any)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              >
                <option value="ALL">위험도 전체</option>
                <option value="DANGER_ONLY">🔴 사행성/사치 지출만</option>
                <option value="CAUTION_ONLY">🟡 현금인출/편파변제만</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="가맹점/적요 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs w-36 sm:w-44"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              >
                <option value="AMOUNT_DESC">금액 큰 순 (내림차순)</option>
                <option value="DATE_DESC">최신 거래순</option>
                <option value="RISK_FIRST">위험 거래 우선</option>
              </select>
            </div>

          </div>

        </div>

        {/* ═══ 4. 메인 콘텐츠: 법원 제출용 인쇄 미리보기 OR 거래내역 에디터 ═══ */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {isPrintPreview ? (
            /* 법원 제출용 A4 규격 미리보기 */
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  🏛️ 대한민국 법원 보정명령 제출 양식: 아래 표는 A4 규격으로 인쇄하거나 PDF로 저장할 수 있습니다.
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  지금 A4 인쇄하기
                </button>
              </div>

              <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 font-serif leading-relaxed text-xs">
                <h2 className="text-xl font-black text-center mb-6 tracking-wide underline underline-offset-8">
                  [별지] 통장 및 신용카드 거래내역 소명서 ({thresholdAmount / 10000}만 원 이상)
                </h2>
                
                <div className="flex justify-between border-b pb-2 mb-4 text-[11px] font-sans">
                  <div><strong>사건번호:</strong> {caseNumber}</div>
                  <div><strong>신청인(채무자):</strong> {clientName}</div>
                  <div><strong>관할:</strong> {courtName}</div>
                </div>

                <table className="w-full border-collapse border border-slate-400 text-center text-[10px] font-sans">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 p-1.5 w-8">연번</th>
                      <th className="border border-slate-300 p-1.5 w-20">거래일자</th>
                      <th className="border border-slate-300 p-1.5 w-24">금융기관/계좌</th>
                      <th className="border border-slate-300 p-1.5 w-14">구분</th>
                      <th className="border border-slate-300 p-1.5 w-28">상대방(가맹점)</th>
                      <th className="border border-slate-300 p-1.5 w-24">거래금액</th>
                      <th className="border border-slate-300 p-1.5">구체적 사용처 소명 내용</th>
                      <th className="border border-slate-300 p-1.5 w-24">소명자료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-1">{idx + 1}</td>
                        <td className="border border-slate-300 p-1 font-mono">{item.date}</td>
                        <td className="border border-slate-300 p-1 text-left truncate">{item.bankOrCard}</td>
                        <td className="border border-slate-300 p-1">
                          {item.transactionType === 'WITHDRAWAL' ? '출금' : 
                           item.transactionType === 'CARD_PAYMENT' ? '카드' : 
                           item.transactionType === 'ATM_CASH' ? 'ATM' : '입금'}
                        </td>
                        <td className="border border-slate-300 p-1 text-left font-bold truncate">{item.counterparty}</td>
                        <td className="border border-slate-300 p-1 font-mono font-bold text-right pr-2">
                          {item.amount.toLocaleString()}원
                        </td>
                        <td className="border border-slate-300 p-1.5 text-left leading-tight">
                          {item.explanation || <span className="text-red-500 font-bold">(미소명 - 작성 요망)</span>}
                        </td>
                        <td className="border border-slate-300 p-1 text-left text-[9px] text-slate-600">
                          {item.evidenceType || '영수증'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-8 text-right font-sans text-xs">
                  <p>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="mt-2">위 신청인(채무자): {clientName} (인)</p>
                  <p className="mt-1 font-bold">{courtName} 귀중</p>
                </div>
              </div>
            </div>
          ) : (
            /* 표준 거래내역 소명 인라인 에디터 리스트 */
            <div className="space-y-3">
              
              {/* 목록 카운터 */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-1">
                <span>
                  소명 대상 거래: 총 <strong className="text-indigo-600 dark:text-indigo-400">{filteredItems.length}</strong>건 표시 중 (전체 {items.length}건 중)
                </span>
                <span className="text-[11px]">
                  💡 칩 버튼(🛒식비, 🏠월세, 🏥병원비 등)을 누르면 법원 맞춤 표준 소명 문구가 1초 만에 입력됩니다.
                </span>
              </div>

              {filteredItems.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-3 text-slate-400">
                  <AlertOctagon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    선택한 조건({thresholdAmount / 10000}만 원 이상)에 해당하는 거래가 없습니다.
                  </p>
                  <p className="text-xs text-slate-400">
                    상단 필터에서 금액 기준을 낮추거나 &quot;샘플 데이터 로드&quot;를 눌러보세요.
                  </p>
                </div>
              ) : (
                filteredItems.map(item => {
                  const isDanger = item.riskCategory === 'DANGER_SPECULATION' || item.riskCategory === 'DANGER_LUXURY';
                  const isCaution = item.riskCategory === 'CAUTION_CASH' || item.riskCategory === 'CAUTION_TRANSFER';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 text-xs ${
                        item.isResolved && item.explanation.trim()
                          ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 shadow-xs'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 shadow-xs'
                      }`}
                    >
                      {/* 카드 상단: 일자, 금융사, 상대방명, 금액, 위험도 뱃지 */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            {item.date}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                            {item.bankOrCard}
                          </span>
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {item.counterparty}
                          </span>

                          {/* 위험도 뱃지 */}
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            isDanger 
                              ? 'bg-red-500 text-white' 
                              : isCaution 
                              ? 'bg-amber-500 text-slate-950 font-black' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {item.riskBadgeText}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-base text-rose-600 dark:text-rose-400">
                            -{item.amount.toLocaleString()}원
                          </span>
                          {item.isResolved && item.explanation.trim() ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              소명 완료
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold text-[10px]">
                              소명 필요
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 위험 조언 팁 (위험/주의 항목인 경우) */}
                      {(isDanger || isCaution) && item.riskAdvice && (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span><strong>법원 심사 주의:</strong> {item.riskAdvice}</span>
                        </div>
                      )}

                      {/* 소명 문구 프리셋 버튼 바 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>원클릭 표준 소명 문구 선택:</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {AUDIT_PRESET_TEMPLATES.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleApplyPreset(item.id, preset.templateText, preset.suggestedEvidence)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/70 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-colors flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                            >
                              <span>{preset.icon}</span>
                              <span>{preset.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 소명 입력창 및 증빙 선택 */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1">
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            placeholder="구체적 사용처 소명 내용을 작성하거나 위 칩 버튼을 클릭하세요..."
                            value={item.explanation}
                            onChange={(e) => handleExplanationChange(item.id, e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-medium placeholder:text-slate-400"
                          />
                        </div>
                        <div className="md:col-span-1">
                          <input
                            type="text"
                            placeholder="증빙: 영수증/이체증"
                            value={item.evidenceType || ''}
                            onChange={(e) => handleEvidenceChange(item.id, e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300"
                          />
                        </div>
                      </div>

                    </div>
                  );
                })
              )}

            </div>
          )}

        </div>

        {/* ═══ 5. 하단 푸터 액션 바 ═══ */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            {stats.resolvedCount}건 소명 완료 (진척도: {stats.resolvedRate}%) • 미소명 {stats.unresolvedCount}건
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>엑셀 다운로드</span>
            </button>

            {onSyncToCrmCorrection && !isClientMode && (
              <button
                type="button"
                onClick={handleSyncToCrm}
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>CRM 보정센터 소명표에 자동 반영</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
