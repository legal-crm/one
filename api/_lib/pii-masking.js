/**
 * 개인정보 보호 유틸리티 (v2.0)
 * OCR 결과에서 추출된 텍스트 내 주민등록번호 뒷자리를 마스킹
 * Gemini API에 전송하는 이미지 자체의 마스킹은 서버사이드에서는 불가하므로,
 * 응답 데이터에서 주민번호가 포함된 경우 뒷자리를 *로 치환하여 클라이언트에 반환
 */

/**
 * 주민등록번호 뒷자리 마스킹
 * 패턴: YYMMDD-NNNNNNN → YYMMDD-N******
 * 외국인등록번호도 동일 패턴
 */
export function maskResidentNumber(text) {
  if (!text) return text;
  // 전체 주민번호 패턴: 6자리-7자리
  return text.replace(
    /(\d{6})\s*[-–]\s*(\d)(\d{6})/g,
    '$1-$2******'
  );
}

/**
 * 객체 내 모든 문자열 값에 대해 재귀적으로 주민번호 마스킹 적용
 */
export function maskPiiInObject(obj) {
  if (typeof obj === 'string') {
    return maskResidentNumber(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => maskPiiInObject(item));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = maskPiiInObject(value);
    }
    return result;
  }
  return obj;
}
