import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import type { TableType } from './correctionLabels';

// ============================================================
// 회생동행 '내 보정 정리' (CR-12) — 나홀로·다른 사무소 이용자 본인용
// 법원이 보낸 보정 항목을 본인이 직접 적고, 낼 서류·표를 정리해 본인용 정리표로 인쇄한다.
// 보정서 문장 자동 작성·법률 판단 문구는 없다(제109조). 본인만 읽고 쓴다(사무소·관리자 열람 없음).
// ============================================================

export interface SelfCorrectionItem {
  id: string;
  title: string;          // 법원 요청 (본인이 옮겨 적음)
  docs: string;           // 낼 서류 메모
  note: string;           // 설명 메모
  done: boolean;
  tableType?: TableType;
  rows: Array<Record<string, string>>;
}

export interface SelfCorrection {
  id: string;
  title: string;
  courtName?: string;
  servedOn?: string;
  dueOn?: string;
  items: SelfCorrectionItem[];
  updatedAt: string;
}

type R<T> = { ok: true; data: T } | { ok: false; message: string };

const map = (r: any): SelfCorrection => ({
  id: r.id, title: r.title, courtName: r.court_name || undefined, servedOn: r.served_on || undefined, dueOn: r.due_on || undefined,
  items: Array.isArray(r.items) ? r.items : [], updatedAt: r.updated_at,
});

export async function loadSelfCorrections(): Promise<R<SelfCorrection[]>> {
  if (!isSupabaseConfigured) return { ok: false, message: '서버가 설정되지 않았어요.' };
  const { data, error } = await supabase.from('client_self_corrections').select('*').order('updated_at', { ascending: false });
  if (error) return { ok: false, message: '보정 정리를 불러오지 못했어요.' };
  return { ok: true, data: (data || []).map(map) };
}

export async function saveSelfCorrection(c: Omit<SelfCorrection, 'id' | 'updatedAt'> & { id?: string }): Promise<R<SelfCorrection>> {
  const row = { title: c.title.trim().slice(0, 80) || '보정 정리', court_name: c.courtName || null, served_on: c.servedOn || null, due_on: c.dueOn || null, items: c.items.slice(0, 60) };
  const q = c.id
    ? supabase.from('client_self_corrections').update(row).eq('id', c.id).select('*').single()
    : supabase.from('client_self_corrections').insert(row).select('*').single();
  const { data, error } = await q;
  if (error) return { ok: false, message: /limit/.test(error.message) ? '보정 정리는 20개까지 만들 수 있어요.' : '저장하지 못했어요. 인터넷 연결을 확인해 주세요.' };
  return { ok: true, data: map(data) };
}

export async function deleteSelfCorrection(id: string): Promise<R<true>> {
  const { error } = await supabase.from('client_self_corrections').delete().eq('id', id);
  if (error) return { ok: false, message: '지우지 못했어요.' };
  return { ok: true, data: true };
}
