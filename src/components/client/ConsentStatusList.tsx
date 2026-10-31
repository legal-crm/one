import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, ExternalLink, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadMyConsents, withdrawConsent, WITHDRAW_EFFECT_TEXT, type ConsentRow,
} from '../../services/clientConsentService';
import { useDialog } from '../common/DialogProvider';
import { Skeleton } from './ui';

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const SEAT_LABEL: Record<string, string> = {
  requested: '답변 기다리는 중', reviewing: '검토 중', proposed: '제안서 받음', chosen: '이 변호사와 진행',
  declined: '변호사가 맡기 어렵다고 함', expired: '응답 기한 지남', withdrawn: '내가 취소함', released: '다른 변호사와 진행',
};

/**
 * 내 동의 기록 (서버 user_consents). 로그인 필수 동의와, 상담을 요청할 때마다 변호사별로 받은 정보 제공 동의.
 * 정보 제공 동의는 여기서 철회할 수 있다 (계약 전이면 그 변호사 요청이 취소된다).
 */
export default function ConsentStatusList() {
  const dialog = useDialog();
  const [rows, setRows] = useState<ConsentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await loadMyConsents();
    if (r.ok === false) { setError(r.message); setRows([]); return; }
    setError(null);
    setRows(r.rows);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const withdraw = async (row: ConsentRow) => {
    const isAccount = row.kind !== 'third_party';
    const ok = await dialog.confirm({
      title: isAccount ? '동의를 철회할까요?' : `${row.lawyerName || '이 변호사'}에게 준 정보 제공 동의를 철회할까요?`,
      message: isAccount
        ? '이용약관·개인정보 수집·이용 동의를 철회하면 서비스를 계속 쓸 수 없어 탈퇴로 처리해요. 개인정보 요청으로 접수되고 10일 안에 처리해요.'
        : '계약 전이라면 그 변호사에게 보낸 상담 요청이 취소되고, 변호사는 더 이상 내 정리 자료를 볼 수 없어요. 이미 계약한 변호사는 계약에 따라 필요한 정보를 계속 다뤄요.',
      confirmText: '철회하기',
      cancelText: '그대로 두기',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(row.id);
    const r = await withdrawConsent(row.id);
    setBusyId(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(r.effect ? WITHDRAW_EFFECT_TEXT[r.effect] : '철회했어요.');
    void load();
  };

  if (!rows) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  const latestOf = (kind: 'terms' | 'privacy') => rows.find(r => r.kind === kind && !r.withdrawnAt);
  const accountItems = [
    { kind: 'terms' as const, title: '서비스 이용약관', href: '/tos.html' },
    { kind: 'privacy' as const, title: '개인정보 수집·이용', href: '/privacy.html#signup-consent' },
  ];
  const thirdParty = rows.filter(r => r.kind === 'third_party');

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">{error}</p>}
      <ul className="space-y-4">
        {accountItems.map(item => {
          const row = latestOf(item.kind);
          return (
            <li key={item.kind} className="flex items-start gap-2.5">
              {row ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                : <CircleDashed className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />}
              <div className="space-y-0.5 text-left min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                  {item.title}
                  <a href={row?.url || item.href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-brand">
                    전문 보기<ExternalLink className="w-3 h-3" aria-hidden="true" /><span className="sr-only">(새 창)</span>
                  </a>
                </p>
                <p className="text-xs text-slate-600 leading-relaxed break-keep">
                  {row ? `${formatDateTime(row.grantedAt)} 동의 · 버전 ${row.version}` : '동의 기록이 없습니다. 다음 로그인 때 다시 확인합니다.'}
                </p>
              </div>
              {row && (
                <button type="button" disabled={busyId === row.id} onClick={() => void withdraw(row)}
                  className="shrink-0 min-h-11 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap active:scale-[0.98] disabled:opacity-50">
                  철회(탈퇴)
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <p className="text-sm font-bold text-slate-800">변호사에게 상담 정보 제공</p>
        {thirdParty.length === 0 ? (
          <p className="text-xs text-slate-600 break-keep">아직 변호사에게 상담 정보를 보내지 않았습니다. 상담을 요청할 때 받는 변호사를 확인하고 동의합니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {thirdParty.map(r => (
              <li key={r.id} className="flex items-start gap-3 p-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-bold text-slate-800">{r.lawyerName || '변호사'}</p>
                  <p className="text-xs text-slate-600">
                    {formatDateTime(r.grantedAt)} 동의
                    {r.seatStatus ? ` · ${SEAT_LABEL[r.seatStatus] || r.seatStatus}` : ''}
                  </p>
                  {r.withdrawnAt && (
                    <p className="text-xs text-slate-500">{formatDateTime(r.withdrawnAt)} 철회 · {r.withdrawEffect ? WITHDRAW_EFFECT_TEXT[r.withdrawEffect] : ''}</p>
                  )}
                </div>
                {!r.withdrawnAt && (
                  <button type="button" disabled={busyId === r.id} onClick={() => void withdraw(r)}
                    className="shrink-0 inline-flex items-center gap-1 min-h-11 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap active:scale-[0.98] disabled:opacity-50">
                    <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />철회
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
