import { CourtRegionMapItem } from './types';

/**
 * Formats a number (KRW won) into a Korean string format (e.g., 1억 2,500만원)
 * Requirement: All output must be in Man-won units if possible.
 */
export const formatKoreanCurrency = (amount: number): string => {
  if (amount === 0) return "0원";
  
  const absAmount = Math.abs(amount);
  const eok = Math.floor(absAmount / 100000000);
  const remainderAfterEok = absAmount % 100000000;
  
  const manPart = Math.floor(remainderAfterEok / 10000);
  
  let result = "";
  if (eok > 0) {
    result += `${eok}억 `;
  }
  
  if (manPart > 0) {
    result += `${manPart.toLocaleString()}만원`;
  } else if (eok === 0) {
    // If less than 10,000 won, just show won
    return `${amount.toLocaleString()}원`;
  }
  
  return result.trim();
};

export const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'error': return 'bg-red-50 text-red-700 border-red-200';
    case 'warn': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'info': default: return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

export const getModeBadgeColor = (mode: string) => {
  if (mode.includes('연장')) return 'bg-indigo-100 text-indigo-800';
  if (mode.includes('감액')) return 'bg-orange-100 text-orange-800';
  if (mode.includes('조율')) return 'bg-green-100 text-green-800';
  if (mode.includes('불가')) return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
};

export const calculateManAge = (birthDateStr: string, atDateStr?: string): number => {
  if (!birthDateStr || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(birthDateStr)) return 0;
  const birth = new Date(birthDateStr);
  const today = atDateStr ? new Date(atDateStr) : new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const detectJurisdiction = (address: string, map: CourtRegionMapItem[] | undefined) => {
  if (!address || !map || map.length === 0) return { court: '기타지방법원', region: 'Others' as const };
  
  const sortedMap = [...map].sort((a, b) => b.keyword.length - a.keyword.length);

  for (const item of sortedMap) {
    if (address.includes(item.keyword)) {
      return { court: item.court, region: item.region };
    }
  }
  return { court: '기타지방법원', region: 'Others' as const };
};

export const generateDateOptions = () => {
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 10; i >= currentYear - 100; i--) {
    years.push(String(i));
  }
  const months = Array.from({length: 12}, (_, i) => String(i + 1));
  const days = Array.from({length: 31}, (_, i) => String(i + 1));
  return { years, months, days };
};
