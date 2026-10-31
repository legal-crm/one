// 영업 DB '경로/환경 설정' (SL-12, 15 기획서 5-7) — 서버 sales_settings
// 유입 경로 · 부재 재시도·통화 가능 시간 · 부재 문자 · 수신 거부 목록
// (삭제: 1차 상태 자유 목록, 거래처 수당 규칙(A-6), 부재 알림 단계, 텔레그램 방 — 거래처는 '거래처(광고대행사)' 창에서)
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, X } from 'lucide-react';
import ModalPortal from '../../common/ModalPortal';
import {
  addSuppression, countSuppression, getSalesSettings, isSuppressed, removeSuppression, saveSalesSettings, type SalesSettings,
} from '../../../services/sales/salesSettingsService';
import { findProhibitedExpressions } from '../../../services/proposalCompliance';

type Tab = 'inbound' | 'retry' | 'sms' | 'suppression';
const btn = 'min-h-[40px] px-4 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50';

export default function SalesSettingsModal({ isOpen, onClose, title = '영업 DB 설정', canManage = true }: { isOpen: boolean; onClose: () => void; title?: string; canManage?: boolean }) {
  const [tab, setTab] = useState<Tab>('inbound');
  const [draft, setDraft] = useState<SalesSettings>(() => getSalesSettings());
  const [newPath, setNewPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [supCount, setSupCount] = useState<number | null>(null);
  const [supPhone, setSupPhone] = useState('');
  const [supResult, setSupResult] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setDraft(getSalesSettings());
    void countSuppression().then(setSupCount);
  }, [isOpen]);
  if (!isOpen) return null;

  const save = async (next: SalesSettings, msg = '저장했어요.') => {
    setBusy(true);
    const r = await saveSalesSettings(next);
    setBusy(false);
    if (r.ok === false) { toast.error(`저장하지 못했어요: ${r.message}`); setDraft(getSalesSettings()); return; }
    setDraft(r.data);
    toast.success(msg);
  };

  const smsWarnings = findProhibitedExpressions(draft.noAnswerSms);
  const rules = draft.rules;
  const setRules = (patch: Partial<SalesSettings['rules']>) => setDraft(d => ({ ...d, rules: { ...d.rules, ...patch } }));

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-labelledby="sales-settings-title" className="w-full max-w-2xl rounded-3xl bg-white shadow-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 id="sales-settings-title" className="text-base font-black text-slate-900">{title}</h3>
            <button type="button" onClick={onClose} aria-label="닫기" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-1.5 px-6 pt-3 overflow-x-auto" role="tablist">
            {([['inbound', '유입 경로'], ['retry', '부재 재시도·통화 시간'], ['sms', '부재 문자'], ['suppression', '수신 거부']] as Array<[Tab, string]>).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[40px] px-3.5 rounded-xl text-sm font-bold whitespace-nowrap ${tab === k ? 'bg-[#1E3A5F] text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>{l}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm text-slate-700">
            {!canManage && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">설정은 '영업 DB 관리' 권한이 있는 구성원만 바꿀 수 있어요.</p>}
            {tab === 'inbound' && (
              <>
                <p className="text-xs text-slate-600">리드를 어디서 받았는지 고르는 목록이에요. 유입 경로마다 개인정보 수집 근거(광고 폼 동의 문구 등)를 갖춰 두세요. 다른 업체에서 산 DB는 수집 근거를 확인해야 해요. [운영자 판단]</p>
                <div className="flex gap-2">
                  <input value={newPath} maxLength={40} disabled={!canManage} onChange={e => setNewPath(e.target.value)} placeholder="예: 네이버 블로그 상담 폼" className="flex-1 min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm" />
                  <button type="button" disabled={!canManage || busy || !newPath.trim() || draft.inboundPaths.includes(newPath.trim())} onClick={() => { const next = { ...draft, inboundPaths: [...draft.inboundPaths, newPath.trim()] }; setNewPath(''); void save(next, '유입 경로를 더했어요.'); }} className={`${btn} bg-[#1E3A5F] text-white`}><Plus className="w-4 h-4 inline" /> 더하기</button>
                </div>
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {draft.inboundPaths.map(p => (
                    <li key={p} className="flex items-center justify-between px-4 py-2.5">
                      <span>{p}</span>
                      {canManage && <button type="button" aria-label={`${p} 빼기`} onClick={() => void save({ ...draft, inboundPaths: draft.inboundPaths.filter(x => x !== p) }, '목록에서 뺐어요. 이미 들어온 리드의 유입 경로는 그대로예요.')} className="p-2 rounded-lg text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {tab === 'retry' && (
              <fieldset disabled={!canManage} className="space-y-3">
                <p className="text-xs text-slate-600">기본: 1차 부재 → 같은 날 3시간 뒤, 2차 → 다음 날 반대 시간대, 3차 → 2일 뒤, 4차 → 4일 뒤, 5차 부재면 '연락 불가'로 자동 종료해요.</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-700">통화 시작 시각
                    <input type="number" min={6} max={12} value={rules.callStartHour} onChange={e => setRules({ callStartHour: Math.min(12, Math.max(6, Number(e.target.value) || 9)) })} className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">통화 끝 시각
                    <input type="number" min={15} max={21} value={rules.callEndHour} onChange={e => setRules({ callEndHour: Math.min(21, Math.max(15, Number(e.target.value) || 20)) })} className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">1차 부재 뒤 다시 걸기 (시간)
                    <input type="number" min={1} max={8} value={rules.retrySteps[0]?.value ?? 3} onChange={e => setRules({ retrySteps: [{ kind: 'hours', value: Math.min(8, Math.max(1, Number(e.target.value) || 3)) }, ...rules.retrySteps.slice(1)] })} className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">몇 번째 부재에 종료할까요
                    <input type="number" min={2} max={10} value={rules.maxNoAnswer} onChange={e => setRules({ maxNoAnswer: Math.min(10, Math.max(2, Number(e.target.value) || 5)) })} className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">부재 문자 제안 (몇 번째 부재 뒤, 0 = 안 함)
                    <input type="number" min={0} max={5} value={rules.suggestSmsAfter} onChange={e => setRules({ suggestSmsAfter: Math.min(5, Math.max(0, Number(e.target.value) || 0)) })} className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3" />
                  </label>
                </div>
                <div className="flex justify-end"><button type="button" disabled={busy} onClick={() => void save(draft)} className={`${btn} bg-[#1E3A5F] text-white`}>{busy ? '저장 중…' : '저장'}</button></div>
              </fieldset>
            )}
            {tab === 'sms' && (
              <fieldset disabled={!canManage} className="space-y-2">
                <p className="text-xs text-slate-600">부재가 이어질 때 한 번 보낼 문자예요. {'{사무소}'}는 사무소 이름으로 바뀌어요. '무료상담'·'진단'·'전담' 같은 표현은 쓰지 마세요.</p>
                <textarea rows={4} maxLength={300} value={draft.noAnswerSms} onChange={e => setDraft(d => ({ ...d, noAnswerSms: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                {smsWarnings.length > 0 && <p role="alert" className="text-xs font-semibold text-amber-800">확인할 표현: {smsWarnings.join(', ')}</p>}
                <div className="flex justify-end"><button type="button" disabled={busy || !draft.noAnswerSms.trim()} onClick={() => void save(draft)} className={`${btn} bg-[#1E3A5F] text-white`}>저장</button></div>
              </fieldset>
            )}
            {tab === 'suppression' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">'수신 거부'로 종료한 번호는 번호 대신 지문(되돌릴 수 없는 값)만 남아요. 리드를 지워도 남고, 접수 주소로 다시 들어오면 받지 않아요. 지금 {supCount === null ? '…' : `${supCount}개`}.</p>
                <div className="flex flex-wrap gap-2">
                  <input value={supPhone} onChange={e => { setSupPhone(e.target.value); setSupResult(''); }} inputMode="tel" placeholder="010-0000-0000" className="flex-1 min-w-[160px] min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm" />
                  <button type="button" disabled={!supPhone.trim()} onClick={() => void isSuppressed(supPhone).then(v => setSupResult(v ? '수신 거부 목록에 있는 번호예요.' : '목록에 없는 번호예요.'))} className={`${btn} border border-slate-300 bg-white text-slate-700`}>확인</button>
                  {canManage && <button type="button" disabled={!supPhone.trim()} onClick={() => void addSuppression(supPhone).then(r => { if (r.ok === false) toast.error(r.message); else { toast.success('수신 거부 목록에 넣었어요.'); setSupPhone(''); void countSuppression().then(setSupCount); } })} className={`${btn} bg-slate-900 text-white`}>넣기</button>}
                  {canManage && <button type="button" disabled={!supPhone.trim()} onClick={() => void removeSuppression(supPhone).then(r => { if (r.ok === false) toast.error(r.message); else { toast.success(r.data ? '목록에서 뺐어요. 다시 받으려면 본인 동의를 새로 받아 주세요.' : '목록에 없는 번호예요.'); void countSuppression().then(setSupCount); } })} className={`${btn} border border-rose-300 bg-white text-rose-700`}>빼기</button>}
                </div>
                {supResult && <p className="text-xs font-semibold text-slate-700">{supResult}</p>}
              </div>
            )}
          </div>
          <div className="flex justify-end px-6 py-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className={`${btn} border border-slate-300 bg-white text-slate-700`}>닫기</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
