/**
 * 허니팟(Honeypot) 침입 탐지 및 로깅 서비스
 * - 뻔한 관리자 경로(?role=admin)로 접근하여 공격을 시도하는 봇/해커의 침입 데이터를 기록
 * - Tarpit(인위적 2.5초 지연)을 통해 자동화 브루트포스 도구 마비
 * - 관리자 대시보드에 실시간 공격 현황 데이터 제공
 */

export interface HoneypotAttackLog {
  id: string;
  timestamp: string;
  attemptedId: string;
  passwordLength: number;
  userAgent: string;
  referrer: string;
  tarpitMs: number;
  status: 'BLOCKED' | 'TARPIT_DELAYED';
}

const HONEYPOT_STORAGE_KEY = 'honeypot_intrusion_logs';

export function getHoneypotLogs(): HoneypotAttackLog[] {
  try {
    const raw = localStorage.getItem(HONEYPOT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load honeypot logs:', e);
  }
  return [];
}

export function recordHoneypotAttack(attemptedId: string, rawPasswordLength: number, tarpitMs: number = 2500): HoneypotAttackLog {
  const newLog: HoneypotAttackLog = {
    id: `hp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    attemptedId: attemptedId.trim() || '(빈값)',
    passwordLength: rawPasswordLength,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    referrer: typeof document !== 'undefined' ? (document.referrer || '직접 접속(Direct)') : 'Unknown',
    tarpitMs,
    status: 'BLOCKED',
  };

  try {
    const logs = getHoneypotLogs();
    logs.unshift(newLog);
    // 최근 200개까지만 보관
    if (logs.length > 200) logs.length = 200;
    localStorage.setItem(HONEYPOT_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save honeypot log:', e);
  }

  return newLog;
}

export function clearHoneypotLogs(): void {
  try {
    localStorage.removeItem(HONEYPOT_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear honeypot logs:', e);
  }
}
