/**
 * 2025년 개인회생 통계 데이터
 * 서울회생법원 통계 자료 기반
 */

export interface StatisticalDistribution {
    range: string;
    percentage: number;
    label?: string;
}

export interface RehabStatistics2025 {
    // 연령대별 분포
    ageDistribution: StatisticalDistribution[];

    // 성별 분포
    genderDistribution: {
        male: number;
        female: number;
    };

    // 부양가족 분포
    familySizeDistribution: StatisticalDistribution[];

    // 혼인 상태
    maritalStatusDistribution: {
        married: number;
        single: number;
    };

    // 채무 총액 분포
    debtAmountDistribution: StatisticalDistribution[];

    // 변제율 분포
    debtReductionRateDistribution: StatisticalDistribution[];

    // 월 소득 분포
    monthlyIncomeDistribution: StatisticalDistribution[];

    // 생계비 인정 비율
    livingCostRecognitionRate: {
        within60Percent: number; // 1인 가구 기준 중위소득 60% 이하
        above60Percent: number;
    };
}

export const REHAB_STATISTICS_2025: RehabStatistics2025 = {
    // 연령대별 분포 (2025 상반기)
    ageDistribution: [
        { range: '29세 이하', percentage: 9.5 },
        { range: '30-39세', percentage: 26.5 },
        { range: '40-49세', percentage: 28.0 },
        { range: '50-59세', percentage: 24.3 },
        { range: '60세 이상', percentage: 11.3 }
    ],

    // 성별 분포
    genderDistribution: {
        male: 57.2,
        female: 42.8
    },

    // 부양가족 분포
    familySizeDistribution: [
        { range: '1인', percentage: 78.2, label: '1인 가구' },
        { range: '1인 초과 2인 이하', percentage: 17.5, label: '2인 가구' },
        { range: '2인 초과 3인 이하', percentage: 3.6, label: '3인 가구' },
        { range: '3인 초과 4인 이하', percentage: 0.6, label: '4인 이상' }
    ],

    // 혼인 상태
    maritalStatusDistribution: {
        married: 38.7,
        single: 61.3
    },

    // 채무 총액 분포
    debtAmountDistribution: [
        { range: '5천만원 이하', percentage: 13.0 },
        { range: '5천만원 초과 1억 이하', percentage: 39.0 },
        { range: '1억 초과 2억 이하', percentage: 27.8 },
        { range: '2억 초과 3억 이하', percentage: 8.6 },
        { range: '3억 초과 4억 이하', percentage: 4.1 },
        { range: '4억 초과', percentage: 7.5 }
    ],

    // 변제율 분포
    debtReductionRateDistribution: [
        { range: '10% 미만', percentage: 6.8 },
        { range: '10% 이상 20% 미만', percentage: 26.1 },
        { range: '20% 이상 30% 미만', percentage: 21.2 },
        { range: '30% 이상 40% 미만', percentage: 16.7 },
        { range: '40% 이상 50% 미만', percentage: 10.1 },
        { range: '50% 이상 60% 미만', percentage: 6.1 },
        { range: '60% 이상 70% 미만', percentage: 3.9 },
        { range: '70% 이상 80% 미만', percentage: 2.4 },
        { range: '80% 이상 90% 미만', percentage: 1.7 },
        { range: '90% 이상', percentage: 5.0 }
    ],

    // 월 소득 분포
    monthlyIncomeDistribution: [
        { range: '100만원 이하', percentage: 0.1 },
        { range: '100만원 초과 150만원 이하', percentage: 4.0 },
        { range: '150만원 초과 200만원 이하', percentage: 26.0 },
        { range: '200만원 초과 250만원 이하', percentage: 28.7 },
        { range: '250만원 초과 300만원 이하', percentage: 18.5 },
        { range: '300만원 초과', percentage: 23.7 }
    ],

    // 생계비 인정 비율
    livingCostRecognitionRate: {
        within60Percent: 58.5,
        above60Percent: 41.5
    }
};

/**
 * 평균값 계산 헬퍼
 */
export const AVERAGE_VALUES = {
    debtReductionRate: 33.2, // 평균 변제율
    monthlyIncome: 2360000, // 평균 월 소득 (약 236만원)
    totalDebt: 96960000, // 평균 총 채무 (약 9,696만원)
    monthlyPayment: 2260000 // 평균 월 변제금 (약 226만원)
};
