/**
 * 법원 전자소송 순서정렬 일괄 PDF 결합 및 대법원 규격 채권자 CSV 추출 서비스
 * 서울회생법원 및 대법원 전자소송 포털 실제 접수본(14단계 표준 편철 순서) 100% 일치
 */
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import type { RepaymentCreditor, RepaymentPlanData } from '../repayment/repaymentTypes';
import { 
  type CourtFormDataContext 
} from './CourtFormHtmlBuilder';
import { buildBankruptcyCreditorCsv, buildRehabCreditorCsv } from './eFilingCsv';
import { encodeCp949 } from '../../utils/cp949';
import { generateCourtOfficialFormPdf } from './CourtFormPdfGenerator';
import { 
  splitPdfIfNeeded, 
  formatFileSize, 
  COURT_FILE_SIZE_LIMIT, 
  COURT_TOTAL_SIZE_LIMIT 
} from '../pdfQualityService';

export interface FilingFileItem {
  name: string;
  /** 비공개 저장소 경로 (본문이 없으면 묶기 전에 내려받는다) */
  storagePath?: string;
  dataUrl?: string;
  bytes?: Uint8Array;
  mimeType?: string;
}

export interface FilingDocumentSlot {
  order: number;
  code: string;
  title: string;
  category: 'CORE_FORM' | 'EVIDENCE' | 'ID_VERIFICATION' | 'POWER_OF_ATTORNEY';
  isRequired: boolean;
  file?: FilingFileItem;
  files?: FilingFileItem[];
  status: 'READY' | 'MISSING' | 'OPTIONAL_SKIPPED';
  notes?: string;
}

/** 법원 전자기록 뷰어 1:1 매칭 제출 패키지 매니페스트 항목 */
export interface FilingPackageManifestItem {
  order: number;
  code: string;
  title: string;
  category: string;
  fileName: string;
  sizeBytes: number;
  sizeFormatted: string;
  pageCount?: number;
  isSplit?: boolean;
  pageRange?: string;
  isDigitalPdf?: boolean;
  status: 'READY' | 'MISSING' | 'GENERATED';
}

/** 법원 전자소송 제출 패키지 빌드 결과 */
export interface FilingPackageResult {
  zipBlob: Blob;
  manifest: FilingPackageManifestItem[];
  totalSizeBytes: number;
  totalSizeFormatted: string;
  totalFiles: number;
  hasSplitFiles: boolean;
  isWithinCourtLimit: boolean; // total <= COURT_TOTAL_SIZE_LIMIT
}

// ══════════════════════════════════════════════════════════════════
// 슬롯별 의뢰인 업로드 서류 스마트 매칭 키워드 사전
// ══════════════════════════════════════════════════════════════════
export const SLOT_KEYWORDS_MAP: Record<string, string[]> = {
  R00: ['개시신청서', '신청서', '표지', '정보수신', '환급계좌', '통장사본', '계좌사본'],
  R01: ['등본', '초본', '주민등록', '말소', '주소변동', '전입'],
  R02: ['가족관계', '혼인관계', '가족', '혼인', '제적등본', '기본증명', '상세'],
  R03: ['채권자목록', '채권목록', '총괄표'],
  R04: ['부채증명', '부채증명서', '채권양도', '대출잔액', '부채확인', '채무확인', '금융거래확인'],
  R05: ['재산목록', 'd5102', '청산가치'],
  R06: ['과세증명', '지방세', '세목별', '지적전산', 'k-geo', '토지', '보험', '해약환급금', '어카운트인포', '계좌정보', '통장거래', '거래내역', '차량', '자동차', '등록원부', '임대차', '부동산', '등기부', '잔액증명'],
  R07: ['수입및지출', '수입지출', 'd5103', '가용소득'],
  R08: ['재직증명', '원천징수', '급여', '급여통장', '건강보험자격', '국민연금', '부가세', '소득금액', '사업소득', '근로소득', '급여명세'],
  R09: ['진술서', '무상거주', '거주사실', '수급자', '차상위', '한부모', '장애인', '진료비', '진단서', '폐업사실'],
  R10: ['변제계획안', '변제예정액', 'd5110'],
  R11: ['금지명령', '중지명령'],
  R12: ['위임장', '소송위임장', '경유확인', '변협', '경유증표'],
  R13: ['필수자료', '자료제출목록', '실무준칙'],
  // 개인파산 슬롯 키워드
  B01: ['파산신청', '면책신청', '개인파산'],
  B02: ['파산진술서', '진술서'],
  B03: ['소명자료', '폐업', '진료', '진단서', '부채소명'],
  B04: ['채권자목록', '파산채권'],
  B05: ['부채증명', '채무증명'],
  B06: ['재산목록', '생계비'],
  B07: ['생활상황표', '동거가족'],
  B08: ['가계수지표', '수입지출'],
  B09: ['자료제출목록', '필수자료'],
  B10: ['위임장', '소송위임장'],
};

/**
 * 3단계 서류 체크리스트 항목 → 회생 편철 칸 (DP-5). 접수본 순서 기준:
 * 신청서(환급 통장) → 주민등록 → 가족관계 → 채권자목록 소명 → 재산 소명 → 소득 소명 → 진술서 첨부 → 변제계획 → 금지명령 → 위임장
 */
export const CHECKLIST_TO_REHAB_SLOT: Record<string, string> = {
  'rs-p1-1': 'R01', 'rs-p1-2': 'R01',
  'rs-p1-3': 'R02', 'rs-p1-4': 'R02',
  'rs-p1-6': 'R12', 'rs-p1-7': 'R12', 'rs-p2-36': 'R12',
  'rs-p2-9': 'R00',
  'rs-p2-25': 'R04',
  'rs-p1-8': 'R06', 'rs-p1-9': 'R06', 'rs-p2-1': 'R06', 'rs-p2-2': 'R06', 'rs-p2-3': 'R06', 'rs-p2-6': 'R06',
  'rs-p2-7': 'R06', 'rs-p2-28': 'R06', 'rs-p2-29': 'R06', 'rs-p2-30': 'R06', 'rs-p2-31': 'R06', 'rs-p2-32': 'R06',
  'rs-p2-10': 'R06', 'rs-p2-12': 'R06', 'rs-p2-21': 'R06', 'rs-p2-22': 'R06', 'rs-p2-23': 'R06', 'rs-p2-24': 'R06', 'rs-p2-34': 'R06',
  'rs-p2-13': 'R08', 'rs-p2-14': 'R08', 'rs-p2-15': 'R08', 'rs-p2-16': 'R08', 'rs-p2-17': 'R08', 'rs-p2-18': 'R08', 'rs-p2-19': 'R08',
  'rb-p2-1': 'R08', 'rb-p2-2': 'R08', 'rb-p2-3': 'R08', 'rb-p2-4': 'R08', 'rb-p2-5': 'R08', 'rb-p2-6': 'R08', 'rb-p2-7': 'R08', 'rb-p2-8': 'R08', 'rb-p2-9': 'R08',
  'rs-p2-4': 'R09', 'rs-p2-5': 'R09', 'rs-p2-8': 'R09', 'rs-p2-11': 'R09', 'rs-p2-20': 'R09', 'rs-p2-26': 'R09',
  'rs-p2-35': 'R10',
  'rs-p2-27': 'R11',
};

/**
 * 파일 → 편철 칸. 1) 칸 코드가 직접 연결된 파일 2) 체크리스트 항목에 연결된 파일 3) 파일 이름 (가장 긴 단어가 맞는 칸)
 * 이전: 사전 순서대로 처음 맞는 칸 → '금지명령 신청서'가 '신청서'(R00)로 들어갔다.
 * allowed: 이 사건 묶음의 칸 코드 (파산이면 B 칸만)
 */
export function matchFileToSlot(fileName: string, linkedDocId?: string, allowed?: string[]): string | null {
  const ok = (code: string) => !allowed || allowed.includes(code);
  if (linkedDocId && SLOT_KEYWORDS_MAP[linkedDocId] && ok(linkedDocId)) return linkedDocId;
  if (linkedDocId && CHECKLIST_TO_REHAB_SLOT[linkedDocId] && ok(CHECKLIST_TO_REHAB_SLOT[linkedDocId])) return CHECKLIST_TO_REHAB_SLOT[linkedDocId];
  const lowerName = fileName.toLowerCase().replace(/\s+/g, '');
  let best: { code: string; len: number } | null = null;
  for (const [slotCode, keywords] of Object.entries(SLOT_KEYWORDS_MAP)) {
    if (!ok(slotCode)) continue;
    for (const kw of keywords) {
      const k = kw.toLowerCase().replace(/\s+/g, '');
      if (lowerName.includes(k) && (!best || k.length > best.len)) best = { code: slotCode, len: k.length };
    }
  }
  return best?.code ?? null;
}

// ══════════════════════════════════════════════════════════════════
// 실제 서울회생법원 접수 사건 전수 분석 기반
// 대한민국 법원 개인회생 14단계 정식 편철 표준 순서 규격
// ══════════════════════════════════════════════════════════════════
export const REHAB_14_STANDARD_ORDER: Omit<FilingDocumentSlot, 'file' | 'files' | 'status'>[] = [
  { order: 1, code: 'R00', title: '01. 개인회생절차 개시신청서 (표지 및 본문 D5101 3쪽)', category: 'CORE_FORM', isRequired: true },
  { order: 2, code: 'R01', title: '02. 주민등록표 등본 및 초본 (말소·변동사항 전체)', category: 'ID_VERIFICATION', isRequired: true },
  { order: 3, code: 'R02', title: '03. 가족관계증명서(상세) 및 혼인관계증명서(상세)', category: 'ID_VERIFICATION', isRequired: true },
  { order: 4, code: 'R03', title: '04. 개인회생채권자목록 (총괄표 및 채권자별 상세표)', category: 'CORE_FORM', isRequired: true },
  { order: 5, code: 'R04', title: '05. 채권자목록 소명자료 (부채증명서철 원본 일체)', category: 'EVIDENCE', isRequired: true },
  { order: 6, code: 'R05', title: '06. 재산목록 (D5102 전산양식 및 청산가치표)', category: 'CORE_FORM', isRequired: true },
  { order: 7, code: 'R06', title: '07. 재산목록 소명자료 (과세증명/통장/어카운트인포/보험환급금/차량원부)', category: 'EVIDENCE', isRequired: true },
  { order: 8, code: 'R07', title: '08. 수입 및 지출에 관한 목록 (D5103 가용소득 산출표)', category: 'CORE_FORM', isRequired: true },
  { order: 9, code: 'R08', title: '09. 수입지출 소명자료 (재직증명서/원천징수/급여통장 1년 등)', category: 'EVIDENCE', isRequired: true },
  { order: 10, code: 'R09', title: '10. 진술서 (학력/경력 및 상세 채무증대경위서)', category: 'CORE_FORM', isRequired: true },
  { order: 11, code: 'R10', title: '11. 변제계획안 및 변제예정액표 (D5110)', category: 'CORE_FORM', isRequired: true },
  { order: 12, code: 'R11', title: '12. 금지명령 신청서 (필요한 사건만)', category: 'CORE_FORM', isRequired: false },
  { order: 13, code: 'R12', title: '13. 소송위임장 및 대한변협 경유확인서', category: 'POWER_OF_ATTORNEY', isRequired: true },
  { order: 14, code: 'R13', title: '14. 자료제출목록', category: 'CORE_FORM', isRequired: true },
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
    slotCodes: ['R00'],
    isRequired: true,
  },
  {
    bundleOrder: 4,
    bundleCode: 'BUNDLE_04_DEBT_CERT',
    bundleFileName: '채권자 보유 소명자료.pdf',
    title: '4. 채권자 보유 소명자료 (부채증명서철)',
    description: '금융기관별 부채증명서 원본 및 채권양도통지서 일체',
    sourceKeywords: ['부채증명', '채권자', '양도통지'],
    slotCodes: ['R04'],
    isRequired: true,
  },
  {
    bundleOrder: 5,
    bundleCode: 'BUNDLE_05_ASSET_EVIDENCE',
    bundleFileName: '재산 목록 소명자료.pdf',
    title: '5. 재산 목록 소명자료',
    description: '금융거래내역서, 계좌정보통합관리원(어카운트인포), 보험해약환급금, 지방세 세목별과세증명서, 지적전산자료(K-Geo), 자동차등록원부, 부동산등기부 등',
    sourceKeywords: ['재산', '보험', '어카운트인포', '과세증명', '자동차', '등기', '지적', '임대차', '계좌내역'],
    slotCodes: ['R06'],
    isRequired: true,
  },
  {
    bundleOrder: 6,
    bundleCode: 'BUNDLE_06_INCOME_EVIDENCE',
    bundleFileName: '거주자의 수입 및 지출에 관한 목록 소명 자료.pdf',
    title: '6. 거주자의 수입 및 지출에 관한 목록 소명 자료',
    description: '재직증명서, 근로계약서, 근로소득원천징수영수증, 소득금액증명원, 최근 1년 급여명세/급여통장, 건강보험자격득실, 부가세과세표준(사업소득) 등',
    sourceKeywords: ['소득', '재직', '원천징수', '급여', '건강보험자격', '부가세', '수입지출', '사업소득'],
    slotCodes: ['R08'],
    isRequired: true,
  },
  {
    bundleOrder: 7,
    bundleCode: 'BUNDLE_07_STATEMENT_EVIDENCE',
    bundleFileName: '진술서 소명자료.pdf',
    title: '7. 진술서 소명자료',
    description: '무상거주사실확인서, 국민기초생활수급자증명서, 장애인증명서, 진료비영수증/진단서, 폐업사실증명원 등',
    sourceKeywords: ['진술서', '무상거주', '수급자', '장애인', '진료비', '진단서', '폐업'],
    slotCodes: ['R09'],
    isRequired: false,
  },
];

// 개인파산·면책 10종 법원 표준 제출 순서 규격
export const BANKRUPTCY_10_STANDARD_ORDER: Omit<FilingDocumentSlot, 'file' | 'files' | 'status'>[] = [
  { order: 1, code: 'B01', title: '01. 개인파산 및 면책신청서', category: 'CORE_FORM', isRequired: true },
  { order: 2, code: 'B02', title: '02. 파산 진술서 (채무증대 경위 및 면책불허가사유 점검)', category: 'CORE_FORM', isRequired: true },
  { order: 3, code: 'B03', title: '03. 진술서 소명자료 (질병 진단서, 폐업증명서 등)', category: 'EVIDENCE', isRequired: false },
  { order: 4, code: 'B04', title: '04. 채권자목록 (비면책채권 구분 표기)', category: 'CORE_FORM', isRequired: true },
  { order: 5, code: 'B05', title: '05. 채권자목록 소명자료 (부채증명서 원본)', category: 'EVIDENCE', isRequired: true },
  { order: 6, code: 'B06', title: '06. 재산목록 (1,558만 원(2026년) 생계비 및 소액보증금 공제 반영)', category: 'CORE_FORM', isRequired: true },
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

/** 마지막 단일 PDF 결합에서 빠진 칸 (화면 안내용) */
let lastMergeMissing: string[] = [];
export function getLastMergeMissing(): string[] { return lastMergeMissing; }

export class CourtBatchFilingService {
  /**
   * 1. 전자소송 정규 14단계 순서 단일 PDF 일괄 결합 (Merge PDF)
   * - 시스템 서식은 CourtFormPdfGenerator를 통해 대한민국 법원 공식 한글 전산양식으로 실시간 렌더링
   * - 업로드된 소명자료(PDF 및 JPG/PNG 사진 원본)를 순서대로 결합
   * - 실제 법원에 접수된 110~140쪽 완성본 PDF 생성
   */
  static async mergeCourtFilingPdf(
    slots: FilingDocumentSlot[],
    caseTitle: string,
    clientName: string,
    formDataContext?: CourtFormDataContext
  ): Promise<Uint8Array> {
    const mergedPdf = await PDFDocument.create();
    const missing: string[] = [];

    for (const slot of slots) {
      let slotMerged = false;

      // 해당 슬롯에 결합할 파일 목록 (복수 파일 우선, 단일 파일 fallback)
      const targetFiles: FilingFileItem[] = [];
      if (slot.files && slot.files.length > 0) {
        targetFiles.push(...slot.files);
      } else if (slot.file) {
        targetFiles.push(slot.file);
      }

      // 1. 이미 업로드되었거나 준비된 파일(PDF 및 이미지) 병합
      for (const item of targetFiles) {
        if (!item.dataUrl && !item.bytes) continue;

        try {
          const bytes = item.bytes || dataUrlToUint8Array(item.dataUrl!);
          const dataUrl = item.dataUrl || '';
          const mime = item.mimeType || '';

          // A. PDF 파일인 경우
          if (mime.includes('pdf') || dataUrl.includes('application/pdf')) {
            const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
            slotMerged = true;
          } 
          // B. JPEG/JPG 이미지인 경우
          else if (mime.includes('jpeg') || mime.includes('jpg') || dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
            const image = await mergedPdf.embedJpg(bytes);
            const page = mergedPdf.addPage([595.28, 841.89]); // A4
            const { width, height } = page.getSize();
            const imgDims = image.scaleToFit(width - 50, height - 60);
            page.drawImage(image, {
              x: (width - imgDims.width) / 2,
              y: (height - imgDims.height) / 2,
              width: imgDims.width,
              height: imgDims.height,
            });
            slotMerged = true;
          }
          // C. PNG 이미지인 경우
          else if (mime.includes('png') || dataUrl.startsWith('data:image/png')) {
            const image = await mergedPdf.embedPng(bytes);
            const page = mergedPdf.addPage([595.28, 841.89]); // A4
            const { width, height } = page.getSize();
            const imgDims = image.scaleToFit(width - 50, height - 60);
            page.drawImage(image, {
              x: (width - imgDims.width) / 2,
              y: (height - imgDims.height) / 2,
              width: imgDims.width,
              height: imgDims.height,
            });
            slotMerged = true;
          }
        } catch (e) {
          console.warn(`[BatchFiling] 파일 병합 실패: ${slot.title} - ${item.name}`, e);
        }
      }

      // 2. 올린 파일이 없는 시스템 서식은 작성기 데이터로 글자 PDF를 만들어 넣는다 (H-7, 서버 /api/pdf)
      if (!slotMerged && formDataContext && (slot.category === 'CORE_FORM' || slot.category === 'POWER_OF_ATTORNEY')) {
        const bytes = await generateCourtOfficialFormPdf(slot.code, formDataContext);
        if (bytes && bytes.length > 0) {
          try {
            const formPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
            const pages = await mergedPdf.copyPages(formPdf, formPdf.getPageIndices());
            pages.forEach(pg => mergedPdf.addPage(pg));
            slotMerged = true;
          } catch (e) {
            console.warn(`[BatchFiling] 서식 PDF 결합 실패: ${slot.code}`, e);
          }
        }
      }
      // 3. 그래도 없는 칸은 빈 간지를 넣지 않는다 (이전: 영문 Helvetica 간지 'COURT ELECTRONIC FILING'을 끼워 넣었다)
      if (!slotMerged) missing.push(slot.title);
    }
    lastMergeMissing = missing;
    return await mergedPdf.save();
  }

  /**
   * 2. 대법원 전자소송 순서별 개별 PDF ZIP 일괄 압축 (회생위원 전자기록 뷰어 1:1 매칭 표준 패키지)
   * - 20MB 초과 파일은 _part1.pdf, _part2.pdf 등으로 자동 분할하여 업로드 오류 방지
   * - 전자소송 채권자 CSV(CP949) 동봉
   * - 회생위원 뷰어 좌측 목차와 1:1 일치하는 01~14번 번호순 정렬
   */
  static async buildFilingPackage(
    slots: FilingDocumentSlot[],
    clientName: string,
    formDataContext?: CourtFormDataContext,
    options?: {
      creditors?: RepaymentCreditor[];
      isBankruptcy?: boolean;
    }
  ): Promise<FilingPackageResult> {
    const zip = new JSZip();
    const folderName = `전자소송제출_${clientName}_${new Date().toISOString().split('T')[0]}`;
    const folder = zip.folder(folderName) || zip;

    const manifest: FilingPackageManifestItem[] = [];

    // 1. 대법원 규격 채권자목록 CSV 자동 동봉
    if (options?.creditors && options.creditors.length > 0) {
      const csvContent = options.isBankruptcy
        ? this.generateBankruptcyCourtCreditorCsv(options.creditors, clientName)
        : this.generateCourtCreditorCsv(options.creditors, clientName);
      const csvName = `00_대법원전자소송_${clientName}_채권자목록_일괄등록양식.csv`;
      folder.file(csvName, encodeCp949(csvContent).bytes);
      manifest.push({
        order: 0,
        code: 'CSV',
        title: options.isBankruptcy ? '전자소송 채권자목록 CSV (파산 18열, CP949)' : '전자소송 채권자(기본정보) CSV (13열, CP949)',
        category: 'CORE_FORM',
        fileName: csvName,
        sizeBytes: new Blob([csvContent]).size,
        sizeFormatted: formatFileSize(new Blob([csvContent]).size),
        status: 'READY'
      });
    }

    // 2. 14단계 표준 편철 슬롯별 파일 처리
    for (const slot of slots) {
      const paddedOrder = String(slot.order).padStart(2, '0');
      const cleanTitle = slot.title.replace(/[\/:*?"<>|]/g, '_').substring(0, 30);

      // 해당 슬롯 파일 수합
      const targetFiles: FilingFileItem[] = [];
      if (slot.files && slot.files.length > 0) {
        targetFiles.push(...slot.files);
      } else if (slot.file) {
        targetFiles.push(slot.file);
      }

      if (targetFiles.length > 0) {
        // A. 단일 파일인 경우
        if (targetFiles.length === 1) {
          const f = targetFiles[0];
          let pdfBytes: Uint8Array | null = null;
          const rawBytes = f.bytes || (f.dataUrl ? dataUrlToUint8Array(f.dataUrl) : null);

          if (rawBytes) {
            const mime = f.mimeType || '';
            const isImage = mime.includes('jpeg') || mime.includes('jpg') || mime.includes('png') || f.name.match(/\.(jpg|jpeg|png)$/i);

            if (isImage) {
              try {
                const imgDoc = await PDFDocument.create();
                const image = (mime.includes('png') || f.name.endsWith('.png'))
                  ? await imgDoc.embedPng(rawBytes)
                  : await imgDoc.embedJpg(rawBytes);
                const page = imgDoc.addPage([595.28, 841.89]);
                const { width, height } = page.getSize();
                const dims = image.scaleToFit(width - 50, height - 60);
                page.drawImage(image, {
                  x: (width - dims.width) / 2,
                  y: (height - dims.height) / 2,
                  width: dims.width,
                  height: dims.height,
                });
                pdfBytes = await imgDoc.save();
              } catch {
                pdfBytes = rawBytes;
              }
            } else {
              pdfBytes = rawBytes;
            }

            const baseName = `${paddedOrder}_${cleanTitle}_${clientName}.pdf`;
            const splitParts = await splitPdfIfNeeded(pdfBytes, baseName, 19 * 1024 * 1024);

            for (const part of splitParts) {
              folder.file(part.filename, part.bytes);
              manifest.push({
                order: slot.order,
                code: slot.code,
                title: slot.title,
                category: slot.category,
                fileName: part.filename,
                sizeBytes: part.bytes.byteLength,
                sizeFormatted: formatFileSize(part.bytes.byteLength),
                isSplit: part.isSplit,
                pageRange: part.pageRange,
                status: 'READY'
              });
            }
          }
        } 
        // B. 슬롯 내 다중 파일인 경우 (예: 여러 부채증명서) -> 슬롯 단위 단일 PDF로 결합 후 20MB 검사
        else {
          try {
            const mergedSlotPdf = await PDFDocument.create();
            for (const f of targetFiles) {
              const rawBytes = f.bytes || (f.dataUrl ? dataUrlToUint8Array(f.dataUrl) : null);
              if (!rawBytes) continue;
              const mime = f.mimeType || '';
              const isImage = mime.includes('jpeg') || mime.includes('jpg') || mime.includes('png') || f.name.match(/\.(jpg|jpeg|png)$/i);

              if (isImage) {
                const imgDoc = await PDFDocument.create();
                const image = (mime.includes('png') || f.name.endsWith('.png'))
                  ? await imgDoc.embedPng(rawBytes)
                  : await imgDoc.embedJpg(rawBytes);
                const page = mergedSlotPdf.addPage([595.28, 841.89]);
                const { width, height } = page.getSize();
                const dims = image.scaleToFit(width - 50, height - 60);
                page.drawImage(image, {
                  x: (width - dims.width) / 2,
                  y: (height - dims.height) / 2,
                  width: dims.width,
                  height: dims.height,
                });
              } else {
                const srcPdf = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
                const pages = await mergedSlotPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                pages.forEach(p => mergedSlotPdf.addPage(p));
              }
            }

            const mergedBytes = await mergedSlotPdf.save();
            const baseName = `${paddedOrder}_${cleanTitle}_${clientName}.pdf`;
            const splitParts = await splitPdfIfNeeded(mergedBytes, baseName, 19 * 1024 * 1024);

            for (const part of splitParts) {
              folder.file(part.filename, part.bytes);
              manifest.push({
                order: slot.order,
                code: slot.code,
                title: slot.title,
                category: slot.category,
                fileName: part.filename,
                sizeBytes: part.bytes.byteLength,
                sizeFormatted: formatFileSize(part.bytes.byteLength),
                isSplit: part.isSplit,
                pageRange: part.pageRange,
                status: 'READY'
              });
            }
          } catch (mergeErr) {
            // 결합 실패 시 개별 파일로 분리 저장
            for (let idx = 0; idx < targetFiles.length; idx++) {
              const f = targetFiles[idx];
              const rawBytes = f.bytes || (f.dataUrl ? dataUrlToUint8Array(f.dataUrl) : null);
              if (!rawBytes) continue;
              const subName = `${paddedOrder}_${String(idx + 1).padStart(2, '0')}_${cleanTitle}_${f.name}`;
              folder.file(subName, rawBytes);
              manifest.push({
                order: slot.order,
                code: slot.code,
                title: slot.title,
                category: slot.category,
                fileName: subName,
                sizeBytes: rawBytes.byteLength,
                sizeFormatted: formatFileSize(rawBytes.byteLength),
                status: 'READY'
              });
            }
          }
        }
      } else {
        // 올린 파일이 없는 시스템 서식: 작성기 데이터로 글자 PDF를 만든다 (H-7)
        if (formDataContext && (slot.category === 'CORE_FORM' || slot.category === 'POWER_OF_ATTORNEY')) {
          const bytes = await generateCourtOfficialFormPdf(slot.code, formDataContext);
          if (bytes && bytes.length > 0) {
            const fileName = `_${cleanTitle}_${clientName}.pdf`;
            folder.file(fileName, bytes);
            manifest.push({ order: slot.order, code: slot.code, title: slot.title, category: slot.category, fileName, sizeBytes: bytes.byteLength, sizeFormatted: formatFileSize(bytes.byteLength), isDigitalPdf: true, status: 'GENERATED' });
            continue;
          }
        }
        // 자료가 없는 칸: 안내 메모만 (전자소송에는 올리지 않음)
        const txtContent = `[이 칸은 비어 있어요 — 전자소송에 올리지 마세요]
서류번호: ${slot.order}
서류명: ${slot.title}
신청인: ${clientName}
할 일: ${slot.category === 'CORE_FORM' || slot.category === 'POWER_OF_ATTORNEY' ? '서식 작성기에서 PDF를 만들어 이 칸에 올려 주세요.' : '의뢰인 서류를 받아 이 칸에 올려 주세요.'}
`;
        const txtName = `${paddedOrder}_${cleanTitle}_비어있음_안내.txt`;
        folder.file(txtName, txtContent);
        manifest.push({
          order: slot.order,
          code: slot.code,
          title: slot.title,
          category: slot.category,
          fileName: txtName,
          sizeBytes: new Blob([txtContent]).size,
          sizeFormatted: formatFileSize(new Blob([txtContent]).size),
          status: slot.status === 'READY' ? 'GENERATED' : 'MISSING'
        });
      }
    }

    // 3. 법원 전자기록 뷰어 1:1 매칭 안내표 생성
    const totalSizeBytes = manifest.reduce((sum, item) => sum + item.sizeBytes, 0);
    const hasSplitFiles = manifest.some(item => item.isSplit);
    const isWithinCourtLimit = totalSizeBytes <= COURT_TOTAL_SIZE_LIMIT;

    const manifestText = `===================================================================
전자소송 제출 묶음 (번호순)
===================================================================
신청인: ${clientName}
패키지 생성시각: ${new Date().toISOString()}
총 파일 수: ${manifest.length}개
총 용량: ${formatFileSize(totalSizeBytes)} (전자소송 첨부 총용량 기준: ${isWithinCourtLimit ? '정상 접수 가능' : '한도 초과 주의'})
20MB 초과 자동분할: ${hasSplitFiles ? '적용됨 (20MB 미만 자동분할 완료)' : '미발생 (전체 20MB 이내)'}

[서류 목록]
-------------------------------------------------------------------
${manifest.map((m, i) => `${String(i + 1).padStart(2, '0')}. ${m.fileName} [${m.sizeFormatted}]${m.isSplit ? ` (자동분할: ${m.pageRange})` : ''}`).join('\r\n')}
-------------------------------------------------------------------
※ 안내:
1. 번호순으로 정렬했어요. '비어있음' 안내 파일은 올리지 마세요.
2. 서식과 증빙은 서로 다른 파일로 나눠 냅니다(전자문서 규칙 제8조③).
3. 파일당 20MB, 첨부 총 100MB(전자소송포털 안내)를 넘으면 나눠 제출해야 해요.
`;

    folder.file('00_법원전자기록뷰어_제출목록_안내표.txt', manifestText);

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    return {
      zipBlob,
      manifest,
      totalSizeBytes,
      totalSizeFormatted: formatFileSize(totalSizeBytes),
      totalFiles: manifest.length,
      hasSplitFiles,
      isWithinCourtLimit
    };
  }

  /**
   * 2. 대법원 전자소송 순서별 개별 PDF ZIP 일괄 압축 (Legacy 호환)
   */
  static async createFilingZip(
    slots: FilingDocumentSlot[],
    clientName: string,
    formDataContext?: CourtFormDataContext,
    options?: {
      creditors?: RepaymentCreditor[];
      isBankruptcy?: boolean;
    }
  ): Promise<Blob> {
    const result = await this.buildFilingPackage(slots, clientName, formDataContext, options);
    return result.zipBlob;
  }

  /**
   * 대법원 전자소송 전화번호 정규화 헬퍼
   * - 1588, 1544, 1566, 1600, 1644, 1688, 1577, 1599, 1800, 1899 등 전국대표번호는
   *   대법원 전자소송 시스템 검증상 '02' 국번을 붙여야 업로드 오류(반려)가 발생하지 않음.
   */
  static normalizeCourtPhoneNumber(phone?: string): string {
    if (!phone) return '';
    const clean = phone.trim().replace(/\s+/g, '');
    if (!clean) return '';

    // 이미 지역번호(02, 031, 051 등)로 시작하는 경우 그대로 반환
    if (/^0[2-6][0-9]?-\d+/.test(clean) || /^0[1-7][0-9]-\d+/.test(clean)) {
      return clean;
    }

    // 전국대표번호 패턴 감지 (예: 1588-9999, 1544-0000, 15889999 등)
    const repMatch = clean.match(/^(15[4789][0-9]|16[0478][0-9]|18[09][0-9])-?(\d{4})$/);
    if (repMatch) {
      return `02-${repMatch[1]}-${repMatch[2]}`;
    }

    return clean;
  }

  /**
   * 3. 전자소송 채권자 CSV (H-9): 회생 = 채권자(기본정보) 13열 당사자형, 파산 = 18열. 파일은 CP949로 저장한다(downloadCsv·묶음).
   * 이전: 자체 16열·17열 + UTF-8 BOM, 차용원인 '생활비 및 대여금'·차용일 '2023-01-01'을 지어 넣고 주민번호 칸이 있었다.
   */
  static generateCourtCreditorCsv(creditors: RepaymentCreditor[], _debtorName?: string): string {
    return buildRehabCreditorCsv(creditors).text;
  }

  static generateBankruptcyCourtCreditorCsv(creditors: RepaymentCreditor[], _debtorName?: string): string {
    return buildBankruptcyCreditorCsv(creditors).text;
  }

  /** 출력 전 확인할 빈 칸 (인격구분·우편번호·파산 필수 칸 등) */
  static creditorCsvWarnings(creditors: RepaymentCreditor[], isBankruptcy = false): string[] {
    return (isBankruptcy ? buildBankruptcyCreditorCsv(creditors) : buildRehabCreditorCsv(creditors)).warnings;
  }
  /**
   * 4. 매뉴얼 7-1 준용: 법원 전자소송 7대 묶음 PDF 일괄 ZIP 압축 다운로드
   */
  static async exportCourt7BundleZip(
    slots: FilingDocumentSlot[],
    clientName: string,
    uploadedFiles: any[] = []
  ): Promise<Blob> {
    const zip = new JSZip();
    const folderName = `[전자소송7대묶음]_개인회생_${clientName}_${new Date().toISOString().split('T')[0]}`;
    const rootFolder = zip.folder(folderName) || zip;

    for (const spec of REHAB_7_BUNDLE_SPEC) {
      const bundlePdf = await PDFDocument.create();

      let hasPage = false;

      // 1. REHAB_14 슬롯에 등록된 파일 중 해당 slotCodes 매칭
      const matchedSlots = slots.filter(s => spec.slotCodes.includes(s.code));
      for (const s of matchedSlots) {
        const slotFiles: FilingFileItem[] = [];
        if (s.files && s.files.length > 0) slotFiles.push(...s.files);
        else if (s.file) slotFiles.push(s.file);

        for (const f of slotFiles) {
          if (f.dataUrl && f.dataUrl.includes('application/pdf')) {
            try {
              const bytes = dataUrlToUint8Array(f.dataUrl);
              const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
              const copied = await bundlePdf.copyPages(srcDoc, srcDoc.getPageIndices());
              copied.forEach(p => bundlePdf.addPage(p));
              hasPage = true;
            } catch (err) {
              console.warn(`[7Bundle] 파일 병합 실패: ${f.name}`, err);
            }
          }
        }
      }

      // 2. 업로드 파일 전체에서 키워드 매칭 fallback
      if (!hasPage && uploadedFiles.length > 0) {
        for (const up of uploadedFiles) {
          const matchedKw = spec.sourceKeywords.some(kw => (up.name || '').includes(kw));
          if (matchedKw && up.dataUrl && up.dataUrl.includes('application/pdf')) {
            try {
              const bytes = dataUrlToUint8Array(up.dataUrl);
              const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
              const copied = await bundlePdf.copyPages(srcDoc, srcDoc.getPageIndices());
              copied.forEach(p => bundlePdf.addPage(p));
              hasPage = true;
            } catch (err) {
              console.warn(`[7Bundle] 업로드 파일 병합 실패: ${up.name}`, err);
            }
          }
        }
      }

      // 3. 파일이 없는 묶음은 만들지 않는다 (이전: 영문 간지 한 장짜리 PDF를 넣었다)
      if (!hasPage) continue;
      const bundleBytes = await bundlePdf.save();
      rootFolder.file(spec.bundleFileName, bundleBytes);
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * PDF 다운로드 트리거
   */
  static downloadPdf(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * ZIP 다운로드 트리거
   */
  static downloadZip(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * CSV 다운로드 트리거
   */
  static downloadCsv(csvContent: string, filename: string): void {
    // 전자소송 양식은 CP949 — 엑셀로 열었다 저장하면 깨질 수 있어 그대로 올린다
    const blob = new Blob([encodeCp949(csvContent).bytes], { type: 'text/csv;charset=euc-kr' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
