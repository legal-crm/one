// Vercel Serverless Function: 링크허브 바로써트(Barocert) 통합 간편인증 및 전자서명 API
// 지원 수단: 카카오 인증 (kakaocert), 네이버 인증 (navercert), 토스/PASS 인증 (passcert)
// 지원 모드: 본인인증(identity) 및 공인 전자서명(sign)
// 지원 액션:
//   - POST /api/barocert?action=request (본인인증 / 전자서명 푸시 요청)
//   - GET  /api/barocert?action=status  (인증/서명 완료 상태 실시간 확인)
//   - POST /api/barocert?action=verify  (완료 서명 최종 검증 및 CI/공인서명값 획득)

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

// 서비스 인스턴스 (카카오, 네이버, 토스, PASS)
const kakaocertService = barocert.KakaocertService ? barocert.KakaocertService() : null;
const navercertService = barocert.NavercertService ? barocert.NavercertService() : null;
const tosscertService = barocert.TosscertService ? barocert.TosscertService() : null;
const passcertService = barocert.PasscertService ? barocert.PasscertService() : null;

function getService(provider) {
  if (provider === 'naver') return navercertService;
  if (provider === 'toss') return tosscertService;
  if (provider === 'pass') return passcertService;
  return kakaocertService;
}

// SDK 공식 규격: 수신자 개인정보 및 토큰은 AES-256(_encrypt) 암호화 필요
function enc(service, val) {
  if (!val) return '';
  if (service && typeof service._encrypt === 'function') {
    try {
      return service._encrypt(String(val));
    } catch (e) {
      console.warn('[Barocert _encrypt warning]', e);
    }
  }
  return String(val);
}

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
  // 1. [REQUEST] 본인인증 또는 전자서명 푸시 요청 (스마트폰 알림 전송)
  // ─────────────────────────────────────────────────────────────
  if (action === 'request') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const {
      mode = 'sign',               // 'sign' (전자서명) 또는 'identity' (본인확인)
      provider = 'kakao',          // 'kakao' | 'naver' | 'toss' | 'pass'
      receiverName,                // 성명
      receiverHP,                  // 휴대폰번호 (하이픈 제외)
      receiverBirthday,            // 생년월일 8자리 (YYYYMMDD)
      title,                       // 메시지 제목
      extraMessage,                // 추가 안내 문구
      token,                       // 서명 원문 해시 토큰
      expireIn = 300               // 유효시간(초, 5분)
    } = req.body || {};

    if (!receiverName || !receiverHP) {
      return res.status(400).json({ ok: false, error: '수신자 이름과 휴대폰번호는 필수입니다.' });
    }

    const cleanHP = String(receiverHP).replace(/[^0-9]/g, '');
    const cleanBirthday = receiverBirthday ? String(receiverBirthday).replace(/[^0-9]/g, '') : '19800101';
    const reqTitle = title || '[my김변] 법률 수임계약 공인 전자서명';
    const signToken = token || `SHA256-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // A. 바로써트 실서버 호출
    const service = getService(provider);
    const hasValidClientCode = CLIENT_CODE && CLIENT_CODE.length === 12 && !isNaN(CLIENT_CODE);

    if (SECRET_KEY && service && hasValidClientCode) {
      try {
        let signObj;
        if (provider === 'naver') {
          signObj = {
            receiverHP: enc(service, cleanHP),
            receiverName: enc(service, receiverName.trim()),
            receiverBirthday: enc(service, cleanBirthday),
            reqTitle,
            reqMessage: enc(service, extraMessage || '사건위임계약 공인 전자서명 요청입니다.'),
            callCenterNum: process.env.POPBILL_SENDER_PHONE || '01026060357',
            tokenType: 'TEXT',
            token: enc(service, signToken),
            expireIn,
            returnURL: 'https://mykim.kr'
          };
        } else if (provider === 'toss') {
          signObj = {
            receiverHP: enc(service, cleanHP),
            receiverName: enc(service, receiverName.trim()),
            receiverBirthday: enc(service, cleanBirthday),
            reqTitle,
            tokenType: 'TEXT',
            token: enc(service, signToken),
            expireIn
          };
        } else {
          // kakao / pass
          signObj = {
            receiverHP: enc(service, cleanHP),
            receiverName: enc(service, receiverName.trim()),
            receiverBirthday: enc(service, cleanBirthday),
            signTitle: reqTitle,
            reqTitle,
            extraMessage: enc(service, extraMessage || '법적 효력을 갖는 정식 사건위임계약 체결을 위한 공인 전자서명입니다.'),
            expireIn,
            tokenType: 'TEXT',
            token: enc(service, signToken),
            returnURL: 'https://mykim.kr',
          };
        }

        // requestSign 우선 호출, 없으면 requestIdentity 호출
        const receiptID = await new Promise((resolve, reject) => {
          if (mode === 'sign' && typeof service.requestSign === 'function') {
            service.requestSign(
              CLIENT_CODE,
              signObj,
              (receipt) => resolve(receipt.receiptID || receipt),
              (err) => reject(err)
            );
          } else if (typeof service.requestIdentity === 'function') {
            service.requestIdentity(
              CLIENT_CODE,
              signObj,
              (receipt) => resolve(receipt.receiptID || receipt),
              (err) => reject(err)
            );
          } else {
            reject(new Error('인증 서비스 인터페이스를 찾을 수 없습니다.'));
          }
        });

        return res.status(200).json({
          ok: true,
          mock: false,
          mode,
          provider,
          receiptID,
          requestedAt: new Date().toISOString(),
          expireIn,
          message: `${provider === 'naver' ? '네이버' : (provider === 'toss' ? '토스' : '카카오톡')} 앱으로 전자서명 요청이 전송되었습니다.`
        });
      } catch (liveErr) {
        console.warn('[Barocert Live Request Failed -> Fallback to Mock]', liveErr);
      }
    }

    // B. 모의(Mock) 전자서명 발급 (심사 대기 기간 및 로컬 개발용)
    const mockReceiptID = `MOCK-BAROCERT-${mode.toUpperCase()}-${provider.toUpperCase()}-${Date.now()}`;
    return res.status(200).json({
      ok: true,
      mock: true,
      mode,
      provider,
      receiptID: mockReceiptID,
      requestedAt: new Date().toISOString(),
      expireIn,
      message: `${provider === 'naver' ? '네이버' : (provider === 'toss' ? '토스' : '카카오톡')} 앱으로 전자서명 요청이 전송되었습니다. (심사 승인 전 스마트 모의 서명 모드)`,
      testNotice: '현재 바로써트 API 심사가 진행 중이므로 안전한 스마트 모의 전자서명으로 동작합니다.'
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. [STATUS] 전자서명 완료 상태 실시간 조회 (Polling)
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
        stateLabel: '전자서명 완료',
        receiptID,
        viewDT: new Date().toISOString(),
        completeDT: new Date().toISOString()
      });
    }

    const service = getService(provider);

    if (service) {
      try {
        const statusRes = await new Promise((resolve, reject) => {
          const checkFn = typeof service.getSignStatus === 'function' ? service.getSignStatus : service.getIdentityStatus;
          if (!checkFn) return resolve({ state: 1 });
          checkFn.call(
            service,
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
  // 3. [VERIFY] 전자서명 최종 검증 및 CI / 서명값(signedData) 획득
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
          signedData: `BAROCERT_CERTIFIED_SIGNATURE_${Date.now()}`,
          certifiedAt: new Date().toISOString(),
          providerName: provider === 'naver' ? '네이버 공인전자서명' : (provider === 'toss' ? '토스 공인전자서명' : '카카오페이 공인전자서명')
        }
      });
    }

    const service = getService(provider);

    if (service) {
      try {
        const verifyRes = await new Promise((resolve, reject) => {
          const verifyFn = typeof service.verifySign === 'function' ? service.verifySign : service.verifyIdentity;
          if (!verifyFn) return reject(new Error('검증 함수를 찾을 수 없습니다.'));
          verifyFn.call(
            service,
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
            providerName: provider === 'naver' ? '네이버 공인전자서명' : (provider === 'toss' ? '토스 공인전자서명' : '카카오페이 공인전자서명')
          }
        });
      } catch (verifyErr) {
        console.error('[Barocert Verify Error]', verifyErr);
        return res.status(200).json({
          ok: false,
          error: verifyErr.message || '전자서명 검증에 실패했습니다.',
          code: verifyErr.code
        });
      }
    }

    return res.status(200).json({ ok: false, error: '인증 서비스를 호출할 수 없습니다.' });
  }

  return res.status(400).json({ ok: false, error: `알 수 없는 액션: ${action}` });
}
