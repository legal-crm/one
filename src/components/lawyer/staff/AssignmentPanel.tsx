// 직원·권한 › 사건 배정 (RB-8, 서버): 구성원별 업무량, 미배정 사건·리드 일괄 배정, 자동 배정 규칙, 업무 넘기기
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, Briefcase, Inbox, RefreshCw, Settings2, Users } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import {
  bulkAssign, loadAssignmentOverview, saveAssignmentRules, transferWork,
  type AssignmentOverview, type AssignmentRules,
} from '../../../services/office/assignmentService';

const ROLE_LABEL: Record<string, string> = { owner: '대표', lawyer: '변호사', manager: '사무장', clerk: '실무자', consultant: '상담 직원', accounting: '회계' };
const btn = 'min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';
const select = 'min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm';

export default function AssignmentPanel({ officeId, canEditRules }: { officeId: string; canEditRules: boolean }) {
  const dialog = useDialog();
  const [data, setData] = useState<AssignmentOverview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickedCases, setPickedCases] = useState<Set<string>>(new Set());
  const [pickedLeads, setPickedLeads] = useState<Set<string>>(new Set());
  const [caseTarget, setCaseTarget] = useState('');
  const [leadTarget, setLeadTarget] = useState('');
  const [rules, setRules] = useState<AssignmentRules | null>(null);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');

  const load = useCallback(async () => {
    const r = await loadAssignmentOverview(officeId);
    if (r.ok === false) { setError(r.message); setData(null); return; }
    setError('');
    setData(r.data);
    setRules(r.data.rules);
    setPickedCases(new Set());
    setPickedLeads(new Set());
  }, [officeId]);
  useEffect(() => { void load(); }, [load]);

  const lawyers = useMemo(() => (data?.members || []).filter(m => m.role === 'owner' || m.role === 'lawyer'), [data]);

  const toggle = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    apply(next);
  };

  const assignCases = async () => {
    if (!caseTarget || pickedCases.size === 0) return;
    setBusy(true);
    const r = await bulkAssign(officeId, 'case_lawyer', [...pickedCases], caseTarget);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`사건 ${r.data}건의 담당 변호사를 정했어요.`);
    void load();
  };
  const assignLeads = async () => {
    if (!leadTarget || pickedLeads.size === 0) return;
    setBusy(true);
    const r = await bulkAssign(officeId, 'lead', [...pickedLeads], leadTarget);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`리드 ${r.data}건의 담당자를 정했어요.`);
    void load();
  };
  const saveRules = async () => {
    if (!rules) return;
    setBusy(true);
    const r = await saveAssignmentRules(officeId, rules);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('자동 배정 규칙을 저장했어요. 앞으로 들어오는 사건·리드부터 적용돼요.');
    void load();
  };
  const transfer = async () => {
    if (!fromId || !toId || fromId === toId) { toast.error('넘겨주는 사람과 넘겨받는 사람을 서로 다르게 골라 주세요.'); return; }
    const reason = await dialog.prompt({ title: '업무 넘기기', message: '넘기는 사유를 적어 주세요. 활동 기록에 남아요. 예: 휴가(11/3~11/7)', placeholder: '사유' });
    if (!reason || !reason.trim()) return;
    setBusy(true);
    const r = await transferWork(officeId, fromId, toId, reason.trim());
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    const toMember = data?.members.find(m => m.memberId === toId);
    const emptied = toMember && toMember.role !== 'owner' && toMember.role !== 'lawyer';
    toast.success(`사건 ${r.data.cases}건 · 리드 ${r.data.leads}건을 넘겼어요.${emptied ? ' 담당 변호사 자리는 변호사만 맡을 수 있어 비워 두었어요. 아래 미배정 사건에서 정해 주세요.' : ''}`);
    setFromId(''); setToId('');
    void load();
  };

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
        <p className="text-sm text-rose-900 flex-1">{error}</p>
        <button type="button" onClick={() => void load()} className={`${btn} bg-white border border-rose-200 text-rose-800`}>다시 불러오기</button>
      </div>
    );
  }
  if (!data || !rules) {
    return <div className="space-y-3" aria-busy="true"><div className="h-28 rounded-2xl bg-slate-100 animate-pulse" /><div className="h-48 rounded-2xl bg-slate-100 animate-pulse" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* 업무량 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5"><Users className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />구성원별 진행 중 업무</h3>
          <button type="button" onClick={() => void load()} aria-label="새로 고침" className={`${btn} border border-slate-200 text-slate-600`}><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 text-left">
                <th className="py-2 pr-3 font-bold">구성원</th>
                <th className="py-2 pr-3 font-bold text-right">담당 변호사 사건</th>
                <th className="py-2 pr-3 font-bold text-right">담당 직원 사건</th>
                <th className="py-2 font-bold text-right">진행 중 리드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.members.map(m => (
                <tr key={m.memberId}>
                  <td className="py-2 pr-3 text-slate-800 font-bold">{m.name} <span className="text-xs font-normal text-slate-500">{ROLE_LABEL[m.role] || m.role}</span></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.casesLawyer}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.casesStaff}</td>
                  <td className="py-2 text-right tabular-nums">{m.leadsOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 미배정 사건 */}
      {data.canCases && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />담당 변호사가 없는 사건 <span className="text-slate-500">{data.unassignedCases.length}건</span></h3>
          {data.unassignedCases.length === 0 ? (
            <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4">모든 진행 중 사건에 담당 변호사가 있어요.</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                {data.unassignedCases.map(c => (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-3 min-h-[44px] cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" className="w-4 h-4" checked={pickedCases.has(c.id)} onChange={() => toggle(pickedCases, c.id, setPickedCases)} />
                      <span className="flex-1 text-sm text-slate-800 truncate">{c.title || '(제목 없음)'}</span>
                      <span className="text-xs text-slate-500">{c.caseType === 'bankruptcy' ? '파산' : '회생'} · {c.stageLabel}</span>
                      <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={`${btn} border border-slate-200 text-slate-600`} onClick={() => setPickedCases(pickedCases.size === data.unassignedCases.length ? new Set() : new Set(data.unassignedCases.map(c => c.id)))}>
                  {pickedCases.size === data.unassignedCases.length ? '모두 풀기' : '모두 고르기'}
                </button>
                <select className={select} value={caseTarget} onChange={e => setCaseTarget(e.target.value)} aria-label="담당 변호사">
                  <option value="">담당 변호사 고르기</option>
                  {lawyers.map(m => <option key={m.memberId} value={m.memberId}>{m.name} (진행 {m.casesLawyer}건)</option>)}
                </select>
                <button type="button" disabled={busy || !caseTarget || pickedCases.size === 0} onClick={() => void assignCases()} className={`${btn} bg-[#1E3A5F] text-white`}>
                  고른 {pickedCases.size}건 배정
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* 미배정 리드 */}
      {data.canLeads && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5"><Inbox className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />담당자가 없는 리드 <span className="text-slate-500">{data.unassignedLeads.length}건</span></h3>
          {data.unassignedLeads.length === 0 ? (
            <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4">담당자가 없는 진행 중 리드가 없어요.</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                {data.unassignedLeads.map(l => (
                  <li key={l.id}>
                    <label className="flex items-center gap-3 px-3 min-h-[44px] cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" className="w-4 h-4" checked={pickedLeads.has(l.id)} onChange={() => toggle(pickedLeads, l.id, setPickedLeads)} />
                      <span className="flex-1 text-sm text-slate-800 truncate">{l.name || '(이름 없음)'}</span>
                      {l.source && <span className="text-xs text-slate-500">{l.source}</span>}
                      <span className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleDateString('ko-KR')}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={`${btn} border border-slate-200 text-slate-600`} onClick={() => setPickedLeads(pickedLeads.size === data.unassignedLeads.length ? new Set() : new Set(data.unassignedLeads.map(l => l.id)))}>
                  {pickedLeads.size === data.unassignedLeads.length ? '모두 풀기' : '모두 고르기'}
                </button>
                <select className={select} value={leadTarget} onChange={e => setLeadTarget(e.target.value)} aria-label="리드 담당자">
                  <option value="">담당자 고르기</option>
                  {data.members.map(m => <option key={m.memberId} value={m.memberId}>{m.name} (리드 {m.leadsOpen}건)</option>)}
                </select>
                <button type="button" disabled={busy || !leadTarget || pickedLeads.size === 0} onClick={() => void assignLeads()} className={`${btn} bg-[#1E3A5F] text-white`}>
                  고른 {pickedLeads.size}건 배정
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* 자동 배정 규칙 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5"><Settings2 className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />자동 배정 규칙</h3>
        <p className="text-xs text-slate-500">담당자 없이 새로 들어온 사건·리드에만 적용돼요. '업무량이 가장 적은 사람'은 진행 중 사건·리드 수가 가장 적은 구성원이에요.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs font-bold text-slate-700 space-y-1">새 사건의 담당 변호사
            <select className={`${select} w-full`} disabled={!canEditRules} value={rules.case_lawyer} onChange={e => setRules({ ...rules, case_lawyer: e.target.value as AssignmentRules['case_lawyer'] })}>
              <option value="none">정하지 않음 (미배정 목록)</option>
              <option value="owner">대표 변호사</option>
              <option value="least_loaded">업무량이 가장 적은 변호사</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700 space-y-1">새 사건의 담당 직원
            <select className={`${select} w-full`} disabled={!canEditRules} value={rules.case_staff} onChange={e => setRules({ ...rules, case_staff: e.target.value as AssignmentRules['case_staff'] })}>
              <option value="none">정하지 않음</option>
              <option value="least_loaded">업무량이 가장 적은 직원</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700 space-y-1">새 리드의 담당자
            <select className={`${select} w-full`} disabled={!canEditRules} value={rules.lead} onChange={e => setRules({ ...rules, lead: e.target.value as AssignmentRules['lead'] })}>
              <option value="least_loaded">업무량이 가장 적은 사람 (기본)</option>
              <option value="none">정하지 않음 (미배정 목록)</option>
            </select>
          </label>
        </div>
        {canEditRules ? (
          <button type="button" disabled={busy} onClick={() => void saveRules()} className={`${btn} bg-[#1E3A5F] text-white`}>규칙 저장</button>
        ) : (
          <p className="text-xs text-slate-500">규칙은 '사무소 설정 바꾸기' 권한이 있는 사람이 바꿀 수 있어요.</p>
        )}
      </section>

      {/* 업무 넘기기 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4 text-[#1E3A5F]" aria-hidden="true" />업무 넘기기 (휴가·업무 조정)</h3>
        <p className="text-xs text-slate-500">한 사람의 진행 중 사건·리드·업무함 조정을 다른 사람에게 한 번에 넘겨요. 퇴사는 '구성원 및 권한'의 퇴사 처리를 쓰세요.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className={select} value={fromId} onChange={e => setFromId(e.target.value)} aria-label="넘겨주는 사람">
            <option value="">넘겨주는 사람</option>
            {data.members.map(m => <option key={m.memberId} value={m.memberId}>{m.name} ({m.casesLawyer + m.casesStaff}건 · 리드 {m.leadsOpen})</option>)}
          </select>
          <span className="text-slate-400" aria-hidden="true">→</span>
          <select className={select} value={toId} onChange={e => setToId(e.target.value)} aria-label="넘겨받는 사람">
            <option value="">넘겨받는 사람</option>
            {data.members.filter(m => m.memberId !== fromId).map(m => <option key={m.memberId} value={m.memberId}>{m.name}</option>)}
          </select>
          <button type="button" disabled={busy || !fromId || !toId} onClick={() => void transfer()} className={`${btn} bg-slate-800 text-white`}>넘기기</button>
        </div>
      </section>
    </div>
  );
}
