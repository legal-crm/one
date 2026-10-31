// 통합어드민 서비스 상태 확인 (OP-3) — GET /api/notify?channel=health (관리자·2단계 인증)
// DB는 실제로 한 번 읽고, 나머지 외부 서비스는 '서버에 키가 있는지'만 본다 (요금·호출 한도를 쓰지 않음).
// 키 값·끝자리는 돌려주지 않는다.
import { handleCorsPreflight } from '../cors-helper.js';
import { verifyAuth, isAdminWithMfa, supabase } from '../auth-middleware.js';

const has = (...names) => names.some(n => Boolean(process.env[n]));

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  let user = null;
  try { user = await verifyAuth(req); } catch { user = null; }
  if (!user || !isAdminWithMfa(req, user)) return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 볼 수 있습니다.' });

  const checks = [];
  const started = Date.now();
  try {
    const { error } = await supabase.from('platform_config').select('id', { head: true, count: 'exact' }).limit(1);
    checks.push({ key: 'db', label: '데이터베이스', ok: !error, detail: error ? '읽기 실패' : `응답 ${Date.now() - started}ms` });
  } catch {
    checks.push({ key: 'db', label: '데이터베이스', ok: false, detail: '연결 실패' });
  }
  checks.push({ key: 'service_role', label: '서버 함수 권한 키', ok: has('SUPABASE_SERVICE_ROLE_KEY'), detail: has('SUPABASE_SERVICE_ROLE_KEY') ? '설정됨' : '없음 — 문의·알림·발송이 멈춤' });
  checks.push({ key: 'popbill', label: '팝빌(알림톡·문자·세금계산서)', ok: has('POPBILL_LINK_ID') && has('POPBILL_SECRET_KEY') && has('POPBILL_CORP_NUM') && has('POPBILL_USER_ID'),
    detail: process.env.POPBILL_IS_TEST === 'true' ? '테스트 모드' : '운영 모드' });
  checks.push({ key: 'gemini', label: 'Gemini(OCR·진술서·대화록)', ok: has('GEMINI_API_KEY', 'GOOGLE_API_KEY'), detail: has('GEMINI_API_KEY', 'GOOGLE_API_KEY') ? '설정됨' : '없음' });
  checks.push({ key: 'codef', label: 'CODEF(사건 조회)', ok: has('CODEF_CLIENT_ID') && has('CODEF_CLIENT_SECRET'), detail: has('CODEF_CLIENT_ID') ? (process.env.CODEF_ENV === 'production' ? '운영' : '개발') : '계약 키 없음' });
  checks.push({ key: 'turnstile', label: 'Turnstile(봇 방지)', ok: has('TURNSTILE_SECRET_KEY'), detail: has('TURNSTILE_SECRET_KEY') ? '설정됨' : '없음 — 비회원 문의 봇 방어 꺼짐' });
  checks.push({ key: 'portone', label: '포트원(본인인증)', ok: has('PORTONE_API_SECRET'), detail: has('PORTONE_API_SECRET') ? '설정됨' : '없음 — 원격 서명 본인인증 불가' });
  try {
    const { data } = await supabase.from('platform_config').select('data').eq('id', 'company_info').maybeSingle();
    const bn = String(data?.data?.businessNumber || '521-39-01355').replace(/[^0-9]/g, '');
    const corp = String(process.env.POPBILL_CORP_NUM || '').replace(/[^0-9]/g, '');
    checks.push({ key: 'supplier', label: '세금계산서 공급자 = 회사 정보', ok: Boolean(corp) && corp === bn,
      detail: !corp ? '팝빌 사업자번호 없음' : corp === bn ? '사업자번호 같음' : '사업자번호가 달라요 — 팝빌 설정 또는 회사 정보 확인' });
  } catch {
    checks.push({ key: 'supplier', label: '세금계산서 공급자 = 회사 정보', ok: false, detail: '확인 실패' });
  }
  checks.push({ key: 'smtp', label: '메일 발송(Gmail)', ok: has('GMAIL_SMTP_USER') && has('GMAIL_SMTP_APP_PASSWORD'), detail: has('GMAIL_SMTP_USER') ? '설정됨' : '없음 — 이메일 알림 안 감' });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, checkedAt: new Date().toISOString(), region: process.env.VERCEL_REGION || null, checks });
}
