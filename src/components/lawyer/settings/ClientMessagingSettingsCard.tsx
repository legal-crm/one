// 설정 › 사무소 설정 › 의뢰인 안내 방법 (KT-2)
// 안내 종류마다 알림톡 / 담당자 카톡 / 둘 다 / 보내지 않음, 담당자 카톡 기한(근무 시간 기준)과 알림톡 자동 대체.
// 기본값(KT-Q1): 상담·서류 요청·진행 안내 = 담당자 카톡, 계약·기일·보정·납부·연체 = 알림톡 + 담당자 카톡
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Save } from 'lucide-react';
import { ALIMTOK_MILESTONE_CONFIG, type AlimtokMilestone } from '../../../types';
import {
  DEFAULT_CLIENT_MESSAGING, DEFAULT_NOTICE_METHODS, NOTICE_METHOD_LABEL, loadClientMessaging, noticeMethodFor, saveClientMessaging,
  type ClientMessagingSettings, type NoticeMethod,
} from '../../../services/comm/clientNoticeService';

const GROUPS: Array<{ title: string; items: AlimtokMilestone[] }> = [
  { title: '상담·서류', items: ['consult_booked', 'document_request', 'doc_request_phase1', 'doc_request_phase2', 'doc_phase2_reminder'] },
  { title: '계약·법원 진행', items: ['contract_signed', 'court_filed', 'injunction_granted', 'correction_order', 'commenced', 'hearing_notice', 'discharged'] },
  { title: '수임료', items: ['fee_upcoming', 'fee_due', 'fee_overdue', 'fee_receipt'] },
];
const METHODS: NoticeMethod[] = ['alimtok', 'staff_kakao', 'both', 'none'];
const HOURS = Array.from({ length: 25 }, (_, i) => i);
const field = 'min-h-10 rounded-xl border border-slate-200 px-2 text-sm text-slate-800 disabled:bg-slate-50';

export default function ClientMessagingSettingsCard({ officeId, canEdit }: { officeId: string; canEdit: boolean }) {
  const [s, setS] = useState<ClientMessagingSettings | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const r = await loadClientMessaging(officeId, true);
    if (!r.ok) { setError(r.message); return; }
    setS(r.data.settings); setVersion(r.data.version);
  }, [officeId]);
  useEffect(() => { void load(); }, [load]);

  if (error) return (
    <div role="alert" className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3">
      <p className="text-sm text-slate-700">{error}</p>
      <button type="button" onClick={() => void load()} className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-1.5"><RefreshCw className="w-4 h-4" aria-hidden="true" /> 다시 불러오기</button>
    </div>
  );
  if (!s) return <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />;

  const setMethod = (m: AlimtokMilestone, v: NoticeMethod) => setS({ ...s, methods: { ...s.methods, [m]: v } });
  const save = async () => {
    if (s.workStart >= s.workEnd) { toast.error('근무 시작 시각이 끝 시각보다 빨라야 해요.'); return; }
    setBusy(true);
    const r = await saveClientMessaging(officeId, s, version || undefined);
    setBusy(false);
    if (!r.ok) { toast.error(r.message); if (/다른 사람이 먼저/.test(r.message)) void load(); return; }
    setVersion(r.data.version);
    toast.success('의뢰인 안내 방법을 저장했어요. 다음 안내부터 적용돼요.');
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5" aria-label="의뢰인 안내 방법">
      <div>
        <h3 className="font-extrabold text-slate-900">의뢰인 안내 방법</h3>
        <p className="text-sm text-slate-600 mt-0.5">
          진행 안내를 알림톡으로 보낼지, 담당자가 카카오톡으로 직접 보낼지 정해요. 담당자 카톡은 자동으로 보내지 않고 사건 화면 '소통 기록'과 오늘의 업무에 할 일로 쌓여요.
          알림톡은 발송 결과가 근거로 남고, 담당자 카톡은 받았는지 확인할 수 없어요. 기한·금액이 걸린 안내는 알림톡을 함께 쓰는 걸 권해요.
        </p>
      </div>

      <fieldset disabled={!canEdit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-200 p-4">
        <label className="sm:col-span-3 flex items-center gap-2 text-sm text-slate-800 min-h-10">
          <input type="checkbox" checked={s.fallbackEnabled} onChange={e => setS({ ...s, fallbackEnabled: e.target.checked })} className="w-4 h-4" />
          담당자 카톡 기한이 지나면 알림톡으로 자동 대체 (알림톡 템플릿 승인 뒤부터 실제로 나가요)
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">처리 기한(근무 시간 기준)
          <select value={s.fallbackHours} onChange={e => setS({ ...s, fallbackHours: Number(e.target.value) })} className={field}>
            {[1, 2, 3, 4, 6, 8, 16, 24].map(h => <option key={h} value={h}>{h}시간</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">근무 시작
          <select value={s.workStart} onChange={e => setS({ ...s, workStart: Number(e.target.value) })} className={field}>
            {HOURS.slice(0, 24).map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">근무 끝
          <select value={s.workEnd} onChange={e => setS({ ...s, workEnd: Number(e.target.value) })} className={field}>
            {HOURS.slice(1).map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
        </label>
        <p className="sm:col-span-3 text-xs text-slate-500">주말·공휴일은 기한에 넣지 않아요. 알림톡 자동 대체는 9시~20시에만 나가요.</p>
      </fieldset>

      {GROUPS.map(g => (
        <div key={g.title}>
          <h4 className="text-sm font-extrabold text-slate-800">{g.title}</h4>
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {g.items.map(m => {
              const cur = noticeMethodFor(s, m);
              return (
                <li key={m} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                  <span className="flex-1 text-sm font-semibold text-slate-800">
                    {ALIMTOK_MILESTONE_CONFIG[m].label}
                    {cur === DEFAULT_NOTICE_METHODS[m] && <span className="ml-2 text-[11px] font-normal text-slate-500">기본값</span>}
                  </span>
                  <select aria-label={`${ALIMTOK_MILESTONE_CONFIG[m].label} 발송 방법`} disabled={!canEdit} value={cur} onChange={e => setMethod(m, e.target.value as NoticeMethod)} className={`${field} sm:w-56`}>
                    {METHODS.map(x => <option key={x} value={x}>{NOTICE_METHOD_LABEL[x]}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-xs text-slate-500">수임료 납부 안내 예약 발송(수임료 수납 탭)은 알림톡으로 나가요. 이 설정은 사건 화면에서 보내는 안내에 쓰여요.</p>

      {canEdit && (
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setS({ ...DEFAULT_CLIENT_MESSAGING, methods: {} })} className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap">기본값으로</button>
          <button type="button" disabled={busy} onClick={() => void save()} className="min-h-[44px] px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98]"><Save className="w-4 h-4" aria-hidden="true" />저장</button>
        </div>
      )}
    </section>
  );
}
