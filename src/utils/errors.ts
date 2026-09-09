// src/utils/errors.ts
// ============================================================
// [Error Handling] 표준 애플리케이션 에러 클래스 및 에러 타입 분리
// 프론트엔드 및 백엔드 계층 간 통일된 에러 규격과 안전한 사용자 피드백을 제공합니다.
// ============================================================

export type ErrorType = 
  | 'VALIDATION_ERROR'       // 400: 입력값 검증 실패 (길이, 형식, 필수값 누락 등)
  | 'AUTH_ERROR'             // 401: 인증 실패 (토큰 만료, 미인증 등)
  | 'FORBIDDEN_ERROR'        // 403: 인가 실패 (권한 부족, 봇 차단 등)
  | 'NOT_FOUND_ERROR'        // 404: 리소스 부재
  | 'RATE_LIMIT_ERROR'       // 429: 호출 한도 초과
  | 'NETWORK_ERROR'          // 503: 외부 서비스 장애/타임아웃
  | 'BUSINESS_LOGIC_ERROR'   // 422: 업무 규칙 위반 (중복 계약, 만료된 기일 등)
  | 'INTERNAL_SERVER_ERROR'; // 500: 시스템 예기치 못한 오류

export interface AppErrorPayload {
  name: string;
  type: ErrorType;
  message: string;
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    type: ErrorType = 'INTERNAL_SERVER_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 400 Bad Request: 클라이언트 입력값 형식/검증 오류
   */
  static badRequest(message: string, code?: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 'VALIDATION_ERROR', 400, true, code || 'BAD_REQUEST', details);
  }

  /**
   * 401 Unauthorized: 로그인 또는 유효한 토큰 필요
   */
  static unauthorized(message: string = '로그인이 필요하거나 인증 토큰이 만료되었습니다.'): AppError {
    return new AppError(message, 'AUTH_ERROR', 401, true, 'UNAUTHORIZED');
  }

  /**
   * 403 Forbidden: 권한 부족 또는 보안(Turnstile) 차단
   */
  static forbidden(message: string = '해당 기능에 접근할 수 있는 권한이 없습니다.'): AppError {
    return new AppError(message, 'FORBIDDEN_ERROR', 403, true, 'FORBIDDEN');
  }

  /**
   * 404 Not Found: 요청한 사건/데이터 없음
   */
  static notFound(message: string = '요청하신 정보 또는 페이지를 찾을 수 없습니다.'): AppError {
    return new AppError(message, 'NOT_FOUND_ERROR', 404, true, 'NOT_FOUND');
  }

  /**
   * 429 Too Many Requests: 요청 빈도 초과
   */
  static rateLimit(message: string = '요청 횟수 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'): AppError {
    return new AppError(message, 'RATE_LIMIT_ERROR', 429, true, 'RATE_LIMITED');
  }

  /**
   * 422 Unprocessable Entity: 업무 규칙 위반
   */
  static business(message: string, code?: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 'BUSINESS_LOGIC_ERROR', 422, true, code || 'BUSINESS_RULE_VIOLATION', details);
  }

  /**
   * 500 Internal Error: 안전하게 시스템 스택을 숨기고 표준 메시지만 직렬화
   */
  toSafeJSON(): { ok: false; error: string; type: ErrorType; code?: string } {
    return {
      ok: false,
      error: this.isOperational ? this.message : '일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      type: this.type,
      code: this.code,
    };
  }
}
