// 변호사 등록증 비공개 저장소 (OP-8, 20261101002700)
// 등록증은 'lawyer-licenses' 비공개 버킷의 내 변호사 계정 폴더에 올리고, 프로필에는 경로(licenseImagePath)만 둔다.
// 등록번호 확인 30일 뒤 서버가 파일을 지운다.
import { supabase, isSupabaseConfigured } from '../../supabaseClient';

const BUCKET = 'lawyer-licenses';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function uploadLawyerLicense(lawyerId: string, file: File): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않아 등록증을 올리지 못했어요.' };
  if (!ALLOWED.includes(file.type)) return { ok: false, message: 'JPG·PNG·WEBP 사진이나 PDF만 올릴 수 있어요.' };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: '파일이 5MB를 넘어요. 더 작은 파일을 골라 주세요.' };
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${lawyerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    return { ok: false, message: /row-level security|unauthorized|403/i.test(error.message || '') ? '변호사 가입 계정으로 로그인한 뒤 다시 올려 주세요.' : '등록증을 서버에 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
  return { ok: true, path };
}

/** 5분짜리 열람 주소 (본인·관리자만 열 수 있음) */
export async function getLawyerLicenseUrl(path: string | undefined): Promise<string | null> {
  if (!isSupabaseConfigured || !path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
