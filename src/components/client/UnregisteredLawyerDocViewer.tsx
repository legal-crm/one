import React, { useState, useEffect } from 'react';
import {
  Scale, FileText, Calculator, Printer, AlertCircle, Mic, ArrowRight, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import {
  peekDocSharePackage,
  openDocSharePackage,
  LawyerDocSharePackage,
} from '../../services/lawyerDocShareService';

interface UnregisteredLawyerDocViewerProps {
  token: string;
  /** @deprecated 역할 전환은 실제 로그인으로만 — 호환용으로 남겨 두지만 호출하지 않음 */
  onLawyerRegistered?: (lawyerId: string) => void;
  onNavigateHome?: () => void;
}

/**
 * 변호사·사무장 서류 열람 (의뢰인이 공유한 링크)
 * - 서버(doc_share_packages)에서 링크 확인 → 수신 휴대폰 번호 입력 시 서버가 대조 후 열람 (5회 오입력 잠금)
 * - 기존의 '5초 간이 가입'·'정식 파트너 전환'은 본인 확인 없이 변호사 권한을 부여하고 가짜 사건을 CRM에 넣던 기능이라 제거
 */
export default function UnregisteredLawyerDocViewer({
  token,
  onNavigateHome
}: UnregisteredLawyerDocViewerProps) {
  const [pkg, setPkg] = useState<LawyerDocSharePackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [locked, setLocked] = useState(false);
  const [phoneLast4, setPhoneLast4] = useState('');
  const [phone, setPhone] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [activeTab, setActiveTab] = useState<'statement' | 'incomeExpense' | 'property'>('statement');

  useEffect(() => {
    let cancelled = false;
    peekDocSharePackage(token).then(r => {
      if (cancelled) return;
      setLinkValid(!!r.ok);
      setLocked(!!r.locked);
      setPhoneLast4(r.phoneLast4 || '');
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  const goHome = () => {
    if (onNavigateHome) onNavigateHome();
    else window.location.href = window.location.origin;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4" role="status">
        <p className="text-sm text-slate-300">서류 링크를 확인하는 중입니다...</p>
      </div>
    );
  }

  if (!linkValid || locked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-black text-white">
            {locked ? '확인 번호를 여러 번 잘못 입력해 열람이 잠겼습니다' : '만료되었거나 올바르지 않은 링크입니다'}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            서류 공유 링크는 7일간 유효합니다. 의뢰인에게 새 링크를 요청해 주세요.
          </p>
          <button type="button" onClick={goHome} className="px-5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold">
            마이김변 홈으로 이동
          </button>
        </div>
      </div>
    );
  }

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('링크를 받은 휴대폰 번호를 입력해 주세요.'); return; }
    setIsOpening(true);
    const r = await openDocSharePackage(token, digits);
    setIsOpening(false);
    if (r.ok === false) {
      if (r.reason === 'locked') { setLocked(true); return; }
      if (r.reason === 'mismatch') { toast.error(`번호가 일치하지 않습니다. (남은 시도 ${r.remaining ?? 0}회)`); return; }
      toast.error('서류를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setPkg(r.pkg);
  };

  const won = (n: number | undefined) => (n || 0).toLocaleString();

  // ══ GATE: 수신 휴대폰 번호 확인 ══
  if (!pkg) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4">
        <form onSubmit={handleOpen} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">의뢰인 공유 서류 열람</h2>
              <p className="text-sm text-slate-300">링크를 받은 휴대폰 번호를 입력해 주세요.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ds-phone" className="text-sm font-bold text-slate-200 block">
              휴대폰 번호 {phoneLast4 && <span className="text-slate-400 font-normal">(끝자리 {phoneLast4})</span>}
            </label>
            <input
              id="ds-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="010-0000-0000"
              className="w-full px-3.5 min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400">5회 잘못 입력하면 열람이 잠깁니다.</p>
          </div>
          <button type="submit" disabled={isOpening} className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <span>{isOpening ? '확인 중...' : '서류 열람하기'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    );
  }

  // ══ UNLOCKED: 서류 열람 ══
  const stmt = pkg.docs.statementData;
  const inc = pkg.docs.incomeExpenseData;
  const prop = pkg.docs.propertySummary;
  const debt = pkg.docs.debtSummary;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-white truncate">의뢰인 공유 서류 열람</h1>
            <p className="text-xs text-slate-300 truncate">
              받는 분: {pkg.recipientFirmName ? `[${pkg.recipientFirmName}] ` : ''}{pkg.recipientName} {pkg.recipientType === 'LAWYER' ? '변호사님' : '사무장님'} · {new Date(pkg.expiresAt).toLocaleDateString('ko-KR')}까지 열람 가능
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 shrink-0"
        >
          <Printer className="w-4 h-4" aria-hidden="true" />
          <span>A4 인쇄</span>
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 text-left">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div>
            <span className="text-xs text-slate-300">관할: {debt?.courtName || stmt?.courtName || '미기재'}</span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              의뢰인 <span className="text-emerald-300">{pkg.clientName}</span> 님이 작성한 서류 초안
            </h2>
            {pkg.memo && <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">"{pkg.memo}"</p>}
          </div>
          {debt && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800"><span className="text-slate-400 block">총 채무액</span><span className="font-bold text-white">{won(debt.totalDebt)}원</span></div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800"><span className="text-slate-400 block">월 소득</span><span className="font-bold text-white">{won(debt.monthlyIncome)}원</span></div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800"><span className="text-slate-400 block">예상 월 변제금</span><span className="font-bold text-white">{won(debt.monthlyPayment)}원</span></div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800"><span className="text-slate-400 block">예상 탕감률(참고)</span><span className="font-bold text-white">{debt.expectedReductionRate ? `${debt.expectedReductionRate}%` : '-'}</span></div>
            </div>
          )}
          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            의뢰인이 마이김변에서 직접 작성한 초안이며 법원 제출 요건 충족 여부는 검토되지 않았습니다. 사실관계와 수치를 확인한 뒤 사용해 주세요.
          </p>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-slate-200">변호사 회원으로 가입하면 마이김변에서 의뢰인 상담·서류를 관리할 수 있습니다. (가입 시 변호사 등록번호 확인 절차가 있습니다)</p>
          <a href="/?role=lawyer" className="px-4 min-h-[44px] bg-white text-slate-950 rounded-xl text-sm font-black flex items-center justify-center shrink-0 whitespace-nowrap">
            변호사 회원 안내
          </a>
        </div>

        {/* ═══ 서류 탭 네비게이션 ═══ */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'statement'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>진술서</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('incomeExpense')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'incomeExpense'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>수입·지출</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('property')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'property'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>재산 요약</span>
          </button>
        </div>

        {/* ═══ 탭별 서류 뷰어 ═══ */}
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-left space-y-6">
          
          {/* TAB 1: 법원 진술서 */}
          {activeTab === 'statement' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">
                    진술서 (의뢰인 작성 초안)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    사건본인: {stmt?.applicantName || pkg.clientName} | 관할: {stmt?.courtName || '서울회생법원'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  의뢰인 작성 초안
                </span>
              </div>

              {/* 1. 직업 및 경력 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. 최종학력 및 최근 직업·경력 이력
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800 text-slate-300 font-bold">
                      <tr>
                        <th className="p-3">기간</th>
                        <th className="p-3">직장명 / 상호</th>
                        <th className="p-3">직위 / 업종</th>
                        <th className="p-3">퇴직 및 폐업 사유</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {(stmt?.jobHistories || (stmt as any)?.careers || []).map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-850">
                          <td className="p-3 font-mono">{c.period}</td>
                          <td className="p-3 font-bold text-white">{c.companyName}</td>
                          <td className="p-3">{c.position}</td>
                          <td className="p-3 text-slate-400">{c.reasonForLeaving}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. 주거 현황 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. 현재 주거 상황 및 임차 조건
                </h4>
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">주거 유형</span>
                    <span className="font-bold text-white">{stmt?.residence?.residenceTypeLabel || '임차(월세)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">보증금</span>
                    <span className="font-bold text-white">{won(stmt?.residence?.deposit)}원</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">월세</span>
                    <span className="font-bold text-white">{won(stmt?.residence?.monthlyRent)}원</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">거주지</span>
                    <span className="font-bold text-white">{stmt?.residence?.addressSummary || '서울'}</span>
                  </div>
                </div>
              </div>

              {/* 3. 채무 발생 및 증대 4단 사연 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>3. 채무 발생 원인 및 지급불능 경위 (법원 표준 4단 구성)</span>
                  <span className="text-[10px] text-emerald-400 font-normal">AI 음성 인터뷰 정돈 완료</span>
                </h4>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-indigo-400 text-[11px] block">
                      ① 첫 채무 발생 원인 및 계기
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.initialCauseDetail || '생활비 및 운영자금 부족으로 인한 채무 개시'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-indigo-400 text-[11px] block">
                      ② 채무가 급격히 증대한 과정 (돌려막기 등)
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.growthProcessDetail || '고금리 대출 및 카드 돌려막기 누적'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-rose-400 text-[11px] block">
                      ③ 스스로 더 이상 감당할 수 없게 된 지급불능 시점
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.insolvencyTriggerDetail || '월 원리금 상환액이 월 소득을 초과'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-emerald-400 text-[11px] block">
                      ④ 현재 생활 상황 및 성실 변제 다짐
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.resolutionAndApology || '성실한 변제계획 수행을 통한 경제적 재기 다짐'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 12개월 수지표 */}
          {activeTab === 'incomeExpense' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">
                    수입 및 지출 목록 (의뢰인 작성 초안)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    소득 구분: {inc?.detailedIncomeType || '개인사업자/프리랜서'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  12개월 원장 산출 완료
                </span>
              </div>

              {/* 월평균 요약 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">월평균 총매출/수입</span>
                  <span className="text-sm font-black text-white">{won(inc?.monthlyLedger?.monthlyAverages?.avgGrossRevenue)}원</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">월평균 인정 필요경비</span>
                  <span className="text-sm font-black text-rose-400">{won(inc?.monthlyLedger?.monthlyAverages?.avgOperatingExpense)}원</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">월평균 순소득</span>
                  <span className="text-sm font-black text-emerald-400">{won(inc?.monthlyLedger?.monthlyAverages?.avgNetIncome)}원</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">가구원 수</span>
                  <span className="text-sm font-black text-indigo-200">{(inc as any)?.expenses?.householdSize ? `${(inc as any).expenses.householdSize}인` : '-'}</span>
                </div>
              </div>

              {/* 12개월 장부 테이블 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  최근 12개월 월별 수입 및 경비 원장 (법원 제출 규격)
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800 text-slate-300 font-bold">
                      <tr>
                        <th className="p-3">귀속월</th>
                        <th className="p-3">카드매출</th>
                        <th className="p-3">현금매출</th>
                        <th className="p-3">월세/임차료</th>
                        <th className="p-3">영업필수경비</th>
                        <th className="p-3 text-right">월 순소득</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {(inc?.monthlyLedger?.months || []).slice(0, 6).map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-850">
                          <td className="p-3 font-mono text-slate-400">{m.monthLabel}</td>
                          <td className="p-3 font-mono">{won(m.incomeCard)}원</td>
                          <td className="p-3 font-mono">{won(m.incomeCash)}원</td>
                          <td className="p-3 font-mono">{won(m.expenseRent)}원</td>
                          <td className="p-3 font-mono text-rose-300">{won(m.expenseOperating)}원</td>
                          <td className="p-3 font-mono font-bold text-emerald-400 text-right">{won(m.netIncome)}원</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 재산 및 채무 종합 */}
          {activeTab === 'property' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-white">
                  재산상황표 및 청산가치 보장의 원칙 검토
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  총 채무 {won(debt?.totalDebt)}원 대비 청산가치 {won(prop?.totalAssetValue)}원
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">임차보증금 (공제 후)</span>
                  <span className="text-base font-black text-white">{won(prop?.depositAmount)}원</span>
                  <p className="text-[10px] text-slate-500">서울 소액임차보증금 면제 규정 검토</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">차량 및 환가재산</span>
                  <span className="text-base font-black text-white">{won(prop?.vehicleValue)}원</span>
                  <p className="text-[10px] text-slate-500">중고차 시세 기준 청산가치</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">청산가치 총액</span>
                  <span className="text-base font-black text-indigo-400">{won(prop?.totalAssetValue)}원</span>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
