import type { CaseExhibit, CorrectionItem, CorrectionOrder } from './correctionService';
import { CANNOT_REASON_LABEL, KIND_LABEL } from './correctionLabels';
import { CORRECTION_TABLES, cleanRows, formatMoneyCell } from './correctionTables';

// ============================================================
// 요약보정서 구성 (CR-7)
// 법원 항목 순서대로: 항목 번호 · 답변(변호사 문안) · 소명자료 번호 · 못 낸 사유 → 뒤에 별지 표 → 첨부 목록.
// 의뢰인 답은 '자료'다. 보정서 문장은 변호사가 쓴 answer_text 만 들어간다 (CR-Q2).
// ============================================================

export interface BriefHeader {
  caseNumber?: string;
  applicantName?: string;
  courtName?: string;
  lawyerName?: string;
  officeName?: string;
  date?: string;
}

export interface BriefSection {
  label: string;
  answer: string;
  exhibits: string[];
  annexNo?: number;
  missingReason?: string;
  warning?: string;
}

export interface BriefModel {
  title: string;
  header: BriefHeader;
  intro: string;
  sections: BriefSection[];
  annexes: Array<{ no: number; title: string; columns: string[]; rows: string[][] }>;
  attachments: string[];
  closing: string;
  warnings: string[];
}

const exhibitLabel = (n: number) => `소갑 제${n}호증`;

export function buildCorrectionBrief(order: CorrectionOrder, items: CorrectionItem[], exhibits: CaseExhibit[], header: BriefHeader): BriefModel {
  const sorted = [...items].sort((a, b) => a.seq - b.seq);
  const annexes: BriefModel['annexes'] = [];
  const warnings: string[] = [];
  const sections: BriefSection[] = sorted.map(it => {
    const s: BriefSection = { label: it.label || String(it.seq), answer: (it.answerText || '').trim(), exhibits: it.exhibitNumbers.map(exhibitLabel) };
    if (it.tableType) {
      const rows = cleanRows(it.tableType, it.tableRows);
      if (rows.length > 0) {
        const def = CORRECTION_TABLES[it.tableType];
        const no = annexes.length + 1;
        annexes.push({
          no, title: def.title, columns: def.columns.map(c => c.label),
          rows: rows.map(r => def.columns.map(c => (c.kind === 'money' ? formatMoneyCell(r[c.key]) : r[c.key] || ''))),
        });
        s.annexNo = no;
        s.answer = s.answer.replace(/별지\s*○/g, `별지 ${no}`);
      }
    }
    s.answer = s.answer.replace(/소갑\s*제\s*○\s*호증/g, s.exhibits.join(', ') || '소갑 제○호증');
    if (it.status === 'cannot_submit') {
      s.missingReason = `${CANNOT_REASON_LABEL[it.cannotReason || 'other']}${it.cannotNote ? ` (${it.cannotNote})` : ''}${it.expectedOn ? ` · 발급 예정일 ${it.expectedOn}` : ''}`;
    }
    if (!s.answer) {
      s.warning = '답변 문안이 비어 있어요';
      warnings.push(`${s.label}번 항목 답변 문안이 비어 있어요.`);
    } else if (/○/.test(s.answer)) {
      s.warning = '채우지 않은 ○ 표시가 있어요';
      warnings.push(`${s.label}번 항목에 채우지 않은 ○ 표시가 있어요.`);
    }
    if (!['confirmed', 'office_done', 'cannot_submit'].includes(it.status)) {
      warnings.push(`${s.label}번 항목이 아직 확인 완료가 아니에요.`);
    }
    return s;
  });

  const used = new Set(sorted.flatMap(i => i.exhibitNumbers));
  const attachments = exhibits.filter(e => used.has(e.number)).map(e => `${exhibitLabel(e.number)} ${e.title}`);
  const kind = KIND_LABEL[order.kind];
  return {
    title: '보 정 서',
    header,
    intro: order.brief.intro?.trim()
      || `위 사건에 관하여 신청인은 ${order.servedOn.replace(/-/g, '. ')}. 송달받은 ${order.round}차 ${kind}에 따라 다음과 같이 보정합니다.`,
    sections,
    annexes,
    attachments: [...attachments, ...(order.brief.attachments || [])],
    closing: order.brief.closing?.trim() || '',
    warnings,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nl = (s: string) => esc(s).replace(/\n/g, '<br>');

/** 인쇄용 HTML (A4, 글자 그대로 — 브라우저 인쇄로 글자 검색 가능한 PDF가 된다) */
export function renderCorrectionBriefHtml(m: BriefModel): string {
  const h = m.header;
  const head = [
    h.caseNumber ? `<tr><th>사 건</th><td>${esc(h.caseNumber)}</td></tr>` : '',
    h.applicantName ? `<tr><th>신 청 인</th><td>${esc(h.applicantName)}</td></tr>` : '',
  ].join('');
  const sections = m.sections.map(s => `
    <section class="item">
      <h3>${esc(s.label)}.</h3>
      <p>${s.answer ? nl(s.answer) : '<span class="todo">(답변 문안을 입력하세요)</span>'}</p>
      ${s.missingReason ? `<p class="missing">제출하지 못한 사유: ${esc(s.missingReason)}</p>` : ''}
      ${s.exhibits.length ? `<p class="ex">소명자료: ${esc(s.exhibits.join(', '))}</p>` : ''}
    </section>`).join('');
  const annexes = m.annexes.map(a => `
    <section class="annex">
      <h3>[별지 ${a.no}] ${esc(a.title)}</h3>
      <table><thead><tr>${a.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${a.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </section>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보정서</title>
<style>
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: 'Batang', 'Nanum Myeongjo', serif; font-size: 12pt; line-height: 1.8; color: #000; }
  h1 { text-align: center; font-size: 20pt; letter-spacing: 8pt; margin: 0 0 18pt; }
  table.head { border-collapse: collapse; margin-bottom: 14pt; } table.head th { text-align: left; padding-right: 16pt; font-weight: normal; }
  .item h3, .annex h3 { font-size: 12pt; margin: 12pt 0 4pt; }
  .missing { color: #333; } .ex { font-size: 11pt; } .todo { color: #b00; }
  .annex { page-break-before: always; } .annex table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  .annex th, .annex td { border: 1px solid #000; padding: 3pt 4pt; vertical-align: top; }
  .attach { margin-top: 16pt; } .sign { margin-top: 28pt; text-align: right; }
  .court { margin-top: 28pt; text-align: center; font-size: 14pt; }
</style></head><body>
<h1>${esc(m.title)}</h1>
<table class="head">${head}</table>
<p>${nl(m.intro)}</p>
${sections}
${m.closing ? `<p>${nl(m.closing)}</p>` : ''}
${m.attachments.length ? `<div class="attach"><p>첨 부 서 류</p><ol>${m.attachments.map(a => `<li>${esc(a)}</li>`).join('')}</ol></div>` : ''}
<div class="sign"><p>${esc(h.date || '')}</p><p>신청인의 대리인 ${esc(h.officeName || '')} 변호사 ${esc(h.lawyerName || '')} (인)</p></div>
${h.courtName ? `<p class="court">${esc(h.courtName)} 귀중</p>` : ''}
${annexes}
</body></html>`;
}
