import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Sparkles, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  Building2, CreditCard, Landmark, FileText, ArrowRight, Check,
  Smartphone, Lock, ExternalLink, ChevronRight, Scale, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  requestSimpleAuth, 
  fetchDebtDiscoveryResults, 
  getCachedDebtDiscovery,
  convertDiscoveryToRepaymentCreditors,
  convertDiscoveryToDebtItems,
  convertDiscoveryToDepositAsset,
  type AuthProviderType,
  type DebtDiscoveryResult,
  type CreditDebtItem,
  type TaxArrearItem,
  type BankAccountItem,
  type CourtLawsuitItem
} from '../../services/court/debtDiscoveryService';
import type { RepaymentCreditor, DebtCertificateItem, RepaymentAsset } from '../../services/repayment/repaymentTypes';

interface DebtDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientPhone?: string;
  // 부채증명서 발급 대행으로 반영할 때
  onImportToDebtCertificates?: (newItems: DebtCertificateItem[]) => void;
  // 변제계획안 채권자 및 청산가치 자산으로 반영할 때
  onImportToRepaymentPlan?: (newCreditors: RepaymentCreditor[], depositAsset?: RepaymentAsset) => void;
}

export default function DebtDiscoveryModal({
  isOpen,
  onClose,
  clientName = '홍길동',
  clientPhone = '010-0000-0000',
  onImportToDebtCertificates,
  onImportToRepaymentPlan
}: DebtDiscoveryModalProps) {
  // 인증 및 로딩 스텝
  // 'IDLE' | 'AUTH_WAIT' | 'FETCHING' | 'RESULT'
  const [step, setStep] = useState<'IDLE' | 'AUTH_WAIT' | 'FETCHING' | 'RESULT'>('IDLE');
  const [authProvider, setAuthProvider] = useState<AuthProviderType>('kakao');
  const [sessionId, setSessionId] = useState<string>('');
  const [authCountdown, setAuthCountdown] = useState<number>(180);

  // 스캔 단계 표시
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const scanAgencies = [
    { name: '한국신용정보원 (크레딧포유)', desc: '1·2금융권 대출 및 신용카드 채무' },
    { name: '국세청 홈택스 & 위택스', desc: '국세·지방세 체납 및 4대보험' },
    { name: '금융결제원 (어카운트인포)', desc: '전 금융기관 보유 계좌 및 예금 잔액' },
    { name: '대법원 나의사건검색', desc: '본인 명의 지급명령 및 가압류 사건' }
  ];

  // 조회 결과 데이터
  const [discoveryData, setDiscoveryData] = useState<DebtDiscoveryResult | null>(null);

  // 결과 화면 내 활성 탭
  const [activeTab, setActiveTab] = useState<'all' | 'credit' | 'tax' | 'bank' | 'court'>('all');

  // 선택된 항목 상태
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set());
  const [selectedTaxIds, setSelectedTaxIds] = useState<Set<string>>(new Set());
  const [importDepositAsset, setImportDepositAsset] = useState<boolean>(true);

  // 초기 로드 시 캐시 확인
  useEffect(() => {
    if (isOpen) {
      const cached = getCachedDebtDiscovery(clientName);
      if (cached) {
        setDiscoveryData(cached);
        setSelectedDebtIds(new Set(cached.creditDebts.map(d => d.id)));
        setSelectedTaxIds(new Set(cached.taxArrears.map(t => t.id)));
        setStep('RESULT');
      } else {
        setStep('IDLE');
      }
    }
  }, [isOpen, clientName]);

  // 카운트다운 타이머
  useEffect(() => {
    let timer: any;
    if (step === 'AUTH_WAIT' && authCountdown > 0) {
      timer = setInterval(() => {
        setAuthCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, authCountdown]);

  if (!isOpen) return null;

  // 1. 간편인증 요청
  const handleRequestAuth = async () => {
    try {
      const res = await requestSimpleAuth({
        clientName,
        phone: clientPhone,
        authProvider
      });
      setSessionId(res.sessionId);
      setAuthCountdown(180);
      setStep('AUTH_WAIT');
      toast.info(res.message || '인증 요청이 발송되었습니다.');
    } catch (err: any) {
      toast.error(err.message || '간편인증 요청에 실패했습니다.');
    }
  };

  // 2. 스마트폰 인증 승인 후 결과 수집 시뮬레이션/실제 호출
  const handleConfirmAuthAndScan = async () => {
    setStep('FETCHING');
    setScanStepIndex(0);

    // 4개 기관 순차 스캔 애니메이션
    for (let i = 0; i < scanAgencies.length; i++) {
      setScanStepIndex(i);
      await new Promise(r => setTimeout(r, 450));
    }

    try {
      const result = await fetchDebtDiscoveryResults({
        clientName,
        phone: clientPhone,
        authProvider,
        sessionId
      });

      setDiscoveryData(result);
      // 기본적으로 모든 금융채무와 세금체납을 기본 선택
      setSelectedDebtIds(new Set(result.creditDebts.map(d => d.id)));
      setSelectedTaxIds(new Set(result.taxArrears.map(t => t.id)));
      setStep('RESULT');
      toast.success('4대 공공·금융기관 전수조회가 완료되었습니다.');
    } catch (err: any) {
      toast.error(err.message || '전수조회 데이터를 불러오지 못했습니다.');
      setStep('AUTH_WAIT');
    }
  };

  // 선택 토글 핸들러
  const toggleDebt = (id: string) => {
    const next = new Set(selectedDebtIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDebtIds(next);
  };

  const toggleTax = (id: string) => {
    const next = new Set(selectedTaxIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTaxIds(next);
  };

  // 선택된 항목 집계
  const selectedCreditDebts = useMemo(() => {
    if (!discoveryData) return [];
    return discoveryData.creditDebts.filter(d => selectedDebtIds.has(d.id));
  }, [discoveryData, selectedDebtIds]);

  const selectedTaxArrears = useMemo(() => {
    if (!discoveryData) return [];
    return discoveryData.taxArrears.filter(t => selectedTaxIds.has(t.id));
  }, [discoveryData, selectedTaxIds]);

  const selectedTotalPrincipal = useMemo(() => {
    const debtSum = selectedCreditDebts.reduce((sum, d) => sum + (d.currentBalance || d.originalAmount), 0);
    const taxSum = selectedTaxArrears.reduce((sum, t) => sum + t.arrearAmount, 0);
    return debtSum + taxSum;
  }, [selectedCreditDebts, selectedTaxArrears]);

  // 부채증명서 발급 대행으로 반영
  const handleApplyToDebtCertificates = () => {
    if (!discoveryData) return;
    if (selectedCreditDebts.length === 0) {
      toast.error('등록할 금융 채무를 최소 1건 이상 선택해 주세요.');
      return;
    }

    const debtItems = convertDiscoveryToDebtItems(selectedCreditDebts);
    if (onImportToDebtCertificates) {
      onImportToDebtCertificates(debtItems);
      toast.success(`${debtItems.length}건의 채무가 부채증명서 발급 대행 목록에 추가되었습니다.`);
      onClose();
    }
  };

  // 변제계획안 채권자 및 재산으로 반영
  const handleApplyToRepaymentPlan = () => {
    if (!discoveryData) return;
    if (selectedCreditDebts.length === 0 && selectedTaxArrears.length === 0) {
      toast.error('등록할 채무 또는 세금 체납을 최소 1건 이상 선택해 주세요.');
      return;
    }

    const creditors = convertDiscoveryToRepaymentCreditors(selectedCreditDebts, selectedTaxArrears);
    let depositAsset: RepaymentAsset | undefined;

    if (importDepositAsset && discoveryData.bankAccounts.length > 0) {
      depositAsset = convertDiscoveryToDepositAsset(discoveryData.bankAccounts);
    }

    if (onImportToRepaymentPlan) {
      onImportToRepaymentPlan(creditors, depositAsset);
      toast.success(
        `채권자 ${creditors.length}건${depositAsset ? ' 및 예금 청산가치' : ''}이 변제계획안에 반영되었습니다.`
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ── 1. 모달 상단 헤더 ── */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  간편인증 원클릭 숨은 채무·체납 전수조회
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                  4대 기관 통합
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                신용정보원(대출·카드) · 국세청/위택스(조세) · 어카운트인포(계좌) · 대법원(사건) 실시간 연동
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === 'RESULT' && (
              <button
                onClick={() => setStep('IDLE')}
                className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>재조회</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. 바디 영역 (스텝별 전환) ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* STEP 1: 간편인증 선택 및 요청 */}
          {step === 'IDLE' && (
            <div className="max-w-xl mx-auto py-4 space-y-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                <Smartphone className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  간편인증으로 10초 만에 채무를 불러옵니다
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  외부 사이트 5곳을 일일이 방문하여 서류를 발급받을 필요 없이,<br />
                  카카오톡 또는 PASS 간편인증 1회로 누락된 채무를 찾아냅니다.
                </p>
              </div>

              {/* 신청인 정보 요약 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">조회 대상자:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{clientName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">휴대폰 번호:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{clientPhone}</span>
                </div>
              </div>

              {/* 인증 기관 선택 */}
              <div className="space-y-3 text-left">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  간편인증 수단 선택
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthProvider('kakao')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      authProvider === 'kakao'
                        ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/20 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xl mb-1">💬</div>
                    <div className="text-xs font-bold">카카오톡</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthProvider('pass')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      authProvider === 'pass'
                        ? 'border-red-500 bg-red-50/70 dark:bg-red-950/30 text-red-950 dark:text-red-200 ring-2 ring-red-500/20 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xl mb-1">🛡️</div>
                    <div className="text-xs font-bold">PASS 앱</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthProvider('toss')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      authProvider === 'toss'
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xl mb-1">🔵</div>
                    <div className="text-xs font-bold">토스</div>
                  </button>
                </div>
              </div>

              {/* 보안 및 동의 안내 */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Lock className="w-3.5 h-3.5" />
                <span>개인정보보호법 및 신용정보법에 따라 조회 목적 외 일체 저장되지 않습니다.</span>
              </div>

              <button
                type="button"
                onClick={handleRequestAuth}
                className="w-full py-3.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>간편인증 요청 발송</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: 스마트폰 인증 대기 */}
          {step === 'AUTH_WAIT' && (
            <div className="max-w-md mx-auto py-8 space-y-6 text-center animate-fadeIn">
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-100 dark:border-indigo-950 border-t-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Smartphone className="w-8 h-8 animate-pulse" />
                </div>
              </div>

              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  스마트폰에서 인증을 완료해 주세요
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {authProvider === 'kakao' ? '카카오톡 지갑' : authProvider === 'toss' ? '토스 앱' : 'PASS 앱'}에서 알림이 도착했습니다.<br />
                  화면의 서명 확인 버튼을 눌러주세요.
                </p>
                <div className="inline-block mt-3 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-mono font-bold">
                  남은 시간: {Math.floor(authCountdown / 60)}분 {authCountdown % 60}초
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmAuthAndScan}
                  className="w-full py-3.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>스마트폰에서 인증을 완료했습니다 (조회 시작)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('IDLE')}
                  className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  인증 취소 및 처음으로
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: 4대 기관 실시간 스크래핑 프로그레스 */}
          {step === 'FETCHING' && (
            <div className="max-w-lg mx-auto py-8 space-y-6 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>실시간 전산망 데이터 수집 중...</span>
                </div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  4대 기관의 채무 및 계좌 내역을 분석하고 있습니다
                </h4>
              </div>

              <div className="space-y-3">
                {scanAgencies.map((agency, idx) => {
                  const isDone = idx < scanStepIndex;
                  const isCurrent = idx === scanStepIndex;
                  return (
                    <div
                      key={agency.name}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isDone
                          ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
                          : isCurrent
                          ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-400/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isCurrent
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}>
                          {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold">{agency.name}</div>
                          <div className="text-[11px] opacity-75">{agency.desc}</div>
                        </div>
                      </div>

                      <div className="text-xs font-medium">
                        {isDone && <span className="text-emerald-600 font-bold">수집 완료</span>}
                        {isCurrent && <span className="text-indigo-600 font-bold animate-pulse">조회 중...</span>}
                        {!isDone && !isCurrent && <span className="text-slate-400">대기</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: 발굴 결과 대시보드 및 선택 */}
          {step === 'RESULT' && discoveryData && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* 종합 브리핑 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
                  <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                    <span>금융권 채무</span>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {(discoveryData.summary.totalCreditDebtAmount / 10000).toLocaleString()}만원
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    총 {discoveryData.summary.totalCreditDebtCount}건 (대출·카드)
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900">
                  <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-bold">
                    <span>우선권 조세·체납</span>
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
                    {(discoveryData.summary.totalTaxArrearAmount / 10000).toLocaleString()}만원
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    총 {discoveryData.summary.totalTaxArrearCount}건 (국세·지방세)
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900">
                  <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>전 은행 계좌 잔액</span>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {(discoveryData.summary.totalDepositBalance / 10000).toLocaleString()}만원
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    청산가치 반영: {(discoveryData.summary.excessDepositLiquidation / 10000).toLocaleString()}만원
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900">
                  <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-bold">
                    <span>법원 계류 사건</span>
                    <Scale className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {discoveryData.summary.totalCourtCaseCount}건 발견
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                    지급명령·가압류 추심
                  </div>
                </div>
              </div>

              {/* 탭 네비게이션 */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    전체 보기 ({discoveryData.creditDebts.length + discoveryData.taxArrears.length}건)
                  </button>
                  <button
                    onClick={() => setActiveTab('credit')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'credit'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    대출·카드 ({discoveryData.creditDebts.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('tax')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'tax'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    조세·체납 ({discoveryData.taxArrears.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('bank')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'bank'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    계좌·예금 ({discoveryData.bankAccounts.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('court')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'court'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    법원사건 ({discoveryData.courtCases.length})
                  </button>
                </div>

                <div className="text-xs text-slate-500">
                  선택 합계: <span className="font-black text-indigo-600 dark:text-indigo-400">{(selectedTotalPrincipal / 10000).toLocaleString()}만 원</span>
                </div>
              </div>

              {/* 탭 내용 1: 금융권 대출/카드 채무 */}
              {(activeTab === 'all' || activeTab === 'credit') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>한국신용정보원 대출 및 카드 채무 ({discoveryData.creditDebts.length}건)</span>
                    </h5>
                    <span className="text-[11px] text-slate-400">
                      체크된 항목이 변제계획안 및 부채증명서 목록으로 연동됩니다
                    </span>
                  </div>

                  <div className="space-y-2">
                    {discoveryData.creditDebts.map((debt) => {
                      const isSelected = selectedDebtIds.has(debt.id);
                      return (
                        <div
                          key={debt.id}
                          onClick={() => toggleDebt(debt.id)}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  {debt.creditorName}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                                  {debt.debtType}
                                </span>
                                {debt.isSecured && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                                    별제권 담보
                                  </span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold">
                                  📍 주소자동매핑
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                관리번호: {debt.accountNo} · 개설일: {debt.openedDate} · 관리점: {debt.branchName}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black text-slate-900 dark:text-white">
                              {(debt.currentBalance / 10000).toLocaleString()}만원
                            </div>
                            <div className="text-[11px] text-slate-400">
                              원금: {(debt.originalAmount / 10000).toLocaleString()}만원 · {debt.status}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 탭 내용 2: 조세 및 공과금 체납 */}
              {(activeTab === 'all' || activeTab === 'tax') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4" />
                      <span>국세청·지방세·4대보험 체납 내역 (법 제415조 일반우선권 채권)</span>
                    </h5>
                    <span className="text-[11px] text-rose-600 font-bold">
                      회생계획안에서 100% 우선 변제 필요
                    </span>
                  </div>

                  <div className="space-y-2">
                    {discoveryData.taxArrears.map((tax) => {
                      const isSelected = selectedTaxIds.has(tax.id);
                      return (
                        <div
                          key={tax.id}
                          onClick={() => toggleTax(tax.id)}
                          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-rose-600 border-rose-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                  {tax.agencyName}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                                  {tax.taxType}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold">
                                  {tax.priorityClass}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                귀속: {tax.taxYear} · 납기: {tax.dueDate} {tax.hasSeizure && `· ⚠️ ${tax.seizureDetail}`}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                              {(tax.arrearAmount / 10000).toLocaleString()}만원
                            </div>
                            <div className="text-[11px] text-slate-400">
                              우선권 100% 변제 배분
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 탭 내용 3: 계좌정보통합관리 (어카운트인포) */}
              {(activeTab === 'all' || activeTab === 'bank') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4" />
                      <span>금융결제원 어카운트인포 전 은행 계좌 ({discoveryData.bankAccounts.length}개)</span>
                    </h5>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importDepositAsset}
                        onChange={(e) => setImportDepositAsset(e.target.checked)}
                        className="rounded accent-emerald-600"
                      />
                      <span>185만 원 초과분({(discoveryData.summary.excessDepositLiquidation / 10000).toLocaleString()}만) 청산가치 재산목록에 반영</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {discoveryData.bankAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span>{acc.bankName}</span>
                            {acc.isDormant && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">휴면</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {acc.accountNo} ({acc.accountType})
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-slate-900 dark:text-white">
                            {acc.balance.toLocaleString()}원
                          </div>
                          <div className="text-[10px] text-slate-400">최근: {acc.lastTransDate}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 탭 내용 4: 대법원 나의사건검색 계류 사건 */}
              {(activeTab === 'all' || activeTab === 'court') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Scale className="w-4 h-4" />
                      <span>대법원 본인 소송·지급명령·가압류 사건 ({discoveryData.courtCases.length}건)</span>
                    </h5>
                    <span className="text-[11px] text-slate-400">
                      숨어있던 양도 채권자 및 추심업체 자동 발굴
                    </span>
                  </div>

                  <div className="space-y-2">
                    {discoveryData.courtCases.map((cs) => (
                      <div
                        key={cs.id}
                        className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 text-xs flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {cs.courtName} {cs.caseNumber}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                              {cs.caseType}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              접수: {cs.filingDate}
                            </span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">
                            채권자(원고): <strong className="text-slate-900 dark:text-white">{cs.plaintiff}</strong> · 청구금액: {(cs.claimAmount / 10000).toLocaleString()}만원 ({cs.status})
                          </div>
                          <div className="text-[11px] text-amber-800 dark:text-amber-300/90 font-medium">
                            💡 {cs.hint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* ── 3. 모달 하단 액션 버튼 ── */}
        {step === 'RESULT' && discoveryData && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              선택된 채무: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedCreditDebts.length}건</strong> · 
              선택된 세금: <strong className="text-rose-600 dark:text-rose-400 font-bold">{selectedTaxArrears.length}건</strong> · 
              총액: <strong className="text-slate-900 dark:text-white font-black">{(selectedTotalPrincipal / 10000).toLocaleString()}만 원</strong>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {onImportToDebtCertificates && (
                <button
                  type="button"
                  onClick={handleApplyToDebtCertificates}
                  className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>부채증명서 발급목록 추가</span>
                </button>
              )}

              {onImportToRepaymentPlan && (
                <button
                  type="button"
                  onClick={handleApplyToRepaymentPlan}
                  className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>변제계획안 채권자목록으로 일괄 반영</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
