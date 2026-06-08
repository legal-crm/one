/**
 * 통계 계산 유틸리티
 * 사용자 데이터를 2025년 통계와 비교하여 백분위 및 인사이트 생성
 */

import { REHAB_STATISTICS_2025, AVERAGE_VALUES, StatisticalDistribution } from '../config/rehabStatistics2025';

/**
 * 백분위 계산 결과
 */
export interface PercentileResult {
    percentile: number; // 0-100
    rank: 'top' | 'above_average' | 'average' | 'below_average'; // 상위/평균이상/평균/평균이하
    message: string; // "상위 30%", "평균보다 높음" 등
    color: 'green' | 'blue' | 'yellow' | 'red'; // 색상 코드
}

/**
 * 분포에서 사용자의 백분위 계산
 */
function calculatePercentileFromDistribution(
    value: number,
    distribution: StatisticalDistribution[],
    getRangeValue: (range: string) => { min: number; max: number }
): PercentileResult {
    let cumulativePercentage = 0;
    let userPercentile = 50; // 기본값

    for (const item of distribution) {
        const { min, max } = getRangeValue(item.range);

        if (value >= min && value <= max) {
            // 해당 구간 내에서의 위치 추정
            const rangePosition = (value - min) / (max - min);
            userPercentile = cumulativePercentage + (item.percentage * rangePosition);
            break;
        }

        if (value < min) {
            userPercentile = cumulativePercentage;
            break;
        }

        cumulativePercentage += item.percentage;
    }

    return createPercentileResult(userPercentile);
}

/**
 * 백분위 숫자를 결과 객체로 변환
 */
function createPercentileResult(percentile: number): PercentileResult {
    const rank = percentile >= 75 ? 'top' :
        percentile >= 50 ? 'above_average' :
            percentile >= 25 ? 'average' : 'below_average';

    const message = percentile >= 90 ? `상위 ${(100 - percentile).toFixed(0)}%` :
        percentile >= 75 ? '상위 25% 이내' :
            percentile >= 50 ? '평균 이상' :
                percentile >= 25 ? '평균 수준' : '평균 이하';

    const color = percentile >= 75 ? 'green' :
        percentile >= 50 ? 'blue' :
            percentile >= 25 ? 'yellow' : 'red';

    return { percentile, rank, message, color };
}

/**
 * 소득 백분위 계산
 */
export function calculateIncomePercentile(monthlyIncome: number): PercentileResult {
    return calculatePercentileFromDistribution(
        monthlyIncome,
        REHAB_STATISTICS_2025.monthlyIncomeDistribution,
        (range) => {
            if (range.includes('이하')) {
                const max = parseInt(range.replace(/[^0-9]/g, '')) * 10000;
                return { min: 0, max };
            }
            if (range.includes('초과')) {
                const parts = range.split('초과');
                const min = parseInt(parts[0].replace(/[^0-9]/g, '')) * 10000;
                if (parts[1].includes('이하')) {
                    const max = parseInt(parts[1].replace(/[^0-9]/g, '')) * 10000;
                    return { min, max };
                }
                return { min, max: Infinity };
            }
            return { min: 0, max: Infinity };
        }
    );
}

/**
 * 채무 규모 백분위 계산
 */
export function calculateDebtPercentile(totalDebt: number): PercentileResult {
    return calculatePercentileFromDistribution(
        totalDebt,
        REHAB_STATISTICS_2025.debtAmountDistribution,
        (range) => {
            if (range.includes('이하')) {
                const max = parseInt(range.replace(/[^0-9]/g, '')) * 10000000;
                return { min: 0, max };
            }
            if (range.includes('초과')) {
                const parts = range.split('초과');
                const min = parseInt(parts[0].replace(/[^0-9]/g, '')) * 10000000;
                if (parts[1] && parts[1].includes('이하')) {
                    const max = parseInt(parts[1].replace(/[^0-9]/g, '')) * 10000000;
                    return { min, max };
                }
                return { min, max: Infinity };
            }
            return { min: 0, max: Infinity };
        }
    );
}

/**
 * 탕감률 백분위 계산
 */
export function calculateReductionRatePercentile(reductionRate: number): PercentileResult {
    return calculatePercentileFromDistribution(
        reductionRate,
        REHAB_STATISTICS_2025.debtReductionRateDistribution,
        (range) => {
            const numbers = range.match(/\d+/g);
            if (!numbers) return { min: 0, max: 100 };

            if (range.includes('미만')) {
                return { min: 0, max: parseInt(numbers[0]) };
            }
            if (range.includes('이상') && range.includes('미만')) {
                return { min: parseInt(numbers[0]), max: parseInt(numbers[1]) };
            }
            if (range.includes('이상')) {
                return { min: parseInt(numbers[0]), max: 100 };
            }
            return { min: 0, max: 100 };
        }
    );
}

/**
 * 연령대 비교
 */
export function getAgeComparison(age?: number): string {
    if (!age) return '';

    const distribution = REHAB_STATISTICS_2025.ageDistribution;
    let ageGroup = '';

    if (age < 30) ageGroup = '29세 이하';
    else if (age < 40) ageGroup = '30-39세';
    else if (age < 50) ageGroup = '40-49세';
    else if (age < 60) ageGroup = '50-59세';
    else ageGroup = '60세 이상';

    const group = distribution.find(d => d.range === ageGroup);
    if (!group) return '';

    return `${ageGroup} 신청자는 전체의 ${group.percentage}%입니다`;
}

/**
 * 가구원 수 비교
 */
export function getFamilySizeComparison(familySize: number): string {
    const distribution = REHAB_STATISTICS_2025.familySizeDistribution;

    if (familySize === 1) {
        const group = distribution.find(d => d.range === '1인');
        return `1인 가구는 전체 신청자의 ${group?.percentage}%로 가장 많습니다`;
    }

    const group = distribution.find(d => {
        if (familySize === 2) return d.range.includes('1인 초과 2인');
        if (familySize === 3) return d.range.includes('2인 초과 3인');
        return d.range.includes('3인 초과');
    });

    return group ? `${group.label}는 전체의 ${group.percentage}%입니다` : '';
}

/**
 * 평균과 비교
 */
export function compareToAverage(value: number, averageValue: number, unit: string): string {
    const diff = ((value - averageValue) / averageValue) * 100;

    if (Math.abs(diff) < 5) {
        return `평균(${(averageValue / 10000).toFixed(0)}${unit})과 비슷합니다`;
    }

    if (diff > 0) {
        return `평균보다 ${Math.abs(diff).toFixed(0)}% 높습니다`;
    }

    return `평균보다 ${Math.abs(diff).toFixed(0)}% 낮습니다`;
}

/**
 * 종합 인사이트 생성
 */
export function generateStatisticalInsights(userData: {
    monthlyIncome: number;
    totalDebt: number;
    debtReductionRate: number;
    age?: number;
    familySize: number;
}): string[] {
    const insights: string[] = [];

    // 소득 비교
    const incomePercentile = calculateIncomePercentile(userData.monthlyIncome);
    if (incomePercentile.percentile >= 70) {
        insights.push(`귀하의 소득은 신청자 중 ${incomePercentile.message}에 해당합니다`);
    }

    // 탕감률 비교
    const reductionPercentile = calculateReductionRatePercentile(userData.debtReductionRate);
    if (reductionPercentile.percentile >= 60) {
        insights.push(`예상 탕감률 ${userData.debtReductionRate}%는 ${reductionPercentile.message}로 유리한 편입니다`);
    } else if (reductionPercentile.percentile < 40) {
        insights.push(`탕감률이 평균보다 낮지만, 개인회생 신청은 여전히 유효합니다`);
    }

    // 채무 규모 비교
    const debtPercentile = calculateDebtPercentile(userData.totalDebt);
    if (debtPercentile.percentile < 50) {
        insights.push(`귀하의 채무 규모는 평균 이하로, 변제 가능성이 높습니다`);
    }

    return insights;
}
