// Vercel Serverless Function: 카카오 알림톡/문자 발송 및 상태/잔액 통합 엔드포인트
// GET  /api/alimtok?action=status -> 팝빌 상태 및 잔여 포인트 조회
// POST /api/alimtok               -> 알림톡 발송 (실패 시 LMS/SMS 자동 대체 발송)

import { kakaoService, messageService, POPBILL_CONFIG, setCorsHeaders } from './_lib/popbill-service.js';
import { checkMultiTierRateLimit, RATE_LIMIT_TIERS } from './_lib/rate-limiter.js';
import { verifyAuth, isAdminWithMfa, supabase as authSupabase } from './_lib/auth-middleware.js';

// [SECURITY] 발신번호는 서버에 등록된 번호만 사용 (이전: 요청 본문의 sender를 그대로 사용 → 임의 발신번호 지정 가능)
// 버튼 링크는 https만 허용 (피싱 링크 삽입 방지)
const isSafeButtonUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u) && u.length <= 500;
// 한글 2바이트 기준 SMS 90바이트 판정 (이전: 글자 수 90자 → 한글 90자(180바이트)도 SMS로 보내 잘림/실패)
const byteLengthKR = (s) => { let n = 0; for (const ch of String(s)) n += ch.charCodeAt(0) > 0x7f ? 2 : 1; return n; };

// 마일스톤별 기본 카카오 알림톡 템플릿 코드 매핑
const MILESTONE_TEMPLATE_CODES = {
  consult_booked: '026090000408',          // 팝빌 등록 템플릿 (상담 접수 안내)
  consultation_received: '026090000408',   // 팝빌 등록 템플릿 (상담 접수 안내)
  consultation_in_progress: 'MYKIM_ATS_02',
  contract_requested: 'MYKIM_ATS_03',
  contract_signed: 'MYKIM_ATS_04',
  document_request: 'MYKIM_ATS_05',
  court_filed: 'MYKIM_ATS_06',
  case_filed: 'MYKIM_ATS_06',
  injunction_granted: 'MYKIM_ATS_07',
  correction_order: 'MYKIM_ATS_08',
  commenced: 'MYKIM_ATS_09',
  hearing_notice: 'MYKIM_ATS_10',
  discharged: 'MYKIM_ATS_11',
  fee_upcoming: 'MYKIM_ATS_12',
  fee_due: 'MYKIM_ATS_13',
  fee_overdue: 'MYKIM_ATS_14',
  fee_receipt: 'MYKIM_ATS_15',
  payment_reminder: 'MYKIM_ATS_16',
  golden_time_reminder: 'MYKIM_ATS_17',
  general_announcement: 'MYKIM_ATS_18',
};

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // URL 쿼리 파라미터 파싱
  let actionQuery = '';
  try {
    const url = new URL(req.url, 'https://mykim.kr');
    actionQuery = url.searchParams.get('action') || '';
  } catch (_) {}

  const action = actionQuery || req.query?.action || req.body?.action || '';
  const isStatus = req.method === 'GET' || action === 'status' || action === 'templates' || action === 'template_mgt_url';

  // [SECURITY] Multi-Tier Rate Limiting (1분 3회, 10분 5회, 30분 10회 + 30분 Jail)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
  const tier = isStatus ? RATE_LIMIT_TIERS.STANDARD : RATE_LIMIT_TIERS.STRICT;
  // 조회와 발송 버킷 분리 (이전: 같은 키를 써서 상태 조회가 STRICT 발송 한도를 소진)
  const rateLimit = checkMultiTierRateLimit(`alimtok:${isStatus ? 'status' : 'send'}:${ip}`, tier);

  res.setHeader('X-RateLimit-Limit', tier.minute.max);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  if (rateLimit.retryAfter > 0) {
    res.setHeader('Retry-After', rateLimit.retryAfter);
  }

  if (rateLimit.isLimited) {
    console.warn(`[SECURITY Alimtok RateLimit] Blocked ${ip} (reason: ${rateLimit.reason}, retryAfter: ${rateLimit.retryAfter}s)`);
    return res.status(429).json({
      ok: false,
      error: `Too Many Requests: 알림톡 발송 요청 한도를 초과하여 보안 격리되었습니다. (${Math.ceil(rateLimit.retryAfter / 60)}분 후 재시도 가능)`,
      retryAfter: rateLimit.retryAfter,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // A. [STATUS / 템플릿 / 관리URL 조회] 팝빌 연동 상태 및 승인 템플릿 목록
  // ─────────────────────────────────────────────────────────────
  // [SECURITY] 모든 요청은 로그인 세션 필수 (이전: Authorization 헤더가 '있기만' 하면 통과 → 누구나 문자 발송·사업자정보 조회 가능)
  try {
    req.user = await verifyAuth(req);
  } catch (authErr) {
    return res.status(401).json({ ok: false, error: authErr.message || '로그인이 필요합니다.' });
  }

  // [PART 3-5] 역할 확인
  //  - 상태·템플릿·잔액 조회(사업자번호·발신번호·포인트 노출): 관리자(2단계 인증)만
  //  - 발송: 관리자 또는 승인된 변호사 계정만
  // (이전: 로그인만 하면 의뢰인도 회사 발신번호로 임의 문구 문자를 보낼 수 있었고 사업자 정보도 조회 가능)
  //  - 승인 템플릿 목록(action=templates): 승인 변호사도 가능 (단, 팝빌 관리 SSO URL은 관리자에게만)
  const isAdmin = isAdminWithMfa(req, req.user);
  const isTemplatesOnly = action === 'templates';
  if (isStatus && !isTemplatesOnly && !isAdmin) {
    return res.status(403).json({ ok: false, error: '관리자(2단계 인증 완료)만 조회할 수 있습니다.' });
  }
  if ((!isStatus || isTemplatesOnly) && !isAdmin) {
    const { data: account, error: accountError } = await authSupabase
      .from('lawyer_accounts')
      .select('approved')
      .eq('auth_user_id', req.user.id)
      .maybeSingle();
    if (accountError || !account?.approved) {
      return res.status(403).json({ ok: false, error: '승인된 변호사 계정만 알림톡을 보낼 수 있습니다.' });
    }
  }
  // 사용자 단위 발송 한도 (IP 한도와 별도 — IP를 바꿔 우회하는 경우 대비, 인스턴스 메모리 기준)
  if (!isStatus) {
    const userLimit = checkMultiTierRateLimit(`alimtok-user:${req.user.id}`, RATE_LIMIT_TIERS.STRICT);
    if (userLimit.isLimited) {
      return res.status(429).json({ ok: false, error: `발송 한도를 초과했습니다. ${Math.ceil(userLimit.retryAfter / 60)}분 후 다시 시도해 주세요.`, retryAfter: userLimit.retryAfter });
    }
  }

  if (isStatus) {
    if (!POPBILL_CONFIG.isConfigured) {
      return res.status(200).json({
        ok: true,
        configured: false,
        isTest: POPBILL_CONFIG.isTest,
        balance: 0,
        partnerBalance: 0,
        channelStatus: 'UNCONFIGURED',
        statusMessage: '팝빌 API 인증키(POPBILL_LINK_ID, POPBILL_SECRET_KEY) 미등록 — 알림톡·문자가 발송되지 않습니다.',
        senders: [],
        plusFriends: [],
        templates: [],
        templateMgtUrl: 'https://www.popbill.com/KakaoTalk/?TG=TEMPLATE',
      });
    }

    try {
      const corpNum = POPBILL_CONFIG.corpNum;

      // 팝빌 템플릿 관리 및 심사 신청 SSO URL
      const templateMgtUrl = await new Promise((resolve, reject) => {
        kakaoService.getATSTemplateMgtURL(corpNum, POPBILL_CONFIG.userId, (url) => resolve(url), (err) => reject(err));
      }).catch(() => 'https://www.popbill.com/KakaoTalk/?TG=TEMPLATE');

      if (action === 'template_mgt_url') {
        return res.status(200).json({
          ok: true,
          templateMgtUrl,
        });
      }

      const templates = await new Promise((resolve, reject) => {
        kakaoService.listATSTemplate(corpNum, (res) => resolve(res), (err) => reject(err));
      }).catch(() => []);

      if (action === 'templates') {
        return res.status(200).json({
          ok: true,
          configured: true,
          templates,
          // 팝빌 관리 화면 SSO 로그인 URL은 회사 계정 접근이므로 관리자에게만
          templateMgtUrl: isAdmin ? templateMgtUrl : 'https://www.popbill.com/KakaoTalk/?TG=TEMPLATE',
        });
      }

      // 조회 실패를 0P로 표시하지 않도록 null + 오류 사유 반환 (이전: 오류도 '0 P'로 보임)
      let balanceError = null;
      const balance = await new Promise((resolve, reject) => {
        kakaoService.getBalance(corpNum, (res) => resolve(res), (err) => reject(err));
      }).catch((e) => { balanceError = e?.message || '잔액 조회 실패'; return null; });

      const partnerBalance = await new Promise((resolve, reject) => {
        kakaoService.getPartnerBalance(corpNum, (res) => resolve(res), (err) => reject(err));
      }).catch(() => null);

      const senders = await new Promise((resolve, reject) => {
        kakaoService.getSenderNumberList(corpNum, (res) => resolve(res), (err) => reject(err));
      }).catch(() => []);

      const plusFriends = await new Promise((resolve, reject) => {
        kakaoService.listPlusFriendID(corpNum, (res) => resolve(res), (err) => reject(err));
      }).catch(() => []);

      return res.status(200).json({
        ok: true,
        configured: true,
        isTest: POPBILL_CONFIG.isTest,
        corpNum,
        userId: POPBILL_CONFIG.userId,
        plusFriendId: POPBILL_CONFIG.plusFriendId,
        senderPhone: POPBILL_CONFIG.senderPhone,
        balance: typeof balance === 'number' ? balance : null,
        partnerBalance: typeof partnerBalance === 'number' ? partnerBalance : null,
        balanceError,
        channelStatus: plusFriends.length > 0 ? 'CONNECTED' : 'STANDBY',
        statusMessage: plusFriends.length > 0 ? '팝빌 연동 확인됨' : '팝빌 키는 설정됐지만 카카오 채널이 조회되지 않았습니다.',
        senders,
        plusFriends,
        templates,
        templateMgtUrl,
      });
    } catch (err) {
      console.error('[Popbill Status Check Error]:', err);
      return res.status(200).json({
        ok: false,
        configured: true,
        error: err.message || '팝빌 상태 조회 중 오류가 발생했습니다.',
        code: err.code || -1,
        templateMgtUrl: 'https://www.popbill.com/KakaoTalk/?TG=TEMPLATE',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // B. [발송] 카카오 알림톡 및 LMS/SMS 대체 발송
  // ─────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const {
    phone,             // 수신번호
    receiverName,      // 수신자명 (예: '홍길동')
    milestone,         // 마일스톤 키
    templateCode: reqTemplateCode, // 지정 템플릿 코드
    template,          // 완성된 본문 (치환 완료된 문구)
    customText,        // 사용자 정의 본문
    altSubject,        // 대체문자 제목 (LMS용)
    altContent,        // 대체문자 내용 (카톡 미수신 시 전달)
    sender,            // 발신번호
    buttons,           // 알림톡 버튼 배열
    reserveTime,       // 예약일시 (YYYYMMDDHHmmss, 없으면 즉시)
  } = req.body || {};

  if (!phone) {
    return res.status(400).json({ ok: false, error: '수신번호(phone)는 필수입니다.' });
  }

  // 전화번호 정규화 (하이픈 제거) 및 엄격 검증 (010·011·016~019, 10~11자리)
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (!/^01[016789]\d{7,8}$/.test(cleanPhone)) {
    return res.status(400).json({ ok: false, error: '유효한 국내 휴대폰 번호(010...)가 아닙니다.' });
  }

  const registeredSender = String(POPBILL_CONFIG.senderPhone || '').replace(/[^0-9]/g, '');
  const requestedSender = String(sender || '').replace(/[^0-9]/g, '');
  if (requestedSender && requestedSender !== registeredSender) {
    return res.status(400).json({ ok: false, error: '등록된 발신번호만 사용할 수 있습니다.' });
  }
  const cleanSender = registeredSender;
  const content = (typeof customText === 'string' && customText.trim() !== '') ? customText.trim() : (typeof template === 'string' ? template.trim() : '');
  if (!content) {
    return res.status(400).json({ ok: false, error: '메시지 내용이 비어 있습니다.' });
  }
  if (content.length > 2000 || (altContent && String(altContent).length > 2000)) {
    return res.status(400).json({ ok: false, error: '메시지 내용이 너무 깁니다. (최대 2,000자)' });
  }
  if ((receiverName && String(receiverName).length > 50) || (altSubject && String(altSubject).length > 60)) {
    return res.status(400).json({ ok: false, error: '수신자명 또는 제목이 너무 깁니다.' });
  }
  if (reserveTime && !/^\d{14}$/.test(String(reserveTime))) {
    return res.status(400).json({ ok: false, error: '예약일시 형식이 올바르지 않습니다 (YYYYMMDDHHmmss).' });
  }
  if (reqTemplateCode && !/^[A-Za-z0-9_]{1,30}$/.test(String(reqTemplateCode))) {
    return res.status(400).json({ ok: false, error: '템플릿 코드 형식이 올바르지 않습니다.' });
  }
  if (Array.isArray(buttons) && buttons.some(b => [b?.url, b?.urlMobile, b?.urlPc, b?.u1, b?.u2].some(u => u !== undefined && u !== null && u !== '' && !isSafeButtonUrl(u)))) {
    return res.status(400).json({ ok: false, error: '버튼 링크는 https 주소만 허용됩니다.' });
  }

  const finalTemplateCode = reqTemplateCode || (milestone ? MILESTONE_TEMPLATE_CODES[milestone] : null) || 'MYKIM_ATS_01';
  const finalReceiverName = receiverName || '의뢰인';
  const finalAltSubject = altSubject || '[my김변 법률센터] 안내';
  const finalAltContent = altContent || content;

  // 1. 팝빌 환경변수 미등록: 발송하지 않았음을 명확히 반환 (이전: ok:true + MOCK 접수번호 → 일부 화면이 '발송 완료'로 표시)
  if (!POPBILL_CONFIG.isConfigured) {
    console.log('[Alimtok Not Configured] send skipped', { templateCode: finalTemplateCode });
    return res.status(200).json({
      ok: false,
      mock: true,
      simulated: true,
      channel: 'mock_alimtalk',
      error: '알림톡 서비스(팝빌)가 설정되지 않아 발송되지 않았습니다.',
      rendered: content,
    });
  }

  // 2. 팝빌 실제 알림톡(ATS) 발송 (카카오톡 우선 + 미수신시 LMS 자동 대체 전송)
  try {
    const popbillButtons = Array.isArray(buttons) ? buttons.map(b => ({
      n: b.name || b.n,
      t: b.type || b.t || 'WL',
      u1: b.urlMobile || b.u1 || b.url,
      u2: b.urlPc || b.u2 || b.url,
    })) : null;

    const receiptNum = await new Promise((resolve, reject) => {
      kakaoService.sendATS_one(
        POPBILL_CONFIG.corpNum,
        finalTemplateCode,
        cleanSender,
        content,
        finalAltSubject,
        finalAltContent,
        'C', // altSendType: 'C' (알림톡 우선 발송 실패 시 대체문자 발송)
        reserveTime || null,
        cleanPhone,
        finalReceiverName,
        POPBILL_CONFIG.userId,
        `REQ-${Date.now()}`,
        popbillButtons,
        (result) => resolve(result),
        (error) => reject(error)
      );
    });

    return res.status(200).json({
      ok: true,
      mock: false,
      channel: 'alimtalk',
      receiptNum,
      sentAt: new Date().toISOString(),
      phone: cleanPhone,
      receiverName: finalReceiverName,
      templateCode: finalTemplateCode,
    });
  } catch (atsError) {
    console.warn('[Alimtok ATS Failed -> Fallback to LMS Check]:', atsError);

    // 3. 카카오 템플릿 미승인/불일치 시 팝빌 LMS/SMS로 무중단 자동 대체 발송
    try {
      const isShort = byteLengthKR(content) <= 90; // 90바이트(한글 2바이트) 이하만 SMS, 나머지 LMS
      const lmsReceiptNum = await new Promise((resolve, reject) => {
        if (isShort) {
          messageService.sendSMS(
            POPBILL_CONFIG.corpNum,
            cleanSender,
            cleanPhone,
            finalReceiverName,
            content,
            reserveTime || null,
            false, // 광고성 여부
            POPBILL_CONFIG.userId,
            `REQ-SMS-${Date.now()}`,
            (resNum) => resolve(resNum),
            (err) => reject(err)
          );
        } else {
          messageService.sendLMS(
            POPBILL_CONFIG.corpNum,
            cleanSender,
            cleanPhone,
            finalReceiverName,
            finalAltSubject,
            content,
            reserveTime || null,
            false,
            POPBILL_CONFIG.userId,
            `REQ-LMS-${Date.now()}`,
            (resNum) => resolve(resNum),
            (err) => reject(err)
          );
        }
      });

      return res.status(200).json({
        ok: true,
        mock: false,
        channel: isShort ? 'sms_fallback' : 'lms_fallback',
        receiptNum: lmsReceiptNum,
        sentAt: new Date().toISOString(),
        phone: cleanPhone,
        receiverName: finalReceiverName,
        notice: `알림톡이 접수되지 않아(${atsError.message || atsError.code}) 문자(${isShort ? 'SMS' : 'LMS'})로 대체 접수했습니다. 실제 수신 여부는 팝빌 전송내역에서 확인하세요.`,
      });
    } catch (msgError) {
      console.error('[Alimtok & Message Fallback Both Failed]:', msgError);
      return res.status(200).json({
        ok: false,
        error: msgError.message || atsError.message || '알림톡 및 대체문자 발송에 실패했습니다.',
        code: msgError.code || atsError.code || -1,
      });
    }
  }
}
