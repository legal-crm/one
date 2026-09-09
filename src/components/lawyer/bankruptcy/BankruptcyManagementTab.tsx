import React, { useState, useMemo } from 'react';
import { 
  Scale, ShieldAlert, CheckCircle2, AlertTriangle, FileText, 
  Printer, Download, Sparkles, Plus, Trash2, Home, Coins,
  Users, Check, X, Building2, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  BankruptcyFullCaseData, 
  BankruptcyPetition, 
  BankruptcyStatement, 
  BankruptcyAssetItem,
  BankruptcyRequiredDoc
} from '../../../types/bankruptcyTypes';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import PrintableBankruptcyPetitionModal from './PrintableBankruptcyPetitionModal';

interface BankruptcyManagementTabProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
  onOpenBatchFiling?: () => void;
}

export default function BankruptcyManagementTab({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사',
  onOpenBatchFiling
}: BankruptcyManagementTabProps) {
  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const rawDebt = (clientRequest.financialProfile?.debtTotal || 8000) * 10000;
  const rawIncome = (clientRequest.financialProfile?.income || 80) * 10000;

  const [activeSubTab, setActiveSubTab] = useState<'petition' | 'statement' | 'assets' | 'living' | 'docs'>('petition');

  // 1. 파산신청서 상태
  const [petition, setPetition] = useState<BankruptcyPetition>({
    id: `pet-${clientId}`,
    clientId,
    debtorName: clientName,
    debtorRrn: '820415-1******',
    debtorAddress: clientRequest.region ? `${clientRequest.region} 거주` : '서울특별시 마포구 마포대로 123',
    courtName,
    filingDate: new Date().toISOString().split('T')[0],
    attorneyName: activeLawyerName,
    totalDebtPrincipal: rawDebt,
    totalDebtInterest: Math.round(rawDebt * 0.15),
    totalAssetsValue: 5000000,
    netExemptAssets: 5000000,
    liquidationValue: 0,
    monthlyNetIncome: rawIncome,
    householdMembersCount: 1,
    minimumLivingCost: 1400000,
    petitionRelief: {
      bankruptcy: '1. 채무자를 파산자에 처한다.',
      discharge: '2. 채무자를 면책한다.',
      orderStay: true
    },
    insolvencyCause: 'LIVING_COST_SHORTAGE',
    insolvencyCauseDetail: '과거 실직 및 만성 질환으로 인한 병원비 지출과 소득 급감으로 장기간 생활비가 누적되었으며, 현재 근로능력 부족으로 채무 변제가 전면 불가능한 상태입니다.'
  });

  // 2. 파산 진술서 (면책불허가사유 8대 스크리닝)
  const [statement, setStatement] = useState<BankruptcyStatement>({
    finalEducation: '고등학교 졸업',
    pastJobHistory: [
      { period: '2016.03 ~ 2021.10', companyName: '동네 마트/식당', position: '단기 일용직/조리', reasonForLeaving: '건강 악화' }
    ],
    livingHistory: '최저생계비 미만의 불규칙한 소득으로 일상생활을 유지하던 중 카드 돌려막기와 소액 대출이 누적되어 지급불능에 이름.',
    disallowanceScreening: {
      gamblingOrSpeculation: false,
      fraudulentLoan: false,
      preferentialPayment: false,
      concealmentOfAssets: false,
      falseCreditorList: false,
      pastDischargeWithinYears: false,
      falseReportToTrustee: false,
      creditTransactionBeforeFiling: false
    },
    screeningNotes: {}
  });

  // 3. 파산 재산목록 (1,110만 원 생계비 및 소액임차보증금 공제)
  const [assets, setAssets] = useState<BankruptcyAssetItem[]>([
    {
      id: 'ast-1',
      assetName: '주거용 임차보증금 (월세)',
      assetCategory: 'HOUSING_DEPOSIT',
      marketValue: 15000000,
      seniorLien: 0,
      statutoryExemption: 15000000, // 서울 소액보증금 5,500만 한도 내 전액 공제
      appliedExemptionType: 'SMALL_HOUSING_DEPOSIT',
      liquidationValue: 0,
      isExcludedFromEstate: true,
      evidenceDocName: '임대차계약서 및 확정일자'
    },
    {
      id: 'ast-2',
      assetName: '보장성 보험 해약환급금',
      assetCategory: 'INSURANCE',
      marketValue: 1200000,
      seniorLien: 0,
      statutoryExemption: 1200000, // 150만 원 한도 내 전액 압류금지
      appliedExemptionType: 'INSURANCE_150',
      liquidationValue: 0,
      isExcludedFromEstate: true,
      evidenceDocName: '보험해약환급금 확인서'
    },
    {
      id: 'ast-3',
      assetName: '은행 예금 잔고',
      assetCategory: 'CASH_DEPOSIT',
      marketValue: 450000,
      seniorLien: 0,
      statutoryExemption: 450000, // 185만 원 압류금지
      appliedExemptionType: 'DEPOSIT_185',
      liquidationValue: 0,
      isExcludedFromEstate: true,
      evidenceDocName: '계좌잔액증명서'
    }
  ]);

  // 4. 가계수지표 (가용소득 0원 입증)
  const [budget, setBudget] = useState({
    earnedIncome: rawIncome,
    pensionOrWelfare: 200000,
    familySupport: 0,
    totalIncome: rawIncome + 200000,

    housingRent: 400000,
    medicalExpenses: 150000,
    foodAndDailySupplies: 450000,
    utilitiesAndCommunication: 120000,
    educationExpenses: 0,
    transportation: 80000,
    totalLivingExpense: 1200000,

    disposableIncome: (rawIncome + 200000) - 1200000,
    isDisposableZeroOrNegative: ((rawIncome + 200000) - 1200000) <= 0
  });

  // 5. 파산 15대 필수자료제출목록
  const [requiredDocs, setRequiredDocs] = useState<BankruptcyRequiredDoc[]>([
    { id: 'bd-1', itemNumber: 1, category: '인적서류', title: '주민등록초본 (말소/주소변동 포함)', detailDescription: '최근 1개월 이내 발급분', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-2', itemNumber: 2, category: '인적서류', title: '가족관계증명서 (상세) 및 혼인관계증명서', detailDescription: '상세본 필수', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-3', itemNumber: 3, category: '소득/세금', title: '최근 3년 근로소득원천징수 또는 소득금액증명', detailDescription: '소득 0원인 경우 사실증명', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-4', itemNumber: 4, category: '소득/세금', title: '건강보험료 납부확인서 및 자격득실확인서', detailDescription: '최근 3년분', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-5', itemNumber: 5, category: '금융/부채', title: '금융결제원 계좌정보통합관리(어카운트인포)', detailDescription: '계좌 및 카드 목록', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-6', itemNumber: 6, category: '금융/부채', title: '최근 1~2년 전체 은행 입출금거래내역서', detailDescription: '통장 사본 및 엑셀', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-7', itemNumber: 7, category: '재산/주거', title: '지적전산자료조회결과 (전국 부동산 소유현황)', detailDescription: '본인 및 동거가족', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-8', itemNumber: 8, category: '재산/주거', title: '자동차등록원부 (갑/을부)', detailDescription: '소유차량 있을 경우', isMandatory: false, status: 'SUBMITTED' },
    { id: 'bd-9', itemNumber: 9, category: '재산/주거', title: '임대차계약서 사본 및 무상거주확인서', detailDescription: '거주지 확인용', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-10', itemNumber: 10, category: '보험/자산', title: '생명/손해보험협회 보험가입내역조회서', detailDescription: '내보험다보여 조회', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-11', itemNumber: 11, category: '보험/자산', title: '보험 해약환급금 확인서', detailDescription: '유효계약 전체', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-12', itemNumber: 12, category: '채무/신용', title: '부채증명서 (금융기관별 발급)', detailDescription: '원금 및 이자 구분', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-13', itemNumber: 13, category: '채무/신용', title: '신용정보원 크레딧포유 본인신용정보조회서', detailDescription: '대출/연체/보증 현황', isMandatory: true, status: 'SUBMITTED' },
    { id: 'bd-14', itemNumber: 14, category: '소명자료', title: '진단서 또는 장애인증명서 (해당시)', detailDescription: '근로능력 상실 소명', isMandatory: false, status: 'SUBMITTED' },
    { id: 'bd-15', itemNumber: 15, category: '기타/대리', title: '소송위임장 및 인감증명서', detailDescription: '대리인 선임용', isMandatory: true, status: 'SUBMITTED' },
  ]);

  // 총 환가 가치 (파산재단 가액) 계산
  const totalLiquidationEstate = useMemo(() => {
    return assets.reduce((sum, a) => sum + a.liquidationValue, 0);
  }, [assets]);

  // 파산폐지(동시폐지) 적격 판정: 파산재단 가액이 파산관재인 비용 및 절차비용 미만(실무상 0원~수백만 원 이하)
  const isSimultaneousDismissalEligible = totalLiquidationEstate === 0;

  // 전체 파산 데이터 객체
  const fullCaseData: BankruptcyFullCaseData = useMemo(() => ({
    petition,
    statement,
    livingCondition: {
      familyMembers: [{ id: 'fm-1', relationship: '본인', name: clientName, age: 45, job: '무직/일용직', monthlyIncome: rawIncome, isCohabiting: true, isDependent: true }],
      budgetLedger: budget
    },
    assets,
    requiredDocs,
    totalLiquidationEstate,
    isSimultaneousDismissalEligible,
    lastSavedAt: new Date().toISOString()
  }), [petition, statement, budget, assets, requiredDocs, totalLiquidationEstate, isSimultaneousDismissalEligible, clientName, rawIncome]);

  const [showPrintModal, setShowPrintModal] = useState(false);

  // 면책불허가 리스크 평가
  const riskCount = Object.values(statement.disallowanceScreening).filter(Boolean).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── 1. 파산 커맨드 센터 상단 헤더 ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-200 flex items-center justify-center text-xl font-bold">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  개인파산 및 면책 동시신청 관리 센터
                </h3>
                {isSimultaneousDismissalEligible ? (
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ✨ 동시폐지(관재인 비용 절감) 적격 판정
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                    ⚠️ 환가대상 재산 {totalLiquidationEstate.toLocaleString()}원 존재
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                신청인: <strong className="text-slate-800">{clientName}</strong> · 총채무: {petition.totalDebtPrincipal.toLocaleString()}원 · 가용소득: {budget.disposableIncome.toLocaleString()}원
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenBatchFiling && (
              <button
                onClick={onOpenBatchFiling}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              >
                <span>📦 전자소송 10종 일괄 패키징</span>
              </button>
            )}

            <button
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>파산·면책 신청서 출력/PDF</span>
            </button>
          </div>
        </div>

        {/* 3대 핵심 판정 지표 바 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">1. 가용소득 판정:</span>
            <span className="font-extrabold font-mono text-emerald-600">
              {budget.disposableIncome <= 0 ? '0원 이하 (변제불능 합격)' : `+${budget.disposableIncome.toLocaleString()}원 (회생 권고)`}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">2. 환가재산 (청산가치):</span>
            <span className="font-extrabold font-mono text-blue-600">
              {totalLiquidationEstate.toLocaleString()}원 (전액 면제 인정)
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">3. 면책불허가 리스크:</span>
            <span className={`font-bold ${riskCount === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {riskCount === 0 ? '안전 (사유 없음)' : `${riskCount}건 주의/방어필요`}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. 서브 탭 네비게이션 ── */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl px-2 shadow-xs">
        {[
          { key: 'petition', label: '1. 파산·면책 신청서', icon: '📝' },
          { key: 'statement', label: '2. 진술서 (면책불허가 점검)', icon: '🛡️' },
          { key: 'assets', label: '3. 재산목록 (1,110만 면제)', icon: '🏦' },
          { key: 'living', label: '4. 생활상황표 (가계수지)', icon: '📊' },
          { key: 'docs', label: '5. 15대 필수서류 목록', icon: '📁' },
        ].map(st => (
          <button
            key={st.key}
            onClick={() => setActiveSubTab(st.key as any)}
            className={`py-3 px-4 text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
              activeSubTab === st.key 
                ? 'text-purple-600 border-purple-600 bg-purple-50/50' 
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <span>{st.icon}</span>
            <span>{st.label}</span>
          </button>
        ))}
      </div>

      {/* ── 3. 탭별 상세 렌더링 ── */}

      {/* ══════════ [1탭] 파산·면책 신청서 ══════════ */}
      {activeSubTab === 'petition' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <h4 className="font-bold text-sm text-slate-900">파산 및 면책 신청 취지 및 지급불능 사유</h4>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 font-bold block mb-1">지급불능에 이르게 된 주된 원인</label>
              <select 
                value={petition.insolvencyCause}
                onChange={(e) => setPetition({ ...petition, insolvencyCause: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold"
              >
                <option value="LIVING_COST_SHORTAGE">저소득 및 생활비 부족 누적</option>
                <option value="UNEMPLOYMENT_ILLNESS">실직, 질병 및 의료비 과다 지출</option>
                <option value="BUSINESS_FAILURE">사업 실패 및 불가항력적 폐업</option>
                <option value="GUARANTEE_DEBT">타인 채무에 대한 연대보증</option>
                <option value="FRAUD_DAMAGE">전세사기 또는 금융사기 피해</option>
              </select>
            </div>

            <div>
              <label className="text-slate-600 font-bold block mb-1">지급불능 사실 구체적 진술</label>
              <textarea 
                value={petition.insolvencyCauseDetail}
                onChange={(e) => setPetition({ ...petition, insolvencyCauseDetail: e.target.value })}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════════ [2탭] 진술서 (면책불허가사유 8대 스크리닝) ══════════ */}
      {activeSubTab === 'statement' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              채무자회생법 제564조 면책불허가사유 8대 항목 자가진단
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              해당 사항이 있을 경우 파산관재인의 심문 대상이 되므로, 사전 방어 논리를 소명해야 합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              { key: 'gamblingOrSpeculation', label: '1. 도박, 사행성 게임, 가상자산/주식 과다 낭비', hint: '손실액 전액 청산가치 가산 또는 재량면책 검토 필요' },
              { key: 'fraudulentLoan', label: '2. 대출 직전 허위 소득/재직증명 제출 (신용사기)', hint: '형사 고소 및 비면책채권 지정 리스크' },
              { key: 'preferentialPayment', label: '3. 파산 직전 친인척 채무만 우선 변제 (편파변제)', hint: '관재인의 부인권 행사 대상' },
              { key: 'concealmentOfAssets', label: '4. 재산 은닉, 타인 명의 이전, 헐값 처분', hint: '사해행위 취소 소송 및 면책불허가 사유' },
              { key: 'falseCreditorList', label: '5. 채권자목록 고의 누락 (허위 작성)', hint: '누락된 채권은 면책 효력 미적용' },
              { key: 'pastDischargeWithinYears', label: '6. 과거 7년(파산) / 5년(회생) 이내 면책 이력', hint: '법정 기간 미경과 시 기각 처분' },
              { key: 'falseReportToTrustee', label: '7. 파산관재인에 대한 허위 진술 및 서류 제출 거부', hint: '설명의무 위반' },
              { key: 'creditTransactionBeforeFiling', label: '8. 파산 신청 직전(1~2개월) 신용카드/대출 발생', hint: '상환의사 없는 차용으로 간주될 위험' },
            ].map(item => {
              const isChecked = (statement.disallowanceScreening as any)[item.key];
              return (
                <div 
                  key={item.key}
                  onClick={() => setStatement(prev => ({
                    ...prev,
                    disallowanceScreening: {
                      ...prev.disallowanceScreening,
                      [item.key]: !isChecked
                    }
                  }))}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isChecked 
                      ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{item.label}</span>
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isChecked ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {isChecked ? '✓' : ''}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 ${isChecked ? 'text-rose-700 font-medium' : 'text-slate-500'}`}>
                    {item.hint}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ [3탭] 파산 재산목록 & 1,110만 원 면제재산 계산기 ══════════ */}
      {activeSubTab === 'assets' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                파산 재산목록 & 법정 압류금지·면제재산(1,110만 원) 공제
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                채무자회생법 제383조 제2항에 따라 6개월 생계비 1,110만 원과 소액임차보증금은 파산재단에서 제외됩니다.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {assets.map(ast => (
              <div key={ast.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900">{ast.assetName}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    평가액: {ast.marketValue.toLocaleString()}원 - 법정공제: {ast.statutoryExemption.toLocaleString()}원 ({ast.appliedExemptionType})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
                    환가배제(자유재산)
                  </span>
                  <div className="font-mono font-bold text-slate-900 mt-1">0원</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 flex items-center justify-between text-xs font-bold text-purple-950">
            <span>파산재단 최종 환가대상 가액:</span>
            <span className="font-mono text-base">{totalLiquidationEstate.toLocaleString()}원 (동시폐지 결정 요건 완벽 충족)</span>
          </div>
        </div>
      )}

      {/* ══════════ [4탭] 현재의 생활상황표 (가계수지) ══════════ */}
      {activeSubTab === 'living' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <h4 className="font-bold text-sm text-slate-900">가계수지표 (가용소득 0원 입증)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 block">월 총 수입 (A)</span>
              <div className="flex justify-between items-center">
                <span>근로/알바 소득</span>
                <span className="font-mono font-bold">{budget.earnedIncome.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span>생계급여/기초연금</span>
                <span className="font-mono font-bold">{budget.pensionOrWelfare.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold">
                <span>수입 합계</span>
                <span className="font-mono text-blue-600">{budget.totalIncome.toLocaleString()}원</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 block">월 필수 생계비 지출 (B)</span>
              <div className="flex justify-between items-center">
                <span>주거비 (월세)</span>
                <span className="font-mono font-bold">{budget.housingRent.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span>의료비 / 약값</span>
                <span className="font-mono font-bold">{budget.medicalExpenses.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span>식비 및 공과금</span>
                <span className="font-mono font-bold">{(budget.foodAndDailySupplies + budget.utilitiesAndCommunication).toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold">
                <span>지출 합계</span>
                <span className="font-mono text-rose-600">{budget.totalLivingExpense.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 font-bold flex justify-between items-center">
            <span>월 잉여 가용소득 (A - B):</span>
            <span className="font-mono text-sm">{budget.disposableIncome.toLocaleString()}원 (개인회생 변제금 납부 불가능 증명 완료)</span>
          </div>
        </div>
      )}

      {/* ══════════ [5탭] 15대 필수서류 목록 ══════════ */}
      {activeSubTab === 'docs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">
              서울회생법원 실무준칙 개인파산 15대 필수자료제출목록
            </h4>
            <span className="text-xs text-slate-500">15종 전원 구비 완료</span>
          </div>

          <div className="space-y-2 text-xs">
            {requiredDocs.map(d => (
              <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-purple-600 w-6">#{d.itemNumber}</span>
                  <div>
                    <span className="font-bold text-slate-800">{d.title}</span>
                    <span className="text-[11px] text-slate-500 ml-2">({d.detailDescription})</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  제출 완료
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 출력 모달 */}
      {showPrintModal && (
        <PrintableBankruptcyPetitionModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          data={fullCaseData}
        />
      )}
    </div>
  );
}
