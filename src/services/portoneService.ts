// ============================================================
// PortOne 간편인증 서비스
// 실제 API 키 미설정 시 데모 모드로 동작
// ============================================================

const STORE_ID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PORTONE_STORE_ID) || '';

export interface VerificationResult {
  success: boolean;
  method: string;
  verifiedAt: string;
  ci?: string;
  deviceInfo: string;
  ipAddress: string;
  error?: string;
}

// 실제 PortOne SDK 연동 (API 키 설정 시)
export async function requestIdentityVerification(): Promise<VerificationResult> {
  if (!STORE_ID) {
    // 데모 모드: 인증 시뮬레이션
    return simulateDemoVerification();
  }

  try {
    // PortOne V2 SDK (window.PortOne 글로벌)
    const PortOne = (window as any).PortOne;
    if (!PortOne) throw new Error('PortOne SDK not loaded');

    const response = await PortOne.requestIdentityVerification({
      storeId: STORE_ID,
      identityVerificationId: `iv-${Date.now()}`,
      channelKey: 'channel-key-placeholder',
    });

    if (response.code) {
      return { success: false, method: '', verifiedAt: '', deviceInfo: '', ipAddress: '', error: response.message };
    }

    return {
      success: true,
      method: 'portone',
      verifiedAt: new Date().toISOString(),
      ci: response.ci || undefined,
      deviceInfo: navigator.userAgent,
      ipAddress: '127.0.0.1',
    };
  } catch (err: any) {
    return { success: false, method: '', verifiedAt: '', deviceInfo: '', ipAddress: '', error: err.message };
  }
}

// 데모 모드 시뮬레이션
async function simulateDemoVerification(): Promise<VerificationResult> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        success: true,
        method: 'demo_kakao',
        verifiedAt: new Date().toISOString(),
        ci: 'DEMO-CI-' + Math.random().toString(36).slice(2, 10),
        deviceInfo: navigator.userAgent,
        ipAddress: '127.0.0.1',
      });
    }, 1500);
  });
}

export function isPortOneConfigured(): boolean {
  return !!STORE_ID;
}
