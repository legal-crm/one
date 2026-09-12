import type { SalesLead, LeadStatus, CallLog, ReminderItem, CustomerBriefingData } from '../types/leadTypes';
import type { ConsultRequest, CrmClientExtension, CaseType } from '../types';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';
import { createDefaultCrmExtension, saveCrmClient } from './crmService';
import { createTask } from './taskTicketService';

const SALES_LEADS_STORAGE_KEY = 'legal_sales_leads';

// 초기 Mock 리드 데이터 (신규 사용자 체험용)
const INITIAL_MOCK_LEADS: SalesLead[] = [
  {
    id: 'lead-1001',
    customerName: '김태진',
    phone: '010-8874-1290',
    status: 'callback',
    secondaryStatus: '재통화예약',
    birth: '1984',
    gender: '남',
    region: '서울 관악구',
    inboundPath: '타사DB구매',
    batchName: '2026-09 금융사동의DB 500건',
    caseType: '개인회생',
    jobTypes: ['급여소득'],
    insurance4: '가입',
    maritalStatus: '기혼',
    childrenCount: 1,
    incomeNet: 310,
    loanMonthlyPay: 180,
    housingType: '월세',
    housingDetail: '빌라',
    deposit: 3000,
    rent: 65,
    assets: [],
    debtTotal: 8700,
    creditCardUse: '사용',
    collateralLoanDesc: '신용대출 위주 (카드론 4건)',
    historyDetail: '과거 회생/파산 이력 없음',
    specialMemo: '월 불입금 과다로 카드 돌려막기 한계 직전. 오후 2시 재통화 희망.',
    callCount: 2,
    lastCallAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    reminders: [
      {
        id: 'rem-1001',
        datetime: new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 16).replace('T', ' '),
        type: '통화',
        content: '오후 2시 급여명세서 확인 후 변제금 간이 산출 결과 브리핑',
        isCompleted: false,
      }
    ],
    callLogs: [
      {
        id: 'clog-1',
        leadId: 'lead-1001',
        calledAt: new Date(Date.now() - 24 * 3600000).toISOString(),
        callerId: 'staff-1',
        callerName: '김상담 실장',
        result: 'no_answer',
        memo: '1차 통화 부재중',
      },
      {
        id: 'clog-2',
        leadId: 'lead-1001',
        calledAt: new Date(Date.now() - 3 * 3600000).toISOString(),
        callerId: 'staff-1',
        callerName: '김상담 실장',
        result: 'connected',
        durationSeconds: 240,
        memo: '통화 연결. 8,700만원 채무 확인, 직장 4대보험 정상. 오후 2시 상세 상담 약속.',
        callbackScheduledAt: new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 16).replace('T', ' '),
      }
    ],
    assigneeId: 'staff-1',
    assigneeName: '김상담 실장',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: 'lead-1002',
    customerName: '이수민',
    phone: '010-4421-9981',
    status: 'new',
    birth: '1991',
    gender: '여',
    region: '경기 수원시',
    inboundPath: '네이버광고',
    batchName: '네이버 파워링크 인바운드',
    caseType: '개인회생',
    jobTypes: ['급여소득'],
    insurance4: '가입',
    maritalStatus: '미혼',
    incomeNet: 240,
    loanMonthlyPay: 120,
    housingType: '전세',
    deposit: 8000,
    rent: 0,
    assets: [],
    debtTotal: 4600,
    creditCardUse: '사용',
    specialMemo: '코인 및 생활비 대출로 채무 증가. 빠른 접수 원함.',
    callCount: 0,
    reminders: [],
    callLogs: [],
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: 'lead-1003',
    customerName: '박준형',
    phone: '010-9182-3741',
    status: 'no_answer_1',
    secondaryStatus: '부재1차',
    birth: '1979',
    gender: '남',
    region: '인천 부평구',
    inboundPath: '타사DB구매',
    batchName: '2026-09 금융사동의DB 500건',
    caseType: '개인파산',
    jobTypes: ['무직'],
    insurance4: '미가입',
    maritalStatus: '이혼',
    incomeNet: 0,
    loanMonthlyPay: 0,
    housingType: '무상거주',
    deposit: 0,
    rent: 0,
    assets: [],
    debtTotal: 12000,
    creditCardUse: '미사용',
    historyDetail: '건강 악화로 근로 불가, 과거 신복위 실효',
    specialMemo: '신체 질환으로 소득 없음. 파산 및 면책 상담 필요.',
    callCount: 1,
    lastCallAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    reminders: [],
    callLogs: [
      {
        id: 'clog-3',
        leadId: 'lead-1003',
        calledAt: new Date(Date.now() - 6 * 3600000).toISOString(),
        callerId: 'staff-1',
        callerName: '김상담 실장',
        result: 'no_answer',
        memo: '통화 연결 안 됨. 신호음 가다 끊김.',
      }
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  }
];

export function loadSalesLeads(): SalesLead[] {
  try {
    const raw = secureGetItem(SALES_LEADS_STORAGE_KEY) || localStorage.getItem(SALES_LEADS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('[leadService] loadSalesLeads failed', e);
  }
  // 초기 데이터 적재
  saveSalesLeads(INITIAL_MOCK_LEADS);
  return INITIAL_MOCK_LEADS;
}

export function saveSalesLeads(leads: SalesLead[]): void {
  try {
    const serialized = JSON.stringify(leads);
    secureSetItem(SALES_LEADS_STORAGE_KEY, serialized);
    localStorage.setItem(SALES_LEADS_STORAGE_KEY, serialized);
  } catch (e) {
    console.warn('[leadService] saveSalesLeads failed', e);
  }
}

export function saveSalesLead(lead: SalesLead): void {
  const list = loadSalesLeads();
  const idx = list.findIndex(l => l.id === lead.id);
  if (idx >= 0) {
    list[idx] = { ...lead, updatedAt: new Date().toISOString() };
  } else {
    list.unshift({ ...lead, updatedAt: new Date().toISOString() });
  }
  saveSalesLeads(list);
}

export function deleteSalesLead(leadId: string): void {
  const list = loadSalesLeads();
  saveSalesLeads(list.filter(l => l.id !== leadId));
}

export function bulkInsertLeads(newLeads: SalesLead[]): number {
  const current = loadSalesLeads();
  const merged = [...newLeads, ...current];
  saveSalesLeads(merged);
  return newLeads.length;
}

// ── 통화 디스포지션 기록 ──

export function logLeadCall(
  leadId: string,
  caller: { id: string; name: string },
  result: CallLog['result'],
  memo?: string,
  callbackScheduledAt?: string
): SalesLead | null {
  const list = loadSalesLeads();
  const lead = list.find(l => l.id === leadId);
  if (!lead) return null;

  const nowIso = new Date().toISOString();
  lead.callCount = (lead.callCount || 0) + 1;
  lead.lastCallAt = nowIso;
  lead.updatedAt = nowIso;

  // 상태 자동 전이
  if (result === 'no_answer') {
    if (lead.status === 'new') lead.status = 'no_answer_1';
    else if (lead.status === 'no_answer_1') lead.status = 'no_answer_2';
    else lead.status = 'no_answer_3';
  } else if (result === 'callback') {
    lead.status = 'callback';
    if (callbackScheduledAt) {
      lead.reminders = lead.reminders || [];
      const newRem: ReminderItem = {
        id: `rem-${Date.now()}`,
        datetime: callbackScheduledAt,
        type: '통화',
        content: memo || '재통화 약속',
        isCompleted: false,
        createdAt: nowIso,
      };
      lead.reminders.push(newRem);

      // '내 할일'에 영업 티켓 자동 생성
      try {
        createTask({
          tenantId: 'default',
          targetType: 'sales_lead',
          targetId: lead.id,
          assignerId: caller.id,
          assignerName: caller.name,
          assigneeId: lead.assigneeId || caller.id,
          assigneeName: lead.assigneeName || caller.name,
          title: `[콜백] ${lead.customerName} 재통화 예약`,
          description: memo || '고객 요청 재통화 일정',
          priority: 'HIGH',
          status: 'PENDING',
          dueDate: callbackScheduledAt,
          taskDomain: 'sales',
          leadId: lead.id,
          leadPhone: lead.phone,
          leadDebt: lead.debtTotal,
        });
      } catch (err) {
        console.warn('Auto task creation for lead failed', err);
      }
    }
  } else if (result === 'connected') {
    lead.status = 'in_progress';
  } else if (result === 'rejected') {
    lead.status = 'rejected';
  } else if (result === 'wrong_number') {
    lead.status = 'wrong_number';
  }

  const logItem: CallLog = {
    id: `clog-${Date.now()}`,
    leadId: lead.id,
    calledAt: nowIso,
    callerId: caller.id,
    callerName: caller.name,
    result,
    memo,
    callbackScheduledAt,
  };
  lead.callLogs = lead.callLogs || [];
  lead.callLogs.unshift(logItem);

  saveSalesLead(lead);
  return lead;
}

// ── 리마인더 관리 ──

export function addLeadReminder(
  leadId: string,
  reminder: Omit<ReminderItem, 'id' | 'createdAt'>
): SalesLead | null {
  const list = loadSalesLeads();
  const lead = list.find(l => l.id === leadId);
  if (!lead) return null;

  const nowIso = new Date().toISOString();
  const item: ReminderItem = {
    ...reminder,
    id: `rem-${Date.now()}`,
    isCompleted: false,
    createdAt: nowIso,
  };
  lead.reminders = lead.reminders || [];
  lead.reminders.push(item);
  lead.updatedAt = nowIso;
  saveSalesLead(lead);
  return lead;
}

export function updateLeadReminderStatus(
  leadId: string,
  reminderId: string,
  resultStatus: ReminderItem['resultStatus'],
  resultNote?: string
): SalesLead | null {
  const list = loadSalesLeads();
  const lead = list.find(l => l.id === leadId);
  if (!lead || !lead.reminders) return null;

  const rem = lead.reminders.find(r => r.id === reminderId);
  if (rem) {
    rem.resultStatus = resultStatus;
    rem.resultNote = resultNote;
    rem.isCompleted = resultStatus === '완료' || resultStatus === '취소';
    lead.updatedAt = new Date().toISOString();
    saveSalesLead(lead);
  }
  return lead;
}

// ── ⭐️ 핵심: 영업 리드 → 정식 고객(CRM) 승격 및 이전 ──

export interface ConvertOptions {
  assignedLawyerId?: string;
  assignedStaffId?: string;
  caseType?: CaseType;
  consultMemo?: string;
}

export function convertLeadToClient(
  lead: SalesLead,
  operator: { id: string; name: string },
  options?: ConvertOptions
): { newRequest: ConsultRequest; newExt: CrmClientExtension; updatedLead: SalesLead } {
  const newReqId = `req-conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  // 1. ConsultRequest 생성
  const newRequest: ConsultRequest = {
    id: newReqId,
    clientId: newReqId,
    clientName: lead.customerName,
    phone: lead.phone,
    requestType: 'direct',
    maxParticipants: 1,
    status: 'counseling',
    createdAt: nowIso,
    title: `[이전] ${lead.customerName} 회생·파산 상담`,
    content: options?.consultMemo || lead.specialMemo || '영업 리드에서 상담 성공 후 정식 고객으로 승격된 건입니다.',
    financialProfile: {
      clientName: lead.customerName,
      age: lead.birth ? (new Date().getFullYear() - parseInt(lead.birth, 10)) : 0,
      gender: lead.gender === '여' ? 'female' : 'male',
      maritalStatus: (lead.maritalStatus === '기혼' ? 'MARRIED' : lead.maritalStatus === '이혼' ? 'DIVORCED' : 'SINGLE') as any,
      dependents: lead.childrenCount || 0,
      minorChildren: lead.childrenCount || 0,
      income: lead.incomeNet || 0,
      debtTotal: lead.debtTotal || 0,
      priorityDebt: 0,
      assetsTotal: (lead.assets || []).reduce((sum, a) => sum + (a.amount || 0), 0),
      creditorCount: 0,
      jobType: (lead.jobTypes?.[0] === '영업소득' ? 'BUSINESS' : lead.jobTypes?.[0] === '무직' ? 'UNEMPLOYED' : 'SALARIED') as any,
      companyName: '',
      companyNameMasked: '',
      employmentDate: '',
      residenceRegion: lead.region || '',
      workLocation: '',
      housingType: (lead.housingType === '전세' ? 'jeonse' : lead.housingType === '자가' ? 'owned' : 'rent') as any,
      housingContractHolder: 'self',
      debtCause: 'LIVING',
      harassmentLevel: 'NONE',
      debtTypes: { banks: 0, cards: 0, personals: 0, recentLoans: 0, coinCrypto: 0 },
      legalActions: [],
      myAssets: (lead.assets || []).reduce((sum, a) => sum + (a.amount || 0), 0),
      spouseAsset: 0,
      spouseIncome: 0,
      rentalDeposit: lead.deposit || 0,
      depositLoan: 0,
      rentCost: lead.rent || 0,
      medicalCost: 0,
      educationCost: 0,
      monthlyFixedExpenses: lead.loanMonthlyPay || 0,
      retirementPay: 0,
      retirementPensionType: 'none',
      specialCondition: 'none',
      riskFlags: [],
      clientNotes: [],
      debts: [],
      assets: [],
    }
  };

  // 2. CrmClientExtension 생성 및 100% 데이터 이식
  const newExt = createDefaultCrmExtension(newReqId);
  newExt.crmStatus = 'consulting'; // 초기 정밀 상담 단계로 진입
  newExt.intakeChannel = (lead.inboundPath === '네이버광고' ? 'naver_ad' : lead.inboundPath === '타사DB구매' ? 'db_purchase' : 'other');
  newExt.intakeChannelDetail = lead.batchName || lead.inboundPath || '영업 리드 이전';
  newExt.isExternalClient = true;
  newExt.caseType = (options?.caseType || (lead.caseType === '개인파산' ? '개인파산' : '개인회생')) as CaseType;
  newExt.region = lead.region;
  newExt.assigneeId = options?.assignedLawyerId || options?.assignedStaffId || operator.id;
  newExt.assignedLawyerId = options?.assignedLawyerId;
  newExt.assignedStaffId = options?.assignedStaffId;
  newExt.preInfo = lead.specialMemo;

  // LeadMaster 전용 필드 계승
  newExt.secondaryStatus = '상담접수완료';
  newExt.loanMonthlyPay = lead.loanMonthlyPay;
  newExt.creditCardUse = lead.creditCardUse;
  newExt.collateralLoanDesc = lead.collateralLoanDesc;
  newExt.historyDetail = lead.historyDetail;
  newExt.inboundPath = lead.inboundPath;
  newExt.partnerId = lead.partnerId;
  newExt.reminders = lead.reminders || [];

  // 통화 메모 및 상담 이력 계승
  if (lead.callLogs && lead.callLogs.length > 0) {
    lead.callLogs.forEach(c => {
      newExt.notes.push({
        id: `note-${c.id}`,
        category: 'consult',
        content: `[영업 통화] 결과: ${c.result} | ${c.memo || '메모 없음'}`,
        authorId: c.callerId,
        authorName: c.callerName,
        createdAt: c.calledAt,
      });
    });
  }

  // 이전 사유 메모 추가
  newExt.notes.unshift({
    id: `note-conv-${Date.now()}`,
    category: 'consult',
    content: `⭐️ 영업 리드(DB: ${lead.batchName || '직접등록'})에서 정식 고객으로 승격 이전 완료. (담당: ${operator.name})`,
    authorId: operator.id,
    authorName: operator.name,
    createdAt: nowIso,
  });

  // CRM 데이터베이스 영구 저장
  saveCrmClient(newReqId, newExt);

  // 3. 영업 리드 상태 'converted'로 업데이트
  lead.status = 'converted';
  lead.convertedClientId = newReqId;
  lead.convertedAt = nowIso;
  lead.convertedBy = operator.name;
  lead.updatedAt = nowIso;
  saveSalesLead(lead);

  return { newRequest, newExt, updatedLead: lead };
}

// ── 독립 영업 대시보드 통계 산출 ──

export interface SalesDashboardMetrics {
  totalLeads: number;
  newLeads: number;
  noAnswerLeads: number;
  todayReminders: number;
  overdueReminders: number;
  inProgressLeads: number;
  convertedCount: number;
  conversionRate: number;
  totalCalls: number;
  connectedRate: number;
}

export function getSalesDashboardMetrics(leads: SalesLead[]): SalesDashboardMetrics {
  const total = leads.length;
  if (total === 0) {
    return {
      totalLeads: 0,
      newLeads: 0,
      noAnswerLeads: 0,
      todayReminders: 0,
      overdueReminders: 0,
      inProgressLeads: 0,
      convertedCount: 0,
      conversionRate: 0,
      totalCalls: 0,
      connectedRate: 0,
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();

  let newCount = 0;
  let noAnswerCount = 0;
  let inProgressCount = 0;
  let convertedCount = 0;
  let totalCalls = 0;
  let connectedCalls = 0;
  let todayReminders = 0;
  let overdueReminders = 0;

  leads.forEach(l => {
    if (l.status === 'new') newCount++;
    if (l.status === 'no_answer_1' || l.status === 'no_answer_2' || l.status === 'no_answer_3') noAnswerCount++;
    if (l.status === 'in_progress' || l.status === 'callback') inProgressCount++;
    if (l.status === 'converted') convertedCount++;

    totalCalls += (l.callCount || 0);

    // 통화 연결율
    (l.callLogs || []).forEach(c => {
      if (c.result === 'connected' || c.result === 'callback') connectedCalls++;
    });

    // 리마인더
    (l.reminders || []).forEach(r => {
      if (!r.isCompleted) {
        if (r.datetime.startsWith(todayStr)) todayReminders++;
        const rMs = new Date(r.datetime.replace(' ', 'T')).getTime();
        if (!isNaN(rMs) && rMs < nowMs) overdueReminders++;
      }
    });
  });

  const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;
  const connectedRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;

  return {
    totalLeads: total,
    newLeads: newCount,
    noAnswerLeads: noAnswerCount,
    todayReminders,
    overdueReminders,
    inProgressLeads: inProgressCount,
    convertedCount,
    conversionRate,
    totalCalls,
    connectedRate,
  };
}

// ── 유틸리티: 전화번호 중복 검사 및 정규화 ──

export function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export function normalizeBirthYear(val: string): string {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length === 4) return digits;
  if (digits.length === 2) {
    const n = parseInt(digits, 10);
    return n > 30 ? `19${digits}` : `20${digits}`;
  }
  if (digits.length === 6) {
    const y2 = digits.slice(0, 2);
    const n = parseInt(y2, 10);
    return n > 30 ? `19${y2}` : `20${y2}`;
  }
  return digits;
}

export function checkLeadPhoneDuplicate(
  phone: string,
  leads: SalesLead[],
  existingRequests: ConsultRequest[] = []
): { isDuplicate: boolean; matchType?: 'lead' | 'client'; matchedName?: string } {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) return { isDuplicate: false };

  // 1. 기존 CRM 고객과 중복 체크 (더 중요)
  const clientMatch = existingRequests.find(r => (r.phone || '').replace(/\D/g, '') === cleanPhone);
  if (clientMatch) {
    return {
      isDuplicate: true,
      matchType: 'client',
      matchedName: clientMatch.clientName || '고객',
    };
  }

  // 2. 기존 영업 리드와 중복 체크
  const leadMatch = leads.find(l => (l.phone || '').replace(/\D/g, '') === cleanPhone);
  if (leadMatch) {
    return {
      isDuplicate: true,
      matchType: 'lead',
      matchedName: leadMatch.customerName || '리드',
    };
  }

  return { isDuplicate: false };
}

// ── 브리핑 텍스트 생성기 (LeadMaster 100% 호환) ──

export function extractBriefingData(lead: SalesLead): CustomerBriefingData {
  return {
    customerName: lead.customerName || '-',
    phone: lead.phone || '-',
    birthYear: lead.birth ? `${lead.birth}년생` : '-',
    gender: lead.gender || '-',
    region: lead.region || '-',
    job: (lead.jobTypes && lead.jobTypes.length > 0) ? lead.jobTypes.join(', ') : '미입력',
    insurance4: lead.insurance4 || '미확인',
    maritalStatus: lead.maritalStatus || '미확인',
    childrenCount: lead.childrenCount !== undefined ? `${lead.childrenCount}명` : '0명',
    income: lead.incomeNet ? `${lead.incomeNet.toLocaleString()}만원` : '0원',
    loanMonthlyPay: lead.loanMonthlyPay ? `${lead.loanMonthlyPay.toLocaleString()}만원` : '0원',
    housingType: lead.housingType || '미입력',
    depositRent: lead.housingType === '월세'
      ? `보증금 ${lead.deposit || 0}만 / 월 ${lead.rent || 0}만`
      : lead.housingType === '전세'
      ? `보증금 ${lead.deposit || 0}만원`
      : lead.housingType === '자가'
      ? `시세 ${lead.ownHousePrice || 0}만 (대출 ${lead.ownHouseLoan || 0}만)`
      : '무상/기타',
    assets: (lead.assets && lead.assets.length > 0)
      ? lead.assets.map(a => `${a.type}(${a.amount}만)`).join(', ')
      : '특이 자산 없음',
    creditLoan: lead.debtTotal ? `${lead.debtTotal.toLocaleString()}만원` : '미확인',
    collateralLoan: lead.collateralLoanDesc || '없음',
    creditCardUse: lead.creditCardUse || '미확인',
    history: lead.historyDetail || '이력 없음',
    specialMemo: lead.specialMemo || '없음',
    isAiSource: false,
  };
}

export function extractBriefingFromClient(
  req: ConsultRequest,
  ext?: CrmClientExtension | null
): CustomerBriefingData {
  const fp = req.financialProfile;
  const age = fp?.age;
  const gender = fp?.gender === 'male' ? '남성' : fp?.gender === 'female' ? '여성' : '-';
  const birthYear = age ? `${new Date().getFullYear() - age}년생 (${age}세)` : '-';

  return {
    customerName: req.clientName || '-',
    phone: req.phone || '-',
    birthYear,
    gender,
    region: fp?.residenceRegion || '-',
    job: fp?.employmentType || '미입력',
    insurance4: '미확인',
    maritalStatus: fp?.maritalStatus || '미확인',
    childrenCount: fp?.dependents !== undefined ? `${fp.dependents}명` : '0명',
    income: fp?.income ? `${fp.income.toLocaleString()}만원` : '0원',
    loanMonthlyPay: ext?.loanMonthlyPay ? `${ext.loanMonthlyPay.toLocaleString()}만원` : '0원',
    housingType: fp?.housingType || '미입력',
    depositRent: fp?.housingType === '월세'
      ? `보증금 ${fp.housingDeposit || 0}만 / 월 ${fp.housingMonthlyRent || 0}만`
      : fp?.housingType === '자가'
      ? '자가 소유'
      : '전세/기타',
    assets: fp?.assetsTotal ? `${fp.assetsTotal.toLocaleString()}만원` : '특이 자산 없음',
    creditLoan: fp?.debtTotal ? `${fp.debtTotal.toLocaleString()}만원` : '0원',
    collateralLoan: ext?.collateralLoanDesc || '없음',
    creditCardUse: ext?.creditCardUse || '미확인',
    history: ext?.historyDetail || fp?.debtCause || '이력 없음',
    specialMemo: ext?.specialMemo || req.content || '없음',
    isAiSource: false,
  };
}

