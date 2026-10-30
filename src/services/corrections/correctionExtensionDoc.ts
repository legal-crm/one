import { CANNOT_REASON_LABEL, KIND_LABEL } from './correctionLabels';
import type { CorrectionItem, CorrectionOrder } from './correctionService';

// ============================================================
// 보정기간 연장 신청서 (CR-11)
// 의뢰인이 '낼 수 없어요'로 알린 사유·발급 예정일을 사유 초안으로 불러온다. 연장 기간은 사무소가 정한다(1개월 고정 아님).
// 사유 문장은 변호사가 고쳐 확정한다. 출력은 인쇄 창(H-7 글자 PDF 전까지).
// ============================================================

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ymdKo = (ymd?: string) => {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : '';
};

/** 의뢰인이 알린 '낼 수 없음' 항목으로 사유 초안 */
export function draftExtensionReason(items: CorrectionItem[]): string {
  const lines = items
    .filter(i => i.status === 'cannot_submit' || (i.expectedOn && i.status !== 'confirmed'))
    .sort((a, b) => a.seq - b.seq)
    .map(i => {
      const what = i.clientTitle || i.category || '요청 자료';
      const why = i.cannotReason ? CANNOT_REASON_LABEL[i.cannotReason] : '발급 진행 중';
      return `- ${i.label || i.seq}항(${what}): ${why}${i.expectedOn ? `, 발급 예정일 ${ymdKo(i.expectedOn)}` : ''}${i.cannotNote ? ` (${i.cannotNote})` : ''}`;
    });
  return lines.length
    ? `보정 요구 자료 중 아래 자료는 발급기관의 발급 절차 등으로 기간 안에 갖추기 어렵습니다.\n${lines.join('\n')}`
    : '';
}

export interface ExtensionDocInput {
  order: CorrectionOrder;
  days: number;
  reason: string;
  caseNumber?: string;
  applicantName?: string;
  courtName?: string;
  lawyerName?: string;
  officeName?: string;
  date: string;
}

export function renderExtensionRequestHtml(d: ExtensionDocInput): string {
  const kind = KIND_LABEL[d.order.kind] || '보정권고';
  const reason = esc(d.reason).replace(/\n/g, '<br>');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보정기간 연장 신청서</title>
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: 'Batang', 'Nanum Myeongjo', serif; font-size: 12pt; line-height: 1.9; color: #000; }
  h1 { text-align: center; font-size: 20pt; letter-spacing: 6px; margin: 0 0 24px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
  td { padding: 4px 6px; vertical-align: top; }
  .label { width: 110px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .court { text-align: center; font-size: 16pt; letter-spacing: 4px; margin-top: 40px; }
</style></head><body>
<h1>보정기간 연장 신청서</h1>
<table>
  <tr><td class="label">사　　건</td><td>${esc(d.caseNumber || '　　　　　　')} 개인회생</td></tr>
  <tr><td class="label">신 청 인</td><td>${esc(d.applicantName || '')}</td></tr>
</table>
<p>위 사건에 관하여 신청인은 ${esc(ymdKo(d.order.servedOn))} 송달받은 ${esc(kind)}에 따른 보정기간을 아래와 같은 사유로
${esc(d.days)}일간 연장하여 주실 것을 신청합니다.${d.order.courtDue ? ` (현재 보정기한: ${esc(ymdKo(d.order.courtDue))})` : ''}</p>
<p class="center">신 청 사 유</p>
<p>${reason || '　'}</p>
<p class="center" style="margin-top:36px">${esc(ymdKo(d.date))}</p>
<p class="right">신청인의 대리인 ${esc(d.officeName || '')}<br>변호사 ${esc(d.lawyerName || '')} (인)</p>
<p class="court">${esc(d.courtName || '')} 귀중</p>
</body></html>`;
}
