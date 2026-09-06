// src/services/adOrderService.ts
// 광고 주문(AdOrder) 영속화 및 브라우저/탭 간 실시간 동기화 서비스

import type { AdOrder } from '../types';
import { mockAdOrders } from '../data';
import { supabase } from '../supabaseClient';

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
  if (typeof window === 'undefined') return mockAdOrders;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[AdOrderService] loadAdOrders parse error:', e);
  }

  // 초기화되지 않은 경우 mockAdOrders 저장 후 반환
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockAdOrders));
  } catch { /* ignore */ }
  return mockAdOrders;
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
export function updateAdOrder(updatedOrder: AdOrder): void {
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

  // Supabase 동기화 시도
  try {
    supabase.from('ad_orders').update({
      status: updatedOrder.status,
      paid_at: updatedOrder.paidAt,
      activated_at: updatedOrder.activatedAt,
      expires_at: updatedOrder.expiresAt,
      tax_invoice: updatedOrder.taxInvoice,
      modified_tax_invoice: updatedOrder.modifiedTaxInvoice,
    }).eq('id', updatedOrder.id).then(() => {});
  } catch { /* ignore */ }
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
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const fresh: AdOrder[] = JSON.parse(e.newValue);
        if (fresh.length > 0) {
          onCreated(fresh[0]);
        }
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
