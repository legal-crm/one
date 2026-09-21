/**
 * hwpxTemplateEngine.ts
 * ============================================================
 * 대법원 전자소송용 법원 양식 데이터 바인딩 엔진
 * 
 * 지원 포맷:
 * - HWPX: JSZip으로 ZIP(XML) 해제 → 필드 치환 → 리패키징 (자동 바인딩)
 * - HWP: 법원 원본 양식 다운로드 제공 (수동 편집)
 * 
 * 대법원 공식 전산양식 D-Code 체계:
 * - D5100: 개시신청서 | D5101/D5102: 재산목록(정규/간이)
 * - D5103: 수입지출목록 | D5105: 진술서
 * - D5106/D5107: 채권자목록(정규/간이)
 * - D5110/D5111/D5112: 변제계획안(가용소득/재산처분/간이)
 * - D5113: 중지명령 | D5114: 금지명령
 * ============================================================
 */

import JSZip from 'jszip';
import { toast } from 'sonner';

// ── 타입 정의 ──

/** HWPX 템플릿 필드 데이터 (키-값 쌍) */
export interface HwpxFieldData {
  [fieldName: string]: string;
}

/** 법원 양식 템플릿 메타데이터 */
export interface CourtTemplateMeta {
  id: string;
  formCode: string;           // D5100, D5101, D5103, D5105, D5106, D5110, ...
  title: string;              // 국문 표준 명칭
  fileName: string;           // 실제 파일명
  templatePath: string;       // /templates/court/hwpx/...
  format: 'hwp' | 'hwpx' | 'xlsx';
  category: 'A_필수' | 'B_부속' | 'C_파산' | 'D_기타';
  priority: 'must-have' | 'nice-to-have' | 'optional';
  description: string;
  supportsAutoBind: boolean;  // HWPX 자동 바인딩 지원 여부
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

// ── 대법원 공식 D-Code 기반 양식 카탈로그 ──

export const COURT_TEMPLATE_CATALOG: CourtTemplateMeta[] = [
  // ═══ Group A: 개인회생 6대 필수 서류 + 핵심 부속 ═══
  {
    id: 'D5100',
    formCode: 'D5100',
    title: '개인회생절차 개시신청서',
    fileName: 'D5100_개시신청서.hwp',
    templatePath: '/templates/court/hwpx/D5100_개시신청서.hwp',
    format: 'hwp',
    category: 'A_필수',
    priority: 'must-have',
    description: '법원 메인 접수용 본안 서식 (인적사항, 신청취지, 신청이유)',
    supportsAutoBind: false,
  },
  {
    id: 'D5101',
    formCode: 'D5101',
    title: '재산목록',
    fileName: 'D5101_재산목록.hwp',
    templatePath: '/templates/court/hwpx/D5101_재산목록.hwp',
    format: 'hwp',
    category: 'A_필수',
    priority: 'must-have',
    description: '예금, 보험, 부동산, 자동차 등 11대 재산 평가 정식 양식',
    supportsAutoBind: false,
  },
  {
    id: 'D5103',
    formCode: 'D5103',
    title: '수입 및 지출에 관한 목록',
    fileName: 'D5103_수입지출목록.hwp',
    templatePath: '/templates/court/hwpx/D5103_수입지출목록.hwp',
    format: 'hwp',
    category: 'A_필수',
    priority: 'must-have',
    description: '월평균 소득, 중위소득 대비 생계비 공제 산출표',
    supportsAutoBind: false,
  },
  {
    id: 'D5105',
    formCode: 'D5105',
    title: '진술서',
    fileName: 'D5105_진술서.hwp',
    templatePath: '/templates/court/hwpx/D5105_진술서.hwp',
    format: 'hwp',
    category: 'A_필수',
    priority: 'must-have',
    description: '채무 발생 경위, 학력/경력, 주거 상황 소명',
    supportsAutoBind: false,
  },
  {
    id: 'D5106',
    formCode: 'D5106',
    title: '개인회생채권자목록',
    fileName: 'D5106_채권자목록.hwp',
    templatePath: '/templates/court/hwpx/D5106_채권자목록.hwp',
    format: 'hwp',
    category: 'A_필수',
    priority: 'must-have',
    description: '채권자별 원금/이자, 담보/무담보 구분 정식 양식',
    supportsAutoBind: false,
  },
  {
    id: 'D5110',
    formCode: 'D5110',
    title: '변제계획안 (가용소득)',
    fileName: 'D5110_변제계획안.hwp',
    templatePath: '/templates/court/hwpx/D5110_변제계획안.hwp',
    format: 'hwp',
    category: 'A_필수',
    priority: 'must-have',
    description: '가용소득만으로 변제하는 경우 (실무 90%+ 사용)',
    supportsAutoBind: false,
  },
  {
    id: 'D5111',
    formCode: 'D5111',
    title: '변제계획안 (재산처분 병행)',
    fileName: 'D5111_변제계획안_재산처분.hwp',
    templatePath: '/templates/court/hwpx/D5111_변제계획안_재산처분.hwp',
    format: 'hwp',
    category: 'A_필수',
    priority: 'nice-to-have',
    description: '가용소득 + 부동산/차량 처분 병행 변제 시 사용',
    supportsAutoBind: false,
  },
  {
    id: 'D5114',
    formCode: 'D5114',
    title: '금지명령 신청서',
    fileName: 'D5114_금지명령신청서.hwp',
    templatePath: '/templates/court/hwpx/D5114_금지명령신청서.hwp',
    format: 'hwp',
    category: 'B_부속',
    priority: 'must-have',
    description: '개시신청과 동시 접수 필수 — 독촉/압류 금지',
    supportsAutoBind: false,
  },
  {
    id: 'D5113',
    formCode: 'D5113',
    title: '중지명령 신청서',
    fileName: 'D5113_중지명령신청서.hwp',
    templatePath: '/templates/court/hwpx/D5113_중지명령신청서.hwp',
    format: 'hwp',
    category: 'B_부속',
    priority: 'nice-to-have',
    description: '이미 압류/경매 진행 중인 사건의 집행 중지',
    supportsAutoBind: false,
  },
  {
    id: 'XLSX_변제예정액표',
    formCode: 'XLSX',
    title: '변제예정액표 (엑셀)',
    fileName: '변제예정액표.xlsx',
    templatePath: '/templates/court/hwpx/변제예정액표.xlsx',
    format: 'xlsx',
    category: 'A_필수',
    priority: 'must-have',
    description: '변제계획안에 반드시 첨부하는 채권별 변제 예정액 계산표',
    supportsAutoBind: false,
  },
  {
    id: '위임장',
    formCode: '위임장',
    title: '위임장',
    fileName: '위임장.hwp',
    templatePath: '/templates/court/hwpx/위임장.hwp',
    format: 'hwp',
    category: 'D_기타',
    priority: 'must-have',
    description: '변호사/법무사 선임 시 필수 제출',
    supportsAutoBind: false,
  },
];

// Legacy 호환용 별칭
export const HWPX_TEMPLATE_CATALOG = COURT_TEMPLATE_CATALOG;

// ── 핵심 엔진 함수 ──

/**
 * HWPX 템플릿에 데이터를 주입하여 완성된 HWPX 파일을 생성합니다.
 * (HWPX 포맷 전용 — HWP 바이너리는 지원하지 않음)
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
    const zip = await JSZip.loadAsync(templateBuffer);

    const sectionFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('Contents/section') && name.endsWith('.xml')
    );

    if (sectionFiles.length === 0) {
      errors.push('HWPX 파일에서 section XML을 찾을 수 없습니다. HWP 바이너리 파일은 HWPX 자동 바인딩을 지원하지 않습니다.');
      return { success: false, blob: null, fileName, replacedCount: 0, unresolvedFields: [], errors };
    }

    for (const sectionPath of sectionFiles) {
      const sectionFile = zip.file(sectionPath);
      if (!sectionFile) continue;

      let xml = await sectionFile.async('string');

      // {{placeholder}} 패턴 치환
      for (const [key, value] of Object.entries(fieldData)) {
        const escapedValue = escapeXmlText(value);
        const pattern = `{{${key}}}`;
        const count = (xml.match(new RegExp(escapeRegExp(pattern), 'g')) || []).length;
        if (count > 0) {
          xml = xml.replaceAll(pattern, escapedValue);
          replacedCount += count;
        }
      }

      // 누름틀(CLICK_HERE) 필드 치환
      for (const [key, value] of Object.entries(fieldData)) {
        const escapedValue = escapeXmlText(value);
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

      // 조판 캐시(linesegarray) 일괄 제거
      xml = xml.replace(/<hp:linesegarray[\s\S]*?<\/hp:linesegarray>/g, '');

      zip.file(sectionPath, xml);
    }

    // 미치환 플레이스홀더 검출
    for (const sectionPath of sectionFiles) {
      const sectionFile = zip.file(sectionPath);
      if (!sectionFile) continue;
      const xml = await sectionFile.async('string');
      const remaining = xml.match(/\{\{([^}]+)\}\}/g);
      if (remaining) {
        unresolvedFields.push(...remaining.map(m => m.replace(/\{\{|\}\}/g, '')));
      }
    }

    // mimetype STORE 설정
    zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

    const hwpxBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
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
 * 법원 양식 파일을 다운로드합니다.
 * - HWPX: 데이터를 자동 주입하여 완성된 파일 생성
 * - HWP/XLSX: 원본 템플릿을 그대로 다운로드 (변호사가 한컴오피스에서 편집)
 */
export async function downloadFilledHwpx(
  templatePath: string,
  fieldData: HwpxFieldData,
  outputFileName: string
): Promise<void> {
  try {
    const isHwpx = templatePath.endsWith('.hwpx');

    toast.info('법원 양식 파일을 준비하고 있습니다...');
    const response = await fetch(templatePath);
    if (!response.ok) {
      toast.error(`양식 파일을 찾을 수 없습니다: ${templatePath}`);
      return;
    }

    if (isHwpx) {
      // HWPX: 자동 데이터 바인딩
      const templateBuffer = await response.arrayBuffer();
      const result = await fillHwpxTemplate(templateBuffer, fieldData, outputFileName);

      if (!result.success || !result.blob) {
        toast.error(`HWPX 생성 실패: ${result.errors.join(', ')}`);
        return;
      }

      if (result.unresolvedFields.length > 0) {
        toast.warning(
          `${result.unresolvedFields.length}개 필드가 미치환 상태입니다`,
          { duration: 5000 }
        );
      }

      triggerBlobDownload(result.blob, result.fileName);
      toast.success(`${result.fileName} 생성 완료 (${result.replacedCount}개 필드 자동 입력)`);
    } else {
      // HWP/XLSX: 원본 다운로드 + CRM 데이터 참조 안내
      const blob = await response.blob();
      triggerBlobDownload(blob, outputFileName);
      toast.success(
        `${outputFileName} 다운로드 완료. 한컴오피스에서 열어 CRM 데이터를 참고하여 편집해 주세요.`,
        { duration: 5000 }
      );
    }
  } catch (err) {
    console.error('Court form download error:', err);
    toast.error('법원 양식 파일 다운로드 중 오류가 발생했습니다.');
  }
}

/**
 * 법원 양식 템플릿이 존재하는지 확인합니다.
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

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
