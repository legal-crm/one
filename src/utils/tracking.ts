// src/utils/tracking.ts
// ============================================================
// [SECURITY Monitoring & Tracing] 분산 트랜잭션 추적 유틸리티
// 클라이언트 ↔ 서버 ↔ DB 간 모든 요청에 X-Request-ID를 전파합니다.
// ============================================================

let currentTraceId = '';

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `req_${timestamp}_${random}`;
}

export function getActiveRequestId(): string {
  if (!currentTraceId) {
    currentTraceId = generateRequestId();
  }
  return currentTraceId;
}

export function rotateRequestId(): string {
  currentTraceId = generateRequestId();
  return currentTraceId;
}

/**
 * fetch 요청 헤더에 X-Request-ID 및 클라이언트 타임스탬프를 자동 주입합니다.
 */
export function withTrackingHeaders(headers: HeadersInit = {}): HeadersInit {
  const reqId = getActiveRequestId();
  const baseHeaders = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;

  return {
    ...baseHeaders,
    'X-Request-ID': reqId,
    'X-Client-Timestamp': new Date().toISOString(),
  };
}
