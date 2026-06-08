/**
 * PolicyConfig - 2026년 기준 개인회생 변제금 계산 설정값
 * 
 * 이 파일의 값들은 관리자 설정에서 동적으로 override 가능합니다.
 */

export interface RehabPolicyConfig {
    baseYear: number;
    // 가구원수별 중위소득 (1~6인)
    medianIncome: Record<number, number>;
    // 5인 이상 시 1인당 추가금액
    medianIncomeIncrement: number;
    // 2026년 확정 인정 생계비 (1.5/2.5인 포함)
    recognizedLivingCost: Record<number, number>;
    // 지역별 보증금 공제 기준
    depositExemptions: Record<string, { limit: number; deduct: number }>;
    // 지역별 추가 주거비 인정 한도 (신규)
    // 지역별 추가 주거비 인정 한도 (신규 - 가구원수별 상세)
    additionalHousingCosts: Record<string, Record<number, { limit: number; included: number; totalLimit: number }>>;
    // 의료비 중위소득 60% 포함분 (가구원수별)
    medicalCostIncluded: Record<number, number>;
    // 교육비 기준 (1인당)
    educationCostCriteria: { included: number; limit: number; specialLimit: number };
    // 고소득자(기타생계비) 설정
    highIncomeConfig: { thresholdRate: number; maxLivingCostRate: number; minRepaymentRate: number };
    // 생계비 인정률 (기본 60%)
    livingCostRate: number;
    // 법원별 성향
    courtTraits: Record<string, CourtTrait>;
    // 지역->법원 매핑
    regionToCourtMap: Record<string, string>;
    // 지역별 그룹 (Seoul, Overcrowded, Metro, Others)
    regionToGroupMap: Record<string, string>;
}

export interface CourtTrait {
    name: string;
    allow24Months: boolean;      // 24개월 단축 가능 여부
    spousePropertyRate: number;  // 배우자 재산 반영률 (0.0 ~ 1.0)
    investLossInclude: boolean;  // 투기성 손실금 청산가치 반영 여부 (신규)
    processingMonths: number;    // 개시결정까지 소요기간 (개월) - 2025년 상반기 기준
    description?: string;        // 법원 성향 설명
}

/**
 * 2026년 기준 정책 설정 (기본값)
 * 실제 값은 정부 발표 후 업데이트 필요
 */
// 2026년 기준 정책 설정 (기본값)
export const DEFAULT_POLICY_CONFIG_2026: RehabPolicyConfig = {
    baseYear: 2026,

    // 2026년 기준 중위소득 60% (인정 생계비) - 2026년 확정치
    medianIncome: {
        1: 2564238,   // 1인 가구 중위소득
        2: 4199292,   // 2인 가구 중위소득
        3: 5359036,   // 3인 가구 중위소득
        4: 6494738,   // 4인 가구 중위소득
        5: 7556719,   // 5인 가구
        6: 8555952,   // 6인 가구
    },
    medianIncomeIncrement: 999233, // 6인 초과 시 1인당 추가분 (6인 - 5인 차액)
    // 2026년 확정 인정 생계비 (중위소득 60%)
    recognizedLivingCost: {
        1: 1538543,     // 1인 가구
        2: 2519575,     // 2인 가구
        3: 3215422,     // 3인 가구
        4: 3896843,     // 4인 가구
        5: 4534031,     // 5인 가구
        6: 5133571,     // 6인 가구
    } as Record<number, number>,

    // 지역별 보증금 공제 기준 (2026년 확정) - 그룹명 변경
    depositExemptions: {
        '서울특별시': { limit: 165000000, deduct: 55000000 },       // 서울: 1억 6500만원 이하 / 5500만원 공제
        '과밀억제권역': { limit: 145000000, deduct: 48000000 },     // 과밀억제권역: 1억 4500만원 이하 / 4800만원 공제
        '광역시기준': { limit: 85000000, deduct: 28000000 },        // 광역시: 8500만원 이하 / 2800만원 공제
        '그외': { limit: 75000000, deduct: 25000000 }               // 그 외: 7500만원 이하 / 2500만원 공제
    },

    // 생계비 인정률
    livingCostRate: 0.6,

    // 지역별 추가 주거비 인정 한도 (신규 - 2026년 서울회생법원 기준)
    // 지역별 추가 주거비 인정 한도 (2026년 기준)
    // 구조: 지역그룹 -> 가구원수 -> { 한도(limit), 기본포함분(included) }
    additionalHousingCosts: {
        '서울특별시': {
            1: { limit: 589208, included: 273861, totalLimit: 863069 },
            2: { limit: 982013, included: 448484, totalLimit: 1430497 },
            3: { limit: 1253955, included: 572345, totalLimit: 1826300 },
            4: { limit: 1510789, included: 693638, totalLimit: 2204427 },
        },
        '과밀억제권역': {
            1: { limit: 430122, included: 273861, totalLimit: 703983 },
            2: { limit: 716869, included: 448484, totalLimit: 1165353 },
            3: { limit: 915387, included: 572345, totalLimit: 1487732 },
            4: { limit: 1102876, included: 693638, totalLimit: 1796514 },
        },
        '광역시기준': {
            1: { limit: 229791, included: 273861, totalLimit: 503652 },
            2: { limit: 382985, included: 448484, totalLimit: 831469 },
            3: { limit: 489042, included: 572345, totalLimit: 1061387 },
            4: { limit: 589208, included: 693638, totalLimit: 1282846 },
        },
        '그외': {
            1: { limit: 176762, included: 273861, totalLimit: 450623 },
            2: { limit: 294604, included: 448484, totalLimit: 743088 },
            3: { limit: 376186, included: 572345, totalLimit: 948531 },
            4: { limit: 453237, included: 693638, totalLimit: 1146875 },
        }
    },

    // 의료비 공제 기준 (2026년 - 중위소득 60% 포함분)
    medicalCostIncluded: {
        1: 64619,
        2: 105822,
        3: 135048,
        4: 163667,
        5: 192286, // 추정치 (4인 + diff average)
        6: 220905, // 추정치
    },

    // 교육비 공제 기준 (2026년 - 자녀 1인당)
    educationCostCriteria: {
        included: 89627,      // 중위소득 60% 포함분
        limit: 200000,        // 일반 교육비 추가 인정 한도
        specialLimit: 500000, // 특수 교육비 추가 인정 한도
    },

    // 고소득자(기타생계비) 적용 기준 (2026년 제도 개편)
    highIncomeConfig: {
        thresholdRate: 1.5,      // 중위소득 150% 초과 시 적용
        maxLivingCostRate: 1.0,  // 총 생계비 공제 한도 (중위소득 100% 이하)
        minRepaymentRate: 0.4,   // 최소 변제율 40% 이상 (미충족 시 생계비 감액)
    },

    // 법원별 성향 (2026년 2월 기준 14개 법원)
    courtTraits: {
        '서울회생법원': {
            name: '서울회생법원',
            allow24Months: true,
            spousePropertyRate: 0.0,
            investLossInclude: false,
            processingMonths: 5.1,
            description: '전국 가장 선진적 기준, 채무자 친화적'
        },
        '수원회생법원': {
            name: '수원회생법원',
            allow24Months: true,
            spousePropertyRate: 0.0,
            investLossInclude: false,
            processingMonths: 4.4,
            description: '신설법원, 빠른 처리, 서울과 동일 기준'
        },
        '부산회생법원': {
            name: '부산회생법원',
            allow24Months: true,
            spousePropertyRate: 0.0,
            investLossInclude: false,
            processingMonths: 7.8,
            description: '신설법원, 업무 과부하 있으나 기준은 서울 동일'
        },
        '인천지방법원': {
            name: '인천지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 3.3,
            description: '가장 빠른 처리(3.3개월), 채무자 친화적'
        },
        '의정부지방법원': {
            name: '의정부지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 12.0,
            description: '전국 가장 느린 처리(~12개월), 회피 권고'
        },
        '춘천지방법원': {
            name: '춘천지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 2.2,
            description: '매우 빠름 (강릉지원은 9.4개월로 편차 큼)'
        },
        '청주지방법원': {
            name: '청주지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 5.7,
            description: '보통 처리 속도, 기준 보수적'
        },
        '대전지방법원': {
            name: '대전지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 7.3,
            description: '2026년 3월 회생법원 개원 예정 (신설 후 3~4개월 단축)'
        },
        '대구지방법원': {
            name: '대구지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 12.0,
            description: '현재 매우 느림(~1년), 2026년 3월 회생법원 개원 후 개선 예상'
        },
        '광주지방법원': {
            name: '광주지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 4.5,
            description: '빠른 처리, 2026년 3월 회생법원 개원 예정'
        },
        '전주지방법원': {
            name: '전주지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 7.0,
            description: '보통 처리 속도 (6~7.7개월)'
        },
        '제주지방법원': {
            name: '제주지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 9.3,
            description: '처리가 느린 편 (6~9.3개월)'
        },
        '울산지방법원': {
            name: '울산지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 4.8,
            description: '높은 인가율(81.7%), 부산회생법원 관할 권고'
        },
        '창원지방법원': {
            name: '창원지방법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 6.7,
            description: '보통 속도, 부산회생법원 관할 권고'
        },
        'Default': {
            name: '기타 법원',
            allow24Months: false,
            spousePropertyRate: 0.5,
            investLossInclude: true,
            processingMonths: 6.0,
            description: '일반 지방법원 기준 적용'
        }
    },

    // 지역 -> 관할 법원 매핑 (2026년 2월 기준)
    regionToCourtMap: {
        // 서울
        '서울': '서울회생법원',
        '서울특별시': '서울회생법원',
        // 경기 남부
        '수원': '수원회생법원',
        '성남': '수원회생법원',
        '용인': '수원회생법원',
        '화성': '수원회생법원',
        '안양': '수원회생법원',
        '안산': '수원회생법원',
        '평택': '수원회생법원',
        '시흥': '수원회생법원',
        '광명': '수원회생법원',
        '군포': '수원회생법원',
        '오산': '수원회생법원',
        '이천': '수원회생법원',
        '안성': '수원회생법원',
        '의왕': '수원회생법원',
        '여주': '수원회생법원',
        '양평': '수원회생법원',
        '과천': '수원회생법원',
        '광주': '수원회생법원', // 경기 광주
        // 경기 북부 (의정부)
        '의정부': '의정부지방법원',
        '고양': '의정부지방법원',
        '남양주': '의정부지방법원',
        '파주': '의정부지방법원',
        '구리': '의정부지방법원',
        '양주': '의정부지방법원',
        '포천': '의정부지방법원',
        '동두천': '의정부지방법원',
        '가평': '의정부지방법원',
        '연천': '의정부지방법원',
        // 인천/부천
        '인천': '인천지방법원',
        '인천광역시': '인천지방법원',
        '부천': '인천지방법원',
        '김포': '인천지방법원',
        // 강원
        '춘천': '춘천지방법원',
        '강릉': '춘천지방법원',
        '원주': '춘천지방법원',
        '속초': '춘천지방법원',
        // 대전/세종/충청
        '대전': '대전지방법원',
        '세종': '대전지방법원',
        '천안': '대전지방법원',
        '공주': '대전지방법원',
        '논산': '대전지방법원',
        '보령': '대전지방법원',
        '서산': '대전지방법원',
        '청주': '청주지방법원',
        '충주': '청주지방법원',
        '제천': '청주지방법원',
        // 대구/경북
        '대구': '대구지방법원',
        '경산': '대구지방법원',
        '포항': '대구지방법원',
        '구미': '대구지방법원',
        '경주': '대구지방법원',
        '안동': '대구지방법원',
        '김천': '대구지방법원',
        // 부산/울산/경남
        '부산': '부산회생법원',
        '울산': '울산지방법원', // 2026 파일 기준 울산지방법원 별도 표기
        '창원': '창원지방법원',
        '김해': '창원지방법원',
        '진주': '창원지방법원',
        '양산': '울산지방법원', // 양산은 울산지법 관할
        '거제': '창원지방법원',
        '통영': '창원지방법원',
        // 광주/전라/제주
        '광주광역시': '광주지방법원',
        '목포': '광주지방법원',
        '순천': '광주지방법원',
        '여수': '광주지방법원',
        '전주': '전주지방법원',
        '익산': '전주지방법원',
        '군산': '전주지방법원',
        '정읍': '전주지방법원',
        '남원': '전주지방법원',
        '제주': '제주지방법원',
    },

    // 지역 -> 그룹 매핑 (보증금 공제용)
    regionToGroupMap: {
        // 서울
        '서울': '서울특별시',
        '서울특별시': '서울특별시',
        // 과밀억제권역 (수도권 일부)
        '고양': '과밀억제권역',
        '성남': '과밀억제권역',
        '부천': '과밀억제권역',
        '안양': '과밀억제권역',
        '수원': '과밀억제권역',
        '의정부': '과밀억제권역',
        '남양주': '과밀억제권역',
        '구리': '과밀억제권역',
        '하남': '과밀억제권역',
        '인천': '과밀억제권역',
        '시흥': '과밀억제권역',
        '광명': '과밀억제권역',
        '군포': '과밀억제권역',
        '의왕': '과밀억제권역',
        // 광역시
        '부산': '광역시기준',
        '대구': '광역시기준',
        '인천광역시': '광역시기준',
        '광주광역시': '광역시기준',
        '대전': '광역시기준',
        '울산': '광역시기준',
        '세종': '광역시기준',
    }
};

/**
 * 연도별 정책 설정 (2026 ~ 2035)
 * 기본적으로 2026년 설정을 복사하여 초기화
 */
export const POLICY_CONFIG_BY_YEAR: Record<number, RehabPolicyConfig> = {
    2026: DEFAULT_POLICY_CONFIG_2026
};

// 2027년부터 2035년까지 기본값 생성 (2026년 복사)
for (let year = 2027; year <= 2035; year++) {
    POLICY_CONFIG_BY_YEAR[year] = {
        ...DEFAULT_POLICY_CONFIG_2026,
        baseYear: year
    };
}

/**
 * 특정 연도의 정책 가져오기
 */
export function getPolicyForYear(year: number): RehabPolicyConfig {
    return POLICY_CONFIG_BY_YEAR[year] || POLICY_CONFIG_BY_YEAR[2026];
}

/**
 * 날짜 기준 정책 가져오기 (자동 스위칭)
 * - 2026-12-31까지: 2026년 정책
 * - 2027-01-01부터: 해당 연도 정책
 */
export function getPolicyForDate(date: Date = new Date()): RehabPolicyConfig {
    const year = date.getFullYear();

    // 2026년 이하는 2026년 정책 사용
    if (year <= 2026) {
        return POLICY_CONFIG_BY_YEAR[2026];
    }

    // 2027년 이상은 해당 연도 사용 (없으면 2035 or 2026 fallback)
    return POLICY_CONFIG_BY_YEAR[year] || POLICY_CONFIG_BY_YEAR[2035] || POLICY_CONFIG_BY_YEAR[2026];
}


/**
 * 주소에서 지역명 추출
 */
export function extractRegionFromAddress(address: string): string {
    // 시/군/구 단위 추출
    const patterns = [
        /서울|서울특별시/,
        /부산|부산광역시/,
        /대구|대구광역시/,
        /인천|인천광역시/,
        /광주광역시/,
        /대전|대전광역시/,
        /울산|울산광역시/,
        /세종|세종특별자치시/,
        /고양|성남|용인|수원|화성|안산|안양|평택|시흥|김포|광명|군포|오산|이천|안성|하남|의왕|여주|양평|과천|부천/,
        /의정부|남양주|파주|구리|양주|포천|동두천|가평|연천/,
        /창원|김해|양산|진주|거제|통영/,
        /천안|청주|충주|제천/,
        /전주|익산|군산|목포|여수|순천/,
        /포항|구미|경주|안동|경산/,
    ];

    for (const pattern of patterns) {
        const match = address.match(pattern);
        if (match) return match[0];
    }

    return '기타';
}

/**
 * 지역에서 관할 법원 가져오기
 */
export function getCourtForRegion(region: string, config: RehabPolicyConfig): string {
    return config.regionToCourtMap[region] || 'Default';
}

/**
 * 지역에서 보증금 그룹 가져오기
 */
export function getRegionGroup(region: string, config: RehabPolicyConfig): string {
    return config.regionToGroupMap[region] || '그외';
}

/**
 * 가구원수에 따른 중위소득 계산
 */
export function getMedianIncome(familySize: number, config: RehabPolicyConfig): number {
    if (familySize <= 6) {
        return config.medianIncome[familySize] || config.medianIncome[1];
    }
    // 6인 초과
    return config.medianIncome[6] + (familySize - 6) * config.medianIncomeIncrement;
}

/**
 * 가구원수에 따른 인정 생계비 계산 (소수점 지원)
 * 미성년 자녀 1인당 0.5 추가, 소수점은 양쪽 값의 중간값 적용
 */
export function getRecognizedLivingCost(familySize: number, config: RehabPolicyConfig): number {
    // 정수인 경우 바로 반환
    if (Number.isInteger(familySize) && config.recognizedLivingCost[familySize]) {
        return config.recognizedLivingCost[familySize];
    }

    // 소수점인 경우 양쪽 값의 중간값 계산
    const lower = Math.floor(familySize);
    const upper = Math.ceil(familySize);
    const fraction = familySize - lower;

    const lowerCost = config.recognizedLivingCost[lower] || config.recognizedLivingCost[1];
    const upperCost = config.recognizedLivingCost[upper] || config.recognizedLivingCost[6];

    // 선형 보간 (예: 1.5인 = 1인 생계비 + (2인 생계비 - 1인 생계비) * 0.5)
    return Math.round(lowerCost + (upperCost - lowerCost) * fraction);
}
