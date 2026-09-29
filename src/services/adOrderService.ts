// src/services/adOrderService.ts
// 광고 주문(AdOrder) 영속화 및 브라우저/탭 간 실시간 동기화 서비스

import type { AdOrder } from '../types';
import { mockAdOrders } from '../data';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

// [PART 3-4] 가상 광고 주문 5건(김우진·이소민 등, 가짜 입금일)은 DEV 전용.
// (이전: 운영에서도 목록이 비면 다시 채워져 매출·입금 대기·TOP5에 섞였음)
const SEED_ORDERS: AdOrder[] = import.meta.env.DEV ? mockAdOrders : [];
const SEED_ORDER_IDS = new Set(['ado-1', 'ado-2', 'ado-3', 'ado-4', 'ado-6']);
const stripProdSeedOrders = (list: AdOrder[]) =>
  import.meta.env.PROD ? list.filter(o => o && !SEED_ORDER_IDS.has(o.id)) : list;

const STORAGE_KEY = 'crm_ad_orders';
const CHANNEL_NAME = 'crm_ad_orders_channel';

// BroadcastChannel (지원 브라우저인 경우 브라우저 탭 간 실시간 통신)
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn('[AdOrderService] BroadcastChannel init failed:', e);
  }
}

/**
 * 광고 주문 목록 로드 (localStorage 우선, 없으면 mockAdOrders)
 */
export function loadAdOrders(): AdOrder[] {
  if (typeof window === 'undefined') return SEED_ORDERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return stripProdSeedOrders(parsed);
    }
  } catch (e) {
    console.error('[AdOrderService] loadAdOrders parse error:', e);
  }
  // 저장된 목록이 없을 때만 시드(DEV) — 빈 목록([])은 그대로 유지
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ORDERS));
  } catch { /* ignore */ }
  return SEED_ORDERS;
}

function rowToAdOrder(r: any): AdOrder {
  return {
    id: r.id,
    lawyerId: r.lawyer_id,
    lawyerName: r.lawyer_name || '',
    productId: r.product_id || '',
    productName: r.product_name || '',
    contractMonths: Number(r.contract_months) || 1,
    monthlyPrice: Number(r.monthly_price) || 0,
    totalPrice: Number(r.total_price) || 0,
    status: r.status,
    requestedAt: r.requested_at,
    paidAt: r.paid_at || undefined,
    activatedAt: r.activated_at || undefined,
    expiresAt: r.expires_at || undefined,
    depositorName: r.depositor_name || undefined,
    region: r.region || undefined,
    taxInvoice: r.tax_invoice || undefined,
    modifiedTaxInvoice: r.modified_tax_invoice || undefined,
    buyerCorpNum: r.buyer_corp_num || undefined,
    buyerCorpName: r.buyer_corp_name || undefined,
    buyerCEOName: r.buyer_ceo_name || undefined,
    buyerEmail: r.buyer_email || undefined,
  };
}

/**
 * 관리자: 서버(ad_orders, 024 RLS)의 전체 주문을 불러와 이 브라우저 목록과 병합
 * (이전: 각 브라우저 localStorage만 사용해 다른 기기에서 신청한 광고를 관리자가 볼 수 없었음)
 */
export async function syncAdOrdersFromServer(): Promise<{ orders: AdOrder[]; error?: string }> {
  const local = loadAdOrders();
  if (!isSupabaseConfigured) return { orders: local, error: '서버 미설정' };
  try {
    const { data, error } = await supabase.from('ad_orders').select('*').order('requested_at', { ascending: false }).limit(1000);
    if (error) return { orders: local, error: error.message };
    const server = (data || []).map(rowToAdOrder);
    const serverIds = new Set(server.map(o => o.id));
    const merged = [...server, ...local.filter(o => !serverIds.has(o.id))];
    saveAllAdOrders(merged);
    return { orders: merged };
  } catch (e) {
    return { orders: local, error: e instanceof Error ? e.message : '서버 조회 실패' };
  }
}

/**
 * 전체 광고 주문 목록 저장
 */
export function saveAllAdOrders(orders: AdOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('[AdOrderService] saveAllAdOrders error:', e);
  }
}

/**
 * 변호사가 신규 광고 주문 신청 시 저장 및 실시간 브로드캐스트
 */
export function saveNewAdOrder(newOrder: AdOrder): void {
  const current = loadAdOrders();
  const updated = [newOrder, ...current.filter(o => o.id !== newOrder.id)];
  saveAllAdOrders(updated);

  // 1. 같은 윈도우 커스텀 이벤트
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_ad_order_created', { detail: newOrder }));
  }

  // 2. 다른 탭/창 BroadcastChannel 전송
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'AD_ORDER_CREATED', order: newOrder });
    } catch (e) {
      console.warn('[AdOrderService] broadcast error:', e);
    }
  }

  // 3. (백그라운드) Supabase DB 테이블이 존재하는 경우 비동기 저장 시도
  try {
    supabase.from('ad_orders').insert([{
      id: newOrder.id,
      lawyer_id: newOrder.lawyerId,
      lawyer_name: newOrder.lawyerName,
      product_id: newOrder.productId,
      product_name: newOrder.productName,
      contract_months: newOrder.contractMonths,
      monthly_price: newOrder.monthlyPrice,
      total_price: newOrder.totalPrice,
      status: newOrder.status,
      requested_at: newOrder.requestedAt,
      depositor_name: newOrder.depositorName,
      region: newOrder.region,
      buyer_corp_num: newOrder.buyerCorpNum,
      buyer_corp_name: newOrder.buyerCorpName,
      buyer_ceo_name: newOrder.buyerCEOName,
      buyer_email: newOrder.buyerEmail,
    }]).then(({ error }) => {
      if (error && error.code !== '42P01') { // 42P01은 테이블 미존재 에러
        console.warn('[AdOrderService] Supabase insert note:', error.message);
      }
    });
  } catch { /* ignore */ }
}

/**
 * 관리자가 입금 확인/승인 또는 취소 처리 시 업데이트
 */
export async function updateAdOrder(updatedOrder: AdOrder): Promise<{ serverOk: boolean; error?: string }> {
  const current = loadAdOrders();
  const updated = current.map(o => o.id === updatedOrder.id ? updatedOrder : o);
  saveAllAdOrders(updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm_ad_order_updated', { detail: updatedOrder }));
  }

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'AD_ORDER_UPDATED', order: updatedOrder });
    } catch { /* ignore */ }
  }

  // 서버 반영 (024: 관리자만 UPDATE 가능). 이전: 결과를 버려 실패해도 알 수 없었음
  if (!isSupabaseConfigured) return { serverOk: false, error: '서버 미설정' };
  try {
    const { data, error } = await supabase.from('ad_orders').update({
      status: updatedOrder.status,
      paid_at: updatedOrder.paidAt || null,
      activated_at: updatedOrder.activatedAt || null,
      expires_at: updatedOrder.expiresAt || null,
      tax_invoice: updatedOrder.taxInvoice || null,
      modified_tax_invoice: updatedOrder.modifiedTaxInvoice || null,
      buyer_corp_num: updatedOrder.buyerCorpNum || null,
      buyer_corp_name: updatedOrder.buyerCorpName || null,
      buyer_ceo_name: updatedOrder.buyerCEOName || null,
      buyer_email: updatedOrder.buyerEmail || null,
    }).eq('id', updatedOrder.id).select('id');
    if (error) return { serverOk: false, error: error.message };
    if (!data || data.length === 0) return { serverOk: false, error: '서버에 주문이 없거나 권한이 없습니다.' };
    return { serverOk: true };
  } catch (e) {
    return { serverOk: false, error: e instanceof Error ? e.message : '서버 반영 실패' };
  }
}

/**
 * 실시간 주문 수신 리스너 등록
 */
export function subscribeToAdOrders(
  onCreated: (order: AdOrder) => void,
  onUpdated?: (order: AdOrder) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. CustomEvent 핸들러 (동일 탭 내)
  const handleCreated = (e: any) => {
    if (e.detail) onCreated(e.detail);
  };
  const handleUpdated = (e: any) => {
    if (e.detail && onUpdated) onUpdated(e.detail);
  };

  window.addEventListener('crm_ad_order_created', handleCreated);
  window.addEventListener('crm_ad_order_updated', handleUpdated);

  // 2. BroadcastChannel 핸들러 (다른 탭 간)
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'AD_ORDER_CREATED' && event.data.order) {
      onCreated(event.data.order);
    } else if (event.data?.type === 'AD_ORDER_UPDATED' && event.data.order && onUpdated) {
      onUpdated(event.data.order);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  // 3. Storage 이벤트 핸들러 (구형 브라우저 호환)
  // 이전: 키가 바뀔 때마다(상태 변경 포함) 첫 주문을 '신규'로 알려 같은 알림이 반복됐음 → 새 ID만 신규로 처리
  let knownIds = new Set(loadAdOrders().map(o => o.id));
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const fresh: AdOrder[] = JSON.parse(e.newValue);
        const added = fresh.filter(o => !knownIds.has(o.id));
        knownIds = new Set(fresh.map(o => o.id));
        if (added.length > 0) added.forEach(o => onCreated(o));
        else if (onUpdated && fresh[0]) onUpdated(fresh[0]);
      } catch { /* ignore */ }
    }
  };
  window.addEventListener('storage', handleStorage);

  // 클린업 함수
  return () => {
    window.removeEventListener('crm_ad_order_created', handleCreated);
    window.removeEventListener('crm_ad_order_updated', handleUpdated);
    window.removeEventListener('storage', handleStorage);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
}
