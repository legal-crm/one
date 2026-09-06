// Vercel Serverless Function: 카카오 알림톡 및 LMS/SMS 발송 엔드포인트
// POST /api/alimtok

import { kakaoService, messageService, POPBILL_CONFIG, setCorsHeaders } from './_lib/popbill-service.js';

// 마일스톤별 기본 카카오 알림톡 템플릿 코드 매핑
const MILESTONE_TEMPLATE_CODES = {
  consult_booked: 'MYKIM_ATS_01',
  consultation_received: 'MYKIM_ATS_01',
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
  } = req.body;

  if (!phone) {
    return res.status(400).json({ ok: false, error: '수신번호(phone)는 필수입니다.' });
  }

  // 전화번호 정규화 (하이픈 제거)
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  const cleanSender = String(sender || POPBILL_CONFIG.senderPhone).replace(/[^0-9]/g, '');
  const content = (customText && customText.trim() !== '') ? customText.trim() : (template || '');
  const finalTemplateCode = reqTemplateCode || (milestone ? MILESTONE_TEMPLATE_CODES[milestone] : null) || 'MYKIM_ATS_01';
  const finalReceiverName = receiverName || '의뢰인';
  const finalAltSubject = altSubject || '[my김변 법률센터] 안내';
  const finalAltContent = altContent || content;

  // ── 1. 팝빌 환경변수 미등록 시 모의(Mock) 발송 지원 ──
  if (!POPBILL_CONFIG.isConfigured) {
    console.log('[Alimtok Mock Send]', {
      phone: cleanPhone,
      receiverName: finalReceiverName,
      templateCode: finalTemplateCode,
      content,
      isConfigured: false
    });

    return res.status(200).json({
      ok: true,
      mock: true,
      channel: 'mock_alimtalk',
      receiptNum: `MOCK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sentAt: new Date().toISOString(),
      message: '팝빌 API 키 미설정 상태로 모의 발송되었습니다. Vercel 환경변수(POPBILL_LINK_ID, POPBILL_SECRET_KEY) 등록 시 실발송 전환됩니다.',
      rendered: content,
    });
  }

  // ── 2. 팝빌 실제 알림톡(ATS) 발송 (카카오톡 우선 + 미수신시 LMS 자동 대체 전송) ──
  try {
    const popbillButtons = Array.isArray(buttons) ? buttons.map(b => ({
      n: b.name || b.n,
      t: b.type || b.t || 'WL',
      u1: b.urlMobile || b.u1 || b.url,
      u2: b.urlPc || b.u2 || b.url,
    })) : null;

    const receiptNum = await new Promise((resolve, reject) => {
      // sendATS_one(CorpNum, templateCode, Sender, content, altSubject, altContent, altSendType, sndDT, receiver, receiverName, UserID, requestNum, btns, success, error)
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

    // ── 3. 카카오 템플릿 미승인/불일치 시 팝빌 LMS/SMS로 무중단 자동 대체 발송 ──
    try {
      const isShort = content.length <= 90; // 90바이트 이하는 SMS 가능, 긴 문장은 LMS
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
        notice: `알림톡 발송 중 (${atsError.message || atsError.code}), 안내 문자(LMS/SMS)로 즉시 100% 정상 대체 발송되었습니다.`,
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
