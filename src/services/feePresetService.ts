/**
 * feePresetService.ts
 * 
 * 변호사 사무실별 수임료 및 분납 조건 세팅(계약금, 착수금, 분납 방식, 회차, 납부일, 부가세, 서식 스타일) 프리셋.
 * 사무소가 만든 프리셋은 서버 사무소 설정(office_settings 'work_defaults'.feePresets)에 저장한다 (FE-3·S).
 * 이전: 그 브라우저(localStorage)에만 있어 다른 직원·기기에서 보이지 않았다. 서버가 없을 때(개발)만 브라우저에 둔다.
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

import { loadOfficeSettings, saveOfficeSettings } from './office/officeSettingsService';

const STORAGE_KEY = 'legal_crm_fee_presets_v1';
const MAX_OFFICE_PRESETS = 15;

let presetOfficeId: string | null = null;
let officePresets: FeePreset[] = [];
let workDefaults: Record<string, unknown> = {};
let workDefaultsVersion: number | undefined;

/** 로그인한 사무소 (LawyerRole). 정해지면 서버에서 프리셋을 읽는다 */
export function setFeePresetOfficeScope(officeId: string | null): void {
  if (presetOfficeId === officeId) return;
  presetOfficeId = officeId;
  officePresets = [];
  workDefaults = {};
  workDefaultsVersion = undefined;
  if (officeId) void refreshFeePresets();
}

/** 서버 프리셋 다시 읽기 (실패하면 기본 프리셋만) */
export async function refreshFeePresets(): Promise<FeePreset[]> {
  if (!presetOfficeId) return getFeePresets();
  const r = await loadOfficeSettings<Record<string, unknown>>(presetOfficeId, 'work_defaults');
  if (r.ok) {
    workDefaults = r.data?.data || {};
    workDefaultsVersion = r.data?.version;
    const list = Array.isArray(workDefaults.feePresets) ? (workDefaults.feePresets as FeePreset[]) : [];
    officePresets = list.filter(p => p && typeof p.id === 'string').map(p => ({ ...p, isSystemDefault: false }));
  }
  return getFeePresets();
}

async function writeOfficePresets(next: FeePreset[]): Promise<void> {
  if (!presetOfficeId) throw new Error('사무소 정보가 없어 저장하지 못했어요.');
  const payload = { ...workDefaults, feePresets: next };
  const r = await saveOfficeSettings(presetOfficeId, 'work_defaults', payload, workDefaultsVersion);
  if (r.ok === false) {
    if (/version|40001/i.test(r.message || r.code || '')) {
      await refreshFeePresets();
      throw new Error('다른 사람이 먼저 프리셋을 바꿨어요. 목록을 새로 불러왔으니 다시 저장해 주세요.');
    }
    throw new Error(/permission|42501/i.test(r.message || r.code || '') ? '사무소 설정을 바꿀 권한이 없어요. 대표에게 요청해 주세요.' : (r.message || '프리셋을 서버에 저장하지 못했어요.'));
  }
  workDefaults = payload;
  workDefaultsVersion = r.data.version;
  officePresets = next;
}

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
 * 모든 프리셋 조회 (시스템 기본 + 사무소 저장)
 */
export function getFeePresets(): FeePreset[] {
  if (presetOfficeId) return [...DEFAULT_FEE_PRESETS, ...officePresets];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEE_PRESETS;
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
export async function saveFeePreset(presetData: Omit<FeePreset, 'id' | 'createdAt' | 'isSystemDefault'> & { id?: string }): Promise<FeePreset> {
  const now = new Date().toISOString();
  const id = presetData.id || `preset-custom-${Date.now()}`;
  const newPreset: FeePreset = { ...presetData, id, isSystemDefault: false, createdAt: now };
  if (presetOfficeId) {
    const list = officePresets.filter(p => p.id !== id);
    if (list.length >= MAX_OFFICE_PRESETS) throw new Error(`프리셋은 사무소당 ${MAX_OFFICE_PRESETS}개까지 저장할 수 있어요. 안 쓰는 것을 지워 주세요.`);
    await writeOfficePresets([newPreset, ...list]);
    return newPreset;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  const userPresets: FeePreset[] = raw ? JSON.parse(raw) : [];
  const existingIndex = userPresets.findIndex(p => p.id === id);
  if (existingIndex >= 0) userPresets[existingIndex] = newPreset;
  else userPresets.unshift(newPreset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
  return newPreset;
}

/**
 * 사무소 프리셋 삭제
 */
export async function deleteFeePreset(id: string): Promise<void> {
  if (presetOfficeId) {
    await writeOfficePresets(officePresets.filter(p => p.id !== id));
    return;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const userPresets: FeePreset[] = JSON.parse(raw);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets.filter(p => p.id !== id)));
}
