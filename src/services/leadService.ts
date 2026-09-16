import type { SalesLead, LeadStatus, CallLog, ReminderItem, CustomerBriefingData, CommissionRule, Partner } from '../types/leadTypes';
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

  // 통화 녹취, AI 요약문, 스마트폰 소통 로그 계승 (100% 무손실 이관)
  newExt.recordings = lead.recordings || [];
  newExt.aiSummary = lead.aiSummary || '';
  newExt.communicationLogs = lead.communicationLogs || [];
  if (lead.contractFee) {
    newExt.totalFee = lead.contractFee;
    newExt.contractAmount = lead.contractFee * 10000;
  }
  if (lead.contractAt) {
    newExt.contractDate = lead.contractAt;
  }
  if (lead.depositHistory && lead.depositHistory.length > 0) {
    newExt.feeSchedule = lead.depositHistory.map((d, i) => ({
      installmentNo: i + 1,
      dueDate: d.date,
      amount: d.amount,
      status: d.amount > 0 ? 'paid' : 'pending',
      paidAt: d.date,
    }));
  }

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

// ── 만원 단위 금액 한글 포맷터 (억, 만원 단위) ──
export const formatKoreanMoney = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '0원';
  if (value === 0) return '0원';

  const eok = Math.floor(value / 10000);
  const man = value % 10000;

  if (eok > 0 && man > 0) {
    return `${eok.toLocaleString()}억 ${man.toLocaleString()}만원`;
  }
  if (eok > 0 && man === 0) {
    return `${eok.toLocaleString()}억원`;
  }
  if (eok === 0 && man > 0) {
    return `${man.toLocaleString()}만원`;
  }

  return '0원';
};

// ── 18개 항목 기본 요약문 템플릿 (LeadMaster 100% 호환) ──
export const DEFAULT_SUMMARY_TEMPLATE = `* 담당자 : {{managerName}}
* 고객이름 : {{customerName}}
* 연락처 : {{phone}}
* 출생년도 : {{birth}}
* 성별 : {{gender}}
* 거주지역 : {{region}}
* 직업 : {{jobTypes}}
* 4대보험 가입유무 : {{insurance4}}
* 결혼유무 : {{maritalStatus}}
* 미성년 자녀 수 : {{childrenCount}}
* 월 세후소득 (실급여) : {{incomeDetails}}
* 월 대출납입금 : {{loanMonthlyPay}}
* 거주 형태 : {{housingType}} ({{housingDetail}})
* 보증금, 월세 : {{depositRentStr}}
* 자산 : {{assetsStr}}
* 신용 대출 : {{creditLoanStr}}
* 담보 대출 (차량 /집/토지 등) : {{collateralStr}}
* 신용카드 사용유무 : {{creditCardUse}}
* 신용카드 사용금액 : {{creditCardAmountStr}}
* 개인회생 / 파산 / 회복 이력 : {{historyStr}}
* 특이사항 :
{{specialMemo}}`;

// ── 영업 리드 기본 요약문 생성 함수 ──
export const generateSummary = (
  c: SalesLead,
  managerName?: string,
  template: string = DEFAULT_SUMMARY_TEMPLATE
): string => {
  let processedTemplate = template;

  if (c.maritalStatus === '미혼') {
    processedTemplate = processedTemplate.replace(/^\* 미성년 자녀 수 : .*\r?\n?/gm, '');
  }

  if (c.creditCardUse === '미사용') {
    processedTemplate = processedTemplate.replace(/^\* 신용카드 사용금액 : .*\r?\n?/gm, '');
  }

  if (c.jobTypes && c.jobTypes.length === 1 && c.jobTypes[0] === '무직') {
    processedTemplate = processedTemplate.replace(/^\* 4대보험 가입유무 : .*\r?\n?/gm, '');
  }

  const depositRentStrParts: string[] = [];
  if (c.housingType === '자가') {
    if (c.ownHousePrice) depositRentStrParts.push(`집 시세 ${formatKoreanMoney(c.ownHousePrice)}`);
    if (c.ownHouseLoan) depositRentStrParts.push(`(집 담보대출 ${formatKoreanMoney(c.ownHouseLoan)})`);
    if (c.ownHouseOwner) depositRentStrParts.push(`[명의: ${c.ownHouseOwner}]`);
  } else if (c.housingType === '무상거주') {
    depositRentStrParts.push(`무상거주`);
    if (c.freeHousingOwner) depositRentStrParts.push(`[명의: ${c.freeHousingOwner}]`);
  } else {
    if (c.deposit) depositRentStrParts.push(`보증금 ${formatKoreanMoney(c.deposit)}`);
    if (c.rent) depositRentStrParts.push(`월세 ${formatKoreanMoney(c.rent)}`);
    if (c.depositLoanAmount) depositRentStrParts.push(`(보증금 대출: ${formatKoreanMoney(c.depositLoanAmount)})`);
    if (c.rentContractor) depositRentStrParts.push(`[계약자: ${c.rentContractor}]`);
  }
  const depositRentStr = depositRentStrParts.length > 0 ? depositRentStrParts.join(' ') : '정보 없음';

  const assetsList = c.assets && c.assets.length > 0
    ? c.assets.map(a => {
        const descInfo = a.desc ? `(${a.desc})` : '';
        return `(${a.owner}/${a.type}${descInfo} 시세 ${formatKoreanMoney(a.amount)}${a.loanAmount ? `/담보${formatKoreanMoney(a.loanAmount)}` : ''})`;
      })
    : [];
  const assetsStr = assetsList.length > 0 ? assetsList.join(' ') : '없음';

  const collateralParts: string[] = [];
  let totalCollateralAmount = 0;

  if (c.housingType !== '자가' && c.housingType !== '무상거주' && c.depositLoanAmount) {
    collateralParts.push(`보증금 대출(${formatKoreanMoney(c.depositLoanAmount)})`);
    totalCollateralAmount += c.depositLoanAmount;
  }
  if (c.housingType === '자가' && c.ownHouseLoan) {
    collateralParts.push(`집 담보 대출(${formatKoreanMoney(c.ownHouseLoan)})`);
    totalCollateralAmount += c.ownHouseLoan;
  }
  if (c.assets) {
    c.assets.filter(a => a.loanAmount > 0).forEach(a => {
      collateralParts.push(`${a.type} 담보(${formatKoreanMoney(a.loanAmount)})`);
      totalCollateralAmount += a.loanAmount;
    });
  }
  if (c.collateralLoanDesc) collateralParts.push(c.collateralLoanDesc);

  let collateralStr = collateralParts.length > 0 ? collateralParts.join(', ') : '없음';
  if (totalCollateralAmount > 0) {
    collateralStr += ` [총 합계: ${formatKoreanMoney(totalCollateralAmount)}]`;
  }

  let totalCreditLoanAmount = 0;
  const creditLoanList = c.creditLoans && c.creditLoans.length > 0
    ? c.creditLoans.map(l => {
        totalCreditLoanAmount += (l.amount || 0);
        return `${l.desc} ${formatKoreanMoney(l.amount)}`;
      })
    : (c.debtTotal ? [`신용대출 ${formatKoreanMoney(c.debtTotal)}`] : []);

  if (c.creditCardUse === '사용' && c.creditCardAmount) {
    totalCreditLoanAmount += c.creditCardAmount;
    creditLoanList.push(`신용카드 ${formatKoreanMoney(c.creditCardAmount)}`);
  }

  let creditLoanStr = creditLoanList.length > 0 ? creditLoanList.join(', ') : '없음';
  if (totalCreditLoanAmount > 0) {
    creditLoanStr += ` [총 합계: ${formatKoreanMoney(totalCreditLoanAmount)}]`;
  }

  let historyStr = c.historyType || '없음';
  if (c.historyType && c.historyType !== '없음' && c.historyMemo) {
    historyStr += ` (${c.historyMemo})`;
  } else if (c.historyDetail && c.historyDetail !== '이력 없음') {
    historyStr = c.historyDetail;
  }

  const sortedMemos = c.memos
    ? [...c.memos]
        .filter(m => !m.content.startsWith('[상태변경]'))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const allMemosContent = sortedMemos.length > 0
    ? sortedMemos.map(memo => `[${memo.createdAt.slice(0, 16).replace('T', ' ')}]\n${memo.content}`).join('\n\n')
    : (c.specialMemo || '없음');

  const jobTypesStr = c.jobTypes && c.jobTypes.length > 0 ? c.jobTypes.join(', ') : '정보 없음';

  const incomeParts: string[] = [];
  if (c.incomeDetails?.salary) incomeParts.push(`직장인 ${formatKoreanMoney(c.incomeDetails.salary)}`);
  if (c.incomeDetails?.business) incomeParts.push(`사업자 ${formatKoreanMoney(c.incomeDetails.business)}`);
  if (c.incomeDetails?.freelance) incomeParts.push(`프리랜서 ${formatKoreanMoney(c.incomeDetails.freelance)}`);
  let incomeDetailsStr = incomeParts.join(' + ');
  if (incomeParts.length > 1) {
    incomeDetailsStr += ` (총 ${formatKoreanMoney(c.incomeNet)})`;
  } else if (incomeParts.length === 0) {
    incomeDetailsStr = formatKoreanMoney(c.incomeNet);
  }

  const birthStr = c.birth ? (c.birth.endsWith('년생') ? c.birth : `${c.birth}년생`) : '-';

  const dataMap: Record<string, string> = {
    managerName: managerName || c.assigneeName || '담당자 미정',
    customerName: c.customerName || '-',
    phone: c.phone || '-',
    birth: birthStr,
    gender: c.gender || '-',
    region: c.region || '-',
    jobTypes: jobTypesStr,
    insurance4: c.insurance4 || '정보 없음',
    maritalStatus: c.maritalStatus || '정보 없음',
    childrenCount: c.childrenCount !== undefined ? `${c.childrenCount}명` : '-',
    incomeDetails: incomeDetailsStr,
    loanMonthlyPay: formatKoreanMoney(c.loanMonthlyPay),
    housingType: c.housingType || '정보 없음',
    housingDetail: c.housingDetail || '기타',
    depositRentStr: depositRentStr,
    assetsStr: assetsStr,
    creditLoanStr: creditLoanStr,
    collateralStr: collateralStr,
    creditCardUse: c.creditCardUse || '미사용',
    creditCardAmountStr: c.creditCardUse === '사용' && c.creditCardAmount ? formatKoreanMoney(c.creditCardAmount) : '없음',
    historyStr: historyStr,
    specialMemo: allMemosContent
  };

  let result = processedTemplate;
  for (const key in dataMap) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, dataMap[key] || '');
  }

  return result.trim();
};

export const injectSummaryMetadata = (text: string, managerName: string): string => {
  if (!text) return '';
  let newText = text;
  const manager = managerName || '담당자 미정';

  const managerRegex = /^[*]?\s*담당자\s*:.*/m;
  if (managerRegex.test(newText)) {
    newText = newText.replace(managerRegex, `* 담당자 : ${manager}`);
  } else {
    newText = `* 담당자 : ${manager}\n` + newText;
  }
  return newText;
};

export const getMatchingRule = (fee: number, rules: CommissionRule[]): CommissionRule | undefined => {
  const safeRules = Array.isArray(rules) ? rules : [];
  const activeRules = safeRules.filter(r => r.active);
  const matchedRules = activeRules.filter(r => {
    const minOk = fee >= r.minFee;
    const maxOk = !r.maxFee || fee <= r.maxFee;
    return minOk && maxOk;
  });

  if (matchedRules.length === 0) return undefined;

  matchedRules.sort((a, b) => {
    if (b.minFee !== a.minFee) return b.minFee - a.minFee;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return 0;
  });

  return matchedRules[0];
};

export const calculateCommission = (fee: number, rules?: CommissionRule[]): number => {
  if (!fee || fee <= 0) return 0;
  const safeRules = Array.isArray(rules) ? rules : [];
  const rule = getMatchingRule(fee, safeRules);
  if (rule) return rule.commission;
  // 기본 추정 룰: 수임료의 약 10%
  return Math.round(fee * 0.1);
};

// ── 본안 수임 고객(ConsultRequest & CrmClientExtension) 표준 요약문 생성 함수 ──
export const generateClientSummary = (
  client: ConsultRequest,
  ext?: CrmClientExtension | null,
  managerName?: string,
  template: string = DEFAULT_SUMMARY_TEMPLATE
): string => {
  let processedTemplate = template;
  const fp = client.financialProfile || {};

  if (fp.maritalStatus === '미혼' || fp.maritalStatus === 'single') {
    processedTemplate = processedTemplate.replace(/^\* 미성년 자녀 수 : .*\r?\n?/gm, '');
  }

  if (ext?.creditCardUse === '미사용') {
    processedTemplate = processedTemplate.replace(/^\* 신용카드 사용금액 : .*\r?\n?/gm, '');
  }

  const depositRentStrParts: string[] = [];
  if (fp.housingType === '자가' || fp.housingType === 'own') {
    depositRentStrParts.push(`자가 소유`);
  } else if (fp.housingType === '월세' || fp.housingType === 'monthly') {
    if (fp.housingDeposit) depositRentStrParts.push(`보증금 ${formatKoreanMoney(fp.housingDeposit)}`);
    if (fp.housingMonthlyRent) depositRentStrParts.push(`월세 ${formatKoreanMoney(fp.housingMonthlyRent)}`);
  } else if (fp.housingType === '전세' || fp.housingType === 'jeonse') {
    if (fp.housingDeposit) depositRentStrParts.push(`전세 보증금 ${formatKoreanMoney(fp.housingDeposit)}`);
  } else if (fp.housingType === '무상' || fp.housingType === 'free') {
    depositRentStrParts.push(`무상거주`);
  }
  const depositRentStr = depositRentStrParts.length > 0 ? depositRentStrParts.join(' ') : '정보 없음';

  const assetsStr = fp.assetsTotal ? `${formatKoreanMoney(fp.assetsTotal)} (청산가치 반영)` : '특이 자산 없음';
  const creditLoanStr = fp.debtTotal ? `${formatKoreanMoney(fp.debtTotal)} (총 채무 원금)` : '미확인';
  const collateralStr = ext?.collateralLoanDesc || '없음';
  const historyStr = ext?.historyDetail || fp.debtCause || '이력 없음';

  const sortedNotes = ext?.notes
    ? [...ext.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const allMemosContent = sortedNotes.length > 0
    ? sortedNotes.slice(0, 5).map(n => `[${n.createdAt.slice(0, 16).replace('T', ' ')} / ${n.authorName || '상담원'}]\n${n.content || (n as any).text || ''}`).join('\n\n')
    : (ext?.preInfo || client.content || '없음');

  const age = fp.age;
  const birthStr = age ? `${new Date().getFullYear() - age}년생 (${age}세)` : '-';
  const genderStr = fp.gender === 'male' ? '남' : fp.gender === 'female' ? '여' : '-';

  const dataMap: Record<string, string> = {
    managerName: managerName || ext?.assignedLawyerId || '담당 변호사',
    customerName: client.realClientName || client.clientName || '의뢰인',
    phone: client.phone || '-',
    birth: birthStr,
    gender: genderStr,
    region: fp.residenceRegion || ext?.region || '-',
    jobTypes: fp.employmentType || '정보 없음',
    insurance4: '정보 없음',
    maritalStatus: fp.maritalStatus === 'single' ? '미혼' : fp.maritalStatus === 'married' ? '기혼' : fp.maritalStatus || '정보 없음',
    childrenCount: fp.dependents !== undefined ? `${fp.dependents}명` : '-',
    incomeDetails: formatKoreanMoney(fp.income),
    loanMonthlyPay: formatKoreanMoney(ext?.loanMonthlyPay),
    housingType: fp.housingType || '정보 없음',
    housingDetail: '기타',
    depositRentStr: depositRentStr,
    assetsStr: assetsStr,
    creditLoanStr: creditLoanStr,
    collateralStr: collateralStr,
    creditCardUse: ext?.creditCardUse || '미사용',
    creditCardAmountStr: '없음',
    historyStr: historyStr,
    specialMemo: allMemosContent
  };

  let result = processedTemplate;
  for (const key in dataMap) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, dataMap[key] || '');
  }

  return result.trim();
};

