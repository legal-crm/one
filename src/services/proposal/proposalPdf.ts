// ============================================================
// '변호사 검토 제안서' PDF 1종 (B-5e, RP-Q2) — 글자 PDF(/api/pdf, H-7)
//  * 이전: 상세 분석 7쪽(챗봇 자동 계산 리포트)·2쪽 의견서 두 가지, 둘 다 html2canvas 그림 PDF
//  * 감면율(%)은 넣지 않고 월 변제금·기간·총 변제액 중심 (RP-Q1). 갚지 않아도 되는 금액은 작게 '(예상)'
//  * 그림 4종(SVG): 변제 일정 막대, 총 채무 vs 총 변제액, 수임료 납부 일정, 절차 흐름
//  * 파일 이름에 실명 없음 (문서 번호만)
// ============================================================
import { renderTextPdf, downloadPdfBytes } from '../court/courtPdfService';

export interface ProposalPdfData {
  documentId?: string;
  issuedAt?: string;
  validDays?: number;
  lawyerName: string;
  lawyerFirmName?: string;
  clientLabel: string;           // 스텔스 가명 또는 '의뢰인'
  procedure?: string;            // 개인회생 / 개인파산
  courtName?: string;
  totalDebt?: number;
  monthlyPayment?: number;
  repaymentMonths?: number;
  totalRepayment?: number;
  lawyerOpinion?: string;
  specialNotes?: string[];
  totalFeeWon?: number;
  downPaymentWon?: number;
  monthlyInstallmentWon?: number;
  installments?: number;
  additionalCostsNotice?: string;
  includeAnalysis?: boolean;     // '상세 분석 포함'
  analysisRows?: Array<{ label: string; value: string }>;
  sealImageUrl?: string;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const won = (n?: number) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? `${Math.round(n).toLocaleString('ko-KR')}원` : '미입력');

function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function proposalDocNo(d: Pick<ProposalPdfData, 'documentId' | 'issuedAt' | 'lawyerName'>): string {
  const base = d.documentId || `${d.lawyerName}|${d.issuedAt || ''}`;
  const date = (d.issuedAt ? new Date(d.issuedAt) : new Date()).toISOString().slice(0, 10).replace(/-/g, '');
  return `MK-${date}-${stableHash(base).slice(0, 6)}`;
}

// ── 그림 (SVG, 외부 요청 없음) ──
function svgSchedule(months: number, monthly: number): string {
  const w = 640, h = 120, cols = Math.min(Math.max(months, 1), 60);
  const bw = (w - 40) / cols;
  const bars = Array.from({ length: cols }, (_, i) => `<rect x="${20 + i * bw}" y="30" width="${Math.max(bw - 1.5, 1)}" height="50" fill="${i % 12 === 11 ? '#1E3A5F' : '#93A9C6'}"/>`).join('');
  const ticks = Array.from({ length: Math.floor(cols / 12) }, (_, i) => `<text x="${20 + (i + 1) * 12 * bw - bw / 2}" y="98" font-size="10" text-anchor="middle" fill="#334155">${i + 1}년</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="변제 일정"><text x="20" y="18" font-size="11" fill="#0f172a">매달 ${esc(won(monthly))} × ${cols}개월</text>${bars}${ticks}</svg>`;
}
function svgCompare(debt: number, repay: number): string {
  const w = 640, max = Math.max(debt, repay, 1);
  const bar = (y: number, v: number, color: string, label: string) => `<text x="20" y="${y + 14}" font-size="11" fill="#0f172a">${label}</text><rect x="130" y="${y}" width="${Math.max((v / max) * 440, 2)}" height="20" fill="${color}"/><text x="${136 + (v / max) * 440}" y="${y + 14}" font-size="11" fill="#0f172a">${esc(won(v))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="80" role="img" aria-label="총 채무와 총 변제액">${bar(8, debt, '#94A3B8', '총 채무')}${bar(44, repay, '#1E3A5F', '총 변제액(예상)')}</svg>`;
}
function svgFee(down: number, monthly: number, n: number): string {
  const items = [{ l: '착수금', v: down }, ...Array.from({ length: Math.min(n, 12) }, (_, i) => ({ l: `${i + 1}회`, v: monthly }))].filter(x => x.v > 0);
  if (items.length === 0) return '';
  const w = 640, bw = (w - 40) / items.length, max = Math.max(...items.map(x => x.v));
  const bars = items.map((x, i) => `<rect x="${20 + i * bw}" y="${90 - (x.v / max) * 60}" width="${bw - 4}" height="${(x.v / max) * 60}" fill="${i === 0 ? '#1E3A5F' : '#93A9C6'}"/><text x="${20 + i * bw + (bw - 4) / 2}" y="104" font-size="9" text-anchor="middle" fill="#334155">${x.l}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="112" role="img" aria-label="수임료 납부 일정">${bars}</svg>`;
}
function svgFlow(bankruptcy: boolean): string {
  const steps = bankruptcy ? ['상담·계약', '서류 준비', '신청', '파산선고·관재', '면책 심리', '면책 결정'] : ['상담·계약', '서류 준비', '신청', '개시결정', '채권자집회·인가', '변제·면책'];
  const w = 640, bw = (w - 20) / steps.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="56" role="img" aria-label="절차 흐름">${steps.map((s, i) => `<rect x="${10 + i * bw}" y="10" width="${bw - 10}" height="32" rx="6" fill="${i === 0 ? '#1E3A5F' : '#E2E8F0'}"/><text x="${10 + i * bw + (bw - 10) / 2}" y="30" font-size="10" text-anchor="middle" fill="${i === 0 ? '#ffffff' : '#0f172a'}">${esc(s)}</text>`).join('')}</svg>`;
}

export function buildProposalPdfHtml(d: ProposalPdfData): string {
  const docNo = proposalDocNo(d);
  const issued = d.issuedAt ? new Date(d.issuedAt) : new Date();
  const validDays = d.validDays ?? 30;
  const validUntil = new Date(issued.getTime() + validDays * 86400e3);
  const ymd = (x: Date) => x.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const bankruptcy = /파산/.test(d.procedure || '');
  const notPaid = d.totalDebt && d.totalRepayment && d.totalDebt > d.totalRepayment ? d.totalDebt - d.totalRepayment : 0;
  const notes = (d.specialNotes || []).filter(Boolean);
  const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>변호사 검토 제안서</title>
<style>
  body { margin: 0; color: #0f172a; font-family: 'NanumGothic', sans-serif; font-size: 11pt; line-height: 1.6; }
  .page { padding: 18mm 18mm 16mm; }
  h1 { font-family: 'NanumMyeongjo', serif; font-size: 20pt; margin: 0 0 4mm; letter-spacing: 0.04em; }
  h2 { font-size: 12.5pt; margin: 8mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1px solid #cbd5e1; }
  .meta { font-size: 9.5pt; color: #334155; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 2.2mm 3mm; text-align: left; vertical-align: top; }
  th { width: 34%; background: #f1f5f9; font-weight: 700; }
  .key td { font-size: 13pt; font-weight: 700; }
  .small { font-size: 9pt; color: #475569; }
  .opinion { white-space: pre-wrap; border: 1px solid #cbd5e1; padding: 4mm; border-radius: 2mm; }
  .sign { margin-top: 10mm; text-align: right; }
  .sign img { height: 18mm; vertical-align: middle; }
  .box { border: 1px solid #e2e8f0; border-radius: 2mm; padding: 3mm; margin-top: 3mm; }
  .notice { margin-top: 8mm; font-size: 8.5pt; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 3mm; }
</style></head><body><div class="page">
  <h1>변호사 검토 제안서${d.includeAnalysis ? ' <span style="font-size:11pt;font-weight:400;">(상세 분석 포함)</span>' : ''}</h1>
  <p class="meta">문서 번호 ${esc(docNo)} · 작성일 ${esc(ymd(issued))} · 유효기간 ${esc(ymd(validUntil))}까지(${validDays}일)</p>
  <table>
    ${row('받는 분', d.clientLabel)}
    ${row('검토 변호사', `${d.lawyerName}${d.lawyerFirmName ? ` (${d.lawyerFirmName})` : ''}`)}
    ${row('검토한 절차', d.procedure || '개인회생')}
    ${d.courtName ? row('예상 관할', d.courtName) : ''}
  </table>

  <h2>1. 변제 계획 검토 결과</h2>
  <table class="key">
    ${row('월 변제금(예상)', won(d.monthlyPayment))}
    ${row('변제 기간(예상)', d.repaymentMonths ? `${d.repaymentMonths}개월` : '미입력')}
    ${row('총 변제액(예상)', won(d.totalRepayment))}
  </table>
  <table style="margin-top:2mm">
    ${row('총 채무(신고 기준)', won(d.totalDebt))}
    ${notPaid ? row('갚지 않아도 되는 금액(예상)', won(notPaid)) : ''}
  </table>
  ${d.monthlyPayment && d.repaymentMonths ? `<div class="box">${svgSchedule(d.repaymentMonths, d.monthlyPayment)}</div>` : ''}
  ${d.totalDebt && d.totalRepayment ? `<div class="box">${svgCompare(d.totalDebt, d.totalRepayment)}</div>` : ''}
  <p class="small">위 금액은 지금까지 받은 자료로 변호사가 검토한 예상이에요. 법원 심사·채권 확정·소득과 생계비 인정 범위에 따라 달라질 수 있어요.</p>

  ${d.includeAnalysis && d.analysisRows && d.analysisRows.length ? `<h2>2. 검토 근거</h2><table>${d.analysisRows.map(r => row(r.label, r.value)).join('')}</table>` : ''}

  <h2>${d.includeAnalysis ? '3' : '2'}. 변호사 소견</h2>
  <div class="opinion">${esc(d.lawyerOpinion || '작성되지 않았어요.')}</div>
  ${notes.length ? `<div class="box"><b>확인할 점</b><ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}

  <h2>${d.includeAnalysis ? '4' : '3'}. 수임료 안내</h2>
  <table>
    ${row('총 수임료', won(d.totalFeeWon))}
    ${d.downPaymentWon ? row('착수금', won(d.downPaymentWon)) : ''}
    ${d.installments && d.monthlyInstallmentWon ? row('분할 납부', `${won(d.monthlyInstallmentWon)} × ${d.installments}회`) : ''}
  </table>
  ${d.downPaymentWon || d.monthlyInstallmentWon ? `<div class="box">${svgFee(d.downPaymentWon || 0, d.monthlyInstallmentWon || 0, d.installments || 0)}</div>` : ''}
  <p class="small">${esc(d.additionalCostsNotice || '인지대·송달료 등 법원 실비는 별도예요.')} 수임료는 사무소에 직접 내며, 마이김변은 수임료를 받거나 중개하지 않아요.</p>

  <h2>${d.includeAnalysis ? '5' : '4'}. 진행 순서</h2>
  <div class="box">${svgFlow(bankruptcy)}</div>

  <div class="sign">${esc(d.lawyerFirmName || '')} 변호사 ${esc(d.lawyerName)} ${d.sealImageUrl && d.sealImageUrl.startsWith('data:') ? `<img src="${d.sealImageUrl}" alt="직인">` : '(인)'}</div>
  <p class="notice">이 제안서는 변호사가 받은 자료를 검토해 작성한 것으로, 수임 계약을 맺기 전의 안내예요. 결과를 보장하지 않으며, 계약은 의뢰인이 직접 고른 변호사와 따로 맺어요. 마이김변은 광고·정보 제공 플랫폼이며 변호사를 소개·알선하지 않아요.</p>
</div></body></html>`;
}

export async function downloadProposalPdf(d: ProposalPdfData): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await renderTextPdf(buildProposalPdfHtml(d), { title: '변호사 검토 제안서', pageNumbers: true });
  if (r.ok === false) return r;
  downloadPdfBytes(r.bytes, `변호사검토제안서_${proposalDocNo(d)}.pdf`);
  return { ok: true };
}
