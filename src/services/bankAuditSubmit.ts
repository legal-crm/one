// 의뢰인 '금융거래 사용처 소명표' 제출 (CR-5)
// 작성 중 표는 의뢰인 기기에 임시 저장(초안)하고, 제출하면 글자 PDF를 만들어 사건 서류함(case-files, 의뢰인 폴더)에 올린다.
// 사무소는 '서류 자료함'에서 바로 열어 보고 확인·다시 요청을 한다.
import type { BankStatementAuditData } from '../types/bankAuditTypes';
import { buildAuditStatementHtml } from './bankAuditService';
import { renderTextPdf } from './court/courtPdfService';
import { submitClientDocument } from './crmService';
import type { DocumentFile } from '../types';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export async function submitBankAuditToOffice(
  requestId: string | undefined,
  data: BankStatementAuditData,
  meta: { clientName: string; caseNumber?: string; courtName?: string }
): Promise<{ ok: boolean; message?: string }> {
  if (!requestId || requestId === 'client-self') {
    return { ok: false, message: '상담을 맡은 사무소가 없어 보낼 곳이 없어요. 표는 이 기기에 저장돼 있어요.' };
  }
  const html = buildAuditStatementHtml(data.items || [], {
    clientName: meta.clientName,
    caseNumber: meta.caseNumber,
    courtName: meta.courtName,
    thresholdAmount: data.thresholdAmount || 1000000,
  });
  const pdf = await renderTextPdf(html, { title: '금융거래 사용처 소명표' });
  if (pdf.ok === false) return { ok: false, message: pdf.message || 'PDF를 만들지 못했어요.' };
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const file: DocumentFile = {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `금융거래_사용처_소명표_${ymd}.pdf`,
    category: 'other',
    uploadedAt: d.toISOString(),
    uploadedBy: '의뢰인',
    fileSize: pdf.bytes.length,
    mimeType: 'application/pdf',
    dataUrl: `data:application/pdf;base64,${bytesToBase64(pdf.bytes)}`,
    uploadSource: 'client',
    reviewStatus: 'submitted',
  } as DocumentFile;
  try {
    await submitClientDocument(requestId, file);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || '사건 서류함에 올리지 못했어요.' };
  }
}
