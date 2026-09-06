// Vercel Serverless Function: 팝빌 알림톡/문자 연동 상태 및 잔액 조회
// GET /api/alimtalk/status

import { kakaoService, POPBILL_CONFIG, setCorsHeaders } from '../_lib/popbill-service.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // 1. 팝빌 환경변수 미설정 시
  if (!POPBILL_CONFIG.isConfigured) {
    return res.status(200).json({
      ok: true,
      configured: false,
      isTest: POPBILL_CONFIG.isTest,
      corpNum: POPBILL_CONFIG.corpNum,
      userId: POPBILL_CONFIG.userId,
      plusFriendId: POPBILL_CONFIG.plusFriendId,
      senderPhone: POPBILL_CONFIG.senderPhone,
      balance: 0,
      partnerBalance: 0,
      channelStatus: 'UNCONFIGURED',
      statusMessage: '팝빌 API 인증키(POPBILL_LINK_ID, POPBILL_SECRET_KEY) 미등록 상태 (현재 모의 발송 모드 작동 중)',
      senders: [POPBILL_CONFIG.senderPhone],
      plusFriends: [{ plusFriendID: POPBILL_CONFIG.plusFriendId, state: 'READY' }],
      templates: [],
    });
  }

  // 2. 팝빌 실제 연동 상태 조회
  try {
    const corpNum = POPBILL_CONFIG.corpNum;

    // 잔여 포인트 조회
    const balance = await new Promise((resolve, reject) => {
      kakaoService.getBalance(corpNum, (res) => resolve(res), (err) => reject(err));
    }).catch(() => 0);

    // 파트너 잔액 조회
    const partnerBalance = await new Promise((resolve, reject) => {
      kakaoService.getPartnerBalance(corpNum, (res) => resolve(res), (err) => reject(err));
    }).catch(() => 0);

    // 사전 등록 발신번호 목록
    const senders = await new Promise((resolve, reject) => {
      kakaoService.getSenderNumberList(corpNum, (res) => resolve(res), (err) => reject(err));
    }).catch(() => []);

    // 카카오톡 채널(플러스친구) 연동 목록
    const plusFriends = await new Promise((resolve, reject) => {
      kakaoService.listPlusFriendID(corpNum, (res) => resolve(res), (err) => reject(err));
    }).catch(() => []);

    // 승인된 알림톡 템플릿 목록
    const templates = await new Promise((resolve, reject) => {
      kakaoService.listATSTemplate(corpNum, (res) => resolve(res), (err) => reject(err));
    }).catch(() => []);

    return res.status(200).json({
      ok: true,
      configured: true,
      isTest: POPBILL_CONFIG.isTest,
      corpNum,
      userId: POPBILL_CONFIG.userId,
      plusFriendId: POPBILL_CONFIG.plusFriendId,
      senderPhone: POPBILL_CONFIG.senderPhone,
      balance: typeof balance === 'number' ? balance : 0,
      partnerBalance: typeof partnerBalance === 'number' ? partnerBalance : 0,
      channelStatus: plusFriends.length > 0 ? 'CONNECTED' : 'STANDBY',
      statusMessage: '팝빌 카카오 알림톡/문자 서비스 정상 연동 활성화됨',
      senders,
      plusFriends,
      templates,
    });
  } catch (err) {
    console.error('[Popbill Status Check Error]:', err);
    return res.status(200).json({
      ok: false,
      configured: true,
      error: err.message || '팝빌 상태 조회 중 오류가 발생했습니다.',
      code: err.code || -1,
    });
  }
}
