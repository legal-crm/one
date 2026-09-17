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
  AuditSummaryStats,
  BankStatementAuditData
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
    { date: '2025-08-04', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '주식회사 두나무(업비트)', amount: 1500000, bal: 320000, expl: '코인 거래소 투자금 입금 (손실 발생하여 청산가치 제외 소명서 제출)', docIdx: '소갑 제3호증의 1' },
    { date: '2025-08-10', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '이마트 양재점', amount: 385000, bal: 2150000, expl: '4인 가족 1개월 생필품 및 식료품 구입', docIdx: '소갑 제3호증의 2' },
    { date: '2025-08-14', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '쿠팡 결제', amount: 492000, bal: 0, expl: '미성년 자녀 하계 의류 및 학습교재 구매', docIdx: '소갑 제3호증의 3' },
    { date: '2025-08-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 1500000, expl: '거주지 월 차임(월세) 정기 납부', docIdx: '소갑 제3호증의 4' },
    { date: '2025-08-28', bank: 'KB국민은행 (128-***-991)', type: 'ATM_CASH', name: '국민은행ATM 현금출금', amount: 500000, bal: 1000000, expl: '전통시장 장보기 및 자녀 소액 교통비/식비 현금 지출', docIdx: '소갑 제3호증의 5' },
    { date: '2025-09-02', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '현대캐피탈 대출상환', amount: 890000, bal: 110000, expl: '', docIdx: '' },
    { date: '2025-09-08', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '빗썸코리아', amount: 2000000, bal: 450000, expl: '', docIdx: '' },
    { date: '2025-09-15', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '홍길동(모친 생활비)', amount: 800000, bal: 1200000, expl: '', docIdx: '' },
    { date: '2025-09-20', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '서울대병원 원무과', amount: 1250000, bal: 0, expl: '배우자 정밀건강검진 및 관절염 수술비 결제', docIdx: '소갑 제3호증의 6' },
    { date: '2025-09-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 550000, expl: '', docIdx: '' },
    { date: '2025-10-03', bank: 'KB국민은행 (128-***-991)', type: 'ATM_CASH', name: 'CD기 현금인출', amount: 1200000, bal: 300000, expl: '', docIdx: '' },
    { date: '2025-10-12', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '강남 골든유흥주점', amount: 620000, bal: 0, expl: '', docIdx: '' },
    { date: '2025-10-18', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '홈플러스 강동점', amount: 310000, bal: 800000, expl: '', docIdx: '' },
    { date: '2025-10-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 150000, expl: '', docIdx: '' },
    { date: '2025-11-05', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '신한저축은행 대환상환', amount: 3500000, bal: 400000, expl: '기존 고금리 저축은행 대출 연체 방지 대환 상환 (재산은닉 없음)', docIdx: '소갑 제3호증의 7' },
    { date: '2025-11-12', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '쿠팡 생활가전', amount: 480000, bal: 0, expl: '', docIdx: '' },
    { date: '2025-11-20', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '김철수(지인 차용금변제)', amount: 1200000, bal: 200000, expl: '', docIdx: '' },
    { date: '2025-11-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 1200000, expl: '', docIdx: '' },
    { date: '2025-12-02', bank: 'KB국민은행 (128-***-991)', type: 'ATM_CASH', name: '국민은행ATM 현금출금', amount: 1000000, bal: 700000, expl: '', docIdx: '' },
    { date: '2025-12-10', bank: '신한카드 (4518-****)', type: 'CARD_PAYMENT', name: '롯데마트 의왕점', amount: 340000, bal: 0, expl: '', docIdx: '' },
    { date: '2025-12-18', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '서울아산병원 검사비', amount: 780000, bal: 420000, expl: '', docIdx: '' },
    { date: '2025-12-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 900000, expl: '', docIdx: '' },
    { date: '2026-01-08', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '주식회사 빗썸', amount: 1800000, bal: 100000, expl: '', docIdx: '' },
    { date: '2026-01-15', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '홍길동(모친 병원비)', amount: 1100000, bal: 1500000, expl: '', docIdx: '' },
    { date: '2026-01-25', bank: 'KB국민은행 (128-***-991)', type: 'WITHDRAWAL', name: '임대인 박종현(월세)', amount: 650000, bal: 850000, expl: '', docIdx: '' }
  ];

  return rawList.map((item, idx) => {
    const classification = classifyTransactionRisk(item.name, item.type as AuditTransactionType, item.amount);
    const hasCustomExpl = item.expl && item.expl.length > 0;
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
      explanation: hasCustomExpl ? item.expl : '',
      evidenceType: hasCustomExpl ? classification.defaultEvidence : '',
      isResolved: Boolean(hasCustomExpl),
      evidenceDocIndex: item.docIdx || undefined,
      status: hasCustomExpl ? 'lawyer_approved' : 'draft',
      clientNote: '',
      lawyerReviewNote: ''
    };
  });
}

// ═══════════════════════════════════════════════
// 4. 통계 집계 계산기
// ═══════════════════════════════════════════════

export function calculateAuditStats(
  items: AuditTransactionItem[],
  thresholdAmount: number = 1000000
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

export function parseRawBankStatementText(text: string, filterThreshold: number = 0): AuditTransactionItem[] {
  const lines = text.trim().split(/\r?\n/);
  const results: AuditTransactionItem[] = [];

  lines.forEach((line, idx) => {
    // 쉼표 또는 탭 또는 다중 공백 분리
    const tokens = line.split(/[,\t|]/).map(t => t.trim()).filter(Boolean);
    if (tokens.length < 3) return;

    // 간단한 날짜 패턴 검출 (예: 2025-08-10, 2025.08.10, 2025/08/10, 20250810)
    const dateMatch = tokens[0].match(/\d{4}[-./]?\d{1,2}[-./]?\d{1,2}/);
    let date = new Date().toISOString().split('T')[0];
    if (dateMatch) {
      const raw = dateMatch[0].replace(/[/.]/g, '-');
      if (raw.length === 8 && !raw.includes('-')) {
        date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      } else {
        date = raw;
      }
    }

    // 금액 찾기 (숫자와 콤마로 이루어진 토큰)
    let amount = 0;
    let counterparty = tokens[1] || '거래처 불명';

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

    if (amount > 0 && (filterThreshold === 0 || amount >= filterThreshold)) {
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
        isResolved: false,
        status: 'draft'
      });
    }
  });

  return results;
}

// ═══════════════════════════════════════════════
// 6. 엑셀 파일 파싱 (XLSX / XLS)
// ═══════════════════════════════════════════════

export async function parseExcelBankStatement(file: File, filterThreshold: number = 0): Promise<AuditTransactionItem[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (!jsonData || jsonData.length === 0) return [];

  // 은행 엑셀 컬럼 헤더 자동 탐색
  let headerRowIndex = -1;
  let dateCol = -1;
  let withdrawCol = -1;
  let counterpartyCol = -1;
  let balanceCol = -1;

  for (let r = 0; r < Math.min(jsonData.length, 15); r++) {
    const row = jsonData[r];
    if (!row || !Array.isArray(row)) continue;
    const strRow = row.map(c => String(c || '').trim());

    for (let c = 0; c < strRow.length; c++) {
      const val = strRow[c];
      if (/거래일|일자|거래일시|날짜/i.test(val) && dateCol === -1) dateCol = c;
      if (/출금|지급|출금액|지급액|이용금액|결제금액/i.test(val) && withdrawCol === -1) withdrawCol = c;
      if (/적요|내용|기재내용|상대방|가맹점|거래내용|수취인/i.test(val) && counterpartyCol === -1) counterpartyCol = c;
      if (/잔액|거래후잔액/i.test(val) && balanceCol === -1) balanceCol = c;
    }

    if (dateCol !== -1 && (withdrawCol !== -1 || counterpartyCol !== -1)) {
      headerRowIndex = r;
      break;
    }
  }

  const results: AuditTransactionItem[] = [];

  // 구조 파악 성공한 경우 컬럼 매핑 파싱
  if (headerRowIndex !== -1 && withdrawCol !== -1) {
    for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!row || row.length === 0) continue;

      const rawDate = String(row[dateCol] || '').trim();
      const rawWithdraw = String(row[withdrawCol] || '').replace(/[^0-9]/g, '');
      const rawCounterparty = counterpartyCol !== -1 ? String(row[counterpartyCol] || '').trim() : '불명 거래';
      const rawBalance = balanceCol !== -1 ? String(row[balanceCol] || '').replace(/[^0-9]/g, '') : undefined;

      const amount = parseInt(rawWithdraw, 10);
      if (!isNaN(amount) && amount > 0) {
        if (filterThreshold > 0 && amount < filterThreshold) continue;

        let date = rawDate;
        if (rawDate.length === 8 && !rawDate.includes('-') && !rawDate.includes('.')) {
          date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
        } else {
          date = rawDate.replace(/[/.]/g, '-').slice(0, 10);
        }

        const classification = classifyTransactionRisk(rawCounterparty, 'WITHDRAWAL', amount);
        results.push({
          id: `excel-${Date.now()}-${r}`,
          date: date || new Date().toISOString().split('T')[0],
          bankOrCard: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || '금융기관',
          transactionType: 'WITHDRAWAL',
          counterparty: rawCounterparty || '거래처 불명',
          amount,
          balance: rawBalance ? parseInt(rawBalance, 10) : undefined,
          riskCategory: classification.category,
          riskBadgeText: classification.badgeText,
          riskAdvice: classification.advice,
          explanation: '',
          evidenceType: classification.defaultEvidence,
          isResolved: false,
          status: 'draft'
        });
      }
    }
  } else {
    // 구조 파악 안 되는 경우 줄 단위 유연 파싱
    for (let r = 1; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!row || row.length === 0) continue;
      const rowText = row.map(cell => String(cell || '').trim()).join('\t');
      const parsed = parseRawBankStatementText(rowText, filterThreshold);
      if (parsed.length > 0) {
        results.push(...parsed);
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════
// 7. 대법원 전자소송 규격 표준 엑셀 생성 및 다운로드 (.XLSX)
// ═══════════════════════════════════════════════

export interface CourtExcelOptions {
  clientName?: string;
  caseNumber?: string;
  courtName?: string;
  thresholdAmount?: number;
}

export function exportToCourtStandardExcel(
  items: AuditTransactionItem[],
  options: CourtExcelOptions = {}
) {
  const {
    clientName = '신청인',
    caseNumber = '2026개회 108492호',
    courtName = '서울회생법원',
    thresholdAmount = 1000000
  } = options;

  const targetItems = items.filter(i => i.amount >= thresholdAmount);
  const totalAmount = targetItems.reduce((acc, curr) => acc + curr.amount, 0);

  // 셀 공통 스타일
  const fontMain = { name: '맑은 고딕', sz: 10, color: { rgb: '1E293B' } };
  const borderThin = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  };

  const headerStyle = {
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'E2E8F0' } }, // 슬레이트 200
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'medium', color: { rgb: '475569' } },
      bottom: { style: 'medium', color: { rgb: '475569' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  };

  // 워크시트 데이터 구성
  const aoaData: any[][] = [];

  // [1] 대제목 행
  aoaData.push([
    {
      v: `[별지] 금융거래내역 중 ${thresholdAmount >= 1000000 ? `${thresholdAmount / 10000}만 원` : `${thresholdAmount.toLocaleString()}원`} 이상 출금 사용처 소명서`,
      t: 's',
      s: {
        font: { name: '맑은 고딕', sz: 15, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    }
  ]);

  // [2] 빈 행
  aoaData.push([]);

  // [3] 메타데이터 행 (사건번호, 관할법원, 신청인)
  aoaData.push([
    { v: `사건번호 : ${caseNumber}`, t: 's', s: { font: { ...fontMain, bold: true } } },
    '',
    '',
    '',
    { v: `관할법원 : ${courtName}`, t: 's', s: { font: fontMain } },
    '',
    '',
    { v: `신청인(채무자) : ${clientName}`, t: 's', s: { font: { ...fontMain, bold: true } } },
    ''
  ]);

  // [4] 작성 기준일 및 통계
  aoaData.push([
    { v: `소명 대상 : 총 ${targetItems.length}건 (총 출금액: ${totalAmount.toLocaleString()}원)`, t: 's', s: { font: fontMain } },
    '',
    '',
    '',
    '',
    '',
    '',
    { v: `작성일자 : ${new Date().toLocaleDateString('ko-KR')}`, t: 's', s: { font: fontMain, alignment: { horizontal: 'right' } } },
    ''
  ]);

  // [5] 테이블 헤더 행
  const headers = [
    '연번',
    '거래일자',
    '금융기관 및 계좌',
    '거래구분',
    '거래상대방(적요)',
    '출금·결제금액(원)',
    '구체적 사용처 소명내용 (법원 제출용)',
    '소명자료(증빙)',
    '입증방법'
  ];

  aoaData.push(
    headers.map(h => ({
      v: h,
      t: 's',
      s: headerStyle
    }))
  );

  // [6] 데이터 행
  targetItems.forEach((item, idx) => {
    const isEven = idx % 2 === 1;
    const rowBg = isEven ? { fgColor: { rgb: 'F8FAFC' } } : undefined;

    const rowCells = [
      // 연번
      {
        v: idx + 1,
        t: 'n',
        s: { font: fontMain, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin, fill: rowBg }
      },
      // 거래일자
      {
        v: item.date,
        t: 's',
        s: { font: fontMain, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin, fill: rowBg }
      },
      // 금융기관
      {
        v: item.bankOrCard,
        t: 's',
        s: { font: fontMain, alignment: { horizontal: 'left', vertical: 'center' }, border: borderThin, fill: rowBg }
      },
      // 거래구분
      {
        v: item.transactionType === 'WITHDRAWAL' ? '계좌출금' : 
           item.transactionType === 'CARD_PAYMENT' ? '카드결제' : 
           item.transactionType === 'ATM_CASH' ? 'ATM현금' : '입금',
        t: 's',
        s: { font: fontMain, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin, fill: rowBg }
      },
      // 상대방
      {
        v: item.counterparty,
        t: 's',
        s: { font: fontMain, alignment: { horizontal: 'left', vertical: 'center' }, border: borderThin, fill: rowBg }
      },
      // 금액
      {
        v: item.amount,
        t: 'n',
        z: '#,##0',
        s: { font: { ...fontMain, bold: true }, alignment: { horizontal: 'right', vertical: 'center' }, border: borderThin, fill: rowBg }
      },
      // 구체적 사용처 소명내용
      {
        v: item.explanation || '(작성 대기 중 - 생활필수 경비 충당)',
        t: 's',
        s: { font: fontMain, alignment: { horizontal: 'left', vertical: 'center', wrapText: true }, border: borderThin, fill: rowBg }
      },
      // 소명자료
      {
        v: item.evidenceType || '이체확인증 / 영수증',
        t: 's',
        s: { font: fontMain, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin, fill: rowBg }
      },
      // 입증방법 (소갑호증)
      {
        v: item.evidenceDocIndex || `소갑 제3호증의 ${idx + 1}`,
        t: 's',
        s: { font: { ...fontMain, color: { rgb: '2563EB' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderThin, fill: rowBg }
      }
    ];

    aoaData.push(rowCells);
  });

  // [7] 합계 행
  aoaData.push([
    {
      v: '합 계',
      t: 's',
      s: {
        font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        border: {
          top: { style: 'medium', color: { rgb: '475569' } },
          bottom: { style: 'medium', color: { rgb: '475569' } },
          left: { style: 'thin', color: { rgb: 'CBD5E1' } },
          right: { style: 'thin', color: { rgb: 'CBD5E1' } }
        }
      }
    },
    { v: '', t: 's', s: { fill: { fgColor: { rgb: 'F1F5F9' } }, border: borderThin } },
    { v: '', t: 's', s: { fill: { fgColor: { rgb: 'F1F5F9' } }, border: borderThin } },
    { v: '', t: 's', s: { fill: { fgColor: { rgb: 'F1F5F9' } }, border: borderThin } },
    {
      v: `총 ${targetItems.length}건`,
      t: 's',
      s: {
        font: { ...fontMain, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        border: borderThin
      }
    },
    {
      v: totalAmount,
      t: 'n',
      z: '#,##0',
      s: {
        font: { name: '맑은 고딕', sz: 10.5, bold: true, color: { rgb: '1E3A8A' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        border: {
          top: { style: 'medium', color: { rgb: '475569' } },
          bottom: { style: 'medium', color: { rgb: '475569' } },
          left: { style: 'thin', color: { rgb: 'CBD5E1' } },
          right: { style: 'thin', color: { rgb: 'CBD5E1' } }
        }
      }
    },
    {
      v: '위 사용처는 사실과 다름없음을 확인합니다.',
      t: 's',
      s: { font: { ...fontMain, italic: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: borderThin }
    },
    { v: '', t: 's', s: { fill: { fgColor: { rgb: 'F1F5F9' } }, border: borderThin } },
    { v: '', t: 's', s: { fill: { fgColor: { rgb: 'F1F5F9' } }, border: borderThin } }
  ]);

  // 워크시트 생성
  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // 셀 병합 (Merges)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // 대제목 1~9열 병합
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }, // 사건번호 병합
    { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } }, // 관할법원 병합
    { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } }, // 신청인 병합
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } }, // 소명 대상 통계 병합
    { s: { r: 3, c: 7 }, e: { r: 3, c: 8 } }, // 작성일자 병합
    { s: { r: aoaData.length - 1, c: 0 }, e: { r: aoaData.length - 1, c: 3 } }, // 합계명 병합
    { s: { r: aoaData.length - 1, c: 6 }, e: { r: aoaData.length - 1, c: 8 } }  // 합계확인 병합
  ];

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 6 },  // 연번
    { wch: 13 }, // 거래일자
    { wch: 22 }, // 금융기관
    { wch: 11 }, // 거래구분
    { wch: 24 }, // 거래상대방
    { wch: 16 }, // 금액
    { wch: 48 }, // 소명내용
    { wch: 20 }, // 소명자료
    { wch: 16 }  // 입증방법
  ];

  // 행 높이 설정
  ws['!rows'] = [
    { hpt: 30 }, // 대제목
    { hpt: 10 },
    { hpt: 20 }, // 사건번호
    { hpt: 20 }, // 일자
    { hpt: 26 }  // 헤더
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '100만원이상_사용처소명서');

  const fileName = `[별지]_금융거래_${thresholdAmount >= 1000000 ? `${thresholdAmount / 10000}만원` : `${thresholdAmount}원`}이상_소명서_${clientName}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/** 하위 호환성 엑셀 함수 */
export function exportAuditStatementToExcel(
  items: AuditTransactionItem[],
  clientName: string = '신청인',
  caseNumber: string = '2026개회 108492호',
  thresholdAmount: number = 1000000
) {
  exportToCourtStandardExcel(items, { clientName, caseNumber, thresholdAmount });
}

// ═══════════════════════════════════════════════
// 8. 로컬 스토리지 실시간 동기화 엔진
// ═══════════════════════════════════════════════

const STORAGE_KEY_PREFIX = 'legal_crm_bank_audit_';

export function getStoredBankAuditData(
  clientId: string = 'client-default',
  clientName: string = '김채무'
): BankStatementAuditData {
  const key = `${STORAGE_KEY_PREFIX}${clientId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as BankStatementAuditData;
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load bank audit from localStorage', e);
  }

  // 기본 샘플 데이터셋 생성
  const sampleItems = generateSampleBankTransactions();
  const threshold = 1000000;
  const stats = calculateAuditStats(sampleItems, threshold);

  const initialData: BankStatementAuditData = {
    id: `audit-batch-${clientId}`,
    clientId,
    clientName,
    caseNumber: '2026개회 108492호',
    courtName: '서울회생법원',
    thresholdAmount: threshold,
    items: sampleItems,
    stats,
    status: 'draft',
    lastUpdatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(key, JSON.stringify(initialData));
  } catch (e) {
    // ignore
  }

  return initialData;
}

export function saveStoredBankAuditData(data: BankStatementAuditData): void {
  const key = `${STORAGE_KEY_PREFIX}${data.clientId}`;
  try {
    data.stats = calculateAuditStats(data.items, data.thresholdAmount || 1000000);
    data.lastUpdatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(data));

    // 실시간 동기화 브로드캐스트 이벤트 발행
    window.dispatchEvent(
      new CustomEvent('bank_audit_updated', {
        detail: { clientId: data.clientId, data }
      })
    );
  } catch (e) {
    console.error('Failed to save bank audit to localStorage', e);
  }
}

/** 고객이 변호사에게 소명표 최종 제출 */
export function submitBankAuditToLawyer(clientId: string): BankStatementAuditData {
  const current = getStoredBankAuditData(clientId);
  current.status = 'submitted';
  current.clientSubmittedAt = new Date().toISOString();
  // 100만 원 이상 건들의 상태도 submitted로 전환
  current.items = current.items.map(item => {
    if (item.amount >= current.thresholdAmount && item.isResolved) {
      return { ...item, status: 'submitted' };
    }
    return item;
  });
  saveStoredBankAuditData(current);
  return current;
}

/** 변호사가 의뢰인 소명표 검토 완료 및 법원 제출 승인 */
export function approveBankAuditByLawyer(clientId: string): BankStatementAuditData {
  const current = getStoredBankAuditData(clientId);
  current.status = 'lawyer_approved';
  current.lawyerReviewedAt = new Date().toISOString();
  // 소갑 제O호증 자동 채번 (번호가 없는 건에 순차 부여)
  let subIndex = 1;
  current.items = current.items.map(item => {
    if (item.amount >= current.thresholdAmount) {
      const docIdx = item.evidenceDocIndex || `소갑 제3호증의 ${subIndex++}`;
      return {
        ...item,
        status: 'lawyer_approved',
        evidenceDocIndex: docIdx
      };
    }
    return item;
  });
  saveStoredBankAuditData(current);
  return current;
}

