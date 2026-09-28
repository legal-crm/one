import type { 
  RetrievedJobHistoryItem, 
  JobHistoryImportParams, 
  JobHistoryImportResult 
} from '../types/jobHistoryTypes';
import { getAuthHeaders } from '../supabaseClient';

/** 입사~퇴사(없으면 오늘) 개월 수 */
function monthsBetween(join?: string, leave?: string | null): number {
  const a = join ? new Date(join) : null;
  if (!a || isNaN(a.getTime())) return 0;
  const b = leave ? new Date(leave) : new Date();
  if (isNaN(b.getTime())) return 0;
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

/**
 * 국민연금(NPS) 및 건강보험(NHIS) 과거 직장경력 자동 불러오기 하이브리드 서비스
 */
export class JobHistoryService {
  /**
   * [Option A] 간편인증 기반 국민연금 가입이력 조회
   */
  static async fetchFromNationalPension(
    params: JobHistoryImportParams
  ): Promise<JobHistoryImportResult> {
    // 실제 상용 환경: Codef 또는 하이픈 스크래핑 API 호출
    // 엔드포인트: /api/scrape-pension-history (API Key 및 상용 계약 연동)
    try {
      const res = await fetch('/api/scrape-pension-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) return data;
      }
    } catch {
      // API 미배포 시 스마트 시뮬레이션 폴백
    }

    // 스크래핑 API(/api/scrape-pension-history)가 배포되지 않은 경우: 가짜 경력을 만들지 않고 '조회 불가'를 반환
    // (법원 제출 진술서에 실존하지 않는 직장이 기재되는 것을 방지)
    return {
      ok: false,
      source: 'unavailable',
      totalCount: 0,
      items: [],
      queriedAt: new Date().toISOString()
    } as JobHistoryImportResult;
  }
  /**
   * [Option B] 건강보험 자격득실확인서 / 국민연금 가입증명서 사진·PDF AI 인식
   * - 서버(/api/ocr-family, mode=job_history)에서 Gemini Vision으로 판독 — API 키를 브라우저 번들에 넣지 않는다
   * - 실패 시 가짜 경력으로 대체하지 않고 실패를 반환 → 사용자가 직접 입력
   */
  static async parseJobHistoryFromDocumentImage(
    fileBase64: string,
    fileName = '자격득실확인서.pdf'
  ): Promise<JobHistoryImportResult> {
    const unavailable = {
      ok: false,
      source: 'unavailable',
      totalCount: 0,
      items: [],
      queriedAt: new Date().toISOString()
    } as JobHistoryImportResult;

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/ocr-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ imageBase64: fileBase64, fileName, mode: 'job_history' }),
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) return unavailable;
      const json = await res.json();
      const rawItems: any[] = json?.ok && Array.isArray(json.result?.items) ? json.result.items : [];
      const items: RetrievedJobHistoryItem[] = rawItems
        .filter((it: any) => it && typeof it.workplaceName === 'string' && it.workplaceName.trim())
        .map((it: any, idx: number) => ({
          id: `ocr-${Date.now()}-${idx}`,
          workplaceName: it.workplaceName.trim(),
          joinDate: it.joinDate || '',
          leaveDate: it.leaveDate || undefined,
          isCurrent: !!it.isCurrent,
          periodText: it.periodText || `${String(it.joinDate || '').slice(0, 7)} ~ ${it.leaveDate ? String(it.leaveDate).slice(0, 7) : '현재'}`,
          durationMonths: monthsBetween(it.joinDate, it.leaveDate),
          dataSource: 'OCR_DOCUMENT',
          suggestedPosition: it.suggestedPosition || '',
          leaveReason: it.leaveReason || '',
          selected: true
        }));
      if (items.length === 0) return unavailable;
      return {
        ok: true,
        source: 'vision_ocr',
        totalCount: items.length,
        items,
        queriedAt: new Date().toISOString()
      };
    } catch (err) {
      console.warn('[JobHistoryService] OCR request failed', err);
      return unavailable;
    }
  }
}
