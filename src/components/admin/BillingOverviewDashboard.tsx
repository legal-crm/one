// ============================================================
// 통합 매출/정산 분석 (PART 3-2 재작성)
// ------------------------------------------------------------
// 이전 화면의 가짜 수치를 제거했다.
//  - 전자계약 부가매출 '변호사 수 × 2.8건 × 3만원'(존재하지 않는 매출)
//  - 운영 원가 고정값(PASS 48,000원·팝빌 3,600원·알림톡 55,250원·인프라 35만원·PG 1.8%)과
//    그것으로 만든 '실질 영업 순이익·마진율'
//  - '+14.8% (전월대비)', 결제 수단 '68% / 32%', 날짜가 고정된 일·주·월 추이 배열과 '정산 완료 142건'
//  - 기간 필터가 월 금액에 1/30·3·12를 곱하기만 하던 계산, '당월 기준 (6월)' 고정 라벨
//  - '국세청 팝빌 API 정상 연동 중 / 매월 10일 자동 합산 전송 완료' 고정 배지
//  - TOP 5가 정렬 전에 앞 5명을 자르던 버그
//  - CSV '회계 원장'에 모든 변호사의 구독료 결제 행('법인카드 자동결제', '영수발행')을 만들어 넣던 문제
// 현재: 실제 기록이 있는 광고 주문(입금 확인일 기준)만 매출로 집계한다.
//   구독료는 결제 연동이 없어 매칭 건수 구간 추정치로만 따로 표시한다.
// ============================================================

import React, { useState, useMemo } from 'react';
import {
  CreditCard, Megaphone, Receipt, AlertTriangle, BarChart3, FileSpreadsheet, ArrowRight, Clock, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { User as LawyerType, AdOrder } from '../../types';
import { localYmd } from '../../utils/localDate';

interface Props {
  lawyers: LawyerType[];
  adOrders: AdOrder[];
  onNavigateSubTab: (subTab: string) => void;
  onOpenInvoiceModal?: (order: AdOrder) => void;
  /** 매칭 건수 구간 추정 구독료 (실결제 아님) */
  activeMRR: number;
  /** 정지·탈퇴 변호사의 추정 구독료 */
  lostMRR: number;
}

type PeriodMode = 'month' | 'quarter' | 'year' | 'all';

const PAID_STATUSES = new Set<AdOrder['status']>(['paid', 'active', 'expired']);

/** 입금 확인 시각 (없으면 활성화 시각) */
const paidDateOf = (o: AdOrder): Date | null => {
  const iso = o.paidAt || o.activatedAt;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const monthlyOf = (o: AdOrder) => Number(o.monthlyPrice) || (Number(o.totalPrice) || 0) / (Number(o.contractMonths) || 1);

/** CSV 셀 — 따옴표 이스케이프 + 수식 주입 방지 */
const csvCell = (v: unknown): string => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function BillingOverviewDashboard({
  lawyers,
  adOrders,
  onNavigateSubTab,
  onOpenInvoiceModal,
  activeMRR,
  lostMRR,
}: Props) {
  const [period, setPeriod] = useState<PeriodMode>('month');

  const now = new Date();
  const periodStart = useMemo(() => {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (period === 'month') return new Date(y, m, 1);
    if (period === 'quarter') return new Date(y, m - 2, 1);
    if (period === 'year') return new Date(y, 0, 1);
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const periodLabel = {
    month: `${now.getMonth() + 1}월 (이번 달)`,
    quarter: '최근 3개월',
    year: `${now.getFullYear()}년`,
    all: '전체 기간',
  }[period];

  const paidOrders = useMemo(() => adOrders.filter(o => PAID_STATUSES.has(o.status)), [adOrders]);

  const metrics = useMemo(() => {
    const inPeriod = paidOrders.filter(o => {
      if (!periodStart) return true;
      const d = paidDateOf(o);
      return d !== null && d.getTime() >= periodStart.getTime();
    });
    const pending = adOrders.filter(o => o.status === 'pending');
    const noInvoice = paidOrders.filter(o => !o.taxInvoice);
    const failedInvoice = adOrders.filter(o => o.taxInvoice?.status === 'failed' || o.modifiedTaxInvoice?.status === 'failed');
    const undated = paidOrders.filter(o => !paidDateOf(o)).length;
    const active = adOrders.filter(o => o.status === 'active');
    return {
      periodRevenue: inPeriod.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0),
      periodCount: inPeriod.length,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0),
      noInvoiceCount: noInvoice.length,
      noInvoiceAmount: noInvoice.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0),
      failedInvoiceCount: failedInvoice.length,
      undated,
      activeCount: active.length,
      activeMonthly: Math.round(active.reduce((s, o) => s + monthlyOf(o), 0)),
    };
  }, [adOrders, paidOrders, periodStart]);

  // 최근 6개월 광고 입금 추이 (입금 확인일 기준)
  const monthlyTrend = useMemo(() => {
    return [5, 4, 3, 2, 1, 0].map(k => {
      const start = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - k + 1, 1);
      const rows = paidOrders.filter(o => {
        const d = paidDateOf(o);
        return d !== null && d >= start && d < end;
      });
      return {
        label: `${start.getFullYear() !== now.getFullYear() ? `${start.getFullYear()}.` : ''}${start.getMonth() + 1}월${k === 0 ? ' (이번 달)' : ''}`,
        amount: rows.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0),
        count: rows.length,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidOrders]);
  const maxTrend = Math.max(1, ...monthlyTrend.map(t => t.amount));

  // 활성 광고 상품별
  const byProduct = useMemo(() => {
    const map = new Map<string, { label: string; count: number; monthly: number }>();
    adOrders.filter(o => o.status === 'active').forEach(o => {
      const key = o.productId || 'other';
      const row = map.get(key) || { label: o.productName || '기타 광고', count: 0, monthly: 0 };
      row.count++;
      row.monthly += monthlyOf(o);
      map.set(key, row);
    });
    return [...map.values()].sort((a, b) => b.monthly - a.monthly);
  }, [adOrders]);

  // 변호사별 광고 입금 합계 TOP 5 (정렬 후 자르기)
  const topPartners = useMemo(() => {
    const map = new Map<string, { id: string; name: string; firm: string; total: number; count: number }>();
    paidOrders.forEach(o => {
      const lawyer = lawyers.find(l => l.id === o.lawyerId);
      const row = map.get(o.lawyerId) || {
        id: o.lawyerId,
        name: o.lawyerName || lawyer?.name || o.lawyerId,
        firm: lawyer?.firmName || o.buyerCorpName || '',
        total: 0,
        count: 0,
      };
      row.total += Number(o.totalPrice) || 0;
      row.count++;
      map.set(o.lawyerId, row);
    });
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [paidOrders, lawyers]);

  const firstPending = adOrders.find(o => o.status === 'pending');

  // 광고 주문 내역 CSV (실제 주문만 — 구독료는 결제 기록이 없어 포함하지 않음)
  const handleExportCsv = () => {
    if (adOrders.length === 0) {
      toast.error('내보낼 광고 주문이 없습니다.');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['신청일', '입금확인일', '상태', '변호사', '상호', '사업자번호', '상품', '계약개월', '공급가액', '부가세', '합계', '입금자명', '세금계산서'];
    const statusLabel: Record<AdOrder['status'], string> = { pending: '입금대기', paid: '입금확인', active: '집행중', expired: '종료', cancelled: '취소' };
    const rows = adOrders.map(o => {
      const total = Number(o.totalPrice) || 0;
      const supply = o.taxInvoice?.supplyCost ?? Math.round(total / 1.1);
      const tax = o.taxInvoice?.tax ?? total - supply;
      const paid = paidDateOf(o);
      return [
        o.requestedAt ? localYmd(new Date(o.requestedAt)) : '',
        paid ? localYmd(paid) : '',
        statusLabel[o.status] || o.status,
        o.lawyerName,
        o.buyerCorpName || '',
        o.buyerCorpNum || '',
        o.productName,
        o.contractMonths,
        supply,
        tax,
        total,
        o.depositorName || '',
        o.taxInvoice ? `발행(${o.taxInvoice.status})` : '미발행',
      ];
    });
    const csv = BOM + [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `마이김변_광고주문내역_${localYmd()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`광고 주문 ${adOrders.length}건을 내려받았습니다.`);
  };

  const cardBase = 'bg-[#111622] p-5 rounded-2xl border space-y-2';

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      {/* ── 헤더 ── */}
      <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-white">매출·정산 현황</h3>
          <p className="text-sm text-slate-400 mt-1">
            광고 주문의 입금 확인 기록만 매출로 집계합니다. 구독료는 결제 연동 전이라 추정치로 따로 표시합니다.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="bg-[#0B0F19] p-1 rounded-xl border border-[#1E293B]/60 flex items-center gap-1" role="group" aria-label="집계 기간">
            {([
              { k: 'month', l: '이번 달' },
              { k: 'quarter', l: '3개월' },
              { k: 'year', l: '올해' },
              { k: 'all', l: '전체' },
            ] as const).map(p => (
              <button
                key={p.k}
                type="button"
                aria-pressed={period === p.k}
                onClick={() => setPeriod(p.k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${period === p.k ? 'bg-[#1E3A5F] text-white' : 'text-slate-300 hover:text-white'}`}
              >
                {p.l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border border-emerald-500/40 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>광고 주문 CSV</span>
          </button>
        </div>
      </div>

      {/* ── 핵심 카드 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardBase} border-amber-500/30`}>
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-300">
            <Megaphone className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>광고 입금 확인액</span>
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">{metrics.periodRevenue.toLocaleString()}원</div>
          <p className="text-xs text-slate-400">{periodLabel} · {metrics.periodCount}건 (부가세 포함)</p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateSubTab('adorders')}
          className={`${cardBase} border-orange-500/30 text-left hover:border-orange-500/60 transition-colors cursor-pointer`}
        >
          <div className="flex items-center justify-between text-sm font-bold text-slate-300">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-400" aria-hidden="true" />입금 대기</span>
            <ArrowRight className="w-4 h-4 text-orange-300" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-orange-300 font-mono">{metrics.pendingAmount.toLocaleString()}원</div>
          <p className="text-xs text-slate-400">{metrics.pendingCount}건 · 입금 확인 후 승인</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSubTab('taxinvoice')}
          className={`${cardBase} border-sky-500/30 text-left hover:border-sky-500/60 transition-colors cursor-pointer`}
        >
          <div className="flex items-center justify-between text-sm font-bold text-slate-300">
            <span className="flex items-center gap-1.5"><Receipt className="w-4 h-4 text-sky-400" aria-hidden="true" />세금계산서 미발행</span>
            <ArrowRight className="w-4 h-4 text-sky-300" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-sky-300 font-mono">{metrics.noInvoiceCount}건</div>
          <p className="text-xs text-slate-400">
            입금 확인분 {metrics.noInvoiceAmount.toLocaleString()}원
            {metrics.failedInvoiceCount > 0 && <span className="text-red-300 font-bold"> · 발행 실패 {metrics.failedInvoiceCount}건</span>}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSubTab('active')}
          className={`${cardBase} border-purple-500/30 text-left hover:border-purple-500/60 transition-colors cursor-pointer`}
        >
          <div className="flex items-center justify-between text-sm font-bold text-slate-300">
            <span className="flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-purple-400" aria-hidden="true" />구독료 (추정)</span>
            <ArrowRight className="w-4 h-4 text-purple-300" aria-hidden="true" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">{activeMRR.toLocaleString()}원/월</div>
          <p className="text-xs text-slate-400">매칭 건수 구간 추정 · 실결제 아님 · 정지·탈퇴분 {lostMRR.toLocaleString()}원</p>
        </button>
      </div>

      {metrics.undated > 0 && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          입금 확인일이 기록되지 않은 주문 {metrics.undated}건은 기간 집계에서 빠지고 '전체'에만 포함됩니다.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 월별 광고 입금 추이 ── */}
        <div className="lg:col-span-2 bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
          <h4 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-[#1E293B]/60 pb-3">
            <BarChart3 className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>월별 광고 입금 (최근 6개월)</span>
          </h4>
          {paidOrders.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">입금 확인된 광고 주문이 아직 없습니다.</p>
          ) : (
            <div className="space-y-2.5">
              {monthlyTrend.map(t => (
                <div key={t.label} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-slate-300">{t.label}</span>
                  <div className="flex-1 bg-[#0B0F19] h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.round((t.amount / maxTrend) * 100)}%` }} />
                  </div>
                  <span className="w-36 text-right font-mono text-slate-200">{t.amount.toLocaleString()}원 · {t.count}건</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 활성 광고 상품 ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B]/60 pb-3">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>집행 중인 광고</span>
            </h4>
            <span className="text-xs text-slate-400">{metrics.activeCount}건 · 월 {metrics.activeMonthly.toLocaleString()}원</span>
          </div>
          {byProduct.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">집행 중인 광고가 없습니다.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {byProduct.map(p => (
                <li key={p.label} className="p-3 bg-[#0B0F19]/60 rounded-xl border border-[#1E293B]/40 flex items-center justify-between">
                  <span className="text-slate-100 font-bold">{p.label} <span className="text-slate-400 font-normal">· {p.count}건</span></span>
                  <span className="font-mono text-amber-300">월 {Math.round(p.monthly).toLocaleString()}원</span>
                </li>
              ))}
            </ul>
          )}
          {firstPending && onOpenInvoiceModal && (
            <button
              type="button"
              onClick={() => onOpenInvoiceModal(firstPending)}
              className="w-full min-h-[44px] px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-sm whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98]"
            >
              가장 오래된 입금 대기 건 확인
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── 변호사별 광고 입금 TOP 5 ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
          <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5 border-b border-[#1E293B]/60 pb-3">
            <Building2 className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>변호사별 광고 입금 합계 TOP 5</span>
          </h4>
          {topPartners.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">입금 확인된 광고 주문이 없습니다.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {topPartners.map((p, i) => (
                <li key={p.id} className="p-2.5 bg-[#0B0F19]/60 rounded-xl border border-[#1E293B]/40 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-100 flex items-center justify-center font-mono text-xs font-black shrink-0">{i + 1}</span>
                    <span className="truncate">
                      <span className="font-bold text-white">{p.name}</span>
                      {p.firm && <span className="text-slate-400"> ({p.firm})</span>}
                    </span>
                  </span>
                  <span className="font-mono font-bold text-indigo-200 shrink-0">{p.total.toLocaleString()}원 · {p.count}건</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ── 확인 필요 항목 ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-red-500/20 space-y-3">
          <h4 className="text-sm font-extrabold text-red-200 flex items-center gap-1.5 border-b border-[#1E293B]/60 pb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" aria-hidden="true" />
            <span>확인 필요</span>
          </h4>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex justify-between"><span>입금 대기 (미수금)</span><span className="font-mono text-orange-300">{metrics.pendingCount}건 · {metrics.pendingAmount.toLocaleString()}원</span></li>
            <li className="flex justify-between"><span>입금 확인 후 세금계산서 미발행</span><span className="font-mono text-sky-300">{metrics.noInvoiceCount}건</span></li>
            <li className="flex justify-between"><span>세금계산서 발행 실패</span><span className={`font-mono ${metrics.failedInvoiceCount > 0 ? 'text-red-300 font-bold' : 'text-slate-300'}`}>{metrics.failedInvoiceCount}건</span></li>
          </ul>
          <p className="text-xs text-slate-400">국세청 전송 상태는 '세금계산서 내역' 탭에서 건별로 확인하세요.</p>
        </div>
      </div>
    </div>
  );
}
