// ============================================================
// 채권자 일괄 발송 (NF-4, 20261101002000_creditor_dispatches)
// 대리인 선임 통지서·부채증명서 발급 요청서를 채권자마다 글자 PDF로 만들어 사건 서류함에 두고,
// 보낸 날·방법·접수 번호·결과·회신을 기록한다. 부채증명 장부 줄과 연결하면 장부 상태가 같이 바뀐다(서버 트리거).
// 주민등록번호는 문서·기록에 넣지 않는다(L8). 팩스 자동 발송은 발신번호 등록 방식이 정해진 뒤 연다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { escapeHtml as esc } from '../court/CourtFormHtmlBuilder';

export type DispatchDocKind = 'appointment_notice' | 'debt_cert_request';
export type DispatchMethod = 'fax' | 'mail' | 'email' | 'visit' | 'other';
export type DispatchStatus = 'prepared' | 'sent' | 'failed' | 'replied';

export const DOC_KIND_LABEL: Record<DispatchDocKind, string> = {
  appointment_notice: '대리인 선임 통지서',
  debt_cert_request: '부채증명서 발급 요청서',
};
export const METHOD_LABEL: Record<DispatchMethod, string> = { fax: '팩스', mail: '우편', email: '이메일', visit: '방문', other: '기타' };
export const STATUS_LABEL: Record<DispatchStatus, string> = { prepared: '문서 준비', sent: '보냄', failed: '못 보냄', replied: '회신 받음' };

export interface CreditorDispatch {
  id: string;
  creditorKey: string;
  creditorName: string;
  registryId: string | null;
  docKinds: DispatchDocKind[];
  method: DispatchMethod;
  recipient: string;
  status: DispatchStatus;
  sentOn: string | null;
  receiptNo: string | null;
  resultNote: string | null;
  repliedOn: string | null;
  fileId: string | null;
  filePath: string | null;
  debtCertificateId: string | null;
  createdAt: string;
}

type R<T> = { ok: true; data: T } | { ok: false; message: string };

const fromRow = (r: any): CreditorDispatch => ({
  id: r.id, creditorKey: r.creditor_key, creditorName: r.creditor_name, registryId: r.registry_id ?? null,
  docKinds: (r.doc_kinds || []) as DispatchDocKind[], method: r.method, recipient: r.recipient || '', status: r.status,
  sentOn: r.sent_on ?? null, receiptNo: r.receipt_no ?? null, resultNote: r.result_note ?? null, repliedOn: r.replied_on ?? null,
  fileId: r.file_id ?? null, filePath: r.file_path ?? null, debtCertificateId: r.debt_certificate_id ?? null, createdAt: r.created_at,
});

const errMsg = (e: any, fallback: string) => {
  const m = String(e?.message || '');
  if (/sent date required/.test(m)) return '보낸 날짜를 넣어 주세요.';
  if (/reply date required/.test(m)) return '회신 받은 날짜를 넣어 주세요.';
  if (/reply before sent/.test(m)) return '회신일이 보낸 날보다 빨라요.';
  if (/cannot reopen/.test(m)) return '보낸 기록은 준비 상태로 되돌릴 수 없어요.';
  if (/permission|policy|42501/.test(m)) return '이 사건의 서류를 관리할 권한이 없어요.';
  return fallback;
};

export async function loadDispatches(officeId: string, caseKey: string): Promise<R<CreditorDispatch[]>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.from('creditor_dispatches').select('*').eq('office_id', officeId).eq('case_key', caseKey).order('created_at', { ascending: false });
  if (error) return { ok: false, message: errMsg(error, '발송 기록을 불러오지 못했어요.') };
  return { ok: true, data: (data || []).map(fromRow) };
}

export async function addDispatch(officeId: string, caseKey: string, d: {
  creditorKey: string; creditorName: string; registryId?: string | null; docKinds: DispatchDocKind[]; method: DispatchMethod;
  recipient: string; fileId?: string | null; filePath?: string | null; debtCertificateId?: string | null;
}): Promise<R<CreditorDispatch>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.from('creditor_dispatches').insert({
    office_id: officeId, case_key: caseKey, creditor_key: d.creditorKey.slice(0, 120), creditor_name: d.creditorName.slice(0, 120),
    registry_id: d.registryId || null, doc_kinds: d.docKinds, method: d.method, recipient: d.recipient.slice(0, 200),
    file_id: d.fileId || null, file_path: d.filePath || null, debt_certificate_id: d.debtCertificateId || null,
  }).select('*').single();
  if (error) return { ok: false, message: errMsg(error, '발송 기록을 만들지 못했어요.') };
  return { ok: true, data: fromRow(data) };
}

export async function updateDispatch(id: string, patch: Partial<Pick<CreditorDispatch, 'status' | 'sentOn' | 'receiptNo' | 'resultNote' | 'repliedOn' | 'method' | 'recipient'>>): Promise<R<CreditorDispatch>> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.sentOn !== undefined) row.sent_on = patch.sentOn;
  if (patch.receiptNo !== undefined) row.receipt_no = patch.receiptNo ? patch.receiptNo.slice(0, 60) : null;
  if (patch.resultNote !== undefined) row.result_note = patch.resultNote ? patch.resultNote.slice(0, 500) : null;
  if (patch.repliedOn !== undefined) row.replied_on = patch.repliedOn;
  if (patch.method !== undefined) row.method = patch.method;
  if (patch.recipient !== undefined) row.recipient = patch.recipient.slice(0, 200);
  const { data, error } = await supabase.from('creditor_dispatches').update(row).eq('id', id).select('*').single();
  if (error) return { ok: false, message: errMsg(error, '저장하지 못했어요.') };
  return { ok: true, data: fromRow(data) };
}

export async function deletePreparedDispatch(id: string): Promise<R<true>> {
  const { error, count } = await supabase.from('creditor_dispatches').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) return { ok: false, message: '준비만 한 기록만 지울 수 있어요.' };
  return { ok: true, data: true };
}

// ── 문서 문안 ──
export interface DispatchDocInput {
  creditorName: string;
  creditorAddress?: string;
  creditorFax?: string;
  debtorName: string;
  /** 생년월일 (선택, YYYY-MM-DD). 주민등록번호는 받지 않는다 */
  debtorBirth?: string;
  procedure: 'rehab' | 'bankruptcy';
  courtName?: string;
  office: { firmName: string; lawyerName: string; address: string; phone: string; fax: string; email: string };
  /** 부채증명서 산정기준일 (기본 오늘) */
  baseDate?: string;
  issuedOn: string;
  sealImage?: string | null;
}

const RRN = /\d{6}\s*-?\s*[1-8]\d{6}/;
export function hasResidentNumber(s: string): boolean { return RRN.test(s); }

const fmtDate = (ymd?: string) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${y}. ${Number(m)}. ${Number(d)}.` : ymd;
};

function senderBlock(i: DispatchDocInput): string {
  const o = i.office;
  return `<table class="kv">
    <tr><th>대리인</th><td>${esc(o.firmName || '')} 변호사 ${esc(o.lawyerName || '')}</td></tr>
    <tr><th>주소</th><td>${esc(o.address || '')}</td></tr>
    <tr><th>전화 · 팩스</th><td>${esc(o.phone || '')}${o.fax ? ` · 팩스 ${esc(o.fax)}` : ''}</td></tr>
    ${o.email ? `<tr><th>이메일</th><td>${esc(o.email)}</td></tr>` : ''}
  </table>`;
}

function recipientBlock(i: DispatchDocInput): string {
  return `<table class="kv">
    <tr><th>수신</th><td>${esc(i.creditorName)} 귀중</td></tr>
    ${i.creditorAddress ? `<tr><th>주소</th><td>${esc(i.creditorAddress)}</td></tr>` : ''}
    ${i.creditorFax ? `<tr><th>팩스</th><td>${esc(i.creditorFax)}</td></tr>` : ''}
  </table>`;
}

function debtorBlock(i: DispatchDocInput): string {
  return `<table class="kv">
    <tr><th>채무자</th><td>${esc(i.debtorName)}${i.debtorBirth ? ` (생년월일 ${esc(fmtDate(i.debtorBirth))})` : ''}</td></tr>
    <tr><th>사건</th><td>${i.procedure === 'bankruptcy' ? '개인파산·면책 신청' : '개인회생 신청'}${i.courtName ? ` (${esc(i.courtName)} 예정)` : ''}</td></tr>
  </table>`;
}

function sealLine(i: DispatchDocInput): string {
  return `<p class="sign">${esc(fmtDate(i.issuedOn))}</p>
  <p class="sign">위 대리인 ${esc(i.office.firmName || '')} 변호사 ${esc(i.office.lawyerName || '')}${i.sealImage ? ` <img src="${esc(i.sealImage)}" alt="" class="seal" />` : ''}</p>`;
}

export function appointmentNoticeHtml(i: DispatchDocInput): string {
  return `<section class="page">
  <h1>대리인 선임 통지서</h1>
  ${recipientBlock(i)}
  ${debtorBlock(i)}
  ${senderBlock(i)}
  <ol class="body">
    <li>본 대리인은 위 채무자로부터 ${i.procedure === 'bankruptcy' ? '개인파산·면책' : '개인회생'} 신청 사건을 위임받았음을 알려 드립니다.</li>
    <li>「채권의 공정한 추심에 관한 법률」 제8조의2에 따라, 위 채무와 관련한 연락은 채무자 본인이 아닌 본 대리인에게 해 주시기 바랍니다.</li>
    <li>채무 내역 확인이 필요하시면 위 대리인 연락처로 문의해 주십시오.</li>
  </ol>
  ${sealLine(i)}
  <p class="foot">첨부: 위임장 사본 1부 (사무소가 따로 첨부)</p>
</section>`;
}

export function debtCertRequestHtml(i: DispatchDocInput): string {
  return `<section class="page">
  <h1>부채증명서 발급 요청서</h1>
  ${recipientBlock(i)}
  ${debtorBlock(i)}
  ${senderBlock(i)}
  <p class="lead">위 채무자에 대한 법원 제출용 부채증명서 발급을 요청드립니다.</p>
  <table class="grid">
    <tr><th>산정기준일</th><td>${esc(fmtDate(i.baseDate || i.issuedOn))}</td></tr>
    <tr><th>기재 요청 사항</th><td>채권별 대출일·최초 대출금, 남은 원금, 이자·연체이자(지연손해금), 가지급금·비용, 합계, 약정이율·연체이율, 보증·대위변제·채권양도 여부</td></tr>
    <tr><th>회신처</th><td>${esc(i.office.fax ? `팩스 ${i.office.fax}` : '')}${i.office.fax && i.office.address ? ' 또는 ' : ''}${esc(i.office.address ? `우편 ${i.office.address}` : '')}${i.office.email ? ` · 이메일 ${esc(i.office.email)}` : ''}</td></tr>
  </table>
  <p class="note">발급 수수료가 있으면 위 대리인 연락처로 알려 주십시오.</p>
  ${sealLine(i)}
  <p class="foot">첨부: 위임장 1부 (사무소가 따로 첨부)</p>
</section>`;
}

export const DISPATCH_DOC_CSS = `
  .page { page-break-after: always; padding: 4mm 2mm; font-size: 11.5pt; line-height: 1.7; }
  .page:last-child { page-break-after: auto; }
  h1 { text-align: center; font-size: 20pt; letter-spacing: 6pt; margin: 4mm 0 8mm; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; }
  .kv th { width: 26mm; text-align: left; font-weight: 700; padding: 1.2mm 2mm; vertical-align: top; }
  .kv td { padding: 1.2mm 2mm; }
  .grid th, .grid td { border: 1px solid #333; padding: 2mm 3mm; text-align: left; vertical-align: top; }
  .grid th { width: 32mm; background: #f2f2f2; }
  .body { margin: 6mm 0; padding-left: 6mm; }
  .body li { margin-bottom: 2.5mm; }
  .lead { margin: 6mm 0 3mm; }
  .note { font-size: 10pt; color: #333; }
  .sign { text-align: right; margin: 2mm 0; }
  .seal { width: 18mm; height: 18mm; vertical-align: middle; }
  .foot { margin-top: 10mm; font-size: 10pt; }
`;

export function dispatchDocsHtml(i: DispatchDocInput, kinds: DispatchDocKind[]): string {
  const parts: string[] = [];
  if (kinds.includes('appointment_notice')) parts.push(appointmentNoticeHtml(i));
  if (kinds.includes('debt_cert_request')) parts.push(debtCertRequestHtml(i));
  return parts.join('\n');
}

export function wrapDispatchHtml(body: string, title: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page { size: A4; margin: 18mm 18mm; }
  body { font-family: 'NanumMyeongjo', 'Nanum Myeongjo', serif; color: #111; }
  ${DISPATCH_DOC_CSS}
  </style></head><body>${body}</body></html>`;
}
