import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type {
  NewsArticle,
  ClientQA,
  SuccessReview,
  MainBanner,
  Notice,
  ClientInquiry,
  LawyerInquiry,
} from '../types';

// ============================================================
// CMS (Content Management System) Supabase Hybrid Sync Service
// 7개 콘텐츠 유형에 대한 Supabase + localStorage 하이브리드 동기화
// ============================================================

// ── 로컬 스토리지 키 & DB 테이블 상수 ──
export const CMS_STORAGE_KEYS = {
  NEWS: 'legal_crm_news',
  QAS: 'legal_crm_qas',
  REVIEWS: 'legal_crm_reviews',
  BANNERS: 'legal_crm_banners',
  NOTICES: 'legal_crm_notices',
  INQUIRIES: 'legal_crm_inquiries',
  LAWYER_INQUIRIES: 'legal_crm_lawyer_inquiries',
} as const;

export const CMS_TABLES = {
  NEWS: 'news_articles',
  QAS: 'client_qas',
  REVIEWS: 'success_reviews',
  BANNERS: 'main_banners',
  NOTICES: 'notices',
  INQUIRIES: 'client_inquiries',
  LAWYER_INQUIRIES: 'lawyer_inquiries',
} as const;

// ── 헬퍼 함수 ──

function logSupabaseError(op: string, error: any) {
  console.error(`[CMS] ${op} 실패:`, error?.message || error);
}

function getLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── 제네릭 CRUD 헬퍼 ──

async function loadCmsItems<T>(storageKey: string, table: string, fallback: T[] = []): Promise<T[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        logSupabaseError(`load (${table})`, error);
      } else if (data && data.length > 0) {
        const items = data.map((row: any) => (row.data !== undefined ? row.data : row) as T);
        setLocal(storageKey, items);
        return items;
      }
    } catch (e) {
      logSupabaseError(`load exception (${table})`, e);
    }
  }
  return getLocal<T[]>(storageKey, fallback);
}

async function saveCmsItem<T extends { id?: string }>(
  storageKey: string,
  table: string,
  prefix: string,
  item: T
): Promise<void> {
  const current = getLocal<T[]>(storageKey, []);
  const itemId = item.id || `${prefix}-${Date.now()}`;
  const normalizedItem = { ...item, id: itemId };

  const idx = current.findIndex((x: any) => x.id === itemId);
  const next = idx >= 0
    ? current.map((x: any) => (x.id === itemId ? normalizedItem : x))
    : [normalizedItem, ...current];
  setLocal(storageKey, next);

  if (isSupabaseConfigured) {
    try {
      const row = { id: itemId, data: normalizedItem };
      const { error } = await supabase.from(table).upsert([row], { onConflict: 'id' });
      if (error) {
        logSupabaseError(`save (${table})`, error);
      }
    } catch (e) {
      logSupabaseError(`save exception (${table})`, e);
    }
  }
}

async function saveAllCmsItems<T extends { id?: string }>(
  storageKey: string,
  table: string,
  prefix: string,
  items: T[]
): Promise<void> {
  setLocal(storageKey, items);

  if (isSupabaseConfigured && items.length > 0) {
    try {
      const rows = items.map(item => ({
        id: item.id || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        data: item,
      }));
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
      if (error) {
        logSupabaseError(`saveAll (${table})`, error);
      }
    } catch (e) {
      logSupabaseError(`saveAll exception (${table})`, e);
    }
  }
}

async function deleteCmsItem<T extends { id?: string }>(
  storageKey: string,
  table: string,
  id: string
): Promise<void> {
  const current = getLocal<T[]>(storageKey, []);
  setLocal(storageKey, current.filter((x: any) => x.id !== id));

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        logSupabaseError(`delete (${table})`, error);
      }
    } catch (e) {
      logSupabaseError(`delete exception (${table})`, e);
    }
  }
}

// ============================================================
// 1. News Articles (법률 뉴스)
// key: legal_crm_news, table: news_articles
// ============================================================

export async function loadNews(): Promise<NewsArticle[]> {
  return loadCmsItems<NewsArticle>(CMS_STORAGE_KEYS.NEWS, CMS_TABLES.NEWS);
}

export async function saveNews(item: NewsArticle): Promise<void> {
  return saveCmsItem<NewsArticle>(CMS_STORAGE_KEYS.NEWS, CMS_TABLES.NEWS, 'news', item);
}

export async function saveAllNews(items: NewsArticle[]): Promise<void> {
  return saveAllCmsItems<NewsArticle>(CMS_STORAGE_KEYS.NEWS, CMS_TABLES.NEWS, 'news', items);
}

export async function deleteNews(id: string): Promise<void> {
  return deleteCmsItem<NewsArticle>(CMS_STORAGE_KEYS.NEWS, CMS_TABLES.NEWS, id);
}

// ============================================================
// 2. Client QAs (고객 상담 Q&A)
// key: legal_crm_qas, table: client_qas
// ============================================================

export async function loadQAs(): Promise<ClientQA[]> {
  return loadCmsItems<ClientQA>(CMS_STORAGE_KEYS.QAS, CMS_TABLES.QAS);
}

export async function saveQA(item: ClientQA): Promise<void> {
  return saveCmsItem<ClientQA>(CMS_STORAGE_KEYS.QAS, CMS_TABLES.QAS, 'qa', item);
}

export async function saveAllQAs(items: ClientQA[]): Promise<void> {
  return saveAllCmsItems<ClientQA>(CMS_STORAGE_KEYS.QAS, CMS_TABLES.QAS, 'qa', items);
}

export async function deleteQA(id: string): Promise<void> {
  return deleteCmsItem<ClientQA>(CMS_STORAGE_KEYS.QAS, CMS_TABLES.QAS, id);
}

// ============================================================
// 3. Success Reviews (성공 후기)
// key: legal_crm_reviews, table: success_reviews
// ============================================================

export async function loadReviews(): Promise<SuccessReview[]> {
  return loadCmsItems<SuccessReview>(CMS_STORAGE_KEYS.REVIEWS, CMS_TABLES.REVIEWS);
}

export async function saveReview(item: SuccessReview): Promise<void> {
  return saveCmsItem<SuccessReview>(CMS_STORAGE_KEYS.REVIEWS, CMS_TABLES.REVIEWS, 'review', item);
}

export async function saveAllReviews(items: SuccessReview[]): Promise<void> {
  return saveAllCmsItems<SuccessReview>(CMS_STORAGE_KEYS.REVIEWS, CMS_TABLES.REVIEWS, 'review', items);
}

export async function deleteReview(id: string): Promise<void> {
  return deleteCmsItem<SuccessReview>(CMS_STORAGE_KEYS.REVIEWS, CMS_TABLES.REVIEWS, id);
}

// ============================================================
// 4. Main Banners (메인 배너)
// key: legal_crm_banners, table: main_banners
// ============================================================

export async function loadBanners(): Promise<MainBanner[]> {
  return loadCmsItems<MainBanner>(CMS_STORAGE_KEYS.BANNERS, CMS_TABLES.BANNERS);
}

export async function saveBanner(item: MainBanner): Promise<void> {
  return saveCmsItem<MainBanner>(CMS_STORAGE_KEYS.BANNERS, CMS_TABLES.BANNERS, 'banner', item);
}

export async function saveAllBanners(items: MainBanner[]): Promise<void> {
  return saveAllCmsItems<MainBanner>(CMS_STORAGE_KEYS.BANNERS, CMS_TABLES.BANNERS, 'banner', items);
}

export async function deleteBanner(id: string): Promise<void> {
  return deleteCmsItem<MainBanner>(CMS_STORAGE_KEYS.BANNERS, CMS_TABLES.BANNERS, id);
}

// ============================================================
// 5. Notices (공지사항)
// key: legal_crm_notices, table: notices
// ============================================================

export async function loadNotices(): Promise<Notice[]> {
  return loadCmsItems<Notice>(CMS_STORAGE_KEYS.NOTICES, CMS_TABLES.NOTICES);
}

export async function saveNotice(item: Notice): Promise<void> {
  return saveCmsItem<Notice>(CMS_STORAGE_KEYS.NOTICES, CMS_TABLES.NOTICES, 'notice', item);
}

export async function saveAllNotices(items: Notice[]): Promise<void> {
  return saveAllCmsItems<Notice>(CMS_STORAGE_KEYS.NOTICES, CMS_TABLES.NOTICES, 'notice', items);
}

export async function deleteNotice(id: string): Promise<void> {
  return deleteCmsItem<Notice>(CMS_STORAGE_KEYS.NOTICES, CMS_TABLES.NOTICES, id);
}

// ============================================================
// 6. Client Inquiries (고객 1:1 문의)
// key: legal_crm_inquiries, table: client_inquiries
// ============================================================

export async function loadInquiries(): Promise<ClientInquiry[]> {
  return loadCmsItems<ClientInquiry>(CMS_STORAGE_KEYS.INQUIRIES, CMS_TABLES.INQUIRIES);
}

export async function saveInquiry(item: ClientInquiry): Promise<void> {
  return saveCmsItem<ClientInquiry>(CMS_STORAGE_KEYS.INQUIRIES, CMS_TABLES.INQUIRIES, 'inquiry', item);
}

export async function saveAllInquiries(items: ClientInquiry[]): Promise<void> {
  return saveAllCmsItems<ClientInquiry>(CMS_STORAGE_KEYS.INQUIRIES, CMS_TABLES.INQUIRIES, 'inquiry', items);
}

export async function deleteInquiry(id: string): Promise<void> {
  return deleteCmsItem<ClientInquiry>(CMS_STORAGE_KEYS.INQUIRIES, CMS_TABLES.INQUIRIES, id);
}

// ============================================================
// 7. Lawyer Inquiries (변호사 입점/제휴 문의)
// key: legal_crm_lawyer_inquiries, table: lawyer_inquiries
// ============================================================

export async function loadLawyerInquiries(): Promise<LawyerInquiry[]> {
  return loadCmsItems<LawyerInquiry>(CMS_STORAGE_KEYS.LAWYER_INQUIRIES, CMS_TABLES.LAWYER_INQUIRIES);
}

export async function saveLawyerInquiry(item: LawyerInquiry): Promise<void> {
  return saveCmsItem<LawyerInquiry>(CMS_STORAGE_KEYS.LAWYER_INQUIRIES, CMS_TABLES.LAWYER_INQUIRIES, 'lawyer-inquiry', item);
}

export async function saveAllLawyerInquiries(items: LawyerInquiry[]): Promise<void> {
  return saveAllCmsItems<LawyerInquiry>(CMS_STORAGE_KEYS.LAWYER_INQUIRIES, CMS_TABLES.LAWYER_INQUIRIES, 'lawyer-inquiry', items);
}

export async function deleteLawyerInquiry(id: string): Promise<void> {
  return deleteCmsItem<LawyerInquiry>(CMS_STORAGE_KEYS.LAWYER_INQUIRIES, CMS_TABLES.LAWYER_INQUIRIES, id);
}
