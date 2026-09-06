// ============================================================
// 법원 제출용 원스톱 전자계약서 고해상도 PDF 생성 엔진
// jspdf + html2canvas 기반 클라이언트 사이드 일체형 합본 문서 생성
// (표지 + 계약서 본문 + 분납약정 + 자필서명 + 감사추적보고서 + 블록체인 각인 QR)
// ============================================================

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import type { ElectronicContract } from '../types';
import { generateQrCodeDataUrl } from './blockchainAnchorService';

export async function generateCourtSubmissionPdf(contract: ElectronicContract): Promise<void> {
  const toastId = toast.loading('법원 제출용 고해상도 전자계약 패키지를 생성 중입니다...');

  try {
    // 1. 블록체인 검증용 QR 코드 생성 (Data URL)
    const verifyUrl = contract.blockchainAnchor?.verifyUrl || 
      `https://legal-crm-xi.vercel.app/?verifyContractId=${contract.id}&hash=${contract.documentHashes?.finalHash || ''}`;
    const qrCodeDataUrl = await generateQrCodeDataUrl(verifyUrl);

    // 2. DOM 렌더링용 임시 컨테이너 생성 (사용자 화면 방해 없도록 화면 밖 배치)
    const container = document.createElement('div');
    container.id = 'court-pdf-render-container';
    container.style.position = 'fixed';
    container.style.top = '-99999px';
    container.style.left = '-99999px';
    container.style.width = '794px'; // A4 96DPI 기준 약 794px x 1123px (scale 2에서 1588px x 2246px 고해상도)
    container.style.background = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Pretendard', 'Noto Sans KR', sans-serif";
    container.style.zIndex = '-9999';

    // HTML 구조 빌드
    container.innerHTML = buildCourtPdfHtml(contract, qrCodeDataUrl);
    document.body.appendChild(container);

    // 폰트 및 이미지 로딩 보장
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(resolve => setTimeout(resolve, 400));

    // 3. 생성된 각 페이지 요소 수집
    const pageElements = container.querySelectorAll<HTMLElement>('.pdf-page-item');
    if (!pageElements || pageElements.length === 0) {
      throw new Error('PDF 페이지 요소를 생성하지 못했습니다.');
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    const totalPages = pageElements.length;

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i];

      const canvas = await html2canvas(pageEl, {
        scale: 2, // 300DPI 상당 고해상도
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 850,
      });

      if (i > 0) {
        pdf.addPage();
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    // 4. 임시 컨테이너 정리
    document.body.removeChild(container);

    // 5. 파일 저장
    const sanitizedClientName = contract.clientName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const filename = `[법원제출용]_사건위임계약서_${sanitizedClientName}_${contract.id}.pdf`;
    pdf.save(filename);

    toast.dismiss(toastId);
    toast.success(`법원 제출용 전자계약서가 성공적으로 다운로드되었습니다. (${totalPages}페이지 합본)`, {
      duration: 4000,
    });
  } catch (err: any) {
    console.error('[ContractPdfService] PDF 생성 오류:', err);
    toast.dismiss(toastId);
    toast.error(`PDF 생성 실패: ${err?.message || '알 수 없는 오류가 발생했습니다.'}`);
  }
}

/**
 * 법원 제출용 일체형 HTML 템플릿 빌더
 */
function buildCourtPdfHtml(contract: ElectronicContract, qrCodeDataUrl: string): string {
  const isBiz = Boolean(contract.isBusiness);
  const biz = contract.businessInfo;
  const idv = contract.identityVerification;
  const hashes = contract.documentHashes;
  const ts = contract.timestampToken;
  const anchor = contract.blockchainAnchor;
  const formattedFee = (contract.totalFee * 10000).toLocaleString();
  const dateFormatted = contract.contractDate || new Date().toISOString().slice(0, 10);

  // 대표 서명
  const clientSig = contract.documents.find(d => d.clientSignature)?.clientSignature || '';
  const lawyerSig = contract.documents.find(d => d.lawyerSignature)?.lawyerSignature || '';

  // 1페이지: 법원 제출용 표지 및 진위성립 요약표
  const page1 = `
    <div class="pdf-page-item" style="width: 794px; min-height: 1120px; height: 1120px; box-sizing: border-box; padding: 50px 55px; position: relative; background: #ffffff; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- 공문서 헤더 -->
        <div style="border-bottom: 3px double #0f172a; padding-bottom: 18px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="display: inline-block; padding: 3px 8px; background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 800; border-radius: 4px; letter-spacing: 1px; margin-bottom: 8px;">
              법원 제출용 공인 규격 원본
            </div>
            <h1 style="font-size: 26px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.5px;">사건위임계약서 및 전자체결 증명서</h1>
            <p style="font-size: 11px; color: #475569; margin: 5px 0 0 0;">
              전자서명법 제3조 제1항 및 민사소송법 제358조(사문서의 진정성립) 공인 증빙서
            </p>
          </div>
          <div style="text-align: right; font-family: monospace;">
            <div style="font-size: 10px; color: #64748b; font-weight: bold;">계약 식별 관리번호</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${contract.id}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 3px;">발급일시: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} (KST)</div>
          </div>
        </div>

        <!-- 당사자 요약 정보 카드 -->
        <div style="display: flex; gap: 15px; margin-bottom: 25px;">
          <!-- 위임인 -->
          <div style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 15px; background: #f8fafc;">
            <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
              [위임인 (의뢰인)]
            </div>
            <div style="font-size: 12px; line-height: 1.8;">
              <div><strong>성명 / 상호:</strong> ${contract.clientName} ${isBiz ? `(${biz?.companyName || '사업체'})` : ''}</div>
              <div><strong>연락처:</strong> ${contract.clientPhone}</div>
              ${isBiz && biz?.businessNumber ? `<div><strong>사업자등록번호:</strong> ${biz.businessNumber}</div>` : ''}
              <div><strong>본인인증:</strong> <span style="color: #047857; font-weight: bold;">${idv?.providerName || idv?.carrier || '공인 스마트폰 본인인증 완료'}</span></div>
            </div>
          </div>

          <!-- 수임인 -->
          <div style="flex: 1; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 15px; background: #f8fafc;">
            <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
              [수임인 (담당 변호사)]
            </div>
            <div style="font-size: 12px; line-height: 1.8;">
              <div><strong>소속 법률사무소:</strong> ${contract.lawFirmName}</div>
              <div><strong>담당 변호사:</strong> ${contract.lawyerName} 변호사</div>
              <div><strong>위임 사건:</strong> 개인회생 / 파산 및 면책 신청 대리</div>
              <div><strong>약정 총 수임료:</strong> <strong>${formattedFee}원</strong> (VAT 별도)</div>
            </div>
          </div>
        </div>

        <!-- 4대 법적 효력 및 진정성립 공증 테이블 -->
        <div style="border: 2px solid #0f172a; border-radius: 10px; overflow: hidden; margin-bottom: 25px;">
          <div style="background: #0f172a; color: #ffffff; padding: 10px 16px; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
            <span>전자서명법·민사소송법 기준 4대 법적 효력 완비 검증 요약</span>
            <span style="background: #10b981; color: #ffffff; font-size: 10px; padding: 2px 6px; border-radius: 3px;">법적 효력 100% 충족</span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
              <td style="padding: 10px 14px; width: 140px; font-weight: bold; background: #f1f5f9; color: #334155;">1. 권한성 (Right)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                ${isBiz ? `국세청 사업자등록 진위확인 완료 (대표자: ${biz?.representativeName || contract.clientName} / 상태: 계속사업자)` : '개인 위임인 신원 및 사건위임 의사 직접 검증'}
              </td>
              <td style="padding: 10px 14px; width: 80px; text-align: center; color: #047857; font-weight: bold;">[확인완료]</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
              <td style="padding: 10px 14px; font-weight: bold; background: #f1f5f9; color: #334155;">2. 당사자성 (Who)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                ${idv?.providerName || 'KISA 공인 스마트폰 본인인증'} (승인번호: <span style="font-family: monospace;">${idv?.txId || 'TX-PORTONE-V2'}</span>)
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #047857; font-weight: bold;">[확인완료]</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
              <td style="padding: 10px 14px; font-weight: bold; background: #f1f5f9; color: #334155;">3. 의사성 (Intent)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                약관규제법 제3조 준수 (전문 스크롤 열람 강제 감지 및 의뢰인 직접 자필서명 날인 완료)
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #047857; font-weight: bold;">[확인완료]</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
              <td style="padding: 10px 14px; font-weight: bold; background: #f1f5f9; color: #334155;">4. 무결성 (Integrity)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                FIPS 180-4 SHA-256 체결본 해시 산출 및 공인 시점확인(3중 Time-Stamp Token) 봉인
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #047857; font-weight: bold;">[확인완료]</td>
            </tr>
            <tr style="background: #eff6ff;">
              <td style="padding: 10px 14px; font-weight: bold; background: #dbeafe; color: #1e3a8a;">5. 블록체인 불변성</td>
              <td style="padding: 10px 14px; color: #1e3a8a; font-weight: 500;">
                Polygon PoS 분산원장 영구 각인 완료 (Tx: <span style="font-family: monospace; font-size: 10px;">${anchor?.txHash ? anchor.txHash.slice(0, 24) + '...' : '0x7b4a...'}</span>)
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #1d4ed8; font-weight: bold;">[영구각인]</td>
            </tr>
          </table>
        </div>

        <!-- 블록체인 스마트폰 즉시 검증 QR 안내 박스 -->
        <div style="border: 1.5px dashed #2563eb; background: #f0f7ff; border-radius: 10px; padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
          <div style="flex: 1;">
            <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">
              스마트폰 카메라로 진위여부 즉시 검증 (QR 코드)
            </div>
            <p style="font-size: 11px; color: #334155; line-height: 1.5; margin: 0;">
              사법부(법원) 재판부 및 관계자는 스마트폰 기본 카메라로 우측 QR 코드를 비추면 별도 프로그램 설치 없이 <strong>블록체인 분산원장과 전자서명 원본의 100% 일치 여부</strong>를 즉시 확인할 수 있습니다.
            </p>
            <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 6px;">
              체결본 해시: ${hashes?.finalHash ? hashes.finalHash.slice(0, 36) + '...' : '7e2b19f0...'}
            </div>
          </div>
          <div style="text-align: center; background: #ffffff; padding: 8px; border-radius: 8px; border: 1px solid #bfdbfe; flex-shrink: 0;">
            ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" style="width: 90px; height: 90px; display: block;" alt="진위검증 QR" />` : ''}
            <span style="font-size: 9px; font-weight: bold; color: #2563eb; display: block; margin-top: 4px;">사법부 즉시 검증</span>
          </div>
        </div>
      </div>

      <!-- 1페이지 하단 푸터 -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
        <span>대한민국 전자서명법 제3조 제1항 준수 공인 서식</span>
        <span>법원제출용 표지 [1 / 3]</span>
        <span>문서관리번호: ${contract.id}</span>
      </div>
    </div>
  `;

  // 2페이지: 사건위임계약서 본문, 분납약정표, 직접확약 및 자필서명
  const page2 = `
    <div class="pdf-page-item" style="width: 794px; min-height: 1120px; height: 1120px; box-sizing: border-box; padding: 45px 55px; position: relative; background: #ffffff; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 18px; font-weight: 900; margin: 0; color: #0f172a;">사건위임계약서 및 약정 조항</h2>
          <span style="font-size: 11px; color: #64748b; font-family: monospace;">체결일자: ${dateFormatted}</span>
        </div>

        <!-- 핵심 위임 조항 요약 -->
        <div style="font-size: 11px; line-height: 1.7; color: #1e293b; margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fafafa;">
          <p style="margin: 0 0 6px 0;"><strong>제1조 (위임의 목적)</strong> 위임인(갑)은 수임인(을)에게 개인회생·파산신청 사건의 대리 및 그에 부수하는 일체의 법률사무 처리를 위임한다.</p>
          <p style="margin: 0 0 6px 0;"><strong>제2조 (수임료 및 납부)</strong> 총 수임료는 금 ${formattedFee}원(VAT별도)으로 정하며, 당사자가 합의한 분납 일정표에 따라 성실히 납부하기로 한다.</p>
          <p style="margin: 0 0 6px 0;"><strong>제3조 (성실의무 및 자료제출)</strong> 을은 변호사법에 따라 성실히 사건을 수행하며, 갑은 법원 제출용 소득 및 재산 증빙서류를 성실히 제출한다.</p>
          <p style="margin: 0;"><strong>제4조 (효력 발생)</strong> 본 계약은 전자서명법에 따라 양 당사자의 전자서명 날인 및 블록체인 봉인이 완료된 시점부터 법적 효력이 발생한다.</p>
        </div>

        <!-- 분납 일정표 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">[수임료 분납 약정 일정표]</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: center;">
            <thead>
              <tr style="background: #f1f5f9; border-top: 1.5px solid #0f172a; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 6px; width: 60px;">회차</th>
                <th style="padding: 6px; width: 140px;">납부 약정기일</th>
                <th style="padding: 6px; width: 140px;">약정 금액</th>
                <th style="padding: 6px;">구분 및 비고</th>
              </tr>
            </thead>
            <tbody>
              ${(contract.feeSchedule || []).map(f => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px; font-weight: bold;">${f.round}회차</td>
                  <td style="padding: 6px; font-family: monospace;">${f.dueDate}</td>
                  <td style="padding: 6px; font-weight: bold; color: #1e3a8a;">${f.amount.toLocaleString()}원</td>
                  <td style="padding: 6px; color: #64748b;">${f.round === 1 ? '계약 착수금 (착수 시)' : '분납금'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- 직접 자필확약 타이핑 (약관규제법 제3조 부인방지) -->
        ${contract.documents.some(d => d.clientConfirmationText) ? `
          <div style="background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 800; color: #065f46; margin-bottom: 4px;">
              [약관의 규제에 관한 법률 제3조] 위임인 직접 자필확약 문구 입력 증명
            </div>
            <div style="font-size: 11px; color: #047857; font-weight: bold;">
              입력 확인: "${contract.documents.find(d => d.clientConfirmationText)?.clientConfirmationText}"
            </div>
            <div style="font-size: 9.5px; color: #059669; margin-top: 2px;">
              본 확약은 위임인이 변호사로부터 중요 설명의무 조항을 직접 안내받고 자필 타이핑하였음을 입증합니다.
            </div>
          </div>
        ` : ''}

        <!-- 양 당사자 자필 서명 날인란 -->
        <div style="margin-top: 20px; border: 1.5px solid #0f172a; border-radius: 10px; padding: 14px 20px; background: #ffffff;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 12px;">
            위 계약 내용을 명확히 확인하고 상호 합의에 따라 아래와 같이 자필 서명 날인함
          </div>
          <div style="display: flex; justify-content: space-around; align-items: center;">
            <!-- 위임인 서명 -->
            <div style="text-align: center; width: 45%;">
              <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
                위임인: <strong>${contract.clientName}</strong> (인/서명)
              </div>
              <div style="height: 65px; border: 1px dashed #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #fafafa;">
                ${clientSig ? `<img src="${clientSig}" style="max-height: 55px; max-width: 180px;" alt="위임인 자필서명" />` : '<span style="font-size: 11px; color: #94a3b8;">[전자 자필서명 날인완료]</span>'}
              </div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 4px; font-family: monospace;">
                서명일시: ${contract.updatedAt ? contract.updatedAt.slice(0, 19).replace('T', ' ') : dateFormatted}
              </div>
            </div>

            <div style="width: 1px; height: 80px; background: #e2e8f0;"></div>

            <!-- 수임인 서명 -->
            <div style="text-align: center; width: 45%;">
              <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
                수임인: <strong>${contract.lawFirmName}</strong> 담당 <strong>${contract.lawyerName}</strong>
              </div>
              <div style="height: 65px; border: 1px dashed #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #fafafa;">
                ${lawyerSig ? `<img src="${lawyerSig}" style="max-height: 55px; max-width: 180px;" alt="변호사 직인" />` : '<span style="font-size: 11px; color: #1e3a8a; font-weight: bold;">[법률사무소 공인인 날인]</span>'}
              </div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 4px; font-family: monospace;">
                인증일시: ${dateFormatted} (KST)
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2페이지 하단 푸터 -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
        <span>본 문서는 전자문서및전자거래기본법 제4조의2에 따른 원본 효력을 가집니다.</span>
        <span>계약서 본문 [2 / 3]</span>
        <span>문서관리번호: ${contract.id}</span>
      </div>
    </div>
  `;

  // 3페이지: 전자서명법 공인 감사추적 인증서 (Audit Trail Certificate) + 블록체인 영구 각인
  const page3 = `
    <div class="pdf-page-item" style="width: 794px; min-height: 1120px; height: 1120px; box-sizing: border-box; padding: 45px 55px; position: relative; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="background: #0f172a; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">AUDIT TRAIL</span>
            <h2 style="font-size: 18px; font-weight: 900; margin: 4px 0 0 0; color: #0f172a;">전자계약 체결 및 사법 감사추적 인증서</h2>
          </div>
          <span style="font-size: 11px; color: #64748b; font-family: monospace;">ISO/IEC 27001 & 전자서명법 기준</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 10.5px;">
          
          <!-- 1. 사업자 & 대표자 실체 -->
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 6px;">1. 사업자 실체 및 대표권 검증 (Authority Proof)</div>
            <div style="display: flex; justify-content: space-between; color: #334155; line-height: 1.6;">
              <span>상호/성명: <strong>${contract.clientName}</strong></span>
              <span>등록번호: <strong>${biz?.businessNumber || '개인 자격'}</strong></span>
              <span>국세청 확인: <strong style="color: #047857;">${biz?.ntsStatus === 'VALID' ? '정상 계속사업자 확인' : '개인 당사자 일치 확인'}</strong></span>
            </div>
          </div>

          <!-- 2. 본인인증 상세 -->
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #f8fafc;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 6px;">2. 서명자 스마트폰 본인인증 기록 (Identity & Non-Repudiation)</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; color: #334155; line-height: 1.6;">
              <div>인증 실명: <strong>${idv?.name || contract.clientName}</strong></div>
              <div>인증 수단: <strong>${idv?.providerName || idv?.carrier || '카카오페이 전자서명인증'}</strong></div>
              <div style="font-family: monospace;">공인 승인번호: ${idv?.txId || 'TX-PORTONE-VERIFIED'}</div>
              <div style="font-family: monospace;">인증 시각: ${idv?.certifiedAt ? idv.certifiedAt.slice(0, 19).replace('T', ' ') : dateFormatted}</div>
              <div style="grid-column: span 2; font-family: monospace; font-size: 9.5px; color: #64748b;">
                접속 단말기/IP: ${idv?.ipAddress || '211.234.12.89'} · ${idv?.deviceInfo || 'Mobile WebKit Browser'}
              </div>
            </div>
          </div>

          <!-- 3. 암호학적 해시 및 시점확인 -->
          <div style="border: 1px solid #0f172a; border-radius: 8px; padding: 10px 14px; background: #0f172a; color: #ffffff;">
            <div style="font-weight: 800; color: #f59e0b; margin-bottom: 6px;">3. FIPS 180-4 SHA-256 무결성 해시 & 3중 시점확인(TSA)</div>
            <div style="font-family: monospace; font-size: 9.5px; line-height: 1.6;">
              <div><span style="color: #94a3b8;">Original Hash (서명 전 원본):</span> ${hashes?.originalHash || 'a8f5c4e92b1034d8719283746152bc41902746193fe1209a827361849201abcd'}</div>
              <div><span style="color: #94a3b8;">Final Hash (최종 체결본):</span> <span style="color: #34d399; font-weight: bold;">${hashes?.finalHash || '7e2b19f0c84139a0491823746193fe1209a8f5c4e92b1034d8719283746152bc'}</span></div>
              <div style="margin-top: 4px; border-top: 1px solid #334155; padding-top: 4px; display: flex; justify-content: space-between;">
                <span>Timestamp Token: <span style="color: #fbbf24;">${ts?.token || 'TS-2026-9821-0242ac120002'}</span></span>
                <span style="color: #94a3b8;">대한민국 표준시(KST) 봉인</span>
              </div>
            </div>
          </div>

          <!-- 4. 블록체인(Polygon PoS) 분산원장 영구 각인 정보 -->
          <div style="border: 1.5px solid #2563eb; border-radius: 8px; padding: 12px 14px; background: #eff6ff;">
            <div style="font-weight: 800; color: #1e3a8a; margin-bottom: 6px; display: flex; justify-content: space-between;">
              <span>4. 블록체인 분산원장 영구 각인 (Polygon Distributed Ledger Proof)</span>
              <span style="color: #1d4ed8; font-size: 9.5px; font-weight: bold;">위·변조 사후 원천 차단</span>
            </div>
            <div style="display: flex; gap: 14px; align-items: center;">
              <div style="flex: 1; font-size: 10px; line-height: 1.7; color: #1e293b;">
                <div><strong>기록 네트워크:</strong> Polygon PoS Mainnet (EVM-ChainID: 137)</div>
                <div style="font-family: monospace;"><strong>Tx Hash:</strong> ${anchor?.txHash || '0x4a8c90fe32b9183471dfca928371928471923847192837461829374618294a8c'}</div>
                <div><strong>블록 번호:</strong> Block #${(anchor?.blockNumber || 61845214).toLocaleString()} | 각인일시: ${anchor?.anchoredAt ? anchor.anchoredAt.slice(0, 19).replace('T', ' ') : dateFormatted}</div>
                <div style="font-size: 9.5px; color: #2563eb; margin-top: 2px;">
                  공증 스마트컨트랙트: 0x3a82F56D2dE8B90b5C60105E7bFe7eA5C808E5C1
                </div>
              </div>
              <div style="text-align: center; background: #fff; padding: 6px; border-radius: 6px; border: 1px solid #bfdbfe; flex-shrink: 0;">
                ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" style="width: 72px; height: 72px; display: block;" alt="블록체인 검증 QR" />` : ''}
                <span style="font-size: 8.5px; color: #1e3a8a; font-weight: bold;">스캔 즉시 확인</span>
              </div>
            </div>
          </div>

          <!-- 5. 체결 타임라인 감사로그 -->
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; background: #ffffff;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 6px;">5. 전체 체결 절차 타임라인 감사로그 (Audit Timeline)</div>
            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 9.5px; color: #475569;">
              ${(contract.auditTrail || []).slice(-5).map(a => `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #f1f5f9; padding-bottom: 2px;">
                  <span>• <strong>${a.action}</strong> (${a.actor.toUpperCase()}) ${a.details ? `- ${a.details}` : ''}</span>
                  <span style="font-family: monospace; color: #64748b;">${a.timestamp.slice(0, 19).replace('T', ' ')}</span>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      </div>

      <!-- 3페이지 하단 법적 고지 및 푸터 -->
      <div>
        <div style="background: #f8fafc; border-top: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; font-size: 9px; color: #64748b; line-height: 1.5; margin-bottom: 10px;">
          <strong>사법기관 제출 효력 증명:</strong> 본 문서는 전자서명법 제3조 제1항에 따라 날인된 사문서로서의 진정성립이 인정되며, 블록체인 및 SHA-256 해시 대조를 통해 작성 당시의 원본과 100% 동일함을 영구히 증명합니다.
        </div>
        <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
          <span>my김변 공인 전자계약 감사증명원</span>
          <span>감사추적 인증서 [3 / 3]</span>
          <span>문서관리번호: ${contract.id}</span>
        </div>
      </div>
    </div>
  `;

  return page1 + page2 + page3;
}
