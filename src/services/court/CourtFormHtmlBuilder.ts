/**
 * 대한민국 법원(서울회생법원 등) 정식 개인회생 전산양식 HTML 빌더
 * 실제 법원 접수 사건(4종 500페이지 전수분석) 규격 100% 반영
 * - 표지 (Cover) + 인지/송달료 자동산출식
 * - 개시신청서 본문 (D5101 2쪽) + 정보수신신청서
 * - 개인회생채권자목록 (총괄표 및 채권자 상세표)
 * - 재산목록 (D5102)
 * - 수입 및 지출에 관한 목록 (D5103)
 * - 진술서 (학력/경력 및 채무증대경위서)
 * - 변제계획안 (D5110 변제계획안 및 변제예정액표)
 * - 금지명령 신청서
 * - 소송위임장 및 경유확인서
 * - 서울회생법원 필수자료제출목록
 */

import { DELIVERY_UNIT_FEE_KRW, calcCourtFees } from './courtFees';
import { getLivingExpense, DEPOSIT_EXEMPTION_KRW, EXEMPT_INSURANCE_REFUND_LIMIT } from '../repayment/repaymentConstants2026';
import type { ConsultRequest, CrmClientExtension } from '../../types';
import type { RepaymentCreditor } from '../repayment/repaymentTypes';

export interface CourtFormDataContext {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  creditors: RepaymentCreditor[];
  lawyerName?: string;
  firmName?: string;
  courtName?: string;
}

/** 공통 A4 컨테이너 스타일 */
const A4_PAGE_STYLE = `
  width: 794px;
  min-height: 1123px;
  height: 1123px;
  padding: 170px 76px 113px 76px;
  background: #ffffff;
  color: #000000;
  font-family: 'Batang', 'BatangChe', '바탕', 'Gungsuh', serif;
  font-size: 16px;
  line-height: 2.0;
  box-sizing: border-box;
  position: relative;
  page-break-after: always;
  overflow: hidden;
`;

const TABLE_BORDER_STYLE = `
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000000;
  font-size: 14px;
`;

// ── HTML 이스케이프 ──
// 이전: 이름·주소·채권자명·진술서 본문 등 사용자 입력을 그대로 HTML에 넣어
//       dangerouslySetInnerHTML / document.write로 출력 → 의뢰인 입력으로 변호사 화면에서 스크립트 실행 가능(저장형 XSS)
export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 대용량 바이너리(data URL 등)는 서식에 쓰이지 않으므로 복사하지 않음
const SKIP_ESCAPE_KEYS = new Set(['dataUrl', 'fileData', 'base64', 'thumbnail', 'uploadedFiles', 'documents', 'recordings', 'communicationLogs']);
function escapeDeep(v: any, depth = 0): any {
  if (typeof v === 'string') return escapeHtml(v);
  if (!v || typeof v !== 'object' || depth > 8) return v;
  if (Array.isArray(v)) return v.map(x => escapeDeep(x, depth + 1));
  const out: any = {};
  for (const k of Object.keys(v)) out[k] = SKIP_ESCAPE_KEYS.has(k) ? v[k] : escapeDeep(v[k], depth + 1);
  return out;
}
const SAFE_MARK = '__courtFormSafe';
/** 모든 문자열 값을 이스케이프한 컨텍스트 (각 빌더 첫 줄에서 호출, 중복 적용 방지) */
function safeCtx(ctx: CourtFormDataContext): CourtFormDataContext {
  if ((ctx as any)[SAFE_MARK]) return ctx;
  const safe = escapeDeep(ctx) as CourtFormDataContext;
  Object.defineProperty(safe, SAFE_MARK, { value: true, enumerable: false });
  return safe;
}

/** 1. 개시신청서 표지 (Cover) */
export function buildCourtCoverHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const p = ctx.crmExt.petitionInfo;
  const clientName = p?.clientName || ctx.clientRequest.clientName || '신청인';
  const lawyerName = p?.lawyerName || ctx.lawyerName || '';
  const firmName = p?.firmName || ctx.firmName || '';
  const courtName = p?.courtName || ctx.courtName || ctx.crmExt.courtCase?.courtName || '';
  const creditorCount = Math.max(1, ctx.creditors.length);

  // 인지대·송달료: 공통 산식 (전자소송, 금지명령 동시신청 기준) — 이전: 32,000원 고정 + 표기 단가 5,500원
  const fee = calcCourtFees({ caseType: 'rehab', creditorCount, withProhibition: true, electronic: true });
  const stampFee = fee.stampFee;
  const serviceFee = fee.deliveryFee;

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="text-align: center; margin-top: 50px; margin-bottom: 50px;">
      <h1 style="font-size: 32px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #0f172a;">
        개인회생절차 개시신청서
      </h1>
    </div>

    <div style="margin-left: 280px; margin-bottom: 50px; font-size: 14px; line-height: 2.2;">
      <div style="display: flex;">
        <span style="width: 80px; font-weight: bold; letter-spacing: 2px;">신 청 인</span>
        <span style="font-weight: bold; font-size: 15px;">${clientName}</span>
      </div>
      <div style="display: flex; margin-top: 8px;">
        <span style="width: 80px; font-weight: bold; letter-spacing: 2px;">대 리 인</span>
        <div>
          <div style="font-weight: bold;">${firmName}</div>
          <div style="font-weight: bold;">변호사 ${lawyerName}</div>
        </div>
      </div>
    </div>

    <div style="margin-left: 20px; margin-bottom: 60px; font-size: 14px; line-height: 2.2;">
      <div style="display: flex;">
        <span style="width: 90px; font-weight: bold; letter-spacing: 8px;">인 지</span>
        <span>${stampFee.toLocaleString()}원 (개시신청 + 금지명령, 전자소송 10% 감액)</span>
      </div>
      <div style="display: flex; margin-top: 6px;">
        <span style="width: 90px; font-weight: bold; letter-spacing: 4px;">송 달 료</span>
        <span style="font-weight: bold;">
          ${serviceFee.toLocaleString()}원 {${fee.deliveryRounds}회 × ${DELIVERY_UNIT_FEE_KRW.toLocaleString()}원 (기본 10회 + 채권자 ${creditorCount}명 × 10회)}
        </span>
      </div>
    </div>

    <div style="margin-left: 360px; margin-bottom: 70px;">
      <table style="width: 320px; border-collapse: collapse; border: 1px solid #000000; font-size: 11px; text-align: center;">
        <tbody>
          <tr style="height: 28px; border-bottom: 1px solid #000000;">
            <td style="width: 100px; background: transparent; font-weight: bold; border-right: 1px solid #000000; letter-spacing: 2px;">사 건 번 호</td>
            <td></td>
          </tr>
          <tr style="height: 28px; border-bottom: 1px solid #000000;">
            <td style="background: transparent; font-weight: bold; border-right: 1px solid #000000; letter-spacing: 1px;">해당순위번호</td>
            <td></td>
          </tr>
          <tr style="height: 28px; border-bottom: 1px solid #000000;">
            <td style="background: transparent; font-weight: bold; border-right: 1px solid #000000; letter-spacing: 4px;">재 판 부</td>
            <td></td>
          </tr>
          <tr style="height: 28px;">
            <td style="background: transparent; font-weight: bold; border-right: 1px solid #000000; letter-spacing: 8px;">주 심</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <table style="width: 320px; border-collapse: collapse; border: 1px solid #000000; font-size: 11px; margin-top: 10px;">
        <tbody>
          <tr style="height: 24px; border-bottom: 1px solid #000000; text-align: center; background: transparent;">
            <td style="width: 200px; font-weight: bold; border-right: 1px solid #000000;">최초면담기일통지</td>
            <td style="font-weight: bold;">영 수 인</td>
          </tr>
          <tr style="height: 55px;">
            <td style="border-right: 1px solid #000000; padding-left: 12px; font-size: 12px; color: #333333;">
              20 &nbsp; &nbsp; . &nbsp; &nbsp; . &nbsp; &nbsp; . &nbsp; &nbsp; &nbsp; &nbsp; :
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <table style="width: 120px; border-collapse: collapse; border: 1px solid #000000; font-size: 11px; margin-top: 10px; text-align: center;">
        <tbody>
          <tr style="height: 35px; background: transparent; border-bottom: 1px solid #000000;">
            <td style="font-weight: bold; line-height: 1.3;">당일면담<br>희망여부</td>
          </tr>
          <tr style="height: 35px;">
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <h2 style="font-size: 24px; font-weight: 900; letter-spacing: 6px; margin: 0; color: #0f172a;">
        ${courtName} 귀중
      </h2>
    </div>
  </div>
  `;
}

/** 2. 개시신청서 본문 1쪽 (D5101 1/2) */
export function buildCourtApplicationBody1Html(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const p = ctx.crmExt.petitionInfo;
  const clientName = p?.clientName || ctx.clientRequest.clientName || '신청인';
  const lawyerName = p?.lawyerName || ctx.lawyerName || '';
  const firmName = p?.firmName || ctx.firmName || '';
  const clientRrn = p?.rrnFront 
    ? `${p.rrnFront}-${p.rrnBack || '*******'}`
    : ((ctx.clientRequest as any).rrnFront 
      ? `${(ctx.clientRequest as any).rrnFront}-*******` 
      : '');
  const residentAddress = p?.residentAddress || (ctx.clientRequest as any).address || '';
  const residentPostcode = p?.residentPostcode || '';
  const currentAddress = p?.currentAddress || residentAddress;
  const currentPostcode = p?.currentPostcode || residentPostcode;
  const companyAddress = p?.companyAddress || '';
  const companyPostcode = p?.companyPostcode || '';
  const firmAddress = p?.firmAddress || '';
  const firmPostcode = p?.servicePlacePostcode || '';
  const firmPhone = p?.firmPhone || '';
  const firmFax = p?.firmFax || '';
  const firmEmail = p?.firmEmail || '';

  const serviceAddress = p?.servicePlaceType === 'client' ? currentAddress : (p?.servicePlaceAddress || firmAddress);
  const servicePostcode = p?.servicePlaceType === 'client' ? currentPostcode : firmPostcode;
  const serviceRecipient = p?.serviceRecipient || `변호사 ${lawyerName}`;
  const clientPhone = p?.phone || ctx.clientRequest.phone || '';
  const clientTel = p?.tel || '-';
  const incomeType = p?.incomeType || 'salary';
  const petitionReason = p?.petitionReasonDetail || '1. 신청인은, 첨부한 개인회생채권자목록 기재와 같은 채무를 부담하고 있으나, 수입 및 재산이 별지 수입 및 지출에 관한 목록과 재산목록에 기재된 바와 같으므로, 파산의 원인사실이 발생하였습니다(파산의 원인사실이 생길 염려가 있습니다).';

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="text-align: center; margin-bottom: 25px;">
      <h1 style="font-size: 26px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #0f172a;">
        개인회생절차 개시신청서
      </h1>
    </div>

    <table style="${TABLE_BORDER_STYLE} margin-bottom: 12px;">
      <tbody>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td rowspan="5" style="width: 55px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">신청인</td>
          <td style="width: 110px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">성 &nbsp; &nbsp; 명</td>
          <td style="width: 240px; padding: 5px 12px; font-weight: bold; border-right: 1px solid #000000;">${clientName}</td>
          <td style="width: 100px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">주민등록번호</td>
          <td style="padding: 5px 12px; font-family: monospace;">${clientRrn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">주민등록상주소</td>
          <td colspan="2" style="padding: 5px 12px; border-right: 1px solid #000000;">${residentAddress}</td>
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">우편번호</td>
          <td style="padding: 5px 12px; font-family: monospace;">${residentPostcode}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">현 &nbsp; 주 &nbsp; 소</td>
          <td colspan="2" style="padding: 5px 12px; border-right: 1px solid #000000;">${currentAddress}</td>
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">우편번호</td>
          <td style="padding: 5px 12px; font-family: monospace;">${currentPostcode}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">직 장 &nbsp;주 소</td>
          <td colspan="2" style="padding: 5px 12px; border-right: 1px solid #000000;">${companyAddress}</td>
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">우편번호</td>
          <td style="padding: 5px 12px; font-family: monospace;">${companyPostcode}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 36px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">송 달 &nbsp;장 소</td>
          <td colspan="2" style="padding: 5px 12px; border-right: 1px solid #000000;">
            ${serviceAddress}<br>
            <span style="font-size: 11px; color: #333333;">송달영수인: &nbsp;${serviceRecipient}</span>
          </td>
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">우편번호</td>
          <td style="padding: 5px 12px; font-family: monospace;">${servicePostcode}</td>
        </tr>
        <tr style="height: 32px;">
          <td colspan="2" style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">전화번호(집·직장)</td>
          <td style="padding: 5px 12px; border-right: 1px solid #000000;">${clientTel}</td>
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">휴대전화</td>
          <td style="padding: 5px 12px; font-family: monospace; font-weight: bold;">${clientPhone}</td>
        </tr>
      </tbody>
    </table>

    <table style="${TABLE_BORDER_STYLE} margin-bottom: 16px;">
      <tbody>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td rowspan="3" style="width: 55px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">대리인</td>
          <td style="width: 110px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">성 &nbsp; &nbsp; 명</td>
          <td colspan="3" style="padding: 5px 12px; font-weight: bold;">
            ${firmName} &nbsp; 변호사 ${lawyerName}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">사무실 주소</td>
          <td style="width: 320px; padding: 5px 12px; border-right: 1px solid #000000;">${firmAddress}</td>
          <td style="width: 80px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">우편번호</td>
          <td style="padding: 5px 12px; font-family: monospace;">${firmPostcode}</td>
        </tr>
        <tr style="height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">전화 / 팩스</td>
          <td style="padding: 5px 12px; border-right: 1px solid #000000;">${firmPhone} &nbsp;/&nbsp; ${firmFax}</td>
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">전자우편</td>
          <td style="padding: 5px 12px; font-size: 11px;">${firmEmail}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 24px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 900; text-align: center; margin-bottom: 12px; letter-spacing: 4px;">
        신 &nbsp;청 &nbsp;취 &nbsp;지
      </h3>
      <p style="font-size: 13px; text-align: center; margin: 0; line-height: 1.8; font-weight: bold;">
        「신청인에 대하여 개인회생절차를 개시한다.」 라는 결정을 구합니다.
      </p>
    </div>

    <div style="margin-top: 24px;">
      <h3 style="font-size: 16px; font-weight: 900; text-align: center; margin-bottom: 14px; letter-spacing: 4px;">
        신 &nbsp;청 &nbsp;이 &nbsp;유
      </h3>
      <p style="font-size: 12px; line-height: 1.9; margin: 0 0 12px 0; text-align: justify;">
        ${petitionReason}
      </p>
      <div style="font-size: 12px; line-height: 1.8; padding: 10px 14px; background: transparent; border: 1px solid #e2e8f0; border-radius: 0;">
        <div style="font-weight: ${incomeType === 'salary' ? 'bold' : 'normal'}; color: ${incomeType === 'salary' ? '#0f172a' : '#64748b'};">
          ${incomeType === 'salary' ? '■' : '□'} 신청인은 정기적이고 확실한 수입을 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에 관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(급여소득자).
        </div>
        <div style="font-weight: ${incomeType === 'business' ? 'bold' : 'normal'}; color: ${incomeType === 'business' ? '#0f172a' : '#64748b'}; margin-top: 4px;">
          ${incomeType === 'business' ? '■' : '□'} 신청인은 부동산임대소득, 사업소득, 농업소득, 임업소득 그 밖에 이와 유사한 수입을 장래에 계속적으로 또는 반복하여 얻을 것으로 예상되고, 또한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(영업소득자).
        </div>
      </div>
    </div>
  </div>
  `;
}

/** 3. 개시신청서 본문 2쪽 (D5101 2/2) */
export function buildCourtApplicationBody2Html(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const p = ctx.crmExt.petitionInfo;
  const clientName = p?.clientName || ctx.clientRequest.clientName || '신청인';
  const lawyerName = p?.lawyerName || ctx.lawyerName || '';
  const firmName = p?.firmName || ctx.firmName || '';
  const courtName = p?.courtName || ctx.courtName || ctx.crmExt.courtCase?.courtName || '';
  const clientPhone = p?.phone || ctx.clientRequest.phone || '';
  const smsPhone = p?.smsNotificationPhone || clientPhone;

  const monthlyRepayment = (ctx.crmExt.repaymentPlan as any)?.monthlyRepaymentTotal || (ctx.crmExt.repaymentPlan as any)?.monthlyRepayment || 0;
  const body2Months = Number((ctx.crmExt.repaymentPlan as any)?.months) || 36;
  const totalRepayment = (ctx.crmExt.repaymentPlan as any)?.totalRepaymentAmount || monthlyRepayment * body2Months;
  const refundBank = p?.refundBank || (ctx.crmExt.repaymentPlan as any)?.bankName || '';
  const refundAccount = p?.refundAccount || (ctx.crmExt.repaymentPlan as any)?.accountNumber || '';
  const refundHolder = p?.refundAccountHolder || clientName;

  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="font-size: 12px; line-height: 1.9; text-align: justify; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0;">
        2. 신청인은, 각 회생채권자에 대한 채무 전액의 변제가 곤란하므로, 그 일부를 분할하여 지급할 계획입니다.<br>
        즉 현시점에서 계획하고 있는 총 변제예정액은 <strong>[ ${Math.round(totalRepayment).toLocaleString()} ]원</strong>이고, 제1회부터 제${body2Months}회까지 월 <strong>[ ${Math.round(monthlyRepayment).toLocaleString()} ]원</strong>으로 예정하고 있으며, 이 변제의 준비 및 절차비용지급의 준비를 위하여, 개시결정이 내려지는 경우 익월 10일을 제1회로 하여, 이후 매월 10일에 개시결정시 통지되는 개인회생위원의 은행계좌에 동액의 금전을 입금하겠습니다.
      </p>
      <p style="margin: 0 0 10px 0;">
        3. 이 사건 개인회생절차에서 적립금을 반환받을 신청인의 예금계좌는 <strong>${refundBank} ${refundAccount} (예금주: ${refundHolder})</strong>이며, 신청인의 계좌가 변경되거나 어떤 사유로든 사용할 수 없게 된 경우에는 신청인은 사건담당 회생위원에게 즉시 변경된 예금계좌를 신청인의 통장사본을 첨부하여 신고하겠습니다.
      </p>
      <p style="margin: 0;">
        4. 개인회생채권자목록 부본(개인회생채권자목록상의 채권자수 + 2통)은 개시결정 전 회생위원의 지시에 따라 지정하는 일자까지 반드시 제출하겠습니다.
      </p>
    </div>

    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 14px; font-weight: 900; text-align: center; margin: 0 0 10px 0; letter-spacing: 4px;">
        첨 &nbsp;부 &nbsp;서 &nbsp;류
      </h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 11px; padding: 10px 14px; background: transparent; border: 1px solid #cbd5e1; border-radius: 0;">
        <div>1. 개인회생채권자목록 1통</div>
        <div>2. 재산목록 1통</div>
        <div>3. 수입 및 지출에 관한 목록 1통</div>
        <div>4. 진술서 1통</div>
        <div>5. 신청서 부본 1통 (첨부서류 일체)</div>
        <div>6. 수입인지 1통</div>
        <div>7. 송달료납부서 1통</div>
        <div>8. 본인 예금계좌 사본 1통</div>
        <div>9. 위임장 1통 (대리 신청의 경우)</div>
      </div>
    </div>

    <div style="border: 1px solid #000000; padding: 14px 18px; margin-bottom: 28px; border-radius: 0;">
      <h4 style="font-size: 14px; font-weight: 900; text-align: center; margin: 0 0 10px 0; letter-spacing: 2px;">
        휴대전화를 통한 정보수신 신청서
      </h4>
      <p style="font-size: 11px; line-height: 1.6; margin: 0 0 12px 0; text-align: justify; color: #000000;">
        위 사건에 관한 개인회생절차 개시결정, 폐지결정, 면책결정, 월 변제액 3개월분 연체의 정보를 예납의무자가 납부한 송달료 잔액 범위 내에서 휴대전화를 통하여 알려주실 것을 신청합니다.
      </p>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 12px;">
        <div><strong>▣ 휴대전화 번호:</strong> &nbsp; <span style="font-family: monospace; font-size: 13px;">${smsPhone}</span></div>
        <div>신청인 채무자 &nbsp; <strong>${clientName}</strong> &nbsp; (날인 또는 서명)</div>
      </div>
      <div style="font-size: 10px; color: #000000; line-height: 1.5; border-top: 1px dashed #000000; padding-top: 8px;">
        ※ 개인회생절차 개시결정, 폐지결정, 면책결정이 있거나, 변제계획 인가결정 후 월 변제액 3개월분 이상 연체시 위 휴대전화로 문자메시지가 발송됩니다.<br>
        ※ 문자메시지 서비스 이용금액은 메시지 1건당 17원씩 납부된 송달료에서 지급됩니다.
      </div>
    </div>

    <div style="text-align: center; margin-top: 20px; margin-bottom: 20px;">
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 25px; letter-spacing: 2px;">
        ${dateStr}
      </div>
      <div style="display: inline-block; text-align: left; font-size: 13px; line-height: 2;">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 280px;">
          <span>신 &nbsp;청 &nbsp;인</span>
          <span style="font-weight: bold; font-size: 14px;">${clientName}</span>
          <span style="display: inline-block; width: 34px; height: 34px; border: 1.5px solid #dc2626; border-radius: 50%; color: #dc2626; font-size: 11px; text-align: center; line-height: 32px; font-weight: bold;">(인)</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; width: 280px; margin-top: 6px;">
          <span>위 대리인</span>
          <span style="font-weight: bold;">${firmName}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; width: 280px;">
          <span></span>
          <span style="font-weight: bold;">변호사 ${lawyerName}</span>
          <span style="display: inline-block; width: 34px; height: 34px; border: 1.5px solid #dc2626; border-radius: 50%; color: #dc2626; font-size: 11px; text-align: center; line-height: 32px; font-weight: bold;">(인)</span>
        </div>
      </div>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <h2 style="font-size: 22px; font-weight: 900; letter-spacing: 6px; margin: 0; color: #0f172a;">
        ${courtName} 귀중
      </h2>
    </div>
  </div>
  `;
}

/** 4. 개인회생채권자목록 총괄표 및 채권자 상세표 */
export function buildCourtCreditorListHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';
  const creditors = ctx.creditors || [];

  const totalPrincipal = creditors.reduce((sum, c) => sum + (c.principal || 0), 0);
  const totalInterest = creditors.reduce((sum, c) => sum + (c.interest || 0), 0);
  const totalSum = totalPrincipal + totalInterest;

  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

  // 담보부 채권 합계 (이전: 항상 0원, 전체를 무담보로 표시)
  const securedSum = creditors.filter(c => (c as any).isSecured).reduce((s, c) => s + (c.principal || 0) + (c.interest || 0), 0);
  // 한 쪽에 15건까지 표시하고, 초과분은 누락 안내 (이전: 16번째 이후 채권자가 말없이 빠짐)
  const overflowCount = Math.max(0, creditors.length - 15);
  const rowsHtml = creditors.slice(0, 15).map((c, idx) => `
    <tr style="border-bottom: 1px solid #000000; font-size: 11px;">
      <td style="padding: 6px; text-align: center; font-weight: bold; border-right: 1px solid #000000;">${idx + 1}</td>
      <td style="padding: 6px 8px; font-weight: bold; border-right: 1px solid #000000;">
        ${c.name}<br>
        <span style="font-size: 10px; color: #000000; font-weight: normal;">${c.address || '(미입력)'}</span>
      </td>
      <td style="padding: 6px 8px; border-right: 1px solid #000000;">
        ${c.borrowedDate || '(미입력)'} ${c.debtCauseDetail ? '' : ''}<br>
        <span style="font-size: 10px; color: #333333;">${c.debtCauseDetail || ''}</span>
      </td>
      <td style="padding: 6px 8px; text-align: right; font-weight: bold; border-right: 1px solid #000000;">
        ${Math.round(c.principal || 0).toLocaleString()}원<br>
        <span style="font-size: 10px; color: #000000;">이자: ${Math.round(c.interest || 0).toLocaleString()}원</span>
      </td>
      <td style="padding: 6px 8px; text-align: center; font-size: 10px; color: #000000; border-right: 1px solid #000000;">
        부채증명서 참조<br>
        (${dateStr})
      </td>
      <td style="padding: 6px 8px; text-align: center; font-size: 10px;">
        ■ 부속서류<br>(1, 2, 3)
      </td>
    </tr>
  `).join('');

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333333; margin-bottom: 12px;">
      <span>${ctx.crmExt.courtCase?.caseNumber || '사건번호: (접수 후 기재)'}</span>
      <span>채무자 ${clientName}</span>
    </div>

    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #0f172a;">
        개인회생채권자목록
      </h1>
    </div>

    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
      <table style="width: 50%; border-collapse: collapse; border: 1px solid #000000; font-size: 11px;">
        <tbody>
          <tr style="border-bottom: 1px solid #000000; height: 26px;">
            <td rowspan="3" style="width: 90px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">채권현재액</td>
            <td style="width: 70px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">합 &nbsp; 계</td>
            <td style="padding: 4px 10px; text-align: right; font-weight: bold; color: #1e3a8a;">${Math.round(totalSum).toLocaleString()}원</td>
          </tr>
          <tr style="border-bottom: 1px solid #000000; height: 26px;">
            <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">원 &nbsp; 금</td>
            <td style="padding: 4px 10px; text-align: right; font-weight: bold;">${Math.round(totalPrincipal).toLocaleString()}원</td>
          </tr>
          <tr style="height: 26px;">
            <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">이 &nbsp; 자</td>
            <td style="padding: 4px 10px; text-align: right; color: #dc2626;">${Math.round(totalInterest).toLocaleString()}원</td>
          </tr>
        </tbody>
      </table>

      <table style="width: 50%; border-collapse: collapse; border: 1px solid #000000; font-size: 11px;">
        <tbody>
          <tr style="border-bottom: 1px solid #000000; height: 38px;">
            <td style="width: 120px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">담보부 회생채권 합계</td>
            <td style="padding: 4px 10px; text-align: right; font-weight: bold;">${Math.round(securedSum).toLocaleString()}원</td>
          </tr>
          <tr style="height: 38px;">
            <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">무담보 회생채권 합계</td>
            <td style="padding: 4px 10px; text-align: right; font-weight: bold; color: #1e3a8a;">${Math.round(totalSum - securedSum).toLocaleString()}원</td>
          </tr>
        </tbody>
      </table>
    </div>

    <table style="${TABLE_BORDER_STYLE}">
      <thead>
        <tr style="background: transparent; height: 30px; border-bottom: 1.5px solid #334155; text-align: center;">
          <th style="width: 40px; border-right: 1px solid #000000;">순번</th>
          <th style="width: 170px; border-right: 1px solid #000000;">채권자 / 주소</th>
          <th style="border-right: 1px solid #000000;">채권의 원인 및 내용</th>
          <th style="width: 130px; border-right: 1px solid #000000;">채권현재액(원금/이자)</th>
          <th style="width: 100px; border-right: 1px solid #000000;">산정근거</th>
          <th style="width: 70px;">부속서류</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        ${overflowCount > 0 ? `<tr><td colspan="6" style="padding: 8px; text-align: center; font-weight: bold; color: #b91c1c;">외 ${overflowCount}건 — 별지(채권자목록 CSV/상세표)에 계속 기재</td></tr>` : ''}
      </tbody>
    </table>
  </div>
  `;
}

/** 5. 금지명령 신청서 (Stay Order) */
export function buildCourtStayOrderHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';
  const lawyerName = ctx.lawyerName || '';
  const firmName = ctx.firmName || '';
  const courtName = ctx.courtName || ctx.crmExt.courtCase?.courtName || '';
  const clientRrn = (ctx.clientRequest as any).rrnFront 
    ? `${(ctx.clientRequest as any).rrnFront}-*******` 
    : (ctx.crmExt.petitionInfo?.rrnFront ? `${ctx.crmExt.petitionInfo.rrnFront}-*******` : '');
  const residentAddress = ctx.crmExt.petitionInfo?.residentAddress || (ctx.clientRequest.financialProfile as any)?.address || '';

  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="text-align: center; margin-top: 40px; margin-bottom: 35px;">
      <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 6px; margin: 0; color: #0f172a;">
        금 지 명 령 &nbsp;신 청 서
      </h1>
    </div>

    <div style="font-size: 13px; line-height: 2.2; margin-left: 20px; margin-bottom: 30px;">
      <div><strong>사 &nbsp; &nbsp; &nbsp; 건:</strong> &nbsp; ${ctx.crmExt.courtCase?.caseNumber || '(사건번호 미부여)'} 개인회생</div>
      <div><strong>신 &nbsp;청 &nbsp;인:</strong> &nbsp; <strong>${clientName}</strong> (${clientRrn})</div>
      <div style="padding-left: 72px; color: #000000;">주소: ${residentAddress}</div>
      <div><strong>대 &nbsp;리 &nbsp;인:</strong> &nbsp; ${firmName} &nbsp; 변호사 ${lawyerName}</div>
    </div>

    <div style="margin-bottom: 30px;">
      <h3 style="font-size: 15px; font-weight: 900; text-align: center; margin-bottom: 12px; letter-spacing: 4px;">
        신 &nbsp;청 &nbsp;취 &nbsp;지
      </h3>
      <div style="font-size: 12px; line-height: 2; padding: 16px 20px; background: transparent; border: 1.5px solid #cbd5e1; border-radius: 0; text-align: justify;">
        「개인회생절차의 개시신청에 대한 결정이 있을 때까지, 채무자 회생 및 파산에 관한 법률 제593조 제1항 각 호에 기하여, 개인회생채권에 기하여 신청인의 급여채권, 유체동산 및 일체의 재산에 대하여 행하는 강제집행·가압류 또는 가처분의 절차를 금지한다.」<br>
        라는 결정을 구합니다.
      </div>
    </div>

    <div style="margin-bottom: 40px;">
      <h3 style="font-size: 15px; font-weight: 900; text-align: center; margin-bottom: 12px; letter-spacing: 4px;">
        신 &nbsp;청 &nbsp;이 &nbsp;유
      </h3>
      <p style="font-size: 12px; line-height: 1.9; text-align: justify; margin: 0;">
        신청인은 지급불능의 상태에 이르러 귀원에 개인회생절차 개시신청을 하였습니다. 만일 개인회생채권자들이 신청인의 급여채권이나 유체동산 등에 대하여 강제집행을 실행한다면 신청인은 최저생계마저 위협받아 회생절차를 성실히 수행할 수 없게 되므로, 채무자 회생 및 파산에 관한 법률 제593조 제1항에 따라 위와 같은 금지명령을 신청합니다.
      </p>
    </div>

    <div style="text-align: center; margin-top: 50px;">
      <div style="font-size: 13px; font-weight: bold; margin-bottom: 25px; letter-spacing: 2px;">
        ${dateStr}
      </div>
      <div style="font-size: 13px; font-weight: bold; line-height: 2;">
        신청인(채무자) &nbsp; <strong>${clientName}</strong> &nbsp; (인)<br>
        대리인 &nbsp; ${firmName} &nbsp; 변호사 ${lawyerName} &nbsp; (인)
      </div>
    </div>

    <div style="text-align: center; margin-top: 60px;">
      <h2 style="font-size: 22px; font-weight: 900; letter-spacing: 6px; margin: 0; color: #0f172a;">
        ${courtName} 귀중
      </h2>
    </div>
  </div>
  `;
}

/** 6. 재산목록 (D5102) - 고객 입력 데이터 동적 바인딩 */
export function buildCourtPropertyListHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';
  // 실제 저장 필드: crmExt.propertyListD5102 (이전: 존재하지 않는 propertyD5102/fp.properties를 읽어 모든 행이 0원)
  const prop = (ctx.crmExt as any).propertyListD5102 as import('../../types/propertyTypes').PropertyListD5102Data | undefined;
  const sum = (arr: any[] | undefined, key: string) => (arr || []).reduce((s, x) => s + (Number(x?.[key]) || 0), 0);

  type Row = { label: string; detail: string; market: number; seized: string; liquidation: number };
  const rows: Row[] = [];
  if (prop) {
    const deposits = (prop.financialAssets || []).filter(a => a.category === 'deposit' || a.category === 'cash');
    const others = (prop.financialAssets || []).filter(a => a.category !== 'deposit' && a.category !== 'cash');
    rows.push({ label: '1. 현금 / 예금', detail: deposits.map(a => `${a.institutionName} ${a.description}`.trim()).join(', ') || '해당 없음', market: sum(deposits, 'marketValue'), seized: '-', liquidation: sum(deposits, 'liquidationValue') });
    rows.push({ label: '2. 보험 해약환급금', detail: (prop.insurances || []).map(i => `${i.companyName} ${i.policyName}`.trim()).join(', ') || '해당 없음', market: sum(prop.insurances, 'surrenderValue'), seized: '-', liquidation: sum(prop.insurances, 'liquidationValue') });
    rows.push({ label: '3. 자동차 / 이륜차', detail: (prop.vehicles || []).map(v => `${v.modelName} ${v.plateNumber}`.trim()).join(', ') || '해당 없음', market: sum(prop.vehicles, 'marketValue'), seized: '-', liquidation: sum(prop.vehicles, 'liquidationValue') });
    rows.push({ label: '4. 임차보증금', detail: (prop.leaseDeposits || []).map(l => l.address).filter(Boolean).join(', ') || '해당 없음', market: sum(prop.leaseDeposits, 'depositAmount'), seized: '-', liquidation: sum(prop.leaseDeposits, 'liquidationValue') });
    rows.push({ label: '5. 부동산', detail: (prop.realEstates || []).map(r => r.address).filter(Boolean).join(', ') || '해당 없음', market: sum(prop.realEstates, 'marketValue'), seized: '-', liquidation: sum(prop.realEstates, 'liquidationValue') });
    rows.push({ label: '6. 예상 퇴직금', detail: (prop.severances || []).map(s => s.workplaceName).filter(Boolean).join(', ') || '해당 없음', market: sum(prop.severances, 'expectedAmount'), seized: '-', liquidation: sum(prop.severances, 'liquidationValue') });
    if (others.length > 0) rows.push({ label: '7. 주식·가상자산 등', detail: others.map(a => `${a.institutionName} ${a.description}`.trim()).join(', '), market: sum(others, 'marketValue'), seized: '-', liquidation: sum(others, 'liquidationValue') });
    if ((prop.businessAssets || []).length > 0) rows.push({ label: '8. 사업용 자산·채권', detail: (prop.businessAssets || []).map(b => b.name).join(', '), market: sum(prop.businessAssets, 'marketValue'), seized: '-', liquidation: sum(prop.businessAssets, 'liquidationValue') });
  }
  const totalMarket = prop ? (prop.totalMarketValue || rows.reduce((s, r) => s + r.market, 0)) : 0;
  const totalLiquidation = prop ? (prop.totalLiquidationValue ?? rows.reduce((s, r) => s + r.liquidation, 0)) : 0;

  const rowHtml = rows.map(r => `
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">${r.label}</td>
          <td style="padding: 5px 10px; border-right: 1px solid #000000;">${r.detail}</td>
          <td style="padding: 5px 10px; text-align: right; border-right: 1px solid #000000;">${Math.round(r.market).toLocaleString()}원</td>
          <td style="text-align: center; border-right: 1px solid #000000;">${r.seized}</td>
          <td style="padding: 5px 10px; text-align: right; font-weight: bold;">${Math.round(r.liquidation).toLocaleString()}원</td>
        </tr>`).join('');

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333333; margin-bottom: 12px;">
      <span>[전산양식 D5102]</span>
      <span>채무자: ${clientName}</span>
    </div>

    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #0f172a;">
        재 &nbsp; 산 &nbsp; 목 &nbsp; 록
      </h1>
    </div>

    <table style="${TABLE_BORDER_STYLE} margin-bottom: 20px;">
      <thead>
        <tr style="background: transparent; height: 32px; border-bottom: 1.5px solid #334155; text-align: center;">
          <th style="width: 140px; border-right: 1px solid #000000;">재산의 종류</th>
          <th style="border-right: 1px solid #000000;">소재지 / 보관처 / 내역</th>
          <th style="width: 120px; border-right: 1px solid #000000;">평가액 (시가)</th>
          <th style="width: 80px; border-right: 1px solid #000000;">압류유무</th>
          <th style="width: 120px;">청산가치 반영액</th>
        </tr>
      </thead>
      <tbody>
        ${prop ? rowHtml : `
        <tr style="height: 60px;">
          <td colspan="5" style="text-align: center; color: #b91c1c; font-weight: bold;">재산목록(D5102)이 아직 작성되지 않았습니다. [재산 가치평가]에서 입력해 주세요.</td>
        </tr>`}
        <tr style="border-bottom: 1.5px solid #1e293b; height: 36px; background: transparent;">
          <td colspan="2" style="font-weight: bold; text-align: center; border-right: 1px solid #000000;">합 &nbsp; &nbsp; &nbsp; 계</td>
          <td style="padding: 5px 10px; text-align: right; font-weight: bold; border-right: 1px solid #000000;">
            ${Math.round(totalMarket).toLocaleString()}원
          </td>
          <td style="text-align: center; border-right: 1px solid #000000;">-</td>
          <td style="padding: 5px 10px; text-align: right; font-weight: 900; color: #1e3a8a;">
            ${Math.round(totalLiquidation).toLocaleString()}원 (청산가치)
          </td>
        </tr>
      </tbody>
    </table>

    <div style="font-size: 11px; color: #333333; line-height: 1.8; padding: 12px; background: transparent; border: 1px solid #cbd5e1; border-radius: 0;">
      <strong>[공제 기준]</strong><br>
      • 예금 압류금지 ${DEPOSIT_EXEMPTION_KRW.toLocaleString()}원, 보장성 보험 해약환급금 ${EXEMPT_INSURANCE_REFUND_LIMIT.toLocaleString()}원 한도 내 공제 (민사집행법 제246조, 같은 법 시행령)<br>
      • 임차보증금은 주택임대차보호법 시행령상 지역별 최우선변제금 한도 내 공제 (항목별 청산가치에 반영)<br>
      • 압류 유무는 개별 자료로 확인 후 기재
    </div>
  </div>
  `;
}

/** 7. 수입 및 지출에 관한 목록 (D5103) - 고객 입력 데이터 동적 바인딩 */
export function buildCourtIncomeExpenseHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';
  const inc = ctx.crmExt.incomeExpenseD5103;
  const fp = ctx.clientRequest.financialProfile;

  // 실제 필드: incomeExpenseD5103.salary / business / expenses / disposableIncome / seizure
  // (이전: 존재하지 않는 inc.companyName·netMonthlyIncome·standardLivingCost를 읽음)
  const companyName = inc?.salary?.employerName || inc?.business?.businessName || (fp as any)?.companyName || '';
  const jobTitle = inc?.salary?.jobTitle || (inc?.incomeType === 'BUSINESS' ? inc?.business?.businessCategory : '') || '';
  const monthlyIncome = inc?.disposableIncome?.monthlyNetIncome || inc?.salary?.netMonthlyIncome || inc?.business?.monthlyAverageIncome
    || (fp?.monthlyIncome ? fp.monthlyIncome * 10000 : (fp?.income ? fp.income * 10000 : 0));
  const livingCost = inc?.disposableIncome?.monthlyTotalExpense || inc?.expenses?.totalMonthlyExpense || getLivingExpense((fp?.dependents || 0) + 1);
  const seizureText = inc?.seizure?.hasSeizure
    ? `있음 (${[inc.seizure.courtName, inc.seizure.caseNumber, inc.seizure.creditorName].filter(Boolean).join(' ')})`
    : (inc?.seizure ? '없음' : '(미입력)');
  const monthlyDisposable = Math.max(0, monthlyIncome - livingCost);
  const dependentText = fp?.dependents ? `${fp.dependents + 1}인 가구 (본인 + 부양 ${fp.dependents}인)` : '1인 가구 (신청인 본인)';

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333333; margin-bottom: 12px;">
      <span>[전산양식 D5103]</span>
      <span>채무자: ${clientName}</span>
    </div>

    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #0f172a;">
        수입 및 지출에 관한 목록
      </h1>
    </div>

    <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
      1. 현재의 수입목록 (급여소득자)
    </h3>
    <table style="${TABLE_BORDER_STYLE} margin-bottom: 20px;">
      <tbody>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="width: 120px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">직 장 명</td>
          <td style="padding: 5px 12px; border-right: 1px solid #000000;">${companyName}</td>
          <td style="width: 100px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">직종 및 직위</td>
          <td style="padding: 5px 12px;">${jobTitle}</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">월 평균 실수령액</td>
          <td style="padding: 5px 12px; font-weight: bold; color: #0f172a; border-right: 1px solid #000000;">${Math.round(monthlyIncome).toLocaleString()}원</td>
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">압류 여부</td>
          <td style="padding: 5px 12px;">${seizureText}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
      2. 생계비 및 가용소득 산출표 (2026년 기준 중위소득 60% 반영)
    </h3>
    <table style="${TABLE_BORDER_STYLE} margin-bottom: 20px;">
      <tbody>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="width: 160px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">부양가족 수</td>
          <td style="padding: 5px 12px; border-right: 1px solid #000000;">${dependentText}</td>
          <td style="width: 140px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">법정 인정 생계비</td>
          <td style="padding: 5px 12px; font-weight: bold;">${Math.round(livingCost).toLocaleString()}원</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 36px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">월 가용소득 (변제재원)</td>
          <td colspan="3" style="padding: 5px 12px; font-size: 13px; font-weight: 900; color: #2563eb;">
            월 ${Math.round(monthlyDisposable).toLocaleString()}원 (월 소득 ${Math.round(monthlyIncome).toLocaleString()}원 - 생계비 ${Math.round(livingCost).toLocaleString()}원)
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  `;
}

/** 8. 진술서 (학력/경력 및 채무증대경위서) - 고객 입력 데이터 동적 바인딩 */
export function buildCourtStatementHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';
  const stmt = ctx.crmExt.courtStatement;

  // 실제 필드명: finalEducation / jobHistories[].period·position·reasonForLeaving / story.aiDraftStatement
  // (이전: 존재하지 않는 applicant.education·jobHistory·aiGeneratedStatement를 읽어 항상 빈칸)
  const education = stmt?.finalEducation || '';
  const jobText = (stmt?.jobHistories && stmt.jobHistories.length > 0)
    ? stmt.jobHistories.map(j => `${j.period}: ${j.companyName}${j.position ? ` (${j.position})` : ''}${j.reasonForLeaving ? ` — ${j.reasonForLeaving}` : ''}`).join('<br>')
    : '';

  // 진술서 본문은 의뢰인·변호사가 작성한 4단 경위만 사용 (임의 문장·반성문을 덧붙이지 않음)
  const story = stmt?.story;
  const storyParts = [story?.initialCauseDetail, story?.growthProcessDetail, story?.insolvencyTriggerDetail, story?.resolutionAndApology]
    .map(s => (s || '').trim()).filter(Boolean);
  const detailCause = (storyParts.length > 0 ? storyParts.join('<br><br>') : (story?.aiDraftStatement || '').trim()) || '(미입력)';
  const kw = (story?.initialCauseKeywords || []).join(' ');
  const box = (...words: string[]) => (words.some(w => kw.includes(w)) ? '■' : '&nbsp;');

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="text-align: center; margin-bottom: 25px;">
      <h1 style="font-size: 26px; font-weight: 900; letter-spacing: 6px; margin: 0; color: #0f172a;">
        진 &nbsp; &nbsp; 술 &nbsp; &nbsp; 서
      </h1>
    </div>

    <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
      1. 학력 및 경력사항
    </h3>
    <table style="${TABLE_BORDER_STYLE} margin-bottom: 16px;">
      <tbody>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="width: 110px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">최 종 학 력</td>
          <td colspan="3" style="padding: 4px 10px;">${education}</td>
        </tr>
        <tr style="height: 30px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">주요 경력사항</td>
          <td colspan="3" style="padding: 4px 10px;">${jobText}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
      2. 개인회생절차에 이르게 된 사정 (중복 선택)
    </h3>
    <div style="font-size: 11px; line-height: 2; padding: 10px 14px; background: transparent; border: 1px solid #cbd5e1; margin-bottom: 16px; border-radius: 0;">
      <div>[ ${box('생활비')} ] 생활비 부족 &nbsp; &nbsp; [ ${box('교육비')} ] 교육비 과다지출 &nbsp; &nbsp; [ ${box('점포')} ] 점포운영 실패 &nbsp; &nbsp; [ ${box('사업')} ] 사업실패</div>
      <div>[ ${box('보증')} ] 타인 채무보증 &nbsp; &nbsp; [ ${box('사기')} ] 사기 피해 &nbsp; &nbsp; [ ${box('주식', '코인', '가상')} ] 주식/가상화폐 투자실패 &nbsp; &nbsp; [ ${box('의료', '병원')} ] 의료비 지출</div>
    </div>

    <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
      3. 채무증대 및 지급불능에 이르게 된 상세 사정
    </h3>
    <div style="font-size: 12px; line-height: 2; padding: 14px 18px; border: 1px solid #000000; border-radius: 0; text-align: justify; height: 420px; overflow: hidden;">
      ${detailCause}
    </div>

    <div style="text-align: right; margin-top: 24px; font-size: 13px; font-weight: bold;">
      작성자(신청인): &nbsp; <strong>${clientName}</strong> &nbsp; (서명 또는 날인)
    </div>
  </div>
  `;
}

/** 9. 변제계획안 (D5110) */
export function buildCourtRepaymentPlanHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';
  const monthlyRepayment = (ctx.crmExt.repaymentPlan as any)?.monthlyRepaymentTotal || (ctx.crmExt.repaymentPlan as any)?.monthlyRepayment || 0;
  // 변제기간·청산가치는 변제계획 데이터 사용 (이전: 36개월 고정, '청산가치(0원) 100% 충족' 고정 문구)
  const planMonths = Number((ctx.crmExt.repaymentPlan as any)?.months) || 36;
  const totalRepayment = (ctx.crmExt.repaymentPlan as any)?.totalRepaymentAmount || monthlyRepayment * planMonths;
  const totalPrincipal = ctx.creditors.reduce((sum, c) => sum + (c.principal || 0), 0);
  const repaymentRate = totalPrincipal > 0 ? Math.round((totalRepayment / totalPrincipal) * 1000) / 10 : 0;
  const liquidationValue = Number((ctx.crmExt.repaymentPlan as any)?.totalLiquidationValue) || 0;
  const meetsLiquidation = totalRepayment >= liquidationValue;

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333333; margin-bottom: 12px;">
      <span>[전산양식 D5110]</span>
      <span>채무자: ${clientName}</span>
    </div>

    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="font-size: 24px; font-weight: 900; letter-spacing: 4px; margin: 0; color: #0f172a;">
        변 &nbsp; 제 &nbsp; 계 &nbsp; 획 (안)
      </h1>
    </div>

    <table style="${TABLE_BORDER_STYLE} margin-bottom: 20px;">
      <tbody>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="width: 140px; background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">변 제 기 간</td>
          <td style="padding: 5px 12px; font-weight: bold;">${planMonths}개월</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">월 변제예정액</td>
          <td style="padding: 5px 12px; font-weight: 900; color: #2563eb;">월 ${Math.round(monthlyRepayment).toLocaleString()}원 (매월 10일 납입)</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">총 변제예정액</td>
          <td style="padding: 5px 12px; font-weight: bold;">${Math.round(totalRepayment).toLocaleString()}원</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 32px;">
          <td style="background: transparent; font-weight: bold; text-align: center; border-right: 1px solid #000000;">원금 변제율 / 탕감률</td>
          <td style="padding: 5px 12px; font-weight: bold;">
            원금의 <span style="color: #2563eb;">${repaymentRate}%</span> 변제 (원금의 <span style="color: #dc2626;">${(100 - repaymentRate).toFixed(1)}%</span> 면책)
          </td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
      개인회생채권 변제예정액 산출 요약
    </h3>
    <div style="font-size: 11px; line-height: 1.8; padding: 12px 16px; background: transparent; border: 1px solid #cbd5e1; border-radius: 0; text-align: justify;">
      • 본 변제계획안은 채무자의 가용소득(월 소득에서 생계비를 공제한 잔액)을 ${planMonths}개월간 채권자들의 원금 비율에 따라 안분 변제하는 안입니다.<br>
      • 청산가치 ${Math.round(liquidationValue).toLocaleString()}원 대비 총 변제예정액 ${Math.round(totalRepayment).toLocaleString()}원 — ${meetsLiquidation ? '청산가치 보장 요건을 충족하는 것으로 계산됩니다.' : '<strong style="color:#b91c1c">청산가치에 미달합니다. 변제계획을 조정해야 합니다.</strong>'}
    </div>
  </div>
  `;
}

/** 10. 소송위임장 및 경유확인서 */
export function buildCourtPowerOfAttorneyHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';
  const lawyerName = ctx.lawyerName || '';
  const firmName = ctx.firmName || '';
  const courtName = ctx.courtName || ctx.crmExt.courtCase?.courtName || '';

  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}.`;

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="text-align: center; margin-top: 30px; margin-bottom: 25px;">
      <h1 style="font-size: 28px; font-weight: 900; letter-spacing: 8px; margin: 0; color: #0f172a;">
        소 &nbsp;송 &nbsp;위 &nbsp;임 &nbsp;장
      </h1>
    </div>

    <div style="font-size: 13px; line-height: 2; margin-bottom: 20px;">
      <div><strong>사 &nbsp; &nbsp;건:</strong> &nbsp; ${ctx.crmExt.courtCase?.caseNumber || '(사건번호 미부여)'} 개인회생사건</div>
      <div><strong>위임인:</strong> &nbsp; <strong>${clientName}</strong></div>
      <div><strong>수임인:</strong> &nbsp; ${firmName} &nbsp; <strong>변호사 ${lawyerName}</strong></div>
    </div>

    <p style="font-size: 12px; line-height: 1.8; margin-bottom: 16px; text-align: justify;">
      위 사건에 관하여 위임인은 수임인을 소송대리인으로 선임하고 다음 표시의 권한을 수여합니다.
    </p>

    <div style="font-size: 11px; line-height: 1.9; padding: 12px 16px; background: transparent; border: 1.5px solid #cbd5e1; border-radius: 0; margin-bottom: 24px;">
      <div>1. 일체의 소송행위, 반소의 제기 및 응소</div>
      <div>2. 소의 취하, 화해, 청구의 포기 및 인낙</div>
      <div>3. 복대리인의 선임</div>
      <div>4. 공탁물의 납입 및 공탁물과 그 이자의 수령</div>
      <div>5. 담보권의 실행, 강제집행의 신청 및 취하</div>
      <div>6. 보정권고, 보정명령에 대한 답변서 및 소명자료 제출</div>
      <div>7. 변제계획안의 작성, 수정 및 인가신청</div>
      <div>8. 법원 송달물의 영수</div>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <div style="font-size: 13px; font-weight: bold; margin-bottom: 20px;">${dateStr}</div>
      <div style="font-size: 13px; font-weight: bold; line-height: 2;">
        위임인(신청인): &nbsp; <strong>${clientName}</strong> &nbsp; (인)<br>
        수임인(대리인): &nbsp; ${firmName} &nbsp; <strong>변호사 ${lawyerName}</strong> &nbsp; (인)
      </div>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <h2 style="font-size: 22px; font-weight: 900; letter-spacing: 6px; margin: 0; color: #0f172a;">
        ${courtName} 귀중
      </h2>
    </div>
  </div>
  `;
}

/** 11. 서울회생법원 필수자료제출목록 */
export function buildCourtRequiredDocumentChecklistHtml(ctx: CourtFormDataContext): string {
  ctx = safeCtx(ctx);
  const clientName = ctx.clientRequest.clientName || '신청인';

  return `
  <div style="${A4_PAGE_STYLE}">
    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #333333; margin-bottom: 12px;">
      <span>[서울회생법원 실무준칙 별지]</span>
      <span>신청인: ${clientName}</span>
    </div>

    <div style="text-align: center; margin-bottom: 20px;">
      <h1 style="font-size: 22px; font-weight: 900; letter-spacing: 2px; margin: 0; color: #0f172a;">
        필수자료 제출목록 및 제출 여부
      </h1>
    </div>

    <table style="${TABLE_BORDER_STYLE}">
      <thead>
        <tr style="background: transparent; height: 32px; border-bottom: 1.5px solid #334155; text-align: center;">
          <th style="width: 45px; border-right: 1px solid #000000;">번호</th>
          <th style="border-right: 1px solid #000000;">서 류 명</th>
          <th style="width: 75px; border-right: 1px solid #000000;">제출여부</th>
          <th style="width: 220px;">비고 / 소명 내용</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">1</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">주민등록등본 및 초본 (말소·변동 전체)</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">과거 5년 주소변동 전체 포함 제출</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">2</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">가족관계증명서 및 혼인관계증명서 (상세)</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">가족 주민등록번호 뒷자리 마스킹 처리</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">3</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">지방세 세목별 과세(비과세)증명서 (5년)</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">전국 자치단체 대상 전체 세목 발행본</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">4</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">지적전산자료 조회결과서 (K-Geo 무소유 증명)</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">신청인 본인 명의 전국 부동산 무소유 확인</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">5</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">계좌정보통합관리서비스(어카운트인포) 내역</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">은행권·제2금융권 전체 활동성/비활동성 계좌</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">6</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">보험계약 조회결과서 및 해약환급금 확인서</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">전 보험사 계약 현황 및 150만원 공제 적용</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">7</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">소득금액증명원 / 근로소득원천징수영수증</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">최근 1개년 급여 내역 및 세무서 발행본</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">8</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">재직증명서 및 최근 1년 급여입금통장 거래내역</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">현재 재직 상태 및 급여 실지급액 입증</td>
        </tr>
        <tr style="border-bottom: 1px solid #000000; height: 30px;">
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">9</td>
          <td style="padding: 4px 10px; border-right: 1px solid #000000;">금융기관별 부채증명서 원본 일체</td>
          <td style="text-align: center; font-weight: bold; border-right: 1px solid #000000;">□</td>
          <td style="padding: 4px 10px; font-size: 11px; color: #333333;">채권자목록 기재 채권사 전원 부채확인서</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 20px; font-size: 11px; color: #000000; line-height: 1.6;">
      ※ 제출 여부(□)는 담당자가 실제 서류를 확인한 뒤 표시합니다. 필수 서류 목록은 관할 법원 실무준칙에 따라 다를 수 있습니다.
    </div>
  </div>
  `;
}
