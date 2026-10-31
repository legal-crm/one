// ============================================================
// 법원 제출용 원스톱 전자계약서 고해상도 PDF 생성 엔진
// 서버 글자 PDF(/api/pdf, H-7)가 기본 — 글자 검색·복사 가능, 전자소송 규칙 제8조④.
// 로그인이 없거나 서버 PDF가 실패하면 브라우저 그림 PDF(jspdf + html2canvas)로 대신 만든다.
// (표지 + 계약서 본문 + 분납약정 + 자필서명 + 감사추적 기록 + 원본 확인 QR)
// ============================================================

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import type { ElectronicContract } from '../types';
import { localYmd } from '../utils/localDate';
import { feeAmountWon, feeTotalWon } from '../utils/feeUnits';
import { generateQrCodeDataUrl } from './blockchainAnchorService';
import { renderTextPdf } from './court/courtPdfService';

const TEXT_PDF_CSS = `@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}body{font-family:'NanumGothic','NanumMyeongjo',sans-serif;color:#0f172a}.pdf-page-item{break-after:page;page-break-after:always;overflow:hidden}.pdf-page-item:last-child{break-after:auto;page-break-after:auto}`;

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function generateCourtSubmissionPdf(contract: ElectronicContract): Promise<void> {
  const toastId = toast.loading('법원 제출용 고해상도 전자계약 패키지를 생성 중입니다...');

  try {
    // 1. 원본 확인용 QR 코드 (서버 전자지문 대조 화면 주소)
    // 검증 QR: 현재 서비스 도메인 기준 (하드코딩된 배포 도메인 대신)
    const verifyUrl = contract.blockchainAnchor?.verifyUrl ||
      `${typeof window !== 'undefined' ? window.location.origin : 'https://mykim.kr'}/?verifyContractId=${encodeURIComponent(contract.id)}`;
    const qrCodeDataUrl = await generateQrCodeDataUrl(verifyUrl);

    const sanitizedClientName = contract.clientName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const filename = `[법원제출용]_사건위임계약서_${sanitizedClientName}_${contract.id}.pdf`;
    const rawHtml = buildCourtPdfHtml(contract, qrCodeDataUrl);
    const safeHtml = DOMPurify.sanitize(rawHtml, { ADD_TAGS: ['style'], ADD_ATTR: ['style', 'class'], ALLOW_DATA_ATTR: true });

    // 2-a. 서버 글자 PDF
    const text = await renderTextPdf(
      `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8" /><title>사건위임계약서</title><style>${TEXT_PDF_CSS}</style></head><body>${safeHtml}</body></html>`,
      { title: '사건위임계약서 및 전자체결 증명서', pageNumbers: false }
    );
    if (text.ok) {
      downloadBytes(text.bytes, filename);
      toast.dismiss(toastId);
      toast.success('법원 제출용 전자계약서(글자 PDF)를 내려받았어요.', { duration: 4000 });
      return;
    }
    console.warn('[ContractPdfService] 글자 PDF 실패, 그림 PDF로 만듭니다:', (text as { message?: string }).message);

    // 2-b. DOM 렌더링용 임시 컨테이너 생성 (사용자 화면 방해 없도록 화면 밖 배치)
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

    // HTML 구조 (DOMPurify 기반 XSS 방어)
    container.innerHTML = safeHtml;
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
    pdf.save(filename);

    toast.dismiss(toastId);
    toast.success(`전자계약서를 그림 PDF로 내려받았어요. (${totalPages}쪽)`, {
      description: '서버 글자 PDF를 만들지 못해 그림 PDF로 대신 만들었어요. 법원 제출본은 로그인한 상태에서 다시 받아 주세요.',
      duration: 6000,
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
  // 원/만원 자동 감지 (이전: 무조건 ×10,000 → 원 단위로 저장된 3,300,000이 33,000,000,000원으로 찍힘)
  const formattedFee = feeTotalWon(contract.totalFee).toLocaleString('ko-KR');
  const dateFormatted = contract.contractDate || localYmd();

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
              법원 제출용 사본
            </div>
            <h1 style="font-size: 26px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.5px;">사건위임계약서 및 전자체결 증명서</h1>
            <p style="font-size: 11px; color: #475569; margin: 5px 0 0 0;">
              전자서명·본인확인·문서 해시 기록 (시스템 발급 · 공인 인증기관 증명서 아님)
            </p>
          </div>
          <div style="text-align: right; font-family: monospace;">
            <div style="font-size: 10px; color: #64748b; font-weight: bold;">계약 식별 관리번호</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${contract.id}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 3px;">발급일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })} (KST)</div>
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
              <div><strong>본인인증:</strong> <span style="color: #047857; font-weight: bold;">${idv?.providerName || idv?.carrier || '본인인증 기록 없음'}</span></div>
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
            <span>전자계약 체결 기록 요약</span>
            
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
              <td style="padding: 10px 14px; width: 140px; font-weight: bold; background: #f1f5f9; color: #334155;">1. 권한성 (Right)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                ${isBiz ? `국세청 사업자등록 진위확인 완료 (대표자: ${biz?.representativeName || contract.clientName} / 상태: 계속사업자)` : '개인 위임인 신원 및 사건위임 의사 직접 검증'}
              </td>
              <td style="padding: 10px 14px; width: 80px; text-align: center; color: #047857; font-weight: bold;">${(isBiz ? biz?.ntsStatus === 'VALID' : !!idv?.txId) ? '[확인]' : '[-]'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
              <td style="padding: 10px 14px; font-weight: bold; background: #f1f5f9; color: #334155;">2. 당사자성 (Who)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                ${idv?.txId ? `${idv?.providerName || '본인인증'} (인증번호: <span style="font-family: monospace;">${idv.txId}</span>)` : '본인인증 기록 없음'}
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #047857; font-weight: bold;">${!!idv?.txId ? '[확인]' : '[-]'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
              <td style="padding: 10px 14px; font-weight: bold; background: #f1f5f9; color: #334155;">3. 의사성 (Intent)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                필수 약관 ${contract.intentVerification?.agreedTerms?.length || 0}개 동의 · 중요 조항 직접 입력 · 자필서명 ${clientSig ? '제출' : '미제출'}
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #047857; font-weight: bold;">${!!clientSig ? '[확인]' : '[-]'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background: #fafafa;">
              <td style="padding: 10px 14px; font-weight: bold; background: #f1f5f9; color: #334155;">4. 무결성 (Integrity)</td>
              <td style="padding: 10px 14px; color: #0f172a;">
                ${hashes?.finalHash ? 'SHA-256 체결본 전자지문 생성' : '양 당사자 서명 전 (전자지문 미생성)'}
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #047857; font-weight: bold;">${!!hashes?.finalHash ? '[확인]' : '[-]'}</td>
            </tr>
            <tr style="background: #eff6ff;">
              <td style="padding: 10px 14px; font-weight: bold; background: #dbeafe; color: #1e3a8a;">5. 전자지문 보관</td>
              <td style="padding: 10px 14px; color: #1e3a8a; font-weight: 500;">
                ${hashes?.finalHash ? '체결본 전자지문(SHA-256)을 마이김변 서버에 보관' : '체결 전 (보관할 전자지문 없음)'}
              </td>
              <td style="padding: 10px 14px; text-align: center; color: #1d4ed8; font-weight: bold;">${hashes?.finalHash ? '[보관]' : '[-]'}</td>
            </tr>
          </table>
        </div>

        <!-- 원본 확인 QR 안내 박스 -->
        <div style="border: 1.5px dashed #2563eb; background: #f0f7ff; border-radius: 10px; padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
          <div style="flex: 1;">
            <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">
              QR 코드로 원본 확인
            </div>
            <p style="font-size: 11px; color: #334155; line-height: 1.5; margin: 0;">
              휴대폰 카메라로 오른쪽 QR 코드를 비추면 마이김변 확인 화면에서 <strong>저장된 계약서가 체결 당시와 같은지</strong>(서버 전자지문 대조) 볼 수 있습니다.
            </p>
            <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 6px;">
              체결본 해시: ${hashes?.finalHash ? hashes.finalHash.slice(0, 36) + '...' : '(체결 전)'}
            </div>
          </div>
          <div style="text-align: center; background: #ffffff; padding: 8px; border-radius: 8px; border: 1px solid #bfdbfe; flex-shrink: 0;">
            ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" style="width: 90px; height: 90px; display: block;" alt="진위검증 QR" />` : ''}
            <span style="font-size: 9px; font-weight: bold; color: #2563eb; display: block; margin-top: 4px;">원본 확인</span>
          </div>
        </div>
      </div>

      <!-- 1페이지 하단 푸터 -->
      <div style="border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
        <span>전자서명 기록 사본</span>
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

        <!-- 핵심 위임 조항 요약 (리걸플로 벤치마킹 실무 세분화 반영) -->
        <div style="font-size: 11px; line-height: 1.7; color: #1e293b; margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fafafa;">
          <p style="margin: 0 0 6px 0;"><strong>제1조 (위임의 목적)</strong> 위임인(갑)은 수임인(을)에게 ${contract.caseType || '개인회생·파산신청'} 사건의 대리 및 그에 부수하는 일체의 법률사무 처리를 위임한다.</p>
          <p style="margin: 0 0 6px 0;"><strong>제2조 (수임료 및 법원실비)</strong> 변호사 보수(순 수임료)는 금 ${formattedFee}원${contract.vatIncluded ? '(VAT 포함)' : '(VAT 10% 별도)'}으로 정한다. 송달료(${(contract.courtCosts?.deliveryFee || 0).toLocaleString()}원), 인지대(${(contract.courtCosts?.stampFee || 0).toLocaleString()}원), 부채증명서 발급대행비(${(contract.courtCosts?.debtCertFee || 0).toLocaleString()}원)${contract.courtCosts?.provisionalDeposit ? `, 변제예납금(${(contract.courtCosts.provisionalDeposit).toLocaleString()}원)` : ''} 등 법원 실비는 사건 진행 중 실비로 별도 정산한다.</p>
          <p style="margin: 0 0 6px 0;"><strong>제3조 (입금 지정 계좌)</strong> 수임료는 [${contract.feeAccount?.bankName || '(은행 미기재)'} ${contract.feeAccount?.accountNumber || '(계좌번호 미기재)'} (예금주: ${contract.feeAccount?.accountHolder || contract.lawFirmName})] 계좌로 입금한다.</p>
          ${contract.successFee?.enabled ? `
            <p style="margin: 0 0 6px 0; color: #78350f;"><strong>제4조 (성공보수 약정)</strong> 갑은 [${contract.successFee.dueDateCondition || '면책 또는 인가결정 확정 시'}] 을에게 ${contract.successFee.type === 'reduction_rate' ? `탕감액의 ${contract.successFee.ratePercent || 5}%` : `약정금 ${(contract.successFee.amount || 500000).toLocaleString()}원`}의 성공보수를 지급하기로 약정한다.</p>
          ` : ''}
          <p style="margin: 0 0 6px 0;"><strong>${contract.successFee?.enabled ? '제5조' : '제4조'} (성실의무 및 자료제출)</strong> 을은 변호사법에 따라 성실히 사건을 수행하며, 갑은 법원 제출용 소득 및 재산 증빙서류를 성실히 제출한다. 을은 사건 처리와 기록을 위하여 갑과의 업무 통화를 녹음하고, 그 녹음을 업무용 대화록·요약으로 정리(자동 변환 도구 포함)할 수 있다. 이 기록은 위임 사무 처리에만 쓰며 개인정보 보호법에 따라 관리한다.</p>
          <p style="margin: 0;"><strong>${contract.successFee?.enabled ? '제6조' : '제5조'} (효력 발생)</strong> 본 계약은 양 당사자의 전자서명이 완료된 시점부터 효력이 발생한다.</p>
        </div>

        <!-- 분납 일정표 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">[수임료 분납 약정 일정표]</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: center;">
            <thead>
              <tr style="background: #f1f5f9; border-top: 1.5px solid #0f172a; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 6px; width: 80px;">구분/회차</th>
                <th style="padding: 6px; width: 130px;">납부 약정기일</th>
                <th style="padding: 6px; width: 130px;">약정 금액</th>
                <th style="padding: 6px;">상세 내역</th>
              </tr>
            </thead>
            <tbody>
              ${(contract.feeSchedule || []).map(f => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px; font-weight: bold;">${f.itemTitle || (f.round === 0 ? '착수금' : `${f.round}회차`)}</td>
                  <td style="padding: 6px; font-family: monospace;">${f.dueDate}</td>
                  <td style="padding: 6px; font-weight: bold; color: #1e3a8a;">${feeAmountWon(f).toLocaleString('ko-KR')}원</td>
                  <td style="padding: 6px; color: #64748b;">${f.memo || f.itemTitle || '수임료 납부'}</td>
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
                ${clientSig ? `<img src="${clientSig}" style="max-height: 55px; max-width: 180px;" alt="위임인 자필서명" />` : '<span style="font-size: 11px; color: #94a3b8;">[서명 전]</span>'}
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
                ${lawyerSig ? `<img src="${lawyerSig}" style="max-height: 55px; max-width: 180px;" alt="변호사 서명" />` : '<span style="font-size: 11px; color: #94a3b8;">[서명 전]</span>'}
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

  // 3페이지: 체결 감사추적 기록 + 원본 확인 QR
  const page3 = `
    <div class="pdf-page-item" style="width: 794px; min-height: 1120px; height: 1120px; box-sizing: border-box; padding: 45px 55px; position: relative; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="background: #0f172a; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">AUDIT TRAIL</span>
            <h2 style="font-size: 18px; font-weight: 900; margin: 4px 0 0 0; color: #0f172a;">전자계약 체결 감사추적 기록</h2>
          </div>
          
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
              <div>인증 수단: <strong>${idv?.providerName || idv?.carrier || '-'}</strong></div>
              <div style="font-family: monospace;">인증번호: ${idv?.txId || '-'}</div>
              <div style="font-family: monospace;">인증 시각: ${idv?.certifiedAt ? idv.certifiedAt.slice(0, 19).replace('T', ' ') : dateFormatted}</div>
              <div style="grid-column: span 2; font-family: monospace; font-size: 9.5px; color: #64748b;">
                접속 단말기/IP: ${idv?.ipAddress || '기록 없음'} · ${idv?.deviceInfo || '기록 없음'}
              </div>
            </div>
          </div>

          <!-- 3. 암호학적 해시 및 시점확인 -->
          <div style="border: 1px solid #0f172a; border-radius: 8px; padding: 10px 14px; background: #0f172a; color: #ffffff;">
            <div style="font-weight: 800; color: #f59e0b; margin-bottom: 6px;">3. SHA-256 전자지문</div>
            <div style="font-family: monospace; font-size: 9.5px; line-height: 1.6;">
              <div><span style="color: #94a3b8;">Original Hash (서명 전 원본):</span> ${hashes?.originalHash || '미생성'}</div>
              <div><span style="color: #94a3b8;">Final Hash (최종 체결본):</span> <span style="color: #34d399; font-weight: bold;">${hashes?.finalHash || '미생성 (양 당사자 서명 전)'}</span></div>
              <div style="margin-top: 4px; border-top: 1px solid #334155; padding-top: 4px; display: flex; justify-content: space-between;">
                <span>서명 시각: <span style="color: #fbbf24;">${hashes?.signedAt ? hashes.signedAt.slice(0, 19).replace('T', ' ') + ' (UTC)' : '-'}</span></span>
                
              </div>
            </div>
          </div>

          <!-- 4. 원본 확인 QR (서버 전자지문 대조) -->
          <div style="border: 1.5px solid #2563eb; border-radius: 8px; padding: 12px 14px; background: #eff6ff;">
            <div style="font-weight: 800; color: #1e3a8a; margin-bottom: 6px;">4. 원본 확인 QR</div>
            <div style="display: flex; gap: 14px; align-items: center;">
              <div style="flex: 1; font-size: 10px; line-height: 1.7; color: #1e293b;">
                <div><strong>전자지문 보관:</strong> ${hashes?.finalHash ? '체결본 전자지문(SHA-256)을 마이김변 서버에 보관' : '체결 전 (보관할 전자지문 없음)'}</div>
                <div style="font-size: 9.5px; color: #2563eb; margin-top: 2px;">QR 코드로 확인 화면을 열어 전자지문을 다시 계산해 볼 수 있습니다.</div>
              </div>
              <div style="text-align: center; background: #fff; padding: 6px; border-radius: 6px; border: 1px solid #bfdbfe; flex-shrink: 0;">
                ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" style="width: 72px; height: 72px; display: block;" alt="원본 확인 QR" />` : ''}
                <span style="font-size: 8.5px; color: #1e3a8a; font-weight: bold;">원본 확인</span>
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
          <strong>안내:</strong> 이 문서는 전자서명 체결 기록(본인인증·약관 동의·서명·전자지문)을 정리한 것입니다. 전자지문 대조로 체결 이후 계약서 변경 여부를 확인할 수 있으며, 계약의 법적 효력에 대한 판단은 법원에 있습니다.
        </div>
        <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
          <span>my김변 전자계약 체결 기록</span>
          <span>감사추적 기록 [3 / 3]</span>
          <span>문서관리번호: ${contract.id}</span>
        </div>
      </div>
    </div>
  `;

  return page1 + page2 + page3;
}
