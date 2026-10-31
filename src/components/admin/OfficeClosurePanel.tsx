// 통합어드민 › 회원: 사무소 탈퇴 처리 (변호사회원 이용약관 제10조 제3항 7호·제16조)
// 대표가 탈퇴를 요청하면(개인정보 요청·문의) 관리자가 사무소를 종료한다.
// 종료 즉시 구성원 접근·업무폰·로그인 세션이 끊기고, 30일 뒤 서버 작업이 사무소 데이터를 파기한다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, RefreshCw } from 'lucide-react';
import { useDialog } from '../common/DialogProvider';
import { closeOffice, loadClosedOffices, reopenOffice, type ClosedOffice } from '../../services/admin/adminOpsService';

export default function OfficeClosurePanel() {
  const dialog = useDialog();
  const [rows, setRows] = useState<ClosedOffice[] | null>(null);
  const [error, setError] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await loadClosedOffices();
    if (r.ok === false) { setError(r.message); setRows([]); return; }
    setError(''); setRows(r.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const id = officeId.trim();
    if (!id) { setFieldError('사무소 ID(대표 변호사 ID)를 적어 주세요.'); return; }
    if (reason.trim().length < 4) { setFieldError('종료 사유를 4자 이상 적어 주세요. 예: 대표 탈퇴 요청(개인정보 요청 접수)'); return; }
    setFieldError('');
    const ok = await dialog.confirm({
      title: '사무소를 종료할까요?',
      message: `사무소 ${id}의 구성원은 바로 사무소 데이터에 접근할 수 없게 되고, 업무폰 연결과 로그인 세션이 끊겨요. 대표 변호사 프로필은 변호사 찾기에서 빠져요.\n\n30일 뒤 사건·서류·녹음·영업 DB 등 사무소 데이터가 파기돼요. 그 전에 대표가 '데이터 내보내기'로 자료를 받았는지 확인하세요. 30일 안에는 되돌릴 수 있어요.`,
      confirmText: '종료하기',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const r = await closeOffice(id, reason);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`종료했어요. ${r.data.purgeOn}에 파기가 시작돼요.`);
    setOfficeId(''); setReason('');
    void load();
  };

  const reopen = async (row: ClosedOffice) => {
    const v = await dialog.prompt({ title: '사무소 되돌리기', message: '되돌리는 사유를 적어 주세요. 예: 대표가 탈퇴를 철회함', placeholder: '사유' });
    if (!v || !v.trim()) return;
    const r = await reopenOffice(row.officeId, v);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('사무소를 다시 열었어요.');
    void load();
  };

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-white"><Building2 className="w-4 h-4 text-indigo-400" aria-hidden="true" />사무소 탈퇴</h3>
        <button type="button" onClick={() => void load()} aria-label="새로고침" className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-300 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
      </div>
      <p className="text-xs text-slate-400">대표의 탈퇴 요청을 받으면 종료해요. 노출 중이거나 시작 예정인 광고가 있으면 광고 주문을 먼저 취소·환불해야 해요. 광고 주문·세금계산서 기록은 회사 보관 기록이라 남아요.</p>
      <div className="flex flex-col lg:flex-row gap-2">
        <input value={officeId} onChange={e => setOfficeId(e.target.value)} placeholder="사무소 ID (대표 변호사 ID)" aria-label="사무소 ID"
          className="min-h-11 flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-500" />
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="종료 사유" aria-label="종료 사유" maxLength={300}
          className="min-h-11 flex-[2] rounded-xl bg-slate-900 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-500" />
        <button type="button" disabled={busy} onClick={() => void submit()} className="min-h-11 px-4 rounded-xl bg-rose-600 text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">사무소 종료</button>
      </div>
      {fieldError && <p className="text-xs text-rose-300" role="alert">{fieldError}</p>}
      {error ? <p className="text-sm text-rose-300">{error}</p> : rows === null ? (
        <div className="h-12 rounded-xl bg-slate-800/60 animate-pulse" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">종료된 사무소가 없어요.</p>
      ) : (
        <ul className="divide-y divide-[#1E293B]/50">
          {rows.map(r => (
            <li key={r.officeId} className="py-2.5 flex flex-col lg:flex-row lg:items-center gap-2 text-sm">
              <div className="flex-1 text-slate-200">
                <span className="font-bold">{r.officeName || r.officeId}</span>
                <span className="text-slate-400"> · {new Date(r.closedAt).toLocaleDateString('ko-KR')} 종료 · </span>
                <span className={r.purgeStarted ? 'text-rose-300 font-bold' : 'text-amber-300'}>{r.purgeStarted ? '파기 진행 중' : `${r.purgeOn} 파기 예정`}</span>
                {r.closeReason && <p className="text-xs text-slate-400 break-words">{r.closeReason}</p>}
              </div>
              {!r.purgeStarted && (
                <button type="button" onClick={() => void reopen(r)} className="min-h-10 px-3 rounded-xl bg-slate-800 text-slate-100 text-xs font-bold whitespace-nowrap active:scale-[0.98]">되돌리기</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
