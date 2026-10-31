import React, { useCallback, useEffect, useState } from 'react';
import { Compass, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../../../supabaseClient';
import { createCase, trashCase, workspaceKeyForCase, notifyOfficeCasesChanged } from '../../../services/cases/caseCoreService';
import { createDefaultCrmExtension, saveCrmClient } from '../../../services/crmService';
import { emptyFinancialProfile } from '../../../hooks/useOfficeWorkspaceCases';
import { useDialog } from '../../common/DialogProvider';

/**
 * 첫 사용 안내·예시 사건 (NF-11)
 * '예시 사건'(가상 인물, 예시 표시, 언제든 삭제) 하나로 사건 화면 → 서류 요청 → 서식 미리보기 → 수납을 10분 안에 둘러본다.
 * 예시 사건은 is_test로 표시돼 의뢰인 화면·통계에 쓰이지 않는다.
 */
const SAMPLE_NAME = '예시 의뢰인(가상)';
const HIDE_KEY = 'mykim_sample_tour_hidden';

export default function SampleCaseTour({ officeId, onOpenLink }: { officeId: string; onOpenLink: (linkType: string, linkId: string | null) => void }) {
  const dialog = useDialog();
  const [sample, setSample] = useState<{ id: string; key: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setSample(null); return; }
    const { data } = await supabase.from('cases').select('id, consult_request_id').eq('office_id', officeId).eq('is_test', true).is('deleted_at', null).limit(1);
    const c = data && data[0];
    setSample(c ? { id: c.id, key: c.consult_request_id || `case-${c.id}` } : null);
  }, [officeId]);
  useEffect(() => { if (!hidden) void load(); }, [load, hidden]);

  if (hidden || sample === undefined) return null;

  const create = async () => {
    setBusy(true);
    const r = await createCase(officeId, { caseType: 'rehab', source: 'direct', displayName: SAMPLE_NAME, realName: SAMPLE_NAME, title: '[예시] 둘러보기용 가상 사건', isTest: true });
    if (r.ok === false) { setBusy(false); toast.error(`예시 사건을 만들지 못했어요: ${r.message}`); return; }
    const key = workspaceKeyForCase(r.data);
    const ext = createDefaultCrmExtension(key);
    ext.crmStatus = 'contracted';
    ext.isExternalClient = true;
    ext.preInfo = '예시 사건이에요. 실제 사람이 아니며, 다 둘러본 뒤 지워 주세요.';
    (ext as any).externalProfile = { ...emptyFinancialProfile(SAMPLE_NAME), dependents: 2, income: 280, debtTotal: 6500, residenceRegion: '경기도', housingType: 'rent', rentCost: 50 };
    await saveCrmClient(key, ext);
    notifyOfficeCasesChanged();
    setBusy(false);
    setSample({ id: r.data.id, key });
    toast.success('예시 사건을 만들었어요. 아래 순서대로 둘러보세요.');
  };

  const remove = async () => {
    if (!sample) return;
    const ok = await dialog.confirm({ title: '예시 사건 지우기', message: '예시 사건을 휴지통으로 옮깁니다.', confirmText: '지우기', variant: 'warning' });
    if (!ok) return;
    const r = await trashCase(sample.id);
    if (r.ok === false) { toast.error(r.message); return; }
    notifyOfficeCasesChanged();
    setSample(null);
    toast.success('예시 사건을 지웠어요.');
  };

  const hide = () => { try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* 화면 설정 */ } setHidden(true); };

  const steps: Array<{ title: string; detail: string; link?: string }> = [
    { title: '사건 화면 열기', detail: '맨 위 사건 카드, 단계 레일, 기록 버튼을 확인해요.', link: 'case_documents' },
    { title: '서류 요청 보내기', detail: '3단계 서류 준비에서 필요한 서류를 골라 의뢰인에게 요청해요.', link: 'case_documents' },
    { title: '서식 미리보기', detail: '4단계에서 신청서·채권자목록을 미리 보고 글자 PDF로 저장해요.', link: 'case_forms' },
    { title: '수임료 일정 만들기', detail: '2단계 수납에서 착수금·분납 회차를 만들어요.', link: 'case_fees' },
    { title: '의뢰인 화면 연결', detail: "실제 사건에서는 사건 기록의 '의뢰인 연결 링크'를 보내면 의뢰인 '내 사건'에 진행이 보여요. 예시 사건은 연결하지 않아요." },
  ];

  return (
    <section aria-labelledby="sample-tour-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="sample-tour-title" className="text-base font-black text-slate-900 flex items-center gap-2"><Compass className="w-5 h-5 text-brand" aria-hidden="true" />10분 둘러보기</h3>
          <p className="text-sm text-slate-600 mt-1">가상 인물로 만든 예시 사건 하나로 주요 화면을 순서대로 볼 수 있어요.</p>
        </div>
        <button type="button" onClick={hide} className="min-h-11 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 whitespace-nowrap">다시 보지 않기</button>
      </div>
      {!sample ? (
        <button type="button" disabled={busy} onClick={() => void create()} className="mt-4 min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] disabled:opacity-60">
          {busy ? '만드는 중…' : '예시 사건 만들기'}
        </button>
      ) : (
        <>
          <ol className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <li key={i}>
                <button type="button" disabled={!s.link} onClick={() => s.link && onOpenLink(s.link, sample.key)}
                  className="w-full min-h-12 px-3 py-2 rounded-xl border border-slate-200 bg-white text-left hover:bg-slate-50 active:scale-[0.99] disabled:cursor-default disabled:hover:bg-white">
                  <span className="text-sm font-bold text-slate-900">{i + 1}. {s.title}</span>
                  <span className="block text-xs text-slate-600 mt-0.5">{s.detail}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => void remove()} className="mt-3 min-h-[40px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5 active:scale-[0.98]">
            <Trash2 className="w-4 h-4" aria-hidden="true" />예시 사건 지우기
          </button>
        </>
      )}
    </section>
  );
}
