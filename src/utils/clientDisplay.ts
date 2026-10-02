import type { ConsultRequest, CrmClientExtension } from '../types';

/**
 * 의뢰인의 실명 및 연락처 공개 여부 단일 판정 함수 (v2.0)
 *
 * 공개 판정 기준 (어느 하나라도 충족 시 공개):
 * 1. 외부 유입/변호사 직접 등록 의뢰인 (createdByLawyerId 또는 isExternalClient)
 * 2. 수임 계약 체결 이후 전 단계 (contracted, document, documents_pending, filed, commenced, repaying, discharged)
 * 3. 의뢰인이 제안서를 확인하고 연락처 제공/전화상담을 요청한 경우 (contactDisclosureStatus === 'contact_shared' || phoneConsultationRequested || contactSharedAt 존재)
 * 4. 제안서 중 전화상담 요청 이력이 있는 경우
 */
export function isClientContactDisclosed(
  req?: Partial<ConsultRequest> | null,
  crmExt?: Partial<CrmClientExtension> | null
): boolean {
  if (!req) return false;

  // 1. 외부 의뢰인/변호사 직접 등록
  if (req.createdByLawyerId || (req as any).isExternalClient || crmExt?.isExternalClient) {
    return true;
  }

  // 2. 계약 이후 전 단계 상태 판정
  const status = crmExt?.crmStatus || req.status || '';
  const postContractStatuses = [
    'contracted',
    'document',
    'documents_pending',
    'filed',
    'commenced',
    'repaying',
    'discharged',
  ];
  if (postContractStatuses.includes(status)) {
    return true;
  }

  // 3. 의뢰인 동의 연락처 공개 상태
  if (
    req.contactDisclosureStatus === 'contact_shared' ||
    req.phoneConsultationRequested ||
    Boolean(req.contactSharedAt)
  ) {
    return true;
  }

  // 4. 제안서 전화상담 요청 이력
  if ((req.proposals || []).some((p: any) => p.phoneConsultRequestedAt)) {
    return true;
  }

  return false;
}

/**
 * 단일화된 전화번호 표시 함수
 * 공개되지 않은 경우 "010-****-**** (미공개)" 반환
 */
export function getDisplayPhoneNumber(
  req?: Partial<ConsultRequest> | null,
  crmExt?: Partial<CrmClientExtension> | null
): string {
  if (!req) return '-';

  if (isClientContactDisclosed(req, crmExt)) {
    return req.phone || (req as any).clientPhone || (req as any).userPhone || '-';
  }

  return '010-****-**** (미공개)';
}

/**
 * 단일화된 의뢰인 성명 표시 함수
 * 미공개 시 스텔스 가명만 표시, 공개 시 실명(가명) 또는 실명 표시
 */
export function getDisplayClientName(
  req?: Partial<ConsultRequest> | null,
  crmExt?: Partial<CrmClientExtension> | null
): string {
  if (!req) return '신청인';

  const rawName = req.clientName || req.name || '고객';
  const parts = rawName.split('_');
  const stealthNickname = req.stealthNickname || (parts.length > 1 ? parts[1] : rawName);
  const realName = req.realClientName || (parts.length > 1 ? parts[0] : rawName);

  if (isClientContactDisclosed(req, crmExt)) {
    return parts.length > 1 ? `${realName} (${stealthNickname})` : realName;
  }

  return stealthNickname;
}

/**
 * 가명 여부 판정 함수 (전화번호의 '****'로 가명 여부를 추정하는 레거시 방식을 대체)
 */
export function isClientPseudonymous(
  req?: Partial<ConsultRequest> | null,
  crmExt?: Partial<CrmClientExtension> | null
): boolean {
  return !isClientContactDisclosed(req, crmExt);
}
