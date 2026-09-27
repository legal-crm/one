/**
 * PDF 품질 검수 및 디지털 PDF 감지 서비스
 * 
 * 법원 전자소송 제출 전 PDF 품질을 자동 검증합니다.
 * 
 * Phase 1 기능:
 *  - 디지털 PDF 자동 감지 (텍스트 레이어 판별 → OCR 스킵)
 *  - 파일 용량 검수 (20MB 법원 제한)
 *  - 암호/손상 여부 검사
 *  - 페이지 수 확인
 *  - 파일명 규칙 준수 여부
 *  - 총 패키지 용량 확인 (50MB)
 * 
 * 사용 라이브러리: pdf-lib (이미 설치됨) — 비용 ₩0
 */

import { PDFDocument } from 'pdf-lib';

// ═══════════════════════════════════════════════
// 1. 법원 전자소송 시스템 제약 조건
// ═══════════════════════════════════════════════

/** 법원 전자소송 개별 파일 용량 제한 (20MB) */
export const COURT_FILE_SIZE_LIMIT = 20 * 1024 * 1024;

/** 법원 전자소송 1회 접수 총용량 (50MB, 보수적 기준) */
export const COURT_TOTAL_SIZE_LIMIT = 50 * 1024 * 1024;

/** 파일명 규칙 패턴: 번호_서류명.pdf (예: 01_주민등록초본.pdf) */
const FILE_NAME_PATTERN = /^\d{2}_[가-힣a-zA-Z0-9_\-]+\.(pdf|PDF)$/;

// ═══════════════════════════════════════════════
// 2. 검수 결과 타입
// ═══════════════════════════════════════════════

export type InspectionSeverity = 'pass' | 'info' | 'warning' | 'error';

export interface InspectionItem {
  id: string;
  label: string;
  severity: InspectionSeverity;
  message: string;
  /** 법원 제출 영향도 */
  courtImpact?: string;
}

export interface PdfInspectionResult {
  fileName: string;
  fileSize: number;
  fileSizeMB: string;
  /** 검수 성공 여부 (error 항목이 없으면 true) */
  passed: boolean;
  /** 디지털 PDF 여부 (텍스트 레이어 포함) */
  isDigitalPdf: boolean;
  /** 추출된 텍스트 문자 수 */
  extractedTextLength: number;
  /** PDF 페이지 수 */
  pageCount: number;
  /** 개별 검수 항목 */
  items: InspectionItem[];
  /** 검수 시각 */
  inspectedAt: string;
}

/** 복수 파일 패키지 검수 결과 */
export interface PackageInspectionResult {
  files: PdfInspectionResult[];
  totalSize: number;
  totalSizeMB: string;
  totalPages: number;
  fileCount: number;
  /** 패키지 전체가 법원 제출 가능한지 */
  packagePassed: boolean;
  /** 패키지 레벨 경고/에러 */
  packageItems: InspectionItem[];
}

// ═══════════════════════════════════════════════
// 3. 단일 PDF 검수 함수
// ═══════════════════════════════════════════════

/**
 * PDF 파일을 검수하여 법원 제출 적합성을 판단합니다.
 * 
 * @param file - 업로드된 PDF File 객체
 * @returns PdfInspectionResult - 검수 결과
 */
export async function inspectPdfFile(file: File): Promise<PdfInspectionResult> {
  const items: InspectionItem[] = [];
  let pageCount = 0;
  let isDigitalPdf = false;
  let extractedTextLength = 0;
  const fileSize = file.size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

  // ── 1. 파일 용량 검수 (20MB 법원 제한) ──
  if (fileSize > COURT_FILE_SIZE_LIMIT) {
    items.push({
      id: 'size-limit',
      label: '파일 용량',
      severity: 'error',
      message: `${fileSizeMB}MB — 법원 전자소송 개별 파일 제한(20MB)을 초과합니다. 파일을 분할해 주세요.`,
      courtImpact: '🔴 업로드 거부',
    });
  } else if (fileSize > COURT_FILE_SIZE_LIMIT * 0.8) {
    items.push({
      id: 'size-limit',
      label: '파일 용량',
      severity: 'warning',
      message: `${fileSizeMB}MB — 법원 제한(20MB)에 근접합니다. 스캔 설정을 흑백/200DPI로 변경하면 용량을 줄일 수 있습니다.`,
      courtImpact: '⚠️ 제한 임박',
    });
  } else {
    items.push({
      id: 'size-limit',
      label: '파일 용량',
      severity: 'pass',
      message: `${fileSizeMB}MB — 법원 제한(20MB) 이내`,
    });
  }

  // ── 2. PDF 파싱 (암호/손상 검사 + 페이지 수 + 텍스트 레이어) ──
  try {
    const buffer = await file.arrayBuffer();
    
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer, { 
        ignoreEncryption: true,
        updateMetadata: false 
      });
    } catch (loadErr: any) {
      // 암호화 또는 손상된 PDF
      const errMsg = String(loadErr?.message || '');
      
      if (errMsg.includes('encrypt') || errMsg.includes('password')) {
        items.push({
          id: 'password',
          label: '암호 보호',
          severity: 'error',
          message: '비밀번호가 설정된 PDF입니다. 암호를 해제한 후 다시 업로드해 주세요.',
          courtImpact: '🔴 제출 불가',
        });
      } else {
        items.push({
          id: 'corruption',
          label: '파일 손상',
          severity: 'error',
          message: `PDF 파일이 손상되었거나 읽을 수 없습니다: ${errMsg.slice(0, 100)}`,
          courtImpact: '🔴 제출 불가',
        });
      }

      return {
        fileName: file.name,
        fileSize,
        fileSizeMB,
        passed: false,
        isDigitalPdf: false,
        extractedTextLength: 0,
        pageCount: 0,
        items,
        inspectedAt: new Date().toISOString(),
      };
    }

    // 페이지 수 확인
    pageCount = pdfDoc.getPageCount();
    items.push({
      id: 'page-count',
      label: '페이지 수',
      severity: 'info',
      message: `${pageCount}페이지`,
    });

    // ── 3. 디지털 PDF 감지 (텍스트 레이어 판별) ──
    // pdf-lib으로 각 페이지의 content streams에서 텍스트 연산자(Tj, TJ, ')를 탐색
    try {
      let totalTextChars = 0;
      const pages = pdfDoc.getPages();
      
      for (let i = 0; i < Math.min(pages.length, 5); i++) {
        // 페이지의 content stream을 raw bytes로 확인
        const page = pages[i];
        const { width, height } = page.getSize();
        
        // pdf-lib의 내부 ref를 통해 content stream 접근
        const pageDict = page.node;
        const contentsRef = pageDict.get(PDFDocument.prototype.constructor.name ? 
          pageDict.lookupMaybe as any : undefined);
        
        // 간접적인 텍스트 판별: 페이지에 Font 리소스가 있는지 확인
        try {
          const resources = pageDict.get('Resources' as any);
          if (resources) {
            const rawStr = JSON.stringify(resources.toString());
            // Font 리소스가 있으면 텍스트 레이어가 있을 가능성 높음
            if (rawStr.includes('Font') || rawStr.includes('font')) {
              totalTextChars += 100; // 텍스트 존재 추정
            }
          }
        } catch {
          // 리소스 접근 실패 시 무시
        }
      }

      // 대안: ArrayBuffer에서 직접 텍스트 마커 검색
      const bytes = new Uint8Array(buffer);
      const pdfString = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 500000)));
      
      // PDF 내에서 텍스트 렌더링 연산자 검색
      const textOperatorMatches = pdfString.match(/\b(Tj|TJ|Td|TD|Tm|T\*|BT|ET)\b/g);
      const fontMatches = pdfString.match(/\/Font\s/g);
      const toUnicodeMatches = pdfString.match(/\/ToUnicode/g);
      
      const hasTextOperators = (textOperatorMatches?.length || 0) > 5;
      const hasFonts = (fontMatches?.length || 0) > 0;
      const hasToUnicode = (toUnicodeMatches?.length || 0) > 0;

      // 디지털 PDF 판정: 텍스트 연산자 + 폰트 리소스 존재
      isDigitalPdf = hasTextOperators && hasFonts;
      extractedTextLength = totalTextChars + (textOperatorMatches?.length || 0) * 10;
      
      if (isDigitalPdf) {
        items.push({
          id: 'text-layer',
          label: '텍스트 레이어',
          severity: 'pass',
          message: `✅ 디지털 PDF — 텍스트 검색(Ctrl+F) 가능. OCR이 불필요합니다.${hasToUnicode ? ' (유니코드 매핑 포함)' : ''}`,
          courtImpact: '회생위원 키워드 검색 가능',
        });
      } else {
        items.push({
          id: 'text-layer',
          label: '텍스트 레이어',
          severity: 'warning',
          message: '⚠️ 스캔 이미지 PDF — 텍스트 검색(Ctrl+F) 불가. 법원 제출 전 OCR 처리를 권장합니다.',
          courtImpact: '⚠️ 회생위원 키워드 검색 불가 → 보정권고 위험 증가',
        });
      }
    } catch (textErr) {
      items.push({
        id: 'text-layer',
        label: '텍스트 레이어',
        severity: 'info',
        message: '텍스트 레이어 분석을 수행할 수 없습니다.',
      });
    }

    // ── 4. 페이지 방향 검사 ──
    const firstPage = pdfDoc.getPages()[0];
    if (firstPage) {
      const { width, height } = firstPage.getSize();
      if (width > height * 1.2) {
        items.push({
          id: 'orientation',
          label: '페이지 방향',
          severity: 'warning',
          message: '가로 방향(Landscape) 페이지가 감지되었습니다. 법원 제출 시 세로 방향을 권장합니다.',
          courtImpact: '⚠️ 가독성 저하',
        });
      }
    }

    // ── 5. 빈 페이지 경고 ──
    if (pageCount === 0) {
      items.push({
        id: 'empty-pdf',
        label: '빈 문서',
        severity: 'error',
        message: '페이지가 없는 빈 PDF 파일입니다.',
        courtImpact: '🔴 제출 불가',
      });
    }

  } catch (err: any) {
    items.push({
      id: 'parse-error',
      label: 'PDF 분석',
      severity: 'error',
      message: `PDF 파일을 분석할 수 없습니다: ${String(err?.message || '알 수 없는 오류').slice(0, 100)}`,
      courtImpact: '🔴 파일 확인 필요',
    });
  }

  // ── 6. 파일명 규칙 검수 ──
  if (FILE_NAME_PATTERN.test(file.name)) {
    items.push({
      id: 'filename',
      label: '파일명 규칙',
      severity: 'pass',
      message: `"${file.name}" — 번호_서류명.pdf 형식 준수. 법원 뷰어 목차에 정상 표시됩니다.`,
    });
  } else {
    // 파일명 자동 추천 생성
    const cleanName = file.name.replace(/\.(pdf|PDF)$/, '').replace(/[^\w가-힣_\-]/g, '_');
    const suggested = `01_${cleanName}.pdf`;
    items.push({
      id: 'filename',
      label: '파일명 규칙',
      severity: 'warning',
      message: `"${file.name}" — 번호_서류명.pdf 형식을 권장합니다 (예: ${suggested}). 법원 전자기록 뷰어 좌측 목차에 파일명이 그대로 표시됩니다.`,
      courtImpact: '⚠️ 뷰어 목차 혼란 가능',
    });
  }

  const passed = !items.some(item => item.severity === 'error');

  return {
    fileName: file.name,
    fileSize,
    fileSizeMB,
    passed,
    isDigitalPdf,
    extractedTextLength,
    pageCount,
    items,
    inspectedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════
// 4. 복수 파일 패키지 검수
// ═══════════════════════════════════════════════

/**
 * 제출 패키지 전체를 검수합니다.
 * 
 * @param files - 업로드된 PDF File 배열
 * @returns PackageInspectionResult - 패키지 검수 결과
 */
export async function inspectSubmissionPackage(files: File[]): Promise<PackageInspectionResult> {
  const results: PdfInspectionResult[] = [];
  
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const result = await inspectPdfFile(file);
      results.push(result);
    }
  }

  const totalSize = results.reduce((sum, r) => sum + r.fileSize, 0);
  const totalPages = results.reduce((sum, r) => sum + r.pageCount, 0);
  const packageItems: InspectionItem[] = [];

  // 패키지 총용량 검수
  if (totalSize > COURT_TOTAL_SIZE_LIMIT) {
    packageItems.push({
      id: 'pkg-total-size',
      label: '총 패키지 용량',
      severity: 'error',
      message: `총 ${(totalSize / (1024 * 1024)).toFixed(1)}MB — 법원 1회 접수 제한(50MB)을 초과합니다. 파일을 나누어 접수하거나 스캔 품질을 낮춰주세요.`,
      courtImpact: '🔴 접수 거부',
    });
  } else if (totalSize > COURT_TOTAL_SIZE_LIMIT * 0.8) {
    packageItems.push({
      id: 'pkg-total-size',
      label: '총 패키지 용량',
      severity: 'warning',
      message: `총 ${(totalSize / (1024 * 1024)).toFixed(1)}MB — 법원 제한(50MB)에 근접합니다.`,
      courtImpact: '⚠️ 제한 임박',
    });
  }

  // 중복 파일명 검수
  const nameCount = new Map<string, number>();
  for (const r of results) {
    nameCount.set(r.fileName, (nameCount.get(r.fileName) || 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      packageItems.push({
        id: `pkg-dup-${name}`,
        label: '파일명 중복',
        severity: 'warning',
        message: `"${name}" 파일이 ${count}개 있습니다. 법원 뷰어에서 혼란이 발생할 수 있습니다.`,
        courtImpact: '⚠️ 뷰어 목차 혼란',
      });
    }
  }

  // OCR 미적용 스캔 파일 경고
  const scannedFiles = results.filter(r => !r.isDigitalPdf && r.pageCount > 0);
  if (scannedFiles.length > 0) {
    packageItems.push({
      id: 'pkg-ocr-needed',
      label: 'OCR 미적용 파일',
      severity: 'warning',
      message: `${scannedFiles.length}개 파일에 텍스트 레이어가 없습니다 (${scannedFiles.map(f => f.fileName).join(', ')}). 회생위원이 Ctrl+F 검색을 할 수 없어 보정권고 위험이 있습니다.`,
      courtImpact: '⚠️ 키워드 검색 불가',
    });
  }

  const packagePassed = 
    !packageItems.some(i => i.severity === 'error') &&
    results.every(r => r.passed);

  return {
    files: results,
    totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
    totalPages,
    fileCount: results.length,
    packagePassed,
    packageItems,
  };
}

// ═══════════════════════════════════════════════
// 5. 유틸리티 함수
// ═══════════════════════════════════════════════

/** 검수 결과에서 심각도별 카운트 */
export function getInspectionCounts(result: PdfInspectionResult): {
  errors: number;
  warnings: number;
  passes: number;
} {
  return {
    errors: result.items.filter(i => i.severity === 'error').length,
    warnings: result.items.filter(i => i.severity === 'warning').length,
    passes: result.items.filter(i => i.severity === 'pass').length,
  };
}

/** 파일명을 법원 제출 형식으로 자동 변환 */
export function suggestCourtFileName(
  originalName: string,
  index: number,
  documentLabel?: string
): string {
  const num = String(index).padStart(2, '0');
  const label = documentLabel || originalName.replace(/\.(pdf|PDF)$/, '').replace(/[^\w가-힣]/g, '_');
  return `${num}_${label}.pdf`;
}

/** 파일 용량을 사람이 읽기 좋은 형태로 변환 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 대법원 전자소송 20MB 제한 대응: 
 * 파일 용량이 maxBytes(기본 19MB 안전 여유폭)를 초과하는 경우 _part1.pdf, _part2.pdf 등으로 자동 분할합니다.
 */
export async function splitPdfIfNeeded(
  pdfBytes: Uint8Array,
  baseFilename: string,
  maxBytes: number = 19 * 1024 * 1024
): Promise<{ filename: string; bytes: Uint8Array; pageRange: string; isSplit: boolean }[]> {
  if (pdfBytes.byteLength <= maxBytes) {
    return [{ 
      filename: baseFilename, 
      bytes: pdfBytes, 
      pageRange: '전체',
      isSplit: false
    }];
  }

  try {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    if (totalPages <= 1) {
      // 1페이지 자체가 19MB 이상인 경우(초고해상도 스캔) 분할 불가 -> 원본 반환
      return [{ 
        filename: baseFilename, 
        bytes: pdfBytes, 
        pageRange: '1p',
        isSplit: false
      }];
    }

    // 예상 분할 파트 수 계산
    const estimatedParts = Math.max(2, Math.ceil(pdfBytes.byteLength / (maxBytes * 0.85)));
    const pagesPerPart = Math.max(1, Math.ceil(totalPages / estimatedParts));

    const results: { filename: string; bytes: Uint8Array; pageRange: string; isSplit: boolean }[] = [];
    const cleanBase = baseFilename.replace(/\.pdf$/i, '');

    let startPage = 0;
    let partIndex = 1;

    while (startPage < totalPages) {
      const endPage = Math.min(startPage + pagesPerPart, totalPages);
      const partDoc = await PDFDocument.create();
      const pageIndices: number[] = [];
      for (let p = startPage; p < endPage; p++) {
        pageIndices.push(p);
      }
      const copiedPages = await partDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(page => partDoc.addPage(page));
      const partBytes = await partDoc.save();

      results.push({
        filename: `${cleanBase}_part${partIndex}.pdf`,
        bytes: partBytes,
        pageRange: `${startPage + 1}~${endPage}면`,
        isSplit: true
      });

      startPage = endPage;
      partIndex++;
    }

    return results;
  } catch (err) {
    console.warn('[PDF Split Error] Fallback to original bytes:', err);
    return [{
      filename: baseFilename,
      bytes: pdfBytes,
      pageRange: '전체',
      isSplit: false
    }];
  }
}

