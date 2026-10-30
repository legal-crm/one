// ============================================================
// 변호사 어드민 '광고·결제' 탭 (AD-1~AD-6)
// 상품·가격·구좌·주문·사업자 정보 모두 서버가 원본 (adOrderService)
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, FileText, Info, Megaphone, Receipt, RefreshCw, Save, Shield, Tag } from 'lucide-react';
import type { AdOrder } from '../../../types';
import { BANK_ACCOUNT_INFO } from '../../../data';
import {
  AD_STATUS_LABEL,
  clearLegacyAdOrderCache,
  createAdOrder,
  fetchAdOrders,
  fetchAdProducts,
  fetchActivePromotions,
  fetchBillingProfile,
  quoteAdPrice,
  saveBillingProfile,
  type AdPriceQuote,
  type AdProduct,
  type AdPromotion,
  type OfficeBillingProfile,
} from '../../../services/adOrderService';
import { checkCorpNum, formatCorpNum } from '../../../services/taxInvoiceService';

type Sub = 'status' | 'products' | 'orders' | 'business';

interface AdBillingTabProps {
  officeId?: string;
  lawyerId: string;
  lawyerName: string;
  canManageAds: boolean;
  canViewBilling: boolean;
  onOrderCreated?: (order: AdOrder) => void;
}

const PLACEMENT_INFO: Record<AdProduct['placement'], { icon: string; location: string; description: string; features: string[] }> = {
  main_banner: {
    icon: '🏠',
    location: '고객 홈 첫 화면 오른쪽 슬라이드',
    description: '고객 홈 첫 화면 슬라이드에 사무소 배너가 "광고" 표시와 함께 노출됩니다. 승인된 소재만 게시됩니다.',
    features: ['홈 첫 화면 슬라이드 노출 ("광고" 표시)', '같은 상품 안에서는 순서를 무작위로 섞음', '변호사 실사진 사용, 실사풍 가상 인물 금지', '소재는 마이김변 검토 후 게시'],
  },
  top_exposure: {
    icon: '🔝',
    location: '변호사 찾기 맨 위 광고 구역',
    description: '변호사 찾기 맨 위 광고 구역에 큰 프로필 카드로 노출됩니다. 고객이 직접 고르는 구조이며 추천·배정이 아닙니다.',
    features: ['변호사 찾기 맨 위 광고 구역 ("광고" 표시)', '큰 프로필 카드 (사진·분야·한 줄 소개)', '같은 상품 안에서는 순서를 무작위로 섞음', '상담 건수와 관계없는 정액'],
  },
  regional: {
    icon: '📍',
    location: '변호사 찾기 지역 필터 결과 위',
    description: '고객이 지역을 골랐을 때 그 지역 결과 위에 "광고" 표시와 함께 노출됩니다.',
    features: ['지역 필터 결과 위 광고 구역 ("광고" 표시)', '지역당 구좌 수 제한', '같은 지역 안에서는 순서를 무작위로 섞음', '상담 건수와 관계없는 정액'],
  },
};

const won = (n?: number | null) => (typeof n === 'number' && Number.isFinite(n) ? `${n.toLocaleString('ko-KR')}원` : '-');
const ymd = (s?: string) => (s ? new Date(s).toLocaleDateString('ko-KR') : '-');
const todayYmd = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3">
      <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
      <p className="text-sm text-slate-700">{message}</p>
      <button onClick={onRetry} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer">
        <RefreshCw className="w-4 h-4" /> 다시 불러오기
      </button>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-sky-50 text-sky-700 border-sky-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-slate-50 text-slate-500 border-slate-200',
  cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function AdBillingTab({ officeId, lawyerId, lawyerName, canManageAds, canViewBilling, onOrderCreated }: AdBillingTabProps) {
  const [sub, setSub] = useState<Sub>('status');
  const [products, setProducts] = useState<AdProduct[] | null>(null);
  const [promotions, setPromotions] = useState<AdPromotion[]>([]);
  const [orders, setOrders] = useState<AdOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const [p, pr, o] = await Promise.all([fetchAdProducts(), fetchActivePromotions(), fetchAdOrders()]);
    if (p.ok === false) { setLoadError(p.message); return; }
    if (o.ok === false) { setLoadError(o.message); return; }
    setProducts(p.data);
    setPromotions(pr.ok ? pr.data.filter(x => x.active) : []);
    setOrders(o.data);
  }, []);

  useEffect(() => {
    clearLegacyAdOrderCache();
    void load();
  }, [load]);

  // ── 주문 창 ──
  const [modalProduct, setModalProduct] = useState<AdProduct | null>(null);
  const [months, setMonths] = useState(1);
  const [startsOn, setStartsOn] = useState(todayYmd());
  const [region, setRegion] = useState('');
  const [depositor, setDepositor] = useState('');
  const [quote, setQuote] = useState<AdPriceQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdOrder, setCreatedOrder] = useState<AdOrder | null>(null);

  const openOrder = (p: AdProduct) => {
    setModalProduct(p);
    setMonths(1);
    setStartsOn(todayYmd());
    setRegion('');
    setDepositor('');
    setQuote(null);
    setSubmitError('');
    setCreatedOrder(null);
  };

  useEffect(() => {
    if (!modalProduct || createdOrder) return;
    let cancelled = false;
    setQuoteError('');
    quoteAdPrice(modalProduct.id, months, startsOn).then(r => {
      if (cancelled) return;
      if (r.ok === false) { setQuote(null); setQuoteError(r.message); return; }
      setQuote(r.data);
    });
    return () => { cancelled = true; };
  }, [modalProduct, months, startsOn, createdOrder]);

  const submitOrder = async () => {
    if (!modalProduct || submitting) return;
    setSubmitError('');
    if (!depositor.trim()) { setSubmitError('입금자명을 입력해 주세요.'); return; }
    if (modalProduct.perRegion && !region.trim()) { setSubmitError('노출 지역을 입력해 주세요.'); return; }
    setSubmitting(true);
    const r = await createAdOrder({ lawyerId, productId: modalProduct.id, months, startsOn, region: region.trim() || undefined, depositorName: depositor.trim() });
    setSubmitting(false);
    if (r.ok === false) { setSubmitError(r.message); return; }
    setCreatedOrder(r.data);
    setOrders(prev => [r.data, ...(prev || [])]);
    onOrderCreated?.(r.data);
  };

  const myOrders = orders || [];
  const activeCount = myOrders.filter(o => o.status === 'active').length;
  const pendingCount = myOrders.filter(o => o.status === 'pending').length;
  const monthlyActive = myOrders.filter(o => o.status === 'active').reduce((s, o) => s + (o.supplyAmount ? Math.round(o.supplyAmount / o.contractMonths) : o.monthlyPrice), 0);
  const openPromo = promotions.find(p => p.id === 'open_launch');

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
        {([
          { key: 'status' as const, label: '광고 현황' },
          { key: 'products' as const, label: '광고 상품' },
          { key: 'orders' as const, label: '내 광고 주문' },
          { key: 'business' as const, label: '사업자 · 세금계산서' },
        ]).map(t => (
          <button key={t.key} onClick={() => setSub(t.key)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] ${sub === t.key ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loadError && <ErrorCard message={loadError} onRetry={load} />}
      {!loadError && (products === null || orders === null) && <Skeleton />}

      {!loadError && products && orders && sub === 'status' && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-950 p-6 md:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">광고 · 결제 현황</h2>
              <p className="text-sm text-slate-400">마이김변 이용료는 정액 광고비뿐입니다. 수임료는 의뢰인이 사무소에 직접 납부합니다.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '노출 중', value: `${activeCount}건` },
                { label: '월 광고비(공급가)', value: `${Math.round(monthlyActive / 10000)}만` },
                { label: '입금 대기', value: `${pendingCount}건` },
              ].map(c => (
                <div key={c.label} className="bg-white/5 rounded-xl p-4 border border-white/10 text-center min-w-[110px]">
                  <span className="text-xs text-slate-400 block font-bold">{c.label}</span>
                  <strong className="text-2xl font-black text-white block mt-1 tabular-nums">{c.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loadError && products && orders && sub === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-slate-700" />
            <h3 className="font-extrabold text-xl text-slate-900">광고 상품</h3>
          </div>
          {openPromo && openPromo.startsOn && openPromo.endsOn && (
            <p className="text-sm text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
              {openPromo.name} {openPromo.rate}%: {openPromo.startsOn} ~ {openPromo.endsOn} 사이에 노출되는 달에 적용됩니다. 장기 할인과 겹치지 않고 큰 할인 하나만 적용됩니다.
            </p>
          )}
          {!canManageAds && (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">광고 신청은 '광고 구매' 권한이 있는 구성원만 할 수 있습니다.</p>
          )}
          {products.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">판매 중인 광고 상품이 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {products.map(p => {
                const info = PLACEMENT_INFO[p.placement];
                const discounts = Object.entries(p.termDiscounts).filter(([, r]) => Number(r) > 0).sort((a, b) => Number(a[0]) - Number(b[0]));
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs flex flex-col">
                    <div className="bg-[#1E3A5F] p-6 text-white">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl" aria-hidden="true">{info.icon}</span>
                        <span className="font-extrabold text-lg">{p.name}</span>
                      </div>
                      <p className="text-slate-300 text-xs mt-1">{info.location}</p>
                      <div className="mt-5 flex items-end justify-between">
                        <div>
                          <span className="text-3xl font-black tabular-nums">월 {(p.monthlyPriceWon / 10000).toLocaleString('ko-KR')}만원</span>
                          <span className="text-slate-300 text-xs ml-1">(VAT 별도)</span>
                        </div>
                        <span className="text-xs text-slate-300 font-bold">{p.perRegion ? `지역당 ${p.maxSlots}구좌` : `${p.maxSlots}구좌`}</span>
                      </div>
                    </div>
                    <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-4">
                        <p className="text-sm text-slate-700 leading-relaxed">{info.description}</p>
                        <ul className="space-y-2">
                          {info.features.map(f => (
                            <li key={f} className="flex gap-2 items-start text-sm text-slate-700"><Check className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5" /><span>{f}</span></li>
                          ))}
                        </ul>
                        {discounts.length > 0 && (
                          <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200/80">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-slate-500" /> 장기 계약 할인</span>
                            <div className="flex flex-wrap gap-2">
                              {discounts.map(([m, r]) => (
                                <span key={m} className="bg-white border border-slate-200 text-xs text-slate-700 px-3 py-1.5 rounded-lg font-medium">
                                  {m}개월 <strong className="text-[#1E3A5F]">{r}%↓</strong> 월 {Math.round(p.monthlyPriceWon * (100 - Number(r)) / 100).toLocaleString('ko-KR')}원
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openOrder(p)}
                        disabled={!canManageAds}
                        className="w-full min-h-[44px] py-3 rounded-xl text-sm font-bold bg-[#1E3A5F] hover:bg-[#163152] text-white disabled:bg-slate-300 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer active:scale-[0.98] mt-4"
                      >
                        광고 신청하기
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> 모든 광고에 "광고" 표시가 붙고, 같은 상품 안에서는 순서를 무작위로 섞습니다. 광고비 순 정렬은 하지 않습니다.</p>
        </div>
      )}

      {!loadError && products && orders && sub === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-slate-700" />
            <h3 className="font-extrabold text-xl text-slate-900">내 광고 주문</h3>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-lg">{orders.length}건</span>
            <button onClick={load} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 whitespace-nowrap cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /> 새로고침</button>
          </div>
          {orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600">신청한 광고가 없습니다.</p>
              <button onClick={() => setSub('products')} className="px-4 py-2 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer">광고 상품 보기</button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-x-auto shadow-xs">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-3.5">신청일</th>
                    <th className="p-3.5">상품</th>
                    <th className="p-3.5">노출 기간</th>
                    <th className="p-3.5 text-right">공급가</th>
                    <th className="p-3.5 text-right">VAT</th>
                    <th className="p-3.5 text-right">입금액</th>
                    <th className="p-3.5">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td className="p-3.5 text-slate-600 text-xs whitespace-nowrap">{ymd(o.requestedAt)}</td>
                      <td className="p-3.5 font-bold text-slate-900">{o.productName}{o.region && <span className="text-slate-600 ml-1">({o.region})</span>}<span className="block text-xs text-slate-500 font-medium">{o.lawyerName}</span></td>
                      <td className="p-3.5 text-slate-700 text-xs whitespace-nowrap">{o.startsOn ? `${o.startsOn} ~ ${o.endsOn}` : `${o.contractMonths}개월`}</td>
                      <td className="p-3.5 text-right tabular-nums">{won(o.supplyAmount)}</td>
                      <td className="p-3.5 text-right tabular-nums">{won(o.vatAmount)}</td>
                      <td className="p-3.5 text-right font-black tabular-nums">{won(o.totalPrice)}</td>
                      <td className="p-3.5">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border whitespace-nowrap ${STATUS_STYLE[o.status] || STATUS_STYLE.expired}`}>{AD_STATUS_LABEL[o.status] || o.status}</span>
                        {o.status === 'pending' && o.reservedUntil && <span className="block text-[11px] text-amber-700 mt-1">입금 기한 {ymd(o.reservedUntil)}</span>}
                        {o.status === 'cancelled' && o.cancelReason && <span className="block text-[11px] text-slate-500 mt-1">{o.cancelReason}{typeof o.refundAmount === 'number' ? ` · 환불 ${won(o.refundAmount)}` : ''}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">입금 계좌: {BANK_ACCOUNT_INFO.bank} {BANK_ACCOUNT_INFO.accountNumber} (예금주 {BANK_ACCOUNT_INFO.holder}). 신청 후 3영업일 안에 입금하지 않으면 구좌 예약이 자동으로 풀립니다.</p>
        </div>
      )}

      {!loadError && products && orders && sub === 'business' && (
        <BillingProfileSection officeId={officeId} canEdit={canManageAds} canView={canViewBilling || canManageAds} orders={orders} />
      )}

      {modalProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !submitting && setModalProduct(null)}>
          <div role="dialog" aria-modal="true" aria-label={`${modalProduct.name} 신청`} className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1E3A5F] p-6 text-white rounded-t-3xl">
              <div className="font-extrabold text-xl">{modalProduct.name}</div>
              <p className="text-slate-300 text-xs mt-1">{lawyerName} 변호사 프로필로 노출됩니다.</p>
            </div>
            {!createdOrder ? (
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <span className="text-sm font-bold text-slate-800">계약 기간</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 6, 12].map(m => (
                      <button key={m} onClick={() => setMonths(m)} className={`min-h-[44px] rounded-xl border-2 text-sm font-bold whitespace-nowrap cursor-pointer active:scale-[0.98] ${months === m ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]' : 'border-slate-200 text-slate-700'}`}>{m}개월</button>
                    ))}
                  </div>
                </div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-slate-800">노출 시작일</span>
                  <input type="date" value={startsOn} min={todayYmd()} onChange={e => setStartsOn(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
                </label>
                {modalProduct.perRegion && (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-bold text-slate-800">노출 지역</span>
                    <input value={region} onChange={e => setRegion(e.target.value)} maxLength={30} placeholder="예: 서울, 경기 남부" className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
                  </label>
                )}
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-slate-800">입금자명</span>
                  <input value={depositor} onChange={e => setDepositor(e.target.value)} maxLength={40} placeholder="통장에 찍힐 이름" className="w-full p-3 rounded-xl border border-slate-200 text-sm" />
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5 text-sm">
                  {quoteError && <p className="text-rose-600" role="alert">{quoteError}</p>}
                  {!quoteError && !quote && <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />}
                  {quote && (
                    <>
                      <div className="flex justify-between"><span className="text-slate-600">공급가</span><span className="font-bold tabular-nums">{won(quote.supply)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">부가세 (10%)</span><span className="font-bold tabular-nums">{won(quote.vat)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="font-bold text-slate-900">입금액</span><span className="font-black text-slate-900 tabular-nums">{won(quote.total)}</span></div>
                      {quote.monthsDetail.some(m => m.rate > 0) && (
                        <p className="text-xs text-slate-500">할인: {quote.monthsDetail.map(m => `${m.month}개월째 ${m.rate}%`).join(' · ')}</p>
                      )}
                    </>
                  )}
                </div>
                {submitError && <p className="text-sm text-rose-600" role="alert">{submitError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setModalProduct(null)} disabled={submitting} className="flex-1 min-h-[44px] rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 whitespace-nowrap cursor-pointer active:scale-[0.98]">취소</button>
                  <button onClick={submitOrder} disabled={submitting || !quote} className="flex-1 min-h-[44px] rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer active:scale-[0.98]">{submitting ? '신청 중…' : '신청하기'}</button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4 text-center">
                <Check className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-extrabold text-lg text-slate-900">광고를 신청했습니다</p>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm space-y-1">
                  <p>입금액 <strong className="tabular-nums">{won(createdOrder.totalPrice)}</strong></p>
                  <p>{BANK_ACCOUNT_INFO.bank} {BANK_ACCOUNT_INFO.accountNumber} (예금주 {BANK_ACCOUNT_INFO.holder})</p>
                  {createdOrder.reservedUntil && <p className="text-amber-700">입금 기한 {new Date(createdOrder.reservedUntil).toLocaleString('ko-KR')}까지 구좌를 잡아 둡니다.</p>}
                </div>
                <p className="text-xs text-slate-500">입금이 확인되면 노출 시작일부터 광고가 나갑니다. 세금계산서는 사업자 정보의 이메일로 발행됩니다.</p>
                <button onClick={() => { setModalProduct(null); setSub('orders'); }} className="w-full min-h-[44px] rounded-xl bg-slate-900 text-white font-bold text-sm whitespace-nowrap cursor-pointer active:scale-[0.98]">주문 내역 보기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BillingProfileSection({ officeId, canEdit, canView, orders }: { officeId?: string; canEdit: boolean; canView: boolean; orders: AdOrder[] }) {
  const [profile, setProfile] = useState<OfficeBillingProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<OfficeBillingProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!officeId || !canView) return;
    setError(null);
    const r = await fetchBillingProfile(officeId);
    if (r.ok === false) { setError(r.message); return; }
    setProfile(r.data);
  }, [officeId, canView]);

  useEffect(() => { void load(); }, [load]);

  const invoices = useMemo(() => orders.filter(o => o.taxInvoice), [orders]);

  if (!officeId) return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">사무소 정보를 불러오지 못했습니다. 다시 로그인해 주세요.</div>;
  if (!canView) return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">사업자 정보는 '광고 결제·세금계산서 보기' 권한이 있는 구성원만 볼 수 있습니다.</div>;
  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (profile === undefined) return <Skeleton rows={2} />;

  const startEdit = () => {
    setForm(profile || { officeId, bizType: '서비스', bizClass: '법무 관련 서비스' });
    setFormError('');
    setCheckResult(null);
  };
  const set = (k: keyof OfficeBillingProfile) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => (f ? { ...f, [k]: e.target.value } : f));

  const save = async () => {
    if (!form || saving) return;
    setFormError('');
    const digits = (form.corpNum || '').replace(/[^0-9]/g, '');
    if (digits.length !== 10) { setFormError('사업자등록번호 10자리를 입력해 주세요.'); return; }
    if (!form.corpName?.trim() || !form.ceoName?.trim() || !form.email?.trim()) { setFormError('상호·대표자·세금계산서 수신 이메일을 입력해 주세요.'); return; }
    setSaving(true);
    const r = await saveBillingProfile({ ...form, officeId, corpNum: digits });
    setSaving(false);
    if (r.ok === false) { setFormError(r.message); return; }
    toast.success('사업자 정보를 저장했습니다.');
    setForm(null);
    void load();
  };

  const field = 'w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:border-[#1E3A5F] outline-none';

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-slate-700" />
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">사업자 정보</h3>
            <p className="text-sm text-slate-500">광고비 세금계산서 발행에 씁니다. 사무소 단위로 서버에 저장됩니다.</p>
          </div>
        </div>

        {!form && !profile && (
          <div className="text-center py-8 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-600">등록된 사업자 정보가 없습니다.</p>
            {canEdit && <button onClick={startEdit} className="px-5 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer">사업자 정보 등록</button>}
          </div>
        )}

        {!form && profile && (
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">사업자번호</span> <span className="font-bold ml-1.5">{profile.corpNum ? formatCorpNum(profile.corpNum) : '-'}</span></div>
              <div><span className="text-slate-500">상호</span> <span className="font-bold ml-1.5">{profile.corpName || '-'}</span></div>
              <div><span className="text-slate-500">대표자</span> <span className="font-bold ml-1.5">{profile.ceoName || '-'}</span></div>
              <div><span className="text-slate-500">계산서 이메일</span> <span className="font-bold ml-1.5">{profile.email || '-'}</span></div>
              {profile.email2 && <div><span className="text-slate-500">추가 이메일</span> <span className="font-bold ml-1.5">{profile.email2}</span></div>}
              {profile.address && <div className="sm:col-span-2"><span className="text-slate-500">주소</span> <span className="font-bold ml-1.5">{profile.address}</span></div>}
            </div>
            {canEdit && <button onClick={startEdit} className="text-sm font-bold text-[#1E3A5F] hover:underline cursor-pointer">수정</button>}
          </div>
        )}

        {form && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1.5">사업자등록번호 *</label>
                <div className="flex gap-2">
                  <input value={form.corpNum || ''} onChange={set('corpNum')} placeholder="000-00-00000" maxLength={12} className={field} />
                  <button
                    onClick={async () => {
                      setCheckResult('확인 중…');
                      const r = await checkCorpNum(form.corpNum || '');
                      const st = (r.data as any)?.state;
                      setCheckResult(!r.ok ? `확인 실패: ${r.error || ''}` : String(st) === '1' ? '사업 중 (휴폐업 조회)' : String(st) === '2' ? '폐업' : String(st) === '3' ? '휴업' : '상태 확인 불가');
                    }}
                    className="px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 whitespace-nowrap cursor-pointer"
                  >확인</button>
                </div>
                {checkResult && <p className="text-xs mt-1.5 text-slate-600">{checkResult}</p>}
              </div>
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">상호 *</label><input value={form.corpName || ''} onChange={set('corpName')} className={field} /></div>
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">대표자명 *</label><input value={form.ceoName || ''} onChange={set('ceoName')} className={field} /></div>
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">세금계산서 수신 이메일 *</label><input type="email" value={form.email || ''} onChange={set('email')} className={field} /></div>
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">추가 수신 이메일</label><input type="email" value={form.email2 || ''} onChange={set('email2')} className={field} /></div>
              <div><label className="text-sm font-bold text-slate-700 block mb-1.5">업태 / 종목</label>
                <div className="flex gap-2"><input value={form.bizType || ''} onChange={set('bizType')} className={field} /><input value={form.bizClass || ''} onChange={set('bizClass')} className={field} /></div>
              </div>
              <div className="md:col-span-2"><label className="text-sm font-bold text-slate-700 block mb-1.5">사업장 주소</label><input value={form.address || ''} onChange={set('address')} className={field} /></div>
            </div>
            {formError && <p className="text-sm text-rose-600" role="alert">{formError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setForm(null)} className="flex-1 min-h-[44px] rounded-xl bg-slate-100 text-slate-700 text-sm font-bold whitespace-nowrap cursor-pointer active:scale-[0.98]">취소</button>
              <button onClick={save} disabled={saving} className="flex-1 min-h-[44px] rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"><Save className="w-4 h-4" />{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 space-y-4">
        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-slate-700" />세금계산서 발행 내역</h4>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">아직 발행된 세금계산서가 없습니다. 입금이 확인되면 마이김변이 발행하고 수신 이메일로 보냅니다.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map(o => (
              <li key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-bold text-slate-900">{o.productName}</p>
                  <p className="text-xs text-slate-500">{ymd(o.taxInvoice?.issuedAt)}{o.taxInvoice?.ntsConfirmNum && ` · 승인번호 ${o.taxInvoice.ntsConfirmNum}`}</p>
                  {o.modifiedTaxInvoice && <p className="text-xs text-rose-600">수정발행: {o.modifiedTaxInvoice.modifyReason} ({won(o.modifiedTaxInvoice.totalAmount)})</p>}
                </div>
                <span className="text-sm font-black tabular-nums">{won(o.taxInvoice?.totalAmount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 space-y-3 shadow-xs">
        <span className="font-extrabold text-slate-900 text-base flex items-center gap-2"><Shield className="w-5 h-5 text-slate-700" /> 광고 운영 원칙</span>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />모든 광고 영역에 "광고" 표시</li>
          <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />같은 상품 안에서는 무작위 순서 (광고비 순 정렬 없음)</li>
          <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />고객이 직접 고르는 구조 (매칭·배정·추천 없음)</li>
          <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />상담 건당 과금·수임 연동 수수료 없음</li>
        </ul>
      </div>
    </div>
  );
}
