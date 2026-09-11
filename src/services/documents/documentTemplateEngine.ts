/**
 * 서식 자동 바인딩 및 대법원 규격 A4 법원 서식 렌더링 엔진
 * CRM 단일 데이터 소스(SSOT) ➔ 서식 변수 치환 및 법원 양식 생성
 */
import type { ConsultRequest, CrmClientExtension } from '../../types';
import { ALL_LEGAL_DOC_REGISTRY, type LegalDocItem } from './legalDocRegistry';

export interface BoundDocumentData {
  docCode: string;
  title: string;
  courtName: string;
  caseNumber: string;
  debtorName: string;
  debtorRrn: string;
  debtorPhone: string;
  debtorAddress: string;
  agentLawyerName: string;
  agentLawfirm: string;
  purpose: string;
  reason: string;
  evidenceList: string[];
  submissionDate: string;
  customFields: Record<string, string | number>;
}

/**
 * CRM 데이터로부터 문서 변수 100% 자동 바인딩
 */
export function bindDocumentVariables(
  doc: LegalDocItem,
  client: ConsultRequest,
  crmExt?: CrmClientExtension,
  lawyerName: string = '담당 변호사'
): BoundDocumentData {
  const profile = client.financialProfile;
  const courtCase = crmExt?.courtCase;

  const clientName = client.clientName || profile?.name || '신청인';
  const courtName = courtCase?.courtName || profile?.selectedCourt || client.court || '서울회생법원';
  const caseNumber = courtCase?.caseNumber || (doc.caseScope === 'BANKRUPTCY' ? '2026하면 10482호' : '2026개회 50284호');
  
  // 주민번호 (기본 목업 마스킹 처리)
  const debtorRrn = (profile as any)?.rrn || '820415-1******';
  const debtorPhone = client.phone || profile?.phone || '010-0000-0000';
  const debtorAddress = profile?.address || '서울특별시 서초구 서초대로 250';

  // 1. 기본 신청취지
  let purpose = doc.defaultPurpose || '';
  if (!purpose) {
    if (doc.category === 'CORRECTION') {
      purpose = `귀원의 보정명령에 대하여 신청인은 별지와 같이 성실하게 보정하여 제출합니다.`;
    } else if (doc.category === 'RELEASE') {
      purpose = `위 당사자 사이의 강제집행 사건에 관하여 개인회생인가결정(또는 면책결정)이 확정되었으므로, 그 집행의 해제를 신청합니다.`;
    } else {
      purpose = `별지 기재와 같은 결정을 구합니다.`;
    }
  }

  // 2. 기본 신청이유 / 소명내용
  let reason = doc.defaultReasonTemplate || '';
  if (!reason) {
    if (doc.category === 'STAY_INJUNCT') {
      reason = `1. 신청인은 귀원에 개인회생(또는 파산) 신청을 접수하고 성실하게 절차를 진행 중입니다.\n2. 그러나 최근 채권자들의 급여 및 통장 압류, 무차별적인 채권추심으로 인하여 기본 생계가 위협받고 직장 생활 유지가 심각히 곤란한 상태입니다.\n3. 이에 채무자 회생 및 파산에 관한 법률 관련 조항에 기하여 긴급히 중지(금지)명령을 구하오니 혜량하여 주시기 바랍니다.`;
    } else if (doc.category === 'CORRECTION') {
      reason = `1. 귀원의 보정명령 지적사항에 대하여 깊이 성찰하며 아래와 같이 상세히 소명합니다.\n2. 신청인은 고의적인 재산 은닉이나 편파변제 의도가 전혀 없었으며, 당시 불가피했던 생계비 지출 및 채무 상환 내역을 증빙자료와 함께 명백히 밝힙니다.`;
    } else if (doc.category === 'RELEASE') {
      reason = `1. 신청인은 귀원 위 사건에 관하여 변제계획인가결정(또는 면책결정)을 수령하였고 본 결정은 확정되었습니다.\n2. 채무자 회생 및 파산에 관한 법률 제615조 제2항에 따라 종전에 행하여진 강제집행(가압류, 압류 및 추심명령)은 그 효력을 상실하였으므로 즉시 해제하여 주시기 바랍니다.`;
    } else if (doc.category === 'EVIDENCE') {
      reason = `위 본인은 상기 기재 사실관계가 추호의 거짓도 없음을 확인하며, 만일 허위 진술이나 은닉 재산이 발견될 경우 어떠한 법적 불이익도 감수할 것을 서약합니다.`;
    } else {
      reason = `신청인은 채무자회생법이 정하는 요건을 충족하여 본 신청에 이른 것이므로 인용하여 주시기 바랍니다.`;
    }
  }

  // 3. 증빙 목록 생성
  const evidenceList: string[] = doc.defaultEvidenceList || [
    '1. 변제계획인가결정문(또는 접수증명원) 1부',
    '2. 압류 및 추심명령 결정문 사본 1부',
    '3. 신청인 주민등록초본 1부',
    '4. 소송위임장 1부'
  ];

  const today = new Date();
  const submissionDate = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

  return {
    docCode: doc.docCode,
    title: doc.title,
    courtName,
    caseNumber,
    debtorName: clientName,
    debtorRrn,
    debtorPhone,
    debtorAddress,
    agentLawyerName: lawyerName,
    agentLawfirm: '법무법인 리걸케어 (담당변호사: ' + lawyerName + ')',
    purpose,
    reason,
    evidenceList,
    submissionDate,
    customFields: {
      monthlyIncome: profile?.income || 0,
      totalDebt: profile?.debtTotal || 0,
      jobType: profile?.jobType || profile?.employmentType || '급여소득자',
      companyName: profile?.companyName || '주식회사 한국상사',
      creditorCount: profile?.creditorCount || 5
    }
  };
}

/**
 * AI 법률 사유서 작성 지원용 프롬프트 생성 헬퍼
 */
export function generateAiLegalDraftPrompt(doc: LegalDocItem, data: BoundDocumentData, userNotes: string): string {
  return `[법률 서면 작성 요청]
문서명: ${doc.title} (${doc.docCode})
사건번호: ${data.caseNumber} (${data.courtName})
신청인(채무자): ${data.debtorName}
직업/소득: ${data.customFields.jobType} (월 ${data.customFields.monthlyIncome}만 원)
실무자 핵심 메모: "${userNotes}"

대한민국 채무자 회생 및 파산에 관한 법률 실무준칙에 부합하도록, 법원 판사와 회생위원의 설득을 이끌어낼 수 있는 정중하고 명확한 법률적 문장의 [신청이유/보정사유] 3개 항을 작성해주세요.`;
}
