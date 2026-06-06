import { supabase } from '../supabaseClient';
import { DiagnosisResult, DiagnosisConfig } from '../types';

// ============================================================
// Supabase 진단 결과 저장/조회 서비스
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

// 진단 결과 저장
export async function saveDiagnosisResult(result: DiagnosisResult): Promise<{ success: boolean; error?: string }> {
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
      estimated_debt_total: result.estimatedDebtTotal,
      estimated_savings_amount: result.estimatedSavingsAmount,
      estimated_savings_rate: result.estimatedSavingsRate,
      estimated_monthly_payment: result.estimatedMonthlyPayment,
      rehab_engine_used: result.rehabEngineUsed,
      full_result: JSON.parse(JSON.stringify(result, (_, v) => v === undefined ? null : v)),
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
