// ============================================================
// 사무소 → 의뢰인 앱 안 안내 (CM-3)
// 이전: 변호사 화면이 addClientNotification으로 '변호사 브라우저'에 알림을 저장해 의뢰인에게는 가지 않았다.
// 이제: 서버 함수 office_notify_case_client가 그 사건 의뢰인 계정에 알림을 만든다(권한·사건 소속 확인).
// 결과는 화면에 그대로 알린다(보냄 / 의뢰인 계정 미연결 / 실패).
// ============================================================
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { getCrmOfficeScope } from '../crmService';
import { rpcErrorMessage } from '../office/rpcResult';

export type CaseClientNoticeKind = 'office_notice' | 'office_status' | 'office_document' | 'office_fee' | 'office_schedule';

export interface CaseClientNoticeResult {
  ok: boolean;
  /** 의뢰인 계정에 알림이 만들어졌는지 (계정이 연결되지 않은 사건이면 false) */
  delivered: boolean;
  message: string;
}

const RULES: Array<[RegExp, string]> = [
  [/resident number/i, '주민등록번호는 안내에 넣을 수 없어요.'],
  [/too many notices/i, '이 사건에 1시간 안에 보낸 안내가 너무 많아요. 잠시 뒤 다시 보내 주세요.'],
  [/case not found/i, '우리 사무소 사건에서 찾지 못했어요.'],
  [/invalid length/i, '안내 제목은 2~120자, 내용은 300자까지예요.'],
];

export async function notifyCaseClient(params: {
  caseKey: string;
  kind: CaseClientNoticeKind;
  title: string;
  body?: string;
  officeId?: string | null;
}): Promise<CaseClientNoticeResult> {
  const officeId = (params.officeId || getCrmOfficeScope() || '').trim();
  if (!isSupabaseConfigured || !supabase || !officeId) {
    return { ok: false, delivered: false, message: '서버 사무소에 연결되지 않아 의뢰인에게 안내를 보내지 못했어요.' };
  }
  const { data, error } = await supabase.rpc('office_notify_case_client', {
    p_office_id: officeId,
    p_key: params.caseKey,
    p_kind: params.kind,
    p_title: params.title.slice(0, 120),
    p_body: (params.body || '').slice(0, 300) || null,
  });
  if (error) {
    const raw = error.message || '';
    const rule = RULES.find(([re]) => re.test(raw));
    return { ok: false, delivered: false, message: rule ? rule[1] : rpcErrorMessage(error) };
  }
  const delivered = Boolean((data as { delivered?: boolean } | null)?.delivered);
  return {
    ok: true,
    delivered,
    message: delivered ? '의뢰인 앱에 안내를 보냈어요.' : '의뢰인 계정이 연결되지 않은 사건이라 앱 안내는 가지 않았어요.',
  };
}

/** 단계 화면용: 보내고 결과를 토스트로 알린다 (성공은 조용히 넘어가지 않게 짧게 표시) */
export async function notifyCaseClientWithToast(params: Parameters<typeof notifyCaseClient>[0]): Promise<CaseClientNoticeResult> {
  const res = await notifyCaseClient(params);
  if (!res.ok) toast.error(res.message);
  else if (!res.delivered) toast.info(res.message);
  else toast.success(res.message);
  return res;
}
