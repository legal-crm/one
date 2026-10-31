// ============================================================
// 변호사 '마이김변 문의' 첨부 — 비공개 저장소 inquiry-files (CT-8)
// 경로 lawyer/{변호사 계정}/{문의 번호}/{n}.{확장자}, 보기는 그 변호사와 관리자만 (5분 주소)
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import type { InquiryAttachment } from '../../types';

const BUCKET = 'inquiry-files';
export const LAWYER_INQUIRY_MAX_BYTES = 3 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

export function isAllowedInquiryFile(file: File): boolean {
  return Boolean(EXT[file.type]) && file.size <= LAWYER_INQUIRY_MAX_BYTES;
}

export async function uploadLawyerInquiryFiles(lawyerId: string, inquiryId: string, files: File[]): Promise<{ ok: true; data: InquiryAttachment[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const safeLawyer = lawyerId.replace(/[^A-Za-z0-9_-]/g, '');
  const safeInq = inquiryId.replace(/[^A-Za-z0-9_-]/g, '');
  const out: InquiryAttachment[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    if (!isAllowedInquiryFile(f)) return { ok: false, message: `'${f.name}'은(는) 올릴 수 없어요 (이미지·PDF, 3MB 이하).` };
    const path = `lawyer/${safeLawyer}/${safeInq}/${i + 1}.${EXT[f.type]}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
    if (error) {
      if (out.length) await supabase.storage.from(BUCKET).remove(out.map(a => a.path!).filter(Boolean)).catch(() => undefined);
      return { ok: false, message: /row-level security|policy/i.test(error.message) ? '내 변호사 계정으로만 첨부를 올릴 수 있어요.' : '첨부를 올리지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }
    out.push({ id: `att-${i + 1}`, fileName: f.name.slice(0, 120), fileType: f.type, fileSize: f.size, dataUrl: '', path });
  }
  return { ok: true, data: out };
}

/** 저장소 첨부의 5분 주소 (예전 base64 첨부는 그대로) */
export async function signInquiryAttachments(list: InquiryAttachment[]): Promise<Record<string, string>> {
  const paths = list.map(a => a.path).filter((p): p is string => !!p);
  if (!isSupabaseConfigured || paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 300);
  const out: Record<string, string> = {};
  (data || []).forEach(u => { if (u?.path && u.signedUrl) out[u.path] = u.signedUrl; });
  return out;
}
