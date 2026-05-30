import { AppSettings, CourtRegionMapItem, RegionKey, DepositRule, YearlyPolicy, CourtConfig, HousingCostRule, PermissionConfig, StatusConfig } from './types';

export const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbx_YOUR_SCRIPT_ID_HERE/exec'; 
export const USE_MOCK_DATA = true;

const generateYearlyPolicies = (): Record<number, YearlyPolicy> => {
    const policies: Record<number, YearlyPolicy> = {};
    const baseYear = 2025;
    const years = [2025, 2026, 2027, 2028, 2029, 2030];
    const annualIncrease = 1.035;

    const baseMedianIncome = { 1: 2392013, 2: 3932658, 3: 5025353, 4: 6097773, 5: 7100000, 6: 8100000 };
    const baseDepositRules: Record<RegionKey, DepositRule> = {
        'Seoul': { limit: 165000000, deduct: 55000000 },
        'Overcrowded': { limit: 145000000, deduct: 48000000 },
        'Metro': { limit: 85000000, deduct: 28000000 },
        'Others': { limit: 75000000, deduct: 25000000 }
    };
    const baseHousingLimits: Record<RegionKey, Record<number, HousingCostRule>> = {
        'Seoul': { 
            1: { additionalLimit: 513887, includedInMedian: 255467, totalLimit: 769354 }, 
            2: { additionalLimit: 838981, includedInMedian: 420008, totalLimit: 1258989 }, 
            3: { additionalLimit: 1072931, includedInMedian: 536708, totalLimit: 1609639 }, 
            4: { additionalLimit: 1306366, includedInMedian: 651242, totalLimit: 1957608 }
        },
        'Overcrowded': { 
            1: { additionalLimit: 380277, includedInMedian: 255467, totalLimit: 635744 }, 
            2: { additionalLimit: 620846, includedInMedian: 420008, totalLimit: 1040854 }, 
            3: { additionalLimit: 793969, includedInMedian: 536708, totalLimit: 1330677 }, 
            4: { additionalLimit: 966711, includedInMedian: 651242, totalLimit: 1617953 }
        },
        'Metro': { 
            1: { additionalLimit: 215833, includedInMedian: 255467, totalLimit: 471300 }, 
            2: { additionalLimit: 352372, includedInMedian: 420008, totalLimit: 772380 }, 
            3: { additionalLimit: 450631, includedInMedian: 536708, totalLimit: 987339 }, 
            4: { additionalLimit: 548674, includedInMedian: 651242, totalLimit: 1199916 }
        },
        'Others': { 
            1: { additionalLimit: 164444, includedInMedian: 255467, totalLimit: 419911 }, 
            2: { additionalLimit: 268474, includedInMedian: 420008, totalLimit: 688482 }, 
            3: { additionalLimit: 343338, includedInMedian: 536708, totalLimit: 880046 }, 
            4: { additionalLimit: 418037, includedInMedian: 651242, totalLimit: 1069279 }
        }
    };
    const baseAssetExemptions = { deposit: 1850000, insurance: 1500000 };
    const baseEducationCost = { additionalLimit: 190000, includedInMedian: 84149, totalLimit: 274149 };
    const baseSpecialEducationCost = { additionalLimit: 500000, includedInMedian: 84149, totalLimit: 584149 };
    const baseMedicalCostIncluded = { 1: 60279, 2: 99103, 3: 126639, 4: 153664 };
    const baseAdultChildCriteria = { minAge: 19, maxAge: 21, incomeLimit: 1000000, grossIncomeLimit: 5000000 };

    for (const year of years) {
        const multiplier = Math.pow(annualIncrease, year - baseYear);
        const newMedianIncomeValues: Record<number, number> = {};
        for (const key in baseMedianIncome) { 
            newMedianIncomeValues[key] = Math.round(baseMedianIncome[key as any] * multiplier); 
        }
        const newDepositRules: Record<RegionKey, DepositRule> = JSON.parse(JSON.stringify(baseDepositRules));
        for (const key in newDepositRules) {
            newDepositRules[key as RegionKey].limit = Math.round(baseDepositRules[key as RegionKey].limit * multiplier / 100000) * 100000;
            newDepositRules[key as RegionKey].deduct = Math.round(baseDepositRules[key as RegionKey].deduct * multiplier / 100000) * 100000;
        }
        const newHousingLimits: Record<RegionKey, Record<number, HousingCostRule>> = JSON.parse(JSON.stringify(baseHousingLimits));
        for (const regionKey in newHousingLimits) {
            for (const sizeKey in newHousingLimits[regionKey as RegionKey]) {
                const rule = newHousingLimits[regionKey as RegionKey][sizeKey];
                rule.additionalLimit = Math.round(rule.additionalLimit * multiplier);
                rule.includedInMedian = Math.round(rule.includedInMedian * multiplier);
                rule.totalLimit = rule.additionalLimit + rule.includedInMedian;
            }
        }
        const newAssetExemptions = { 
            deposit: Math.round(baseAssetExemptions.deposit * multiplier), 
            insurance: Math.round(baseAssetExemptions.insurance * multiplier) 
        };
        const newEducationCost = { 
            additionalLimit: Math.round(baseEducationCost.additionalLimit * multiplier), 
            includedInMedian: Math.round(baseEducationCost.includedInMedian * multiplier), 
            totalLimit: Math.round(baseEducationCost.totalLimit * multiplier) 
        };
        const newSpecialEducationCost = { 
            additionalLimit: Math.round(baseSpecialEducationCost.additionalLimit * multiplier), 
            includedInMedian: Math.round(baseSpecialEducationCost.includedInMedian * multiplier), 
            totalLimit: Math.round(baseSpecialEducationCost.totalLimit * multiplier) 
        };
        const newMedicalCostIncluded: Record<number, number> = {};
        for (const key in baseMedicalCostIncluded) { 
            newMedicalCostIncluded[key] = Math.round(baseMedicalCostIncluded[key as any] * multiplier); 
        }
        const newAdultChildCriteria = { 
            minAge: baseAdultChildCriteria.minAge, 
            maxAge: baseAdultChildCriteria.maxAge, 
            incomeLimit: Math.round(baseAdultChildCriteria.incomeLimit * multiplier), 
            grossIncomeLimit: Math.round(baseAdultChildCriteria.grossIncomeLimit * multiplier) 
        };

        policies[year] = {
            medianIncome: { values: newMedianIncomeValues, incrementOver7: Math.round(923623 * multiplier) },
            depositRules: newDepositRules,
            housingCostLimits: newHousingLimits,
            assetExemptions: newAssetExemptions,
            educationCost: newEducationCost,
            specialEducationCost: newSpecialEducationCost,
            medicalCostIncludedInMedian: newMedicalCostIncluded,
            highIncomeEarnerMultiplier: 1.5,
            highIncomeRepaymentRateThreshold: 0.4,
            adultChildDependentCriteria: newAdultChildCriteria,
        };
    }
    return policies;
};

export const COURT_REGION_MAP_DATA: CourtRegionMapItem[] = [
    { keyword: '가평군', court: '의정부지방법원', region: 'Others' },
    { keyword: '강남구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '강동구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '강릉시', court: '춘천지방법원 강릉지원', region: 'Others' },
    { keyword: '강북구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '강서구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '거제시', court: '창원지방법원', region: 'Others' },
    { keyword: '거창군', court: '창원지방법원', region: 'Others' },
    { keyword: '경산시', court: '대구지방법원', region: 'Others' },
    { keyword: '경주시', court: '대구지방법원', region: 'Others' },
    { keyword: '계룡시', court: '대전지방법원', region: 'Others' },
    { keyword: '고령군', court: '대구지방법원', region: 'Others' },
    { keyword: '고성군', court: '춘천지방법원', region: 'Others' },
    { keyword: '고성군', court: '창원지방법원', region: 'Others' },
    { keyword: '고양시', court: '의정부지방법원', region: 'Overcrowded' },
    { keyword: '고양시 일산서구', court: '의정부지방법원', region: 'Overcrowded' },
    { keyword: '고양시 일산동구', court: '의정부지방법원', region: 'Overcrowded' },
    { keyword: '고양시 덕양구', court: '의정부지방법원', region: 'Overcrowded' },
    { keyword: '고창군', court: '전주지방법원', region: 'Others' },
    { keyword: '고흥군', court: '광주지방법원', region: 'Others' },
    { keyword: '곡성군', court: '광주지방법원', region: 'Others' },
    { keyword: '공주시', court: '대전지방법원', region: 'Others' },
    { keyword: '과천시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '관악구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '광명시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '광양시', court: '광주지방법원', region: 'Others' },
    { keyword: '광주광역시', court: '광주지방법원', region: 'Metro' },
    { keyword: '광주광역시 동구', court: '광주지방법원', region: 'Metro' },
    { keyword: '광주광역시 서구', court: '광주지방법원', region: 'Metro' },
    { keyword: '광주광역시 남구', court: '광주지방법원', region: 'Metro' },
    { keyword: '광주광역시 북구', court: '광주지방법원', region: 'Metro' },
    { keyword: '광주광역시 광산구', court: '광주지방법원', region: 'Metro' },
    { keyword: '광주시', court: '수원회생법원', region: 'Metro' },
    { keyword: '광진구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '괴산군', court: '청주지방법원', region: 'Others' },
    { keyword: '구례군', court: '광주지방법원', region: 'Others' },
    { keyword: '구로구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '구리시', court: '의정부지방법원', region: 'Overcrowded' },
    { keyword: '구미시', court: '대구지방법원', region: 'Others' },
    { keyword: '군산시', court: '전주지방법원', region: 'Others' },
    { keyword: '군위군', court: '대구지방법원', region: 'Others' },
    { keyword: '군포시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '금산군', court: '대전지방법원', region: 'Others' },
    { keyword: '금천구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '김제시', court: '전주지방법원', region: 'Others' },
    { keyword: '김천시', court: '대구지방법원', region: 'Others' },
    { keyword: '김포시', court: '인천지방법원', region: 'Overcrowded' },
    { keyword: '김해시', court: '창원지방법원', region: 'Others' },
    { keyword: '나주시', court: '광주지방법원', region: 'Others' },
    { keyword: '남양주시', court: '의정부지방법원', region: 'Others' },
    { keyword: '남원시', court: '전주지방법원', region: 'Others' },
    { keyword: '남해군', court: '창원지방법원', region: 'Others' },
    { keyword: '노원구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '논산시', court: '대전지방법원', region: 'Others' },
    { keyword: '단양군', court: '청주지방법원', region: 'Others' },
    { keyword: '담양군', court: '광주지방법원', region: 'Others' },
    { keyword: '당진군', court: '대전지방법원', region: 'Others' },
    { keyword: '대구광역시', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 중구', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 동구', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 서구', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 남구', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 북구', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 수성구', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 달서구', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 달성군', court: '대구지방법원', region: 'Metro' },
    { keyword: '대구광역시 군위군', court: '대구지방법원', region: 'Metro' },
    { keyword: '대전광역시', court: '대전지방법원', region: 'Metro' },
    { keyword: '대전광역시 유성구', court: '대전지방법원', region: 'Metro' },
    { keyword: '대전광역시 대덕구', court: '대전지방법원', region: 'Metro' },
    { keyword: '대전광역시 서구', court: '대전지방법원', region: 'Metro' },
    { keyword: '대전광역시 중구', court: '대전지방법원', region: 'Metro' },
    { keyword: '대전광역시 동구', court: '대전지방법원', region: 'Metro' },
    { keyword: '도봉구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '동대문구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '동두천시', court: '의정부지방법원', region: 'Others' },
    { keyword: '동작구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '동탄시', court: '수원회생법원', region: 'Others' },
    { keyword: '동해시', court: '춘천지방법원 강릉지원', region: 'Others' },
    { keyword: '마포구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '목포시', court: '광주지방법원', region: 'Others' },
    { keyword: '무안군', court: '광주지방법원', region: 'Others' },
    { keyword: '무주군', court: '전주지방법원', region: 'Others' },
    { keyword: '문경시', court: '대구지방법원', region: 'Others' },
    { keyword: '밀양시', court: '창원지방법원', region: 'Others' },
    { keyword: '보령시', court: '대전지방법원', region: 'Others' },
    { keyword: '보성군', court: '광주지방법원', region: 'Others' },
    { keyword: '보은군', court: '청주지방법원', region: 'Others' },
    { keyword: '봉화군', court: '대구지방법원', region: 'Others' },
    { keyword: '부산광역시', court: '부산회생법원', region: 'Others' },
    { keyword: '부안군', court: '전주지방법원', region: 'Others' },
    { keyword: '부여군', court: '대전지방법원', region: 'Others' },
    { keyword: '부천시', court: '인천지방법원', region: 'Overcrowded' },
    { keyword: '사천시', court: '창원지방법원', region: 'Others' },
    { keyword: '산청군', court: '창원지방법원', region: 'Others' },
    { keyword: '삼척시', court: '춘천지방법원 강릉지원', region: 'Others' },
    { keyword: '상주시', court: '대구지방법원', region: 'Others' },
    { keyword: '서귀포시', court: '제주지방법원', region: 'Others' },
    { keyword: '서대문구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '서산시', court: '대전지방법원', region: 'Others' },
    { keyword: '서천군', court: '대전지방법원', region: 'Others' },
    { keyword: '서초구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '서울시', court: '서울회생법원', region: 'Seoul' },
    { keyword: '성남시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '성동구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '성북구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '성주군', court: '대구지방법원', region: 'Others' },
    { keyword: '세종시', court: '대전지방법원', region: 'Others' },
    { keyword: '속초시', court: '춘천지방법원', region: 'Others' },
    { keyword: '송파구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '수원시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '순창군', court: '전주지방법원', region: 'Others' },
    { keyword: '순천시', court: '광주지방법원', region: 'Others' },
    { keyword: '시흥시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '신안군', court: '광주지방법원', region: 'Others' },
    { keyword: '아산시', court: '대전지방법원', region: 'Others' },
    { keyword: '안동시', court: '대구지방법원', region: 'Others' },
    { keyword: '안산시', court: '수원회생법원', region: 'Metro' },
    { keyword: '안성시', court: '수원회생법원', region: 'Others' },
    { keyword: '안양시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '양구군', court: '춘천지방법원', region: 'Others' },
    { keyword: '양산시', court: '울산지방법원', region: 'Others' },
    { keyword: '양양군', court: '춘천지방법원', region: 'Others' },
    { keyword: '양주시', court: '의정부지방법원', region: 'Others' },
    { keyword: '양천구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '양평군', court: '수원회생법원', region: 'Others' },
    { keyword: '여수시', court: '광주지방법원', region: 'Others' },
    { keyword: '여주군', court: '수원회생법원', region: 'Others' },
    { keyword: '연기군', court: '대전지방법원', region: 'Others' },
    { keyword: '연천군', court: '의정부지방법원', region: 'Others' },
    { keyword: '영광군', court: '광주지방법원', region: 'Others' },
    { keyword: '영덕군', court: '대구지방법원', region: 'Others' },
    { keyword: '영동군', court: '청주지방법원', region: 'Others' },
    { keyword: '영등포구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '영암군', court: '광주지방법원', region: 'Others' },
    { keyword: '영양군', court: '대구지방법원', region: 'Others' },
    { keyword: '영월군', court: '춘천지방법원', region: 'Others' },
    { keyword: '영주시', court: '대구지방법원', region: 'Others' },
    { keyword: '영천시', court: '대구지방법원', region: 'Others' },
    { keyword: '예산군', court: '대전지방법원', region: 'Others' },
    { keyword: '예천군', court: '대구지방법원', region: 'Others' },
    { keyword: '오산시', court: '수원회생법원', region: 'Others' },
    { keyword: '옥천군', court: '청주지방법원', region: 'Others' },
    { keyword: '완도군', court: '광주지방법원', region: 'Others' },
    { keyword: '완주군', court: '전주지방법원', region: 'Others' },
    { keyword: '용산구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '용인시 처인구', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '용인시 기흥구', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '용인시 수지구', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '울릉군', court: '대구지방법원', region: 'Others' },
    { keyword: '울산광역시', court: '울산지방법원', region: 'Metro' },
    { keyword: '울진군', court: '대구지방법원', region: 'Others' },
    { keyword: '원주시', court: '춘천지방법원', region: 'Others' },
    { keyword: '은평구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '음성군', court: '청주지방법원', region: 'Others' },
    { keyword: '의령군', court: '창원지방법원', region: 'Others' },
    { keyword: '의성군', court: '대구지방법원', region: 'Others' },
    { keyword: '의왕시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '의정부시', court: '의정부지방법원', region: 'Overcrowded' },
    { keyword: '이천시', court: '수원회생법원', region: 'Metro' },
    { keyword: '익산시', court: '전주지방법원', region: 'Others' },
    { keyword: '인제군', court: '춘천지방법원', region: 'Others' },
    { keyword: '인천광역시', court: '인천지방법원', region: 'Overcrowded' },
    { keyword: '장성군', court: '광주지방법원', region: 'Others' },
    { keyword: '장수군', court: '전주지방법원', region: 'Others' },
    { keyword: '장흥군', court: '광주지방법원', region: 'Others' },
    { keyword: '전주시', court: '전주지방법원', region: 'Others' },
    { keyword: '정선군', court: '춘천지방법원', region: 'Others' },
    { keyword: '정읍시', court: '전주지방법원', region: 'Others' },
    { keyword: '제주시', court: '제주지방법원', region: 'Others' },
    { keyword: '제천시', court: '청주지방법원', region: 'Others' },
    { keyword: '종로구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '중구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '중랑구', court: '서울회생법원', region: 'Seoul' },
    { keyword: '증평군', court: '청주지방법원', region: 'Others' },
    { keyword: '진도군', court: '광주지방법원', region: 'Others' },
    { keyword: '진안군', court: '전주지방법원', region: 'Others' },
    { keyword: '진주시', court: '창원지방법원', region: 'Others' },
    { keyword: '진천군', court: '청주지방법원', region: 'Others' },
    { keyword: '창녕군', court: '창원지방법원', region: 'Others' },
    { keyword: '창원시', court: '창원지방법원', region: 'Others' },
    { keyword: '천안시', court: '대전지방법원', region: 'Others' },
    { keyword: '철원군', court: '의정부지방법원', region: 'Others' },
    { keyword: '청도군', court: '대구지방법원', region: 'Others' },
    { keyword: '청송군', court: '대구지방법원', region: 'Others' },
    { keyword: '청양군', court: '대전지방법원', region: 'Others' },
    { keyword: '청원군', court: '청주지방법원', region: 'Others' },
    { keyword: '청주시', court: '청주지방법원', region: 'Others' },
    { keyword: '춘천시', court: '춘천지방법원', region: 'Others' },
    { keyword: '충주시', court: '청주지방법원', region: 'Others' },
    { keyword: '칠곡군', court: '대구지방법원', region: 'Others' },
    { keyword: '태백시', court: '춘천지방법원', region: 'Others' },
    { keyword: '태안군', court: '대전지방법원', region: 'Others' },
    { keyword: '통영시', court: '창원지방법원', region: 'Others' },
    { keyword: '파주시', court: '의정부지방법원', region: 'Metro' },
    { keyword: '평창군', court: '춘천지방법원', region: 'Others' },
    { keyword: '평택시', court: '수원회생법원', region: 'Metro' },
    { keyword: '포천시', court: '의정부지방법원', region: 'Others' },
    { keyword: '포항시', court: '대구지방법원', region: 'Others' },
    { keyword: '하남시', court: '수원회생법원', region: 'Overcrowded' },
    { keyword: '하동군', court: '창원지방법원', region: 'Others' },
    { keyword: '함안군', court: '창원지방법원', region: 'Others' },
    { keyword: '함양군', court: '창원지방법원', region: 'Others' },
    { keyword: '함평군', court: '광주지방법원', region: 'Others' },
    { keyword: '합천군', court: '창원지방법원', region: 'Others' },
    { keyword: '해남군', court: '광주지방법원', region: 'Others' },
    { keyword: '홍성군', court: '대전지방법원', region: 'Others' },
    { keyword: '홍천군', court: '춘천지방법원', region: 'Others' },
    { keyword: '화성시', court: '수원회생법원', region: 'Others' },
    { keyword: '화순군', court: '광주지방법원', region: 'Others' },
    { keyword: '화천군', court: '춘천지방법원', region: 'Others' },
    { keyword: '횡성군', court: '춘천지방법원', region: 'Others' }
];

const generateCourtConfigs = (): Record<string, CourtConfig> => {
    const configs: Record<string, CourtConfig> = {};
    const courts = ['서울회생법원', '의정부지방법원', '인천지방법원', '수원회생법원', '춘천지방법원', '대전지방법원', '청주지방법원', '대구지방법원', '부산회생법원', '울산지방법원', '창원지방법원', '광주지방법원', '전주지방법원', '제주지방법원', '대전회생법원', '대구회생법원', '광주회생법원'];
    courts.forEach(court => {
        configs[court] = { 
            description: '', 
            includeSpouseProperty: true, 
            includeCryptoStock: true, 
            allow24Month: court === '서울회생법원', 
            allowAdditionalLivingCost: true, 
            allowOtherLivingCost: false 
        };
    });
    return configs;
};

const DEFAULT_PERMISSIONS: PermissionConfig = {
  admin: { manage_users: true, access_settings: true, view_all_leads: true, assign_leads: true, delete_data: true, export_data: true, manage_contracts: true, manage_fees: true },
  sub_admin: { manage_users: false, access_settings: true, view_all_leads: true, assign_leads: true, delete_data: false, export_data: true, manage_contracts: true, manage_fees: true },
  correction_officer: { manage_users: false, access_settings: false, view_all_leads: false, assign_leads: false, delete_data: false, export_data: false, manage_contracts: false, manage_fees: false },
  user: { manage_users: false, access_settings: false, view_all_leads: false, assign_leads: false, delete_data: false, export_data: false, manage_contracts: true, manage_fees: true }
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  preContract: [
    { key: 'unreachable', label: '부재중', color: 'bg-gray-500' },
    { key: 'callback_scheduled', label: '재통화예정', color: 'bg-yellow-500' },
    { key: 'managing', label: '관리중', color: 'bg-blue-400' },
    { key: 'consulting', label: '상담진행중', color: 'bg-indigo-500' },
    { key: 'impossible', label: '진행불가', color: 'bg-red-500' },
    { key: 'client_cancelled', label: '고객취소요청', color: 'bg-red-400' },
    { key: 'docs_guidance', label: '서류안내', color: 'bg-purple-500' },
    { key: 'contract_sent', label: '계약서 발송', color: 'bg-orange-500' },
  ],
  postContract: [
    { key: 'contracted', label: '수임계약 완료', color: 'bg-emerald-600' },
    { key: 'preparing_docs', label: '서류준비중', color: 'bg-teal-500' },
    { key: 'filing_completed', label: '법원접수완료', color: 'bg-blue-600' },
    { key: 'commencement', label: '개시중', color: 'bg-cyan-600' },
    { key: 'correction', label: '보정중', color: 'bg-amber-600' },
    { key: 'approval', label: '인가완료', color: 'bg-green-600' },
    { key: 'discharge', label: '면책', color: 'bg-slate-600' },
  ]
};

const DEFAULT_CASE_TYPES: { key: string; label: string }[] = [
  { key: 'individual_rehab', label: '개인회생' },
  { key: 'bankruptcy', label: '파산' },
  { key: 'new_start', label: '새출발' },
  { key: 'credit_recovery', label: '신용회복' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  activeVersion: "2025_K1",
  leibniz: { m24: 1.04, m36: 1.07, m48: 1.095, m60: 1.12 },
  policy: { pminThreshold: 50000000, pminRateBelow: 0.05, pminRateAbove: 0.03, pminFixedAbove: 1000000, overpaymentWarnRatio: 1.2, insuranceWarnRatio: 0.3, reduceMax36: 0.10, reduceMax60: 0.20 },
  aiConfig: {
    reportGenerator: { model: 'gemini-2.5-flash', prompt: `[고객명]님, 개인회생 상담 결과 보고서입니다...`, defaultTone: 'formal', defaultLength: 'medium' },
    statementGenerator: { model: 'gemini-2.5-flash', prompt: `당신은 법률 전문가입니다. 개인회생 사건에 제출할 진술서를 작성해주세요...` },
    imageLeadExtractor: { model: 'gemini-3-pro-preview', prompt: "이 이미지에서 고객 DB 정보를 추출해줘..." },
    callSummarizer: { model: 'gemini-2.5-flash', prompt: `다음 통화 녹취록을 요약해줘...` }
  },
  dbVendors: ['온라인광고', '소개', '엑셀업로드', '수기입력', '기타'],
  caseTypes: DEFAULT_CASE_TYPES,
  courtRegionMap: COURT_REGION_MAP_DATA,
  courtConfigs: generateCourtConfigs(),
  yearlyPolicies: generateYearlyPolicies(),
  permissions: DEFAULT_PERMISSIONS,
  statusConfig: DEFAULT_STATUS_CONFIG,
};
