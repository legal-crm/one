// ============================================================
// 계약서 공개 진위 확인 (계약서 PDF의 QR · ?verify=계약번호)
// - 서버(/api/contract?action=public-verify)가 전자지문을 다시 계산하고, 개인정보를 뺀 결과만 돌려준다.
//   (위임인 이름은 가운데를 가림. 연락처·주소·수임료·서명 이미지·본문·서명 토큰은 받지 않는다)
// - 이전: 브라우저가 계약서 전체 행을 ID로 조회(select *) → RLS가 막으면 누구도 확인할 수 없고,
//   정책이 느슨해지면 실명·연락처·서명 토큰까지 받을 수 있는 구조였음
// ============================================================

import type { ElectronicContract } from '../types';
import { verifyContractIntegrity, type IntegrityCheckStatus } from './integrityService';
import { loadContractsLocal } from './contractService';

export interface PublicContractAnchor {
  isRealOnChain: boolean;
  txHash: string | null;
  network: string | null;
  blockNumber: number | null;
  explorerUrl: string | null;
}

export interface PublicContractVerification {
  id: string;
  status: string | null;
  cancelled: boolean;
  clientNameMasked: string;
  lawFirmName: string;
  lawyerName: string;
  contractDate: string | null;
  signedAt: string | null;
  finalHash: string | null;
  integrity: IntegrityCheckStatus | 'error';
  blockchainAnchor: PublicContractAnchor | null;
}

export type PublicVerifyResult =
  | { kind: 'found'; data: PublicContractVerification }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

/** 공개 화면용 이름 가림 — 홍길동 → 홍*동, 김철 → 김*, 남궁민수 → 남**수 (서버와 같은 규칙) */
export function maskPersonName(name?: string | null): string {
  const chars = Array.from(String(name || '').trim());
  if (chars.length === 0) return '-';
  if (chars.length === 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/** 이 기기에 있는 계약서로 같은 모양의 결과를 만든다 (개발 서버에 /api가 없을 때만 사용) */
async function fromLocalContract(c: ElectronicContract): Promise<PublicContractVerification> {
  let integrity: PublicContractVerification['integrity'] = 'error';
  try {
    integrity = (await verifyContractIntegrity(c)).status;
  } catch {
    integrity = 'error';
  }
  const a = c.blockchainAnchor;
  const personName = c.isBusiness ? c.businessInfo?.representativeName || c.clientName : c.clientName;
  return {
    id: c.id,
    status: c.status || null,
    cancelled: c.status === 'cancelled',
    clientNameMasked: maskPersonName(personName),
    lawFirmName: c.lawFirmName || '',
    lawyerName: c.lawyerName || '',
    contractDate: c.contractDate || null,
    signedAt: c.documentHashes?.signedAt || null,
    finalHash: c.documentHashes?.finalHash || null,
    integrity,
    blockchainAnchor: a
      ? { isRealOnChain: !!a.isRealOnChain, txHash: a.txHash || null, network: a.network || null, blockNumber: a.blockNumber ?? null, explorerUrl: a.explorerUrl || null }
      : null,
  };
}

export async function fetchPublicContractVerification(id: string): Promise<PublicVerifyResult> {
  const contractId = String(id || '').trim();
  if (!contractId) return { kind: 'not_found' };
  try {
    const res = await fetch(`/api/contract?action=public-verify&id=${encodeURIComponent(contractId)}`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json().catch(() => null);
    if (json && json.ok && json.contract) return { kind: 'found', data: json.contract as PublicContractVerification };
    // 개발 서버(vite)는 /api 함수를 실행하지 않는다(JSON이 아닌 응답) → 이 기기의 계약서로만 확인
    if (import.meta.env.DEV && !json) {
      const local = loadContractsLocal().find(c => c.id === contractId);
      return local ? { kind: 'found', data: await fromLocalContract(local) } : { kind: 'not_found' };
    }
    if (res.status === 404 || res.status === 400) return { kind: 'not_found' };
    return { kind: 'error', message: json?.error || `검증 서버 응답 오류 (${res.status})` };
  } catch {
    if (import.meta.env.DEV) {
      const local = loadContractsLocal().find(c => c.id === contractId);
      if (local) return { kind: 'found', data: await fromLocalContract(local) };
    }
    return { kind: 'error', message: '네트워크 오류로 확인하지 못했어요.' };
  }
}
