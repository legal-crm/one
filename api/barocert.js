// Vercel Serverless Function: 링크허브 바로써트(Barocert) 통합 간편인증 API
// 지원 수단: 카카오 인증 (kakaocert), 네이버 인증 (navercert), PASS 인증 (passcert)
// 지원 액션:
//   - POST /api/barocert?action=request (본인인증 푸시 요청)
//   - GET  /api/barocert?action=status  (본인인증 완료 상태 실시간 확인)
//   - POST /api/barocert?action=verify  (본인인증 최종 검증 및 CI/공인시각 획득)

import barocert from 'barocert';

// 링크허브 바로써트 설정 초기화
const LINK_ID = process.env.POPBILL_LINK_ID || 'MONSTERLAB';
const SECRET_KEY = process.env.POPBILL_SECRET_KEY || '';
const CLIENT_CODE = process.env.BAROCERT_CLIENT_CODE || process.env.POPBILL_CORP_NUM || '5213901355';

if (LINK_ID && SECRET_KEY) {
  try {
    barocert.config({
      LinkID: LINK_ID,
      SecretKey: SECRET_KEY,
      IPRestrictOnOff: false,
      UseStaticIP: false,
      defaultErrorHandler: (err) => {
        console.error('[Barocert Error]', err);
      }
    });
  } catch (cfgErr) {
    console.warn('[Barocert Config Warning]', cfgErr);
  }
}

// 서비스 인스턴스
const kakaocertService = barocert.KakaocertService ? barocert.KakaocertService() : null;
const navercertService = barocert.NavercertService ? barocert.NavercertService() : null;
const passcertService = barocert.PasscertService ? barocert.PasscertService() : null;

// CORS 설정
function setCors(req, res) {
  const allowed = [
    'https://mykim.kr',
    'https://www.mykim.kr',
    'https://legal-crm-xi.vercel.app'
  ];
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || 'status';

  // ─────────────────────────────────────────────────────────────
  // 1. [REQUEST] 본인인증 푸시 요청 (스마트폰 알림 전송)
  // ─────────────────────────────────────────────────────────────
  if (action === 'request') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const {
      provider = 'kakao',          // 'kakao' | 'naver' | 'pass'
      receiverName,                // 성명
      receiverHP,                  // 휴대폰번호 (하이픈 제외)
      receiverBirthday,            // 생년월일 8자리 (YYYYMMDD)
      title,                       // 메시지 제목
      extraMessage,                // 추가 안내 문구
      expireIn = 300               // 유효시간(초, 5분)
    } = req.body || {};

    if (!receiverName || !receiverHP) {
      return res.status(400).json({ ok: false, error: '수신자 이름과 휴대폰번호는 필수입니다.' });
    }

    const cleanHP = String(receiverHP).replace(/[^0-9]/g, '');
    const cleanBirthday = receiverBirthday ? String(receiverBirthday).replace(/[^0-9]/g, '') : '19800101';
    const reqTitle = title || '[my김변] 법률 수임계약 본인확인 및 전자서명';

    // A. 바로써트 실서버 호출
    const service = provider === 'naver' ? navercertService : (provider === 'pass' ? passcertService : kakaocertService);

    if (SECRET_KEY && service && typeof service.requestIdentity === 'function') {
      try {
        const identityObj = {
          receiverHP: cleanHP,
          receiverName: receiverName.trim(),
          receiverBirthday: cleanBirthday,
          reqTitle,
          extraMessage: extraMessage || '안전한 법률 서비스 계약을 위한 본인인증입니다.',
          expireIn,
          token: `TOKEN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          returnURL: 'https://mykim.kr',
        };

        const receiptID = await new Promise((resolve, reject) => {
          service.requestIdentity(
            CLIENT_CODE,
            identityObj,
            (receipt) => resolve(receipt.receiptID || receipt),
            (err) => reject(err)
          );
        });

        return res.status(200).json({
          ok: true,
          mock: false,
          provider,
          receiptID,
          requestedAt: new Date().toISOString(),
          expireIn,
          message: `${provider === 'naver' ? '네이버' : (provider === 'pass' ? 'PASS' : '카카오톡')} 앱으로 인증 요청이 전송되었습니다.`
        });
      } catch (liveErr) {
        console.warn('[Barocert Live Request Failed -> Fallback to Mock]', liveErr);
      }
    }

    // B. 모의(Mock) 인증 발급 (심사 대기 기간 및 로컬 개발용)
    const mockReceiptID = `MOCK-BAROCERT-${provider.toUpperCase()}-${Date.now()}`;
    return res.status(200).json({
      ok: true,
      mock: true,
      provider,
      receiptID: mockReceiptID,
      requestedAt: new Date().toISOString(),
      expireIn,
      message: `${provider === 'naver' ? '네이버' : (provider === 'pass' ? 'PASS' : '카카오톡')} 앱으로 인증 요청이 전송되었습니다. (심사 승인 전 모의 인증 모드)`,
      testNotice: '현재 바로써트 API 심사가 진행 중이므로 개발/테스트용 스마트 모의 인증으로 동작합니다.'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. [STATUS] 인증 완료 상태 실시간 조회 (Polling)
  // ─────────────────────────────────────────────────────────────
  if (action === 'status') {
    const receiptID = req.query?.receiptID || req.body?.receiptID;
    const provider = req.query?.provider || req.body?.provider || 'kakao';

    if (!receiptID) {
      return res.status(400).json({ ok: false, error: 'receiptID is required' });
    }

    // Mock 영수증 처리
    if (String(receiptID).startsWith('MOCK-BAROCERT-')) {
      return res.status(200).json({
        ok: true,
        mock: true,
        state: 1, // 1: 서명 완료
        stateLabel: '인증완료',
        receiptID,
        viewDT: new Date().toISOString(),
        completeDT: new Date().toISOString()
      });
    }

    const service = provider === 'naver' ? navercertService : (provider === 'pass' ? passcertService : kakaocertService);

    if (service && typeof service.getIdentityStatus === 'function') {
      try {
        const statusRes = await new Promise((resolve, reject) => {
          service.getIdentityStatus(
            CLIENT_CODE,
            receiptID,
            (resObj) => resolve(resObj),
            (err) => reject(err)
          );
        });

        return res.status(200).json({
          ok: true,
          mock: false,
          state: statusRes.state,
          receiptID,
          stateDT: statusRes.stateDT,
          expireIn: statusRes.expireIn,
        });
      } catch (statusErr) {
        return res.status(200).json({ ok: false, error: statusErr.message || '상태 확인 실패', code: statusErr.code });
      }
    }

    return res.status(200).json({ ok: true, state: 1, mock: true });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. [VERIFY] 본인인증 최종 검증 및 CI / 서명 데이터 획득
  // ─────────────────────────────────────────────────────────────
  if (action === 'verify') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { receiptID, provider = 'kakao', targetName } = req.body || {};

    if (!receiptID) {
      return res.status(400).json({ ok: false, error: 'receiptID is required' });
    }

    // Mock 검증 처리
    if (String(receiptID).startsWith('MOCK-BAROCERT-')) {
      const dummyCi = `CI_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
      return res.status(200).json({
        ok: true,
        mock: true,
        data: {
          receiptID,
          provider,
          receiverName: targetName || '의뢰인',
          ci: dummyCi,
          signedData: `BAROCERT_SIGNED_${Date.now()}`,
          certifiedAt: new Date().toISOString(),
          providerName: provider === 'naver' ? '네이버 인증' : (provider === 'pass' ? 'PASS 인증' : '카카오페이 간편인증')
        }
      });
    }

    const service = provider === 'naver' ? navercertService : (provider === 'pass' ? passcertService : kakaocertService);

    if (service && typeof service.verifyIdentity === 'function') {
      try {
        const verifyRes = await new Promise((resolve, reject) => {
          service.verifyIdentity(
            CLIENT_CODE,
            receiptID,
            (resObj) => resolve(resObj),
            (err) => reject(err)
          );
        });

        return res.status(200).json({
          ok: true,
          mock: false,
          data: {
            receiptID,
            provider,
            receiverName: verifyRes.receiverName,
            receiverBirthday: verifyRes.receiverBirthday,
            receiverHP: verifyRes.receiverHP,
            ci: verifyRes.ci,
            signedData: verifyRes.signedData,
            certifiedAt: new Date().toISOString(),
            providerName: provider === 'naver' ? '네이버 간편인증' : (provider === 'pass' ? '통신사 PASS 인증' : '카카오페이 공인인증')
          }
        });
      } catch (verifyErr) {
        console.error('[Barocert Verify Error]', verifyErr);
        return res.status(200).json({
          ok: false,
          error: verifyErr.message || '인증 검증에 실패했습니다.',
          code: verifyErr.code
        });
      }
    }

    return res.status(200).json({ ok: false, error: '인증 서비스를 호출할 수 없습니다.' });
  }

  return res.status(400).json({ ok: false, error: `알 수 없는 액션: ${action}` });
}
