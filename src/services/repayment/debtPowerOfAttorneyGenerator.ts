/**
 * 부채증명원 발급 위임장 PDF 자동 생성 서비스
 * - 대법원 및 금융기관 제출용 공식 한글 [위  임  장 (부채증명서 발급용)] 양식
 * - html2canvas + jsPDF 기반 고해상도 한글 완벽 렌더링 (A4 규격)
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { DebtCertificateOrder } from './repaymentTypes';

/**
 * 위임장 HTML 템플릿 빌더
 */
function buildPowerOfAttorneyHtml(order: DebtCertificateOrder): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const creditorRows = order.items
    .slice(0, 12)
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 6px 10px; font-weight: bold; color: #0f172a;">${item.creditorName}</td>
        <td style="padding: 6px 10px; color: #334155; font-family: monospace;">${item.accountOrContractNo || '-'}</td>
        <td style="padding: 6px 10px; color: #475569;">${item.branchName || '전 지점 / 본점'}</td>
        <td style="padding: 6px 8px; text-align: center; color: #2563eb; font-weight: bold;">부채증명서 발급</td>
      </tr>
    `
    )
    .join('');

  const remainingCount = Math.max(0, order.items.length - 12);

  return `
    <div style="width: 794px; min-height: 1123px; padding: 50px 60px; background: #ffffff; color: #0f172a; font-family: 'Malgun Gothic', 'Pretendard', sans-serif; box-sizing: border-box; position: relative;">
      
      <!-- 상단 제목 -->
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0f172a; padding-bottom: 16px;">
        <h1 style="font-size: 26px; font-weight: 900; letter-spacing: 6px; margin: 0; color: #0f172a;">
          위 &nbsp; 임 &nbsp; 장
        </h1>
        <p style="font-size: 13px; color: #475569; margin-top: 6px; font-weight: bold;">
          (부채증명서 / 금융거래확인서 발급 대행용)
        </p>
      </div>

      <!-- 1. 위임인 (채무자) 인적사항 -->
      <div style="margin-bottom: 22px;">
        <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
          1. 위임인 (채무자 / 신청인)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1;">
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="width: 120px; padding: 7px 12px; background: #f8fafc; font-weight: bold; color: #334155;">성 &nbsp; &nbsp; &nbsp; 명</td>
              <td style="padding: 7px 12px; font-weight: bold; color: #0f172a;">${order.clientName}</td>
              <td style="width: 120px; padding: 7px 12px; background: #f8fafc; font-weight: bold; color: #334155;">주민등록번호</td>
              <td style="padding: 7px 12px; font-family: monospace;">${order.clientRrnFront || '******'}-*******</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 7px 12px; background: #f8fafc; font-weight: bold; color: #334155;">연 &nbsp; 락 &nbsp; 처</td>
              <td style="padding: 7px 12px; font-family: monospace;">${order.clientPhone || '-'}</td>
              <td style="padding: 7px 12px; background: #f8fafc; font-weight: bold; color: #334155;">용 &nbsp; &nbsp; &nbsp; 도</td>
              <td style="padding: 7px 12px; font-weight: bold; color: #2563eb;">개인회생사건 법원 제출용</td>
            </tr>
            <tr>
              <td style="padding: 7px 12px; background: #f8fafc; font-weight: bold; color: #334155;">주 &nbsp; &nbsp; &nbsp; 소</td>
              <td colspan="3" style="padding: 7px 12px; color: #1e293b;">${order.clientAddress || '주민등록등본상 주소지'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 2. 수임인 (대행사 / 법률대리인) -->
      <div style="margin-bottom: 22px;">
        <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0 0 8px 0;">
          2. 수임인 (부채발급 대행기관 / 법률대리인)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1;">
          <tbody>
            <tr>
              <td style="width: 120px; padding: 7px 12px; background: #f8fafc; font-weight: bold; color: #334155;">상호 (기관명)</td>
              <td style="padding: 7px 12px; font-weight: bold; color: #0f172a;">${order.agencyName || '원클릭 부채증명발급센터'}</td>
              <td style="width: 120px; padding: 7px 12px; background: #f8fafc; font-weight: bold; color: #334155;">위임 사무</td>
              <td style="padding: 7px 12px; color: #1e293b;">부채증명서 신청, 접수 및 수령 일체</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3. 위임 대상 금융기관 목록 -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
          <h3 style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin: 0;">
            3. 위임 대상 금융기관 (총 ${order.items.length}개 기관)
          </h3>
          <span style="font-size: 10px; color: #64748b;">* 금융기관별 부채증명서 및 거래내역 발급 청구</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff; font-size: 11px;">
              <th style="padding: 6px 8px; width: 36px; text-align: center;">연번</th>
              <th style="padding: 6px 10px; text-align: left;">채권기관명 (금융사)</th>
              <th style="padding: 6px 10px; text-align: left;">계좌/관리번호</th>
              <th style="padding: 6px 10px; text-align: left;">관할지점</th>
              <th style="padding: 6px 8px; width: 110px; text-align: center;">발급요청 서식</th>
            </tr>
          </thead>
          <tbody>
            ${creditorRows}
          </tbody>
        </table>

        ${
          remainingCount > 0
            ? `<p style="font-size: 10px; color: #64748b; margin-top: 5px; text-align: right;">... 외 ${remainingCount}개 금융기관 (별첨 의뢰서 기재와 같음)</p>`
            : ''
        }
      </div>

      <!-- 4. 위임의 취지 -->
      <div style="margin-bottom: 30px; padding: 12px 16px; background: #f8fafc; border-left: 3px solid #2563eb; font-size: 11px; line-height: 1.7; color: #334155;">
        위임인은 상기 수임인에게 본인의 개인회생 신청 사건과 관련하여 상기 금융기관들에 대한 부채증명원, 부채잔액증명서, 계좌원장 및 금융거래확인서의 신청, 발급, 수령 및 이에 수반되는 제반 행위 일체를 위임합니다.
      </div>

      <!-- 작성일자 및 날인란 -->
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 14px; font-weight: bold; color: #1e293b; letter-spacing: 2px; margin-bottom: 24px;">
          ${year}년 &nbsp; ${month}월 &nbsp; ${day}일
        </p>

        <div style="display: flex; justify-content: center; align-items: center; gap: 40px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #0f172a;">
            <strong>위 임 인 :</strong> &nbsp; <span style="font-size: 16px; font-weight: 900;">${order.clientName}</span>
          </div>
          <div style="width: 50px; height: 50px; border: 1.5px dashed #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #64748b; font-weight: bold;">
            (인)
          </div>
        </div>

        <p style="font-size: 15px; font-weight: 900; color: #0f172a; letter-spacing: 3px; margin-top: 30px;">
          각 금융기관 대표자 및 지점장 귀중
        </p>
      </div>

    </div>
  `;
}

/**
 * 고해상도 A4 위임장 PDF jsPDF 인스턴스 비동기 생성
 */
export async function createDebtPowerOfAttorneyDoc(
  order: DebtCertificateOrder
): Promise<jsPDF> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.innerHTML = buildPowerOfAttorneyHtml(order);
  document.body.appendChild(container);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    return pdf;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 부채증명원 발급 위임장 PDF 직접 다운로드 (.pdf)
 */
export async function downloadDebtPowerOfAttorneyPdf(
  order: DebtCertificateOrder
): Promise<void> {
  const safeClient = order.clientName.replace(/[^a-zA-Z0-9가-힣]/g, '');
  const pdf = await createDebtPowerOfAttorneyDoc(order);
  pdf.save(`03_발급위임장_${safeClient}_자동생성.pdf`);
}

/**
 * ZIP 패키징을 위한 위임장 PDF 바이너리(Uint8Array) 생성
 */
export async function getDebtPowerOfAttorneyPdfUint8Array(
  order: DebtCertificateOrder
): Promise<Uint8Array> {
  const pdf = await createDebtPowerOfAttorneyDoc(order);
  const arrayBuffer = pdf.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}
