// 변호사 프로필 사진 → 저장소 'lawyer-photos' (LD-4)
// 사진은 긴 변 800px JPEG로 줄여 올리고, 프로필에는 공개 주소만 저장한다
// (이전: base64 글자를 avatar·avatar_data 두 칸에 통째로 저장해 목록을 읽을 때마다 수 MB가 오갔다)
import { supabase, isSupabaseConfigured } from '../../supabaseClient';

const MAX_SIDE = 800;

async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지를 읽지 못했어요.'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지를 줄이지 못했어요.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('이미지를 줄이지 못했어요.'))), 'image/jpeg', 0.86));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** @returns 공개 주소 (서버 미설정 개발 환경은 이 기기 미리보기 주소) */
export async function uploadLawyerPhoto(lawyerId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const blob = await shrink(file);
    if (!isSupabaseConfigured) return { ok: true, url: URL.createObjectURL(blob) };
    const safeId = lawyerId.replace(/[^A-Za-z0-9_-]/g, '');
    if (!safeId) return { ok: false, message: '변호사 계정을 확인하지 못했어요.' };
    const path = `${safeId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('lawyer-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      return { ok: false, message: /row-level security|policy/i.test(error.message) ? '내 변호사 계정 사진만 올릴 수 있어요.' : `사진을 올리지 못했어요: ${error.message}` };
    }
    const { data } = supabase.storage.from('lawyer-photos').getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : '사진을 올리지 못했어요.' };
  }
}
