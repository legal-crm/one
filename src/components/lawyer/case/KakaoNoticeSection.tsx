// 사건 화면 '소통 기록' 안: 의뢰인 카톡 이름 + 담당자 카톡으로 보낼 안내 (KT-1·KT-2)
// 카톡은 자동으로 보내지 않는다. 담당자가 복사해 보내고 '보냈어요'를 누르면 소통 기록에 남는다.
// 기한(근무 시간 기준)이 지나면 사무소 설정에 따라 알림톡으로 자동 대체된다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Copy, MessageCircle, Send, X } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import { confirmClientCopy } from '../../../services/proposalCompliance';
import {
  cancelNoticeTask, completeNoticeTask, listNoticeTasks, loadCaseKakaoName, saveCaseKakaoName, type NoticeTask,
} from '../../../services/comm/clientNoticeService';

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const DONE_LABEL: Record<NoticeTask['status'], string> = {
  pending: '보낼 차례', sent: '담당자 카톡으로 보냄', fallback_sending: '알림톡으로 대신 보내는 중', fallback_sent: '기한이 지나 알림톡으로 보냄',
  fallback_failed: '알림톡 대체 실패', cancelled: '보내지 않음',
};

interface Props {
  officeId: string;
  workspaceKey: string;
  onChanged?: () => void;
}

export default function KakaoNoticeSection({ officeId, workspaceKey, onChanged }: Props) {
  const dialog = useDialog();
  const [tasks, setTasks] = useState<NoticeTask[] | null>(null);
  const [error, setError] = useState('');
  const [kakaoName, setKakaoName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const [t, n] = await Promise.all([listNoticeTasks(officeId, workspaceKey, true), loadCaseKakaoName(officeId, workspaceKey)]);
    if (!t.ok) { setError(t.message); setTasks([]); return; }
    setError('');
    setTasks(t.data);
    if (n.ok) { setKakaoName(n.data); setNameDraft(n.data); }
  }, [officeId, workspaceKey]);

  useEffect(() => { void load(); }, [load]);

  const saveName = async () => {
    const res = await saveCaseKakaoName(officeId, workspaceKey, nameDraft);
    if (!res.ok) { toast.error(res.message); return; }
    setKakaoName(res.data.name);
    if (res.data.sameNameCases > 0) toast.warning(`같은 카톡 이름이 다른 사건 ${res.data.sameNameCases}건에도 있어요. PC 묶음 발송 목록에서는 빠져요(잘못 보내기 방지).`);
    else toast.success(res.data.name ? '의뢰인 카톡 이름을 저장했어요.' : '카톡 이름을 지웠어요.');
  };

  const textOf = (t: NoticeTask) => drafts[t.id] ?? t.body;

  const copy = async (t: NoticeTask) => {
    const text = textOf(t).trim();
    const ok = await confirmClientCopy(text, 'kakao', (o) => dialog.prompt(o), (m) => toast.error(m));
    if (!ok) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`복사했어요. ${kakaoName ? `'${kakaoName}'` : '의뢰인'} 카톡 대화방에 붙여 넣어 보낸 뒤 '보냈어요'를 눌러 주세요.`);
    } catch {
      toast.error('복사하지 못했어요. 내용을 직접 선택해 복사해 주세요.');
    }
  };

  const markSent = async (t: NoticeTask) => {
    const ok = await dialog.confirm({
      title: '카톡으로 보냈나요?',
      message: `${kakaoName ? `'${kakaoName}' 대화방에 ` : ''}이 안내를 실제로 보낸 뒤 눌러 주세요. 보낸 내용이 소통 기록에 남고, 알림톡 자동 대체는 취소돼요.`,
      confirmText: '보냈어요',
    });
    if (!ok) return;
    setBusyId(t.id);
    const res = await completeNoticeTask(t.id, textOf(t) !== t.body ? textOf(t) : undefined);
    setBusyId(null);
    if (!res.ok) { toast.error(res.message); void load(); return; }
    toast.success('보낸 기록을 남겼어요.');
    void load();
    onChanged?.();
  };

  const cancel = async (t: NoticeTask) => {
    const reason = await dialog.prompt({ title: '이 안내 보내지 않기', message: '사유는 활동 기록에 남아요. 알림톡 자동 대체도 하지 않아요.', placeholder: '예: 전화로 직접 안내함' });
    if (!reason || !reason.trim()) return;
    setBusyId(t.id);
    const res = await cancelNoticeTask(t.id, reason.trim());
    setBusyId(null);
    if (!res.ok) { toast.error(res.message); return; }
    void load();
    onChanged?.();
  };

  if (tasks === null) return <div className="h-16 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />;

  const open = tasks.filter(t => t.status === 'pending' || t.status === 'fallback_failed' || t.status === 'fallback_sending');
  const done = tasks.filter(t => !open.includes(t));

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[180px] text-xs font-bold text-slate-700 space-y-1">
          의뢰인 카톡 이름 <span className="font-normal text-slate-500">(카카오톡에서 보이는 이름, 잘못 보내기 방지)</span>
          <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} maxLength={40} placeholder="예: 홍길동" className="block w-full min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal" />
        </label>
        <button type="button" onClick={() => void saveName()} disabled={nameDraft.trim() === kakaoName} className="min-h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-[0.98] whitespace-nowrap">이름 저장</button>
      </div>

      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800"><MessageCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />담당자 카톡으로 보낼 안내 {open.length > 0 && <span className="rounded-lg bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">{open.length}건</span>}</h4>
        {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
        {open.length === 0 && !error && (
          <p className="mt-1 text-xs text-slate-500">보낼 안내가 없어요. 사무소 설정 › 의뢰인 안내 방법에서 '담당자 카톡'으로 정한 안내가 생기면 여기에 쌓여요.</p>
        )}
        <ul className="mt-2 space-y-2">
          {open.map(t => (
            <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-900">{t.title}</span>
                {t.status === 'fallback_failed' ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 font-bold"><AlertTriangle className="w-3 h-3" aria-hidden="true" />알림톡 대체 실패{t.fallbackError ? ` · ${t.fallbackError}` : ''}</span>
                ) : t.status === 'fallback_sending' ? (
                  <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-slate-700 font-bold">알림톡으로 대신 보내는 중</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 text-amber-900 px-1.5 py-0.5 font-bold"><Clock className="w-3 h-3" aria-hidden="true" />기한 {fmt(t.dueAt)}{t.fallback ? ' · 지나면 알림톡으로 대체' : ''}</span>
                )}
              </div>
              <textarea
                value={textOf(t)}
                onChange={e => setDrafts(d => ({ ...d, [t.id]: e.target.value }))}
                rows={4} maxLength={2000} aria-label="보낼 내용"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={busyId === t.id || t.status === 'fallback_sending'} onClick={() => void cancel(t)} className="min-h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 active:scale-[0.98] whitespace-nowrap"><X className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />보내지 않기</button>
                <button type="button" onClick={() => void copy(t)} className="min-h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap"><Copy className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />복사</button>
                <button type="button" disabled={busyId === t.id || t.status === 'fallback_sending'} onClick={() => void markSent(t)} className="min-h-10 px-3.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover disabled:opacity-50 active:scale-[0.98] whitespace-nowrap"><Send className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />보냈어요</button>
              </div>
            </li>
          ))}
        </ul>
        {done.length > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setShowDone(s => !s)} className="text-xs font-bold text-slate-600 hover:underline">{showDone ? '처리한 안내 접기' : `처리한 안내 ${done.length}건 보기`}</button>
            {showDone && (
              <ul className="mt-1.5 space-y-1">
                {done.map(t => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span className="font-semibold text-slate-800">{t.title}</span>
                    <span>{DONE_LABEL[t.status]}{t.sentVia === 'kakao_pc_batch' ? '(PC 묶음)' : ''}</span>
                    <span className="text-slate-500">{fmt(t.sentAt || t.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
