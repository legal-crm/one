// ============================================================
// 국세청 사업자등록정보 진위확인 및 상태조회 서비스
// 공공데이터포털(data.go.kr) 국세청 API 연동 (API 키 미설정 시 Mock 시뮬레이션 지원)
// ============================================================

const NTS_SERVICE_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_NTS_SERVICE_KEY) || '';

export interface NtsValidateParams {
  businessNumber: string; // 10자리 (하이픈 포함 가능)
  openingDate: string;    // 개업일자 YYYYMMDD 또는 YYYY-MM-DD
  representativeName: string; // 대표자 성명
}

export interface NtsValidateResult {
  success: boolean;
  isValid: boolean; // 정보 일치 여부 (01: 일치)
  status: 'VALID' | 'INVALID' | 'CLOSED' | 'SUSPENDED'; // 계속사업자, 불일치, 폐업, 휴업
  statusCode: string; // '01': 계속사업자, '02': 휴업자, '03': 폐업자
  statusName: string; // "계속사업자", "폐업자", "휴업자"
  taxType?: string;   // 부가가치세 일반과세자, 간이과세자, 면세과세자 등
  txId: string;       // 국세청 확인 거래번호
  checkedAt: string;  // 검증 일시
  error?: string;
}

/**
 * 사업자등록번호 및 개업일자, 대표자명 진위확인
 */
export async function validateBusinessRegistration(params: NtsValidateParams): Promise<NtsValidateResult> {
  const cleanBizNum = params.businessNumber.replace(/[^0-9]/g, '');
  const cleanDate = params.openingDate.replace(/[^0-9]/g, '');
  const cleanRepName = params.representativeName.trim();

  // 기본 유효성 검사
  if (cleanBizNum.length !== 10) {
    return {
      success: false,
      isValid: false,
      status: 'INVALID',
      statusCode: '',
      statusName: '사업자등록번호 오류',
      txId: '',
      checkedAt: new Date().toISOString(),
      error: '사업자등록번호는 숫자 10자리여야 합니다.',
    };
  }

  if (cleanDate.length !== 8) {
    return {
      success: false,
      isValid: false,
      status: 'INVALID',
      statusCode: '',
      statusName: '개업일자 오류',
      txId: '',
      checkedAt: new Date().toISOString(),
      error: '개업일자는 YYYYMMDD 8자리 형식이어야 합니다.',
    };
  }

  if (!cleanRepName) {
    return {
      success: false,
      isValid: false,
      status: 'INVALID',
      statusCode: '',
      statusName: '대표자명 누락',
      txId: '',
      checkedAt: new Date().toISOString(),
      error: '대표자 성명을 입력해 주세요.',
    };
  }

  // 실제 공공데이터포털 API 키가 있으면 호출
  if (NTS_SERVICE_KEY) {
    try {
      const url = `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${encodeURIComponent(NTS_SERVICE_KEY)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          businesses: [
            {
              b_no: cleanBizNum,
              start_dt: cleanDate,
              p_nm: cleanRepName,
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`국세청 API 응답 오류: HTTP ${response.status}`);
      }

      const json = await response.json();
      const item = json.data?.[0];

      if (!item) {
        throw new Error('국세청 조회 결과 데이터가 없습니다.');
      }

      const isValid = item.valid === '01'; // 01: 일치, 02: 불일치
      const statusCode = item.status?.b_stt_cd || (isValid ? '01' : '02');
      const statusName = item.status?.b_stt || (isValid ? '계속사업자' : '등록정보 불일치');

      let status: 'VALID' | 'INVALID' | 'CLOSED' | 'SUSPENDED' = 'VALID';
      if (!isValid) {
        status = 'INVALID';
      } else if (statusCode === '02') {
        status = 'SUSPENDED';
      } else if (statusCode === '03') {
        status = 'CLOSED';
      }

      return {
        success: true,
        isValid,
        status,
        statusCode,
        statusName,
        taxType: item.status?.tax_type || '-',
        // 국세청 API는 거래번호를 주지 않음 → 조회 시각 기반 내부 참조값임을 명시 (이전: 'NTS-TX-…'로 공식 번호처럼 표시)
        txId: `LOCAL-REF-${Date.now()}`,
        checkedAt: new Date().toISOString(),
        error: isValid ? undefined : (item.valid_msg || '국세청에 등록된 대표자명 또는 개업일자와 일치하지 않습니다.'),
      };
    } catch (err: any) {
      // 실제 조회 실패는 실패로 반환 (이전: 시뮬레이션으로 폴백 → 장애 중에도 '계속사업자(정상)' 표시)
      console.warn('[NTS Service] API 호출 실패:', err.message);
      return {
        success: false,
        isValid: false,
        status: 'INVALID',
        statusCode: '',
        statusName: '국세청 조회 실패',
        txId: '',
        checkedAt: new Date().toISOString(),
        error: '국세청 사업자 상태 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  }

  // 키 미설정: 개발 환경에서만 시뮬레이션 (이전: 운영에서도 모든 번호를 '계속사업자(정상)'·가짜 거래번호로 통과)
  if (import.meta.env.DEV) {
    return simulateDemoNtsValidation(cleanBizNum, cleanDate, cleanRepName);
  }
  return {
    success: false,
    isValid: false,
    status: 'INVALID',
    statusCode: '',
    statusName: '국세청 조회 미설정',
    txId: '',
    checkedAt: new Date().toISOString(),
    error: '국세청 사업자 진위확인 서비스가 설정되지 않아 확인하지 못했습니다.',
  };
}

/**
 * 데모 모드 시뮬레이션
 */
async function simulateDemoNtsValidation(bNo: string, startDt: string, pNm: string): Promise<NtsValidateResult> {
  // 1초 지연 효과
  await new Promise(resolve => setTimeout(resolve, 800));

  // 번호 끝자리가 '9999'면 폐업 테스트용
  if (bNo.endsWith('9999')) {
    return {
      success: true,
      isValid: true,
      status: 'CLOSED',
      statusCode: '03',
      statusName: '폐업자',
      taxType: '폐업사업자',
      txId: `NTS-MOCK-${Date.now()}-03`,
      checkedAt: new Date().toISOString(),
      error: '해당 사업자는 국세청에 [폐업]으로 등록되어 있어 계약 체결이 불가능합니다.'
    };
  }

  // 번호 끝자리가 '0000'이면 정보 불일치 테스트용
  if (bNo.endsWith('0000')) {
    return {
      success: true,
      isValid: false,
      status: 'INVALID',
      statusCode: '02',
      statusName: '등록정보 불일치',
      txId: `NTS-MOCK-${Date.now()}-00`,
      checkedAt: new Date().toISOString(),
      error: '국세청에 등록된 대표자명 또는 개업일자가 일치하지 않습니다.'
    };
  }

  // 일반적인 정상 검증 통과
  return {
    success: true,
    isValid: true,
    status: 'VALID',
    statusCode: '01',
    statusName: '계속사업자 (정상)',
    taxType: '부가가치세 일반과세자',
    txId: `DEV-SIM-${Date.now()}`,
    checkedAt: new Date().toISOString(),
  };
}

export function isNtsConfigured(): boolean {
  return !!NTS_SERVICE_KEY;
}
