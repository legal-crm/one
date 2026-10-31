// ============================================================
// 회사 정보 한 곳 (CT-12) — 화면용
// 서버 platform_config id 'company_info'(누구나 읽기·관리자만 쓰기)를 한 번 읽어 두고, 없으면 기본값
// ============================================================
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { DEFAULT_COMPANY_INFO, normalizeCompanyInfo } from '../../../api/_lib/company-info.js';

export interface CompanyInfo {
  legalName: string;
  businessType: string;
  ceo: string;
  businessNumber: string;
  mailOrderNumber: string;
  address: string;
  phone: string;
  email: string;
  privacyOfficer: string;
  hosting: string;
}

let cache: CompanyInfo = normalizeCompanyInfo(null) as CompanyInfo;
let loading: Promise<CompanyInfo> | null = null;
const listeners = new Set<(c: CompanyInfo) => void>();

export function getCompanyInfo(): CompanyInfo { return cache; }

export function loadCompanyInfo(force = false): Promise<CompanyInfo> {
  if (!isSupabaseConfigured) return Promise.resolve(cache);
  if (loading && !force) return loading;
  loading = (async () => {
    const { data, error } = await supabase.from('platform_config').select('data').eq('id', 'company_info').maybeSingle();
    if (!error) {
      cache = normalizeCompanyInfo(data?.data || null) as CompanyInfo;
      listeners.forEach(fn => fn(cache));
    }
    return cache;
  })();
  return loading;
}

/** 관리자가 저장한 뒤 화면 값 바로 바꾸기 */
export function setCompanyInfoCache(next: Partial<CompanyInfo>) {
  cache = normalizeCompanyInfo(next) as CompanyInfo;
  listeners.forEach(fn => fn(cache));
}

export function useCompanyInfo(): CompanyInfo {
  const [info, setInfo] = useState<CompanyInfo>(cache);
  useEffect(() => {
    listeners.add(setInfo);
    void loadCompanyInfo();
    return () => { listeners.delete(setInfo); };
  }, []);
  return info;
}

export { DEFAULT_COMPANY_INFO };
