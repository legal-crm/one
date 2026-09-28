/**
 * lawyerDocShareService.ts
 * "개인회생 서류와 모든 준비는 마이김변에서 쉽고 빠르게!"
 * 
 * 의뢰인이 작성한 2차 서류(진술서, 수지표, 재산목록, 채무진단)를
 * 비회원 변호사 및 사무장 휴대폰 번호로 안전하게 공유하고,
 * (서버 보관 + 수신 휴대폰 번호 확인 후 열람. 가입·파트너 전환 기능은 실제 인증이 없어 제거)
 */

import { CourtStatementData } from '../types/statementTypes';
import { IncomeExpenseD5103Data } from '../types/incomeExpenseTypes';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export type RecipientRoleType = 'LAWYER' | 'MANAGER';

export interface SharedDocPackageItem {
  hasStatement: boolean;
  statementData?: CourtStatementData | null;
  hasIncomeExpense: boolean;
  incomeExpenseData?: IncomeExpenseD5103Data | null;
  hasProperty: boolean;
  propertySummary?: {
    totalAssetValue: number;
    depositAmount: number;
    vehicleValue: number;
    realEstateValue: number;
  } | null;
  hasDebtSummary: boolean;
  debtSummary?: {
    totalDebt: number;
    monthlyIncome: number;
    courtName: string;
    expectedReductionRate: number;
    monthlyPayment: number;
  } | null;
}

export interface LawyerDocSharePackage {
  token: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  recipientType: RecipientRoleType;
  recipientName: string;
  recipientPhone: string;
  recipientFirmName?: string;
  memo?: string;
  createdAt: string;
  expiresAt: string;
  status: 'PENDING_VIEW' | 'LIGHT_REGISTERED' | 'FULL_CONVERTED';
  docs: SharedDocPackageItem;
  accessLog?: {
    viewedAt?: string;
    lightRegisteredAt?: string;
    fullConvertedAt?: string;
    ipOrDevice?: string;
  };
}

/** 192bit CSPRNG 토큰 (base64url) — 기존 Math.random 12자리 대체 */
function generateShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return `lds_${btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 서류 공유 패키지 생성 — 서버(doc_share_packages, migration 017)에 저장
 * - 로그인한 의뢰인만 생성 가능, 7일 후 만료
 * - 받는 사람은 링크 + 수신 휴대폰 번호가 일치해야 열람 (서버 RPC 검증, 5회 오입력 잠금)
 * 기존: 보낸 사람 브라우저에만 저장돼 다른 기기에서 열리지 않았음
 */
export async function createDocSharePackage(params: {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  recipientType: RecipientRoleType;
  recipientName: string;
  recipientPhone: string;
  recipientFirmName?: string;
  memo?: string;
  docs: SharedDocPackageItem;
}): Promise<{ ok: true; pkg: LawyerDocSharePackage } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: '서류 공유 서버가 설정되지 않았습니다.' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false, error: '로그인한 뒤 공유 링크를 만들 수 있습니다.' };

  const token = generateShareToken();
  const now = new Date();
  const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const cleanPhone = params.recipientPhone.replace(/[^0-9]/g, '');

  const pkg: LawyerDocSharePackage = {
    token,
    clientId: params.clientId,
    clientName: params.clientName,
    recipientType: params.recipientType,
    recipientName: params.recipientName,
    recipientPhone: cleanPhone,
    recipientFirmName: params.recipientFirmName,
    memo: params.memo,
    createdAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    status: 'PENDING_VIEW',
    docs: params.docs,
  };

  // 서버 payload에는 받는 사람 번호 원문을 넣지 않음 (해시·끝 4자리만 별도 컬럼)
  const { recipientPhone: _p, ...payload } = pkg;
  const { error } = await supabase.from('doc_share_packages').insert([{
    token,
    owner_user_id: session.user.id,
    recipient_phone_hash: await sha256Hex(cleanPhone),
    recipient_phone_last4: cleanPhone.slice(-4),
    payload,
    expires_at: expiry.toISOString(),
  }]);
  if (error) {
    console.warn('[lawyerDocShareService] insert failed', error.message);
    return { ok: false, error: '공유 링크를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }
  return { ok: true, pkg };
}

/** 링크 유효 여부와 수신 번호 끝 4자리만 확인 */
export async function peekDocSharePackage(token: string): Promise<{ ok: boolean; phoneLast4?: string; locked?: boolean }> {
  if (!token || !isSupabaseConfigured) return { ok: false };
  const { data, error } = await supabase.rpc('peek_doc_share', { p_token: token });
  if (error || !data) return { ok: false };
  return data as any;
}

/** 수신 휴대폰 번호로 열람 (서버 검증) */
export async function openDocSharePackage(token: string, phone: string): Promise<
  { ok: true; pkg: LawyerDocSharePackage } | { ok: false; reason: 'not_found' | 'locked' | 'mismatch' | 'error'; remaining?: number }
> {
  if (!token || !isSupabaseConfigured) return { ok: false, reason: 'not_found' };
  const { data, error } = await supabase.rpc('open_doc_share', { p_token: token, p_phone: phone });
  if (error || !data) return { ok: false, reason: 'error' };
  const d = data as any;
  if (!d.ok) return { ok: false, reason: d.reason || 'error', remaining: d.remaining };
  return { ok: true, pkg: { ...(d.payload as LawyerDocSharePackage), token, recipientPhone: '' } };
}

/**
 * 카카오톡 / SMS 공유 텍스트 생성
 */
export function generateShareMessage(pkg: LawyerDocSharePackage, shareUrl: string): {
  smsUrl: string;
  shareTitle: string;
  shareBody: string;
} {
  const roleLabel = pkg.recipientType === 'LAWYER' ? '변호사님' : '사무장님';
  const firmPrefix = pkg.recipientFirmName ? `[${pkg.recipientFirmName}] ` : '';
  const title = `[마이김변] 의뢰인 ${pkg.clientName}님의 개인회생 서류 초안 공유`;

  const body =
`${firmPrefix}${pkg.recipientName} ${roleLabel}께,

의뢰인 [${pkg.clientName}]님이 마이김변에서 작성한 개인회생 서류 초안(진술서·수지표 등)을 공유드립니다.
의뢰인이 직접 작성한 초안이므로 검토 후 사용해 주세요.

■ 열람 링크 (7일간 유효):
${shareUrl}

* 이 문자를 받은 휴대폰 번호를 입력하면 열람할 수 있습니다.`;

  return {
    smsUrl: `sms:${pkg.recipientPhone}?body=${encodeURIComponent(body)}`,
    shareTitle: title,
    shareBody: body,
  };
}
