import type { ConsultProposal, ConsultRequest, ElectronicContract } from '../types';
import { buildContractDraft, saveContract, addAuditLog, loadContractsLocal, contractFromRow } from './contractService';
import type { OfflineContractRequestPayload } from '../components/client/ContractMethodSelectModal';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { rpcErrorMessage } from './office/rpcResult';

// ============================================================
// 제안서 → 전자 수임계약 시작 (고객 화면 공용)
// ------------------------------------------------------------
// 원칙: 고객 버튼 클릭만으로 계약을 "체결 완료"로 기록하지 않는다.
//  1) 제안서 조건으로 계약서를 '서명 대기(pending_sign)' 상태로 생성
//  2) 원격 서명 화면(?view=sign)으로 이동 → PortOne 본인인증 + 약관 동의 + 자필 서명
//  3) 본인인증 시 스텔스 가명을 인증된 실명·연락처로 전환 (realNameConversionPending)
//  4) 서명 완료 후 ClientRemoteSignView가 CRM에 동기화
// 10-31: 서버 환경에서는 계약서를 서버 함수 client_create_contract_from_proposal로 만든다.
//   금액·담당 변호사·사무소 이름은 서버가 제안서에서 채우고, 같은 제안서의 진행 중 계약이 있으면 그것을 돌려준다.
//   (이전: 의뢰인 브라우저가 계약서 행을 직접 만들었고, 표에 없는 칸 때문에 저장이 늘 실패했다)
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

const OPEN_STATUSES = ['drafting', 'pending_sign', 'client_review'];

function assertProposal(request: ConsultRequest, proposal: ConsultProposal) {
  if (!request?.id) throw new Error('상담 요청 정보를 찾을 수 없습니다.');
  if (!proposal?.lawyerId) throw new Error('제안서의 담당 변호사 정보가 없습니다.');
  // 오래된 제안서·다른 요청의 제안서로 계약하는 것을 방지
  if (!(request.proposals || []).some(p => p.id === proposal.id)) {
    throw new Error('이 상담 요청에 도착한 제안서가 아닙니다.');
  }
}

/** 제안서 조건이 들어간 계약 문서 양식 (서명 칸은 비어 있음) */
function proposalDocuments(request: ConsultRequest, proposal: ConsultProposal, clientDisplayName: string) {
  const base = buildContractDraft({
    clientId: request.clientId || request.id,
    clientRefId: request.id,
    clientName: clientDisplayName || request.clientName || '의뢰인',
    clientPhone: '',
    lawyerName: proposal.lawyerName,
    lawFirmName: proposal.firmName || '',
    assignedLawyerId: proposal.lawyerId,
    totalFee: proposal.fee,
    caseCategory: 'individual_rehab',
  });
  // 분납 일정(회차·금액·날짜)은 임의로 만들지 않는다 — 세부 스케줄은 담당 변호사가 확정한다
  const installments = parseInstallmentCount(proposal.installment);
  const feeWon = Math.round((proposal.fee || 0) * 10000);
  const basicTerms =
    `[제안서 기준 기본 약정]\n` +
    `- 총 수임료: ${feeWon.toLocaleString('ko-KR')}원 (${proposal.fee}만원)\n` +
    `- 분납 조건: ${proposal.installment ? `${proposal.installment}${installments ? ` (${installments}회 분할)` : ''}` : '일시 납부 또는 담당 변호사와 협의'}\n` +
    `- 회차별 납부일·금액은 담당 변호사가 확정하여 별도 안내하며, 안내된 스케줄이 본 약정의 첨부 스케줄이 된다.`;
  const documents = base.documents.map(d => {
    if (d.type === 'installment_agreement') return { ...d, included: true, content: `${d.content}\n\n${basicTerms}` };
    if (d.type === 'main_contract') return { ...d, content: `${d.content}\n\n${basicTerms}` };
    return d;
  });
  return { base, documents, installments };
}

async function createOnServer(params: {
  request: ConsultRequest; proposal: ConsultProposal; method: 'electronic' | 'in_person' | 'postal';
  clientDisplayName: string; documents: unknown[]; paperInfo?: unknown; audit: string;
}): Promise<ElectronicContract> {
  const { data, error } = await supabase.rpc('client_create_contract_from_proposal', {
    p_request_id: params.request.id,
    p_proposal_id: params.proposal.id,
    p_method: params.method,
    p_documents: params.documents,
    p_display_name: params.clientDisplayName || params.request.clientName || '의뢰인',
    p_paper_info: params.paperInfo ?? null,
    p_audit: params.audit,
  });
  if (error || !data) {
    const raw = error?.message || '';
    if (/too many contracts/i.test(raw)) throw new Error('오늘 이 상담 요청으로 계약서를 너무 많이 만들었어요. 담당 사무소에 문의해 주세요.');
    if (/proposal not found|consult request not found/i.test(raw)) throw new Error('제안서를 찾지 못했어요. 화면을 새로고침한 뒤 다시 시도해 주세요.');
    if (/lawyer office not found/i.test(raw)) throw new Error('담당 변호사 사무소 정보를 찾지 못했어요. 사무소에 직접 문의해 주세요.');
    throw new Error(error ? rpcErrorMessage(error) : '계약서를 만들지 못했어요.');
  }
  return contractFromRow(data);
}

export async function startContractFromProposal(params: {
  request: ConsultRequest;
  proposal: ConsultProposal;
  clientDisplayName: string;
}): Promise<StartContractResult> {
  const { request, proposal, clientDisplayName } = params;
  assertProposal(request, proposal);

  const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const buildSignUrl = (c: ElectronicContract) =>
    `${origin}?view=sign&cid=${encodeURIComponent(c.id)}&token=${encodeURIComponent(c.remoteSignToken || '')}`;
  const { base, documents, installments } = proposalDocuments(request, proposal, clientDisplayName);
  const audit = `의뢰인이 ${proposal.lawyerName} 변호사 제안서(수임료 ${proposal.fee}만원${proposal.installment ? `, 분납 조건: ${proposal.installment}` : ''}${installments ? ` / ${installments}회` : ''}) 기준 전자계약 진행을 요청 — 본인인증·서명 대기`;

  if (isSupabaseConfigured) {
    const contract = await createOnServer({ request, proposal, method: 'electronic', clientDisplayName, documents, audit });
    return { contract, signUrl: buildSignUrl(contract) };
  }

  // ── 로컬 개발 환경(서버 없음) ──
  const existing = loadContractsLocal().find(
    c => c.sourceProposalId === proposal.id && OPEN_STATUSES.includes(c.status) && !!c.remoteSignToken
  );
  if (existing) return { contract: existing, signUrl: buildSignUrl(existing) };
  let contract: ElectronicContract = {
    ...base,
    documents,
    status: 'pending_sign',
    realNameConversionPending: true,
    consultRequestId: request.id,
    sourceProposalId: proposal.id,
  };
  contract = addAuditLog(contract, audit, 'client');
  await saveContract(contract);
  return { contract, signUrl: buildSignUrl(contract) };
}

/**
 * 제안서 기준 온·오프라인 하이브리드 서면(방문/우편) 계약 요청 접수
 */
export async function requestOfflineContractFromProposal(params: {
  request: ConsultRequest;
  proposal: ConsultProposal;
  clientDisplayName: string;
  payload: OfflineContractRequestPayload;
}): Promise<ElectronicContract> {
  const { request, proposal, clientDisplayName, payload } = params;
  assertProposal(request, proposal);

  const modeLabel = payload.method === 'in_person' ? '방문(대면) 체결' : '우편(등기) 계약';
  const detailNote = payload.method === 'in_person'
    ? `방문 희망일시: ${payload.visitDate || ''} ${payload.visitTime || ''}${payload.notes ? ` (메모: ${payload.notes})` : ''}`
    : `수령 주소: ${payload.postalAddress || ''} ${payload.postalDetailAddress || ''}${payload.postcode ? ` (${payload.postcode})` : ''}${payload.notes ? ` (메모: ${payload.notes})` : ''}`;
  const paperContractInfo = {
    method: payload.method,
    signedDate: '',
    notes: detailNote,
    postalInfo: payload.method === 'postal' ? {
      recipientAddress: payload.postalAddress || '',
      recipientDetailAddress: payload.postalDetailAddress,
      postcode: payload.postcode,
    } : undefined,
  };
  const audit = `의뢰인이 ${proposal.lawyerName} 변호사 제안서 기준 [${modeLabel}]을 요청함 - ${detailNote}`;
  const { base, documents } = proposalDocuments(request, proposal, clientDisplayName);

  // 사무소에는 호출한 화면(ChatView)이 보내는 상담방 메시지와 서버 알림으로 전달된다.
  if (isSupabaseConfigured) {
    return createOnServer({ request, proposal, method: payload.method, clientDisplayName, documents, paperInfo: paperContractInfo, audit });
  }

  // ── 로컬 개발 환경(서버 없음) ──
  let contract = loadContractsLocal().find(c => c.sourceProposalId === proposal.id && OPEN_STATUSES.includes(c.status));
  contract = contract
    ? { ...contract, contractMethod: payload.method, paperContractInfo }
    : { ...base, documents, status: 'drafting', consultRequestId: request.id, sourceProposalId: proposal.id, contractMethod: payload.method, paperContractInfo };
  contract = addAuditLog(contract, audit, 'client');
  await saveContract(contract);
  return contract;
}
