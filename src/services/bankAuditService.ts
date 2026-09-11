/**
 * 통장 및 신용카드 거래내역 소명 자동화 서비스
 * 대법원 보정명령 30만/50만/100만 원 이상 출금·결제 사용처 소명 및 위험거래 탐지 엔진
 */

import * as XLSX from 'xlsx-js-style';
import type { 
  AuditTransactionItem, 
  AuditRiskCategory, 
  AuditTransactionType, 
  AuditPresetTemplate,
  AuditSummaryStats 
} from '../types/bankAuditTypes';

// ═══════════════════════════════════════════════
// 1. 법원 회생위원 맞춤 7대 표준 소명 문구 라이브러리
// ═══════════════════════════════════════════════

export const AUDIT_PRESET_TEMPLATES: AuditPresetTemplate[] = [
  {
    id: 'preset-living',
    category: 'SAFE_LIVING',
    name: '식비 및 생필품',
    icon: '🛒',
    templateText: '배우자 및 미성년 자녀를 포함한 4인 가구의 1개월분 식료품 및 생활필수품 마트 구매 비용 (생계유지비 지출)',
    suggestedEvidence: '카드영수증 / 마트 구매내역서'
  },
  {
    id: 'preset-rent',
    category: 'SAFE_FIXED',
    name: '주거비 및 월세',
    icon: '🏠',
    templateText: '임대차계약서에 따른 거주지 월 차임(월세) 및 아파트 관리비 정기 납부',
    suggestedEvidence: '임대차계약서 사본 / 계좌이체확인증'
  },
  {
    id: 'preset-medical',
    category: 'SAFE_FIXED',
    name: '의료비 및 약제비',
    icon: '🏥',
    templateText: '본인(또는 가족)의 질환 치료를 위한 병원 진료비, 정밀검사비 및 필수 의약품 처방 비용',
    suggestedEvidence: '진단서 / 진료비 영수증 / 약제비 계산서'
  },
  {
    id: 'preset-debt',
    category: 'SAFE_DEBT',
    name: '대출 상환 및 카드 대환',
    icon: '💳',
    templateText: '타 금융기관 연체 방지를 위한 기존 대출금 원리금 상환 및 카드 결제대금 충당 (대환 상환, 재산은닉 없음)',
    suggestedEvidence: '금융거래확인서 / 대환 송금확인증'
  },
  {
    id: 'preset-family',
    category: 'CAUTION_TRANSFER',
    name: '가족 생활비 보조',
    icon: '👨‍👩‍👧',
    templateText: '생계를 같이하는 고령의 모친(배우자) 생활비 보조를 위한 실비 송금 (편파변제 및 재산은닉 의도 일체 없음)',
    suggestedEvidence: '주민등록등본 / 가족관계증명서 / 계좌확인증'
  },
  {
    id: 'preset-cash',
    category: 'CAUTION_CASH',
    name: '단순 현금인출 (생활비)',
    icon: '💵',
    templateText: '전통시장 장보기, 자녀 소액 용돈 및 학용품비 등 일상적 현금 지출을 위한 인출 (은닉 재산 전혀 없음)',
    suggestedEvidence: '가계 지출 소명서 / 영수증 복원 메모'
  },
  {
    id: 'preset-speculation',
    category: 'DANGER_SPECULATION',
    name: '주식·코인 투자 손실',
    icon: '📉',
    templateText: '과거 가상자산/주식 투자 손실 발생분 (관할 법원 도산 실무준칙에 의거 청산가치 제외 및 성실 변제 서약)',
    suggestedEvidence: '거래소 출입금내역서 / 손실증명원'
  }
];

// ═══════════════════════════════════════════════
// 2. AI 키워드 룰 기반 거래 위험도 자동 분류 엔진
// ═══════════════════════════════════════════════

export function classifyTransactionRisk(
  counterparty: string, 
  transType: AuditTransactionType,
  amount: number
): {
  category: AuditRiskCategory;
  badgeText: string;
  advice: string;
  defaultExplanation: string;
  defaultEvidence: string;
} {
  const norm = (counterparty || '').toLowerCase().replace(/\s+/g, '');

  // 1) 사행성 / 코인 / 도박 (고위험)
  const speculationKeywords = ['업비트', '빗썸', '코인원', '코빗', '바이낸스', '두나무', '토토', '배트맨', '카지노', '경마', '주식', '선물옵션', '해외선물', '비트코인', '가상화폐', '증권'];
  for (const kw of speculationKeywords) {
    if (norm.includes(kw)) {
      return {
        category: 'DANGER_SPECULATION',
        badgeText: '사행성 (코인·주식)',
        advice: '서울·수원회생법원은 투자 손실금 청산가치 제외 실무준칙 적용 가능. 기타 법원은 청산가치 반영 방어 소명서 필수.',
        defaultExplanation: AUDIT_PRESET_TEMPLATES.find(p => p.id === 'preset-speculation')!.templateText,
        defaultEvidence: '거래소 출입금내역서'
      };
    }
  }

  // 2) 사치 / 유흥 / 명품 (고위험)
  const luxuryKeywords = ['주점', '유흥', '단란', '클럽', '나이트', '룸싸롱', '가라오케', '명품', '샤넬', '루이비통', '구찌', '에르메스', '골프', '피부과', '성형외과', '면세점', '해외여행', '호텔'];
  for (const kw of luxuryKeywords) {
    if (norm.includes(kw)) {
      return {
        category: 'DANGER_LUXURY',
        badgeText: '사치·유흥 주의',
        advice: '회생위원이 청산가치 산입 또는 변제율 상향을 요구할 수 있으므로 일회성 경조사 및 필수 지출 소명 필요.',
        defaultExplanation: '업무상 불가피한 경조사/접대 및 치료 목적 지출이며 지속적 사치 행위가 아님을 소명합니다.',
        defaultEvidence: '세부 영수증 / 소명서'
      };
    }
  }

  // 3) 현금 인출 (ATM / CD기) (주의)
  const cashKeywords = ['cd', 'atm', '현금인출', '현금출금', '자동화기기', '창구출금', '화폐출금', '무통장출금'];
  for (const kw of cashKeywords) {
    if (norm.includes(kw) || transType === 'ATM_CASH') {
      return {
        category: 'CAUTION_CASH',
        badgeText: '현금인출 (은닉의심)',
        advice: '증빙 없는 현금인출은 법원이 은닉 재산으로 보아 청산가치에 전액 반영하므로 생활비 지출 내역 복원이 필수적입니다.',
        defaultExplanation: AUDIT_PRESET_TEMPLATES.find(p => p.id === 'preset-cash')!.templateText,
        defaultEvidence: '가계부 지출 메모'
      };
    }
  }

  // 4) 대출금 상환 및 카드 대환 (안전)
  const debtKeywords = ['카드', '캐피탈', '저축은행', '대출', '상환', '원리금', '할부', '파이낸셜', '신한카드', '국민카드', '삼성카드', '현대카드', '롯데카드'];
  for (const kw of debtKeywords) {
    if (norm.includes(kw)) {
      return {
        category: 'SAFE_DEBT',
        badgeText: '대출상환·대환',
        advice: '타 금융기관 부채 변제는 정당한 채무 상환으로 인정되어 청산가치에 산입되지 않습니다.',
        defaultExplanation: AUDIT_PRESET_TEMPLATES.find(p => p.id === 'preset-debt')!.templateText,
        defaultEvidence: '대환 이체확인증'
      };
    }
  }

  // 5) 고정비 / 주거비 / 병원비 (안전)
  const fixedKeywords = ['병원', '의원', '약국', '치과', '한의원', '관리비', '월세', '한전', '도시가스', '통신비', '아파트', '부동산'];
  for (const kw of fixedKeywords) {
    if (norm.includes(kw)) {
      const isMed = norm.includes('병원') || norm.includes('약국') || norm.includes('의원');
      return {
        category: 'SAFE_FIXED',
        badgeText: isMed ? '의료비' : '주거·고정비',
        advice: '필수 생계 및 주거 안정 비용으로 법원에서 100% 정상 인정하는 항목입니다.',
        defaultExplanation: isMed 
          ? AUDIT_PRESET_TEMPLATES.find(p => p.id === 'preset-medical')!.templateText 
          : AUDIT_PRESET_TEMPLATES.find(p => p.id === 'preset-rent')!.templateText,
        defaultEvidence: isMed ? '진료비 계산서' : '임대차계약서'
      };
    }
  }

  // 6) 일반 생활비 (식료품, 마트, 생필품) (안전)
  const livingKeywords = ['마트', '이마트', '홈플러스', '롯데마트', '쿠팡', '배달의민족', '요기요', '식당', '편의점', 'gs25', 'cu', '다이소', '마켓컬리'];
  for (const kw of livingKeywords) {
    if (norm.includes(kw)) {
      return {
        category: 'SAFE_LIVING',
        badgeText: '식비·생필품',
        advice: '기본 생계 유지비로 안전하게 인정됩니다.',
        defaultExplanation: AUDIT_PRESET_TEMPLATES.find(p => p.id === 'preset-living')!.templateText,
        defaultEvidence: '카드영수증'
      };
    }
  }

  // 7) 개인 성명 이체 (편파변제 또는 차명 의심)
  // 한글 2~4글자 이름 형태인 경우
  if (/^[가-힣]{2,4}$/.test(counterparty.trim())) {
    return {
      category: 'CAUTION_TRANSFER',
      badgeText: '개인이체 (편파의심)',
      advice: '가족이나 지인에게 거액 송금 시 편파변제로 보아 부인권 또는 청산가치 반영 요구를 받을 수 있어 차용증이나 생활비 소명이 필수입니다.',
      defaultExplanation: AUDIT_PRESET_TEMPLATES.find(p => p.id === 'preset-family')!.templateText,
      defaultEvidence: '가족관계증명서 / 차용증'
    };
  }

  // 기본 미분류
  return {
    category: 'UNCATEGORIZED',
    badgeText: '일반 거래',
    advice: '출금 사유 및 자금 귀속처를 간략히 소명해 주십시오.',
    defaultExplanation: '생활필수비 지출 및 공과금 결제 충당',
    defaultEvidence: '이체확인증'
  };
}

// ═══════════════════════════════════════════════
// 3. 실무 테스트용 1년치 통장·카드 샘플 데이터
// ═══════════════════════════════════════════════

export function generateSampleBankTransactions(): AuditTransactionItem[] {
  const rawList = [
    { date: '2025-08-04', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '주식회사 두나무(업비트)', amount: 1500000, bal: 320000 },
    { date: '2025-08-10', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '이마트 양재점', amount: 385000, bal: 2150000 },
    { date: '2025-08-14', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '쿠팡 결제', amount: 492000, bal: 0 },
    { date: '2025-08-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 1500000 },
    { date: '2025-08-28', bank: 'KB국민은행 (128-***-991)', type: 'ATM_CASH', name: '국민은행ATM 현금출금', amount: 500000, bal: 1000000 },
    { date: '2025-09-02', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '현대캐피탈 대출상환', amount: 890000, bal: 110000 },
    { date: '2025-09-08', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '빗썸코리아', amount: 2000000, bal: 450000 },
    { date: '2025-09-15', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '홍길동(모친 생활비)', amount: 800000, bal: 1200000 },
    { date: '2025-09-20', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '서울대병원 원무과', amount: 1250000, bal: 0 },
    { date: '2025-09-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 550000 },
    { date: '2025-10-03', bank: 'KB국민은행 (128-***-991)', type: 'ATM_CASH', name: 'CD기 현금인출', amount: 700000, bal: 300000 },
    { date: '2025-10-12', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '강남 골든유흥주점', amount: 620000, bal: 0 },
    { date: '2025-10-18', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '홈플러스 강동점', amount: 310000, bal: 800000 },
    { date: '2025-10-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 150000 },
    { date: '2025-11-05', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '신한저축은행 대환상환', amount: 3500000, bal: 400000 },
    { date: '2025-11-12', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '쿠팡 생활가전', amount: 480000, bal: 0 },
    { date: '2025-11-20', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '김철수(지인 차용금변제)', amount: 1200000, bal: 200000 },
    { date: '2025-11-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 1200000 },
    { date: '2025-12-02', bank: 'KB국민은행 (128-***-991)', type: 'ATM_CASH', name: '국민은행ATM 현금출금', amount: 500000, bal: 700000 },
    { date: '2025-12-10', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '롯데마트 의왕점', amount: 340000, bal: 0 },
    { date: '2025-12-18', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '서울아산병원 검사비', amount: 780000, bal: 420000 },
    { date: '2025-12-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 900000 },
    { date: '2026-01-08', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '주식회사 빗썸', amount: 1800000, bal: 100000 },
    { date: '2026-01-15', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '홍길동(모친 병원비)', amount: 600000, bal: 1500000 },
    { date: '2026-01-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 850000 }
  ];

  return rawList.map((item, idx) => {
    const classification = classifyTransactionRisk(item.name, item.type as AuditTransactionType, item.amount);
    const isResolvedInit = idx < 5; // 처음 5건은 소명 예시 채워둠
    return {
      id: `audit-${idx + 1}`,
      date: item.date,
      bankOrCard: item.bank,
      accountNumberMasked: item.bank.includes('국민') ? 'KB 128-***-991' : '신한 4518-****',
      transactionType: item.type as AuditTransactionType,
      counterparty: item.name,
      amount: item.amount,
      balance: item.bal,
      riskCategory: classification.category,
      riskBadgeText: classification.badgeText,
      riskAdvice: classification.advice,
      explanation: isResolvedInit ? classification.defaultExplanation : '',
      evidenceType: isResolvedInit ? classification.defaultEvidence : '',
      isResolved: isResolvedInit
    };
  });
}

// ═══════════════════════════════════════════════
// 4. 통계 집계 계산기
// ═══════════════════════════════════════════════

export function calculateAuditStats(
  items: AuditTransactionItem[],
  thresholdAmount: number = 500000
): AuditSummaryStats {
  const totalCount = items.length;
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const thresholdItems = items.filter(i => i.amount >= thresholdAmount);
  const thresholdCount = thresholdItems.length;
  const thresholdSum = thresholdItems.reduce((sum, item) => sum + item.amount, 0);

  const resolvedCount = thresholdItems.filter(i => i.isResolved && i.explanation.trim().length > 0).length;
  const unresolvedCount = thresholdCount - resolvedCount;
  const resolvedRate = thresholdCount > 0 ? Math.round((resolvedCount / thresholdCount) * 100) : 100;

  const dangerCount = thresholdItems.filter(i => 
    i.riskCategory === 'DANGER_SPECULATION' || i.riskCategory === 'DANGER_LUXURY'
  ).length;

  const cautionCount = thresholdItems.filter(i => 
    i.riskCategory === 'CAUTION_CASH' || i.riskCategory === 'CAUTION_TRANSFER'
  ).length;

  return {
    totalCount,
    totalAmount,
    thresholdCount,
    thresholdAmount: thresholdSum,
    resolvedCount,
    unresolvedCount,
    resolvedRate,
    dangerCount,
    cautionCount
  };
}

// ═══════════════════════════════════════════════
// 5. 텍스트 / CSV / 클립보드 붙여넣기 파서
// ═══════════════════════════════════════════════

export function parseRawBankStatementText(text: string): AuditTransactionItem[] {
  const lines = text.trim().split(/\r?\n/);
  const results: AuditTransactionItem[] = [];

  lines.forEach((line, idx) => {
    // 쉼표 또는 탭 또는 다중 공백 분리
    const tokens = line.split(/[,\t|]/).map(t => t.trim()).filter(Boolean);
    if (tokens.length < 3) return;

    // 간단한 날짜 패턴 검출 (예: 2025-08-10, 2025.08.10, 2025/08/10)
    const dateMatch = tokens[0].match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/);
    const date = dateMatch ? dateMatch[0].replace(/[/.]/g, '-') : new Date().toISOString().split('T')[0];

    // 금액 찾기 (숫자와 콤마로 이루어진 토큰)
    let amount = 0;
    let counterparty = tokens[1] || '불명 거래';

    for (let i = 1; i < tokens.length; i++) {
      const cleaned = tokens[i].replace(/[^0-9]/g, '');
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed) && parsed >= 10000 && parsed <= 500000000) {
        amount = parsed;
        if (i > 1) {
          counterparty = tokens.slice(1, i).join(' ');
        }
        break;
      }
    }

    if (amount > 0) {
      const classification = classifyTransactionRisk(counterparty, 'WITHDRAWAL', amount);
      results.push({
        id: `parsed-${Date.now()}-${idx}`,
        date,
        bankOrCard: '금융기관 (직접등록)',
        transactionType: 'WITHDRAWAL',
        counterparty,
        amount,
        riskCategory: classification.category,
        riskBadgeText: classification.badgeText,
        riskAdvice: classification.advice,
        explanation: '',
        evidenceType: classification.defaultEvidence,
        isResolved: false
      });
    }
  });

  return results;
}

// ═══════════════════════════════════════════════
// 6. 엑셀 파일 파싱 (XLSX / XLS)
// ═══════════════════════════════════════════════

export async function parseExcelBankStatement(file: File): Promise<AuditTransactionItem[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const results: AuditTransactionItem[] = [];

  for (let r = 1; r < jsonData.length; r++) {
    const row = jsonData[r];
    if (!row || row.length === 0) continue;

    const rowText = row.map(cell => String(cell || '').trim()).join('\t');
    const parsed = parseRawBankStatementText(rowText);
    if (parsed.length > 0) {
      results.push(...parsed);
    }
  }

  return results;
}

// ═══════════════════════════════════════════════
// 7. 대법원 보정명령 규격 엑셀 내보내기 (XLSX)
// ═══════════════════════════════════════════════

export function exportAuditStatementToExcel(
  items: AuditTransactionItem[],
  clientName: string = '신청인',
  caseNumber: string = '2026개회 108492호',
  thresholdAmount: number = 500000
) {
  const targetItems = items.filter(i => i.amount >= thresholdAmount);

  // 헤더 및 메타데이터
  const titleRow = [`[별지] 통장 및 신용카드 거래내역 소명서 (${thresholdAmount.toLocaleString()}원 이상 사용처)`];
  const metaRow1 = [`사건번호: ${caseNumber}`, '', `신청인(채무자): ${clientName}`];
  const metaRow2 = [`총 소명 대상: ${targetItems.length}건`, '', `작성일자: ${new Date().toLocaleDateString('ko-KR')}`];
  const emptyRow = [''];

  const headerRow = [
    '연번',
    '거래일자',
    '금융기관/계좌',
    '구분',
    '상대방(가맹점)',
    '거래금액(원)',
    '위험구분',
    '구체적 사용처 소명내용 (법원제출)',
    '소명자료(증빙)'
  ];

  const dataRows = targetItems.map((item, idx) => [
    idx + 1,
    item.date,
    item.bankOrCard,
    item.transactionType === 'WITHDRAWAL' ? '출금' : 
    item.transactionType === 'CARD_PAYMENT' ? '카드결제' : 
    item.transactionType === 'ATM_CASH' ? 'ATM현금' : '입금',
    item.counterparty,
    item.amount,
    item.riskBadgeText,
    item.explanation || '(미작성)',
    item.evidenceType || '영수증/이체증'
  ]);

  const allRows = [titleRow, metaRow1, metaRow2, emptyRow, headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // 셀 너비 지정
  ws['!cols'] = [
    { wch: 6 },  // 연번
    { wch: 12 }, // 일자
    { wch: 22 }, // 금융사
    { wch: 10 }, // 구분
    { wch: 22 }, // 상대방
    { wch: 14 }, // 금액
    { wch: 18 }, // 위험구분
    { wch: 45 }, // 소명내용
    { wch: 20 }  // 소명자료
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '거래내역소명서');

  XLSX.writeFile(wb, `${clientName}_${thresholdAmount / 10000}만원이상_통장소명서.xlsx`);
}
