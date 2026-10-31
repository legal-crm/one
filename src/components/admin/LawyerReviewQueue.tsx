import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BadgeCheck, RefreshCw } from 'lucide-react';
import {
  LAWYER_REVIEW_STATUS_LABEL, RECHECK_FIELD_LABEL, loadLawyerApplications, markLawyerRechecked, reviewLawyer,
  type LawyerApplication, type LawyerReviewAction, type LawyerReviewStatus,
} from '../../services/admin/adminOpsService';
import { LAWYER_PROFILE_MISSING_LABELS, type LawyerProfileMissing } from '../client/lawyerDirectory';

/**
 * 변호사 심사 대기열 (OP-8, 서버 기준).
 * 승인·보완 요청·반려·정지·복구·등록번호 대조. 사유는 변호사에게 전달되고 조치는 관리자 기록에 남는다.
 */
type QueueFilter = LawyerReviewStatus | 'all' | 'recheck';
const FILTERS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'pending', label: '심사 대기' },
  { key: 'recheck', label: '다시 확인' },
  { key: 'info_requested', label: '보완 요청' },
  { key: 'approved', label: '승인' },
  { key: 'suspended', label: '이용 정지' },
  { key: 'rejected', label: '반려' },
  { key: 'all', label: '전체' },
];

const ACTION_LABEL: Record<LawyerReviewAction, string> = {
  approve: '승인', request_info: '보완 요청', reject: '반려', suspend: '이용 정지', reinstate: '정지 풀기', verify_license: '등록번호 대조 기록',
};
const NEEDS_REASON: LawyerReviewAction[] = ['request_info', 'reject', 'suspend'];

function actionsFor(a: LawyerApplication): LawyerReviewAction[] {
  switch (a.status) {
    case 'pending':
    case 'info_requested':
      return ['approve', 'request_info', 'reject', 'verify_license'];
    case 'rejected':
      return ['approve'];
    case 'approved':
      return ['suspend', 'verify_license'];
    case 'suspended':
      return ['reinstate'];
    default:
      return [];
  }
}

export default function LawyerReviewQueue() {
  const [rows, setRows] = useState<LawyerApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('pending');
  const [pending, setPending] = useState<{ app: LawyerApplication; action: LawyerReviewAction } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await loadLawyerApplications();
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setRows(r.data);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length || 0 };
    (rows || []).forEach(r => { c[r.status] = (c[r.status] || 0) + 1; if (r.recheckNeeded) c.recheck = (c.recheck || 0) + 1; });
    return c;
  }, [rows]);
  const visible = (rows || []).filter(r => filter === 'all' || (filter === 'recheck' ? r.recheckNeeded : r.status === filter));

  // 승인 뒤 바뀐 공개 정보 확인 끝 (LD-5)
  const finishRecheck = async (a: LawyerApplication) => {
    setBusy(true);
    const res = await markLawyerRechecked(a.lawyerId);
    setBusy(false);
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success(`${a.name || a.lawyerId}: 바뀐 정보를 확인했어요.`);
    void load();
  };

  const submit = async () => {
    if (!pending) return;
    if (NEEDS_REASON.includes(pending.action) && !reason.trim()) { toast.error('사유를 적어 주세요. 변호사에게 그대로 전달돼요.'); return; }
    setBusy(true);
    const res = await reviewLawyer(pending.app.lawyerId, pending.action, reason);
    setBusy(false);
    if (res.ok === false) { toast.error(res.message); return; }
    toast.success(`${pending.app.name || pending.app.lawyerId}: ${ACTION_LABEL[pending.action]} 처리했어요${res.data.closedRequests > 0 ? ` · 진행 중 상담 요청 ${res.data.closedRequests}건을 닫고 의뢰인에게 안내했어요` : ''}.`);
    setPending(null);
    setReason('');
    void load();
  };

  return (
    <section className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 space-y-4" aria-labelledby="lawyer-review-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="lawyer-review-title" className="text-base font-extrabold text-white">변호사 심사 (서버 기준)</h2>
        <button type="button" onClick={() => void load()} className="min-h-[44px] px-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98] cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> 새로 고침
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="심사 상태">
        {FILTERS.map(f => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            className={`min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer ${filter === f.key ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-400/40' : 'text-slate-300 border border-[#1E293B]/80 hover:bg-white/5'}`}>
            {f.label} {counts[f.key] ? `(${counts[f.key]})` : ''}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-sm text-rose-200" role="alert">
          <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {error}
        </div>
      ) : rows === null ? (
        <div className="space-y-2" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-400">이 상태의 변호사가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map(a => (
            <li key={a.lawyerId} className="bg-[#0B0F19] border border-[#1E293B]/60 rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-white">{a.name || '(이름 없음)'}</span>
                <span className="text-xs text-slate-400">{a.firmName || '사무소 미입력'} · {a.region || '지역 미입력'}</span>
                <span className="text-xs font-bold text-slate-200 bg-white/10 rounded-lg px-2 py-0.5">{LAWYER_REVIEW_STATUS_LABEL[a.status]}</span>
                {a.licenseCheckedAt && (
                  <span className="text-xs font-bold text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 py-0.5 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" aria-hidden="true" /> 등록번호 대조 {new Date(a.licenseCheckedAt).toLocaleDateString('ko-KR')}
                  </span>
                )}
                {!a.approved && a.waitingBusinessDays != null && (
                  <span className={`text-xs font-bold rounded-lg px-2 py-0.5 ${a.waitingBusinessDays > 2 ? 'text-amber-200 bg-amber-500/15 border border-amber-500/30' : 'text-slate-300 bg-white/5'}`}>
                    대기 {a.waitingBusinessDays}영업일
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 break-all">
                {a.email || '이메일 없음'} · 등록번호 {a.licenseNumber || '미입력'} · 등록증 {a.hasLicenseImage ? '있음' : '없음'} · 사업자번호 {a.businessNumber || '미입력'}
              </p>
              {a.profileMissing.length > 0 && (
                <p className="text-xs text-amber-200">
                  목록 공개 전 남은 항목: {a.profileMissing.map(m => LAWYER_PROFILE_MISSING_LABELS[m as LawyerProfileMissing] || '프로필').join(' · ')}
                </p>
              )}
              {a.recheckNeeded && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  {a.avatar && <img src={a.avatar} alt="" className="w-12 h-12 rounded-full object-cover border border-white/10" />}
                  <p className="flex-1 min-w-0 text-xs text-amber-100">
                    승인 뒤 바뀐 정보: <strong>{a.recheckFields.map(f => RECHECK_FIELD_LABEL[f] || f).join(' · ')}</strong>
                    {a.recheckAt ? ` (${new Date(a.recheckAt).toLocaleDateString('ko-KR')})` : ''}. 본인 실사진·등록 정보와 맞는지 확인해 주세요. 맞지 않으면 보완 요청이나 이용 정지를 하세요.
                  </p>
                  <button type="button" disabled={busy} onClick={() => void finishRecheck(a)}
                    className="min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-60">
                    확인 끝
                  </button>
                </div>
              )}
              {a.reason && <p className="text-xs text-slate-300">전달한 사유: {a.reason}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {actionsFor(a).map(action => (
                  <button key={action} type="button" onClick={() => { setPending({ app: a, action }); setReason(''); }}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer ${
                      action === 'approve' || action === 'reinstate' ? 'bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                      : action === 'suspend' || action === 'reject' ? 'bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
                      : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}>
                    {ACTION_LABEL[action]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
          <div className="bg-[#161B26] border border-[#1E293B] rounded-3xl w-full max-w-md p-6 space-y-4">
            <h3 id="review-dialog-title" className="text-base font-black text-white">{pending.app.name || pending.app.lawyerId} · {ACTION_LABEL[pending.action]}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {pending.action === 'suspend' && '정지하면 로그인 세션이 끊기고, 진행 중인 상담 요청은 닫혀 의뢰인에게 다른 변호사를 고를 수 있다고 안내돼요. '}
              {pending.action === 'verify_license' && '대한변호사협회 공개 정보와 등록번호를 대조한 기록을 남겨요. 메모는 관리자만 봐요. '}
              {NEEDS_REASON.includes(pending.action) ? '사유는 변호사 알림과 화면에 그대로 전달돼요.' : '조치는 관리자 기록에 남아요.'}
            </p>
            {pending.action !== 'approve' && pending.action !== 'reinstate' && (
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-200">{pending.action === 'verify_license' ? '대조 메모 (선택)' : '사유 (필수)'}</span>
                <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 500))} rows={3}
                  className="w-full rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 py-2 text-sm text-white" />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={busy}
                className="min-h-[44px] px-4 rounded-xl text-sm font-bold text-slate-200 border border-[#1E293B] hover:bg-white/5 whitespace-nowrap active:scale-[0.98] cursor-pointer">닫기</button>
              <button type="button" onClick={() => void submit()} disabled={busy}
                className="min-h-[44px] px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-60">
                {busy ? '저장 중…' : ACTION_LABEL[pending.action]}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
