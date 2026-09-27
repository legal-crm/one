/**
 * PDF 전처리 엔진 (PDF Preprocessing Service)
 * 
 * 법원 전자소송 제출 전 스캔/업로드 문서 품질을 최적화합니다:
 *  1. 가로 방향(Landscape) 페이지 자동 감지 및 세로(Portrait) 회전 보정
 *  2. 개별 페이지 90도/180도 회전
 *  3. 빈 페이지(Blank Page / 이면지 스캔) 자동 감지 및 일괄 삭제
 *  4. 페이지 순서 변경 및 특정 페이지 삭제
 *  5. 스캔 해상도(DPI) 및 용량 분석
 * 
 * 라이브러리: pdf-lib (브라우저 로컬 실행 — 서버 비용 ₩0)
 */

import { PDFDocument, degrees, PDFName, PDFDict, PDFArray, PDFStream } from 'pdf-lib';

export interface PdfPageMeta {
  pageIndex: number;      // 0-indexed
  pageNumber: number;     // 1-indexed
  width: number;
  height: number;
  rotation: number;       // 0, 90, 180, 270
  isLandscape: boolean;
  isBlankSuspected: boolean;
  hasImages: boolean;
  hasText: boolean;
  aspectRatio: number;
}

export interface PdfInspectionOverview {
  totalPages: number;
  landscapeCount: number;
  blankCount: number;
  pages: PdfPageMeta[];
  fileSizeBytes: number;
  fileSizeFormatted: string;
}

/**
 * PDF 페이지 크기와 회전 각도로부터 실제 표시 방향 판별
 */
export function isPageLandscape(width: number, height: number, rotation: number): boolean {
  const normRot = ((rotation % 360) + 360) % 360;
  if (normRot === 90 || normRot === 270) {
    return height > width * 1.15;
  }
  return width > height * 1.15;
}

/**
 * PDF 전체 페이지의 메타데이터(방향, 빈 페이지 의심 여부, 이미지 유무 등)를 분석합니다.
 */
export async function inspectPdfPages(pdfBytes: Uint8Array): Promise<PdfInspectionOverview> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();
  const pages: PdfPageMeta[] = [];

  let landscapeCount = 0;
  let blankCount = 0;

  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    const isLandscape = isPageLandscape(width, height, rotation);

    if (isLandscape) landscapeCount++;

    // 빈 페이지 및 리소스 분석
    let hasImages = false;
    let hasText = false;
    let isBlankSuspected = false;

    try {
      const pageDict = page.node;
      const contents = pageDict.Contents();

      // 리소스 딕셔너리 검사
      const resources = pageDict.Resources();
      if (resources instanceof PDFDict) {
        const xObjects = resources.get(PDFName.of('XObject'));
        if (xObjects) hasImages = true;

        const fonts = resources.get(PDFName.of('Font'));
        if (fonts) hasText = true;
      }

      // Contents 스트림 크기 검사
      if (!contents) {
        isBlankSuspected = true;
      } else {
        let totalStreamBytes = 0;
        if (contents instanceof PDFArray) {
          for (let j = 0; j < contents.size(); j++) {
            const stream = doc.context.lookup(contents.get(j));
            if (stream instanceof PDFStream) {
              totalStreamBytes += stream.getContents().length;
            }
          }
        } else {
          const stream = doc.context.lookup(contents);
          if (stream instanceof PDFStream) {
            totalStreamBytes += stream.getContents().length;
          }
        }

        // 스트림이 25바이트 미만이고 폰트나 이미지가 없으면 빈 페이지로 판정
        if (totalStreamBytes < 25 && !hasImages && !hasText) {
          isBlankSuspected = true;
        }
      }
    } catch {
      // 분석 실패 시 보수적으로 비어있지 않음으로 처리
    }

    if (isBlankSuspected) blankCount++;

    pages.push({
      pageIndex: i,
      pageNumber: i + 1,
      width: Math.round(width),
      height: Math.round(height),
      rotation,
      isLandscape,
      isBlankSuspected,
      hasImages,
      hasText,
      aspectRatio: Number((width / height).toFixed(2))
    });
  }

  const fileSize = pdfBytes.byteLength;
  const fileSizeFormatted = fileSize > 1024 * 1024 
    ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` 
    : `${Math.round(fileSize / 1024)} KB`;

  return {
    totalPages,
    landscapeCount,
    blankCount,
    pages,
    fileSizeBytes: fileSize,
    fileSizeFormatted
  };
}

/**
 * 가로 방향(Landscape)으로 스캔된 모든 페이지를 법원 표준 세로(Portrait)로 자동 회전합니다.
 */
export async function autoRotateLandscapePages(
  pdfBytes: Uint8Array
): Promise<{ bytes: Uint8Array; rotatedCount: number; rotatedIndices: number[] }> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();
  const rotatedIndices: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const currentRot = page.getRotation().angle;

    if (isPageLandscape(width, height, currentRot)) {
      // 90도 시계방향 회전하여 세로로 전환
      const newAngle = ((currentRot + 90) % 360);
      page.setRotation(degrees(newAngle));
      rotatedIndices.push(i);
    }
  }

  const bytes = await doc.save();
  return {
    bytes,
    rotatedCount: rotatedIndices.length,
    rotatedIndices
  };
}

/**
 * 특정 페이지들을 지정된 각도(90도, 180도, 270도)로 회전합니다.
 */
export async function rotatePages(
  pdfBytes: Uint8Array,
  rotations: { pageIndex: number; deltaDegrees: 90 | -90 | 180 }[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();

  for (const { pageIndex, deltaDegrees } of rotations) {
    if (pageIndex >= 0 && pageIndex < totalPages) {
      const page = doc.getPage(pageIndex);
      const current = page.getRotation().angle;
      const next = ((current + deltaDegrees) % 360 + 360) % 360;
      page.setRotation(degrees(next));
    }
  }

  return await doc.save();
}

/**
 * 빈 페이지로 감지되었거나 사용자가 지정한 페이지들을 삭제합니다.
 * (높은 인덱스부터 역순 삭제하여 인덱스 밀림 방지)
 */
export async function removePagesFromPdf(
  pdfBytes: Uint8Array,
  pageIndicesToRemove: number[]
): Promise<{ bytes: Uint8Array; remainingCount: number; removedCount: number }> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = doc.getPageCount();

  // 중복 제거 및 내림차순 정렬
  const sorted = Array.from(new Set(pageIndicesToRemove))
    .filter(idx => idx >= 0 && idx < totalPages)
    .sort((a, b) => b - a);

  // 최소 1페이지는 유지되어야 함
  if (sorted.length >= totalPages) {
    throw new Error('문서의 모든 페이지를 삭제할 수는 없습니다. 최소 1페이지는 유지되어야 합니다.');
  }

  for (const idx of sorted) {
    doc.removePage(idx);
  }

  const bytes = await doc.save();
  return {
    bytes,
    remainingCount: doc.getPageCount(),
    removedCount: sorted.length
  };
}

/**
 * 빈 페이지를 자동 감지하여 일괄 삭제합니다.
 */
export async function autoRemoveBlankPages(
  pdfBytes: Uint8Array
): Promise<{ bytes: Uint8Array; removedCount: number; removedIndices: number[] }> {
  const overview = await inspectPdfPages(pdfBytes);
  const blankIndices = overview.pages
    .filter(p => p.isBlankSuspected)
    .map(p => p.pageIndex);

  if (blankIndices.length === 0 || blankIndices.length === overview.totalPages) {
    return {
      bytes: pdfBytes,
      removedCount: 0,
      removedIndices: []
    };
  }

  const result = await removePagesFromPdf(pdfBytes, blankIndices);
  return {
    bytes: result.bytes,
    removedCount: result.removedCount,
    removedIndices: blankIndices
  };
}
