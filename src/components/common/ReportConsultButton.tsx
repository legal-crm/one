// 상담 요청 신고 (OP-7): 의뢰인·사무소가 스팸·부적절한 상담을 마이김변에 알린다.
// 관리자는 신고가 있는 요청만 사유를 남기고 원문을 확인할 수 있다.
import { useState } from 'react';
import { toast } from 'sonner';
import { Flag } from 'lucide-react';
import { reportConsultRequest } from '../../services/admin/adminOpsService';

const CATEGORIES = [
  ['spam', '스팸·광고'], ['abuse', '욕설·괴롭힘'], ['fraud', '사기 의심'], ['privacy', '개인정보 문제'], ['other', '기타'],
] as const;

export default function ReportConsultButton({ requestId, tone = 'light' }: { requestId: string; tone?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>('spam');
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    const r = await reportConsultRequest(requestId, category, detail);
    setSending(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('신고를 보냈어요. 마이김변이 확인한 뒤 알려 드려요.');
    setOpen(false);
    setDetail('');
  };

  const btn = tone === 'dark'
    ? 'text-slate-300 hover:text-white hover:bg-white/10'
    : 'text-slate-500 hover:text-rose-700 hover:bg-rose-50';

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className={`inline-flex items-center gap-1 min-h-9 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] ${btn}`}>
        <Flag className="w-3.5 h-3.5" aria-hidden="true" />신고
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg space-y-2 text-left">
          <p className="text-xs font-bold text-slate-800">이 상담을 마이김변에 신고할까요?</p>
          <select value={category} onChange={e => setCategory(e.target.value as typeof category)} aria-label="신고 이유" className="w-full min-h-10 rounded-xl border border-slate-200 px-2 text-sm">
            {CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3} maxLength={1000} placeholder="무슨 일이 있었는지 적어 주세요 (선택)" aria-label="신고 내용" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <p className="text-[11px] text-slate-500">신고가 있으면 마이김변 관리자가 사유를 남기고 이 상담 내용을 확인할 수 있어요.</p>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setOpen(false)} className="min-h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 whitespace-nowrap">취소</button>
            <button type="button" disabled={sending} onClick={() => void send()} className="min-h-9 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-60 whitespace-nowrap active:scale-[0.98]">신고 보내기</button>
          </div>
        </div>
      )}
    </div>
  );
}
