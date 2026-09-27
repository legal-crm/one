import type { ConsultProposal, ConsultRequest, ElectronicContract } from '../types';
import { createContract, saveContract, addAuditLog, loadContractsLocal } from './contractService';

// ============================================================
// 제안서 → 전자 수임계약 시작 (고객 화면 공용)
// ------------------------------------------------------------
// 원칙: 고객 버튼 클릭만으로 계약을 "체결 완료"로 기록하지 않는다.
//  1) 제안서 조건으로 계약서를 '서명 대기(pending_sign)' 상태로 생성
//  2) 원격 서명 화면(?view=sign)으로 이동 → PortOne 본인인증 + 약관 동의 + 자필 서명
//  3) 본인인증 시 스텔스 가명을 인증된 실명·연락처로 전환 (realNameConversionPending)
//  4) 서명 완료 후 ClientRemoteSignView가 CRM에 동기화
// ============================================================

/** 제안서의 분납 문구("4회 분납", "6개월 무이자")에서 회차 추출 */
function parseInstallmentCount(installment?: string): number | undefined {
  if (!installment) return undefined;
  const m = installment.match(/(\d+)\s*(회|개월)/);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : undefined;
}

export interface StartContractResult {
  contract: ElectronicContract;
  signUrl: string;
}

export async function startContractFromProposal(params: {
  request: ConsultRequest;
  proposal: ConsultProposal;
  clientDisplayName: string;
}): Promise<StartContractResult> {
  const { request, proposal, clientDisplayName } = params;

  if (!request?.id) throw new Error('상담 요청 정보를 찾을 수 없습니다.');
  if (!proposal?.lawyerId) throw new Error('제안서의 담당 변호사 정보가 없습니다.');
  // 오래된 제안서·다른 요청의 제안서로 계약하는 것을 방지
  if (!(request.proposals || []).some(p => p.id === proposal.id)) {
    throw new Error('이 상담 요청에 도착한 제안서가 아닙니다.');
  }

  const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const buildSignUrl = (c: ElectronicContract) =>
    `${origin}?view=sign&cid=${encodeURIComponent(c.id)}&token=${encodeURIComponent(c.remoteSignToken || '')}`;

  // 같은 제안서로 이미 서명 대기 중인 계약서가 있으면 새로 만들지 않고 이어서 진행
  const OPEN_STATUSES = ['drafting', 'pending_sign', 'client_review'];
  const existing = loadContractsLocal().find(
    c => c.sourceProposalId === proposal.id && OPEN_STATUSES.includes(c.status) && !!c.remoteSignToken
  );
  if (existing) {
    return { contract: existing, signUrl: buildSignUrl(existing) };
  }

  const base = createContract({
    clientId: request.clientId || request.id,
    clientRefId: request.id,
    // 계약 전까지는 가명·미공개 연락처 — 본인인증 단계에서 실명으로 전환
    clientName: clientDisplayName || request.clientName || '의뢰인',
    clientPhone: '',
    lawyerName: proposal.lawyerName,
    lawFirmName: proposal.firmName || '',
    assignedLawyerId: proposal.lawyerId,
    totalFee: proposal.fee,
    caseCategory: 'individual_rehab',
  });

  // 분납 일정(회차·금액·날짜)은 임의로 만들지 않는다 — 제안서의 분납 조건은 감사 로그에 기록하고,
  // 세부 스케줄은 담당 변호사가 CRM 계약 관리에서 확정한다.
  const installments = parseInstallmentCount(proposal.installment);
  let contract: ElectronicContract = {
    ...base,
    status: 'pending_sign',
    realNameConversionPending: true,
    consultRequestId: request.id,
    sourceProposalId: proposal.id,
  };
  contract = addAuditLog(
    contract,
    `의뢰인이 ${proposal.lawyerName} 변호사 제안서(수임료 ${proposal.fee}만원${proposal.installment ? `, 분납 조건: ${proposal.installment}` : ''}${installments ? ` / ${installments}회` : ''}) 기준 전자계약 진행을 요청 — 본인인증·서명 대기`,
    'client'
  );
  await saveContract(contract);

  return { contract, signUrl: buildSignUrl(contract) };
}
