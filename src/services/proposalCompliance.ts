// ============================================================
// 의뢰인 발송 문구 규칙 (ST-6, 이전 '상담 스타일 프로필' 대체)
// 공통 사전(사무소가 뺄 수 없음) + 사무소 추가 단어(서버 office_settings.copy_rules)로
// 의뢰인에게 보내는 글을 보내기 전에 검사한다. 기본은 '권고'(경고 + 사유 적고 그대로 보내기 + 기록),
// 사무소가 '엄격'으로 바꾸면 그대로 보내기를 막는다.
// (이전: 금지 표현이 브라우저(localStorage)에만 저장돼 다른 기기·직원에게 적용되지 않았다)
// ============================================================
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { CLIENT_COPY_TERMS } from '../../api/_lib/compliance-terms.js';

/** 변호사 광고규정상 문제 소지가 큰 공통 표현 (결과 보장·과장·알선 오해) — 공통 사전 api/_lib/compliance-terms.js (M-9) */
export const DEFAULT_PROHIBITED_EXPRESSIONS: string[] = [...CLIENT_COPY_TERMS];

/** 공개 Q&A 검사 기본 목록 — 서버 qna_flagged_terms와 같아야 해서 따로 고정 (바꾸면 서버 함수도 같이) */
export const QNA_BASE_TERMS = ['100% 보장', '100% 비밀 보장', '인가 보장', '면책 보장', '무조건', '확실히', '반드시 인가', '전격 면책', '획기적', '완벽히 방어'];

export type CopyRuleMode = 'advisory' | 'strict';
export interface OfficeCopyRules {
  /** 사무소가 더한 금지 표현 */
  extraTerms: string[];
  mode: CopyRuleMode;
  /** 제안서·의견서 끝에 붙는 사무소 고지 문구 */
  requiredNotice?: string;
}

let officeRules: OfficeCopyRules = { extraTerms: [], mode: 'advisory' };
let rulesOfficeId = '';

/** 로그인한 사무소의 규칙을 서버에서 읽어 둔다 (실패하면 공통 사전만) */
export async function loadOfficeCopyRules(officeId?: string | null): Promise<void> {
  rulesOfficeId = officeId || '';
  officeRules = { extraTerms: [], mode: 'advisory' };
  if (!officeId || !isSupabaseConfigured) return;
  const { data } = await supabase.from('office_settings').select('data').eq('office_id', officeId).eq('section', 'copy_rules').maybeSingle();
  if (data?.data) setOfficeCopyRules(data.data as Partial<OfficeCopyRules>);
}

export function setOfficeCopyRules(r: Partial<OfficeCopyRules>) {
  officeRules = {
    extraTerms: Array.isArray(r.extraTerms) ? r.extraTerms.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()).slice(0, 100) : [],
    mode: r.mode === 'strict' ? 'strict' : 'advisory',
    requiredNotice: typeof r.requiredNotice === 'string' ? r.requiredNotice.slice(0, 1000) : undefined,
  };
}

export function getOfficeCopyRules(): OfficeCopyRules { return officeRules; }

export function loadProhibitedExpressions(): string[] {
  return Array.from(new Set([...DEFAULT_PROHIBITED_EXPRESSIONS, ...officeRules.extraTerms]));
}

/** 본문에 포함된 금지 표현 목록 (공백 차이 무시) */
export function findProhibitedExpressions(text: string, _tenantId?: string, list?: string[]): string[] {
  const norm = (s: string) => s.replace(/\s+/g, '');
  const body = norm(text || '');
  if (!body) return [];
  const exprs = list || loadProhibitedExpressions();
  return exprs.filter(e => { const n = norm(e); return n.length > 0 && body.includes(n); });
}

/** '그대로 보내기' 기록 (걸린 표현과 화면 이름만, 본문 없음) */
export async function logCopyOverride(channel: string, terms: string[], reason: string): Promise<void> {
  if (!rulesOfficeId || !isSupabaseConfigured) return;
  await supabase.rpc('log_copy_override', { p_office_id: rulesOfficeId, p_channel: channel, p_terms: terms.slice(0, 10), p_reason: reason });
}

type PromptFn = (o: { title: string; message: string; placeholder?: string }) => Promise<string | null | undefined>;

/**
 * 보내기 전 확인. 걸린 표현이 없으면 true.
 * 권고 모드: 사유를 적으면 기록하고 true, 취소하면 false. 엄격 모드: false.
 */
export async function confirmClientCopy(text: string, channel: string, prompt: PromptFn, onBlocked: (msg: string) => void): Promise<boolean> {
  const hits = findProhibitedExpressions(text);
  if (hits.length === 0) return true;
  if (officeRules.mode === 'strict') {
    onBlocked(`사무소 규칙(엄격)상 보낼 수 없는 표현이 있어요: ${hits.join(', ')}. 고친 뒤 보내 주세요.`);
    return false;
  }
  const reason = await prompt({
    title: '[운영자 판단] 확인이 필요한 표현이 있어요',
    message: `광고 규정상 문제가 될 수 있는 표현이에요: ${hits.join(', ')}\n고쳐서 보내는 것을 권해요. 그래도 보내려면 사유를 적어 주세요(사무소 활동 기록에 남아요).`,
    placeholder: '예: 법원 결정문 문구를 그대로 인용',
  });
  if (!reason || !String(reason).trim()) return false;
  void logCopyOverride(channel, hits, String(reason).trim()).catch(() => undefined);
  return true;
}
