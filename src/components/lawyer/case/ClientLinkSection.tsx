// 사건 화면: 의뢰인 계정 연결 (직접 등록·이관 사건은 이 링크로 의뢰인이 '내 사건'을 보고 서류를 낸다)
// 링크는 한 번만 쓰이고 기본 7일 뒤 만료된다. 새로 만들면 이전 링크는 무효가 된다 (create_client_link_invite)
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Link2, UserCheck } from 'lucide-react';
import { createClientLinkInvite, listOfficeClients } from '../../../services/cases/caseCoreService';

export default function ClientLinkSection({ officeId, officeClientId, canEdit }: { officeId: string; officeClientId: string; canEdit: boolean }) {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await listOfficeClients(officeId, [officeClientId]);
    setLinked(r.ok ? !!r.data[0]?.clientUserId : null);
  }, [officeId, officeClientId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true);
    const r = await createClientLinkInvite(officeClientId, 168);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    setInvite({ url: r.data.url, expiresAt: r.data.expiresAt });
    try {
      await navigator.clipboard.writeText(r.data.url);
      toast.success('연결 링크를 복사했어요. 의뢰인에게 문자나 카카오톡으로 보내 주세요.');
    } catch {
      toast.success('연결 링크를 만들었어요. 아래 주소를 복사해 보내 주세요.');
    }
  };

  const copy = async () => {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite.url); toast.success('복사했어요.'); } catch { toast.error('복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.'); }
  };

  if (linked === null) return null;
  if (linked) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700">
        <UserCheck className="w-4 h-4" aria-hidden="true" />의뢰인 계정 연결됨 — 의뢰인이 '내 사건'에서 진행 상황·수임료·서류 요청을 봐요.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Link2 className="w-4 h-4 text-slate-600" aria-hidden="true" />의뢰인 계정 연결 전</span>
        {canEdit && (
          <button type="button" onClick={create} disabled={busy} className="min-h-[40px] px-3 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">
            {busy ? '만드는 중…' : invite ? '링크 새로 만들기' : '연결 링크 만들기'}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-600 break-keep">
        링크를 보내면 의뢰인이 마이김변에 로그인해 이 사건을 '내 사건'에 연결해요. 연결되면 진행 단계·수임료 일정·서류 요청을 보고 서류를 낼 수 있어요.
      </p>
      {invite && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input readOnly value={invite.url} aria-label="연결 링크" onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 p-2 rounded-xl border border-slate-200 bg-white text-xs font-mono" />
            <button type="button" onClick={copy} aria-label="연결 링크 복사" className="p-2 min-h-[40px] rounded-xl border border-slate-300 bg-white"><Copy className="w-4 h-4" aria-hidden="true" /></button>
          </div>
          <p className="text-[11px] text-slate-500">한 번만 쓸 수 있고 {new Date(invite.expiresAt).toLocaleString('ko-KR')}까지 유효해요. 새로 만들면 이전 링크는 쓸 수 없어요. 링크를 받은 사람이 연결되니 의뢰인 본인에게만 보내 주세요.</p>
        </div>
      )}
    </div>
  );
}
