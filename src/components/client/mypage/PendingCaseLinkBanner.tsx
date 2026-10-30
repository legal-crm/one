// 사무소 사건 연결 링크로 들어온 의뢰인: 로그인 전에는 안내 띠, 로그인하면 한 번 연결하고 '내 사건'으로 보낸다
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Link2, X } from 'lucide-react';
import { acceptClientLinkInvite } from '../../../services/cases/caseCoreService';
import { MY_CASES_CHANGED_EVENT, capturePendingCaseLink, clearPendingCaseLink, peekPendingCaseLink } from '../../../services/cases/pendingCaseLink';

export default function PendingCaseLinkBanner({ isLoggedIn, onLogin, onLinked }: { isLoggedIn: boolean; onLogin: () => void; onLinked: () => void }) {
  const [token, setToken] = useState<string | null>(() => { capturePendingCaseLink(); return peekPendingCaseLink(); });
  const [hidden, setHidden] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !token || busyRef.current) return;
    busyRef.current = true;
    void (async () => {
      const res = await acceptClientLinkInvite(token);
      clearPendingCaseLink();
      setToken(null);
      if (res.ok) {
        toast.success(`${res.data.officeName || '사무소'} 사건 ${res.data.caseCount}건을 내 계정에 연결했어요.`);
        window.dispatchEvent(new Event(MY_CASES_CHANGED_EVENT));
        onLinked();
      } else {
        toast.error(`사건을 연결하지 못했어요: ${res.message} 사무소에 새 연결 링크를 요청해 주세요.`);
      }
      busyRef.current = false;
    })();
  }, [isLoggedIn, token, onLinked]);

  if (!token || isLoggedIn || hidden) return null;
  return (
    <div role="status" className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand/30 bg-brand-light p-4">
        <Link2 className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="flex-1 min-w-[200px] text-sm text-slate-800 break-keep">
          담당 사무소가 보낸 사건 연결 링크로 들어오셨어요. 로그인하면 사건 진행 상황과 서류 제출 화면이 내 계정에 연결돼요.
        </p>
        <button type="button" onClick={onLogin} className="min-h-[44px] rounded-xl bg-brand px-4 text-sm font-bold text-white whitespace-nowrap active:scale-[0.98]">
          로그인하고 연결하기
        </button>
        <button type="button" onClick={() => setHidden(true)} aria-label="안내 닫기" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-white">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
