/**
 * 부채증명서 발급 대행 실무 7대 검증 룰 엔진 & 의뢰인 입력 데이터 변환 서비스
 * 
 * 실무 메모 7대 규칙:
 * 1. 국민·우리·신한·하나은행: 은행과 카드사 분리 발급 (각 1건씩 총 2건)
 * 2. 농협: NH농협은행(중앙회) vs 지역단위농협 구분 (단위농협/카드는 지점명 필수)
 * 3. 새마을금고 / 신협 / 미소금융: 지점명(법인명) 필수
 * 4. 신용보증재단: 지역재단(17개 시도) vs 단독 중앙회 구분
 * 5. 소상공인시장진흥공단: 전국 단독 발급 가능
 * 6. 자가(주택) 담보: 오케이·페퍼저축은행 인가 후 경매 리스크 방어 플래그
 * 7. 차량 담보: 오케이저축은행 차량 공매 리스크 방어 플래그
 */

import type { DebtCertificateItem, DebtAgencyCreditorRow } from './repaymentTypes';
import { matchCreditorPreset } from '../court/creditorAddressDirectory';

// ── 금융기관 분류 카테고리 ──
export type CreditorCategoryType = 
  | 'BANK'          // 1금융 시중은행
  | 'CARD_CAPITAL'  // 전업 카드사 및 캐피탈
  | 'SAVINGS_BANK'  // 상호저축은행
  | 'MUTUAL_FINANCE'// 상호금융 (새마을금고, 신협, 단위농축협 등)
  | 'PUBLIC_POLICY' // 공공·보증·정책기관 (신보, 소진공, 서민금융 등)
  | 'LOAN_OTHER';   // 대부업체 및 개인사채

// ── 담보 유형 ──
export type DebtCollateralType = 
  | 'NONE'        // 신용대출
  | 'HOUSING'     // 자가(주택/아파트/빌라) 담보대출
  | 'VEHICLE'     // 차량(자동차/중장비) 담보대출
  | 'DEPOSIT'     // 전세보증금/예적금 담보
  | 'OTHER';      // 기타 물상담보

// ── 고객 모바일 입력 원천 항목 모델 ──
export interface ClientDebtIntakeEntry {
  id: string;
  category: CreditorCategoryType;
  institutionName: string;         // 대표 기관명 (예: 국민은행, 농협, 오케이저축은행)
  
  // Rule 1: 4대 은행 카드 분리 여부
  hasSeparateCreditCard?: boolean; // 카드 결제대금 잔여 여부 (체크 시 2건 분리)

  // Rule 2 & 3: 농협 구분 및 지점명
  nonghyupType?: 'CENTRAL' | 'LOCAL'; // 중앙회 vs 지역단위농협
  branchName?: string;             // 지점명 (단위농협, 새마을금고, 신협 등 필수)

  // Rule 4: 신용보증재단 지역
  guaranteeRegion?: string;        // 서울, 경기, 인천, 부산 등

  // Rule 6 & 7: 담보 유형 및 위험 관리
  collateralType: DebtCollateralType;
  
  // 금액 및 참고사항
  estimatedAmount?: number;        // 대략적인 채무액 (선택)
  accountNumberSnippet?: string;   // 계좌번호 끝자리 또는 대출번호 (선택)
  userMemo?: string;               // 고객 작성 메모
}

// ── 고객 입력 전체 패키지 ──
export interface ClientDebtIntakePayload {
  clientId: string;
  clientName: string;
  clientPhone: string;
  submittedAt: string;
  entries: ClientDebtIntakeEntry[];
  confirmedByClient: boolean;
}

// ── 4대 시중은행 목록 (Rule 1 대상) ──
export const MAJOR_4_BANKS = [
  { bankName: '국민은행', cardName: 'KB국민카드', label: 'KB국민은행' },
  { bankName: '신한은행', cardName: '신한카드', label: '신한은행' },
  { bankName: '우리은행', cardName: '우리카드', label: '우리은행' },
  { bankName: '하나은행', cardName: '하나카드', label: '하나은행' },
];

// ── 신용보증재단 17개 지역 재단 목록 ──
export const REGIONAL_CREDIT_GUARANTEE_REGIONS = [
  '서울신용보증재단', '경기신용보증재단', '인천신용보증재단', '부산신용보증재단',
  '대구신용보증재단', '대전신용보증재단', '광주신용보증재단', '울산신용보증재단',
  '강원신용보증재단', '충북신용보증재단', '충남신용보증재단', '전북신용보증재단',
  '전남신용보증재단', '경북신용보증재단', '경남신용보증재단', '제주신용보증재단', '세종신용보증재단'
];

// ── 자주 찾는 대표 금융사 프리셋 ──
export const POPULAR_CREDITORS_PRESET: { name: string; category: CreditorCategoryType; ruleNotice?: string }[] = [
  { name: '국민은행', category: 'BANK', ruleNotice: '대출과 카드 결제대금은 별도 분리 발급됩니다.' },
  { name: '신한은행', category: 'BANK', ruleNotice: '대출과 카드 결제대금은 별도 분리 발급됩니다.' },
  { name: '우리은행', category: 'BANK', ruleNotice: '대출과 카드 결제대금은 별도 분리 발급됩니다.' },
  { name: '하나은행', category: 'BANK', ruleNotice: '대출과 카드 결제대금은 별도 분리 발급됩니다.' },
  { name: '농협', category: 'BANK', ruleNotice: '중앙회(NH농협은행)와 지역단위농협을 구분해야 합니다.' },
  { name: 'IBK기업은행', category: 'BANK' },
  { name: '카카오뱅크', category: 'BANK' },
  { name: '토스뱅크', category: 'BANK' },
  { name: '케이뱅크', category: 'BANK' },
  { name: '새마을금고', category: 'MUTUAL_FINANCE', ruleNotice: '대출받으신 지점명(법인명)을 알아야 발급 가능합니다.' },
  { name: '신협', category: 'MUTUAL_FINANCE', ruleNotice: '대출받으신 지점명(법인명)을 알아야 발급 가능합니다.' },
  { name: '수협은행/수협', category: 'MUTUAL_FINANCE' },
  { name: '미소금융', category: 'MUTUAL_FINANCE', ruleNotice: '지원받으신 재단 지점명을 알아야 합니다.' },
  { name: 'OK저축은행', category: 'SAVINGS_BANK', ruleNotice: '자가/차량 담보 대출의 경우 경매·공매 주의 플래그가 적용됩니다.' },
  { name: '페퍼저축은행', category: 'SAVINGS_BANK', ruleNotice: '자가 담보 대출의 경우 경매 주의 플래그가 적용됩니다.' },
  { name: '웰컴저축은행', category: 'SAVINGS_BANK' },
  { name: 'SBI저축은행', category: 'SAVINGS_BANK' },
  { name: '한국투자저축은행', category: 'SAVINGS_BANK' },
  { name: '현대캐피탈', category: 'CARD_CAPITAL' },
  { name: 'KB캐피탈', category: 'CARD_CAPITAL' },
  { name: '하나캐피탈', category: 'CARD_CAPITAL' },
  { name: '현대카드', category: 'CARD_CAPITAL' },
  { name: '삼성카드', category: 'CARD_CAPITAL' },
  { name: '롯데카드', category: 'CARD_CAPITAL' },
  { name: '신용보증재단', category: 'PUBLIC_POLICY', ruleNotice: '사업장/주소지 관할 지역재단 이름을 선택해야 합니다.' },
  { name: '신용보증재단중앙회', category: 'PUBLIC_POLICY', ruleNotice: '지역 구분 없는 단독 중앙회입니다.' },
  { name: '소상공인시장진흥공단', category: 'PUBLIC_POLICY', ruleNotice: '지역 구분 없이 단독 발급 가능합니다.' },
  { name: '서민금융진흥원 (햇살론)', category: 'PUBLIC_POLICY' },
  { name: '신용보증기금 (신보)', category: 'PUBLIC_POLICY' },
  { name: '기술보증기금 (기보)', category: 'PUBLIC_POLICY' },
  { name: '리드코프', category: 'LOAN_OTHER' },
  { name: '러시앤캐시 (아프로파이낸셜)', category: 'LOAN_OTHER' },
  { name: '산와머니 (산와대부)', category: 'LOAN_OTHER' },
  { name: '바로크레디트대부 (바로300)', category: 'LOAN_OTHER' },
  { name: '태강대부 (캐시앤원)', category: 'LOAN_OTHER' },
  { name: '에이원대부캐피탈', category: 'LOAN_OTHER' },
  { name: '유미캐피탈대부', category: 'LOAN_OTHER' },
  { name: '골든캐피탈대부', category: 'LOAN_OTHER' },
  { name: '밀리언캐쉬대부', category: 'LOAN_OTHER' },
  { name: '스타크레디트대부', category: 'LOAN_OTHER' },
  { name: '엠에스아이대부', category: 'LOAN_OTHER' },
  { name: '앤알캐피탈대부', category: 'LOAN_OTHER' },
  { name: '케이엠파이낸셜대부', category: 'LOAN_OTHER' },
  { name: '콜렉트대부', category: 'LOAN_OTHER' },
];

// ── 로컬 스토리지 키 ──
const STORAGE_PREFIX = 'LEGAL_CRM_DEBT_INTAKE_';

export class DebtIntakeRuleService {
  /**
   * 의뢰인이 제출한 부채 입력 데이터 로드
   */
  static getClientIntake(clientId: string): ClientDebtIntakePayload | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${clientId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * 의뢰인 부채 입력 데이터 저장
   */
  static saveClientIntake(payload: ClientDebtIntakePayload): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${payload.clientId}`, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save debt intake payload', e);
    }
  }

  /**
   * 7대 실무 규칙 엔진을 적용하여, 고객 응답 항목을 변호사 어드민용 DebtAgencyCreditorRow[] 목록으로 변환
   */
  static convertIntakeToAgencyCreditorRows(entries: ClientDebtIntakeEntry[]): DebtAgencyCreditorRow[] {
    const rows: DebtAgencyCreditorRow[] = [];

    for (const entry of entries) {
      const trimmedName = entry.institutionName.trim();
      const branchPart = entry.branchName?.trim() ? ` (${entry.branchName.trim()})` : '';

      // ── [Rule 1] 4대 시중은행 카드 분리 발급 체크 ──
      const majorBankMatch = MAJOR_4_BANKS.find(b => 
        trimmedName.includes(b.bankName) || trimmedName === b.bankName
      );

      if (majorBankMatch) {
        // 1-1. 은행 본체 행
        rows.push({
          id: `row_${entry.id}_bank`,
          creditorName: `${majorBankMatch.bankName}${branchPart}`,
          requestDebtCert: true,
          requestCardHistory: false,
          requestBankHistory: true,
          note: entry.collateralType !== 'NONE' ? `[담보: ${this.getCollateralLabel(entry.collateralType)}]` : '',
        });

        // 1-2. 카드 결제대금 분리 요청 체크 시 카드사 독립 행 자동 생성
        if (entry.hasSeparateCreditCard) {
          rows.push({
            id: `row_${entry.id}_card`,
            creditorName: majorBankMatch.cardName,
            requestDebtCert: true,
            requestCardHistory: true,
            requestBankHistory: false,
            note: '★ 4대은행 카드사 분리 발급 건 (결제대금 잔여)',
          });
        }
        continue;
      }

      // ── [Rule 2] 농협 (NH농협은행 중앙회 vs 지역단위농협) ──
      if (trimmedName.includes('농협') || trimmedName === '농협' || trimmedName === 'NH농협') {
        const isLocal = entry.nonghyupType === 'LOCAL';
        const finalName = isLocal 
          ? `지역농협${branchPart || ' (지점확인요망)'}` 
          : `NH농협은행${branchPart}`;

        let nonghyupNote = isLocal ? '★ 지역단위농협 (지점확인 필수)' : 'NH농협은행 중앙회';
        if (entry.hasSeparateCreditCard) {
          nonghyupNote += ' / 농협카드 분리발급 필요';
        }

        rows.push({
          id: `row_${entry.id}`,
          creditorName: finalName,
          requestDebtCert: true,
          requestCardHistory: !!entry.hasSeparateCreditCard,
          requestBankHistory: true,
          note: nonghyupNote,
        });

        if (entry.hasSeparateCreditCard) {
          rows.push({
            id: `row_${entry.id}_card`,
            creditorName: `NH농협카드${branchPart ? ` (${entry.branchName})` : ''}`,
            requestDebtCert: true,
            requestCardHistory: true,
            requestBankHistory: false,
            note: '★ 농협카드 분리 발급 (단위/중앙 지점 매핑)',
          });
        }
        continue;
      }

      // ── [Rule 3] 새마을금고 / 신협 / 미소금융 (지점명 필수 결합) ──
      if (
        trimmedName.includes('새마을금고') || 
        trimmedName.includes('신협') || 
        trimmedName.includes('신용협동조합') ||
        trimmedName.includes('미소금융')
      ) {
        rows.push({
          id: `row_${entry.id}`,
          creditorName: `${trimmedName}${branchPart}`,
          requestDebtCert: true,
          requestCardHistory: false,
          requestBankHistory: true,
          note: entry.branchName ? `지점명 확인됨: ${entry.branchName}` : '⚠️ 지점명 필수 확인 요망 (독립법인)',
        });
        continue;
      }

      // ── [Rule 4] 신용보증재단 (지역재단 vs 중앙회) ──
      if (trimmedName.includes('신용보증재단') || trimmedName.includes('신보재단')) {
        if (trimmedName.includes('중앙회')) {
          rows.push({
            id: `row_${entry.id}`,
            creditorName: '신용보증재단중앙회',
            requestDebtCert: true,
            requestCardHistory: false,
            requestBankHistory: false,
            note: '중앙회 단독 발급',
          });
        } else {
          const regionName = entry.guaranteeRegion || '지역확인요망';
          rows.push({
            id: `row_${entry.id}`,
            creditorName: regionName.includes('신용보증재단') ? regionName : `${regionName}신용보증재단`,
            requestDebtCert: true,
            requestCardHistory: false,
            requestBankHistory: false,
            note: `지역 관할 재단: ${regionName}`,
          });
        }
        continue;
      }

      // ── [Rule 5] 소상공인시장진흥공단 ──
      if (trimmedName.includes('소상공인') || trimmedName.includes('소진공')) {
        rows.push({
          id: `row_${entry.id}`,
          creditorName: '소상공인시장진흥공단',
          requestDebtCert: true,
          requestCardHistory: false,
          requestBankHistory: false,
          note: '전국 통합 전산 단독 발급',
        });
        continue;
      }

      // ── [Rule 6 & 7] 저축은행 자가/차량 담보 리스크 플래그 ──
      let riskNote = '';
      if (trimmedName.includes('OK저축') || trimmedName.includes('오케이저축')) {
        if (entry.collateralType === 'HOUSING') {
          riskNote = '🚨 [경매주의] 오케이저축 자가담보: 인가 후 경매 사례 다수 (부채발급 제외/별제권 협의 검토)';
        } else if (entry.collateralType === 'VEHICLE') {
          riskNote = '🚨 [차량공매주의] 오케이저축 차량담보: 공매 사례 발생 (신복/새출발 제외 검토 or 완납안내)';
        }
      } else if (trimmedName.includes('페퍼저축')) {
        if (entry.collateralType === 'HOUSING') {
          riskNote = '🚨 [경매주의] 페퍼저축 자가담보: 인가 후 경매 사례 다수 (부채발급 제외/별제권 협의 검토)';
        }
      }

      // 기본 채권사 처리
      rows.push({
        id: `row_${entry.id}`,
        creditorName: `${trimmedName}${branchPart}`,
        requestDebtCert: true,
        requestCardHistory: entry.category === 'CARD_CAPITAL',
        requestBankHistory: entry.category === 'BANK' || entry.category === 'MUTUAL_FINANCE',
        note: riskNote || (entry.userMemo ? `메모: ${entry.userMemo}` : ''),
      });
    }

    return rows;
  }

  /**
   * 고객 입력 항목을 부채증명서 관리 상세 아이템 (DebtCertificateItem[])으로 변환
   */
  static convertIntakeToDebtCertificateItems(entries: ClientDebtIntakeEntry[]): DebtCertificateItem[] {
    const rows = this.convertIntakeToAgencyCreditorRows(entries);
    
    return rows.map((row, idx) => {
      const preset = matchCreditorPreset(row.creditorName);
      const isSecured = row.note?.includes('담보') || row.note?.includes('경매');

      return {
        id: `debt_item_${Date.now()}_${idx}`,
        creditorName: row.creditorName,
        expectedPrincipal: 0,
        issueStatus: 'pending',
        agencyFee: 15000,
        issuanceFee: 2000,
        memo: row.note,
        isSecured,
        zipCode: preset?.zipCode,
        address: preset?.address,
        serviceAddress: preset?.serviceAddress,
        representative: preset?.representative,
        bizNumber: preset?.bizNumber,
      };
    });
  }

  /**
   * 담보 유형 텍스트
   */
  static getCollateralLabel(type: DebtCollateralType): string {
    switch (type) {
      case 'HOUSING': return '주택/자가 담보';
      case 'VEHICLE': return '차량/오토 담보';
      case 'DEPOSIT': return '전세/임차보증금 담보';
      case 'OTHER': return '기타 물상 담보';
      default: return '신용대출';
    }
  }

  /**
   * 고객에게 발송할 카카오톡 알림톡 안내문 생성
   */
  static generateIntakeNotificationMessage(clientName: string, lawFirmName: string = '법률사무소', intakeUrl?: string): string {
    const safeUrl = intakeUrl || 'https://legal-crm-xi.vercel.app/client/debt-intake';
    return `[${lawFirmName}] 부채증명서 신속 발급을 위한 금융사 세부 확인 요청

${clientName}님, 보내주신 1차 서류(인감 등) 수령 후 각 금융기관 부채증명서 발급 대행을 준비 중입니다.

금융기관의 정확한 부채증명서 발급을 위해 아래 항목의 세부 확인이 반드시 필요합니다:
1. 국민·우리·신한·하나은행: 신용카드 결제대금 분리 여부
2. 농협: 중앙회(NH농협은행) vs 지역단위농협 및 지점명
3. 새마을금고 / 신협: 대출받으신 지점명(법인명)
4. 주택/차량 담보 대출 여부

스마트폰에서 3분 만에 간편하게 확인하실 수 있으니 아래 링크를 눌러 입력해 주시기 바랍니다.

▶ 부채증명 금융사 세부확인 링크:
${safeUrl}

※ 문의사항은 사무소로 편하게 연락주시기 바랍니다.`;
  }
}
