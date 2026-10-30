// 회생동행 '내 보정 정리' (CR-12) — 나홀로·다른 사무소 이용자 본인용
// 법원이 보낸 보정 항목을 직접 옮겨 적고, 낼 서류와 표를 정리해 본인용 정리표로 인쇄한다.
// 보정서 문장을 대신 써 주거나 "이렇게 하면 된다" 같은 판단은 하지 않는다(제109조). 기록은 본인만 본다.
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Plus, Printer, Trash2 } from 'lucide-react';
import { DocModal, Button } from '../ui';
import { useDialog } from '../../common/DialogProvider';
import { CORRECTION_TABLES, TABLE_OPTIONS, cleanRows, formatMoneyCell } from '../../../services/corrections/correctionTables';
import type { TableType } from '../../../services/corrections/correctionLabels';
import {
  deleteSelfCorrection, loadSelfCorrections, saveSelfCorrection,
  type SelfCorrection, type SelfCorrectionItem,
} from '../../../services/corrections/selfCorrectionService';

const input = 'w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm bg-white';
const newItem = (): SelfCorrectionItem => ({ id: `si-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: '', docs: '', note: '', done: false, rows: [] });
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function printSheet(c: SelfCorrection) {
  const body = c.items.map((it, i) => {
    const def = it.tableType ? CORRECTION_TABLES[it.tableType] : null;
    const rows = it.tableType ? cleanRows(it.tableType, it.rows) : [];
    const table = def && rows.length ? `<table><thead><tr>${def.columns.map(col => `<th>${esc(col.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${def.columns.map(col => `<td>${esc(col.kind === 'money' ? formatMoneyCell(r[col.key]) : r[col.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
    return `<section><h2>${i + 1}. ${esc(it.title || '(제목 없음)')} ${it.done ? '✔' : ''}</h2>${it.docs ? `<p><b>낼 서류</b> ${esc(it.docs)}</p>` : ''}${it.note ? `<p><b>메모</b> ${esc(it.note).replace(/\n/g, '<br>')}</p>` : ''}${table}</section>`;
  }).join('');
  const w = window.open('', '_blank');
  if (!w) { toast.error('팝업이 막혀 있어요. 이 사이트의 팝업을 허용해 주세요.'); return; }
  w.document.open();
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(c.title)}</title><style>
    body{font-family:'Malgun Gothic',sans-serif;font-size:11pt;line-height:1.6;margin:20mm}h1{font-size:16pt}h2{font-size:12pt;margin:14px 0 4px}
    table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #999;padding:3px 5px;text-align:left}.note{color:#555;font-size:9pt}
  </style></head><body><h1>${esc(c.title)} — 본인용 정리표</h1>
  <p>${esc(c.courtName || '')} ${c.servedOn ? `· 받은 날 ${esc(c.servedOn)}` : ''} ${c.dueOn ? `· 낼 기한 ${esc(c.dueOn)}` : ''}</p>
  ${body}<p class="note">이 표는 본인 정리용입니다. 법원에 내는 보정서는 법원 요청에 맞춰 직접 작성하거나 법률 전문가와 상의해 작성하세요.</p></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export default function SelfCorrectionNotebookModal({ onClose, defaultCourt }: { onClose: () => void; defaultCourt?: string }) {
  const dialog = useDialog();
  const [list, setList] = useState<SelfCorrection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<(Omit<SelfCorrection, 'id' | 'updatedAt'> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await loadSelfCorrections();
    if (r.ok === false) { setError(r.message); setList([]); return; }
    setError(null);
    setList(r.data);
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) { toast.error('제목을 적어 주세요. (예: 1차 보정권고)'); return; }
    setSaving(true);
    const r = await saveSelfCorrection(edit);
    setSaving(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('저장했어요.');
    setEdit({ ...r.data });
    void load();
  };
  const remove = async (c: SelfCorrection) => {
    const ok = await dialog.confirm({ title: '이 정리를 지울까요?', message: '지운 내용은 되돌릴 수 없어요.', variant: 'danger', confirmText: '지우기' });
    if (!ok) return;
    const r = await deleteSelfCorrection(c.id);
    if (r.ok === false) { toast.error(r.message); return; }
    if (edit?.id === c.id) setEdit(null);
    void load();
  };
  const setItem = (id: string, patch: Partial<SelfCorrectionItem>) => setEdit(e => e && ({ ...e, items: e.items.map(i => (i.id === id ? { ...i, ...patch } : i)) }));

  return (
    <DocModal
      onClose={onClose}
      closeLabel="내 보정 정리 닫기"
      size="2xl"
      icon={<ClipboardList className="w-5 h-5" />}
      title="내 보정 정리"
      description="법원이 보낸 보정 항목을 옮겨 적고, 낼 서류와 표를 정리해요. 본인만 볼 수 있어요."
      footer={edit ? (
        <>
          <Button variant="ghost" onClick={() => setEdit(null)}>목록으로</Button>
          {edit.id && <Button variant="ghost" leftIcon={<Printer className="w-4 h-4" />} onClick={() => printSheet({ ...(edit as SelfCorrection) })}>정리표 인쇄</Button>}
          <Button onClick={() => void save()} loading={saving}>저장</Button>
        </>
      ) : (
        <Button onClick={() => setEdit({ title: '', courtName: defaultCourt, items: [newItem()] })} leftIcon={<Plus className="w-4 h-4" />}>새 보정 정리</Button>
      )}
    >
      {!edit && (
        <div className="space-y-3">
          {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
          {list === null && <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />}
          {list && list.length === 0 && !error && (
            <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-1">
              <p className="text-sm font-bold text-slate-700">아직 정리한 보정이 없어요</p>
              <p className="text-xs text-slate-500">법원에서 보정권고·보정명령을 받으면 '새 보정 정리'로 항목을 옮겨 적어 보세요.</p>
            </div>
          )}
          {list && list.length > 0 && (
            <ul className="space-y-2">
              {list.map(c => (
                <li key={c.id} className="border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setEdit({ ...c })} className="flex-1 min-w-0 min-h-[44px] text-left">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.title}</p>
                    <p className="text-xs text-slate-500">항목 {c.items.length}개 · 끝낸 것 {c.items.filter(i => i.done).length}개{c.dueOn ? ` · 기한 ${c.dueOn}` : ''}</p>
                  </button>
                  <button type="button" onClick={() => void remove(c)} aria-label="지우기" className="min-h-[44px] min-w-[44px] rounded-xl border border-rose-200 text-rose-700 inline-flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {edit && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs font-bold text-slate-700 space-y-1">제목<input className={input} value={edit.title} maxLength={80} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="예: 1차 보정권고" /></label>
            <label className="text-xs font-bold text-slate-700 space-y-1">법원<input className={input} value={edit.courtName || ''} maxLength={60} onChange={e => setEdit({ ...edit, courtName: e.target.value })} /></label>
            <label className="text-xs font-bold text-slate-700 space-y-1">받은 날<input type="date" className={input} value={edit.servedOn || ''} onChange={e => setEdit({ ...edit, servedOn: e.target.value })} /></label>
            <label className="text-xs font-bold text-slate-700 space-y-1">낼 기한 (보정서에 적힌 날짜)<input type="date" className={input} value={edit.dueOn || ''} onChange={e => setEdit({ ...edit, dueOn: e.target.value })} /></label>
          </div>
          <ol className="space-y-3">
            {edit.items.map((it, idx) => {
              const def = it.tableType ? CORRECTION_TABLES[it.tableType] : null;
              return (
                <li key={it.id} className="border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-500">{idx + 1}</span>
                    <input className={input} value={it.title} maxLength={300} onChange={e => setItem(it.id, { title: e.target.value })} placeholder="법원 요청 내용을 옮겨 적어 주세요" aria-label={`${idx + 1}번 요청`} />
                    <label className="inline-flex items-center gap-1 text-xs font-bold min-h-[44px] whitespace-nowrap"><input type="checkbox" checked={it.done} onChange={e => setItem(it.id, { done: e.target.checked })} /> 끝냄</label>
                  </div>
                  <input className={input} value={it.docs} maxLength={300} onChange={e => setItem(it.id, { docs: e.target.value })} placeholder="낼 서류 (예: 보험 해약환급금 증명서)" aria-label="낼 서류" />
                  <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} value={it.note} maxLength={2000} onChange={e => setItem(it.id, { note: e.target.value })} placeholder="메모 (발급처·물어볼 것 등)" aria-label="메모" />
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="min-h-[44px] rounded-xl border border-slate-200 px-2 text-sm bg-white" value={it.tableType || ''} aria-label="표 양식"
                      onChange={e => setItem(it.id, { tableType: (e.target.value || undefined) as TableType | undefined, rows: [] })}>
                      <option value="">표 없음</option>
                      {TABLE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {def && <button type="button" onClick={() => setItem(it.id, { rows: [...it.rows, {}].slice(0, 100) })} className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-xs font-bold">줄 추가</button>}
                    <button type="button" onClick={() => setEdit({ ...edit, items: edit.items.filter(x => x.id !== it.id) })} className="min-h-[44px] px-3 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold">항목 지우기</button>
                  </div>
                  {def && it.rows.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead><tr>{def.columns.map(c => <th key={c.key} className="border border-slate-200 px-1 py-1 text-left">{c.label}</th>)}</tr></thead>
                        <tbody>
                          {it.rows.map((row, ri) => (
                            <tr key={ri}>
                              {def.columns.map(c => (
                                <td key={c.key} className="border border-slate-200 p-0.5">
                                  <input className="w-full min-w-[6rem] min-h-[36px] px-1 text-xs" value={row[c.key] || ''} aria-label={c.label}
                                    inputMode={c.kind === 'money' ? 'numeric' : undefined} type={c.kind === 'date' ? 'date' : 'text'}
                                    onChange={e => setItem(it.id, { rows: it.rows.map((r2, k) => (k === ri ? { ...r2, [c.key]: e.target.value.slice(0, 200) } : r2)) })} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={() => setEdit({ ...edit, items: [...edit.items, newItem()].slice(0, 60) })} className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm font-bold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> 항목 추가</button>
          <p className="text-xs text-slate-500">이 정리는 본인 확인용이에요. 보정서는 법원 요청에 맞춰 직접 쓰거나 법률 전문가와 상의해 작성하세요.</p>
        </div>
      )}
    </DocModal>
  );
}
