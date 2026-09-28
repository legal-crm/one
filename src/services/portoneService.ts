// ============================================================
// PortOne 통신 3사 스마트폰 본인인증(PASS / SMS) 서비스 (공식 V2 가이드 준수)
// 대표자 실명 ↔ 국세청 대표자명 교차 검증
//
// [보안 원칙]
// - 브라우저 SDK의 완료 응답은 위조 가능하므로 신뢰하지 않는다. 인증 완료 후 반드시 서버
//   (/api/contract?action=identity-verify)가 PORTONE_API_SECRET으로 단건 조회한 실명·연락처만 사용한다.
// - API Secret은 서버 환경변수(PORTONE_API_SECRET)에만 둔다. (VITE_ 접두어 금지: 브라우저 번들에 노출됨)
// - 프로덕션에서 Store ID/Channel Key가 없으면 '성공'을 흉내 내지 않고 실패를 반환한다.
// ============================================================
import { getAuthHeaders } from '../supabaseClient';

const STORE_ID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PORTONE_STORE_ID) || '';
const CHANNEL_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PORTONE_CHANNEL_KEY) || '';
const IS_DEV = typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV;

export interface VerificationResult {
  success: boolean;
  method: string;          // 'portone_pass' | 'portone_sms' | 'portone_kakao' | 'portone_toss' | 'demo_dev'
  provider?: 'pass' | 'kakao' | 'toss' | 'sms';
  providerName?: string;
  name: string;            // 서버 검증된 실명
  birthDate?: string;
  gender?: string;
  phoneNumber?: string;
  phoneMasked?: string;
  carrier?: string;
  txId: string;            // identityVerificationId
  certifiedAt: string;     // 포트원 검증 시각 (ISO 8601)
  ci?: string;             // CI 해시 (원문 미보관)
  di?: string;
  isForeigner?: boolean;
  deviceInfo: string;
  ipAddress: string;       // 서버가 확인한 접속 IP (확인 불가 시 빈 값)
  /** 개발 환경 시연 결과 여부 — true면 실제 본인확인이 아님 */
  isDemo?: boolean;
  error?: string;
}

export interface RepresentativeMatchResult {
  matched: boolean;
  status: 'REPRESENTATIVE_VERIFIED' | 'DELEGATION_REQUIRED' | 'UNVERIFIED';
  message: string;
  nameMatched: boolean;
  phoneMatched?: boolean;
}

/** 원격 서명(비로그인) 사용자의 서버 검증 인가용 컨텍스트 */
export interface IdentityVerifyContext {
  contractId?: string;
  remoteSignToken?: string;
}

function failResult(provider: VerificationResult['provider'], deviceInfo: string, error: string, txId = ''): VerificationResult {
  return {
    success: false,
    method: `portone_${provider}`,
    provider,
    name: '',
    txId,
    certifiedAt: new Date().toISOString(),
    deviceInfo,
    ipAddress: '',
    error,
  };
}

/**
 * 스마트폰 본인인증 실행 (PortOne V2 브라우저 SDK → 서버 단건 조회 검증)
 * @param _targetName 기대 실명 (서버 검증 결과와의 대조는 호출부의 verifyRepresentativeMatch에서 수행 — 결과 채움에 사용하지 않음)
 * @param provider 선택한 인증 수단
 * @param ctx 원격 서명 링크의 contractId + remoteSignToken (비로그인 서버 인가용)
 */
export async function requestIdentityVerification(
  _targetName?: string,
  provider: 'pass' | 'kakao' | 'toss' | 'sms' = 'kakao',
  ctx: IdentityVerifyContext = {}
): Promise<VerificationResult> {
  const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'Unknown Browser';

  if (!STORE_ID || !CHANNEL_KEY) {
    if (IS_DEV) return simulateDemoVerification(_targetName, deviceInfo, provider);
    return failResult(provider, deviceInfo, '본인인증 서비스가 아직 설정되지 않았습니다. 담당 사무소에 문의해 주세요.');
  }

  const PortOne = (window as any).PortOne;
  if (!PortOne || typeof PortOne.requestIdentityVerification !== 'function') {
    return failResult(provider, deviceInfo, '본인인증 모듈을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
  }

  const uuid = crypto.randomUUID();
  const identityVerificationId = `idv-${provider}-${uuid}`;

  try {
    // 1. 브라우저 본인인증창 호출
    const response = await PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      identityVerificationId,
      channelKey: CHANNEL_KEY,
    });
    if (response && response.code !== undefined) {
      return failResult(provider, deviceInfo, response.message || `본인인증이 취소되었거나 실패했습니다. (코드: ${response.code})`, identityVerificationId);
    }

    // 2. 서버 단건 조회로 실제 인증 여부·실명 확인 (브라우저 응답값은 사용하지 않음)
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/contract?action=identity-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        identityVerificationId,
        contractId: ctx.contractId,
        remoteSignToken: ctx.remoteSignToken,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json.verifiedCustomer?.name) {
      return failResult(provider, deviceInfo, json?.error || '본인인증 결과를 서버에서 확인하지 못했습니다. 다시 시도해 주세요.', identityVerificationId);
    }

    const vc = json.verifiedCustomer;
    const rawPhone = String(vc.phoneNumber || '').replace(/\D/g, '');
    return {
      success: true,
      method: `portone_${provider}`,
      provider,
      providerName: getProviderDisplayName(provider),
      name: String(vc.name).trim(),
      birthDate: vc.birthDate || undefined,
      gender: vc.gender || undefined,
      phoneNumber: rawPhone || undefined,
      phoneMasked: rawPhone ? rawPhone.replace(/(\d{3})\d{3,4}(\d{4})/, '$1-****-$2') : undefined,
      carrier: vc.operator || undefined,
      txId: identityVerificationId,
      certifiedAt: json.verifiedAt || new Date().toISOString(),
      ci: vc.ciHash || undefined,
      isForeigner: !!vc.isForeigner,
      deviceInfo,
      ipAddress: json.clientIp || '',
    };
  } catch (err: any) {
    return failResult(provider, deviceInfo, err?.message || '본인인증 처리 중 알 수 없는 오류가 발생했습니다.', identityVerificationId);
  }
}

export function getProviderDisplayName(provider: 'pass' | 'kakao' | 'toss' | 'sms'): string {
  switch (provider) {
    case 'kakao':
      return '카카오 인증 (포트원 본인인증)';
    case 'pass':
      return 'PASS 앱 인증 (포트원 본인인증)';
    case 'toss':
      return '토스 인증 (포트원 본인인증)';
    case 'sms':
      return '휴대폰 문자 인증 (포트원 본인인증)';
  }
}

/**
 * 개발 환경 전용 시연 결과 (프로덕션 빌드에서는 호출되지 않음)
 * - 실명·연락처를 지어내지 않는다: 기대 이름만 되돌려 주므로 가명→실명 전환(기대 이름 없음)은 진행되지 않는다.
 */
async function simulateDemoVerification(
  targetName: string | undefined,
  deviceInfo: string,
  provider: 'pass' | 'kakao' | 'toss' | 'sms' = 'kakao'
): Promise<VerificationResult> {
  await new Promise(resolve => setTimeout(resolve, 400));
  return {
    success: !!targetName?.trim(),
    method: 'demo_dev',
    provider,
    providerName: `${getProviderDisplayName(provider)} — 개발 환경`,
    name: targetName?.trim() || '',
    txId: `DEV-${Date.now()}`,
    certifiedAt: new Date().toISOString(),
    deviceInfo,
    ipAddress: '',
    isDemo: true,
    error: targetName?.trim() ? undefined : '[개발 환경] 포트원 Store ID/Channel Key가 설정되지 않아 본인인증을 진행할 수 없습니다. (.env에 VITE_PORTONE_STORE_ID, VITE_PORTONE_CHANNEL_KEY 설정, 서버에 PORTONE_API_SECRET 설정)',
  };
}

/**
 * [권한성 & 동명이인 방지] 국세청 대표자명 및 연락처 2단계 교차 대조기
 */
export function verifyRepresentativeMatch(
  ntsRepresentativeName: string,
  verifiedName: string,
  expectedPhone?: string,
  verifiedPhone?: string
): RepresentativeMatchResult {
  const cleanNts = (ntsRepresentativeName || '').replace(/\s+/g, '');
  const cleanVerified = (verifiedName || '').replace(/\s+/g, '');

  const nameMatched = !cleanNts || cleanNts === cleanVerified;

  // 전화번호 대조 (전달된 경우)
  let phoneMatched = true;
  if (expectedPhone && verifiedPhone) {
    const cleanExpected = expectedPhone.replace(/\D/g, '');
    const cleanVerifiedPhone = verifiedPhone.replace(/\D/g, '');

    // 마스킹된 번호인 경우 (예: 010-****-5678 vs 01012345678)
    if (verifiedPhone.includes('*')) {
      const expSuffix = cleanExpected.slice(-4);
      const verSuffix = verifiedPhone.replace(/\D/g, '').slice(-4);
      const expPrefix = cleanExpected.slice(0, 3);
      const verPrefix = verifiedPhone.replace(/\D/g, '').slice(0, 3);
      phoneMatched = (expSuffix === verSuffix) && (!verPrefix || expPrefix === verPrefix);
    } else if (cleanExpected && cleanVerifiedPhone) {
      // 끝 8자리 대조 (국가번호 82 고려)
      phoneMatched = cleanExpected.slice(-8) === cleanVerifiedPhone.slice(-8);
    }
  }

  if (!cleanNts) {
    if (!phoneMatched) {
      return {
        matched: false,
        nameMatched: true,
        phoneMatched: false,
        status: 'DELEGATION_REQUIRED',
        message: `동명이인 도용 방지: 등록된 연락처(${expectedPhone})와 인증된 스마트폰 번호(${verifiedPhone})가 일치하지 않습니다.`,
      };
    }
    return {
      matched: true,
      nameMatched: true,
      phoneMatched: true,
      status: 'REPRESENTATIVE_VERIFIED',
      message: '개인 서명자 본인인증 완료',
    };
  }

  if (!nameMatched) {
    return {
      matched: false,
      nameMatched: false,
      phoneMatched,
      status: 'DELEGATION_REQUIRED',
      message: `대표자 실명 불일치: 사업자등록 대표자(${ntsRepresentativeName})와 스마트폰 인증자(${verifiedName})가 다릅니다.`,
    };
  }

  if (!phoneMatched) {
    return {
      matched: false,
      nameMatched: true,
      phoneMatched: false,
      status: 'DELEGATION_REQUIRED',
      message: `동명이인 도용 차단: 대표자 성명(${verifiedName})은 일치하나, 계약서 등록 연락처(${expectedPhone})와 본인인증 스마트폰 번호(${verifiedPhone})가 일치하지 않습니다.`,
    };
  }

  return {
    matched: true,
    nameMatched: true,
    phoneMatched: true,
    status: 'REPRESENTATIVE_VERIFIED',
    message: `국세청 등록 대표자(${ntsRepresentativeName}) 및 등록 연락처와 본인인증 정보가 100% 일치합니다.`,
  };
}

export function isPortOneConfigured(): boolean {
  return !!(STORE_ID && CHANNEL_KEY);
}
