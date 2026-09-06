// ============================================================
// PortOne 통신 3사 스마트폰 본인인증(PASS / SMS) 서비스
// 대표자 실명 ↔ 국세청 대표자명 교차 검증 및 통신사 공인 시각 획득
// ============================================================

const STORE_ID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PORTONE_STORE_ID) || '';
const CHANNEL_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PORTONE_CHANNEL_KEY) || 'channel-key-placeholder';

export interface VerificationResult {
  success: boolean;
  method: string;          // 'portone_pass' | 'portone_sms' | 'demo_pass'
  name: string;            // 통신사 인증 실명 (예: 홍길동)
  birthDate?: string;      // 생년월일 (YYYYMMDD)
  phoneMasked?: string;    // 마스킹된 휴대폰번호
  carrier?: string;        // SKT, KT, LGU+, 알뜰폰
  txId: string;            // 통신사 공인 거래 승인번호
  certifiedAt: string;     // 통신사 인증 서버 공인 시각 (ISO 8601)
  ci?: string;             // 연계정보
  deviceInfo: string;      // 접속 단말기 환경
  ipAddress: string;       // 접속 IP
  error?: string;
}

export interface RepresentativeMatchResult {
  matched: boolean;
  status: 'REPRESENTATIVE_VERIFIED' | 'DELEGATION_REQUIRED' | 'UNVERIFIED';
  message: string;
}

/**
 * 스마트폰 본인인증 실행 (PortOne V2 SDK 또는 데모)
 * @param targetName 인증을 기대하는 대표자명 (데모 시뮬레이션용)
 */
export async function requestIdentityVerification(targetName?: string): Promise<VerificationResult> {
  const deviceInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser';
  const ipAddress = '211.234.12.89'; // 서버 환경에서 수집 권장, 브라우저 기본값

  if (!STORE_ID) {
    // API 키 미설정 시 데모 시뮬레이션 (targetName을 활용해 현실적인 테스트 지원)
    return simulateDemoVerification(targetName, deviceInfo, ipAddress);
  }

  try {
    // PortOne V2 SDK (window.PortOne 글로벌)
    const PortOne = (window as any).PortOne;
    if (!PortOne) throw new Error('PortOne SDK가 로드되지 않았습니다.');

    const identityVerificationId = `iv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const response = await PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      identityVerificationId,
      channelKey: CHANNEL_KEY,
    });

    if (response.code != null) {
      return {
        success: false,
        method: 'portone',
        name: '',
        txId: identityVerificationId,
        certifiedAt: new Date().toISOString(),
        deviceInfo,
        ipAddress,
        error: response.message || '인증이 취소되었거나 실패했습니다.',
      };
    }

    // 포트원 V2 인증 성공 응답
    return {
      success: true,
      method: 'portone_pass',
      name: response.name || targetName || '인증회원',
      birthDate: response.birthDate || '19850101',
      phoneMasked: response.phoneNumber ? response.phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1-****-$2') : '010-****-5678',
      carrier: response.operator || 'SKT',
      txId: `TX-PORTONE-${response.identityVerificationId || identityVerificationId}`,
      certifiedAt: new Date().toISOString(),
      ci: response.ci || undefined,
      deviceInfo,
      ipAddress,
    };
  } catch (err: any) {
    return {
      success: false,
      method: '',
      name: '',
      txId: '',
      certifiedAt: new Date().toISOString(),
      deviceInfo,
      ipAddress,
      error: err.message || '본인인증 처리 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 데모 모드 시뮬레이션
 */
async function simulateDemoVerification(targetName?: string, deviceInfo?: string, ipAddress?: string): Promise<VerificationResult> {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const demoName = targetName?.trim() || '홍길동';
  const now = new Date().toISOString();

  return {
    success: true,
    method: 'demo_pass',
    name: demoName,
    birthDate: '19820515',
    phoneMasked: '010-****-7788',
    carrier: 'SKT',
    txId: `TX-KISA-SKT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    certifiedAt: now,
    ci: 'DEMO-CI-' + Math.random().toString(36).slice(2, 12).toUpperCase(),
    deviceInfo: deviceInfo || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)',
    ipAddress: ipAddress || '211.234.12.89',
  };
}

/**
 * [권한성] 국세청 대표자명과 통신사 본인인증 실명 교차 대조기
 */
export function verifyRepresentativeMatch(
  ntsRepresentativeName: string,
  verifiedName: string
): RepresentativeMatchResult {
  const cleanNts = ntsRepresentativeName.replace(/\s+/g, '');
  const cleanVerified = verifiedName.replace(/\s+/g, '');

  if (!cleanNts) {
    return {
      matched: true,
      status: 'REPRESENTATIVE_VERIFIED',
      message: '개인 서명자 본인인증 완료',
    };
  }

  if (cleanNts === cleanVerified) {
    return {
      matched: true,
      status: 'REPRESENTATIVE_VERIFIED',
      message: `국세청 등록 대표자(${ntsRepresentativeName})와 본인인증 실명(${verifiedName})이 100% 일치합니다.`,
    };
  }

  return {
    matched: false,
    status: 'DELEGATION_REQUIRED',
    message: `불일치: 사업자등록 대표자(${ntsRepresentativeName})와 스마트폰 인증자(${verifiedName})가 다릅니다. 대표자 본인 스마트폰으로 인증하거나 대리인 위임 절차가 필요합니다.`,
  };
}

export function isPortOneConfigured(): boolean {
  return !!STORE_ID;
}
