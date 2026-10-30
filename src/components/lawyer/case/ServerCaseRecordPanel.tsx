// ============================================================
// 사건 기록 패널 (CM-1·CM-3·CM-9) — 서버 사건(cases)과 타임라인(case_events)
// - 상담 요청마다 우리 사무소 서버 사건을 하나 만들고, 단계는 '기록' 버튼으로만 앞으로 간다.
// - 모든 쓰기는 서버 함수. 실패는 화면에 그대로 보여 준다(조용한 브라우저 대체 없음).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, History, RefreshCw, Scale } from 'lucide-react';
import {
  CLOSE_REASON_LABELS, createCase, findCaseByConsultRequest, listCaseEvents, loadStageDefinitions, recordMilestone, stageDef,
  type CaseEvent, type CaseRecord, type CaseType, type CloseReason, type StageDefinition,
} from '../../../services/cases/caseCoreService';
import { availableMilestones, serverStageToCrmStatus, type MilestoneAction } from '../../../services/cases/caseStageMapping';
import type { CrmStatus } from '../../../types';

interface Props {
  officeId: string;
  consultRequestId: string;
  caseType: CaseType;
  /** 대표 또는 담당 변호사 (종결·다시 열기 버튼) */
  canCloseOrReopen: boolean;
  /** 사건 기록 권한 (없으면 읽기만) */
  canEdit: boolean;
  /** 서버 단계가 바뀌면 기존 화면 상태를 맞춘다 */
  onStageSynced?: (crmStatus: CrmStatus, record: CaseRecord) => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ServerCaseRecordPanel({ officeId, consultRequestId, caseType, canCloseOrReopen, canEdit, onStageSynced }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [stages, setStages] = useState<StageDefinition[]>([]);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<MilestoneAction | null>(null);
  const [form, setForm] = useState({ date: today(), case_number: '', court_name: '', reason: '', close_reason: '' as CloseReason | '' });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [defs, found] = await Promise.all([loadStageDefinitions(), findCaseByConsultRequest(officeId, consultRequestId)]);
    if (defs.ok) setStages(defs.data);
    if (!found.ok) {
      setError(found.message);
      setLoading(false);
      return;
    }
    setRecord(found.data);
    if (found.data) {
      const ev = await listCaseEvents(found.data.id, 50);
      if (ev.ok) setEvents(ev.data); else setError(ev.message);
    } else {
      setEvents([]);
    }
    setLoading(false);
  }, [officeId, consultRequestId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    setBusy(true);
    const res = await createCase(officeId, { caseType, source: 'consult_request', consultRequestId });
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('사건 기록을 시작했어요.');
    await load();
  };

  const openAction = (a: MilestoneAction) => {
    setAction(a);
    setFormError(null);
    setForm({
      date: today(), case_number: record?.caseNumber || '', court_name: record?.courtName || '', reason: '', close_reason: '',
    });
  };

  const submitAction = async () => {
    if (!record || !action) return;
    const payload: Record<string, unknown> = { expected_version: record.version };
    for (const f of action.fields) {
      const v = String(form[f] || '').trim();
      if (f === 'date' && !v && action.kind !== 'closed') { setFormError('날짜를 입력해 주세요.'); return; }
      if ((f === 'case_number' || f === 'court_name') && !v) { setFormError('사건번호와 법원을 모두 입력해 주세요.'); return; }
      if (f === 'reason' && !v) { setFormError('사유를 입력해 주세요.'); return; }
      if (f === 'close_reason' && !v) { setFormError('종결 사유를 골라 주세요.'); return; }
      if (v) payload[f] = v;
    }
    setBusy(true);
    const res = await recordMilestone(record.id, action.kind, payload);
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setAction(null);
    toast.success(`${action.label}을(를) 저장했어요.`);
    onStageSynced?.(serverStageToCrmStatus(res.data.stage, res.data.closeReason), res.data);
    await load();
  };

  const stageInfo = record ? stageDef(stages, record.caseType, record.stage) : undefined;
  const actions = useMemo(() => {
    if (!record) return [];
    return availableMilestones(record.stage, record.caseType).filter(a => !a.lawyerOnly || canCloseOrReopen);
  }, [record, canCloseOrReopen]);

  if (loading) {
    return (
      <section aria-busy="true" className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="h-4 w-32 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-9 w-full rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-16 w-full rounded-xl bg-slate-50 animate-pulse" />
      </section>
    );
  }

  if (error) {
    return (
      <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
        <div className="flex-1 text-sm text-rose-800">
          <p className="font-bold">사건 기록을 불러오지 못했어요.</p>
          <p className="mt-1">{error}</p>
        </div>
        <button type="button" onClick={() => void load()} className="min-h-[44px] px-3 rounded-xl border border-rose-300 bg-white text-sm font-bold text-rose-700 whitespace-nowrap active:scale-[0.98]">
          <RefreshCw className="w-4 h-4 inline mr-1" aria-hidden="true" />다시 시도
        </button>
      </section>
    );
  }

  if (!record) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
        <ClipboardList className="w-7 h-7 mx-auto text-slate-400" aria-hidden="true" />
        <p className="mt-2 text-sm font-bold text-slate-800">아직 사건 기록이 없어요</p>
        <p className="mt-1 text-xs text-slate-600">사건 기록을 시작하면 단계·기일·타임라인이 서버에 남아 다른 기기·직원과 함께 볼 수 있어요.</p>
        {canEdit ? (
          <button type="button" disabled={busy} onClick={handleCreate}
            className="mt-3 min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">
            {busy ? '만드는 중…' : '사건 기록 시작'}
          </button>
        ) : (
          <p className="mt-3 text-xs text-slate-500">사건을 기록할 권한이 없어요. 대표에게 권한을 요청해 주세요.</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <Scale className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />
        <h3 className="text-sm font-black text-slate-900">사건 기록</h3>
        <span className="rounded-lg bg-[#1E3A5F]/10 px-2 py-0.5 text-xs font-bold text-[#1E3A5F]">
          {stageInfo?.officeLabel || record.stage}
        </span>
        {record.caseNumber && (
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{record.courtName} {record.caseNumber}</span>
        )}
        {record.stage === 'closed' && record.closeReason && (
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {CLOSE_REASON_LABELS[record.closeReason]} · {record.closedOn} · 파기 예정 {record.purgeAfter}
          </span>
        )}
      </header>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          ['접수일', record.filedOn],
          [record.caseType === 'bankruptcy' ? '파산선고' : '개시결정', record.commencedOn],
          ['채권자집회', record.creditorsMeetingOn],
          [record.caseType === 'bankruptcy' ? '면책 결정' : '인가결정', record.caseType === 'bankruptcy' ? record.dischargeDecidedOn : record.confirmedOn],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-bold text-slate-800">{v || '—'}</dd>
          </div>
        ))}
      </dl>

      {canEdit && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map(a => (
            <button key={a.kind} type="button" onClick={() => openAction(a)}
              className={`min-h-[44px] px-3 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] ${a.kind === 'closed' ? 'border border-slate-300 bg-white text-slate-700' : 'bg-[#1E3A5F] text-white'}`}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {action && (
        <div className="rounded-2xl border border-[#1E3A5F]/20 bg-[#1E3A5F]/5 p-3 space-y-2">
          <p className="text-sm font-bold text-slate-900">{action.label}</p>
          {action.fields.includes('close_reason') && (
            <label className="block text-xs font-semibold text-slate-700">
              종결 사유
              <select value={form.close_reason} onChange={e => setForm(f => ({ ...f, close_reason: e.target.value as CloseReason }))}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm">
                <option value="">고르세요</option>
                {(Object.keys(CLOSE_REASON_LABELS) as CloseReason[]).map(r => <option key={r} value={r}>{CLOSE_REASON_LABELS[r]}</option>)}
              </select>
            </label>
          )}
          {action.fields.includes('case_number') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                법원
                <input value={form.court_name} onChange={e => setForm(f => ({ ...f, court_name: e.target.value }))} placeholder="예: 서울회생법원"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                사건번호
                <input value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))} placeholder="예: 2026개회○○○○"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm" />
              </label>
            </div>
          )}
          {action.fields.includes('date') && (
            <label className="block text-xs font-semibold text-slate-700">
              {action.kind === 'closed' ? '결정일(기각·폐지·면책이면 필수)' : action.kind === 'case_number_registered' ? '접수일' : '결정일·기일'}
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm" />
            </label>
          )}
          {action.fields.includes('reason') && (
            <label className="block text-xs font-semibold text-slate-700">
              사유
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm" />
            </label>
          )}
          {formError && <p role="alert" className="text-xs font-semibold text-rose-700">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAction(null)} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">취소</button>
            <button type="button" disabled={busy} onClick={submitAction} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )}

      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-black text-slate-700"><History className="w-3.5 h-3.5" aria-hidden="true" />타임라인</h4>
        {events.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">아직 기록이 없어요.</p>
        ) : (
          <ol className="mt-2 space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {events.map(ev => (
              <li key={ev.id} className="flex items-start gap-2 text-xs">
                {ev.kind.startsWith('milestone.')
                  ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  : <CalendarClock className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" aria-hidden="true" />}
                <span className="text-slate-500 whitespace-nowrap">{fmtDateTime(ev.createdAt)}</span>
                <span className="text-slate-800">{ev.summary}</span>
                {ev.clientVisible && <span className="rounded-lg bg-emerald-50 px-1.5 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">의뢰인 공개</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
