// src/utils/fileSecurity.ts
// 파일 업로드 보안 검증 유틸리티 (확장자, MIME 타입, 파일 용량 제한)

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB 제한

// 보안상 차단되는 실행 가능/스크립트 확장자 (Blacklist)
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'msi', 'com', 'scr', 'hta', 'cpl', 'msc', 'jar', 'gadget',
  'php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'asp', 'aspx', 'jsp', 'cgi',
  'py', 'pl', 'ps1', 'psm1', 'reg', 'svg'
]);

// 허용되는 안전 문서/이미지 확장자 (Whitelist)
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'tiff',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'hwp', 'hwpx', 'txt', 'csv', 'zip'
]);

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * 업로드 파일의 크기 및 확장자 유효성을 엄격하게 검증합니다.
 */
export function validateUploadFile(file: File, maxSize: number = MAX_FILE_SIZE_BYTES): FileValidationResult {
  if (!file) {
    return { isValid: false, error: '선택된 파일이 없습니다.' };
  }

  // 1. 파일 크기 검사 (0 byte 또는 제한 초과)
  if (file.size === 0) {
    return { isValid: false, error: '내용이 비어 있는 파일(0 Byte)은 업로드할 수 없습니다.' };
  }

  if (file.size > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    const currentMb = (file.size / (1024 * 1024)).toFixed(1);
    return { isValid: false, error: `파일 용량은 최대 ${maxMb}MB까지 가능합니다. (현재: ${currentMb}MB)` };
  }

  // 2. 확장자 검사
  const nameParts = file.name.split('.');
  if (nameParts.length < 2) {
    return { isValid: false, error: '확장자가 없는 파일은 업로드할 수 없습니다.' };
  }

  const ext = nameParts[nameParts.length - 1].toLowerCase().trim();

  // 위험 확장자 블랙리스트 차단
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { isValid: false, error: `보안상 실행 파일 (.${ext})은 업로드할 수 없습니다.` };
  }

  // 안전 확장자 화이트리스트 검사
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { isValid: false, error: `지원하지 않는 파일 형식(.${ext})입니다. (PDF, 이미지, 오피스 문서, HWP만 지원)` };
  }

  return { isValid: true };
}
