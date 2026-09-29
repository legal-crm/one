// Vercel Serverless Function: 전자계약 블록체인(Polygon PoS / Amoy) 온체인 앵커링 & 무결성 검증 API
// 지원 액션:
//   - GET  /api/contract?action=status  (Polygon RPC 노드 연결 상태, 최신 블록, 릴레이어 지갑 잔액 조회)
//   - POST /api/contract?action=anchor  (체결본 SHA-256 해시를 Polygon 분산원장에 영구 앵커링 트랜잭션 브로드캐스팅)
//   - GET  /api/contract?action=verify  (트랜잭션 해시 및 온체인 Input Data 일치 여부 실시간 RPC 검증)

import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { polygon, polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';
import { 
  checkMultiTierRateLimit, 
  RATE_LIMIT_TIERS,
  checkCircuitBreaker,
  recordCircuitFailure,
  manualFreeze,
  manualUnfreeze,
  getCircuitBreakerStatus
} from './_lib/rate-limiter.js';
import { verifyAuth, supabase } from './_lib/auth-middleware.js';

import { setCorsHeaders } from './_lib/cors-helper.js';

// 동적 네트워크 해석 헬퍼 (환경변수 기본값 + 프론트엔드 어드민 설정 오버라이드 지원)
// [PART 3-5] 네트워크·RPC·공증 주소는 서버 환경변수로만 결정한다.
// (이전: 요청 본문/쿼리의 rpcUrl·notaryContract·network를 그대로 써서
//  - 비로그인 status/verify로 서버가 임의 URL에 접속(SSRF)하고
//  - 로그인만 하면 anchor로 릴레이어 개인키 서명 트랜잭션을 임의 RPC·임의 주소·메인넷으로 보내 가스를 소모시킬 수 있었음)
// allowNetworkSwitch: 읽기 전용(status/verify)에서만 고정된 두 네트워크 중 선택 허용
function resolveNetworkConfig(req, { allowNetworkSwitch = false } = {}) {
  const reqNetwork = allowNetworkSwitch ? (req.body?.network || req.query?.network) : null;
  const isMainnet = reqNetwork === 'mainnet' || reqNetwork === 'amoy'
    ? reqNetwork === 'mainnet'
    : process.env.POLYGON_NETWORK === 'mainnet';
  const currentChain = isMainnet ? polygon : polygonAmoy;
  const networkName = isMainnet ? 'Polygon PoS Mainnet (EVM-137)' : 'Polygon Amoy Testnet (EVM-80002)';
  const explorerBase = isMainnet ? 'https://polygonscan.com' : 'https://amoy.polygonscan.com';

  const rpcUrl = isMainnet
    ? (process.env.POLYGON_MAINNET_RPC || 'https://polygon.drpc.org')
    : (process.env.POLYGON_AMOY_RPC || 'https://polygon-amoy.drpc.org');

  const notaryAddress = process.env.POLYGON_NOTARY_CONTRACT || '0x3a82F56D2dE8B90b5C60105E7bFe7eA5C808E5C1';

  const client = createPublicClient({
    chain: currentChain,
    transport: http(rpcUrl, { timeout: 10_000, retryCount: 2 }),
  });

  return { isMainnet, currentChain, networkName, explorerBase, rpcUrl, notaryAddress, client };
}

function rpcHostOnly(url) {
  try { return new URL(url).host; } catch { return ''; }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // [SECURITY] Multi-Tier Rate Limiting (1분 10회, 10분 30회, 30분 60회 + 15분 Jail)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
  const rateLimit = checkMultiTierRateLimit(`contract:${ip}`, RATE_LIMIT_TIERS.STANDARD);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_TIERS.STANDARD.minute.max);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  if (rateLimit.retryAfter > 0) {
    res.setHeader('Retry-After', rateLimit.retryAfter);
  }

  if (rateLimit.isLimited) {
    console.warn(`[SECURITY Contract RateLimit] Blocked ${ip} (reason: ${rateLimit.reason}, retryAfter: ${rateLimit.retryAfter}s)`);
    return res.status(429).json({
      ok: false,
      error: `Too Many Requests: 요청 한도를 초과하여 잠시 차단되었습니다. (${Math.ceil(rateLimit.retryAfter / 60)}분 후 재시도 가능)`,
      retryAfter: rateLimit.retryAfter,
    });
  }

  // 액션 파싱
  let action = req.query?.action;
  if (!action && req.body?.action) action = req.body.action;
  if (!action && req.url) {
    try {
      const url = new URL(req.url, 'https://mykim.kr');
      action = url.searchParams.get('action');
      if (!action) {
        const parts = url.pathname.replace(/^\/api\/contract\/?/, '').split('/').filter(Boolean);
        if (parts.length > 0) action = parts[0];
      }
    } catch (_) {}
  }
  if (!action) action = 'status';

  // ─────────────────────────────────────────────────────────────
  // 0. [CIRCUIT BREAKER CONTROL & STATUS] 서킷 브레이커 상태 및 관리자 수동 제어
  // ─────────────────────────────────────────────────────────────
  if (action === 'circuit-status') {
    const status = getCircuitBreakerStatus('blockchain_anchor');
    return res.status(200).json({ ok: true, data: status });
  }

  if (action === 'freeze') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    try {
      const user = await verifyAuth(req, 'admin');
      const { durationMs, reason } = req.body || {};
      // 1분~24시간으로 제한 (이전: 임의 값 허용)
      const safeDuration = Math.min(24 * 60 * 60 * 1000, Math.max(60 * 1000, Number(durationMs) || 30 * 60 * 1000));
      const result = manualFreeze(
        'blockchain_anchor', 
        safeDuration, 
        String(reason || `관리자(${user.email || user.id})에 의한 수동 긴급 정지 발동`).slice(0, 200)
      );
      return res.status(200).json({ ok: true, data: result });
    } catch (authErr) {
      return res.status(403).json({ ok: false, error: authErr.message || '통합 관리자 권한이 필요합니다.' });
    }
  }

  if (action === 'unfreeze') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    try {
      await verifyAuth(req, 'admin');
      const result = manualUnfreeze('blockchain_anchor');
      return res.status(200).json({ ok: true, data: result });
    } catch (authErr) {
      return res.status(403).json({ ok: false, error: authErr.message || '통합 관리자 권한이 필요합니다.' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 0-1. [IDENTITY-VERIFY] 포트원 V2 본인인증 결과 서버 검증
  //   - 브라우저 SDK 결과는 위조 가능하므로, 서버가 PORTONE_API_SECRET으로 단건 조회해 VERIFIED 여부와 실명을 확인한다.
  //   - 비로그인 원격 서명 사용자는 contractId + remoteSignToken 쌍으로 인가한다.
  //   - CI/DI 원문은 클라이언트로 돌려보내지 않는다 (중복 확인용 해시만 반환).
  // ─────────────────────────────────────────────────────────────
  if (action === 'identity-verify') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const { identityVerificationId, contractId, remoteSignToken } = req.body || {};
    if (!identityVerificationId || typeof identityVerificationId !== 'string' || identityVerificationId.length > 200) {
      return res.status(400).json({ ok: false, error: 'identityVerificationId가 올바르지 않습니다.' });
    }

    let isAuthorized = false;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try { if (await verifyAuth(req)) isAuthorized = true; } catch (_) {}
    }
    if (!isAuthorized && contractId && remoteSignToken && supabase) {
      try {
        const { data: row } = await supabase
          .from('electronic_contracts')
          .select('id, remote_sign_token')
          .eq('id', contractId)
          .maybeSingle();
        if (row && typeof row.remote_sign_token === 'string' && row.remote_sign_token.length > 0) {
          const a = Buffer.from(row.remote_sign_token);
          const b = Buffer.from(String(remoteSignToken));
          isAuthorized = a.length === b.length && crypto.timingSafeEqual(a, b);
        }
      } catch (_) {}
    }
    if (!isAuthorized) {
      return res.status(401).json({ ok: false, error: '인증 정보가 없거나 서명 링크가 유효하지 않습니다.' });
    }

    const secret = process.env.PORTONE_API_SECRET;
    if (!secret) {
      return res.status(503).json({ ok: false, error: '본인인증 서버 검증이 설정되지 않았습니다. (PORTONE_API_SECRET 미설정)' });
    }

    try {
      const pr = await fetch(`https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`, {
        headers: { Authorization: `PortOne ${secret}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!pr.ok) {
        return res.status(502).json({ ok: false, error: `본인인증 내역을 조회하지 못했습니다. (${pr.status})` });
      }
      const detail = await pr.json();
      if (detail?.status !== 'VERIFIED' || !detail?.verifiedCustomer?.name) {
        return res.status(200).json({ ok: false, error: '본인인증이 완료되지 않았습니다.', status: detail?.status || 'UNKNOWN' });
      }
      const vc = detail.verifiedCustomer;
      return res.status(200).json({
        ok: true,
        status: 'VERIFIED',
        verifiedAt: detail.verifiedAt || new Date().toISOString(),
        verifiedCustomer: {
          name: vc.name,
          phoneNumber: vc.phoneNumber || '',
          birthDate: vc.birthDate || '',
          gender: vc.gender || '',
          isForeigner: !!vc.isForeigner,
          operator: vc.operator || '',
          ciHash: vc.ci ? crypto.createHash('sha256').update(vc.ci).digest('hex') : '',
        },
        // 서버가 본 접속 IP (감사 로그용)
        clientIp: ip,
      });
    } catch (e) {
      console.error('[identity-verify] PortOne lookup failed', e?.message);
      return res.status(502).json({ ok: false, error: '본인인증 검증 중 오류가 발생했습니다.' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 0-2. [REMOTE-SIGN] 비로그인 원격 서명 저장 (service role + 서명 토큰 인가)
  //   electronic_contracts UPDATE RLS는 로그인 사용자 전용이라, 문자 링크로 들어온 의뢰인의
  //   본인인증·서명이 서버에 저장되지 않던 문제를 해결한다. 클라이언트가 보낸 계약 전체를
  //   덮어쓰지 않고, 서버가 허용된 필드만 갱신한다.
  //   stage='identity'  : 포트원 단건 조회로 실명 확인 → (가명 계약이면) 실명 전환, 아니면 이름 대조
  //   stage='signature' : 본인인증 완료 계약에만 서명·확약 문구 저장 (1회), 변호사 서명이 있으면 해시 봉인
  // ─────────────────────────────────────────────────────────────
  if (action === 'remote-sign') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const body = req.body || {};
    const { contractId, remoteSignToken, stage } = body;
    if (!contractId || !remoteSignToken || !['identity', 'signature'].includes(stage)) {
      return res.status(400).json({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ ok: false, error: '서명 저장 서버가 설정되지 않았습니다.' });
    }

    const { data: row, error: rowErr } = await supabase
      .from('electronic_contracts').select('*').eq('id', contractId).maybeSingle();
    if (rowErr || !row || typeof row.remote_sign_token !== 'string' || !row.remote_sign_token) {
      return res.status(404).json({ ok: false, error: '계약서를 찾을 수 없습니다.' });
    }
    const tA = Buffer.from(row.remote_sign_token);
    const tB = Buffer.from(String(remoteSignToken));
    if (tA.length !== tB.length || !crypto.timingSafeEqual(tA, tB)) {
      return res.status(401).json({ ok: false, error: '유효하지 않은 서명 링크입니다.' });
    }

    const docs = Array.isArray(row.documents) ? row.documents : [];
    const alreadySigned = row.status === 'completed' || docs.some(d => d && d.included && d.clientSignature);
    if (alreadySigned) {
      return res.status(409).json({ ok: false, error: '이미 서명이 완료된 계약서입니다.' });
    }

    const now = new Date().toISOString();
    const ua = String(req.headers['user-agent'] || '').slice(0, 200);
    const audit = Array.isArray(row.audit_trail) ? row.audit_trail : [];
    const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

    if (stage === 'identity') {
      const secret = process.env.PORTONE_API_SECRET;
      const idvId = body.identityVerificationId;
      if (!secret) return res.status(503).json({ ok: false, error: '본인인증 서버 검증이 설정되지 않았습니다.' });
      if (!idvId || typeof idvId !== 'string' || idvId.length > 200) {
        return res.status(400).json({ ok: false, error: 'identityVerificationId가 올바르지 않습니다.' });
      }
      let detail;
      try {
        const pr = await fetch(`https://api.portone.io/identity-verifications/${encodeURIComponent(idvId)}`, {
          headers: { Authorization: `PortOne ${secret}` }, signal: AbortSignal.timeout(10000),
        });
        if (!pr.ok) return res.status(502).json({ ok: false, error: `본인인증 내역을 조회하지 못했습니다. (${pr.status})` });
        detail = await pr.json();
      } catch (e) {
        return res.status(502).json({ ok: false, error: '본인인증 검증 중 오류가 발생했습니다.' });
      }
      const vc = detail?.verifiedCustomer;
      if (detail?.status !== 'VERIFIED' || !vc?.name) {
        return res.status(200).json({ ok: false, error: '본인인증이 완료되지 않았습니다.' });
      }
      const realName = String(vc.name).trim();
      const realPhone = String(vc.phoneNumber || '').replace(/\D/g, '');
      const providerName = String(body.providerName || '포트원 본인인증').slice(0, 60);
      const identity = {
        method: `portone_${String(body.provider || 'unknown').slice(0, 10)}`,
        providerName,
        name: realName,
        phoneMasked: realPhone ? realPhone.replace(/(\d{3})\d{3,4}(\d{4})/, '$1-****-$2') : undefined,
        birthDate: vc.birthDate || undefined,
        carrier: vc.operator || undefined,
        txId: idvId,
        certifiedAt: detail.verifiedAt || now,
        ci: vc.ci ? sha256(vc.ci) : undefined,
        isForeigner: !!vc.isForeigner,
        deviceInfo: ua,
        ipAddress: ip,
      };

      const patch = { identity_verification: identity, updated_at: now };
      if (row.real_name_conversion_pending && !row.is_business) {
        const alias = String(row.client_name || '');
        const swap = (t) => (alias && alias !== realName && typeof t === 'string') ? t.split(alias).join(realName) : t;
        patch.client_name = realName;
        if (realPhone) patch.client_phone = realPhone;
        patch.documents = docs.map(d => ({ ...d, content: swap(d.content) }));
        patch.real_name_conversion_pending = false;
        patch.authority_status = 'REPRESENTATIVE_VERIFIED';
        patch.audit_trail = [...audit, { action: `본인인증(${providerName}) 완료 — 가명 계약 당사자를 인증된 실명으로 전환`, timestamp: now, actor: 'client', ip, userAgent: ua }];
      } else {
        const expected = String((row.is_business ? row.business_info?.representativeName : null) || row.client_name || '').replace(/\s+/g, '');
        if (!expected || expected !== realName.replace(/\s+/g, '')) {
          return res.status(200).json({ ok: false, error: '본인인증된 이름이 계약서의 위임인(대표자) 이름과 일치하지 않습니다. 담당 변호사에게 문의해 주세요.' });
        }
        const expPhone = String(row.client_phone || '').replace(/\D/g, '');
        if (expPhone && realPhone && expPhone.slice(-8) !== realPhone.slice(-8)) {
          return res.status(200).json({ ok: false, error: '본인인증된 휴대폰 번호가 계약서에 등록된 연락처와 다릅니다. 담당 변호사에게 연락처 확인을 요청해 주세요.' });
        }
        patch.authority_status = 'REPRESENTATIVE_VERIFIED';
        patch.audit_trail = [...audit, { action: `본인인증(${providerName}) 완료 — 위임인 실명 일치 확인`, timestamp: now, actor: 'client', ip, userAgent: ua }];
      }

      const { data: updated, error: upErr } = await supabase
        .from('electronic_contracts').update(patch).eq('id', contractId).select('*').maybeSingle();
      if (upErr || !updated) return res.status(500).json({ ok: false, error: '인증 결과를 저장하지 못했습니다.' });
      return res.status(200).json({ ok: true, contract: updated });
    }

    // stage === 'signature'
    if (!row.identity_verification || !row.identity_verification.txId) {
      return res.status(409).json({ ok: false, error: '본인인증을 먼저 완료해 주세요.' });
    }
    const sig = body.clientSignature;
    if (typeof sig !== 'string' || !sig.startsWith('data:image/png;base64,') || sig.length < 2000 || sig.length > 800000) {
      return res.status(400).json({ ok: false, error: '서명 이미지가 올바르지 않습니다. 다시 서명해 주세요.' });
    }
    const confirmations = body.confirmations && typeof body.confirmations === 'object' ? body.confirmations : {};
    for (const d of docs) {
      if (d && d.included && d.requiredConfirmationText) {
        const typed = String(confirmations[d.id] || '').trim();
        if (typed !== String(d.requiredConfirmationText).trim()) {
          return res.status(400).json({ ok: false, error: `[${d.title}] 중요 조항 확인 문구가 일치하지 않습니다.` });
        }
      }
    }
    const agreedTerms = Array.isArray(body.agreedTerms) ? body.agreedTerms.map(t => String(t).slice(0, 40)).slice(0, 10) : [];
    if (agreedTerms.length < 4) {
      return res.status(400).json({ ok: false, error: '필수 약관에 모두 동의해 주세요.' });
    }

    const signedDocs = docs.map(d => {
      if (!d || !d.included) return d;
      return {
        ...d,
        clientSignature: sig,
        clientSignedAt: now,
        clientConfirmationText: d.requiredConfirmationText ? String(confirmations[d.id] || '').trim() : undefined,
        confirmedAt: d.requiredConfirmationText ? now : undefined,
      };
    });
    const patch = {
      documents: signedDocs,
      intent_verification: { scrollCompleted: false, agreedTerms },
      updated_at: now,
      audit_trail: [...audit, { action: `위임인(${row.client_name}) 본인인증 후 약관 ${agreedTerms.length}개 동의·중요조항 확인·전자서명 제출`, timestamp: now, actor: 'client', ip, userAgent: ua }],
    };

    // 변호사 서명이 이미 있으면 서버에서 해시 봉인 (integrityService와 동일 산식)
    const lawyerSig = docs.find(d => d && d.lawyerSignature)?.lawyerSignature;
    // src/services/integrityService.ts canonicalStringify와 동일 규칙 (키 정렬, null/undefined 키 제외)
    const canonicalStringify = (v) => {
      if (v === null || v === undefined) return 'null';
      if (Array.isArray(v)) return `[${v.map(canonicalStringify).join(',')}]`;
      if (typeof v === 'object') {
        const keys = Object.keys(v).filter(k => v[k] !== null && v[k] !== undefined).sort();
        return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalStringify(v[k])}`).join(',')}}`;
      }
      return JSON.stringify(v);
    };
    if (lawyerSig) {
      const originalHash = sha256(canonicalStringify({
        id: row.id,
        clientName: row.client_name,
        clientPhone: row.client_phone,
        businessInfo: row.business_info,
        lawyerName: row.lawyer_name,
        totalFee: row.total_fee,
        feeSchedule: row.fee_schedule || [],
        contractDate: row.contract_date,
        documents: signedDocs.map(d => ({ id: d.id, title: d.title, content: d.content })),
      }));
      const finalHash = sha256(`${originalHash}::CLIENT_SIG_SHA256:${sha256(sig)}::LAWYER_SIG_SHA256:${sha256(lawyerSig)}::AT:${now}`);
      patch.status = 'completed';
      patch.document_hashes = { originalHash, finalHash, algorithm: 'SHA-256', signedAt: now };
      patch.audit_trail.push({ action: '계약 체결 완료 (양 당사자 서명)', timestamp: now, actor: 'system', documentHash: finalHash, details: `SHA-256 원본: ${originalHash.slice(0, 16)}... | 체결본: ${finalHash.slice(0, 16)}...`, ip, userAgent: ua });
    }

    const { data: updated, error: upErr } = await supabase
      .from('electronic_contracts').update(patch).eq('id', contractId).select('*').maybeSingle();
    if (upErr || !updated) return res.status(500).json({ ok: false, error: '서명을 저장하지 못했습니다.' });
    return res.status(200).json({ ok: true, contract: updated });
  }

  // ─────────────────────────────────────────────────────────────
  // 1. [STATUS] 블록체인 노드 연결 및 릴레이어 지갑 상태 조회
  // ─────────────────────────────────────────────────────────────
  if (action === 'status') {
    const { isMainnet, currentChain, networkName, explorerBase, rpcUrl, notaryAddress, client } = resolveNetworkConfig(req, { allowNetworkSwitch: true });
    try {
      const blockNumber = await client.getBlockNumber();

      let relayerAddress = null;
      let relayerBalance = null;
      const rawPrivateKey = process.env.POLYGON_RELAYER_PRIVATE_KEY;
      const hasRelayerKey = Boolean(rawPrivateKey && rawPrivateKey.trim() !== '');

      if (hasRelayerKey) {
        try {
          const cleanKey = rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`;
          const account = privateKeyToAccount(cleanKey);
          relayerAddress = account.address;
          const balanceWei = await client.getBalance({ address: account.address });
          relayerBalance = `${parseFloat(formatEther(balanceWei)).toFixed(4)} POL`;
        } catch (walletErr) {
          console.warn('[Contract Status] Relayer parsing error:', walletErr.message);
        }
      }

      return res.status(200).json({
        ok: true,
        network: networkName,
        isMainnet: isMainnet,
        chainId: currentChain.id,
        // RPC URL 경로·쿼리에 공급자 API 키가 들어갈 수 있어 호스트만 반환 (이전: 인증 없는 status가 전체 URL 반환)
        rpcUrl: rpcHostOnly(rpcUrl),
        blockHeight: Number(blockNumber),
        explorerBase: explorerBase,
        hasRelayerKey,
        relayerAddress,
        relayerBalance,
        notaryContract: notaryAddress,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Contract Status Error]:', err);
      return res.status(200).json({
        ok: false,
        network: networkName,
        isMainnet: isMainnet,
        chainId: currentChain.id,
        // RPC URL 경로·쿼리에 공급자 API 키가 들어갈 수 있어 호스트만 반환 (이전: 인증 없는 status가 전체 URL 반환)
        rpcUrl: rpcHostOnly(rpcUrl),
        notaryContract: notaryAddress,
        error: err.message || 'Polygon RPC 노드 연결 실패',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. [ANCHOR] 체결본 SHA-256 해시를 분산원장에 영구 앵커링
  // ─────────────────────────────────────────────────────────────
  if (action === 'anchor') {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    // [SECURITY 1. Circuit Breaker] 비상 일시 정지(동결) 상태 선제 검사
    const cbCheck = checkCircuitBreaker('blockchain_anchor');
    if (cbCheck.isFrozen) {
      console.warn(`[SECURITY CircuitBreaker Active] Anchor rejected for IP ${ip}. Freeze expires in ${cbCheck.retryAfter}s`);
      return res.status(503).json({
        ok: false,
        error: `[보안 긴급 정지] 비정상적인 무리한 호출 감지로 블록체인 온체인 각인이 일시 동결되었습니다. (약 ${Math.ceil(cbCheck.retryAfter / 60)}분 후 자동 복구 또는 관리자 해제 필요)`,
        circuitBreaker: true,
        frozen: true,
        retryAfter: cbCheck.retryAfter,
        reason: cbCheck.reason,
      });
    }

    const { contractId, documentHash, clientName, lawyerName, remoteSignToken } = req.body || {};

    // [SECURITY 2. Authentication Guard] 권한 검증: 관리자/변호사 세션 또는 정당한 1회용 원격서명 토큰
    let isAuthorized = false;
    let authUser = null;

    // A. Bearer 토큰(Supabase 세션) 확인
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        authUser = await verifyAuth(req);
        if (authUser) isAuthorized = true;
      } catch (authErr) {
        console.warn(`[Contract Anchor Auth Failed] IP ${ip}:`, authErr.message);
      }
    }

    // B. 비로그인 원격 서명(ClientRemoteSign)인 경우: remoteSignToken과 contractId 검증
    if (!isAuthorized && remoteSignToken && contractId) {
      try {
        const { data: contractRow, error: cErr } = await supabase
          .from('electronic_contracts')
          .select('id, remote_sign_token')
          .eq('id', contractId)
          .maybeSingle();

        // 상수 시간 비교 (remote-sign 액션과 동일)
        if (!cErr && contractRow && typeof contractRow.remote_sign_token === 'string' && contractRow.remote_sign_token) {
          const a = Buffer.from(contractRow.remote_sign_token);
          const b = Buffer.from(String(remoteSignToken));
          if (a.length === b.length && crypto.timingSafeEqual(a, b)) isAuthorized = true;
        }
      } catch (dbErr) {
        console.warn(`[Contract RemoteSignToken DB Check Error]:`, dbErr.message);
      }
    }

    // C. 무인가 요청 차단 및 서킷 브레이커 위반 누적
    // [PART 4] 이전: 비인가 요청도 전역 서킷 브레이커 실패로 누적 → 익명 사용자가 POST 10번으로
    //   모든 사용자의 앵커링을 30분간 멈출 수 있었다(DoS). 비인가 요청은 IP 단위 Rate Limit만 적용한다.
    if (!isAuthorized) {
      return res.status(401).json({
        ok: false,
        error: '접근 권한이 없습니다. 유효한 로그인 세션(Authorization) 또는 1회용 전자서명 토큰이 필요합니다.',
      });
    }

    // [SECURITY 3. Input Validation] contractId 및 64자리 SHA-256 해시 엄격 검증
    if (!contractId || !documentHash) {
      return res.status(400).json({ ok: false, error: 'contractId와 documentHash는 필수입니다.' });
    }

    const cleanHash = documentHash.replace(/^0x/, '').toLowerCase();
    if (cleanHash.length !== 64 || !/^[0-9a-f]{64}$/.test(cleanHash)) {
      return res.status(400).json({ ok: false, error: '유효한 32바이트(64자리) 16진수 SHA-256 해시여야 합니다.' });
    }

    const { isMainnet, currentChain, networkName, explorerBase, rpcUrl, notaryAddress, client } = resolveNetworkConfig(req);
    const rawPrivateKey = process.env.POLYGON_RELAYER_PRIVATE_KEY;
    const now = new Date();

    // A. 릴레이어 개인키가 등록되어 있는 경우 -> 실제 온체인 트랜잭션 브로드캐스팅
    if (rawPrivateKey && rawPrivateKey.trim() !== '') {
      try {
        const cleanKey = rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`;
        const account = privateKeyToAccount(cleanKey);
        const walletClient = createWalletClient({
          account,
          chain: currentChain,
          transport: http(rpcUrl, { timeout: 15_000 }),
        });

        // 가스비 잔액 확인
        const balanceWei = await client.getBalance({ address: account.address });
        if (balanceWei > 0n) {
          // 트랜잭션 전송: data 필드에 계약서 SHA-256 해시 영구 각인
          const txHash = await walletClient.sendTransaction({
            to: notaryAddress,
            value: 0n,
            data: `0x${cleanHash}`,
          });

          // 영수증 수신 대기 (최대 10초)
          let blockNumber = null;
          try {
            const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 10_000 });
            blockNumber = Number(receipt.blockNumber);
          } catch (_) {
            blockNumber = Number(await client.getBlockNumber());
          }

          const explorerUrl = `${explorerBase}/tx/${txHash}`;
          return res.status(200).json({
            ok: true,
            isRealOnChain: true,
            network: networkName,
            chainId: currentChain.id,
            txHash,
            blockNumber,
            anchoredAt: now.toISOString(),
            explorerUrl,
            contractHash: cleanHash,
            notaryContract: notaryAddress,
            relayerAddress: account.address,
            message: `${networkName}에 실제 온체인 트랜잭션이 성공적으로 영구 각인되었습니다.`,
          });
        } else {
          console.warn('[Contract Anchor] Relayer gas balance is 0. Falling back to cryptographic timestamp.');
        }
      } catch (txErr) {
        console.warn('[Contract Anchor On-Chain Failed -> Fallback to cryptographic anchor]:', txErr.message);
      }
    }

    // B. 릴레이어 키 미설정 또는 잔액 0 → 온체인 기록 없이 서버 다이제스트만 보관 (블록 높이는 참고값)
    try {
      let currentBlock = null; // 이전: 조회 실패 시 고정값 46945000
      try {
        currentBlock = Number(await client.getBlockNumber());
      } catch (_) {}

      // 암호학적 다이제스트 생성
      const digestSeed = `POLYGON::${currentChain.id}::CID:${contractId}::HASH:${cleanHash}::BLOCK:${currentBlock}::AT:${now.toISOString()}`;
      const digestHex = crypto.createHash('sha256').update(digestSeed).digest('hex');
      const fallbackTxHash = `0x${digestHex}`;

      return res.status(200).json({
        ok: true,
        isRealOnChain: false,
        network: networkName,
        chainId: currentChain.id,
        // 온체인 트랜잭션이 아니므로 탐색기 링크를 주지 않음 (이전: 존재하지 않는 tx의 PolygonScan 링크)
        txHash: fallbackTxHash,
        explorerUrl: null,
        referenceBlockNumber: currentBlock,
        anchoredAt: now.toISOString(),
        contractHash: cleanHash,
        notaryContract: notaryAddress,
        // 온체인 전송이 아니다: txHash는 서버가 만든 SHA-256 다이제스트이며 블록체인 트랜잭션이 아님
        message: '온체인 기록 미실행 — 서버가 계약 해시 다이제스트만 보관했습니다 (릴레이어 키·잔액 설정 시 온체인 기록 가능)',
      });
    } catch (fallbackErr) {
      console.error('[Contract Anchor Fallback Error]:', fallbackErr);
      return res.status(500).json({ ok: false, error: fallbackErr.message || '앵커링 처리 실패' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. [VERIFY] 트랜잭션 온체인 데이터 및 해시 일치 여부 실시간 검증
  // ─────────────────────────────────────────────────────────────
  if (action === 'verify') {
    const txHash = req.query?.txHash || req.body?.txHash;
    const documentHash = req.query?.documentHash || req.body?.documentHash;

    if (!txHash) {
      return res.status(400).json({ ok: false, error: 'txHash는 필수입니다.' });
    }

    const { isMainnet, currentChain, networkName, explorerBase, rpcUrl, notaryAddress, client } = resolveNetworkConfig(req, { allowNetworkSwitch: true });
    try {
      let onChainTx = null;

      try {
        onChainTx = await client.getTransaction({ hash: txHash });
      } catch (_) {
        // 노드에 아직 없거나 모의 트랜잭션인 경우
      }

      if (onChainTx) {
        const cleanDocHash = documentHash ? documentHash.replace(/^0x/, '').toLowerCase() : null;
        const inputData = onChainTx.input ? onChainTx.input.replace(/^0x/, '').toLowerCase() : '';
        const hashMatched = cleanDocHash ? inputData.includes(cleanDocHash) : true;

        return res.status(200).json({
          ok: true,
          verifiedOnChain: true,
          network: networkName,
          txHash,
          blockNumber: Number(onChainTx.blockNumber),
          from: onChainTx.from,
          to: onChainTx.to,
          inputData: onChainTx.input,
          hashMatched,
          statusText: hashMatched ? '온체인 트랜잭션 확인 · 문서 해시 일치' : '온체인 데이터 해시 불일치',
          explorerUrl: `${explorerBase}/tx/${txHash}`,
        });
      }

      // 온체인에서 찾지 못함 — 아무것도 검증하지 않았음을 그대로 알린다
      // (이전: '암호학적 타임스탬프 서명 일치'로 표시하고 존재하지 않는 tx의 탐색기 링크를 반환)
      return res.status(200).json({
        ok: true,
        verifiedOnChain: false,
        hashMatched: false,
        txHash,
        statusText: '온체인에서 해당 트랜잭션을 찾지 못했습니다 (검증되지 않음)',
        explorerUrl: null,
      });
    } catch (err) {
      console.error('[Contract Verify Error]:', err);
      return res.status(200).json({
        ok: false,
        error: err.message || '온체인 검증 실패',
      });
    }
  }

  return res.status(400).json({ ok: false, error: `알 수 없는 액션: ${action}` });
}
