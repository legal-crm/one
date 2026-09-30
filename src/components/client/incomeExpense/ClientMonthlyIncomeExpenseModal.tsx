import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calculator, Plus, Trash2, Save, Send, Sparkles, Info, Mic, MicOff, Volume2, Table2, ListChecks, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import { useDialog } from '../../common/DialogProvider';
import { secureSetItem } from '../../../utils/secureStorage';
import { cn } from '../../../utils/cn';
import { Badge, Button, DocModal, FormField, MoneyInput, SegmentedTabs, buildSubmitConfirm, inputClass, useDocAutosave } from '../ui';
import type {
  IncomeExpenseD5103Data,
  DetailedIncomeType,
  DynamicExpenseItem,
  MonthlyLedgerItem,
  BusinessMonthlyLedger,
  FreelancerMonthlyLedger,
  FreelancerExpenseItem,
  DayLaborerLedger,
  PartTimeLedger,
  PartTimeWorkplace
} from '../../../types/incomeExpenseTypes';
import {
  generateMonthlyLedgerFromWizardInputs,
  recalculateBusinessMonthlyLedger,
  syncBusinessLedgerToD5103,
  syncFreelancerLedgerToD5103,
  syncDayLaborerLedgerToD5103,
  syncPartTimeToD5103
} from '../../../services/documents/incomeExpenseService';

interface ClientMonthlyIncomeExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  initialD5103?: IncomeExpenseD5103Data | null;
  onSaveD5103?: (updatedData: IncomeExpenseD5103Data) => Promise<void> | void;
}

// 2026년 최저임금 (시간급, 고용노동부 고시)
const MIN_WAGE_2026 = 10320;

// 자주 쓰는 경비 항목 이름(금액은 사용자가 직접 입력)
const POPULAR_EXPENSE_PRESETS: { name: string; target: 'operating' | 'rent' | 'utility' | 'electricity' }[] = [
  { name: '배달대행료 (배민/쿠팡/요기요)', target: 'operating' },
  { name: '세무기장료 및 세무신고비', target: 'operating' },
  { name: '아르바이트/직원 인건비', target: 'operating' },
  { name: 'POS단말기 및 카드수수료', target: 'operating' },
  { name: '매장 정수기/캡스 렌탈료', target: 'operating' },
  { name: '매장 인터넷 및 유선전화료', target: 'operating' },
  { name: '주방 식자재 및 소모품비', target: 'operating' },
  { name: '상가 관리비 (기본관리비)', target: 'rent' },
  { name: '상가 화재/배상책임보험료', target: 'operating' },
  { name: '영업용 차량 유류비 및 주차비', target: 'operating' }
];

// 소득 형태 탭(짧은 이름은 탭, 설명은 본문 첫 줄)
const INCOME_TYPES: { id: DetailedIncomeType; label: string; desc: string }[] = [
  { id: 'BUSINESS', label: '사업자', desc: '매장·도소매 등 개인사업자' },
  { id: 'FREELANCER', label: '프리랜서', desc: '3.3% 원천징수 사업소득(배달·강사·개발 등)' },
  { id: 'DAY_LABORER', label: '일용직', desc: '현장·물류 등 일당을 받는 일용근로' },
  { id: 'PART_TIME', label: '아르바이트', desc: '시간제·단기 아르바이트' }
];

const won = (n: number) => (n || 0).toLocaleString('ko-KR');

function StepTitle({ id, num, title, hint }: { id: string; num?: number; title: string; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
      <h3 id={id} className="flex items-center gap-2 text-base font-bold text-slate-900">
        {num !== undefined && (
          <span className="w-6 h-6 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center" aria-hidden="true">
            {num}
          </span>
        )}
        {title}
      </h3>
      {hint && <span className="text-xs text-slate-600">{hint}</span>}
    </div>
  );
}

/** 계산 결과(참고 금액) 카드 */
function ResultCard({ label, value, detail, evidence }: { label: string; value: number; detail?: React.ReactNode; evidence?: string }) {
  return (
    <section aria-label={`${label} 계산 결과`} className="rounded-2xl border-2 border-brand/20 bg-white p-4 sm:p-5 space-y-2">
      <p className="text-xs font-bold text-slate-600">입력값으로 계산한 참고 금액 · 담당 변호사 확인 후 확정</p>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-base font-bold text-slate-900">{label}</span>
        <span className="text-2xl font-extrabold text-brand tabular-nums">{won(value)}원</span>
      </p>
      {detail && <p className="text-xs text-slate-600 tabular-nums leading-relaxed">{detail}</p>}
      {evidence && <p className="text-xs text-slate-600 leading-relaxed">준비할 자료: {evidence}</p>}
    </section>
  );
}

/** 이름 + 월 금액 + 삭제 한 줄(모바일: 이름 줄 아래 금액) */
function ExpenseRow({
  name,
  amount,
  onName,
  onAmount,
  onRemove,
  namePlaceholder = '경비 항목 이름',
}: {
  name: string;
  amount: number;
  onName: (v: string) => void;
  onAmount: (v: number) => void;
  onRemove: () => void;
  namePlaceholder?: string;
}) {
  const label = name.trim() || '경비 항목';
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_12rem_2.75rem] gap-2 items-start rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      <input
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder={namePlaceholder}
        aria-label="경비 항목 이름"
        className={cn(inputClass, 'text-sm font-medium')}
      />
      <div className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">
        <MoneyInput aria-label={`${label} 월 금액`} value={amount || null} onChange={(v) => onAmount(v ?? 0)} showKoreanHint={false} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label} 삭제`}
        className="col-start-2 row-start-1 sm:col-start-3 w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export default function ClientMonthlyIncomeExpenseModal({
  isOpen,
  onClose,
  clientId,
  clientName = '신청인',
  initialD5103,
  onSaveD5103
}: ClientMonthlyIncomeExpenseModalProps) {
  // 소득 유형 탭 ('BUSINESS' | 'FREELANCER' | 'DAY_LABORER' | 'PART_TIME')
  const [selectedIncomeType, setSelectedIncomeType] = useState<DetailedIncomeType>('BUSINESS');

  // 사업자 간편 마법사 상태
  const [bizCard, setBizCard] = useState<number>(0);
  const [bizCash, setBizCash] = useState<number>(0);
  const [bizBaseOperating, setBizBaseOperating] = useState<number>(0);
  const [bizRent, setBizRent] = useState<number>(0);
  const [bizUtility, setBizUtility] = useState<number>(0);
  const [bizElectricity, setBizElectricity] = useState<number>(0);
  const [dynamicExpenses, setDynamicExpenses] = useState<DynamicExpenseItem[]>([]);

  // 사업자: 질문 방식 vs 12개월 표 직접 입력
  const [viewMode, setViewMode] = useState<'wizard' | 'sheet'>('wizard');
  const [manualMonths, setManualMonths] = useState<MonthlyLedgerItem[]>([]);

  // 프리랜서 상태
  const [flJobType, setFlJobType] = useState<string>('');
  const [flGross, setFlGross] = useState<number>(0);
  const [flExpenses, setFlExpenses] = useState<FreelancerExpenseItem[]>([
    // 흔한 경비 항목 이름만 제시하고 금액은 0원 — 실제 지출이 없는 경비가 순소득에서 빠지지 않도록
    { id: 'fle_1', name: '오토바이/차량 유류비 및 정비비', monthlyAmount: 0, category: 'fuel' },
    { id: 'fle_2', name: '스마트폰 통신비 및 업무 플랫폼료', monthlyAmount: 0, category: 'telecom' },
    { id: 'fle_3', name: '시간제 유상운송보험료', monthlyAmount: 0, category: 'fee' }
  ]);

  // 일용직 상태
  const [dlWorkDays, setDlWorkDays] = useState<number>(0);
  const [dlDailyWage, setDlDailyWage] = useState<number>(0);
  const [dlIsCash, setDlIsCash] = useState<boolean>(false);

  // 아르바이트 상태
  const [ptWorkplaces, setPtWorkplaces] = useState<PartTimeWorkplace[]>([
    { id: 'ptw_1', workplaceName: '', hourlyWage: MIN_WAGE_2026, weeklyHours: 0, hasWeeklyHolidayPay: false, monthlyGrossIncome: 0 }
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const dialog = useDialog();

  // 저장 경로: 변호사 CRM 연동 콜백이 있으면 사건 기록(서버), 없으면(회생동행 등) 이 기기에 저장
  const savesToCrm = typeof onSaveD5103 === 'function';
  const wasSubmitted = initialD5103?.d5103ClientStatus === 'client_submitted' || !!initialD5103?.d5103ClientSubmittedAt;

  // 입력값 직렬화(변경 감지·자동 저장 기준)
  const formSnapshot = JSON.stringify([
    selectedIncomeType, bizCard, bizCash, bizBaseOperating, bizRent, bizUtility, bizElectricity, dynamicExpenses,
    viewMode, manualMonths, flJobType, flGross, flExpenses, dlWorkDays, dlDailyWage, dlIsCash, ptWorkplaces,
  ]);
  // 기존 데이터 복원이 화면에 반영된 뒤의 상태를 기준점으로 삼는다(아래 초기 데이터 로드 effect가 restoreTick을 올림)
  const [restoreTick, setRestoreTick] = useState(0);
  const restoredFromRef = useRef<'none' | 'default' | 'data'>('none');

  // 말로 작성하는 수지표(음성 입력) 상태
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState<boolean>(false);
  const [voiceParsedItems, setVoiceParsedItems] = useState<{ type: 'card' | 'cash' | 'rent' | 'utility' | 'expense'; label: string; amount: number }[]>([]);
  const [voiceTranscriptText, setVoiceTranscriptText] = useState<string>('');

  const extractItemsFromSpeech = (text: string) => {
    if (!text.trim()) return;
    const items: { type: 'card' | 'cash' | 'rent' | 'utility' | 'expense'; label: string; amount: number }[] = [];

    // "1억 2천만", "1천500만", "380만원", "3,500,000원", "월세 90"(단위 없음=만원) 모두 원 단위로 변환
    const parseAmount = (segment: string): number => {
      const s = segment.replace(/(\d),(?=\d{3})/g, '$1').replace(/\s+/g, '');
      const m = s.match(/^(?:(\d+)억)?(?:(\d+)천)?(\d+)?(만|원)?/);
      if (!m) return 0;
      const eok = m[1] ? parseInt(m[1], 10) : 0;
      const cheon = m[2] ? parseInt(m[2], 10) : 0;
      const rest = m[3] ? parseInt(m[3], 10) : 0;
      const unit = m[4];
      if (!eok && !cheon && !rest) return 0;
      if (unit === '원' && !eok && !cheon) return rest; // "3500000원"
      // 억·천·단위없는 숫자는 만원 단위로 해석 (단, 10000 이상 단위없는 숫자는 원으로 간주)
      if (!unit && !eok && !cheon && rest >= 10000) return rest;
      return eok * 100000000 + (cheon * 1000 + rest) * 10000;
    };

    const patterns = [
      { key: 'card', names: ['카드', '카드매출', '신용카드'], label: '카드 매출' },
      { key: 'cash', names: ['현금', '현금매출', '계좌이체'], label: '현금 매출' },
      { key: 'rent', names: ['월세', '임대료', '임차료', '상가월세', '가게월세'], label: '상가 월세(임차료)' },
      { key: 'utility', names: ['전기세', '수도세', '공과금', '관리비', '전기요금'], label: '전기·수도·공과금' },
      { key: 'expense', names: ['배달', '배달대행', '배민', '쿠팡이츠', '배달비'], label: '배달대행료' },
      { key: 'expense', names: ['식자재', '재료비', '원자재', '식료품'], label: '주방 식자재비' },
      { key: 'expense', names: ['기장료', '세무', '세무사', '세무비'], label: '세무기장료' },
      { key: 'expense', names: ['알바', '알바비', '인건비', '직원'], label: '아르바이트 인건비' },
      { key: 'expense', names: ['유류비', '기름값', '주유비'], label: '차량 유류비' },
      { key: 'expense', names: ['통신비', '인터넷', '전화요금', '스마트폰'], label: '통신비/인터넷' }
    ];

    patterns.forEach(p => {
      for (const name of p.names) {
        // 키워드와 금액 사이 간격은 짧게(조사·"은/는/이" 정도) 제한해 다른 항목 금액을 잘못 가져오지 않도록 함
        const AMOUNT = '(\\d[\\d,]*\\s*억\\s*(?:\\d+\\s*천)?\\s*(?:\\d+)?\\s*(?:만|원)?|\\d+\\s*천\\s*(?:\\d+)?\\s*(?:만|원)?|\\d[\\d,]*\\s*(?:만|원)?)';
        const regex1 = new RegExp(`${name}(?:은|는|이|가|에|이고|으로|로|이랑|\\s|:)*${AMOUNT}`);
        const m = regex1.exec(text);
        if (m) {
          const amt = parseAmount(m[1] || '');
          if (amt > 0 && !items.some(i => i.label === p.label)) {
            items.push({ type: p.key as any, label: p.label, amount: amt });
            break;
          }
        }
      }
    });

    if (items.length > 0) {
      setVoiceParsedItems(items);
    }
  };

  const {
    isSupported: isSpeechSupported,
    isListening,
    toggleListening
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (currentTranscript) => {
      setVoiceTranscriptText(currentTranscript);
      extractItemsFromSpeech(currentTranscript);
    }
  });

  const applyVoiceItemsToForm = () => {
    let appliedCount = 0;
    voiceParsedItems.forEach(item => {
      if (item.type === 'card') {
        setBizCard(item.amount);
        appliedCount++;
      } else if (item.type === 'cash') {
        setBizCash(item.amount);
        appliedCount++;
      } else if (item.type === 'rent') {
        setBizRent(item.amount);
        appliedCount++;
      } else if (item.type === 'utility') {
        setBizUtility(item.amount);
        appliedCount++;
      } else if (item.type === 'expense') {
        setDynamicExpenses(prev => {
          const exists = prev.some(e => e.name === item.label);
          if (exists) {
            return prev.map(e => e.name === item.label ? { ...e, monthlyAmount: item.amount } : e);
          }
          return [...prev, { id: `exp_${Date.now()}_${Math.random()}`, name: item.label, monthlyAmount: item.amount, rollupTarget: 'operating' }];
        });
        appliedCount++;
      }
    });

    if (selectedIncomeType === 'FREELANCER') {
      const cardOrCash = voiceParsedItems.find(i => i.type === 'card' || i.type === 'cash');
      if (cardOrCash) setFlGross(cardOrCash.amount);
    }

    toast.success(`말한 내용에서 찾은 ${appliedCount}개 항목을 반영했어요. 금액이 맞는지 확인해 주세요.`);
    setIsVoicePanelOpen(false);
  };

  // 초기 데이터 로드 — 저장본은 한 번만 불러온다(저장 뒤 부모가 새 객체를 넘겨도 입력 중인 화면을 덮어쓰지 않게)
  useEffect(() => {
    if (!isOpen) return;
    if (restoredFromRef.current === 'data') return;

    if (initialD5103) {
      restoredFromRef.current = 'data';
      if (initialD5103.detailedIncomeType) {
        setSelectedIncomeType(initialD5103.detailedIncomeType);
      } else if (initialD5103.incomeType === 'BUSINESS') {
        setSelectedIncomeType('BUSINESS');
      }

      // 사업자 데이터 복원
      if (initialD5103.monthlyLedger) {
        const ml = initialD5103.monthlyLedger;
        if (ml.months && ml.months.length > 0) {
          setManualMonths(ml.months);
          const first = ml.months[0];
          setBizCard(first.incomeCard || 0);
          setBizCash(first.incomeCash || 0);
          setBizRent(first.expenseRent || 0);
          setBizUtility(first.expenseUtility || 0);
          setBizElectricity(first.expenseElectricity || 0);
          setBizBaseOperating(first.expenseOperating || 0);
        }
        if (ml.dynamicExpenses && ml.dynamicExpenses.length > 0) {
          setDynamicExpenses(ml.dynamicExpenses);
        }
      }

      // 프리랜서 복원
      if (initialD5103.freelancerLedger) {
        const fl = initialD5103.freelancerLedger;
        setFlJobType(fl.jobTypeDetail || '');
        setFlGross(fl.monthlyGrossIncome || 0);
        if (fl.expenses && fl.expenses.length > 0) {
          setFlExpenses(fl.expenses);
        }
      }

      // 일용직 복원
      if (initialD5103.dayLaborerLedger) {
        const dl = initialD5103.dayLaborerLedger;
        setDlWorkDays(dl.workDaysPerMonth || 0);
        setDlDailyWage(dl.dailyWage || 0);
        setDlIsCash(!!dl.isDirectCash);
      }

      // 아르바이트 복원
      if (initialD5103.partTimeLedger && initialD5103.partTimeLedger.workplaces) {
        setPtWorkplaces(initialD5103.partTimeLedger.workplaces);
      }
    } else if (restoredFromRef.current === 'none') {
      restoredFromRef.current = 'default';
      // 기본 12개월 생성
      const initialLedger = generateMonthlyLedgerFromWizardInputs({
        avgMonthlyCard: bizCard,
        avgMonthlyCash: bizCash,
        baseOperatingExpense: bizBaseOperating,
        rentExpense: bizRent,
        utilityExpense: bizUtility,
        electricityExpense: bizElectricity,
        dynamicExpenses
      });
      setManualMonths(initialLedger.months);
    } else {
      return;
    }
    setRestoreTick(t => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialD5103]);

  // 간편 마법사 입력값 변경 시 12개월 원장 실시간 동기화 계산
  const generatedLedger: BusinessMonthlyLedger = useMemo(() => {
    if (viewMode === 'sheet' && manualMonths.length === 12) {
      return recalculateBusinessMonthlyLedger(manualMonths, dynamicExpenses);
    }
    return generateMonthlyLedgerFromWizardInputs({
      avgMonthlyCard: bizCard,
      avgMonthlyCash: bizCash,
      baseOperatingExpense: bizBaseOperating,
      rentExpense: bizRent,
      utilityExpense: bizUtility,
      electricityExpense: bizElectricity,
      dynamicExpenses
    });
  }, [bizCard, bizCash, bizBaseOperating, bizRent, bizUtility, bizElectricity, dynamicExpenses, viewMode, manualMonths]);

  // 프리랜서 순소득 계산
  const flTotalExpenses = useMemo(() => {
    return flExpenses.reduce((sum, item) => sum + (item.monthlyAmount || 0), 0);
  }, [flExpenses]);
  // 입력 금액은 원천징수(3.3%) 전 총수수료 → 원천징수세액을 빼고 경비를 차감한 실수령 기준 순소득
  const flWithholding = Math.round((flGross || 0) * 0.033);
  const flNetIncome = Math.max(0, flGross - flWithholding - flTotalExpenses);

  // 일용직 월소득 계산
  const dlMonthlyIncome = useMemo(() => {
    return (dlWorkDays || 0) * (dlDailyWage || 0);
  }, [dlWorkDays, dlDailyWage]);

  // 아르바이트 총소득 계산
  const ptTotalIncome = useMemo(() => {
    return ptWorkplaces.reduce((sum, wp) => sum + (wp.monthlyGrossIncome || 0), 0);
  }, [ptWorkplaces]);

  // 현재 입력값으로 D5103 데이터 만들기(선택한 소득 형태만 반영)
  const buildD5103 = (isSubmittingToLawyer: boolean): IncomeExpenseD5103Data => {
    let baseD5103 = initialD5103 ? { ...initialD5103 } : ({} as IncomeExpenseD5103Data);

    if (selectedIncomeType === 'BUSINESS') {
      baseD5103 = syncBusinessLedgerToD5103(baseD5103, generatedLedger);
    } else if (selectedIncomeType === 'FREELANCER') {
      const flLedger: FreelancerMonthlyLedger = {
        jobTypeDetail: flJobType,
        monthlyGrossIncome: flGross,
        expenses: flExpenses,
        totalMonthlyExpenses: flTotalExpenses,
        netMonthlyIncome: flNetIncome,
        annualGrossRevenue: flGross * 12,
        evidenceDocuments: [
          '사업소득 원천징수영수증 (3.3%)',
          '최근 1년분 입금 거래내역서',
          '용역/위촉 계약서'
        ]
      };
      baseD5103 = syncFreelancerLedgerToD5103(baseD5103, flLedger);
    } else if (selectedIncomeType === 'DAY_LABORER') {
      const dlLedger: DayLaborerLedger = {
        workDaysPerMonth: dlWorkDays,
        dailyWage: dlDailyWage,
        monthlyGrossIncome: dlMonthlyIncome,
        isDirectCash: dlIsCash,
        evidenceDocuments: [
          '일용근로소득지급명세서',
          '고용산재보험 토탈서비스 일용근로내역서',
          '급여입금통장 거래내역서'
        ]
      };
      baseD5103 = syncDayLaborerLedgerToD5103(baseD5103, dlLedger);
    } else if (selectedIncomeType === 'PART_TIME') {
      const ptLedger: PartTimeLedger = {
        workplaces: ptWorkplaces,
        totalMonthlyGrossIncome: ptTotalIncome,
        evidenceDocuments: [
          '근로계약서 사본',
          '급여입금통장 거래내역서',
          '아르바이트 급여명세서'
        ]
      };
      baseD5103 = syncPartTimeToD5103(baseD5103, ptLedger);
    }

    if (isSubmittingToLawyer) {
      baseD5103.d5103ClientStatus = 'client_submitted';
      baseD5103.d5103ClientSubmittedAt = new Date().toISOString();
    } else {
      // 임시저장이 이미 제출된 상태를 되돌리지 않도록 기존 상태 유지
      baseD5103.d5103ClientStatus = baseD5103.d5103ClientStatus || 'not_started';
    }
    baseD5103.lastSavedAt = new Date().toISOString();
    return baseD5103;
  };

  const persistD5103 = async (data: IncomeExpenseD5103Data) => {
    if (onSaveD5103) {
      await onSaveD5103(data);
    } else {
      // 연동 대상이 없으면 이 기기에만 저장한다
      secureSetItem(`legal_crm_d5103_${clientId}`, JSON.stringify(data));
    }
  };

  // 저장 상태: 이 기기 저장은 입력이 멈추면 자동 저장, 사건 기록(서버) 저장은 임시 저장 버튼·닫을 때 저장
  const { saveState, isDirty, saveNow, markSaved } = useDocAutosave({
    snapshot: formSnapshot,
    ready: restoreTick > 0,
    save: () => persistD5103(buildD5103(false)),
    auto: !savesToCrm,
    initialSavedAt: initialD5103?.lastSavedAt || null,
  });

  if (!isOpen) return null;

  // 닫기(X·ESC·배경): 바뀐 내용을 먼저 저장하고, 저장에 실패하면 닫을지 묻는다
  const handleBeforeClose = async (): Promise<boolean> => {
    if (isSubmitting) return false;
    if (isListening) toggleListening();
    if (!isDirty) return true;
    const ok = await saveNow();
    if (ok) {
      if (savesToCrm) toast.success('작성 중인 수지표를 저장했어요.');
      return true;
    }
    return dialog.confirm({
      title: '수지표를 저장하지 못했어요',
      message: '네트워크 상태를 확인해 주세요. 지금 닫으면 이번에 입력한 내용이 사라집니다.',
      confirmText: '저장하지 않고 닫기',
      cancelText: '계속 작성',
      variant: 'danger',
    });
  };

  // 동적 경비 항목 추가
  const handleAddDynamicExpense = () => {
    const newId = `exp_${Date.now()}`;
    setDynamicExpenses(prev => [
      ...prev,
      { id: newId, name: '', monthlyAmount: 0, rollupTarget: 'operating' }
    ]);
  };

  // 추천 항목 추가(이름만, 금액은 직접 입력)
  const handleAddPresetExpense = (preset: typeof POPULAR_EXPENSE_PRESETS[0]) => {
    if (dynamicExpenses.some(e => e.name === preset.name)) return;
    const newId = `exp_${Date.now()}`;
    setDynamicExpenses(prev => [
      ...prev,
      // 항목 이름만 추가하고 금액은 비워 둔다(이전: 식자재 150만·인건비 120만 등 근거 없는 금액을 자동 입력 → 순소득이 실제와 달라짐)
      { id: newId, name: preset.name, monthlyAmount: 0, rollupTarget: preset.target }
    ]);
    toast.success(`'${preset.name}' 항목을 추가했어요. 실제 월 금액을 입력해 주세요.`);
  };

  // 동적 경비 항목 삭제
  const handleRemoveDynamicExpense = (id: string) => {
    setDynamicExpenses(prev => prev.filter(e => e.id !== id));
  };

  // 시트 모드에서 셀 값 변경
  const handleCellChange = (rowIndex: number, field: keyof MonthlyLedgerItem, value: number) => {
    setManualMonths(prev => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        [field]: Math.max(0, value)
      };
      return next;
    });
  };

  const updateWorkplace = (id: string, patch: Partial<PartTimeWorkplace>) => {
    setPtWorkplaces(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  // 임시 저장(사건 기록에 저장)
  const handleSaveDraft = async () => {
    if (!isDirty) {
      toast.info('바뀐 내용이 없어요. 이미 저장된 상태입니다.');
      return;
    }
    const ok = await saveNow();
    if (ok) toast.success(savesToCrm ? '수지표를 임시 저장했어요.' : '수지표를 이 기기에 임시 저장했어요.');
    else toast.error('수지표를 저장하지 못했어요. 입력한 내용은 화면에 그대로 있으니 잠시 후 다시 시도해 주세요.');
  };

  // 제출 전 요약(선택한 소득 형태 기준)
  const typeInfo = INCOME_TYPES.find(t => t.id === selectedIncomeType);
  const summary = (() => {
    if (selectedIncomeType === 'BUSINESS') {
      const avg = generatedLedger.monthlyAverages;
      return {
        income: avg.avgGrossRevenue,
        lines: [
          `월평균 매출 ${won(avg.avgGrossRevenue)}원`,
          `월평균 경비 ${won(avg.avgOperatingExpense)}원`,
          `월평균 순소득 ${won(avg.avgNetIncome)}원`
        ]
      };
    }
    if (selectedIncomeType === 'FREELANCER') {
      return {
        income: flGross,
        lines: [`월평균 총수입 ${won(flGross)}원`, `필요경비 ${won(flTotalExpenses)}원`, `월평균 순소득 ${won(flNetIncome)}원`]
      };
    }
    if (selectedIncomeType === 'DAY_LABORER') {
      return { income: dlMonthlyIncome, lines: [`한 달 ${dlWorkDays}일 × 일당 ${won(dlDailyWage)}원`, `월평균 수입 ${won(dlMonthlyIncome)}원`] };
    }
    return { income: ptTotalIncome, lines: [`근무지 ${ptWorkplaces.length}곳`, `합산 월소득 ${won(ptTotalIncome)}원`] };
  })();

  // 작성 완료 · 제출
  const handleSubmit = async () => {
    if (isSubmitting) return;
    const ok = await dialog.confirm(
      buildSubmitConfirm({
        title: savesToCrm ? '수지표를 변호사에게 제출할까요?' : '수지표 작성을 마칠까요?',
        lines: [`소득 형태: ${typeInfo ? typeInfo.desc : '선택 안 함'}`, ...summary.lines],
        note: [
          summary.income <= 0 ? '월 수입이 0원으로 적혀 있어요. 맞는지 한 번 더 확인해 주세요.' : '',
          savesToCrm
            ? '제출하면 담당 변호사가 법원 서식에 맞는지 확인합니다.'
            : '작성 내용은 이 기기에 저장돼요. 변호사에게 보내려면 서류 전달 화면에서 공유해 주세요.'
        ].filter(Boolean).join('\n'),
        confirmText: savesToCrm ? '제출하기' : '작성 완료',
      })
    );
    if (!ok) return;

    setIsSubmitting(true);
    try {
      if (isListening) toggleListening();
      const data = buildD5103(true);
      await persistD5103(data);
      markSaved(data.lastSavedAt);
      toast.success(
        savesToCrm
          ? '수지표를 담당 변호사에게 제출했습니다. 변호사가 법원 서식에 맞는지 확인합니다.'
          : '수지표 작성을 마치고 이 기기에 저장했습니다. 담당 변호사에게 보내려면 서류 전달 화면에서 공유해 주세요.'
      );
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('수지표를 저장하지 못했습니다. 입력한 내용은 화면에 그대로 있으니 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMicClick = () => {
    if (!isSpeechSupported) {
      toast.error('이 브라우저는 음성 입력을 지원하지 않습니다. 금액을 직접 입력해 주세요.');
      return;
    }
    if (isListening) {
      // 듣는 중 클릭 = 인식 종료 (패널은 유지해 결과 확인)
      toggleListening();
      return;
    }
    setIsVoicePanelOpen(true);
    toggleListening();
  };

  const moneyField = (label: string, value: number, set: (v: number) => void, hint?: string) => (
    <FormField label={label} hint={hint}>
      {(p) => <MoneyInput {...p} value={value || null} onChange={(v) => set(v ?? 0)} />}
    </FormField>
  );

  return (
    <DocModal
      open={isOpen}
      onClose={onClose}
      onBeforeClose={handleBeforeClose}
      closeLabel="수지표 닫기"
      icon={<Calculator className="w-5 h-5" />}
      title="수입·지출 내역서(수지표) 작성"
      description="평소 한 달 수입과 지출을 적으면 법원 제출용 12개월 표로 정리돼요. 담당 변호사가 확인한 뒤 확정합니다."
      badges={wasSubmitted ? <Badge tone="success">{savesToCrm ? '변호사에게 제출함' : '작성 완료'}</Badge> : null}
      saveState={saveState}
      saveTarget={savesToCrm ? 'server' : 'device'}
      dirtyLabel={savesToCrm ? '저장 전 변경이 있어요 · 닫으면 자동 저장돼요' : '입력 중 · 잠시 뒤 자동 저장돼요'}
      idleLabel={savesToCrm ? '닫으면 자동 저장돼요' : '입력하면 이 기기에 자동 저장돼요'}
      subHeader={
        <div className="px-4 sm:px-6 py-3 bg-white">
          <SegmentedTabs<DetailedIncomeType>
            tabs={INCOME_TYPES.map(t => ({ id: t.id, label: t.label }))}
            value={selectedIncomeType}
            onChange={setSelectedIncomeType}
            ariaLabel="주된 소득 형태"
            idPrefix="ie"
          />
        </div>
      }
      footer={
        <>
          <div className="flex items-center gap-2">
            {savesToCrm && (
              <Button
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={isSubmitting || saveState.status === 'saving'}
                leftIcon={<Save className="w-4 h-4" aria-hidden="true" />}
              >
                임시 저장
              </Button>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            leftIcon={<Send className="w-4 h-4" aria-hidden="true" />}
            className="flex-1 sm:flex-none"
          >
            {savesToCrm ? '변호사에게 제출' : '작성 완료'}
          </Button>
        </>
      }
    >
      <div
        role="tabpanel"
        id={`ie-panel-${selectedIncomeType}`}
        aria-labelledby={`ie-tab-${selectedIncomeType}`}
        className="space-y-5"
      >
        <p className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed break-keep">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <span>
            <b className="text-slate-900">{typeInfo ? typeInfo.desc : '선택한 소득 형태'}</b> 기준으로 적어 주세요. 금액은 원 단위예요.
          </span>
        </p>

        {/* 말로 입력하기(음성) — 모바일에서도 한 줄로(입력 칸이 첫 화면에 보이게) */}
        <section aria-labelledby="ie-voice-title" className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center sm:items-start gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                <Mic className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 id="ie-voice-title" className="text-sm font-bold text-slate-900">말로 입력하기</h3>
                <p className="hidden sm:block mt-0.5 text-xs text-slate-600 leading-relaxed break-keep">
                  "카드 매출 400, 현금 100, 월세 90, 배달대행 60"처럼 말하면 금액을 찾아 드려요. 반영하기 전에 금액을 꼭 확인해 주세요.
                </p>
              </div>
            </div>
            <Button
              variant={isListening ? 'danger' : 'secondary'}
              onClick={handleMicClick}
              aria-pressed={isListening}
              leftIcon={isListening ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
              className="shrink-0"
            >
              {isListening ? '끝내기' : '마이크 켜기'}
            </Button>
          </div>

          {isVoicePanelOpen && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                  들은 내용
                </span>
                {isListening && (
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                    듣는 중
                  </span>
                )}
              </div>
              <p className="min-h-11 rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 leading-relaxed break-keep">
                {voiceTranscriptText || (
                  <span className="text-slate-500">
                    지금 말씀해 주세요. 예: "카드 매출 400, 현금 100, 월세 90, 배달대행 60" — 반영하기 전에 금액을 꼭 확인해 주세요.
                  </span>
                )}
              </p>

              {voiceParsedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">찾은 금액 {voiceParsedItems.length}건</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {voiceParsedItems.map((item, idx) => (
                      <li key={idx} className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800">
                        {item.label} <span className="text-brand tabular-nums">{won(item.amount)}원</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setVoiceParsedItems([]);
                        setVoiceTranscriptText('');
                      }}
                    >
                      다시 말하기
                    </Button>
                    <Button onClick={applyVoiceItemsToForm} leftIcon={<Sparkles className="w-4 h-4" aria-hidden="true" />}>
                      수지표에 반영
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ════════════ 1. 개인사업자 ════════════ */}
        {selectedIncomeType === 'BUSINESS' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white pl-4 pr-2 py-2">
              <p className="text-sm font-bold text-slate-800 break-keep">
                {viewMode === 'wizard' ? '질문에 답하며 입력 중' : '12개월 표에서 입력 중'}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  if (viewMode === 'wizard') {
                    setManualMonths(generatedLedger.months);
                    setViewMode('sheet');
                  } else {
                    setViewMode('wizard');
                  }
                }}
                leftIcon={viewMode === 'wizard' ? <Table2 className="w-4 h-4" aria-hidden="true" /> : <ListChecks className="w-4 h-4" aria-hidden="true" />}
                className="shrink-0"
              >
                {viewMode === 'wizard' ? '12개월 표로 보기' : '질문 방식으로'}
              </Button>
            </div>

            {viewMode === 'wizard' ? (
              <>
                <section aria-labelledby="ie-biz-income" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                  <StepTitle id="ie-biz-income" num={1} title="월평균 매출(수입)" hint="통장·카드 단말기 기준 평균" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {moneyField('월평균 카드 매출', bizCard, setBizCard)}
                    {moneyField('월평균 현금·계좌이체 매출', bizCash, setBizCash)}
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <span className="text-sm font-bold text-emerald-900">월 매출 합계</span>
                    <span className="text-base font-extrabold text-emerald-900 tabular-nums">{won(bizCard + bizCash)}원</span>
                  </div>
                </section>

                <section aria-labelledby="ie-biz-fixed" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                  <StepTitle id="ie-biz-fixed" num={2} title="사업장 월세와 공과금" hint="사업장에서 매달 나가는 돈" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {moneyField('사업장 월세(임대료)', bizRent, setBizRent)}
                    {moneyField('전기요금(월평균)', bizElectricity, setBizElectricity)}
                    {moneyField('가스·수도·등유 요금', bizUtility, setBizUtility)}
                  </div>
                  {moneyField('기본 운영비(재료 구입·상품 매입 등)', bizBaseOperating, setBizBaseOperating)}
                </section>

                <section aria-labelledby="ie-biz-extra" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                  <StepTitle id="ie-biz-extra" num={3} title="그 밖의 경비" hint="실제로 쓴 경비만 적고 영수증·이체 내역을 보관해 주세요" />
                  <div>
                    <p className="mb-2 text-sm text-slate-700">자주 쓰는 항목을 누르면 목록에 추가돼요.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_EXPENSE_PRESETS.map((preset) => {
                        const added = dynamicExpenses.some(e => e.name === preset.name);
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => handleAddPresetExpense(preset)}
                            disabled={added}
                            className={cn(
                              'inline-flex items-center gap-1 min-h-11 px-3 rounded-xl border text-sm font-medium transition-colors',
                              added
                                ? 'border-brand/20 bg-brand-light text-brand cursor-default'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand'
                            )}
                          >
                            {added ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                            {preset.name}
                            {added && <span className="sr-only">(추가됨)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {dynamicExpenses.length > 0 && (
                    <ul className="space-y-2">
                      {dynamicExpenses.map((exp) => (
                        <ExpenseRow
                          key={exp.id}
                          name={exp.name}
                          amount={exp.monthlyAmount}
                          onName={(val) => setDynamicExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, name: val } : item))}
                          onAmount={(val) => setDynamicExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, monthlyAmount: val } : item))}
                          onRemove={() => handleRemoveDynamicExpense(exp.id)}
                        />
                      ))}
                    </ul>
                  )}

                  <Button variant="secondary" fullWidth onClick={handleAddDynamicExpense} leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />} className="border-dashed">
                    경비 항목 직접 추가
                  </Button>
                </section>
              </>
            ) : (
              /* 12개월 표 직접 편집 */
              <section aria-labelledby="ie-sheet-title" className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div>
                  <h3 id="ie-sheet-title" className="text-base font-bold text-slate-900">12개월 수입·지출 표</h3>
                  <p className="text-sm text-slate-600">법원 제출용 12개월 표입니다. 달마다 금액이 다르면 칸을 직접 고쳐 주세요.</p>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl" role="region" aria-label="12개월 수입·지출 표" tabIndex={0}>
                  <table className="w-full text-xs text-left text-slate-700 border-collapse min-w-[700px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th scope="col" className="p-2 border-r border-slate-200 text-center">날짜</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right">카드(원)</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right">현금(원)</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right bg-emerald-50 text-emerald-900">수입 소계</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right">운영비(원)</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right">월세(원)</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right">공과금(원)</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right">전기료(원)</th>
                        <th scope="col" className="p-2 border-r border-slate-200 text-right bg-red-50 text-red-900">지출 소계</th>
                        <th scope="col" className="p-2 text-right bg-blue-50 text-blue-900 font-bold">월 순수익</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {manualMonths.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <th scope="row" className="p-2 border-r border-slate-200 text-center font-medium">{row.month}</th>
                          {([
                            ['incomeCard', '카드 매출'],
                            ['incomeCash', '현금 매출'],
                          ] as [keyof MonthlyLedgerItem, string][]).map(([field, label]) => (
                            <td key={field} className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={(row[field] as number) || 0}
                                onChange={e => handleCellChange(idx, field, Number(e.target.value) || 0)}
                                aria-label={`${row.month} ${label}`}
                                className="w-full min-h-9 p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-brand rounded tabular-nums"
                              />
                            </td>
                          ))}
                          <td className="p-2 border-r border-slate-200 text-right font-semibold bg-emerald-50/40 tabular-nums">
                            {won((row.incomeCard || 0) + (row.incomeCash || 0))}
                          </td>
                          {([
                            ['expenseOperating', '운영비'],
                            ['expenseRent', '월세'],
                            ['expenseUtility', '공과금'],
                            ['expenseElectricity', '전기료'],
                          ] as [keyof MonthlyLedgerItem, string][]).map(([field, label]) => (
                            <td key={field} className="p-1 border-r border-slate-200">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={(row[field] as number) || 0}
                                onChange={e => handleCellChange(idx, field, Number(e.target.value) || 0)}
                                aria-label={`${row.month} ${label}`}
                                className="w-full min-h-9 p-1 text-right border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-brand rounded tabular-nums"
                              />
                            </td>
                          ))}
                          <td className="p-2 border-r border-slate-200 text-right font-semibold bg-red-50/40 tabular-nums">
                            {won((row.expenseOperating || 0) + (row.expenseRent || 0) + (row.expenseUtility || 0) + (row.expenseElectricity || 0))}
                          </td>
                          <td className="p-2 text-right font-bold text-blue-700 bg-blue-50/40 tabular-nums">
                            {won(
                              ((row.incomeCard || 0) + (row.incomeCash || 0)) -
                              ((row.expenseOperating || 0) + (row.expenseRent || 0) + (row.expenseUtility || 0) + (row.expenseElectricity || 0))
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <ResultCard
              label="월평균 순소득"
              value={generatedLedger.monthlyAverages.avgNetIncome}
              detail={`연 매출 ${won(generatedLedger.annualTotals.totalGrossRevenue)}원 − 연 경비 ${won(generatedLedger.annualTotals.totalOperatingExpense)}원 = 연 순이익 ${won(generatedLedger.annualTotals.totalNetProfit)}원`}
            />
          </div>
        )}

        {/* ════════════ 2. 프리랜서 (3.3%) ════════════ */}
        {selectedIncomeType === 'FREELANCER' && (
          <div className="space-y-5">
            <section aria-labelledby="ie-fl-income" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <StepTitle id="ie-fl-income" num={1} title="직종과 월 총수입" hint="3.3% 원천징수 사업소득" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="세부 직종(용역 분야)" optional>
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      value={flJobType}
                      onChange={e => setFlJobType(e.target.value)}
                      placeholder="예: 배달 라이더, 학습지 교사, IT 개발자"
                      className={inputClass}
                    />
                  )}
                </FormField>
                {moneyField('월평균 총수입(원천징수 전)', flGross, setFlGross)}
              </div>
            </section>

            <section aria-labelledby="ie-fl-exp" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <StepTitle id="ie-fl-exp" num={2} title="일하는 데 드는 경비" hint={`경비 합계 ${won(flTotalExpenses)}원`} />
              <p className="text-sm text-slate-700">유류비·통신비·프로그램 사용료처럼 실제로 쓰는 경비만 적어 주세요.</p>
              {flExpenses.length > 0 && (
                <ul className="space-y-2">
                  {flExpenses.map((exp) => (
                    <ExpenseRow
                      key={exp.id}
                      name={exp.name}
                      amount={exp.monthlyAmount}
                      onName={(val) => setFlExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, name: val } : item))}
                      onAmount={(val) => setFlExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, monthlyAmount: val } : item))}
                      onRemove={() => setFlExpenses(prev => prev.filter(item => item.id !== exp.id))}
                    />
                  ))}
                </ul>
              )}
              <Button
                variant="secondary"
                fullWidth
                className="border-dashed"
                leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                onClick={() => {
                  const newId = `fle_${Date.now()}`;
                  // 금액은 비워 둔다(이전: 5만 원을 미리 채워 넣음)
                  setFlExpenses(prev => [...prev, { id: newId, name: '', monthlyAmount: 0, category: 'other' }]);
                }}
              >
                경비 항목 추가
              </Button>
            </section>

            <ResultCard
              label="월평균 순소득"
              value={flNetIncome}
              detail={`총수입 − 원천징수 3.3%(${won(flWithholding)}원) − 경비 ${won(flTotalExpenses)}원`}
              evidence="원천징수영수증, 입금 통장 내역"
            />
          </div>
        )}

        {/* ════════════ 3. 일용직 ════════════ */}
        {selectedIncomeType === 'DAY_LABORER' && (
          <div className="space-y-5">
            <section aria-labelledby="ie-dl" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <StepTitle id="ie-dl" title="근무 일수와 일당" hint="최근 몇 달의 평균" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="한 달 평균 출근 일수">
                  {(p) => (
                    <div className="relative">
                      <input
                        {...p}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={31}
                        value={dlWorkDays || ''}
                        onChange={e => setDlWorkDays(Math.min(31, Math.max(0, Number(e.target.value) || 0)))}
                        placeholder="0"
                        className={cn(inputClass, 'pr-10 text-right tabular-nums font-bold')}
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none" aria-hidden="true">일</span>
                    </div>
                  )}
                </FormField>
                {moneyField('하루 평균 일당(실제로 받는 돈)', dlDailyWage, setDlDailyWage)}
              </div>
              <label className="flex items-center gap-3 min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dlIsCash}
                  onChange={e => setDlIsCash(e.target.checked)}
                  className="w-5 h-5 shrink-0 accent-brand"
                />
                <span className="text-sm text-slate-800">통장 입금이 아니라 현금으로 받는 날도 있어요</span>
              </label>
            </section>

            <ResultCard
              label="월평균 수입"
              value={dlMonthlyIncome}
              detail={`${dlWorkDays}일 × ${won(dlDailyWage)}원`}
              evidence="일용근로소득 지급명세서, 고용·산재보험 일용근로내역서"
            />
          </div>
        )}

        {/* ════════════ 4. 아르바이트 (시간제) ════════════ */}
        {selectedIncomeType === 'PART_TIME' && (
          <div className="space-y-5">
            <section aria-labelledby="ie-pt" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <StepTitle id="ie-pt" title="근무지별 시급과 월급" hint="두 곳 이상이면 근무지를 추가해 주세요" />
              <ul className="space-y-3">
                {ptWorkplaces.map((wp, idx) => (
                  <li key={wp.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                    <div className="flex items-end gap-2">
                      <FormField label={`근무지 ${idx + 1}`} className="flex-1 min-w-0">
                        {(p) => (
                          <input
                            {...p}
                            type="text"
                            value={wp.workplaceName}
                            onChange={e => updateWorkplace(wp.id, { workplaceName: e.target.value })}
                            placeholder="예: 카페, 편의점"
                            className={inputClass}
                          />
                        )}
                      </FormField>
                      {ptWorkplaces.length > 1 && (
                        <Button
                          variant="ghost"
                          onClick={() => setPtWorkplaces(prev => prev.filter(item => item.id !== wp.id))}
                          aria-label={`근무지 ${idx + 1} 삭제`}
                          leftIcon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
                        >
                          삭제
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField label="시급">
                        {(p) => <MoneyInput {...p} value={wp.hourlyWage || null} onChange={(v) => updateWorkplace(wp.id, { hourlyWage: v ?? 0 })} showKoreanHint={false} />}
                      </FormField>
                      <FormField label="주당 근무 시간">
                        {(p) => (
                          <div className="relative">
                            <input
                              {...p}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={168}
                              value={wp.weeklyHours || ''}
                              onChange={e => updateWorkplace(wp.id, { weeklyHours: Math.min(168, Math.max(0, Number(e.target.value) || 0)) })}
                              placeholder="0"
                              className={cn(inputClass, 'pr-14 text-right tabular-nums font-bold')}
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none" aria-hidden="true">시간</span>
                          </div>
                        )}
                      </FormField>
                      <FormField label="월 실수령 급여">
                        {(p) => <MoneyInput {...p} value={wp.monthlyGrossIncome || null} onChange={(v) => updateWorkplace(wp.id, { monthlyGrossIncome: v ?? 0 })} />}
                      </FormField>
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                fullWidth
                className="border-dashed"
                leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                onClick={() => {
                  const newId = `ptw_${Date.now()}`;
                  setPtWorkplaces(prev => [
                    ...prev,
                    { id: newId, workplaceName: '', hourlyWage: MIN_WAGE_2026, weeklyHours: 0, hasWeeklyHolidayPay: false, monthlyGrossIncome: 0 }
                  ]);
                }}
              >
                근무지 추가
              </Button>
            </section>

            <ResultCard label="합산 월소득" value={ptTotalIncome} evidence="근로계약서, 급여 입금 통장 사본" />
          </div>
        )}
      </div>
    </DocModal>
  );
}
