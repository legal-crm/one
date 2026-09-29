// Vercel Serverless Function: 공공데이터포털(data.go.kr) & 복지로 혜택 실시간 중계 API
// GET /api/benefits?stage=approved&category=all&region=all&completedRounds=14

import { handleCorsPreflight } from './_lib/cors-helper.js';
import { verifyAuth } from './_lib/auth-middleware.js';
import { checkMultiTierRateLimit, RATE_LIMIT_TIERS } from './_lib/rate-limiter.js';

const CACHE_TTL_SECONDS = 3600; // 1시간 캐시

// ─────────────────────────────────────────────────────────────
// [PART 4] 국세청 사업자등록 진위확인 중계 (POST /api/benefits?action=nts-validate)
//   이전: VITE_NTS_SERVICE_KEY가 브라우저 번들에 포함되어 누구나 공공데이터포털 인증키를 볼 수 있었다.
//   현재: 로그인 사용자만, 서버 환경변수 키로 호출. 요청 필드는 형식 검사 후 그대로 1건만 전달한다.
//   (새 API 함수를 늘리지 않기 위해 같은 공공데이터포털 중계 함수에 둔다 — Vercel 12개 제한)
// ─────────────────────────────────────────────────────────────
async function handleNtsValidate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
  const limit = checkMultiTierRateLimit(`nts:${ip}`, RATE_LIMIT_TIERS.STANDARD);
  if (limit.isLimited) {
    return res.status(429).json({ ok: false, error: `조회 한도를 초과했습니다. (${Math.ceil(limit.retryAfter / 60)}분 후 재시도)` });
  }

  let user = null;
  try { user = await verifyAuth(req); } catch (_) { user = null; }
  if (!user) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });

  // 이전 이름(VITE_NTS_SERVICE_KEY)도 서버에서는 읽는다 — 클라이언트 코드가 더 이상 참조하지 않으므로 번들에는 들어가지 않음
  const serviceKey = process.env.NTS_SERVICE_KEY || process.env.VITE_NTS_SERVICE_KEY || '';
  if (!serviceKey) {
    return res.status(200).json({ ok: false, configured: false, error: '국세청 진위확인 키(NTS_SERVICE_KEY)가 설정되지 않았습니다.' });
  }

  const b_no = String(req.body?.b_no || '').replace(/[^0-9]/g, '');
  const start_dt = String(req.body?.start_dt || '').replace(/[^0-9]/g, '');
  const p_nm = String(req.body?.p_nm || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
  if (b_no.length !== 10 || start_dt.length !== 8 || !p_nm) {
    return res.status(400).json({ ok: false, error: '사업자등록번호(10자리)·개업일자(8자리)·대표자명을 확인해 주세요.' });
  }

  try {
    const r = await fetch(`https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${encodeURIComponent(serviceKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ businesses: [{ b_no, start_dt, p_nm }] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.warn('[nts-validate] HTTP', r.status);
      return res.status(502).json({ ok: false, error: `국세청 조회 응답 오류 (${r.status})` });
    }
    const json = await r.json();
    const item = json?.data?.[0];
    if (!item) return res.status(502).json({ ok: false, error: '국세청 조회 결과가 없습니다.' });
    // 필요한 필드만 돌려준다
    return res.status(200).json({
      ok: true,
      configured: true,
      item: {
        valid: item.valid,
        valid_msg: item.valid_msg,
        status: item.status ? { b_stt: item.status.b_stt, b_stt_cd: item.status.b_stt_cd, tax_type: item.status.tax_type } : null,
      },
    });
  } catch (e) {
    console.warn('[nts-validate] failed', e?.message);
    return res.status(502).json({ ok: false, error: '국세청 조회 중 오류가 발생했습니다.' });
  }
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;

  if (req.query?.action === 'nts-validate') {
    res.setHeader('Cache-Control', 'no-store');
    return handleNtsValidate(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { stage = 'approved', category = 'all', region = 'all', completedRounds = '0' } = req.query;
  const completed = parseInt(completedRounds, 10) || 0;
  const apiKey = process.env.DATA_GO_KR_API_KEY;

  // 1. 공공데이터포털 인증키가 설정되어 있는 경우: 실제 실시간 API 호출
  if (apiKey) {
    try {
      // 행정안전부 대한민국 공공서비스 혜택 API (REST/JSON)
      const dataGoKrUrl = `https://apis.data.go.kr/1741000/public_services_info/getServicesInfo?serviceKey=${encodeURIComponent(apiKey)}&pageNo=1&numOfRows=30&type=JSON`;
      
      const response = await fetch(dataGoKrUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const json = await response.json();
        const items = json?.response?.body?.items || [];

        // 수신된 공공데이터 파싱 및 회생 혜택 스키마로 변환
        const livePrograms = items.map((item, idx) => ({
          id: `live-gov-${idx + 1}`,
          priority: item.svcFieldNm?.includes('생계') ? 1 : 2,
          category: item.svcFieldNm?.includes('금융') ? 'diligent_repayment_loan' :
                    item.svcFieldNm?.includes('주거') ? 'housing_job' : 'welfare_emergency',
          badge: item.svcFieldNm || '정부 공적지원',
          title: item.svcNm || '공공 복지 서비스',
          subtitle: item.svcPurp || '정부 공공서비스 안내',
          organization: item.jurOrgNm || '관계 부처',
          eligibility: item.trgtDesc || '상세 공고 참조',
          benefit: item.svcCts || '지원 요건 충족 시 지원',
          officialUrl: item.onlnUrl || 'https://www.gov.kr',
          contactNumber: item.inqNum || '정부민원안내 110',
          targetStages: ['preparing', 'submitted', 'started', 'approved', 'completed'],
          region: item.jurOrgNm?.includes('서울') ? '서울' : '전국',
          criteriaTags: ['공공데이터포털실시간', item.svcFieldNm || '복지'],
          safetyNotice: '공공데이터포털(data.go.kr) 실시간 연동 정보입니다.'
        }));

        res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate`);
        return res.status(200).json({
          ok: true,
          isLiveApi: true,
          source: 'data_go_kr_live',
          totalCount: livePrograms.length,
          programs: livePrograms
        });
      }
    } catch (apiErr) {
      console.warn('[data.go.kr API Fetch Failed, Falling back to Curated Dataset]', apiErr.message);
    }
  }

  // 2. 인증키가 없거나 외부 통신 일시 실패 시: 법률·도산 특화 정제 공적 데이터셋 반환
  // (실제 회생파산 의뢰인에게 가장 신뢰도 높은 서민금융진흥원, 신복위, 긴급복지 등)
  res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate`);
  return res.status(200).json({
    ok: true,
    isLiveApi: Boolean(apiKey),
    source: apiKey ? 'curated_fallback' : 'curated_database',
    apiKeyConfigured: Boolean(apiKey),
    instruction: !apiKey ? '공공데이터포털(data.go.kr)에서 발급받은 인증키를 Vercel 환경변수 [DATA_GO_KR_API_KEY]에 등록하시면 행안부 실시간 데이터로 자동 전환됩니다.' : undefined,
    stage,
    category,
    region,
    completedRounds: completed,
    message: '공식 공공데이터 기준 16대 핵심 복지·정책금융 제도를 안정적으로 반환합니다.'
  });
}
