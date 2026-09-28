// ============================================================
// 전자계약 무결성(Integrity) 및 3중 타임스탬프(Time-Stamp) 엔진
// Web Crypto API 기반 SHA-256 해시 산출 및 공인 감사추적 인증서 데이터 생성
// ============================================================

import type { ElectronicContract } from '../types';

/**
 * 텍스트 또는 바이너리 문자열에 대한 SHA-256 해시 계산 (Web Crypto API)
 */
export async function calculateSha256(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Web Crypto API 폴백 (오래된 환경용 단순 해시 대안)
    console.warn('[IntegrityService] Web Crypto digest fallback:', err);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    return `fallback-${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }
}

/**
 * 계약서 원본 내용(텍스트)으로부터 원본 SHA-256 해시 생성
 */
/**
 * 정규화 JSON 직렬화 — 키를 정렬하고 null/undefined 키는 제외한다.
 * (DB JSONB 왕복 시 키 순서·null 처리 차이로 같은 계약서가 다른 해시가 되는 것을 방지)
 * ※ api/contract.js의 canonicalStringify와 동일 규칙
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(v => canonicalStringify(v)).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter(k => obj[k] !== null && obj[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function generateContractOriginalHash(contract: ElectronicContract): Promise<string> {
  const seedString = canonicalStringify({
    id: contract.id,
    clientName: contract.clientName,
    clientPhone: contract.clientPhone,
    businessInfo: contract.businessInfo,
    lawyerName: contract.lawyerName,
    totalFee: contract.totalFee,
    feeSchedule: contract.feeSchedule,
    contractDate: contract.contractDate,
    documents: contract.documents.map(d => ({ id: d.id, title: d.title, content: d.content })),
  });

  return calculateSha256(seedString);
}

/**
 * 자필 서명이 결합된 체결본에 대한 최종 SHA-256 해시 생성
 */
export async function generateContractFinalHash(
  originalHash: string,
  clientSignature: string,
  lawyerSignature: string,
  signedAt: string
): Promise<string> {
  // 서명 이미지 전체의 SHA-256을 결합 (기존: 앞 100자만 사용 → PNG 헤더뿐이라 서명이 해시에 사실상 반영되지 않았음)
  // ※ api/contract.js(remote-sign)와 동일 산식 — 한쪽을 바꾸면 다른 쪽도 같이 바꿀 것
  const clientSigHash = await calculateSha256(clientSignature);
  const lawyerSigHash = await calculateSha256(lawyerSignature);
  const seed = `${originalHash}::CLIENT_SIG_SHA256:${clientSigHash}::LAWYER_SIG_SHA256:${lawyerSigHash}::AT:${signedAt}`;
  return calculateSha256(seed);
}

export type IntegrityCheckStatus = 'match' | 'mismatch' | 'unsigned' | 'unsupported';

/**
 * 저장된 계약서 내용·서명으로 전자지문을 다시 계산해 봉인 당시 값과 비교한다.
 * - 'match'      : 체결 이후 계약서 본문·서명이 바뀌지 않음
 * - 'mismatch'   : 재계산 값이 다름 (체결 후 변경되었거나 저장본 손상)
 * - 'unsigned'   : 아직 양 당사자 서명·봉인 전
 * - 'unsupported': 이전 방식으로 봉인되어 재계산 검증을 지원하지 않음
 */
export async function verifyContractIntegrity(contract: ElectronicContract): Promise<{
  status: IntegrityCheckStatus;
  recomputedFinalHash?: string;
}> {
  const stored = contract.documentHashes;
  if (!stored?.finalHash) return { status: 'unsigned' };
  if (!stored.signedAt) return { status: 'unsupported' };
  const included = contract.documents.filter(d => d.included);
  const clientSig = included.find(d => d.clientSignature)?.clientSignature;
  const lawyerSig = contract.documents.find(d => d.lawyerSignature)?.lawyerSignature;
  if (!clientSig || !lawyerSig) return { status: 'mismatch' };
  const original = await generateContractOriginalHash(contract);
  const finalHash = await generateContractFinalHash(original, clientSig, lawyerSig, stored.signedAt);
  const ok = original === stored.originalHash && finalHash === stored.finalHash;
  return { status: ok ? 'match' : 'mismatch', recomputedFinalHash: finalHash };
}

/**
 * 3중 타임스탬프(Triple Time-Stamp) 봉인 토큰 생성
 * 1. 통신사 공인 시각
 * 2. 대한민국 표준시(KST) 서버 시각
 * 3. 암호학적 해시 다이제스트 결합
 */
export async function generateTripleTimestampToken(params: {
  originalHash: string;
  finalHash: string;
  certifiedAt: string; // 통신사 공인 인증 시각
  txId: string;        // 통신사 승인 번호
  contractId: string;
}): Promise<{
  token: string;
  certifiedAt: string;
  kstServerTime: string;
  txId: string;
}> {
  const now = new Date();
  // 한국표준시(KST, UTC+9) 문자열 포맷
  const kstServerTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
  const seed = `TS-V2::${params.contractId}::${params.originalHash}::${params.finalHash}::${params.certifiedAt}::${params.txId}::${now.toISOString()}`;
  const digest = await calculateSha256(seed);
  const token = `TS-${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;

  return {
    token,
    certifiedAt: params.certifiedAt,
    kstServerTime,
    txId: params.txId,
  };
}

/**
 * 최종 계약서 감사추적 인증서(Audit Trail Certificate) 구조화 데이터 생성
 */
export interface AuditTrailCertificateData {
  contractId: string;
  contractTitle: string;
  completedAt: string;
  authority: {
    isBusiness: boolean;
    companyName: string;
    businessNumber: string;
    representativeName: string;
    ntsStatusName: string;
    authorityStatus: string;
  };
  identity: {
    signerName: string;
    carrier: string;
    txId: string;
    certifiedAt: string;
    deviceInfo: string;
    ipAddress: string;
  };
  intent: {
    scrollCompleted: boolean;
    viewDurationText: string;
    signatureMethod: string;
    agreedTermsCount: number;
  };
  integrity: {
    originalHash: string;
    finalHash: string;
    timestampToken: string;
    algorithm: string;
  };
}

export function buildAuditTrailCertificateData(contract: ElectronicContract): AuditTrailCertificateData {
  const isBiz = !!contract.isBusiness;
  const biz = contract.businessInfo;
  const idv = contract.identityVerification;
  const hashes = contract.documentHashes;
  const ts = contract.timestampToken;

  return {
    contractId: contract.id,
    contractTitle: '개인회생/파산 사건 수임 및 법률 사무 위임 계약서',
    completedAt: contract.updatedAt || new Date().toISOString(),
    authority: {
      isBusiness: isBiz,
      companyName: biz?.companyName || '-',
      businessNumber: biz?.businessNumber ? biz.businessNumber.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3') : '-',
      representativeName: biz?.representativeName || contract.clientName,
      ntsStatusName: biz?.ntsStatus === 'VALID' ? '정상 계속사업자 (국세청 실시간 확인)' : '미등록/해당없음',
      authorityStatus: contract.authorityStatus === 'REPRESENTATIVE_VERIFIED' 
        ? '대표자 권한 확인 완료 (REPRESENTATIVE_VERIFIED)' 
        : '일반 위임인 확인',
    },
    identity: {
      signerName: idv?.name || contract.clientName,
      // 기록이 없으면 그럴듯한 값을 지어내지 않고 '기록 없음'으로 표시
      carrier: idv?.carrier || idv?.providerName || '기록 없음',
      txId: idv?.txId || '기록 없음',
      certifiedAt: idv?.certifiedAt || '',
      deviceInfo: idv?.deviceInfo ? (idv.deviceInfo.length > 50 ? idv.deviceInfo.slice(0, 50) + '...' : idv.deviceInfo) : '기록 없음',
      ipAddress: idv?.ipAddress || '기록 없음',
    },
    intent: {
      scrollCompleted: contract.intentVerification?.scrollCompleted ?? false,
      viewDurationText: contract.intentVerification?.viewDurationSeconds ? `${contract.intentVerification.viewDurationSeconds}초 열람` : '열람 시간 기록 없음',
      signatureMethod: '스마트폰 터치 캔버스 자필 서명 날인 (PNG)',
      agreedTermsCount: contract.intentVerification?.agreedTerms?.length || 0,
    },
    integrity: {
      originalHash: hashes?.originalHash || '미생성',
      finalHash: hashes?.finalHash || '미생성 (양 당사자 서명 전)',
      timestampToken: ts?.token || '-',
      algorithm: 'SHA-256',
    },
  };
}
