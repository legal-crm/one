// 영업 DB 통계 (SL-11·SL-17) — 유입 경로별·거래처별 퍼널, 종료 사유, 첫 연락까지 시간, 비용 지표
// 서버 sales_funnel_stats (개인정보 없음, 사무소 전체 보기 권한만). 거래처 품질 보고서(숫자만)도 여기서 내려받는다.
import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import { LEAD_CLOSE_REASON_LABEL } from '../../../types/leadTypes';
import { getCachedVendors, loadFunnelStats, type FunnelRow } from '../../../services/sales/salesVendorService';

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '-');
const won = (n: number | null) => (n === null || !Number.isFinite(n) ? '-' : `${Math.round(n).toLocaleString('ko-KR')}원`);
const ymd = (d: Date) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

export default function SalesStatsModal({ officeId, onClose }: { officeId: string; onClose: () => void }) {
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 30 * 86400e3)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [kind, setKind] = useState<'source' | 'vendor'>('source');
  const [rows, setRows] = useState<FunnelRow[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setRows(null); setErr('');
    const r = await loadFunnelStats(officeId, from, to);
    if (r.ok === false) { setErr(r.message); return; }
    setRows(r.data);
  }, [officeId, from, to]);
  useEffect(() => { void load(); }, [load]);

  const vendors = getCachedVendors();
  const label = (r: FunnelRow) => (r.kind === 'source' ? r.key : r.key === '-' ? '자체 광고' : vendors.find(v => v.id === r.key)?.name || '삭제된 거래처');
  const shown = (rows || []).filter(r => r.kind === kind);

  const exportCsv = () => {
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
    const reasons = Object.keys(LEAD_CLOSE_REASON_LABEL);
    const head = ['구분', '리드', '유효 리드', '연결', '상담 중까지', '이관', '첫 연락(분)', '비용', '리드당 비용', '유효 리드당 비용', '이관당 비용', ...reasons.map(k => `종료:${LEAD_CLOSE_REASON_LABEL[k]}`)];
    const lines = [head.map(esc).join(',')];
    for (const r of shown) {
      lines.push([label(r), r.leads, r.valid, r.connected, r.counseled, r.converted, r.firstContactMin ?? '', r.cost ?? '', r.cost && r.leads ? Math.round(r.cost / r.leads) : '', r.cost && r.valid ? Math.round(r.cost / r.valid) : '', r.cost && r.converted ? Math.round(r.cost / r.converted) : '', ...reasons.map(k => r.reasons[k] || 0)].map(esc).join(','));
    }
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `영업통계_${kind === 'vendor' ? '거래처별' : '유입경로별'}_${from}_${to}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby="sales-stats-title" className="w-full max-w-5xl rounded-3xl bg-white shadow-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 id="sales-stats-title" className="text-base font-black text-slate-900">영업 DB 통계</h3>
            <button type="button" onClick={onClose} aria-label="닫기" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex flex-wrap items-end gap-3 px-6 pt-4">
            <label className="text-xs font-semibold text-slate-700">시작<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-700">끝<input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm" /></label>
            <div className="flex gap-1.5" role="tablist">
              {([['source', '유입 경로별'], ['vendor', '거래처별']] as const).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`min-h-[40px] px-3.5 rounded-xl text-sm font-bold whitespace-nowrap ${kind === k ? 'bg-[#1E3A5F] text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>{l}</button>
              ))}
            </div>
            <button type="button" disabled={!shown.length} onClick={exportCsv} className="ml-auto min-h-[40px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap disabled:opacity-50 active:scale-[0.98]"><Download className="w-4 h-4 inline mr-1" />{kind === 'vendor' ? '품질 보고서(숫자만)' : '엑셀(CSV)'}</button>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {err && <p role="alert" className="text-sm text-rose-700">{err}</p>}
            {!rows && !err && <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />)}</div>}
            {rows && shown.length === 0 && <p className="text-sm text-slate-500 text-center py-10">이 기간에 들어온 리드가 없어요.</p>}
            {shown.length > 0 && (
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="p-2 text-left">{kind === 'vendor' ? '거래처' : '유입 경로'}</th>
                    <th className="p-2 text-right">리드</th><th className="p-2 text-right">유효</th><th className="p-2 text-right">연결률</th>
                    <th className="p-2 text-right">상담 중까지</th><th className="p-2 text-right">이관</th><th className="p-2 text-right">첫 연락</th>
                    {kind === 'vendor' && <><th className="p-2 text-right">비용</th><th className="p-2 text-right">유효 리드당</th><th className="p-2 text-right">이관당</th></>}
                    <th className="p-2 text-left">주요 종료 사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map(r => {
                    const top = Object.entries(r.reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
                    return (
                      <tr key={r.key}>
                        <td className="p-2 font-bold text-slate-900">{label(r)}</td>
                        <td className="p-2 text-right tabular-nums">{r.leads}</td>
                        <td className="p-2 text-right tabular-nums">{r.valid}</td>
                        <td className="p-2 text-right tabular-nums">{pct(r.connected, r.leads)}</td>
                        <td className="p-2 text-right tabular-nums">{r.counseled} ({pct(r.counseled, r.leads)})</td>
                        <td className="p-2 text-right tabular-nums">{r.converted} ({pct(r.converted, r.leads)})</td>
                        <td className="p-2 text-right tabular-nums">{r.firstContactMin === null ? '-' : r.firstContactMin < 120 ? `${r.firstContactMin}분` : `${Math.round(r.firstContactMin / 60)}시간`}</td>
                        {kind === 'vendor' && <>
                          <td className="p-2 text-right tabular-nums">{won(r.cost)}</td>
                          <td className="p-2 text-right tabular-nums">{r.cost && r.valid ? won(r.cost / r.valid) : '-'}</td>
                          <td className="p-2 text-right tabular-nums">{r.cost && r.converted ? won(r.cost / r.converted) : '-'}</td>
                        </>}
                        <td className="p-2 text-xs text-slate-600">{top.length ? top.map(([k, n]) => `${LEAD_CLOSE_REASON_LABEL[k] || k} ${n}`).join(' · ') : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-4 text-[11px] text-slate-500">유효 리드 = 결번·중복·본인 아님·허위 정보로 끝난 리드를 뺀 수. 비용은 거래처 '청구·지급'에 적은 금액이에요. 상담 요청 수나 결과로 대행사 지급액을 계산하지 않아요.</p>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
