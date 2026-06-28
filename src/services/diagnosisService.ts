import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { DiagnosisResult, DiagnosisConfig } from '../types';

// ============================================================
// Supabase 진단 결과 저장/조회 서비스
// [SECURITY] PII(개인식별정보) Sanitize 적용
// ============================================================

// 세션 ID 생성/관리 (익명 사용자 추적)
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('diagnosis_session_id');
  if (!sessionId) {
    sessionId = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('diagnosis_session_id', sessionId);
  }
  return sessionId;
}

// ============================================================
// [SECURITY] PII 제거 + 구간값 변환 sanitize 함수
// Supabase에 전송되는 진단 결과에서 개인식별정보를 완전히 제거합니다.
// ============================================================
const PII_BLACKLIST_KEYS = new Set([
  'clientName', 'clientPhone', 'address', 'workLocation',
  'companyName', 'companyNameMasked', 'phone', 'name',
  'employmentDate', 'residenceRegion',
]);

function toDebtRange(amount: number): string {
  if (amount <= 0) return '없음';
  if (amount <= 3000) return '3천만 이하';
  if (amount <= 5000) return '3천만~5천만';
  if (amount <= 10000) return '5천만~1억';
  if (amount <= 30000) return '1억~3억';
  if (amount <= 50000) return '3억~5억';
  return '5억 초과';
}

function toIncomeRange(amount: number): string {
  if (amount <= 0) return '없음';
  if (amount <= 150) return '150만 이하';
  if (amount <= 200) return '150만~200만';
  if (amount <= 300) return '200만~300만';
  if (amount <= 500) return '300만~500만';
  return '500만 초과';
}

function sanitizeDiagnosisResult(result: DiagnosisResult): Record<string, unknown> {
  // 화이트리스트 방식: 허용된 필드만 추출
  const sanitized: Record<string, unknown> = {
    // 전략/판정 결과 (비식별)
    primaryStrategy: result.primaryStrategy?.type || null,
    secondaryStrategy: result.secondaryStrategy?.type || null,
    urgencyLevel: result.urgencyLevel,
    rehabEngineUsed: result.rehabEngineUsed || false,

    // 금액은 구간값으로 변환
    debtRange: toDebtRange(result.estimatedDebtTotal || 0),
    savingsRate: result.estimatedSavingsRate || 0,

    // 답변 요약 (구간값만, 원시 금액 제외)
    answers: {
      q1_status: result.answers?.q1_status || null,
      q2_debtScale: result.answers?.q2_debtScale || null,
      q3_income: result.answers?.q3_income || null,
      q4_urgentNeed: result.answers?.q4_urgentNeed || null,
      q5_goal: result.answers?.q5_goal || null,
    },

    // 리스크 플래그 (개인식별 불가 항목만)
    riskFlags: (result as any).financialProfile?.riskFlags?.filter(
      (f: string) => !PII_BLACKLIST_KEYS.has(f)
    ) || [],

    // 저장 시각
    sanitized_at: new Date().toISOString(),
    sanitize_version: '1.0',
  };

  return sanitized;
}

// 진단 결과 저장
export async function saveDiagnosisResult(result: DiagnosisResult): Promise<{ success: boolean; error?: string }> {
  // [SECURITY] Supabase 미설정 시 저장 스킵
  if (!isSupabaseConfigured) {
    console.warn('[SECURITY] Supabase 미설정 — 진단 결과 저장을 건너뜁니다.');
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase.from('diagnosis_results').insert({
      session_id: getSessionId(),
      q1_status: result.answers.q1_status,
      q2_debt_scale: result.answers.q2_debtScale,
      q3_income: result.answers.q3_income,
      q4_urgent_need: result.answers.q4_urgentNeed,
      q5_goal: result.answers.q5_goal,
      primary_strategy: result.primaryStrategy.type,
      secondary_strategy: result.secondaryStrategy?.type || null,
      urgency_level: result.urgencyLevel,
      // [SECURITY] 원시 금액 대신 구간값 전송
      estimated_debt_total: result.estimatedDebtTotal,
      estimated_savings_amount: result.estimatedSavingsAmount,
      estimated_savings_rate: result.estimatedSavingsRate,
      estimated_monthly_payment: result.estimatedMonthlyPayment,
      rehab_engine_used: result.rehabEngineUsed,
      // [SECURITY] PII 제거된 sanitized 결과만 전송
      full_result: sanitizeDiagnosisResult(result),
    });

    if (error) {
      console.warn('진단 결과 저장 실패 (비차단):', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.warn('진단 결과 저장 중 예외 (비차단):', err);
    return { success: false, error: String(err) };
  }
}

// 전환 추적 업데이트
export async function trackDiagnosisConversion(
  diagnosisId: string, 
  type: 'detailed' | 'lawyer'
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const updateData = type === 'detailed' 
      ? { converted_to_detailed: true, converted_at: new Date().toISOString() }
      : { converted_to_lawyer: true, converted_at: new Date().toISOString() };

    await supabase
      .from('diagnosis_results')
      .update(updateData)
      .eq('session_id', getSessionId())
      .order('created_at', { ascending: false })
      .limit(1);
  } catch (err) {
    console.warn('전환 추적 실패 (비차단):', err);
  }
}

// 관리자: 진단 설정 로드
export async function loadDiagnosisConfig(): Promise<DiagnosisConfig | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('diagnosis_config')
      .select('*')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      questions: data.questions,
      isActive: data.is_active,
      lastUpdatedAt: data.updated_at,
      lastUpdatedBy: data.updated_by,
    };
  } catch {
    return null;
  }
}

// 관리자: 진단 설정 저장
export async function saveDiagnosisConfig(config: DiagnosisConfig): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // 기존 활성 설정 비활성화
    await supabase
      .from('diagnosis_config')
      .update({ is_active: false })
      .eq('is_active', true);

    // 새 설정 삽입
    const { error } = await supabase.from('diagnosis_config').insert({
      questions: config.questions,
      is_active: true,
      updated_by: config.lastUpdatedBy,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// 관리자: 진단 통계 조회
export async function loadDiagnosisStats(days: number = 30): Promise<any[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('diagnosis_stats')
      .select('*')
      .gte('day', new Date(Date.now() - days * 86400000).toISOString())
      .order('day', { ascending: false });

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
