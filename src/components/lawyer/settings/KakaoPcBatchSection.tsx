// 설정 › 업무폰 › PC 카톡 묶음 발송 (KT-8 1단계, 사무소 선택 · [운영자 판단])
// 담당자 카톡으로 보낼 안내 중 '의뢰인 카톡 이름'이 다른 사건과 겹치지 않는 것만 30줄씩 엑셀로 내보내고,
// 사무소 엑셀 발송 양식으로 보낸 뒤 발송결과(F열)가 채워진 파일을 올리면 1인 줄만 '보냄(PC 묶음)'으로 기록한다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import { listPcBatch, recordPcBatchResults, type PcBatchRow } from '../../../services/comm/clientNoticeService';
import { buildPcBatchTable, readPcBatchResults } from '../../../services/comm/kakaoPcBatchSheet';

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function KakaoPcBatchSection({ officeId, dailyLimit }: { officeId: string; dailyLimit: number }) {
  const dialog = useDialog();
  const [rows, setRows] = useState<PcBatchRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await listPcBatch(officeId);
    if (!r.ok) { setError(r.message); setRows([]); return; }
    setError(''); setRows(r.data);
  }, [officeId]);
  useEffect(() => { void load(); }, [load]);

  const exportXlsx = async () => {
    if (!rows || rows.length === 0) return;
    const XLSX = await import('xlsx-js-style');
    const table = buildPcBatchTable(rows.map(r => ({ taskId: r.taskId, kakaoName: r.kakaoName, body: r.body })));
    const ws = XLSX.utils.aoa_to_sheet(table);
    ws['!cols'] = [{ wch: 2 }, { wch: 8 }, { wch: 18 }, { wch: 60 }, { wch: 10 }, { wch: 10 }, { wch: 38 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '카톡문자발송');
    const d = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '');
    XLSX.writeFile(wb, `카톡묶음발송_${d}.xlsx`);
    toast.success('내려받았어요. B8:E37 칸을 엑셀 카톡 발송 양식의 같은 칸에 붙여 넣어 보내 주세요.');
  };

  const importResults = async (file: File) => {
    if (!rows || rows.length === 0) { toast.error('지금 보낼 목록이 없어요. 목록을 새로 불러온 뒤 올려 주세요.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('5MB 이하 파일만 읽을 수 있어요.'); return; }
    setBusy(true);
    try {
      const XLSX = await import('xlsx-js-style');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets['카톡문자발송'] || wb.Sheets[wb.SheetNames[0]];
      const table = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][];
      const read = readPcBatchResults(table, rows.map(r => ({ taskId: r.taskId, kakaoName: r.kakaoName, body: r.body })));
      if (read.rows === 0) { toast.error('발송 목록 줄을 찾지 못했어요. 발송결과가 채워진 양식 파일인지 확인해 주세요.'); return; }
      const ok = await dialog.confirm({
        title: '발송 결과 기록',
        message: `발송결과 1인 줄 ${read.sent.length}건을 '담당자 카톡(PC 묶음)'으로 기록해요.`
          + (read.failed ? `\n0인 줄 ${read.failed}건은 할 일로 남아요(기한이 지나면 알림톡으로 대체).` : '')
          + (read.unmatched ? `\n지금 목록과 맞지 않는 줄 ${read.unmatched}건은 기록하지 않아요.` : '')
          + '\n발송결과 1은 엑셀 양식이 대화방을 찾고 보내기를 눌렀다는 뜻이에요. 실제로 갔는지는 카카오톡에서 확인해 주세요.',
        confirmText: '기록하기',
      });
      if (!ok || read.sent.length === 0) return;
      const res = await recordPcBatchResults(officeId, read.sent);
      if (!res.ok) { toast.error(res.message); return; }
      toast.success(`${res.data.sent}건을 보낸 것으로 기록했어요.${res.data.skipped ? ` ${res.data.skipped}건은 이미 처리됐거나 하루 한도를 넘어 건너뛰었어요.` : ''}`);
      void load();
    } catch {
      toast.error('파일을 읽지 못했어요. 엑셀(.xlsx·.xlsm) 파일인지 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><FileSpreadsheet className="w-4 h-4 text-amber-600" aria-hidden="true" />PC 카톡 묶음 발송</h3>
      <p className="mt-1 text-xs text-slate-600">
        [운영자 판단] 사무소가 켠 선택 기능이에요. 담당자 카톡 안내 중 의뢰인 카톡 이름이 다른 사건과 겹치지 않는 것만 30줄씩 내보내요. 하루 기록 한도 {dailyLimit}건.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!rows || rows.length === 0} onClick={() => void exportXlsx()} className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover disabled:opacity-50 active:scale-[0.98] whitespace-nowrap"><Download className="w-4 h-4" aria-hidden="true" />보낼 목록 엑셀로 내려받기</button>
        <label className={`inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="w-4 h-4" aria-hidden="true" />{busy ? '읽는 중…' : '발송 결과 올리기'}
          <input type="file" accept=".xlsx,.xlsm,.xls" className="sr-only" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importResults(f); }} />
        </label>
        <button type="button" onClick={() => void load()} aria-label="목록 새로고침" className="ml-auto min-h-10 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      {rows === null ? (
        <div className="mt-3 h-14 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-3 text-center text-sm text-slate-500">보낼 안내가 없어요. 사건 화면 '소통 기록'에서 의뢰인 카톡 이름을 등록하면 담당자 카톡 안내가 이 목록에 들어와요.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map(r => (
            <li key={r.taskId} className="px-3 py-2 text-sm flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{r.kakaoName}</span>
              <span className="text-slate-600">{r.title}</span>
              <span className="ml-auto text-xs text-slate-500">기한 {fmt(r.dueAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
