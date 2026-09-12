import React, { useState, useMemo } from 'react';
import { 
  Scale, ShieldAlert, CheckCircle2, AlertTriangle, FileText, 
  Printer, Download, Sparkles, Plus, Trash2, Home, Coins,
  Users, Check, X, Building2, HelpCircle, Save, Calendar,
  Landmark, AlertOctagon, ArrowDownCircle, HeartHandshake, Eye,
  ChevronRight, RefreshCw, FileWarning, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { saveBankruptcyCase } from '../../../services/companionService';
import { matchCreditorPreset } from '../../../services/court/creditorAddressDirectory';
import type { 
  BankruptcyFullCaseData, 
  BankruptcyPetition, 
  BankruptcyStatement, 
  BankruptcyAssetItem,
  BankruptcyRequiredDoc,
  BankruptcyCreditorItem,
  BankruptcyInvestigationAssets,
  DisposedAssetItem,
  ReturnedDepositItem,
  BankruptcyResidenceType
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

  // 6대 서브탭
  const [activeSubTab, setActiveSubTab] = useState<'petition' | 'statement' | 'creditors' | 'assets' | 'living' | 'docs'>('petition');

  const savedBk = crmExt.bankruptcyData;

  // 1. 파산신청서 상태
  const [petition, setPetition] = useState<BankruptcyPetition>(() => {
    if (savedBk?.petition) return savedBk.petition;
    return {
      id: `pet-${clientId}`,
      clientId,
      debtorName: clientName,
      debtorRrn: '820415-1******',
      debtorAddress: (clientRequest.financialProfile?.residenceRegion || clientRequest.region) ? `${clientRequest.financialProfile?.residenceRegion || clientRequest.region} 거주` : '서울특별시 마포구 마포대로 123',
      registeredDomicile: '서울특별시 중구 세종대로 110',
      serviceAddress: '대리인 법률사무소 (서울특별시 서초구 서초대로 456, 501호)',
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
    };
  });

  // 2. 파산 진술서 (의뢰인 원문 로드 + 변호사 감수 + 8대 스크리닝)
  const [statement, setStatement] = useState<BankruptcyStatement>(() => {
    if (savedBk?.statement) return savedBk.statement;
    return {
      finalEducation: '고등학교 졸업',
      pastJobHistory: [
        { period: '2016.03 ~ 2021.10', companyName: '동네 마트/식당', position: '단기 일용직/조리', reasonForLeaving: '건강 악화' }
      ],
      livingHistory: '최저생계비 미만의 불규칙한 소득으로 일상생활을 유지하던 중 카드 돌려막기와 소액 대출이 누적되어 지급불능에 이름.',
      debtorStoryRaw: clientRequest.memo || clientRequest.preferredTime || '',
      debtorStoryPolished: '채무자는 과거 소규모 요식업 및 일용직에 종사하며 성실히 생활하여 왔으나, 만성 질환으로 인한 치료비 지출과 소득 중단으로 인해 일상 생계비 부족이 심화되었습니다. 금융기관 대출 및 신용카드를 통해 채무를 변제하고자 노력하였으나 결국 원리금 상환 불능 상태에 이르렀으며, 현재 고령 및 질환으로 인해 객관적 근로능력을 상실하여 향후 채무를 변제할 가능성이 전무합니다.',
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
      screeningNotes: {},
      pastDischargeHistory: {
        hasPastDischarge: false,
        isElapsedEligible: true
      },
      concurrentFamilyBankruptcy: {
        hasConcurrent: false
      },
      criminalRecordForFraud: {
        hasRecord: false
      }
    };
  });

  // 3. 채권자목록 & 소송/가압류 이력
  const [creditors, setCreditors] = useState<BankruptcyCreditorItem[]>(() => {
    if (savedBk?.creditors && savedBk.creditors.length > 0) return savedBk.creditors;
    return [
      {
        id: 'c-1',
        creditorName: '신한카드(주)',
        debtCause: 'CREDIT_CARD',
        debtCauseDetail: '신용카드 대금 및 단기 카드대출',
        borrowedDate: '2021-04-15',
        principal: Math.round(rawDebt * 0.35),
        interest: Math.round(rawDebt * 0.05),
        isNonDischargeable: false,
        lawsuitInfo: {
          hasLawsuit: true,
          lawsuitType: 'PAYMENT_ORDER',
          courtName: '서울중앙지방법원',
          caseNumber: '2023차전10293',
          statusText: '지급명령 확정'
        }
      },
      {
        id: 'c-2',
        creditorName: '국민은행',
        debtCause: 'CASH_LOAN',
        debtCauseDetail: '생계자금 신용대출',
        borrowedDate: '2020-11-20',
        principal: Math.round(rawDebt * 0.45),
        interest: Math.round(rawDebt * 0.06),
        isNonDischargeable: false,
        lawsuitInfo: {
          hasLawsuit: true,
          lawsuitType: 'SEIZURE_COLLECTION',
          courtName: '서울서부지방법원',
          caseNumber: '2024타채5512',
          statusText: '통장 압류 결정'
        }
      },
      {
        id: 'c-3',
        creditorName: '마포세무서',
        debtCause: 'OTHER',
        debtCauseDetail: '종합소득세 및 부가가치세 체납',
        borrowedDate: '2022-05-31',
        principal: Math.round(rawDebt * 0.1),
        interest: 0,
        isNonDischargeable: true, // 조세채권 비면책
        lawsuitInfo: {
          hasLawsuit: false
        }
      }
    ];
  });

  // 4. 파산관재인 5대 심층 조사재산 (리걸플로 벤치마킹 핵심)
  const [investigationAssets, setInvestigationAssets] = useState<BankruptcyInvestigationAssets>(() => {
    if (savedBk?.investigationAssets) return savedBk.investigationAssets;
    return {
      disposedAssets1Year: [],
      returnedDeposits2Years: [],
      divorceProperty2Years: {
        hasDivorceWithin2Years: false,
        divorceType: 'CONSENSUS',
        propertyDivisionAmount: 0,
        alimonyAmount: 0,
        divisionDetail: '최근 2년 이내 이혼 사실 없음'
      },
      inheritanceProperty: {
        hasInheritance: false,
        divisionStatus: 'NONE',
        inheritanceAssetsDetail: '최근 상속받은 재산 없음'
      },
      severancePay: {
        hasSeverance: false,
        expectedTotalAmount: 0,
        exemptAmount: 0,
        liquidationAmount: 0
      }
    };
  });

  // 5. 기본 파산 재산목록 (1,110만 원 면제재산 계산기)
  const [assets, setAssets] = useState<BankruptcyAssetItem[]>(() => {
    if (savedBk?.assets && savedBk.assets.length > 0) return savedBk.assets;
    return [
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
    ];
  });

  // 6. 주거 6분류 및 조세 체납표 & 가계수지표
  const [residence, setResidence] = useState(() => {
    if (savedBk?.livingCondition?.residence) return savedBk.livingCondition.residence;
    return {
      residenceType: 'RENT_LEASE' as BankruptcyResidenceType,
      startDate: '2022-03-01',
      deposit: 15000000,
      monthlyRent: 400000,
      ownerName: '임대인',
      ownerRelation: '소유자(타인)',
      freeStayReason: ''
    };
  });

  const [taxArrears, setTaxArrears] = useState(() => {
    if (savedBk?.livingCondition?.taxArrears) return savedBk.livingCondition.taxArrears;
    return {
      incomeTax: 2500000,
      localIncomeTax: 250000,
      propertyTax: 0,
      healthInsurance: 1200000,
      nationalPension: 800000,
      otherTax: 0,
      totalArrears: 4750000
    };
  });

  const [budget, setBudget] = useState(() => {
    if (savedBk?.livingCondition?.budgetLedger) return savedBk.livingCondition.budgetLedger;
    return {
      earnedIncome: rawIncome,
      pensionOrWelfare: 200000,
      familySupport: 0,
      totalIncome: rawIncome + 200000,

      housingRent: 400000,
      foodAndDailySupplies: 450000,
      medicalExpenses: 150000,
      utilitiesAndCommunication: 120000,
      educationExpenses: 0,
      transportation: 80000,
      clothingExpenses: 50000,
      totalLivingExpense: 1250000,

      disposableIncome: (rawIncome + 200000) - 1250000,
      isDisposableZeroOrNegative: ((rawIncome + 200000) - 1250000) <= 0
    };
  });

  // 7. 파산 15대 필수자료제출목록 (미제출 사유 인라인 입력 지원)
  const [requiredDocs, setRequiredDocs] = useState<BankruptcyRequiredDoc[]>(() => {
    if (savedBk?.requiredDocs && savedBk.requiredDocs.length > 0) return savedBk.requiredDocs;
    return [
      { id: 'bd-1', itemNumber: 1, category: '인적서류', title: '가족관계증명서 (상세)', detailDescription: '상세본 필수', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-2', itemNumber: 2, category: '인적서류', title: '혼인관계증명서 (상세)', detailDescription: '이혼이력 포함', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-3', itemNumber: 3, category: '인적서류', title: '주민등록초본 (말소/주소변동 전체 포함)', detailDescription: '과거 주소 변동 전체', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-4', itemNumber: 4, category: '인적서류', title: '주민등록등본', detailDescription: '세대원 전체 표기', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-5', itemNumber: 5, category: '세금서류', title: '지방세 세목별 과세증명서', detailDescription: '과거 5년간 전국 자치단체', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-6', itemNumber: 6, category: '재산서류', title: '자동차등록원부 (갑/을부)', detailDescription: '차량 유무 불문 발급', isMandatory: false, status: 'SUBMITTED' },
      { id: 'bd-7', itemNumber: 7, category: '재산서류', title: '부동산 등기사항전부증명서 (해당시)', detailDescription: '소유 또는 최근 매각분', isMandatory: false, status: 'UNOBTAINABLE', unobtainableReason: '신청인 소유 부동산 일체 없어 미제출' },
      { id: 'bd-8', itemNumber: 8, category: '보험서류', title: '생존자 보험가입내역조회서 및 해약환급금확인서', detailDescription: '내보험다보여 발급', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-9', itemNumber: 9, category: '금융서류', title: '통장 입출금 거래내역서 (과거 1년~2년)', detailDescription: '주거래 은행 전 계좌', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-10', itemNumber: 10, category: '소득서류', title: '폐업사실증명원 또는 소득금액증명', detailDescription: '소득 0원인 경우 사실증명원', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-11', itemNumber: 11, category: '건보서류', title: '건강보험료 자격득실확인서 및 납부확인서', detailDescription: '최근 3년분', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-12', itemNumber: 12, category: '특수소명', title: '최근 1년 내 처분재산(1,000만 이상) 매매계약서 및 영수증', detailDescription: '대금사용처 소명', isMandatory: false, status: 'UNOBTAINABLE', unobtainableReason: '최근 1년 내 1,000만 원 이상 처분한 재산 일체 없음' },
      { id: 'bd-13', itemNumber: 13, category: '주거서류', title: '임대차계약서 사본 및 무상거주확인서', detailDescription: '현재 거주지 증명', isMandatory: true, status: 'SUBMITTED' },
      { id: 'bd-14', itemNumber: 14, category: '특수소명', title: '최근 2년 이내 이혼 관련 판결서 또는 재산분할 합의서', detailDescription: '이혼 해당자 필수', isMandatory: false, status: 'UNOBTAINABLE', unobtainableReason: '최근 2년 이내 이혼 사실 없으므로 비해당' },
      { id: 'bd-15', itemNumber: 15, category: '대리서류', title: '소송위임장 및 인감증명서', detailDescription: '변호사 대리 선임용', isMandatory: true, status: 'SUBMITTED' },
    ];
  });

  // 총 환가 가치 (파산재단 가액) 계산: 기본 자산 + 퇴직금 환가액
  const totalLiquidationEstate = useMemo(() => {
    const basicLiquidation = assets.reduce((sum, a) => sum + a.liquidationValue, 0);
    const severanceLiquidation = investigationAssets.severancePay.liquidationAmount || 0;
    return basicLiquidation + severanceLiquidation;
  }, [assets, investigationAssets.severancePay]);

  // 파산폐지(동시폐지) 적격 판정
  const isSimultaneousDismissalEligible = totalLiquidationEstate === 0;

  // 전체 파산 데이터 객체
  const fullCaseData: BankruptcyFullCaseData = useMemo(() => ({
    petition,
    statement,
    creditors,
    investigationAssets,
    livingCondition: {
      residence,
      familyMembers: [{ id: 'fm-1', relationship: '본인', name: clientName, age: 45, job: '무직/일용직', monthlyIncome: rawIncome, isCohabiting: true, isDependent: true }],
      taxArrears,
      budgetLedger: budget
    },
    assets,
    requiredDocs,
    totalLiquidationEstate,
    isSimultaneousDismissalEligible,
    lastSavedAt: new Date().toISOString()
  }), [petition, statement, creditors, investigationAssets, residence, taxArrears, budget, assets, requiredDocs, totalLiquidationEstate, isSimultaneousDismissalEligible, clientName, rawIncome]);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 파산 데이터 CRM 영속화 저장 핸들러
  const handleSaveData = async () => {
    setIsSaving(true);
    try {
      await onUpdateCrmExt({
        bankruptcyData: fullCaseData
      });
      saveBankruptcyCase({
        courtName: petition.courtName,
        alias: clientName,
      });
      toast.success('개인파산 및 면책 동시신청 데이터가 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error(err);
      toast.error('파산 데이터 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 모바일 의뢰인 진술서 CRM 로드 핸들러
  const handleLoadClientStory = () => {
    const clientStory = clientRequest.memo || clientRequest.preferredTime || '';
    if (!clientStory) {
      toast.info('의뢰인의 접수 메모 데이터가 비어있어 기본 법률 진술문 템플릿을 생성합니다.');
    } else {
      toast.success('의뢰인이 사전 접수한 상담 사연을 성공적으로 불러왔습니다.');
    }
    setStatement(prev => ({
      ...prev,
      debtorStoryRaw: clientStory || '의뢰인 작성: 생활비 부족과 병원비 지출로 부채가 누적되었으며 현재 소득이 없어 변제가 불가능함.',
      debtorStoryPolished: prev.debtorStoryPolished || `채무자는 과거 성실히 생활하여 왔으나, 급작스러운 소득 중단과 만성 질환으로 인한 치료비 지출로 일상생활비가 누적되어 불가피하게 지급불능 상태에 이르게 되었습니다.`
    }));
  };

  // 1년 내 처분재산 추가/삭제
  const handleAddDisposedAsset = () => {
    const newItem: DisposedAssetItem = {
      id: `disp-${Date.now()}`,
      itemTitle: '',
      disposedDate: new Date().toISOString().split('T')[0],
      disposedAmount: 0,
      counterparty: '',
      usageDetail: ''
    };
    setInvestigationAssets(prev => ({
      ...prev,
      disposedAssets1Year: [...prev.disposedAssets1Year, newItem]
    }));
  };

  const handleRemoveDisposedAsset = (id: string) => {
    setInvestigationAssets(prev => ({
      ...prev,
      disposedAssets1Year: prev.disposedAssets1Year.filter(x => x.id !== id)
    }));
  };

  // 2년 내 반환 임차보증금 추가/삭제
  const handleAddReturnedDeposit = () => {
    const newItem: ReturnedDepositItem = {
      id: `ret-${Date.now()}`,
      housingAddress: '',
      returnedDate: new Date().toISOString().split('T')[0],
      returnedAmount: 0,
      usageDetail: ''
    };
    setInvestigationAssets(prev => ({
      ...prev,
      returnedDeposits2Years: [...prev.returnedDeposits2Years, newItem]
    }));
  };

  const handleRemoveReturnedDeposit = (id: string) => {
    setInvestigationAssets(prev => ({
      ...prev,
      returnedDeposits2Years: prev.returnedDeposits2Years.filter(x => x.id !== id)
    }));
  };

  // 채권자 추가
  const handleAddCreditor = () => {
    const newCreditor: BankruptcyCreditorItem = {
      id: `c-${Date.now()}`,
      creditorName: '',
      debtCause: 'CASH_LOAN',
      debtCauseDetail: '신용대출',
      borrowedDate: new Date().toISOString().split('T')[0],
      principal: 10000000,
      interest: 0,
      isNonDischargeable: false
    };
    setCreditors(prev => [...prev, newCreditor]);
  };

  // 면책불허가 리스크 평가
  const riskCount = Object.values(statement.disallowanceScreening).filter(Boolean).length;

  return (
    <div className="space-y-5 animate-fadeIn text-left">
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
                신청인: <strong className="text-slate-800">{clientName}</strong> · 총채무: {petition.totalDebtPrincipal.toLocaleString()}원 · 가용소득: {budget.disposableIncome.toLocaleString()}원 · 관할: {petition.courtName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSaveData}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? '저장 중...' : '파산 데이터 저장'}</span>
            </button>

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
              <span>파산·면책 8대 서식 출력/PDF</span>
            </button>
          </div>
        </div>

        {/* 4대 핵심 판정 지표 바 */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 text-xs">
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
            <span className="text-slate-500 font-medium">3. 비면책 조세체납:</span>
            <span className="font-extrabold font-mono text-amber-600">
              {taxArrears.totalArrears.toLocaleString()}원 (별도 관리)
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">4. 면책불허가 리스크:</span>
            <span className={`font-bold ${riskCount === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {riskCount === 0 ? '안전 (사유 없음)' : `${riskCount}건 주의/방어필요`}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. 서브 탭 네비게이션 ── */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl px-2 shadow-xs overflow-x-auto scrollbar-none">
        {[
          { key: 'petition', label: '1. 신청서 & 진술서 감수', icon: '📝' },
          { key: 'statement', label: '2. 진술서 & 면책불허가 점검', icon: '🛡️' },
          { key: 'creditors', label: '3. 채권자 & 소송/압류 이력', icon: '📋' },
          { key: 'assets', label: '4. 재산목록 & 관재인 5대 조사', icon: '🏦' },
          { key: 'living', label: '5. 주거 6분류 & 조세 체납표', icon: '📊' },
          { key: 'docs', label: '6. 15대 필수서류 & 미제출 사유', icon: '📁' },
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

      {/* ══════════ [1탭] 파산·면책 신청서 & 의뢰인 진술서 감수 ══════════ */}
      {activeSubTab === 'petition' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900">신청 취지 및 의뢰인 사전 진술문 변호사 감수(Polishing)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                모바일 앱에서 의뢰인이 작성한 사연을 불러와 변호사가 법원 제출 규격의 법률적 문장으로 윤색합니다.
              </p>
            </div>
            <button
              onClick={handleLoadClientStory}
              className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>고객 사전 진술서 불러오기</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-700 font-bold block mb-1">등록기준지 (가족관계증명서 기준)</label>
              <input 
                type="text" 
                value={petition.registeredDomicile || ''} 
                onChange={(e) => setPetition({ ...petition, registeredDomicile: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                placeholder="예: 서울특별시 중구 세종대로 110"
              />
            </div>
            <div>
              <label className="text-slate-700 font-bold block mb-1">송달장소 (대리인 사무소)</label>
              <input 
                type="text" 
                value={petition.serviceAddress || ''} 
                onChange={(e) => setPetition({ ...petition, serviceAddress: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                placeholder="예: 서울특별시 서초구 서초대로 456, 501호 (담당변호사)"
              />
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-700 font-bold block mb-1">지급불능에 이르게 된 주된 원인</label>
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

            {/* 의뢰인 원문 vs 변호사 감수문 2열 비교 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>📱</span> 의뢰인 작성 원본 진술 (모바일/상담)
                  </span>
                  <span className="text-[10px] text-slate-400">의뢰인 입력분</span>
                </div>
                <textarea 
                  value={statement.debtorStoryRaw || ''} 
                  onChange={(e) => setStatement({ ...statement, debtorStoryRaw: e.target.value })}
                  rows={5}
                  placeholder="의뢰인이 스마트폰으로 작성한 사연이 이곳에 표시됩니다."
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 leading-relaxed text-xs focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" /> 법률적 진술문 (변호사 감수·완성본)
                  </span>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-md">
                    법원 제출 반영
                  </span>
                </div>
                <textarea 
                  value={statement.debtorStoryPolished || ''} 
                  onChange={(e) => setStatement({ ...statement, debtorStoryPolished: e.target.value })}
                  rows={5}
                  placeholder="변호사가 법원 실무준칙에 부합하도록 윤색한 진술문을 작성합니다."
                  className="w-full bg-white border border-purple-200 rounded-xl p-3 leading-relaxed text-xs focus:ring-1 focus:ring-purple-500 font-serif"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ [2탭] 파산 진술서 & 면책불허가사유 8대 스크리닝 ══════════ */}
      {activeSubTab === 'statement' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h4 className="font-bold text-sm text-slate-900">
              채무자회생법 제564조 면책불허가사유 8대 항목 자가진단 및 과거 법적이력
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              해당 사항이 있을 경우 파산관재인의 심문 대상이 되므로 사전 방어 논리를 소명해야 합니다.
            </p>
          </div>

          {/* 과거 이력 3종 체크 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="font-bold text-slate-800 block mb-1">1. 과거 7년(파산) / 5년(회생) 면책 이력</span>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input 
                  type="checkbox" 
                  checked={statement.pastDischargeHistory?.hasPastDischarge || false}
                  onChange={(e) => setStatement({
                    ...statement,
                    pastDischargeHistory: {
                      hasPastDischarge: e.target.checked,
                      isElapsedEligible: !e.target.checked
                    }
                  })}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-slate-700 font-medium">과거 면책 결정 받은 사실 있음</span>
              </label>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="font-bold text-slate-800 block mb-1">2. 직계존비속/배우자 동시 파산 여부</span>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input 
                  type="checkbox" 
                  checked={statement.concurrentFamilyBankruptcy?.hasConcurrent || false}
                  onChange={(e) => setStatement({
                    ...statement,
                    concurrentFamilyBankruptcy: { hasConcurrent: e.target.checked }
                  })}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-slate-700 font-medium">가족 중 동시 파산 신청자 있음</span>
              </label>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="font-bold text-slate-800 block mb-1">3. 사기·사기파산 등 형사처벌 전력</span>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input 
                  type="checkbox" 
                  checked={statement.criminalRecordForFraud?.hasRecord || false}
                  onChange={(e) => setStatement({
                    ...statement,
                    criminalRecordForFraud: { hasRecord: e.target.checked }
                  })}
                  className="w-4 h-4 rounded text-purple-600"
                />
                <span className="text-slate-700 font-medium">관련 형사 처벌 전력 있음</span>
              </label>
            </div>
          </div>

          {/* 8대 불허가 항목 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2">
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

      {/* ══════════ [3탭] 채권자목록 & 소송/가압류 집행 이력 ══════════ */}
      {activeSubTab === 'creditors' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900">파산 채권자목록 및 채권별 소송·강제집행 진행 내역</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                채무 발생 원인과 진행 중인 법원 소송·압류 내역을 체계적으로 관리하여 면책 후 압류 해제를 지원합니다.
              </p>
            </div>
            <button
              onClick={handleAddCreditor}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>채권자 추가</span>
            </button>
          </div>

          <div className="space-y-3">
            {creditors.map((c, idx) => (
              <div key={c.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                      #{idx + 1}
                    </span>
                    <input 
                      type="text" 
                      value={c.creditorName} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, creditorName: val } : item));
                      }}
                      className="font-bold text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1"
                      placeholder="채권자명 입력"
                    />

                    {(() => {
                      const preset = matchCreditorPreset(c.creditorName);
                      if (!preset) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setCreditors(prev => prev.map(item => item.id === c.id ? {
                              ...item,
                              creditorName: preset.officialName,
                              zipCode: preset.zipCode,
                              address: preset.address,
                              serviceAddress: preset.serviceAddress,
                              representative: preset.representative,
                              bizNumber: preset.bizNumber,
                              isNonDischargeable: preset.isPriorityDefault ?? item.isNonDischargeable
                            } : item));
                            toast.success(`'${preset.officialName}' 공식 송달주소가 적용되었습니다!`);
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 cursor-pointer press-scale"
                          title="공식 법인명, 우편번호, 주소, 송달장소 원클릭 자동채우기"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                          <span>공식주소 자동채우기</span>
                        </button>
                      );
                    })()}

                    {c.isNonDischargeable ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                        🚫 비면책 채권
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        면책 대상
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={c.isNonDischargeable} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, isNonDischargeable: val } : item));
                        }}
                        className="rounded text-rose-600"
                      />
                      <span>비면책채권(조세/벌금)</span>
                    </label>
                    <button 
                      onClick={() => setCreditors(prev => prev.filter(item => item.id !== c.id))}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-slate-500 block mb-0.5">채무발생원인</label>
                    <select 
                      value={c.debtCause}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, debtCause: val } : item));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-bold"
                    >
                      <option value="CASH_LOAN">금원차용(신용대출)</option>
                      <option value="CREDIT_CARD">신용카드 대금</option>
                      <option value="PURCHASE_GOODS">물품대금</option>
                      <option value="INDEMNITY">구상금 채무</option>
                      <option value="GUARANTEE">연대보증 채무</option>
                      <option value="OTHER">조세 및 기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">원금(원)</label>
                    <input 
                      type="number" 
                      value={c.principal}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, principal: val } : item));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">이자(원)</label>
                    <input 
                      type="number" 
                      value={c.interest}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, interest: val } : item));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">최초 발생일자</label>
                    <input 
                      type="date" 
                      value={c.borrowedDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, borrowedDate: val } : item));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                </div>

                {/* ── 법원 송달주소 및 대표자 정보 ── */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between text-slate-700 font-bold">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>법원 송달주소 및 법인정보 (송달불능 방지 필수)</span>
                    </span>
                    {c.address ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ 주소 등록됨</span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-bold">⚠️ 주소 미입력 (송달불능 위험)</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-500 block mb-0.5 text-[10px]">우편번호</label>
                      <input
                        type="text"
                        placeholder="예: 07331"
                        value={c.zipCode || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, zipCode: val } : item));
                        }}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5 text-[10px]">대표자</label>
                      <input
                        type="text"
                        placeholder="예: 대표이사 OOO"
                        value={c.representative || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, representative: val } : item));
                        }}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5 text-[10px]">사업자/법인번호</label>
                      <input
                        type="text"
                        placeholder="예: 201-81-47789"
                        value={c.bizNumber || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, bizNumber: val } : item));
                        }}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 block mb-0.5 text-[10px]">본점 주소 / 주민등록지</label>
                      <input
                        type="text"
                        placeholder="예: 서울특별시 영등포구 의사당대로 141 (여의도동)"
                        value={c.address || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, address: val } : item));
                        }}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5 text-[10px]">법원 우편물 송달장소</label>
                      <input
                        type="text"
                        placeholder="미입력 시 본점 주소로 송달"
                        value={c.serviceAddress || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditors(prev => prev.map(item => item.id === c.id ? { ...item, serviceAddress: val } : item));
                        }}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 법원 소송 및 강제집행 정보 */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input 
                      type="checkbox"
                      checked={c.lawsuitInfo?.hasLawsuit || false}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setCreditors(prev => prev.map(item => item.id === c.id ? {
                          ...item,
                          lawsuitInfo: {
                            ...item.lawsuitInfo,
                            hasLawsuit: val,
                            lawsuitType: val ? (item.lawsuitInfo?.lawsuitType || 'PAYMENT_ORDER') : undefined
                          }
                        } : item));
                      }}
                      className="rounded text-purple-600"
                    />
                    <span>진행 중인 소송/가압류/추심명령 있음</span>
                  </label>

                  {c.lawsuitInfo?.hasLawsuit && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select 
                        value={c.lawsuitInfo?.lawsuitType || 'PAYMENT_ORDER'}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setCreditors(prev => prev.map(item => item.id === c.id ? {
                            ...item,
                            lawsuitInfo: { ...item.lawsuitInfo, hasLawsuit: true, lawsuitType: val }
                          } : item));
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-[11px] font-bold"
                      >
                        <option value="PAYMENT_ORDER">지급명령</option>
                        <option value="LOAN_LAWSUIT">대여금청구 소송</option>
                        <option value="SEIZURE_COLLECTION">압류 및 추심명령</option>
                        <option value="CHATTEL_SEIZURE">유체동산 압류</option>
                        <option value="AUCTION">부동산 경매</option>
                        <option value="OTHER">기타 강제집행</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="법원 (예: 서울중앙지법)"
                        value={c.lawsuitInfo?.courtName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditors(prev => prev.map(item => item.id === c.id ? {
                            ...item,
                            lawsuitInfo: { ...item.lawsuitInfo, hasLawsuit: true, courtName: val }
                          } : item));
                        }}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] w-28"
                      />
                      <input 
                        type="text" 
                        placeholder="사건번호 (2024타채...)"
                        value={c.lawsuitInfo?.caseNumber || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCreditors(prev => prev.map(item => item.id === c.id ? {
                            ...item,
                            lawsuitInfo: { ...item.lawsuitInfo, hasLawsuit: true, caseNumber: val }
                          } : item));
                        }}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] w-32"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ [4탭] 재산목록 & 🌟 파산관재인 5대 심층 조사재산 ══════════ */}
      {activeSubTab === 'assets' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h4 className="font-bold text-sm text-slate-900">
              기본 재산목록 & 🌟 파산관재인 5대 심층 조사재산 (리걸플로 실무 규격)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              채무자회생법 제383조(면제재산 1,110만 원) 공제와 함께 파산관재인이 최우선 조사하는 5대 특수재산을 소명합니다.
            </p>
          </div>

          {/* 1. 기본 재산목록 (1,110만 공제) */}
          <div className="space-y-3">
            <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <span>🏦</span> 신청인 기본 재산 (면제재산 및 압류금지 공제)
            </h5>
            <div className="space-y-2">
              {assets.map(ast => (
                <div key={ast.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
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
          </div>

          {/* 2. 파산관재인 5대 심층 조사재산 */}
          <div className="space-y-5 pt-4 border-t border-slate-200">
            <h5 className="font-bold text-xs text-purple-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              <span>파산관재인 5대 필수 조사재산 (편파변제 및 부인권 대상 점검)</span>
            </h5>

            {/* (1) 최근 1년 내 처분재산 */}
            <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">① 지급불능 1년 전부터 현재까지 처분한 재산</span>
                  <p className="text-[11px] text-slate-500">부동산, 차량, 회원권 등을 매각한 경우 대금의 구체적 사용처를 소명해야 합니다.</p>
                </div>
                <button
                  onClick={handleAddDisposedAsset}
                  className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 처분재산 추가
                </button>
              </div>

              {investigationAssets.disposedAssets1Year.length === 0 ? (
                <div className="text-center py-4 bg-white/60 rounded-xl border border-dashed border-purple-200 text-xs text-slate-500">
                  최근 1년 내 처분한 부동산 또는 고가 재산 없음 (양호)
                </div>
              ) : (
                investigationAssets.disposedAssets1Year.map(disp => (
                  <div key={disp.id} className="p-3 bg-white rounded-xl border border-purple-200 space-y-2 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input 
                        type="text" 
                        placeholder="처분 품목 (예: 소나타 승용차)"
                        value={disp.itemTitle}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvestigationAssets(prev => ({
                            ...prev,
                            disposedAssets1Year: prev.disposedAssets1Year.map(x => x.id === disp.id ? { ...x, itemTitle: val } : x)
                          }));
                        }}
                        className="border border-slate-200 rounded-lg p-1.5"
                      />
                      <input 
                        type="date" 
                        value={disp.disposedDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvestigationAssets(prev => ({
                            ...prev,
                            disposedAssets1Year: prev.disposedAssets1Year.map(x => x.id === disp.id ? { ...x, disposedDate: val } : x)
                          }));
                        }}
                        className="border border-slate-200 rounded-lg p-1.5"
                      />
                      <input 
                        type="number" 
                        placeholder="처분금액(원)"
                        value={disp.disposedAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setInvestigationAssets(prev => ({
                            ...prev,
                            disposedAssets1Year: prev.disposedAssets1Year.map(x => x.id === disp.id ? { ...x, disposedAmount: val } : x)
                          }));
                        }}
                        className="border border-slate-200 rounded-lg p-1.5 font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          placeholder="매수인 (친인척 여부)"
                          value={disp.counterparty}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInvestigationAssets(prev => ({
                              ...prev,
                              disposedAssets1Year: prev.disposedAssets1Year.map(x => x.id === disp.id ? { ...x, counterparty: val } : x)
                            }));
                          }}
                          className="border border-slate-200 rounded-lg p-1.5 flex-1"
                        />
                        <button 
                          onClick={() => handleRemoveDisposedAsset(disp.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      placeholder="매각대금 구체적 사용처 소명 (예: 신한은행 채무 상환 1,500만, 수술비 500만)"
                      value={disp.usageDetail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvestigationAssets(prev => ({
                          ...prev,
                          disposedAssets1Year: prev.disposedAssets1Year.map(x => x.id === disp.id ? { ...x, usageDetail: val } : x)
                        }));
                      }}
                      className="w-full border border-slate-200 rounded-lg p-1.5 text-[11px]"
                    />
                  </div>
                ))
              )}
            </div>

            {/* (2) 최근 2년 내 반환받은 임차보증금 */}
            <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">② 최근 2년간 종료된 임대차계약의 반환 보증금</span>
                  <p className="text-[11px] text-slate-500">종전 거주지에서 돌려받은 보증금의 사용처를 관재인에게 소명합니다.</p>
                </div>
                <button
                  onClick={handleAddReturnedDeposit}
                  className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> 반환보증금 추가
                </button>
              </div>

              {investigationAssets.returnedDeposits2Years.length === 0 ? (
                <div className="text-center py-4 bg-white/60 rounded-xl border border-dashed border-purple-200 text-xs text-slate-500">
                  최근 2년간 반환받은 종전 임차보증금 없음 (양호)
                </div>
              ) : (
                investigationAssets.returnedDeposits2Years.map(ret => (
                  <div key={ret.id} className="p-3 bg-white rounded-xl border border-purple-200 space-y-2 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <input 
                        type="text" 
                        placeholder="종전 임차지 주소"
                        value={ret.housingAddress}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvestigationAssets(prev => ({
                            ...prev,
                            returnedDeposits2Years: prev.returnedDeposits2Years.map(x => x.id === ret.id ? { ...x, housingAddress: val } : x)
                          }));
                        }}
                        className="border border-slate-200 rounded-lg p-1.5"
                      />
                      <input 
                        type="date" 
                        value={ret.returnedDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvestigationAssets(prev => ({
                            ...prev,
                            returnedDeposits2Years: prev.returnedDeposits2Years.map(x => x.id === ret.id ? { ...x, returnedDate: val } : x)
                          }));
                        }}
                        className="border border-slate-200 rounded-lg p-1.5"
                      />
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          placeholder="반환금액(원)"
                          value={ret.returnedAmount}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setInvestigationAssets(prev => ({
                              ...prev,
                              returnedDeposits2Years: prev.returnedDeposits2Years.map(x => x.id === ret.id ? { ...x, returnedAmount: val } : x)
                            }));
                          }}
                          className="border border-slate-200 rounded-lg p-1.5 font-mono flex-1"
                        />
                        <button 
                          onClick={() => handleRemoveReturnedDeposit(ret.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      placeholder="반환금 사용처 소명 (예: 현재 거주지 월세 보증금 이체 1,000만, 타 채무 변제 500만)"
                      value={ret.usageDetail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvestigationAssets(prev => ({
                          ...prev,
                          returnedDeposits2Years: prev.returnedDeposits2Years.map(x => x.id === ret.id ? { ...x, usageDetail: val } : x)
                        }));
                      }}
                      className="w-full border border-slate-200 rounded-lg p-1.5 text-[11px]"
                    />
                  </div>
                ))
              )}
            </div>

            {/* (3) 최근 2년 내 이혼 및 재산분할 */}
            <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">③ 최근 2년 이내 이혼에 따른 재산분할 내역</span>
                  <p className="text-[11px] text-slate-500">위장이혼을 통한 재산은닉 또는 과도한 재산포기 여부를 조사합니다.</p>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                  <input 
                    type="checkbox"
                    checked={investigationAssets.divorceProperty2Years.hasDivorceWithin2Years}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setInvestigationAssets(prev => ({
                        ...prev,
                        divorceProperty2Years: { ...prev.divorceProperty2Years, hasDivorceWithin2Years: val }
                      }));
                    }}
                    className="rounded text-purple-600"
                  />
                  <span>최근 2년 내 이혼 사실 있음</span>
                </label>
              </div>

              {investigationAssets.divorceProperty2Years.hasDivorceWithin2Years && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-purple-200">
                  <div>
                    <label className="text-slate-500 block mb-0.5">이혼 유형</label>
                    <select 
                      value={investigationAssets.divorceProperty2Years.divorceType}
                      onChange={(e) => setInvestigationAssets(prev => ({
                        ...prev,
                        divorceProperty2Years: { ...prev.divorceProperty2Years, divorceType: e.target.value as any }
                      }))}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    >
                      <option value="CONSENSUS">협의이혼</option>
                      <option value="JUDICIAL">재판상 이혼(조정/판결)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">재산분할 수령액(원)</label>
                    <input 
                      type="number"
                      value={investigationAssets.divorceProperty2Years.propertyDivisionAmount || 0}
                      onChange={(e) => setInvestigationAssets(prev => ({
                        ...prev,
                        divorceProperty2Years: { ...prev.divorceProperty2Years, propertyDivisionAmount: Number(e.target.value) }
                      }))}
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">위자료(원)</label>
                    <input 
                      type="number"
                      value={investigationAssets.divorceProperty2Years.alimonyAmount || 0}
                      onChange={(e) => setInvestigationAssets(prev => ({
                        ...prev,
                        divorceProperty2Years: { ...prev.divorceProperty2Years, alimonyAmount: Number(e.target.value) }
                      }))}
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* (4) 친족 사망 상속재산 & 상속포기/협의분할 여부 */}
            <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">④ 친족 사망에 따른 상속재산 (상속포기/협의분할 추적)</span>
                  <p className="text-[11px] text-slate-500">상속지분 협의분할 포기는 파산관재인의 부인권(사해행위 취소) 단골 대상입니다.</p>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                  <input 
                    type="checkbox"
                    checked={investigationAssets.inheritanceProperty.hasInheritance}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setInvestigationAssets(prev => ({
                        ...prev,
                        inheritanceProperty: { ...prev.inheritanceProperty, hasInheritance: val }
                      }));
                    }}
                    className="rounded text-purple-600"
                  />
                  <span>최근 친족 사망 및 상속 발생</span>
                </label>
              </div>

              {investigationAssets.inheritanceProperty.hasInheritance && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-purple-200">
                  <div>
                    <label className="text-slate-500 block mb-0.5">망인과의 관계</label>
                    <input 
                      type="text" 
                      placeholder="예: 부(父), 모(母)"
                      value={investigationAssets.inheritanceProperty.decedentRelation || ''}
                      onChange={(e) => setInvestigationAssets(prev => ({
                        ...prev,
                        inheritanceProperty: { ...prev.inheritanceProperty, decedentRelation: e.target.value }
                      }))}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">상속 처리 현황</label>
                    <select 
                      value={investigationAssets.inheritanceProperty.divisionStatus}
                      onChange={(e) => setInvestigationAssets(prev => ({
                        ...prev,
                        inheritanceProperty: { ...prev.inheritanceProperty, divisionStatus: e.target.value as any }
                      }))}
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-bold"
                    >
                      <option value="WAIVED">법원 상속포기 수리 완료 (안전)</option>
                      <option value="AGREED_DIVISION">상속재산 협의분할 (부인권 검토 필요)</option>
                      <option value="LEGAL_PORTION">법정상속분 등기</option>
                      <option value="NONE">상속재산 일체 없음</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">상속포기 결정 법원/일자</label>
                    <input 
                      type="text" 
                      placeholder="예: 서울가정법원 2023느단123"
                      value={investigationAssets.inheritanceProperty.waiverCourtAndDate || ''}
                      onChange={(e) => setInvestigationAssets(prev => ({
                        ...prev,
                        inheritanceProperty: { ...prev.inheritanceProperty, waiverCourtAndDate: e.target.value }
                      }))}
                      className="w-full border border-slate-200 rounded-lg p-1.5"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* (5) 퇴직금 및 1/2 압류금지 공제 */}
            <div className="p-4 bg-purple-50/40 rounded-2xl border border-purple-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-900">⑤ 예상 퇴직금 및 1/2 압류금지 산정</span>
                  <p className="text-[11px] text-slate-500">민사집행법 제246조에 따라 퇴직금의 1/2은 압류금지되며 잔여액만 환가대상에 산입됩니다.</p>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                  <input 
                    type="checkbox"
                    checked={investigationAssets.severancePay.hasSeverance}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setInvestigationAssets(prev => ({
                        ...prev,
                        severancePay: { ...prev.severancePay, hasSeverance: val }
                      }));
                    }}
                    className="rounded text-purple-600"
                  />
                  <span>퇴직금 수령 예정 직장 재직 중</span>
                </label>
              </div>

              {investigationAssets.severancePay.hasSeverance && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-purple-200">
                  <div>
                    <label className="text-slate-500 block mb-0.5">예상 퇴직금 총액(원)</label>
                    <input 
                      type="number"
                      value={investigationAssets.severancePay.expectedTotalAmount}
                      onChange={(e) => {
                        const total = Number(e.target.value);
                        const half = Math.round(total / 2);
                        setInvestigationAssets(prev => ({
                          ...prev,
                          severancePay: {
                            ...prev.severancePay,
                            expectedTotalAmount: total,
                            exemptAmount: half,
                            liquidationAmount: half
                          }
                        }));
                      }}
                      className="w-full border border-slate-200 rounded-lg p-1.5 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">1/2 법정 압류금지액(원)</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-mono text-emerald-700 font-bold">
                      {investigationAssets.severancePay.exemptAmount.toLocaleString()}원
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-0.5">파산재단 환가 대상액(원)</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-mono text-rose-700 font-bold">
                      {investigationAssets.severancePay.liquidationAmount.toLocaleString()}원
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ [5탭] 주거 6분류 & 비면책 조세 체납표 & 가계수지표 ══════════ */}
      {activeSubTab === 'living' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
          {/* 1. 주거 6분류 */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Home className="w-4 h-4 text-purple-600" /> 주거의 상황 (리걸플로 6분류 표준)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                { type: 'APPLICANT_OWNED', label: '1. 신청인 소유 부동산' },
                { type: 'DORMITORY', label: '2. 사택 또는 기숙사' },
                { type: 'RENT_LEASE', label: '3. 임차(전·월세) 주택' },
                { type: 'RELATIVE_FREE', label: '4. 친족 소유 주택 무상거주' },
                { type: 'NON_RELATIVE_FREE', label: '5. 타인 주택 무상거주' },
                { type: 'OTHER', label: '6. 기타 거주' },
              ].map(res => (
                <button
                  key={res.type}
                  type="button"
                  onClick={() => setResidence(prev => ({ ...prev, residenceType: res.type as any }))}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    residence.residenceType === res.type 
                      ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold shadow-xs' 
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>

            {(residence.residenceType === 'RELATIVE_FREE' || residence.residenceType === 'NON_RELATIVE_FREE') && (
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 text-xs space-y-2">
                <span className="font-bold text-amber-900 block">무상거주 소명 필수 사항</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="소유자 성명 및 신청인과의 관계 (예: 모 김순이)"
                    value={residence.ownerRelation || ''}
                    onChange={(e) => setResidence({ ...residence, ownerRelation: e.target.value })}
                    className="bg-white border border-amber-200 rounded-lg p-2"
                  />
                  <input 
                    type="text" 
                    placeholder="무상거주 사유 (예: 파산으로 주거상실하여 모 거주지에 무상거주)"
                    value={residence.freeStayReason || ''}
                    onChange={(e) => setResidence({ ...residence, freeStayReason: e.target.value })}
                    className="bg-white border border-amber-200 rounded-lg p-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. 비면책 조세 및 공과금 체납표 */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-purple-600" /> 비면책 조세 및 공과금 체납 상세표
              </h4>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">
                체납 총액: {taxArrears.totalArrears.toLocaleString()}원 (면책 효력 배제)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-slate-600 block mb-0.5 font-medium">국세(소득세/부가세)</label>
                <input 
                  type="number" 
                  value={taxArrears.incomeTax}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTaxArrears(prev => {
                      const updated = { ...prev, incomeTax: val };
                      updated.totalArrears = updated.incomeTax + updated.localIncomeTax + updated.propertyTax + updated.healthInsurance + updated.nationalPension + updated.otherTax;
                      return updated;
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-0.5 font-medium">지방세(주민세/지방소득세)</label>
                <input 
                  type="number" 
                  value={taxArrears.localIncomeTax}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTaxArrears(prev => {
                      const updated = { ...prev, localIncomeTax: val };
                      updated.totalArrears = updated.incomeTax + updated.localIncomeTax + updated.propertyTax + updated.healthInsurance + updated.nationalPension + updated.otherTax;
                      return updated;
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-0.5 font-medium">건강보험료 체납액</label>
                <input 
                  type="number" 
                  value={taxArrears.healthInsurance}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTaxArrears(prev => {
                      const updated = { ...prev, healthInsurance: val };
                      updated.totalArrears = updated.incomeTax + updated.localIncomeTax + updated.propertyTax + updated.healthInsurance + updated.nationalPension + updated.otherTax;
                      return updated;
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-0.5 font-medium">국민연금 체납액</label>
                <input 
                  type="number" 
                  value={taxArrears.nationalPension}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTaxArrears(prev => {
                      const updated = { ...prev, nationalPension: val };
                      updated.totalArrears = updated.incomeTax + updated.localIncomeTax + updated.propertyTax + updated.healthInsurance + updated.nationalPension + updated.otherTax;
                      return updated;
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-0.5 font-medium">재산세/자동차세</label>
                <input 
                  type="number" 
                  value={taxArrears.propertyTax}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTaxArrears(prev => {
                      const updated = { ...prev, propertyTax: val };
                      updated.totalArrears = updated.incomeTax + updated.localIncomeTax + updated.propertyTax + updated.healthInsurance + updated.nationalPension + updated.otherTax;
                      return updated;
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-0.5 font-medium">기타 공과금 체납</label>
                <input 
                  type="number" 
                  value={taxArrears.otherTax}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTaxArrears(prev => {
                      const updated = { ...prev, otherTax: val };
                      updated.totalArrears = updated.incomeTax + updated.localIncomeTax + updated.propertyTax + updated.healthInsurance + updated.nationalPension + updated.otherTax;
                      return updated;
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. 가계수지표 */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="font-bold text-sm text-slate-900">가계수지표 (월 가용소득 0원 입증)</h4>
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
        </div>
      )}

      {/* ══════════ [6탭] 15대 필수서류 목록 & 미제출 사유 인라인 작성기 ══════════ */}
      {activeSubTab === 'docs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                서울회생법원 실무준칙 개인파산 15대 필수자료제출목록 및 미제출 사유서
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                미제출 서류의 경우 사유를 작성하면 법원 정식 양식의 <strong>'자료제출목록 및 미제출 사유서'</strong>로 자동 출력됩니다.
              </p>
            </div>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
              제출 {requiredDocs.filter(d => d.status === 'SUBMITTED').length}건 / 미제출·소명 {requiredDocs.filter(d => d.status !== 'SUBMITTED').length}건
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {requiredDocs.map(d => {
              const isSubmitted = d.status === 'SUBMITTED';
              return (
                <div key={d.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-purple-600 w-6">#{d.itemNumber}</span>
                      <div>
                        <span className="font-bold text-slate-800">{d.title}</span>
                        <span className="text-[11px] text-slate-500 ml-2">({d.detailDescription})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRequiredDocs(prev => prev.map(x => x.id === d.id ? { ...x, status: 'SUBMITTED' } : x));
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          isSubmitted 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        제출완료
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRequiredDocs(prev => prev.map(x => x.id === d.id ? { 
                            ...x, 
                            status: 'UNOBTAINABLE',
                            unobtainableReason: x.unobtainableReason || '해당 사유 없음 또는 발급 불가로 미제출'
                          } : x));
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          !isSubmitted 
                            ? 'bg-amber-600 text-white shadow-xs' 
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        미제출(사유소명)
                      </button>
                    </div>
                  </div>

                  {!isSubmitted && (
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-800 shrink-0">
                          ⚠️ 제출 못하거나 일부만 제출한 사유:
                        </span>
                        <input 
                          type="text" 
                          value={d.unobtainableReason || ''} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setRequiredDocs(prev => prev.map(x => x.id === d.id ? { ...x, unobtainableReason: val } : x));
                          }}
                          placeholder="구체적 미제출 사유를 입력하세요 (예: 해당 재산 일체 없어 미제출)"
                          className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-500 font-medium text-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 출력 모달 (8대 정식 서식 일괄 렌더링) */}
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
