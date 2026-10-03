/**
 * 서식 자동 바인딩 및 대법원 규격 A4 법원 서식 렌더링 엔진
 * CRM 단일 데이터 소스(SSOT) ➔ 서식 변수 치환 및 법원 양식 생성
 */
import type { ConsultRequest, CrmClientExtension } from '../../types';
import { ALL_LEGAL_DOC_REGISTRY, type LegalDocItem } from './legalDocRegistry';
import { getOfficeProfile } from '../lawyer/officeProfile';

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
  const defaultCaseNo = doc.caseScope === 'BANKRUPTCY' ? '2026하단 50284호' : '2026개회 50284호';
  const caseNumber = courtCase?.caseNumber || defaultCaseNo;
  const debtorRrn = (profile as any)?.rrn || '';
  const debtorPhone = client.phone || profile?.phone || '';
  const debtorAddress = profile?.address || '';
  const office = getOfficeProfile(lawyerName);

  // 1. 기본 신청취지
  let purpose = doc.defaultPurpose || '';
  if (!purpose) {
    if (doc.category === 'CORRECTION') {
      purpose = `귀원의 보정명령에 대하여 신청인은 별지와 같이 성실하게 보정하여 제출합니다.`;
    } else if (doc.category === 'RELEASE') {
      purpose = `위 당사자 사이의 강제집행 사건에 관하여 개인회생인가결정(또는 면책결정)이 확정되었으므로, 그 집행의 해제를 신청합니다.`;
    } else if (doc.caseScope === 'BANKRUPTCY') {
      purpose = `신청인에 대한 귀원 파산사건에 관하여 파산선고가 있을 때까지 채권자들의 강제집행·가압류 또는 가처분을 금지한다. 라는 결정을 구합니다.`;
    } else {
      purpose = `별지 기재와 같은 결정을 구합니다.`;
    }
  }

  // 2. 기본 신청이유 / 소명내용
  let reason = doc.defaultReasonTemplate || '';
  if (!reason) {
    if (doc.category === 'STAY_INJUNCT') {
      if (doc.caseScope === 'BANKRUPTCY') {
        reason = `1. 신청인은 귀원에 파산 및 면책 동시신청을 접수하여 심리가 진행 중입니다.\n2. 파산선고 전 채권자들의 무차별적인 강제집행 및 채권추심으로 인하여 신청인의 기본 생계가 위협받고 파산재단의 공평한 배당 형평성이 심각하게 침해될 우려가 있습니다.\n3. 이에 채무자 회생 및 파산에 관한 법률 제348조 등에 기하여 금지(중지)명령을 구하오니 혜량하여 주시기 바랍니다.`;
      } else {
        reason = `1. 신청인은 귀원에 개인회생 절차 개시신청을 접수하고 성실하게 절차를 진행 중입니다.\n2. 그러나 최근 채권자들의 강제집행 및 채권추심으로 인하여 기본 생계가 위협받고 원활한 변제계획 수행이 불가능한 상태입니다.\n3. 이에 채무자 회생 및 파산에 관한 법률 제593조에 기하여 긴급히 중지(금지)명령을 구하오니 혜량하여 주시기 바랍니다.`;
      }
    } else if (doc.category === 'CORRECTION') {
      reason = `1. 귀원의 보정명령 지적사항에 대하여 깊이 성찰하며 아래와 같이 상세히 소명합니다.\n2. 신청인은 고의적인 재산 은닉이나 편파변제 의도가 전혀 없었으며, 당시 불가피했던 생계비 지출 및 채무 상환 내역을 증빙자료와 함께 명백히 밝힙니다.`;
    } else if (doc.category === 'RELEASE') {
      reason = `1. 신청인은 귀원 위 사건에 관하여 변제계획인가결정(또는 면책결정)을 수령하였고 본 결정은 확정되었습니다.\n2. 채무자 회생 및 파산에 관한 법률 제615조 제3항에 따라 중지되었던 강제집행(가압류, 압류 및 추심명령)은 그 효력을 잃었으므로 해제하여 주시기 바랍니다.`;
    } else if (doc.category === 'EVIDENCE') {
      reason = `위 본인은 상기 기재 사실관계가 추호의 거짓도 없음을 확인하며, 만일 허위 진술이나 은닉 재산이 발견될 경우 어떠한 법적 불이익도 감수할 것을 서약합니다.`;
    } else {
      reason = `신청인은 채무자회생법이 정하는 요건을 충족하여 본 신청에 이른 것이므로 인용하여 주시기 바랍니다.`;
    }
  }

  // 3. 증빙 목록 생성 (사건 성격별 정확한 기본 목록)
  let evidenceList: string[] = doc.defaultEvidenceList || [];
  if (evidenceList.length === 0) {
    if (doc.caseScope === 'BANKRUPTCY') {
      evidenceList = [
        '1. 파산 및 면책 신청서 접수증명원 1통',
        '2. 채권자목록 사본 1통',
        '3. 신청인 주민등록초본 1통',
        '4. 소송위임장 1통'
      ];
    } else if (doc.category === 'RELEASE') {
      evidenceList = [
        '1. 변제계획인가결정문 정본(또는 확정증명원) 1통',
        '2. 채권압류 및 추심명령 결정문 사본 1통',
        '3. 채권자목록등본 1통',
        '4. 소송위임장 1통'
      ];
    } else {
      evidenceList = [
        '1. 개인회생절차 개시신청 접수증명원 1통',
        '2. 채권자목록 사본 1통',
        '3. 신청인 주민등록초본 1통',
        '4. 소송위임장 1통'
      ];
    }
  }

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
    agentLawfirm: office.firmName ? `${office.firmName} (담당변호사: ${lawyerName})` : `담당변호사: ${lawyerName}`,
    purpose,
    reason,
    evidenceList,
    submissionDate,
    customFields: {
      monthlyIncome: profile?.income || 0,
      totalDebt: profile?.debtTotal || 0,
      jobType: profile?.jobType || profile?.employmentType || '',
      companyName: profile?.companyName || '',
      creditorCount: profile?.creditorCount || 0
    }
  };
}

/**
 * HWPX 파싱 원본 HTML에 CRM 사건/당사자 데이터 및 편집된 취지·이유를 실시간 바인딩
 */
export function bindHwpxTemplateHtml(
  rawHtml: string,
  data: BoundDocumentData,
  docItem: LegalDocItem,
  purposeInput?: string,
  reasonInput?: string
): string {
  if (!rawHtml) return '';
  let html = rawHtml;

  const isBankruptcy = docItem.caseScope === 'BANKRUPTCY' || docItem.title.includes('파산') || docItem.docCode?.startsWith('13');
  const caseNoDisplay = data.caseNumber || (isBankruptcy ? '2026하단 50284호' : '2026개회 50284호');
  const activePurpose = purposeInput || data.purpose;
  const activeReason = reasonInput || data.reason;

  // 1. 문서 대제목 교체 / 보정 (파산 문서의 경우 명확히 파산 표기)
  if (isBankruptcy) {
    html = html.replace(
      /<h2([^>]*)>([\s\S]*?)<\/h2>/i,
      (match, attrs, titleText) => {
        let cleanTitle = titleText.replace(/\s+/g, ' ').trim();
        if (!cleanTitle.includes('파산')) {
          cleanTitle = cleanTitle ? `${cleanTitle} (파산)` : docItem.title;
        }
        return `<h2${attrs}>${cleanTitle}</h2>`;
      }
    );
  }

  // 2. 사건번호 치환 (사건 20 개회 개인회생 등)
  const caseNoPattern = /<p[^>]*>\s*사\s*건[\s\S]*?(?:개회|하단|타경|개인회생|파산)[\s\S]*?<\/p>/i;
  if (caseNoPattern.test(html)) {
    html = html.replace(
      caseNoPattern,
      `<div class="mb-3 text-[15px] font-serif"><strong>사&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;건</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="font-bold underline decoration-slate-400 font-mono text-slate-900">${caseNoDisplay}</span></div>`
    );
  } else {
    html = html.replace(
      /(?:사\s*건)\s*(?:20\s*(?:개회|하단|타경)[^<]*)?/gi,
      `<span class="font-bold text-slate-900 font-mono">사&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;건&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${caseNoDisplay}</span>`
    );
  }

  // 3. 당사자(채무자/신청인/대리인) 표시 치환
  const partyBlockHtml = `
<div class="my-4 p-4 bg-slate-50/90 rounded-xl border border-slate-300 text-[14px] leading-relaxed font-serif text-slate-900">
  <div class="flex mb-1.5">
    <span class="w-24 font-bold text-slate-800">신&nbsp;&nbsp;청&nbsp;&nbsp;인</span>
    <div class="flex-1">
      <strong class="text-base text-slate-950 font-bold">${data.debtorName}</strong>
      ${data.debtorRrn ? `<span class="ml-2 font-mono text-slate-600">(${data.debtorRrn})</span>` : ''}
      ${data.debtorAddress ? `<div class="text-[13px] text-slate-700 mt-0.5">주소: ${data.debtorAddress}</div>` : ''}
      ${data.debtorPhone ? `<div class="text-[13px] text-slate-600 mt-0.5 font-mono">연락처: ${data.debtorPhone}</div>` : ''}
    </div>
  </div>
  <div class="flex pt-1.5 border-t border-slate-200">
    <span class="w-24 font-bold text-slate-800">대&nbsp;&nbsp;리&nbsp;&nbsp;인</span>
    <div class="flex-1">
      <strong class="text-slate-950">${data.agentLawfirm}</strong>
      <span class="ml-2 text-slate-600 text-[13px]">(담당변호사: ${data.agentLawyerName})</span>
    </div>
  </div>
</div>`;

  const debtorPattern = /<p[^>]*>[\s\S]*?\(채\s*무\s*자\)[\s\S]*?주\s*소:[\s\S]*?<\/p>/i;
  const debtorPatternAlt = /채\s*권\s*자\s*○○○[\s\S]*?채무자\s*겸\s*소유자\s*◇◇◇/i;
  if (debtorPattern.test(html)) {
    html = html.replace(debtorPattern, partyBlockHtml);
  } else if (debtorPatternAlt.test(html)) {
    html = html.replace(debtorPatternAlt, partyBlockHtml);
  } else {
    html = html.replace(/\(채\s*무\s*자\)\s*주\s*소:/g, partyBlockHtml);
  }

  // 4. 신청취지 및 신청이유 섹션 실시간 치환
  // 4-1. 신청취지 영역 매칭
  const purposeSectionPattern = /(<p[^>]*>\s*신\s*청\s*취\s*지\s*<\/p>)([\s\S]*?)(?=(?:<p[^>]*>\s*(?:신\s*청\s*원\s*인|신\s*청\s*이\s*유)\s*<\/p>|<div[^>]*>\s*(?:신\s*청\s*원\s*인|신\s*청\s*이\s*유)\s*<\/div>))/i;
  if (purposeSectionPattern.test(html)) {
    html = html.replace(purposeSectionPattern, (match, header) => {
      return `${header}
<div class="my-3 p-4 bg-blue-50/40 rounded-xl border-l-4 border-blue-600 text-[14.5px] leading-relaxed whitespace-pre-wrap font-serif text-slate-900 shadow-2xs">
${activePurpose}
</div>
<p class="text-right text-xs text-slate-600 mb-4 font-serif">라는 결정을 구합니다.</p>`;
    });
  }

  // 4-2. 신청원인 / 신청이유 영역 매칭
  const reasonSectionPattern = /(<p[^>]*>\s*(?:신\s*청\s*원\s*인|신\s*청\s*이\s*유)\s*<\/p>|<div[^>]*>\s*(?:신\s*청\s*원\s*인|신\s*청\s*이\s*유)\s*<\/div>)([\s\S]*?)(?=(?:<p[^>]*>\s*20\s*\.|\s*<div[^>]*>\s*20\s*\.|$))/i;
  if (reasonSectionPattern.test(html)) {
    const evidenceListHtml = data.evidenceList && data.evidenceList.length > 0 ? `
<div class="my-4 pt-3 border-t border-slate-200">
  <p class="font-bold text-sm mb-2 text-slate-900">[ 첨 부 서 류 ]</p>
  <div class="space-y-1 text-[13px] text-slate-700 pl-2">
    ${data.evidenceList.map((item, idx) => `<div>${item}</div>`).join('')}
  </div>
</div>` : '';

    html = html.replace(reasonSectionPattern, (match, header) => {
      return `${header}
<div class="my-3 p-4 bg-blue-50/40 rounded-xl border-l-4 border-blue-600 text-[14.5px] leading-relaxed whitespace-pre-wrap font-serif text-slate-900 shadow-2xs">
${activeReason}
</div>
${evidenceListHtml}`;
    });
  }

  // 5. 날짜, 서명란, 법원 관할 치환
  // 5-1. 날짜
  html = html.replace(
    /<p[^>]*>\s*20\s*\.\s*\.\s*\.\s*<\/p>/i,
    `<div class="my-6 text-center font-mono font-bold text-[15px] tracking-widest text-slate-900">${data.submissionDate}</div>`
  );
  html = html.replace(/20\s*\.\s*\.\s*\./g, `<span class="font-mono font-bold">${data.submissionDate}</span>`);

  // 5-2. 서명 및 날인
  const signBlockHtml = `
<div class="my-6 flex flex-col items-end pr-4 text-[14px] text-slate-900 space-y-2">
  <div>
    신청인(채무자)&nbsp;&nbsp;<strong class="text-base text-slate-950">${data.debtorName}</strong>&nbsp;&nbsp;(인)
  </div>
  <div class="flex items-center gap-2">
    신청인의 대리인&nbsp;&nbsp;<strong>${data.agentLawfirm}</strong>
    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-rose-500 text-rose-600 text-xs font-bold bg-rose-50/50">
      (인)
    </span>
  </div>
  ${data.debtorPhone ? `<div class="text-xs text-slate-500 font-mono">연락처: ${data.debtorPhone}</div>` : ''}
</div>`;

  const signPattern = /<p[^>]*>\s*신청인\(채무자\)[\s\S]*?(?:서명\s*또는\s*날인\)|\(인\))[\s\S]*?<\/p>/i;
  if (signPattern.test(html)) {
    html = html.replace(signPattern, signBlockHtml);
    html = html.replace(/<p[^>]*>\s*연락\s*가능한\s*전화번호:[\s\S]*?<\/p>/i, '');
  } else {
    html = html.replace(
      /신청인\(채무자\)\s*\(서명 또는 날인\)/g,
      `<span>신청인(채무자) <strong class="text-slate-900">${data.debtorName}</strong> (인) / 대리인 ${data.agentLawfirm} (인)</span>`
    );
    html = html.replace(/신\s*청\s*인\s*\(인\)/g, `<span>신청인 <strong class="text-slate-900">${data.debtorName}</strong> (인) / 대리인 ${data.agentLawyerName} (인)</span>`);
  }

  // 5-3. 관할법원
  const courtTarget = `${data.courtName || '서울회생법원'} 귀중`;
  const courtPattern = /<p[^>]*>(?:[가-힣\s]*지방법원|법원)\s*귀중\s*<\/p>/i;
  if (courtPattern.test(html)) {
    html = html.replace(courtPattern, `<div class="my-6 text-center font-bold text-xl tracking-widest text-slate-950">${courtTarget}</div>`);
  } else {
    html = html.replace(/(?:[가-힣\s]*지방법원|법원)\s*귀중/g, `<strong class="text-slate-950 text-[18px] tracking-wider">${courtTarget}</strong>`);
  }

  // 6. 파산 사건인 경우 개인회생 잔여 용어 ➔ 개인파산 용어로 지능적 변환
  if (isBankruptcy) {
    html = html.replace(/개인회생사건/g, '파산사건');
    html = html.replace(/개인회생절차의 개시신청/g, '파산선고의 신청');
    html = html.replace(/개인회생절차/g, '파산절차');
    html = html.replace(/개인회생채권/g, '파산채권');
    html = html.replace(/개인회생 사건/g, '파산 사건');
    html = html.replace(/20\s+개회/g, '2026 하단');
    html = html.replace(/개회/g, '하단');
    html = html.replace(/개인회생/g, '개인파산');
    html = html.replace(/변제계획의\s*수행에\s*큰\s*어려움/g, '파산재단의 공평한 배당에 중대한 침해');
    html = html.replace(/제593조제1항/g, '제348조, 제349조');
    html = html.replace(/제593조/g, '제348조');
  }

  return html;
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
