/**
 * feePresetService.ts
 * 
 * 변호사 사무실별 수임료 및 분납 조건 세팅(계약금, 착수금, 분납 방식, 회차, 납부일, 부가세, 서식 스타일)을
 * 프리셋(메모리)으로 저장하고 불러오는 서비스 모듈.
 */

export interface FeePreset {
  id: string;
  name: string;
  description?: string;
  isSystemDefault?: boolean; // 기본 내장 프리셋 여부 (삭제 불가)
  createdAt: string;

  // 수임료 설정 데이터
  hasDeposit: boolean;
  depositFee: number;
  retainerFee: number;
  vatIncluded: boolean;
  installmentMode: 'equal' | 'custom';
  monthlyFee: number;
  installmentMonths: number;
  customInstallments?: Array<{
    round: number;
    amount: number;
    dueDate: string;
    label: string;
  }>;
  paymentDayType: 'last_day' | 'fixed_10th' | 'fixed_25th';
  contractStyle: 'simple_box' | 'standard';
}

const STORAGE_KEY = 'legal_crm_fee_presets_v1';

/**
 * 실무 기본 프리셋 4종
 */
export const DEFAULT_FEE_PRESETS: FeePreset[] = [
  {
    id: 'preset-standard-300',
    name: '[실무 표준] 착수 100만 + 50만 × 4회 (총 300만)',
    description: '가장 널리 쓰이는 표준 4회 분납형 플랜',
    isSystemDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    hasDeposit: false,
    depositFee: 0,
    retainerFee: 1000000,
    vatIncluded: true,
    installmentMode: 'equal',
    monthlyFee: 500000,
    installmentMonths: 4,
    paymentDayType: 'last_day',
    contractStyle: 'simple_box',
  },
  {
    id: 'preset-deposit-split-330',
    name: '[가계약 분리] 계약 30만 + 착수 100만 + 50만 × 4회 (총 330만)',
    description: '계약금 30만원 별도 수납 후 착수금 및 잔금 4회 분납',
    isSystemDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    hasDeposit: true,
    depositFee: 300000,
    retainerFee: 1000000,
    vatIncluded: true,
    installmentMode: 'equal',
    monthlyFee: 500000,
    installmentMonths: 4,
    paymentDayType: 'last_day',
    contractStyle: 'simple_box',
  },
  {
    id: 'preset-custom-stepped-350',
    name: '[맞춤형 100+50] 착수 100만 + 1회차 100만 + 50만 × 3회 (총 350만)',
    description: '첫 달 분납금을 높이고 이후 부담을 낮춘 맞춤형 플랜',
    isSystemDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    hasDeposit: false,
    depositFee: 0,
    retainerFee: 1000000,
    vatIncluded: true,
    installmentMode: 'custom',
    monthlyFee: 500000,
    installmentMonths: 4,
    customInstallments: [
      { round: 1, amount: 1000000, dueDate: '', label: '1회차 분납' },
      { round: 2, amount: 500000, dueDate: '', label: '2회차 분납' },
      { round: 3, amount: 500000, dueDate: '', label: '3회차 분납' },
      { round: 4, amount: 500000, dueDate: '', label: '4회차 분납' },
    ],
    paymentDayType: 'last_day',
    contractStyle: 'simple_box',
  },
  {
    id: 'preset-light-5split-200',
    name: '[경량형 5회] 착수 50만 + 30만 × 5회 (총 200만)',
    description: '초기 비용 부담을 낮춘 소액 채무자 맞춤 장기 분납 플랜',
    isSystemDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    hasDeposit: false,
    depositFee: 0,
    retainerFee: 500000,
    vatIncluded: true,
    installmentMode: 'equal',
    monthlyFee: 300000,
    installmentMonths: 5,
    paymentDayType: 'fixed_25th',
    contractStyle: 'simple_box',
  },
];

/**
 * 모든 프리셋 조회 (시스템 기본 + 사용자 저장)
 */
export function getFeePresets(): FeePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FEE_PRESETS;
    }
    const userPresets: FeePreset[] = JSON.parse(raw);
    return [...DEFAULT_FEE_PRESETS, ...userPresets];
  } catch (err) {
    console.error('Failed to load fee presets:', err);
    return DEFAULT_FEE_PRESETS;
  }
}

/**
 * 새 프리셋 저장 (또는 덮어쓰기)
 */
export function saveFeePreset(presetData: Omit<FeePreset, 'id' | 'createdAt' | 'isSystemDefault'> & { id?: string }): FeePreset {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const userPresets: FeePreset[] = raw ? JSON.parse(raw) : [];

    const now = new Date().toISOString();
    const id = presetData.id || `preset-custom-${Date.now()}`;
    const newPreset: FeePreset = {
      ...presetData,
      id,
      isSystemDefault: false,
      createdAt: now,
    };

    const existingIndex = userPresets.findIndex(p => p.id === id);
    if (existingIndex >= 0) {
      userPresets[existingIndex] = newPreset;
    } else {
      userPresets.unshift(newPreset);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
    return newPreset;
  } catch (err) {
    console.error('Failed to save fee preset:', err);
    throw err;
  }
}

/**
 * 사용자 프리셋 삭제
 */
export function deleteFeePreset(id: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const userPresets: FeePreset[] = JSON.parse(raw);
    const filtered = userPresets.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to delete fee preset:', err);
    return false;
  }
}
