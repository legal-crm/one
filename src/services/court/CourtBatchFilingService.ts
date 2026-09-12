/**
 * 법원 전자소송 순서정렬 일괄 PDF 결합 및 대법원 규격 채권자 CSV 추출 서비스
 * 서울회생법원 및 대법원 전자소송 포털 제출 기준
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import type { RepaymentCreditor, RepaymentPlanData } from '../repayment/repaymentTypes';

export interface FilingDocumentSlot {
  order: number;
  code: string;
  title: string;
  category: 'CORE_FORM' | 'EVIDENCE' | 'ID_VERIFICATION' | 'POWER_OF_ATTORNEY';
  isRequired: boolean;
  file?: {
    name: string;
    dataUrl?: string;
    bytes?: Uint8Array;
    mimeType?: string;
  };
  status: 'READY' | 'MISSING' | 'OPTIONAL_SKIPPED';
  notes?: string;
}

// 개인회생 14종 법원 표준 제출 순서 규격
export const REHAB_14_STANDARD_ORDER: Omit<FilingDocumentSlot, 'file' | 'status'>[] = [
  { order: 1, code: 'R01', title: '01. 채무자 주민등록초본 (말소 및 주소변동 전체 포함)', category: 'ID_VERIFICATION', isRequired: true },
  { order: 2, code: 'R02', title: '02. 가족관계증명서 (상세) 및 혼인관계증명서', category: 'ID_VERIFICATION', isRequired: true },
  { order: 3, code: 'R03', title: '03. 예금계좌사본 (환급금 수령용 본인명의 계좌)', category: 'ID_VERIFICATION', isRequired: true },
  { order: 4, code: 'R04', title: '04. 개인회생채권자목록 (원금 및 개시전이자 분리)', category: 'CORE_FORM', isRequired: true },
  { order: 5, code: 'R05', title: '05. 채권자목록 소명자료 (부채증명서 및 채권양도통지서)', category: 'EVIDENCE', isRequired: true },
  { order: 6, code: 'R06', title: '06. 재산목록 (부동산, 임차보증금, 차량, 예금, 보험 등)', category: 'CORE_FORM', isRequired: true },
  { order: 7, code: 'R07', title: '07. 재산목록 소명자료 (지적전산자료, 자동차등록원부, 해약환급금 등)', category: 'EVIDENCE', isRequired: true },
  { order: 8, code: 'R08', title: '08. 수입 및 지출에 관한 목록 (가용소득 산출표)', category: 'CORE_FORM', isRequired: true },
  { order: 9, code: 'R09', title: '09. 수입지출 소명자료 (원천징수영수증, 급여통장 1년, 종합소득세)', category: 'EVIDENCE', isRequired: true },
  { order: 10, code: 'R10', title: '10. 진술서 (채무발생 경위 및 과거 면책/회생 이력)', category: 'CORE_FORM', isRequired: true },
  { order: 11, code: 'R11', title: '11. 진술서 소명자료 (폐업사실증명원, 진단서 등)', category: 'EVIDENCE', isRequired: false },
  { order: 12, code: 'R12', title: '12. 변제계획안 (D5110 / D5111 표준 변제표)', category: 'CORE_FORM', isRequired: true },
  { order: 13, code: 'R13', title: '13. 필수자료제출목록 (서울회생법원 실무준칙 양식)', category: 'CORE_FORM', isRequired: true },
  { order: 14, code: 'R14', title: '14. 소송위임장 및 대한변협 경유증표', category: 'POWER_OF_ATTORNEY', isRequired: true },
];

// ══════════════════════════════════════════════════════════════════
// 매뉴얼 7-1 준용: 법원 전자소송 제출용 「7대 그룹 묶음(Bundle) PDF」 표준 규격
// ══════════════════════════════════════════════════════════════════
export interface FilingBundleItem {
  bundleOrder: number;
  bundleCode: string;
  bundleFileName: string;       // 전자소송 표준 파일명 (예: "최신 주민등록초본.pdf")
  title: string;                // 표시 제목
  description: string;          // 포함 서류 설명
  sourceKeywords: string[];     // 자동 매칭 키워드
  slotCodes: string[];          // REHAB_14 슬롯 매핑
  isRequired: boolean;
}

export const REHAB_7_BUNDLE_SPEC: FilingBundleItem[] = [
  {
    bundleOrder: 1,
    bundleCode: 'BUNDLE_01_RESIDENT',
    bundleFileName: '최신 주민등록초본.pdf',
    title: '1. 주민등록등본 및 초본',
    description: '최신 주민등록초본(말소 및 주소변동 전체 포함) 및 등본',
    sourceKeywords: ['초본', '등본', '주민등록'],
    slotCodes: ['R01'],
    isRequired: true,
  },
  {
    bundleOrder: 2,
    bundleCode: 'BUNDLE_02_FAMILY',
    bundleFileName: '가족관계증명서 혼인관계증명서.pdf',
    title: '2. 가족관계증명서 및 혼인관계증명서',
    description: '가족관계증명서(상세) 및 혼인관계증명서(상세) (제3자 주민번호 뒷자리 마스킹 필수)',
    sourceKeywords: ['가족관계', '혼인관계'],
    slotCodes: ['R02'],
    isRequired: true,
  },
  {
    bundleOrder: 3,
    bundleCode: 'BUNDLE_03_BANK_ACCOUNT',
    bundleFileName: '신청인 본인의 예금계좌 사본.pdf',
    title: '3. 신청인 본인의 예금계좌 사본',
    description: '환급금 수령용 신청인 본인 명의 계좌 사본 (통장 표지/모바일 통장사본)',
    sourceKeywords: ['계좌', '통장사본', '환급계좌'],
    slotCodes: ['R03'],
    isRequired: true,
  },
  {
    bundleOrder: 4,
    bundleCode: 'BUNDLE_04_DEBT_CERT',
    bundleFileName: '채권자 보유 소명자료.pdf',
    title: '4. 채권자 보유 소명자료 (부채증명서철)',
    description: '금융기관별 부채증명서 원본 및 채권양도통지서 일체',
    sourceKeywords: ['부채증명', '채권자', '양도통지'],
    slotCodes: ['R05'],
    isRequired: true,
  },
  {
    bundleOrder: 5,
    bundleCode: 'BUNDLE_05_ASSET_EVIDENCE',
    bundleFileName: '재산 목록 소명자료.pdf',
    title: '5. 재산 목록 소명자료',
    description: '금융거래내역서, 계좌정보통합관리원(어카운트인포), 보험해약환급금, 지방세 세목별과세증명서, 지적전산자료(K-Geo), 자동차등록원부, 부동산등기부 등',
    sourceKeywords: ['재산', '보험', '어카운트인포', '과세증명', '자동차', '등기', '지적', '임대차', '계좌내역'],
    slotCodes: ['R07'],
    isRequired: true,
  },
  {
    bundleOrder: 6,
    bundleCode: 'BUNDLE_06_INCOME_EVIDENCE',
    bundleFileName: '거주자의 수입 및 지출에 관한 목록 소명 자료.pdf',
    title: '6. 거주자의 수입 및 지출에 관한 목록 소명 자료',
    description: '재직증명서, 근로계약서, 근로소득원천징수영수증, 소득금액증명원, 최근 1년 급여명세/급여통장, 건강보험자격득실, 부가세과세표준(사업소득) 등',
    sourceKeywords: ['소득', '재직', '원천징수', '급여', '건강보험자격', '부가세', '수입지출', '사업소득'],
    slotCodes: ['R09'],
    isRequired: true,
  },
  {
    bundleOrder: 7,
    bundleCode: 'BUNDLE_07_STATEMENT_EVIDENCE',
    bundleFileName: '진술서 소명자료.pdf',
    title: '7. 진술서 소명자료',
    description: '무상거주사실확인서, 국민기초생활수급자증명서, 장애인증명서, 진료비영수증/진단서, 폐업사실증명원 등',
    sourceKeywords: ['진술서', '무상거주', '수급자', '장애인', '진료비', '진단서', '폐업'],
    slotCodes: ['R11'],
    isRequired: false,
  },
];

// 개인파산·면책 10종 법원 표준 제출 순서 규격
export const BANKRUPTCY_10_STANDARD_ORDER: Omit<FilingDocumentSlot, 'file' | 'status'>[] = [
  { order: 1, code: 'B01', title: '01. 개인파산 및 면책신청서', category: 'CORE_FORM', isRequired: true },
  { order: 2, code: 'B02', title: '02. 파산 진술서 (채무증대 경위 및 면책불허가사유 점검)', category: 'CORE_FORM', isRequired: true },
  { order: 3, code: 'B03', title: '03. 진술서 소명자료 (질병 진단서, 폐업증명서 등)', category: 'EVIDENCE', isRequired: false },
  { order: 4, code: 'B04', title: '04. 채권자목록 (비면책채권 구분 표기)', category: 'CORE_FORM', isRequired: true },
  { order: 5, code: 'B05', title: '05. 채권자목록 소명자료 (부채증명서 원본)', category: 'EVIDENCE', isRequired: true },
  { order: 6, code: 'B06', title: '06. 재산목록 (1,110만 원 생계비 및 소액보증금 공제 반영)', category: 'CORE_FORM', isRequired: true },
  { order: 7, code: 'B07', title: '07. 현재의 생활상황표 (동거가족 및 필수 생활비)', category: 'CORE_FORM', isRequired: true },
  { order: 8, code: 'B08', title: '08. 수입 및 지출에 관한 목록 (가계수지표, 가용소득 0원 입증)', category: 'CORE_FORM', isRequired: true },
  { order: 9, code: 'B09', title: '09. 15개 필수자료제출목록 및 미제출 사유서', category: 'CORE_FORM', isRequired: true },
  { order: 10, code: 'B10', title: '10. 소송위임장 및 경유증표', category: 'POWER_OF_ATTORNEY', isRequired: true },
];

/** Data URL -> Uint8Array 변환 헬퍼 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(',');
  const base64 = parts[1] || parts[0];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class CourtBatchFilingService {
  /**
   * 1. 전자소송 정규 순서 단일 PDF 일괄 결합 (Merge PDF)
   */
  static async mergeCourtFilingPdf(
    slots: FilingDocumentSlot[],
    caseTitle: string,
    clientName: string
  ): Promise<Uint8Array> {
    const mergedPdf = await PDFDocument.create();
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica);

    for (const slot of slots) {
      if (slot.file?.dataUrl && slot.file.dataUrl.includes('application/pdf')) {
        try {
          const pdfBytes = dataUrlToUint8Array(slot.file.dataUrl);
          const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
          copiedPages.forEach(page => mergedPdf.addPage(page));
          continue;
        } catch (e) {
          console.warn(`[BatchFiling] PDF 병합 실패: ${slot.title}`, e);
        }
      }

      // PDF가 없거나 이미지인 경우, 또는 서류 간지(Cover Sheet) 삽입
      const page = mergedPdf.addPage([595.28, 841.89]); // A4 규격
      const { width, height } = page.getSize();

      // 상단 법원 양식 헤더
      page.drawRectangle({
        x: 40,
        y: height - 100,
        width: width - 80,
        height: 60,
        borderColor: rgb(0.2, 0.3, 0.5),
        borderWidth: 1.5,
        color: rgb(0.96, 0.97, 0.99),
      });

      page.drawText(`[COURT ELECTRONIC SUBMISSION - SLOT #${slot.order}]`, {
        x: 55,
        y: height - 65,
        size: 11,
        font,
        color: rgb(0.15, 0.25, 0.45),
      });

      page.drawText(`${slot.code}: ${slot.title}`, {
        x: 55,
        y: height - 85,
        size: 13,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });

      // 중앙 안내 박스
      page.drawRectangle({
        x: 40,
        y: 200,
        width: width - 80,
        height: 480,
        borderColor: rgb(0.85, 0.85, 0.88),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      page.drawText(`CASE: ${caseTitle}`, {
        x: 60,
        y: 640,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText(`DEBTOR: ${clientName}`, {
        x: 60,
        y: 615,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText(`DOCUMENT STATUS: ${slot.status === 'READY' ? 'SUBMITTED' : 'ATTACHED_SEPARATELY'}`, {
        x: 60,
        y: 580,
        size: 12,
        font,
        color: slot.status === 'READY' ? rgb(0.1, 0.6, 0.2) : rgb(0.8, 0.4, 0.1),
      });

      page.drawText(`This sheet certifies that Document Slot #${slot.order} is filed in standard sequence.`, {
        x: 60,
        y: 530,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });

      // 하단 법원 규격 워터마크
      page.drawText(`Republic of Korea Court Electronic Filing Packaging System`, {
        x: width / 2 - 140,
        y: 40,
        size: 9,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    return await mergedPdf.save();
  }

  /**
   * 2. 대법원 전자소송 순서별 개별 PDF ZIP 일괄 압축
   */
  static async createFilingZip(
    slots: FilingDocumentSlot[],
    clientName: string
  ): Promise<Blob> {
    const zip = new JSZip();
    const folder = zip.folder(`전자소송제출_${clientName}_${new Date().toISOString().split('T')[0]}`) || zip;

    for (const slot of slots) {
      const paddedOrder = String(slot.order).padStart(2, '0');
      const cleanTitle = slot.title.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 30);
      const filename = `${paddedOrder}_${cleanTitle}_${clientName}.pdf`;

      if (slot.file?.dataUrl) {
        const bytes = dataUrlToUint8Array(slot.file.dataUrl);
        folder.file(filename, bytes);
      } else {
        // 단독 요약 텍스트 간지 파일
        folder.file(`${paddedOrder}_${cleanTitle}_간지.txt`, `[대법원 전자소송 제출용]\n서류번호: ${slot.order}\n서류명: ${slot.title}\n신청인: ${clientName}\n상태: 별도 제출 또는 소명 완료\n`);
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * 3. 대법원 전자소송 채권자목록 엑셀/CSV 일괄등록 변환 (UTF-8 BOM 지원)
   * 대법원 전자소송 사이트의 엑셀 일괄등록 양식 컬럼 100% 일치
   */
  static generateCourtCreditorCsv(
    creditors: RepaymentCreditor[],
    debtorName: string
  ): string {
    const headers = [
      '순번',
      '채권자명',
      '사업자/주민번호',
      '대표자',
      '우편번호',
      '주소',
      '송달장소',
      '차용원인',
      '차용일자',
      '원금(원)',
      '개시전이자(원)',
      '합계(원)',
      '우선권여부',
      '별제권_담보여부',
      '비고'
    ];

    const rows = creditors.map((c, idx) => {
      const seq = idx + 1;
      const name = `"${(c.name || '').replace(/"/g, '""')}"`;
      const bizNo = `"${(c.bizNumber || '').replace(/"/g, '""')}"`;
      const rep = `"${(c.representative || '').replace(/"/g, '""')}"`;
      const zip = `"${(c.zipCode || '').replace(/"/g, '""')}"`;
      const addr = `"${(c.address || '').replace(/"/g, '""')}"`;
      const serviceAddr = `"${(c.serviceAddress || c.address || '').replace(/"/g, '""')}"`;
      const cause = `"${(c.debtCauseDetail || (c.isPriority ? '조세 및 공과금 체납' : '대여금 / 신용대출')).replace(/"/g, '""')}"`;
      const date = `"${c.borrowedDate || '2024-01-01'}"`;
      const principal = Math.round(c.principal || 0);
      const interest = Math.round(c.interest || 0);
      const total = principal + interest;
      const isPriority = c.isPriority ? '우선' : '일반';
      const isSecured = c.isSecured ? '담보' : '신용';
      const memo = `"${(c.isUnconfirmed ? '미확정채권 ' : '') + (c.isPriority ? '일반의우선권채권' : '')}"`;

      return [
        seq,
        name,
        bizNo,
        rep,
        zip,
        addr,
        serviceAddr,
        cause,
        date,
        principal,
        interest,
        total,
        isPriority,
        isSecured,
        memo
      ].join(',');
    });

    // UTF-8 BOM (\uFEFF)을 포함하여 엑셀에서 한글 깨짐 방지
    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * 3. 법원 매뉴얼(7-1) 준용: 전자소송 7대 묶음(Bundle) PDF 일괄 결합 및 ZIP 압축
   */
  static async exportCourt7BundleZip(
    slots: FilingDocumentSlot[],
    clientName: string,
    uploadedFiles: any[] = []
  ): Promise<Blob> {
    const zip = new JSZip();
    const folder = zip.folder(`[전자소송7대묶음]_개인회생_${clientName}`);

    for (const bundle of REHAB_7_BUNDLE_SPEC) {
      // 해당 번들에 매칭되는 슬롯 서류 및 업로드 파일 수집
      const matchedSlots = slots.filter(s => bundle.slotCodes.includes(s.code) && s.file);
      const matchedUploads = uploadedFiles.filter(u => {
        const uName = (u.name || '').toLowerCase();
        return bundle.sourceKeywords.some(kw => uName.includes(kw.toLowerCase()));
      });

      const bundlePdf = await PDFDocument.create();
      const font = await bundlePdf.embedFont(StandardFonts.Helvetica);
      let hasPage = false;

      // 슬롯 파일 병합
      for (const slot of matchedSlots) {
        if (slot.file?.dataUrl && slot.file.dataUrl.includes('application/pdf')) {
          try {
            const bytes = dataUrlToUint8Array(slot.file.dataUrl);
            const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pages = await bundlePdf.copyPages(srcDoc, srcDoc.getPageIndices());
            pages.forEach(p => bundlePdf.addPage(p));
            hasPage = true;
          } catch (e) {
            console.warn(`[7대묶음] 슬롯 PDF 병합 실패: ${slot.title}`, e);
          }
        }
      }

      // 업로드 파일 중 아직 병합되지 않은 추가 서류 병합
      for (const file of matchedUploads) {
        if (file.dataUrl && file.dataUrl.includes('application/pdf')) {
          try {
            const bytes = dataUrlToUint8Array(file.dataUrl);
            const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pages = await bundlePdf.copyPages(srcDoc, srcDoc.getPageIndices());
            pages.forEach(p => bundlePdf.addPage(p));
            hasPage = true;
          } catch (e) {
            console.warn(`[7대묶음] 업로드 PDF 병합 실패: ${file.name}`, e);
          }
        }
      }

      // 첨부 서류가 없는 경우 법원 제출용 표준 간지(Cover Sheet) 삽입
      if (!hasPage) {
        const page = bundlePdf.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();

        // 상단 헤더 박스
        page.drawRectangle({
          x: 40,
          y: height - 120,
          width: width - 80,
          height: 70,
          borderColor: rgb(0.12, 0.23, 0.37),
          borderWidth: 1.5,
          color: rgb(0.96, 0.98, 1.0),
        });

        page.drawText(`[COURT ELECTRONIC FILING - BUNDLE #${bundle.bundleOrder}]`, {
          x: 55,
          y: height - 75,
          size: 10,
          font,
          color: rgb(0.15, 0.3, 0.55),
        });

        page.drawText(`${bundle.bundleFileName}`, {
          x: 55,
          y: height - 98,
          size: 14,
          font,
          color: rgb(0.08, 0.12, 0.2),
        });

        // 본문 안내 영역
        page.drawRectangle({
          x: 40,
          y: 200,
          width: width - 80,
          height: 480,
          borderColor: rgb(0.85, 0.88, 0.92),
          borderWidth: 1,
          color: rgb(1, 1, 1),
        });

        page.drawText(`DOCUMENT GROUP: ${bundle.title}`, {
          x: 60,
          y: 640,
          size: 12,
          font,
          color: rgb(0.1, 0.1, 0.1),
        });

        page.drawText(`APPLICANT: ${clientName}`, {
          x: 60,
          y: 615,
          size: 10,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });

        page.drawText(`DESCRIPTION: ${bundle.description}`, {
          x: 60,
          y: 585,
          size: 9,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });

        page.drawText(`* Electronic filing scan cover sheet for Seoul/District Court.`, {
          x: 60,
          y: 550,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const pdfBytes = await bundlePdf.save();
      folder?.file(bundle.bundleFileName, pdfBytes);
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /** CSV 브라우저 다운로드 헬퍼 */
  static downloadCsv(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** PDF 브라우저 다운로드 헬퍼 */
  static downloadPdf(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** ZIP 브라우저 다운로드 헬퍼 */
  static downloadZip(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
