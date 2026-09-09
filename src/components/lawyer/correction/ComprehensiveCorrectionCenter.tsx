import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Calendar, Clock, Plus, Trash2, CheckCircle2, 
  FileText, Send, RefreshCw, Printer, Download, Sparkles, 
  ChevronRight, ArrowRight, ShieldAlert, Check, X, Building2, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  CorrectionBriefData, 
  RecentLoanUsageItem, 
  CreditCardUsageItem, 
  HighValueTransactionItem,
  IncomeCalculationMonth,
  InsuranceSurrenderItem,
  PastCaseComparisonItem,
  FamilyAssetOriginItem,
  CorrectionDocumentRequestItem
} from '../../../types/correctionTypes';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import CorrectionBriefModal from './CorrectionBriefModal';

interface ComprehensiveCorrectionCenterProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
  onNavigateToRepayment?: () => void;
}

export default function ComprehensiveCorrectionCenter({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사',
  onNavigateToRepayment
}: ComprehensiveCorrectionCenterProps) {
  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const caseNumber = crmExt.courtCase?.caseNumber || '2026개회(접수대기)';

  // 1. 현재 관리 중인 보정 데이터 (초기값 설정)
  const [activeRound, setActiveRound] = useState<number>(1);
  const [briefTab, setBriefTab] = useState<'write' | 'docs' | 'plan_sync' | 'print'>('write');
  const [explanationSubTab, setExplanationSubTab] = useState<
    'loan' | 'card' | 'high_trans' | 'income' | 'insurance' | 'past_case' | 'family_asset'
  >('loan');

  // 송달일 및 기한 관리 (기본 14일)
  const [servedDate, setServedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 기한 계산 (송달일 + 14일)
  const dueDate = useMemo(() => {
    const d = new Date(servedDate);
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  }, [servedDate]);

  // D-Day 계산
  const dDay = useMemo(() => {
    const due = new Date(dueDate + 'T23:59:59').getTime();
    const now = Date.now();
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  }, [dueDate]);

  // 7대 소명표 상태값
  const [recentLoans, setRecentLoans] = useState<RecentLoanUsageItem[]>([
    {
      id: 'loan-1',
      loanDate: '2025-08-15',
      lenderName: '신한저축은행',
      amount: 15000000,
      usageCategory: 'DEBT_REPAYMENT',
      specificUsage: '기존 국민카드 및 삼성카드 연체 대금 상환에 전액 충당',
      evidenceDocName: '금융거래확인서 및 대환송금증',
      verified: true
    }
  ]);

  const [creditCards, setCreditCards] = useState<CreditCardUsageItem[]>([
    {
      id: 'card-1',
      transactionDate: '2025-10-02',
      cardCompany: '현대카드',
      merchantName: '이마트 및 동네마트',
      amount: 450000,
      purpose: '4인 가족 기본 생필품 및 식료품 구매',
      isLuxuryOrGambling: false,
      evidenceNote: '카드 이용내역서 및 영수증'
    }
  ]);

  const [highValueTrans, setHighValueTrans] = useState<HighValueTransactionItem[]>([
    {
      id: 'trans-1',
      transDate: '2025-09-10',
      bankName: '국민은행',
      transType: 'WITHDRAWAL',
      amount: 1200000,
      counterparty: '홍길동(모)',
      purposeDetail: '어머니 병원 입원 및 수술비 지원 (진단서 첨부)',
      evidenceDocName: '계좌이체확인증'
    }
  ]);

  const [monthlyIncomes, setMonthlyIncomes] = useState<IncomeCalculationMonth[]>([
    { month: '2025-11', grossPay: 3200000, statutoryDeductions: 450000, netPay: 2750000, note: '기본급' },
    { month: '2025-12', grossPay: 3350000, statutoryDeductions: 470000, netPay: 2880000, note: '연말 성과급 일부' },
    { month: '2026-01', grossPay: 3200000, statutoryDeductions: 450000, netPay: 2750000, note: '기본급' }
  ]);

  const [insurances, setInsurances] = useState<InsuranceSurrenderItem[]>([
    {
      id: 'ins-1',
      insurerName: '삼성생명',
      policyNumber: '112-9984-21',
      insuredPerson: clientName,
      contractorName: clientName,
      surrenderRefund: 2200000,
      loanAgainstPolicy: 0,
      netRefund: 2200000,
      statutoryExemption: 1500000,
      liquidationInclusion: 700000,
      isEssentialMedical: true
    }
  ]);

  const [pastCases, setPastCases] = useState<PastCaseComparisonItem[]>([]);
  const [familyAssets, setFamilyAssets] = useState<FamilyAssetOriginItem[]>([]);

  // 의뢰인 추가 소명서류 요청 목록
  const [docRequests, setDocRequests] = useState<CorrectionDocumentRequestItem[]>([
    {
      id: 'req-1',
      docTitle: '최근 1년 주거래은행 전체 입출금거래내역서 (엑셀/PDF)',
      targetTarget: '본인',
      description: '50만 원 이상 거래내역에 마커 표기하여 제출 요망',
      status: 'SUBMITTED',
      evidenceNumber: '소갑 제1호증의 1'
    },
    {
      id: 'req-2',
      docTitle: '보험 해약환급금 증명서 및 예상해약환급금 확인서',
      targetTarget: '본인',
      description: '생명/손해보험협회 조회결과 및 각 보험사 환급금 내역',
      status: 'APPROVED',
      evidenceNumber: '소갑 제2호증'
    }
  ]);

  // 보정 답변 항목
  const [answers, setAnswers] = useState<{ pointNumber: number; courtInstruction: string; debtorResponse: string; attachedEvidence?: string }[]>([
    {
      pointNumber: 1,
      courtInstruction: '최근 1년 이내에 발생한 채무(신한저축은행 대출금 1,500만 원)의 구체적 사용처를 소명하고 통장거래내역 등 객관적 자료를 제출할 것.',
      debtorResponse: '신한저축은행 대출금 1,500만 원은 기존 고금리 카드대금(국민카드 800만 원, 삼성카드 700만 원)을 대환 상환하는 데 전액 충당되었으며, 사치나 유흥 또는 재산 은닉에 사용된 바가 전혀 없습니다. 이에 대환 상환 이체증을 첨부하여 소명합니다.',
      attachedEvidence: '소갑 제1호증 (대환 상환 계좌이체확인증)'
    },
    {
      pointNumber: 2,
      courtInstruction: '보험 해약환급금 합계액 중 150만 원을 초과하는 금액은 청산가치에 반영하여 수정 재산목록 및 수정 변제계획안을 제출할 것.',
      debtorResponse: '삼성생명 보장성 보험의 순 해약환급금 220만 원 중 법정 압류금지액 150만 원을 공제한 잔여액 70만 원을 청산가치에 성실히 반영하였으며, 이에 따른 수정 재산목록 및 수정 변제계획안을 함께 제출합니다.',
      attachedEvidence: '소갑 제2호증 (수정 변제계획안 및 재산목록)'
    }
  ]);

  // 보정서 인쇄 모달 상태
  const [showPrintModal, setShowPrintModal] = useState(false);
  // 기한연장신청서 모달 상태
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  // 통합 보정 데이터 객체 생성
  const fullBriefData: CorrectionBriefData = useMemo(() => ({
    id: `brief-${activeRound}`,
    round: activeRound,
    title: `제${activeRound}차 보정권고에 대한 보정서`,
    courtName,
    caseNumber,
    debtorName: clientName,
    agentName: activeLawyerName,
    servedDate,
    dueDate,
    dDay,
    isOverdue: dDay < 0,
    answers,
    recentLoans,
    creditCards,
    highValueTrans,
    monthlyIncomes,
    insurances,
    pastCases,
    familyAssets,
    docRequests,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }), [
    activeRound, courtName, caseNumber, clientName, activeLawyerName, 
    servedDate, dueDate, dDay, answers, recentLoans, creditCards, 
    highValueTrans, monthlyIncomes, insurances, pastCases, familyAssets, docRequests
  ]);

  // 기한 연장 신청서 작성 처리
  const handleRequestExtension = () => {
    setShowExtensionModal(false);
    toast.success('📅 1개월 보정기한 연장신청서(기한연장신청서)가 법원 전자소송 제출 규격으로 생성되었습니다!');
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── 1. 보정 커맨드 센터 상단 헤더 ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center text-xl font-bold">
              📮
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  법원 보정권고/명령 통합 관리 센터
                </h3>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${
                  dDay <= 3 
                    ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse' 
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {dDay < 0 ? `🚨 기한 초과 (${Math.abs(dDay)}일 경과)` : dDay === 0 ? '🚨 오늘 제출 마감 (D-Day)' : `⏳ D-${dDay}일 남음`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                사건번호: <strong className="text-slate-800">{caseNumber}</strong> · 관할: {courtName} · 회생위원 앞 소명
              </p>
            </div>
          </div>

          {/* 차수 선택 & 기한연장 & 출력 버튼 바 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 차수 선택 탭 */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[1, 2, 3].map(r => (
                <button
                  key={r}
                  onClick={() => setActiveRound(r)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeRound === r ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  제{r}차
                </button>
              ))}
            </div>

            {/* 1개월 기한연장 신청 버튼 */}
            <button
              onClick={() => setShowExtensionModal(true)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>기한연장신청서</span>
            </button>

            {/* 법원 제출용 보정서 출력 */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>법원 제출용 보정서 출력</span>
            </button>
          </div>
        </div>

        {/* 송달일 및 일정 컨트롤 바 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium">보정명령 송달일:</span>
            <input 
              type="date" 
              value={servedDate}
              onChange={(e) => setServedDate(e.target.value)}
              className="font-bold text-slate-900 bg-transparent border-none p-0 focus:outline-none cursor-pointer"
            />
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium">법정 제출기한 (14일):</span>
            <span className="font-extrabold font-mono text-slate-900">{dueDate}</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-500 font-medium">보정 소명 진행도:</span>
            <span className="font-bold text-blue-600">
              소명항목 {answers.length}건 · 소명표 7종 작성완료
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. 보정 4대 실무 탭 네비게이션 ── */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl px-2 shadow-xs">
        {[
          { key: 'write', label: '1. 작성하기 (7대 소명표)', icon: '✍️' },
          { key: 'docs', label: '2. 보정서류 (의뢰인 소명자료)', icon: '📁' },
          { key: 'plan_sync', label: '3. 신청서수정 (변제계획 재계산)', icon: '⚖️' },
          { key: 'print', label: '4. 보정서출력 (소갑 채번/미리보기)', icon: '📄' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setBriefTab(t.key as any)}
            className={`py-3 px-4 text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
              briefTab === t.key 
                ? 'text-blue-600 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── 3. 탭별 상세 내용 ── */}

      {/* ══════════ [1탭] 작성하기 (7대 소명표) ══════════ */}
      {briefTab === 'write' && (
        <div className="space-y-4">
          {/* 보정권고 항목별 답변 에디터 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span>📝 법원 보정 지시사항 및 채무자 대리인 소명 요지</span>
              </h4>
              <button
                onClick={() => setAnswers(prev => [...prev, {
                  pointNumber: prev.length + 1,
                  courtInstruction: '',
                  debtorResponse: '',
                  attachedEvidence: `소갑 제${prev.length + 1}호증`
                }])}
                className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-100 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                보정항목 추가
              </button>
            </div>

            <div className="space-y-4">
              {answers.map((ans, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-700">제{ans.pointNumber}항 보정사항</span>
                    <button 
                      onClick={() => setAnswers(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">법원 보정 지시 내용</label>
                    <input 
                      type="text" 
                      value={ans.courtInstruction}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, courtInstruction: val } : a));
                      }}
                      placeholder="예: 최근 1년 대출금 사용처 소명 및 금융거래내역 제출"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">채무자 대리인 소명 요지</label>
                    <textarea 
                      value={ans.debtorResponse}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, debtorResponse: val } : a));
                      }}
                      placeholder="구체적 소명 논리를 입력하세요..."
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">소명 첨부서류:</span>
                    <input 
                      type="text"
                      value={ans.attachedEvidence || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, attachedEvidence: val } : a));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7대 소명표 에디터 서브탭 */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span>📊 법원 실무 7대 표준 소명표 에디터</span>
              </h4>
              <span className="text-xs text-slate-500">
                작성된 데이터는 법원 보정서 본문 및 별지에 자동 반영됩니다.
              </span>
            </div>

            {/* 서브 탭 칩 버튼 */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[
                { key: 'loan', label: '① 최근 대출금 사용처', count: recentLoans.length },
                { key: 'card', label: '② 신용카드 사용내역', count: creditCards.length },
                { key: 'high_trans', label: '③ 50만 이상 거래', count: highValueTrans.length },
                { key: 'income', label: '④ 최근 1년 소득산정', count: monthlyIncomes.length },
                { key: 'insurance', label: '⑤ 보험 해약환급금', count: insurances.length },
                { key: 'past_case', label: '⑥ 종전사건 비교', count: pastCases.length },
                { key: 'family_asset', label: '⑦ 친족재산 출처', count: familyAssets.length },
              ].map(st => (
                <button
                  key={st.key}
                  onClick={() => setExplanationSubTab(st.key as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border whitespace-nowrap cursor-pointer transition-all ${
                    explanationSubTab === st.key 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st.label} ({st.count})
                </button>
              ))}
            </div>

            {/* 1. 최근 대출금 사용처 소명표 */}
            {explanationSubTab === 'loan' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">최근 1~2년 대출금 사용처 내역</span>
                  <button
                    onClick={() => setRecentLoans(prev => [...prev, {
                      id: `loan-${Date.now()}`,
                      loanDate: new Date().toISOString().split('T')[0],
                      lenderName: '',
                      amount: 10000000,
                      usageCategory: 'LIVING',
                      specificUsage: '',
                      verified: false
                    }])}
                    className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> 대출건 추가
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="p-2.5">대출일자</th>
                        <th className="p-2.5">금융기관</th>
                        <th className="p-2.5">대출금액(원)</th>
                        <th className="p-2.5">용도구분</th>
                        <th className="p-2.5">구체적 사용처 소명</th>
                        <th className="p-2.5 text-center">삭제</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentLoans.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                          <td className="p-2">
                            <input 
                              type="date" 
                              value={l.loanDate} 
                              onChange={(e) => setRecentLoans(prev => prev.map(x => x.id === l.id ? { ...x, loanDate: e.target.value } : x))}
                              className="w-full bg-white border border-slate-200 rounded-lg p-1"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={l.lenderName} 
                              placeholder="금융사명"
                              onChange={(e) => setRecentLoans(prev => prev.map(x => x.id === l.id ? { ...x, lenderName: e.target.value } : x))}
                              className="w-full bg-white border border-slate-200 rounded-lg p-1"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              value={l.amount} 
                              onChange={(e) => setRecentLoans(prev => prev.map(x => x.id === l.id ? { ...x, amount: Number(e.target.value) } : x))}
                              className="w-full bg-white border border-slate-200 rounded-lg p-1 font-mono text-right"
                            />
                          </td>
                          <td className="p-2">
                            <select 
                              value={l.usageCategory}
                              onChange={(e) => setRecentLoans(prev => prev.map(x => x.id === l.id ? { ...x, usageCategory: e.target.value as any } : x))}
                              className="w-full bg-white border border-slate-200 rounded-lg p-1"
                            >
                              <option value="DEBT_REPAYMENT">기존채무 상환</option>
                              <option value="LIVING">생활비 부족</option>
                              <option value="MEDICAL">의료비/병원비</option>
                              <option value="BUSINESS">사업운영자금</option>
                              <option value="INVESTMENT">투자/기타</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={l.specificUsage} 
                              placeholder="구체적 소명 (대환, 이체증 등)"
                              onChange={(e) => setRecentLoans(prev => prev.map(x => x.id === l.id ? { ...x, specificUsage: e.target.value } : x))}
                              className="w-full bg-white border border-slate-200 rounded-lg p-1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button 
                              onClick={() => setRecentLoans(prev => prev.filter(x => x.id !== l.id))}
                              className="text-slate-400 hover:text-rose-500 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. 신용카드 사용내역 */}
            {explanationSubTab === 'card' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700">신용카드 결제내역 및 생활필수지출 소명</span>
                <div className="p-4 bg-slate-50 rounded-2xl text-xs space-y-2 border border-slate-200">
                  {creditCards.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="font-bold text-slate-900">{c.cardCompany} · {c.merchantName}</span>
                        <p className="text-[11px] text-slate-500">{c.purpose} ({c.transactionDate})</p>
                      </div>
                      <span className="font-mono font-bold text-slate-800">{c.amount.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. 50만 이상 거래 */}
            {explanationSubTab === 'high_trans' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700">50만 원 이상 계좌 이체/출금 거래내역 소명</span>
                <div className="p-4 bg-slate-50 rounded-2xl text-xs space-y-2 border border-slate-200">
                  {highValueTrans.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="font-bold text-slate-900">{t.bankName} ➔ {t.counterparty}</span>
                        <p className="text-[11px] text-slate-500">{t.purposeDetail} ({t.transDate})</p>
                      </div>
                      <span className="font-mono font-bold text-rose-600">-{t.amount.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. 최근 1년 소득 산정 */}
            {explanationSubTab === 'income' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700">최근 실수령 평균소득 산정표</span>
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="p-2.5">귀속월</th>
                        <th className="p-2.5 text-right">총지급액</th>
                        <th className="p-2.5 text-right">공제액(4대보험/세금)</th>
                        <th className="p-2.5 text-right">실수령액</th>
                        <th className="p-2.5">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyIncomes.map(m => (
                        <tr key={m.month} className="hover:bg-slate-50/50">
                          <td className="p-2 font-bold">{m.month}</td>
                          <td className="p-2 text-right font-mono">{m.grossPay.toLocaleString()}원</td>
                          <td className="p-2 text-right font-mono text-slate-400">-{m.statutoryDeductions.toLocaleString()}원</td>
                          <td className="p-2 text-right font-mono font-bold text-blue-600">{m.netPay.toLocaleString()}원</td>
                          <td className="p-2 text-slate-500">{m.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. 보험 해약환급금 및 150만 공제 */}
            {explanationSubTab === 'insurance' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700">보장성 보험 해약환급금 및 압류금지 150만 원 공제</span>
                <div className="p-4 bg-slate-50 rounded-2xl text-xs space-y-2 border border-slate-200">
                  {insurances.map(ins => (
                    <div key={ins.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{ins.insurerName} ({ins.policyNumber})</span>
                        <p className="text-[11px] text-slate-500">환급금: {ins.surrenderRefund.toLocaleString()}원 - 법정공제: 1,500,000원</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">청산가치 반영액:</span>
                        <span className="font-mono font-bold text-emerald-600">{ins.liquidationInclusion.toLocaleString()}원</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. 종전 사건 비교 */}
            {explanationSubTab === 'past_case' && (
              <div className="p-8 text-center bg-slate-50 rounded-2xl text-xs text-slate-400">
                과거 5년/7년 이내 신청 이력이 없는 신규 사건입니다. (소명 불요)
              </div>
            )}

            {/* 7. 친족 재산 출처 */}
            {explanationSubTab === 'family_asset' && (
              <div className="p-8 text-center bg-slate-50 rounded-2xl text-xs text-slate-400">
                배우자 및 직계존비속 명의 고유재산에 대한 법원 권고 소명 사항이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ [2탭] 보정서류 (의뢰인 소명자료) ══════════ */}
      {briefTab === 'docs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>📁 의뢰인 추가 소명서류 요청 및 승인/반려</span>
            </h4>
            <button
              onClick={() => toast.success(`📱 ${clientName} 의뢰인에게 카카오 알림톡으로 보정서류 제출 안내가 발송되었습니다.`)}
              className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 text-amber-800" />
              카카오 알림톡 재요청
            </button>
          </div>

          <div className="space-y-3">
            {docRequests.map(req => (
              <div key={req.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{req.docTitle}</span>
                    <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                      {req.evidenceNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{req.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                    req.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {req.status === 'APPROVED' ? '✅ 검토완료' : req.status === 'SUBMITTED' ? '📩 의뢰인제출' : '⏳ 미제출'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ [3탭] 신청서수정 (변제계획 재계산) ══════════ */}
      {briefTab === 'plan_sync' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                변제계획안 & 채권자목록 수정 동기화
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                보정권고로 인해 변경된 채권금액 또는 청산가치(보험환급금 등)를 변제계획안에 자동 반영합니다.
              </p>
            </div>
            {onNavigateToRepayment && (
              <button
                onClick={onNavigateToRepayment}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              >
                <span>변제계획안 에디터로 이동</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 block">청산가치 가산 반영 항목</span>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span>보험 해약환급금 초과분</span>
                <span className="font-mono font-bold text-slate-900">+700,000원</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">보정 후 수정 총 청산가치</span>
                <span className="font-mono font-bold text-emerald-600">4,200,000원</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
              <span className="font-bold text-emerald-900 block">청산가치 보장의 원칙 재검증</span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                현재 총변제예정액(44,880,000원)의 현재가치가 보정 후 수정 청산가치(4,200,000원)를 완벽히 상회하므로, 변제금 상향 없이 변제계획 인가가 가능합니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ [4탭] 보정서출력 (소갑 채번/미리보기) ══════════ */}
      {briefTab === 'print' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center text-2xl font-bold">
            📄
          </div>
          <div>
            <h4 className="font-black text-base text-slate-900">
              서울회생법원 실무 양식 보정서 출력 준비 완료
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              작성된 소명 요지와 소갑 제1호증 내지 제7호증이 자동 채번되어 법원 정규 보정서로 렌더링됩니다.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>법원 제출용 보정서 미리보기 & 인쇄</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 4. 서식 모달들 ── */}
      {showPrintModal && (
        <CorrectionBriefModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          data={fullBriefData}
        />
      )}

      {/* 기한연장신청서 모달 */}
      {showExtensionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <span>⏰ 법원 보정기한 연장신청서 자동생성</span>
              </h3>
              <button onClick={() => setShowExtensionModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              신청인(채무자)의 부채증명서 발급 지연 및 은행거래내역 소명자료 확보를 위하여 법원에 <strong>1개월 기한연장</strong>을 신청합니다.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 font-mono text-slate-700">
              <div>사건번호: {caseNumber}</div>
              <div>기존기한: {dueDate}</div>
              <div className="text-blue-600 font-bold">연장요청기한: 2026. 04. 15. (1개월 연장)</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowExtensionModal(false)} className="px-3 py-1.5 text-xs text-slate-500">
                취소
              </button>
              <button onClick={handleRequestExtension} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs press-scale">
                연장신청서 PDF 다운로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
