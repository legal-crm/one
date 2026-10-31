import React, { useEffect, useState } from 'react';
import { FileText, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../../../supabaseClient';
import { savePdfBytesToCase } from '../../../services/court/casePdfSave';
import type { DischargeForm } from '../../../services/court/dischargeApplication';

const DischargeWriterModal = React.lazy(() => import('../../client/discharge/DischargeWriterModal'));

interface DischargeEvent { kind: 'request' | 'self_download'; created_at: string }

/**
 * 사건 6단계 '면책' — 면책신청서 만들기(H-0, 변호사 기획서 12번) + 의뢰인 요청·직접 내려받음 기록
 *  * 같은 작성기(법원 양식 HWPX + 글자 PDF)를 사무소 모드로 연다. PDF는 사건 서류함에 저장, 서명 칸은 비워 둔다
 *  * 주민등록번호는 출력할 때만 입력하고 저장하지 않는다 (L8)
 */
export default function OfficeDischargePanel({ officeId, caseKey, prefill, actorName }: {
  officeId?: string;
  caseKey: string;
  prefill: Partial<DischargeForm>;
  actorName?: string;
}) {
  const [events, setEvents] = useState<DischargeEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !officeId || !caseKey) return;
    supabase.from('client_discharge_events').select('kind, created_at').eq('office_id', officeId).eq('case_key', caseKey)
      .order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setEvents((data as DischargeEvent[]) || []));
  }, [officeId, caseKey]);

  const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm text-slate-900">면책신청서</h3>
          <p className="text-xs text-slate-600">법원 양식(개인회생 면책신청서)에 사건번호·인적사항·환급계좌를 채워 PDF·HWPX로 만들어요.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!officeId}
          className="min-h-11 px-4 rounded-xl bg-brand text-white text-sm font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-[0.98] disabled:opacity-50"
        >
          <FileText className="w-4 h-4" aria-hidden="true" /> 면책신청서 만들기
        </button>
      </div>
      {events.length > 0 && (
        <ul className="space-y-1">
          {events.map(e => (
            <li key={e.created_at + e.kind} className="flex items-center gap-2 text-xs text-slate-700">
              <Bell className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              <span>{fmt(e.created_at)} · {e.kind === 'request' ? '의뢰인이 면책신청 접수를 요청함' : '의뢰인이 면책신청서를 직접 내려받음 (이중 접수 확인 필요)'}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <React.Suspense fallback={null}>
          <DischargeWriterModal
            open
            mode="office"
            isLoggedIn
            onClose={() => setOpen(false)}
            prefill={prefill}
            onSavePdf={async (bytes, fileName) => {
              if (!officeId) return false;
              const r = await savePdfBytesToCase({ bytes, officeId, caseKey, fileName, actorName, note: '면책신청서' });
              if (r.ok === false) { toast.error(r.message); return false; }
              window.dispatchEvent(new CustomEvent('mykim:case-files-changed', { detail: { caseKey } }));
              return true;
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
}
