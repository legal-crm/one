// 통합어드민 › 광고 주문 › 소재 심사함·구좌 현황 (AD-8)
// 승인 / 반려(사유) / 수정 요청(사유). 결정은 admin_actions에 기록되고 사무소에 알림이 간다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';
import {
  adminListCreatives, adminReviewCreative, adminSlotBoard, signedAdUrls, CREATIVE_KIND_LABEL,
  type AdCreative, type SlotBoardRow,
} from '../../services/ads/adCreativeService';
import { useDialog } from '../common/DialogProvider';

const btn = 'min-h-[36px] px-3 rounded-lg text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1';

export default function AdCreativeReviewPanel({ lawyerName }: { lawyerName: (id: string) => string }) {
  const dialog = useDialog();
  const [list, setList] = useState<AdCreative[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [board, setBoard] = useState<SlotBoardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [c, b] = await Promise.all([adminListCreatives('pending'), adminSlotBoard()]);
    if (c.ok === false) { setError(c.message); return; }
    setList(c.data);
    setUrls(await signedAdUrls(c.data.flatMap(x => [x.imagePath, x.mobileImagePath || ''])));
    if (b.ok) setBoard(b.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (c: AdCreative, action: 'approve' | 'reject' | 'changes') => {
    let note: string | undefined;
    if (action !== 'approve') {
      const v = await dialog.prompt({
        title: action === 'reject' ? '소재 반려' : '소재 수정 요청',
        message: '변호사에게 보낼 사유를 적어 주세요. (예: 실적 수치 표현, 실사풍 가상 인물, 광고책임 변호사 표시 없음)',
        placeholder: '사유',
      });
      if (!v || !String(v).trim()) return;
      note = String(v).trim();
    }
    setBusy(c.id);
    const r = await adminReviewCreative(c.id, action, note);
    setBusy(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(action === 'approve' ? '승인했어요. 준비된 광고는 바로 노출이 시작돼요.' : '사무소에 알렸어요.');
    void load();
  };

  return (
    <section className="space-y-4" aria-label="광고 소재 심사함">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-extrabold text-base">소재 심사함 {list ? `(${list.length})` : ''}</h3>
        <button type="button" onClick={() => void load()} className={`${btn} bg-[#0B0F19] text-slate-300 border border-[#1E293B]`}><RefreshCw className="w-3.5 h-3.5" /> 새로고침</button>
      </div>
      {error && <p role="alert" className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">{error}</p>}
      {!list && !error && <div className="h-24 rounded-2xl bg-[#111622] animate-pulse" aria-busy="true" />}
      {list && list.length === 0 && <p className="text-sm text-slate-400 bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5">심사할 소재가 없어요.</p>}
      {list && list.length > 0 && (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map(c => (
            <li key={c.id} className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl overflow-hidden">
              <div className={c.kind === 'banner' ? 'aspect-[4/3] bg-black' : 'aspect-[3/4] max-h-72 bg-black'}>
                {urls[c.imagePath] && <img src={urls[c.imagePath]} alt={c.altText} className="w-full h-full object-cover" />}
              </div>
              <div className="p-4 space-y-1.5 text-sm">
                <p className="text-xs text-slate-400">{CREATIVE_KIND_LABEL[c.kind]} · {lawyerName(c.lawyerId)} · {new Date(c.createdAt).toLocaleString('ko-KR')}{c.replacesId ? ' · 승인 소재 수정본' : ''}</p>
                <p className="font-bold text-white">{c.headline}</p>
                {c.subline && <p className="text-slate-300">{c.subline}</p>}
                {c.tags.length > 0 && <p className="text-xs text-slate-400">태그: {c.tags.join(', ')}</p>}
                <p className="text-xs text-slate-400">대체 텍스트: {c.altText}</p>
                {c.warnings.length > 0 && <p className="text-xs text-amber-300 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> 자동 확인: {c.warnings.join(', ')}</p>}
                <div className="flex gap-2 pt-2">
                  <button type="button" disabled={busy === c.id} onClick={() => void act(c, 'approve')} className={`${btn} bg-emerald-600 text-white`}><Check className="w-3.5 h-3.5" /> 승인</button>
                  <button type="button" disabled={busy === c.id} onClick={() => void act(c, 'changes')} className={`${btn} bg-amber-500/15 text-amber-300 border border-amber-500/30`}>수정 요청</button>
                  <button type="button" disabled={busy === c.id} onClick={() => void act(c, 'reject')} className={`${btn} bg-red-500/10 text-red-400 border border-red-500/20`}><X className="w-3.5 h-3.5" /> 반려</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {board.length > 0 && (
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="text-left text-white font-extrabold p-3">구좌 현황</caption>
            <thead><tr className="text-slate-500 border-b border-[#1E293B]/60"><th className="p-3">상품</th><th className="p-3">지역</th><th className="p-3 text-right">노출 중</th><th className="p-3 text-right">시작 예정</th><th className="p-3 text-right">입금 대기</th><th className="p-3 text-right">구좌</th></tr></thead>
            <tbody className="divide-y divide-[#1E293B]/30">
              {board.map((b, i) => (
                <tr key={`${b.productId}-${b.region || ''}-${i}`} className="text-slate-300">
                  <td className="p-3">{b.productName}</td><td className="p-3">{b.region || '-'}</td>
                  <td className="p-3 text-right tabular-nums">{b.active}</td><td className="p-3 text-right tabular-nums">{b.scheduled}</td>
                  <td className="p-3 text-right tabular-nums">{b.pending}</td>
                  <td className={`p-3 text-right tabular-nums ${b.active + b.scheduled + b.pending >= b.maxSlots ? 'text-amber-300 font-bold' : ''}`}>{b.active + b.scheduled + b.pending}/{b.maxSlots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
