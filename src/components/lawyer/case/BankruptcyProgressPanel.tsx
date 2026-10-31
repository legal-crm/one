// 파산 사건 진행 기록 (BK-5): 5단계 '보정·파산선고', 6단계 '면책'
// 선고일·채권자집회·면책 결정일은 위 '서버 사건 기록'의 기록 버튼으로 넣고, 여기서는 파산에만 있는 값을 기록한다.
// 법정 기한은 날짜로만 계산해 보여 주고, 동시폐지·면책 가능성 같은 판단은 하지 않는다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Gavel, RefreshCw, Save } from 'lucide-react';
import { findCaseByWorkspaceKey, type CaseRecord } from '../../../services/cases/caseCoreService';
import {
  bankruptcyDeadlines, loadBankruptcyDetails, saveBankruptcyDetails, type BankruptcyDeadline, type BankruptcyDetails,
} from '../../../services/cases/bankruptcyCaseService';
import { bankruptcyDepositDefault } from '../../../services/court/courtFees';

const input = 'w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm bg-white';
const btn = 'min-h-[40px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';

type Field = { key: keyof Omit<BankruptcyDetails, 'version'>; label: string; type: 'date' | 'text' | 'won' | 'textarea' | 'select'; options?: Array<[string, string]>; help?: string };

const SECTIONS: Record<'declare' | 'discharge', { title: string; fields: Field[] }> = {
  declare: {
    title: '접수·예납·파산선고·관재인',
    fields: [
      { key: 'insolventOn', label: '지급불능 시점', type: 'date', help: '처분재산(1년 전부터)·차용·편파변제 질문 기간의 기준' },
      { key: 'bankruptcyCaseNumber', label: '파산 사건번호 (하단)', type: 'text' },
      { key: 'dischargeCaseNumber', label: '면책 사건번호 (하면)', type: 'text' },
      { key: 'depositOrderedWon', label: '예납명령 금액 (원)', type: 'won' },
      { key: 'depositDueOn', label: '예납 기한', type: 'date' },
      { key: 'depositPaidOn', label: '예납 납부일', type: 'date' },
      { key: 'dismissalType', label: '선고 형태 (법원 결정)', type: 'select', options: [['', '아직 모름'], ['trustee', '관재 사건 (관재인 선임)'], ['simultaneous', '동시폐지']] },
      { key: 'trusteeName', label: '관재인 이름', type: 'text' },
      { key: 'trusteePhone', label: '관재인 연락처', type: 'text' },
      { key: 'trusteeOffice', label: '관재인 사무실 주소', type: 'text' },
      { key: 'trusteeInterviewOn', label: '관재인 면담일', type: 'date' },
      { key: 'trusteeDocsRequested', label: '관재인 요청 자료', type: 'textarea' },
      { key: 'trusteeDocsSubmittedOn', label: '요청 자료 제출일', type: 'date' },
    ],
  },
  discharge: {
    title: '채권자집회 이후·면책',
    fields: [
      { key: 'objectionDeadlineOn', label: '면책 이의신청기간 만료일', type: 'date', help: '법원 결정문의 날짜' },
      { key: 'dischargeHearingOn', label: '면책심문기일', type: 'date' },
      { key: 'dischargeResult', label: '면책 결과 (법원 결정)', type: 'select', options: [['', '아직 없음'], ['granted', '면책 허가'], ['partial', '일부 면책'], ['denied', '면책 불허가']] },
      { key: 'dischargeConfirmedOn', label: '면책 확정일', type: 'date' },
      { key: 'estateClosedOn', label: '파산종결·폐지일', type: 'date' },
      { key: 'memo', label: '사무소 메모 (의뢰인에게 안 보임)', type: 'textarea' },
    ],
  },
};

export default function BankruptcyProgressPanel({
  officeId, caseKey, section, canEdit, courtName, onAddToCalendar,
}: {
  officeId: string;
  caseKey: string;
  section: 'declare' | 'discharge';
  canEdit: boolean;
  courtName?: string;
  onAddToCalendar?: (d: BankruptcyDeadline) => Promise<void>;
}) {
  const [record, setRecord] = useState<CaseRecord | null | undefined>(undefined);
  const [details, setDetails] = useState<BankruptcyDetails | null>(null);
  const [draft, setDraft] = useState<Partial<BankruptcyDetails>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const found = await findCaseByWorkspaceKey(officeId, caseKey);
    if (found.ok === false) { setError(found.message); return; }
    setRecord(found.data);
    if (!found.data) return;
    const d = await loadBankruptcyDetails(found.data.id);
    if (d.ok === false) { setError(d.message); return; }
    setDetails(d.data);
    setDraft({});
  }, [officeId, caseKey]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const h = () => void load();
    window.addEventListener('mykim:case-record-changed', h);
    return () => window.removeEventListener('mykim:case-record-changed', h);
  }, [load]);

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 space-y-2">
        <p>{error}</p>
        <button type="button" onClick={() => void load()} className={`${btn} bg-white border border-rose-200 text-rose-800`}><RefreshCw className="w-3.5 h-3.5" /> 다시 불러오기</button>
      </div>
    );
  }
  if (record === undefined) return <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />;
  if (!record) {
    return <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">서버 사건 기록이 아직 없어요. 위 '서버 사건 기록'에서 기록을 시작하면 파산 진행 기록을 쓸 수 있어요.</p>;
  }
  if (record.caseType !== 'bankruptcy') return null;

  const cur = { ...(details || { version: 0 }), ...draft } as BankruptcyDetails;
  const dirty = Object.keys(draft).length > 0;
  const deposit = bankruptcyDepositDefault(courtName || record.courtName);
  const deadlines = bankruptcyDeadlines({
    declaredOn: record.commencedOn || undefined,
    creditorsMeetingOn: record.creditorsMeetingOn || undefined,
    dischargeDecidedOn: record.dischargeDecidedOn || undefined,
    dischargeResult: cur.dischargeResult,
  }).filter(d => section === 'declare' ? ['docs7', 'exempt14', 'interview', 'early'].includes(d.key) : !['docs7', 'exempt14', 'interview'].includes(d.key));

  const save = async () => {
    setSaving(true);
    const r = await saveBankruptcyDetails(record.id, draft, details?.version || undefined);
    setSaving(false);
    if (r.ok === false) { toast.error(r.message); return; }
    setDetails(r.data);
    setDraft({});
    toast.success('파산 진행 기록을 저장했어요.');
  };

  const sec = SECTIONS[section];
  return (
    <section className="rounded-2xl border border-purple-200 bg-white p-4 space-y-4" aria-label={sec.title}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5"><Gavel className="w-4 h-4 text-purple-600" aria-hidden="true" /> 파산 진행 기록 · {sec.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            선고일 {record.commencedOn || '—'} · 채권자집회 {record.creditorsMeetingOn || '—'} · 면책 결정 {record.dischargeDecidedOn || '—'} (날짜는 위 '서버 사건 기록'의 기록 버튼으로 넣어요)
          </p>
        </div>
        {canEdit && (
          <button type="button" disabled={!dirty || saving} onClick={() => void save()} className={`${btn} bg-purple-600 text-white`}>
            <Save className="w-3.5 h-3.5" /> {saving ? '저장 중…' : '저장'}
          </button>
        )}
      </div>

      {section === 'declare' && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          예납금 기준: {deposit.amountWon ? `${deposit.amountWon.toLocaleString('ko-KR')}원 · ` : ''}{deposit.note}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sec.fields.map(f => {
          const id = `bk-${section}-${f.key}`;
          const v = (cur as any)[f.key];
          const set = (nv: unknown) => setDraft(d => ({ ...d, [f.key]: nv === '' ? undefined : nv }));
          return (
            <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
              <label htmlFor={id} className="text-xs font-bold text-slate-700">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={id} rows={3} disabled={!canEdit} value={v || ''} onChange={e => set(e.target.value.slice(0, 2000))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              ) : f.type === 'select' ? (
                <select id={id} disabled={!canEdit} value={v || ''} onChange={e => set(e.target.value)} className={input}>
                  {(f.options || []).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                </select>
              ) : f.type === 'won' ? (
                <input id={id} disabled={!canEdit} inputMode="numeric" value={v != null ? String(v) : ''} onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); set(n ? Number(n) : ''); }} className={input} />
              ) : (
                <input id={id} disabled={!canEdit} type={f.type === 'date' ? 'date' : 'text'} value={v || ''} onChange={e => set(e.target.value)} className={input} />
              )}
              {f.help && <p className="text-xs text-slate-500">{f.help}</p>}
            </div>
          );
        })}
      </div>

      {deadlines.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-800">법정 기한 (날짜로만 계산, 법원 안내로 다시 확인)</p>
          <ul className="space-y-1">
            {deadlines.map(d => (
              <li key={d.key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{d.date} · {d.label}</p>
                  <p className="text-xs text-slate-500">{d.basis}</p>
                </div>
                {onAddToCalendar && (
                  <button type="button" onClick={() => void onAddToCalendar(d)} className={`${btn} bg-white border border-slate-300 text-slate-700`}>
                    <CalendarPlus className="w-3.5 h-3.5" /> 일정에 넣기
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
