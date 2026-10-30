// 수임료 납부 안내 알림톡 자동 발송 설정·기록 (FE-7, FE-Q4)
// 3일 전·당일·다음 날·7일 뒤, 회차당 기한 지난 안내 최대 2번, 오전 9시~오후 8시 사이에만
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DEFAULT_REMINDER_SETTINGS, REMINDER_KIND_LABEL, REMINDER_STATUS_LABEL,
  loadRecentReminders, loadReminderSettings, saveReminderSettings,
  type FeeReminderRow, type FeeReminderSettings,
} from '../../../services/fees/feeService';

const STATUS_CLS: Record<FeeReminderRow['status'], string> = {
  pending: 'text-slate-600', sending: 'text-sky-700', sent: 'text-emerald-700', failed: 'text-rose-700', skipped: 'text-slate-500', cancelled: 'text-slate-500',
};

export default function FeeReminderSettingsCard({ officeId, canEdit, caseNames }: { officeId: string; canEdit: boolean; caseNames: Record<string, string> }) {
  const [saved, setSaved] = useState<FeeReminderSettings | null>(null);
  const [form, setForm] = useState<FeeReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [rows, setRows] = useState<FeeReminderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([loadReminderSettings(officeId), loadRecentReminders(officeId, undefined, 50)]);
    if (s.ok === false) { setError(s.message); return; }
    setError(null);
    setSaved(s.data);
    setForm(s.data);
    setRows(r.ok ? r.data : []);
  }, [officeId]);

  useEffect(() => { void load(); }, [load]);

  const dirty = saved && JSON.stringify(saved) !== JSON.stringify(form);
  const save = async () => {
    setSaving(true);
    const r = await saveReminderSettings(officeId, form);
    setSaving(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(form.enabled ? '자동 안내를 켰습니다. 다음 날부터 정해진 날짜에 보냅니다.' : '자동 안내를 껐습니다. 오늘 보낼 예정이던 안내도 취소했습니다.');
    void load();
  };

  const notApproved = rows.some(r => r.status === 'failed' && /템플릿/.test(r.error || ''));
  const check = (key: keyof FeeReminderSettings, label: string) => (
    <label className="flex items-center gap-2 text-sm text-slate-800">
      <input type="checkbox" checked={!!form[key]} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="h-4 w-4" />
      {label}
    </label>
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" aria-label="납부 안내 자동 발송">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><BellRing className="w-5 h-5 text-slate-700" />납부 안내 알림톡 자동 발송</h3>
        {saved && <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${saved.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{saved.enabled ? '켜짐' : '꺼짐'}</span>}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!saved && !error && <div className="h-16 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}
      {saved && (
        <>
          <p className="text-xs text-slate-600 break-keep">
            서버 수납 일정에서 남은 금액이 있는 회차만 안내합니다. 의뢰인 휴대폰 번호가 있는 사건만 보내고, 납부를 기록하면 그 회차 안내는 멈춥니다. 기한이 지난 회차는 다음 날·7일 뒤 두 번까지만 안내합니다.
          </p>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <input type="checkbox" checked={form.enabled} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="h-4 w-4" />
            자동 안내 사용
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {check('sendDMinus3', '3일 전')}
            {check('sendDue', '당일')}
            {check('sendDPlus1', '다음 날')}
            {check('sendDPlus7', '7일 뒤')}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            보낼 시각
            <select value={form.sendHour} disabled={!canEdit} onChange={e => setForm(f => ({ ...f, sendHour: Number(e.target.value) }))} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
              {Array.from({ length: 11 }, (_, i) => 9 + i).map(h => <option key={h} value={h}>{h}시 무렵</option>)}
            </select>
          </label>
          {canEdit && (
            <button type="button" onClick={save} disabled={!dirty || saving} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-40 active:scale-[0.98]">
              {saving ? '저장 중…' : '설정 저장'}
            </button>
          )}
          {!canEdit && <p className="text-xs text-slate-500">설정은 수납 기록 권한(전체)이 있는 사람만 바꿀 수 있습니다.</p>}
          {notApproved && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 break-keep">
              카카오 검수 승인된 알림톡 템플릿이 아직 없어 실제로는 보내지 않았습니다. 마이김변이 템플릿 승인을 마치면 자동으로 보내기 시작합니다.
            </p>
          )}
          <button type="button" onClick={() => setShowLog(v => !v)} aria-expanded={showLog} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900">
            최근 안내 기록 {rows.length}건 {showLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showLog && (
            rows.length === 0
              ? <p className="text-xs text-slate-500">아직 안내 기록이 없습니다.</p>
              : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  {rows.map(r => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                      <span className="text-slate-800">{r.sendOn} · {caseNames[r.caseId] || '사건'} · {REMINDER_KIND_LABEL[r.kind]}{typeof r.amountWon === 'number' ? ` · ${r.amountWon.toLocaleString('ko-KR')}원` : ''}</span>
                      <span className={`text-xs font-bold ${STATUS_CLS[r.status]}`}>{REMINDER_STATUS_LABEL[r.status]}{r.error ? ` · ${r.error}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )
          )}
        </>
      )}
    </section>
  );
}
