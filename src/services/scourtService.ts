/**
 * 대법원 나의사건검색 서비스 (CODEF B2B API 중계)
 * 엔드포인트: /api/scourt-proxy
 */

import { toast } from 'sonner';
import type { CourtCaseLink, CourtEvent, CorrectionOrder } from '../types';

export interface CourtDeliveryItem {
  id: string;
  docName: string;
  target: string;
  deliveryDate: string;
  status: string;
  isCorrectionOrder?: boolean;
}

export interface CourtDateItem {
  id: string;
  date: string;
  place: string;
  type: string;
  result: string;
  dDay?: number;
}

export interface CourtRepaymentItem {
  round: number;
  dueDate: string;
  paidDate?: string | null;
  amount: number;
  status: string;
}

export interface ScourtCaseDetail {
  caseNumber: string;
  courtName: string;
  caseType: string;
  department: string;
  judgeName: string;
  filedDate: string;
  clientName: string;
  finalResult?: string;
  isB2BLive: boolean;
  isMock?: boolean;
  lastSyncedAt: string;
  events: CourtEvent[];
  dates: CourtDateItem[];
  deliveries: CourtDeliveryItem[];
  repayments: CourtRepaymentItem[];
  copySummaryText: string;
  mobileUrl: string;
  webUrl: string;
}

export interface FetchCourtCaseParams {
  courtName: string;
  caseNumber: string;
  clientName?: string;
  forceRefresh?: boolean;
}

const CACHE_PREFIX = 'scourt_cache_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간 캐시

export function parseCaseNumber(rawCaseNumber: string): {
  isValid: boolean;
  year: string;
  type: string;
  number: string;
  formatted: string;
} {
  if (!rawCaseNumber) {
    return { isValid: false, year: '', type: '', number: '', formatted: '' };
  }
  const cleaned = rawCaseNumber.replace(/\s+/g, '');
  const match = cleaned.match(/^(\d{4})([가-힣]{2,4})(\d+)$/);
  if (match) {
    return {
      isValid: true,
      year: match[1],
      type: match[2],
      number: match[3],
      formatted: `${match[1]}${match[2]}${match[3]}`
    };
  }
  return {
    isValid: false,
    year: '',
    type: '',
    number: cleaned,
    formatted: cleaned
  };
}

export function getCachedCourtCase(caseNumber: string): ScourtCaseDetail | null {
  try {
    const cleaned = caseNumber.replace(/\s+/g, '');
    const raw = localStorage.getItem(`${CACHE_PREFIX}${cleaned}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - new Date(parsed.cachedAt).getTime() > CACHE_TTL_MS) {
      localStorage.removeItem(`${CACHE_PREFIX}${cleaned}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedCourtCase(caseNumber: string, data: ScourtCaseDetail) {
  try {
    const cleaned = caseNumber.replace(/\s+/g, '');
    localStorage.setItem(
      `${CACHE_PREFIX}${cleaned}`,
      JSON.stringify({ cachedAt: new Date().toISOString(), data })
    );
  } catch {}
}

export async function fetchCourtCase({
  courtName,
  caseNumber,
  clientName = '',
  forceRefresh = false
}: FetchCourtCaseParams): Promise<ScourtCaseDetail> {
  const cleanCaseNumber = (caseNumber || '').trim();
  const cleanCourt = (courtName || '서울회생법원').trim();

  if (!cleanCaseNumber) {
    throw new Error('사건번호를 입력해 주세요.');
  }

  // 1. 캐시 확인 (강제 새로고침이 아닐 때)
  if (!forceRefresh) {
    const cached = getCachedCourtCase(cleanCaseNumber);
    if (cached) {
      return cached;
    }
  }

  // 2. 서버리스 프록시 호출
  const res = await fetch('/api/scourt-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courtName: cleanCourt,
      caseNumber: cleanCaseNumber,
      clientName: clientName.trim()
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`대법원 사건검색 중계 실패 (${res.status}): ${errText}`);
  }

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || '대법원 사건 정보를 불러오지 못했습니다.');
  }

  const codefData = json.data || {};
  const caseList = codefData.resCaseList || [];
  const primaryCase = caseList[0] || {};
  const progressList = codefData.resProgressList || [];
  const dateList = codefData.resDateList || [];
  const deliveryList = codefData.resDeliveryList || [];
  const repaymentList = codefData.resRepaymentList || [];

  // 진행 내역 변환
  const events: CourtEvent[] = progressList.map((item: any, idx: number) => {
    const title = item.content || item.title || '사건 진행';
    let type: CourtEvent['type'] = 'other';
    if (title.includes('접수')) type = 'filing';
    else if (title.includes('금지명령')) type = 'injunction';
    else if (title.includes('보정')) type = 'correction';
    else if (title.includes('기일') || title.includes('집회') || title.includes('심문')) type = 'hearing';
    else if (title.includes('개시') || title.includes('인가') || title.includes('선고')) type = 'decision';
    else if (title.includes('면책')) type = 'discharge';

    return {
      id: `ev-${idx}-${Date.now()}`,
      date: item.date || item.resDate || '',
      type,
      title,
      detail: item.result ? `결과: ${item.result}` : undefined
    };
  });

  // 기일 내역 변환 (D-Day 계산 포함)
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const dates: CourtDateItem[] = dateList.map((item: any, idx: number) => {
    const dateStr = (item.date || '').split(' ')[0];
    let dDay: number | undefined = undefined;
    if (dateStr) {
      const targetDate = new Date(dateStr);
      targetDate.setHours(0, 0, 0, 0);
      const diffTime = targetDate.getTime() - now.getTime();
      dDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      id: `date-${idx}-${Date.now()}`,
      date: item.date || '',
      place: item.place || '법정 미정',
      type: item.type || '기일',
      result: item.result || '예정',
      dDay
    };
  });

  // 송달 내역 변환
  const deliveries: CourtDeliveryItem[] = deliveryList.map((item: any, idx: number) => {
    const docName = item.docName || item.title || '법원 서류';
    const isCorrection = docName.includes('보정명령') || docName.includes('보정권고');
    return {
      id: `del-${idx}-${Date.now()}`,
      docName,
      target: item.target || '채무자 대리인',
      deliveryDate: item.deliveryDate || item.date || '',
      status: item.status || '송달 완료',
      isCorrectionOrder: isCorrection
    };
  });

  // 변제 내역 변환
  const repayments: CourtRepaymentItem[] = repaymentList.map((item: any) => ({
    round: Number(item.round) || 1,
    dueDate: item.dueDate || '',
    paidDate: item.paidDate || null,
    amount: Number(item.amount) || 0,
    status: item.status || (item.paidDate ? '정상납부' : '납부대기')
  }));

  const detail: ScourtCaseDetail = {
    caseNumber: primaryCase.resCaseNumber || cleanCaseNumber,
    courtName: primaryCase.resCourtName || cleanCourt,
    caseType: primaryCase.resCaseName || (cleanCaseNumber.includes('개회') ? '개인회생' : '개인파산 및 면책'),
    department: primaryCase.resDeptName || '재판부 확인중',
    judgeName: primaryCase.resJudgeName || '판사 확인중',
    filedDate: primaryCase.resReceiveDate || '',
    clientName: primaryCase.resClientName || clientName || '의뢰인',
    finalResult: primaryCase.resFinalResult,
    isB2BLive: Boolean(json.isB2BLive),
    isMock: Boolean(json.isMock),
    lastSyncedAt: new Date().toISOString(),
    events,
    dates,
    deliveries,
    repayments,
    copySummaryText: json.copySummaryText || `${cleanCourt} ${cleanCaseNumber}`,
    mobileUrl: json.mobileUrl || 'https://m.scourt.go.kr',
    webUrl: json.webUrl || 'https://www.scourt.go.kr/portal/information/events/search/search.jsp'
  };

  // 캐시 저장
  setCachedCourtCase(cleanCaseNumber, detail);

  return detail;
}

/**
 * 대법원 송달내역 중 보정명령이 감지되었을 때 CorrectionOrder 객체로 변환
 */
export function extractCorrectionOrdersFromCourt(deliveries: CourtDeliveryItem[]): CorrectionOrder[] {
  return deliveries
    .filter(d => d.isCorrectionOrder)
    .map(d => {
      // 송달일로부터 14일 뒤 마감일 자동 계산
      const issued = d.deliveryDate ? new Date(d.deliveryDate) : new Date();
      const deadline = new Date(issued.getTime() + 14 * 86400000);

      return {
        id: `court-corr-${d.id}`,
        title: `[법원송달] ${d.docName}`,
        issuedDate: d.deliveryDate || new Date().toISOString().split('T')[0],
        deadline: deadline.toISOString().split('T')[0],
        status: 'pending',
        detail: `대법원 사건검색에서 자동 감지된 보정명령 송달 내역입니다. (송달대상: ${d.target}, 상태: ${d.status})`,
        content: `${d.docName}에 따른 소명자료 및 보정서 작성 필요`
      };
    });
}
