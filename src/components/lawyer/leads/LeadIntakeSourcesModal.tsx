// 영업 DB '자동 접수 주소' 관리 (SL-2): 접수 키 만들기·복사·폐기, 최근 접수 기록
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Copy, KeyRound, RefreshCw, X } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import {
  INTAKE_RESULT_LABEL,
  buildFormSnippet,
  createIntakeSource,
  leadIntakeEndpoint,
  listIntakeLogs,
  listIntakeSources,
  revokeIntakeSource,
  type IntakeLogRow,
  type LeadIntakeSource,
} from '../../../services/sales/leadIntakeService';

const copy = async (text: string, label: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(`${label}을(를) 복사했습니다.`); }
  catch { toast.error('복사하지 못했습니다. 직접 선택해 복사해 주세요.'); }
};
const dt = (s?: string) => (s ? new Date(s).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

export default function LeadIntakeSourcesModal({ officeId, onClose, onReceived }: { officeId: string; onClose: () => void; onReceived?: () => void }) {
  const dialog = useDialog();
  const [sources, setSources] = useState<LeadIntakeSource[] | null>(null);
  const [logs, setLogs] = useState<IntakeLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [s, l] = await Promise.all([listIntakeSources(officeId), listIntakeLogs(officeId)]);
    if (s.ok === false) { setError(s.message); return; }
    setSources(s.data);
    setLogs(l.ok ? l.data : []);
  }, [officeId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setNameError('');
    if (!name.trim()) { setNameError('접수 경로 이름을 입력해 주세요. 예: 네이버 랜딩, ○○ 대행사'); return; }
    setCreating(true);
    const r = await createIntakeSource(officeId, name.trim());
    setCreating(false);
    if (r.ok === false) { setNameError(r.message); return; }
    setNewKey({ name: name.trim(), key: r.data.key });
    setName('');
    void load();
  };

  const revoke = async (s: LeadIntakeSource) => {
    const ok = await dialog.confirm({ title: '접수 주소 폐기', message: `'${s.name}' 키로는 더 이상 리드가 들어오지 않습니다. 계속할까요?`, confirmText: '폐기', variant: 'danger' });
    if (!ok) return;
    const r = await revokeIntakeSource(s.id);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('접수 키를 폐기했습니다.');
    void load();
  };

  const nameOf = (id?: string) => sources?.find(s => s.id === id)?.name || '-';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="자동 접수 주소" className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2"><KeyRound className="w-5 h-5" />자동 접수 주소</h3>
          <button onClick={onClose} aria-label="닫기" className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            광고 랜딩 페이지·매체·대행사 폼에서 보낸 상담 신청이 이 사무소 영업 DB에 바로 '신규'로 들어옵니다. 같은 번호가 다시 오면 새 리드를 만들지 않고 기존 리드에 '재문의'로 기록합니다.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-800">접수 주소 (POST)</span>
              <button onClick={() => copy(leadIntakeEndpoint(), '접수 주소')} className="inline-flex items-center gap-1 text-xs font-bold text-[#1E3A5F] whitespace-nowrap cursor-pointer"><Copy className="w-3.5 h-3.5" />복사</button>
            </div>
            <code className="block text-xs break-all text-slate-700">{leadIntakeEndpoint()}</code>
            <p className="text-xs text-slate-500">필수: name·phone, 선택: region·caseType(개인회생/개인파산)·debtTotal(만원)·incomeNet(만원)·memo·utm_*. 키는 헤더 X-Lead-Key 또는 key 칸.</p>
          </div>

          {newKey && (
            <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-bold text-amber-900">'{newKey.name}' 접수 키 — 이 창을 닫으면 다시 볼 수 없습니다.</p>
              <code className="block text-xs break-all bg-white border border-amber-200 rounded-xl p-2">{newKey.key}</code>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(newKey.key, '접수 키')} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap cursor-pointer active:scale-[0.98]">키 복사</button>
                <button onClick={() => copy(buildFormSnippet(newKey.key), '폼 예시 코드')} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold whitespace-nowrap cursor-pointer active:scale-[0.98]">랜딩 페이지 폼 예시 복사</button>
              </div>
              <p className="text-xs text-amber-800">폼에는 개인정보 수집·이용 동의를 꼭 받으세요. 키가 새어 나가면 바로 폐기하고 새 키를 만드세요.</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="접수 경로 이름 (예: 네이버 랜딩)" className="flex-1 p-3 rounded-xl border border-slate-200 text-sm" />
              <button onClick={create} disabled={creating} className="px-4 min-h-[44px] rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer active:scale-[0.98]">{creating ? '만드는 중…' : '새 접수 키'}</button>
            </div>
            {nameError && <p className="text-sm text-rose-600" role="alert">{nameError}</p>}
          </div>

          {error && (
            <div role="alert" className="flex items-center justify-between gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
              <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
              <button onClick={() => void load()} className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 font-bold whitespace-nowrap cursor-pointer">다시</button>
            </div>
          )}
          {!error && sources === null && <div className="h-20 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}
          {!error && sources && sources.length === 0 && <p className="text-sm text-slate-500 text-center py-4">만든 접수 키가 없습니다. 위에서 접수 경로 이름을 넣고 새 키를 만드세요.</p>}
          {!error && sources && sources.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {sources.map(s => (
                <li key={s.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 text-sm ${s.active ? '' : 'opacity-60'}`}>
                  <span>
                    <strong className="text-slate-900">{s.name}</strong>
                    <span className="text-xs text-slate-500 ml-2">…{s.keyHint} · 접수 {s.receivedCount}건 · 최근 {dt(s.lastReceivedAt)}{s.active ? '' : ' · 폐기됨'}</span>
                  </span>
                  {s.active && <button onClick={() => revoke(s)} className="text-xs font-bold text-rose-600 hover:underline whitespace-nowrap cursor-pointer">폐기</button>}
                </li>
              ))}
            </ul>
          )}

          {logs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">최근 접수 기록</h4>
                <button onClick={() => { void load(); onReceived?.(); }} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 whitespace-nowrap cursor-pointer"><RefreshCw className="w-3.5 h-3.5" />새로고침</button>
              </div>
              <ul className="text-xs text-slate-600 space-y-1 max-h-48 overflow-y-auto">
                {logs.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2"><span>{dt(l.receivedAt)} · {nameOf(l.sourceId)}</span><span className="font-bold">{INTAKE_RESULT_LABEL[l.result]}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
