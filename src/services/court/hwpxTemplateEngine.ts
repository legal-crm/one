/**
 * hwpxTemplateEngine.ts
 * ============================================================
 * 대법원 전자소송용 HWPX 템플릿 데이터 바인딩 엔진
 * 
 * HWPX = ZIP(XML) 포맷 (KS X 6101 / OWPML 국가표준)
 * JSZip만으로 클라이언트 측에서 완전 처리 가능
 * 
 * 처리 흐름:
 * 1. JSZip으로 HWPX(ZIP) 해제
 * 2. Contents/section*.xml 파싱
 * 3. 누름틀(CLICK_HERE) 필드 또는 {{placeholder}} 텍스트 치환
 * 4. <hp:linesegarray> 조판 캐시 일괄 제거 (한컴 호환 필수)
 * 5. mimetype을 STORE(무압축)로 ZIP 리패키징
 * 6. 완성된 HWPX Blob 반환
 * ============================================================
 */

import JSZip from 'jszip';
import { toast } from 'sonner';

// ── 타입 정의 ──

/** HWPX 템플릿 필드 데이터 (키-값 쌍) */
export interface HwpxFieldData {
  [fieldName: string]: string;
}

/** HWPX 템플릿 메타데이터 */
export interface HwpxTemplateMeta {
  id: string;
  formCode: string;           // D5101, D5102, etc.
  title: string;              // 개인회생절차개시신청서
  templatePath: string;       // /templates/court/hwpx/D5101_개시신청서.hwpx
  description: string;
}

/** 필드 치환 결과 */
export interface HwpxFillResult {
  success: boolean;
  blob: Blob | null;
  fileName: string;
  replacedCount: number;
  unresolvedFields: string[];
  errors: string[];
}

// ── 등록된 HWPX 템플릿 카탈로그 ──

export const HWPX_TEMPLATE_CATALOG: HwpxTemplateMeta[] = [
  {
    id: 'D5101',
    formCode: 'D5101',
    title: '개인회생절차 개시신청서',
    templatePath: '/templates/court/hwpx/D5101_개시신청서.hwpx',
    description: '신청인 인적사항, 신청 취지 및 이유'
  },
  {
    id: 'D5102',
    formCode: 'D5102',
    title: '개인회생채권자목록',
    templatePath: '/templates/court/hwpx/D5102_채권자목록.hwpx',
    description: '채권자별 원금/이자, 담보/무담보 구분'
  },
  {
    id: 'D5103',
    formCode: 'D5103',
    title: '재산목록',
    templatePath: '/templates/court/hwpx/D5103_재산목록.hwpx',
    description: '예금, 보험, 부동산, 자동차 등 자산 평가'
  },
  {
    id: 'D5104',
    formCode: 'D5104',
    title: '수입 및 지출에 관한 목록',
    templatePath: '/templates/court/hwpx/D5104_수입지출목록.hwpx',
    description: '월평균 수입, 중위소득 대비 생계비 공제'
  },
  {
    id: 'D5105',
    formCode: 'D5105',
    title: '진술서',
    templatePath: '/templates/court/hwpx/D5105_진술서.hwpx',
    description: '채무 발생 경위, 학력/경력 사항'
  },
  {
    id: 'D5110',
    formCode: 'D5110',
    title: '변제계획안',
    templatePath: '/templates/court/hwpx/D5110_변제계획안.hwpx',
    description: '월 변제금, 변제 기간, 총 변제율'
  },
];

// ── 핵심 엔진 함수 ──

/**
 * HWPX 템플릿에 데이터를 주입하여 완성된 HWPX 파일을 생성합니다.
 * 
 * @param templateBuffer - HWPX 템플릿 파일의 ArrayBuffer
 * @param fieldData - 치환할 필드 데이터 (키-값 쌍)
 * @param fileName - 출력 파일명
 * @returns HwpxFillResult
 */
export async function fillHwpxTemplate(
  templateBuffer: ArrayBuffer,
  fieldData: HwpxFieldData,
  fileName: string = '법원서식.hwpx'
): Promise<HwpxFillResult> {
  const errors: string[] = [];
  const unresolvedFields: string[] = [];
  let replacedCount = 0;

  try {
    // 1. JSZip으로 HWPX(ZIP) 해제
    const zip = await JSZip.loadAsync(templateBuffer);

    // 2. Contents/ 내의 모든 section*.xml 파일 처리
    const sectionFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('Contents/section') && name.endsWith('.xml')
    );

    if (sectionFiles.length === 0) {
      errors.push('HWPX 파일에서 section XML을 찾을 수 없습니다.');
      return { success: false, blob: null, fileName, replacedCount: 0, unresolvedFields: [], errors };
    }

    for (const sectionPath of sectionFiles) {
      const sectionFile = zip.file(sectionPath);
      if (!sectionFile) continue;

      let xml = await sectionFile.async('string');

      // 3-A. {{placeholder}} 패턴 치환
      for (const [key, value] of Object.entries(fieldData)) {
        const escapedValue = escapeXmlText(value);
        const pattern = `{{${key}}}`;
        const count = (xml.match(new RegExp(escapeRegExp(pattern), 'g')) || []).length;
        if (count > 0) {
          xml = xml.replaceAll(pattern, escapedValue);
          replacedCount += count;
        }
      }

      // 3-B. 누름틀(CLICK_HERE) 필드 치환
      // <hp:fieldBegin ... name="필드명" ... /><hp:t>기존값</hp:t><hp:fieldEnd ... />
      for (const [key, value] of Object.entries(fieldData)) {
        const escapedValue = escapeXmlText(value);
        // 누름틀 필드의 텍스트 치환 정규표현식
        const fieldPattern = new RegExp(
          `(<hp:fieldBegin[^>]*name="${escapeRegExp(key)}"[^>]*/>\\s*<hp:t>)([^<]*)(</hp:t>\\s*<hp:fieldEnd)`,
          'g'
        );
        const matches = xml.match(fieldPattern);
        if (matches && matches.length > 0) {
          xml = xml.replace(fieldPattern, `$1${escapedValue}$3`);
          replacedCount += matches.length;
        }
      }

      // 4. 조판 캐시(linesegarray) 일괄 제거
      // 한컴오피스가 텍스트 변경 후 레이아웃을 자동 재계산하도록 합니다
      xml = xml.replace(/<hp:linesegarray[\s\S]*?<\/hp:linesegarray>/g, '');

      // 5. 수정된 XML 저장
      zip.file(sectionPath, xml);
    }

    // 6. 미치환 플레이스홀더 검출
    for (const sectionPath of sectionFiles) {
      const sectionFile = zip.file(sectionPath);
      if (!sectionFile) continue;
      const xml = await sectionFile.async('string');
      const remaining = xml.match(/\{\{([^}]+)\}\}/g);
      if (remaining) {
        unresolvedFields.push(...remaining.map(m => m.replace(/\{\{|\}\}/g, '')));
      }
    }

    // 7. mimetype은 반드시 STORE(무압충)으로 설정
    const mimetypeContent = 'application/hwp+zip';
    zip.file('mimetype', mimetypeContent, { compression: 'STORE' });

    // 8. 새 HWPX ZIP 생성
    const hwpxBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      // mimetype 파일을 첫 번째로 배치하는 것이 중요
      // JSZip은 파일 추가 순서대로 저장하므로 위에서 이미 처리됨
    });

    return {
      success: true,
      blob: hwpxBlob,
      fileName,
      replacedCount,
      unresolvedFields: [...new Set(unresolvedFields)],
      errors,
    };

  } catch (err) {
    errors.push(`HWPX 처리 오류: ${String(err)}`);
    return { success: false, blob: null, fileName, replacedCount: 0, unresolvedFields: [], errors };
  }
}

/**
 * HWPX 템플릿을 다운로드하고 데이터를 주입하여 완성된 파일을 사용자에게 제공합니다.
 * 
 * @param templatePath - 템플릿 파일 경로 (예: /templates/court/hwpx/D5101_개시신청서.hwpx)
 * @param fieldData - 치환할 필드 데이터
 * @param outputFileName - 출력 파일명
 */
export async function downloadFilledHwpx(
  templatePath: string,
  fieldData: HwpxFieldData,
  outputFileName: string
): Promise<void> {
  try {
    // 1. 템플릿 파일 로드
    toast.info('법원 양식 템플릿을 로드하고 있습니다...');
    const response = await fetch(templatePath);
    if (!response.ok) {
      toast.error(`템플릿 파일을 찾을 수 없습니다: ${templatePath}\n\n법원 전자민원센터(help.scourt.go.kr)에서 해당 양식의 HWPX 파일을 다운로드하여\npublic/templates/court/hwpx/ 폴더에 넣어주세요.`);
      return;
    }

    const templateBuffer = await response.arrayBuffer();

    // 2. 데이터 주입
    const result = await fillHwpxTemplate(templateBuffer, fieldData, outputFileName);

    if (!result.success || !result.blob) {
      toast.error(`HWPX 생성 실패: ${result.errors.join(', ')}`);
      return;
    }

    // 3. 미치환 필드 경고
    if (result.unresolvedFields.length > 0) {
      toast.warning(
        `${result.unresolvedFields.length}개 필드가 미치환 상태입니다: ${result.unresolvedFields.slice(0, 5).join(', ')}${result.unresolvedFields.length > 5 ? '...' : ''}`,
        { duration: 5000 }
      );
    }

    // 4. 다운로드 트리거
    triggerBlobDownload(result.blob, result.fileName);

    toast.success(
      `${result.fileName} 생성 완료 (${result.replacedCount}개 필드 자동 입력)`,
      { duration: 4000 }
    );

  } catch (err) {
    console.error('HWPX download error:', err);
    toast.error('HWPX 파일 생성 중 오류가 발생했습니다.');
  }
}

/**
 * HWPX 템플릿이 존재하는지 확인합니다.
 */
export async function checkHwpxTemplateExists(templatePath: string): Promise<boolean> {
  try {
    const response = await fetch(templatePath, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// ── 유틸리티 함수 ──

/** XML 특수문자 이스케이프 */
function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 정규표현식 특수문자 이스케이프 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Blob을 파일로 다운로드 */
function triggerBlobDownload(blob: Blob, fileName: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
