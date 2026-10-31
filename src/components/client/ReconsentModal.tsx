// 새 이용약관·개인정보 처리방침에 다시 동의 받기 (CT-13)
// 관리자가 새 버전을 '다시 동의 받기'로 게시하면, 로그인한 의뢰인에게 한 번 묻는다.
// '나중에'를 누르면 이번 방문 동안은 다시 묻지 않는다(다음 로그인·새로고침 때 다시).
import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './ui';
import { acceptReconsent, loadPendingReconsent, type PendingReconsent } from '../../services/clientConsentService';

let dismissedThisVisit = false;

export default function ReconsentModal({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [docs, setDocs] = useState<PendingReconsent[]>([]);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || dismissedThisVisit) { setDocs([]); return; }
    let alive = true;
    loadPendingReconsent().then(d => { if (alive) setDocs(d); });
    return () => { alive = false; };
  }, [isLoggedIn]);

  const close = () => { dismissedThisVisit = true; setDocs([]); };

  const agree = async () => {
    if (!checked) return;
    setSaving(true);
    const r = await acceptReconsent(docs);
    setSaving(false);
    if (!r.ok) { toast.error(r.message || '동의를 저장하지 못했어요.'); return; }
    toast.success('바뀐 내용에 동의했어요.');
    setDocs([]);
  };

  return (
    <Modal
      open={docs.length > 0}
      onClose={close}
      title="바뀐 약관을 확인해 주세요"
      description="아래 문서가 새로 바뀌었어요. 내용을 확인하고 동의해 주세요."
      icon={<FileText className="w-5 h-5" />}
      size="md"
      footer={(
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
          <button type="button" onClick={close} className="min-h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 whitespace-nowrap active:scale-[0.98]">나중에</button>
          <button type="button" onClick={() => void agree()} disabled={!checked || saving}
            className="min-h-11 px-5 rounded-xl bg-brand text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">
            {saving ? '저장 중…' : '동의하기'}
          </button>
        </div>
      )}
    >
      <ul className="space-y-3">
        {docs.map(d => (
          <li key={`${d.kind}-${d.version}`} className="rounded-xl border border-slate-200 p-3 space-y-1">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              {d.title}
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-brand">
                전문 보기<ExternalLink className="w-3 h-3" aria-hidden="true" /><span className="sr-only">(새 창)</span>
              </a>
            </p>
            <p className="text-xs text-slate-500">{d.effectiveOn} 시행 · 버전 {d.version}</p>
            {d.summary && <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line break-keep">{d.summary}</p>}
          </li>
        ))}
      </ul>
      <label className="mt-4 flex items-start gap-2 cursor-pointer text-sm text-slate-800">
        <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5 w-5 h-5 rounded border-slate-300" />
        <span>바뀐 내용을 확인했고 동의합니다. 동의하지 않으면 '내 정보 › 동의 기록'에서 탈퇴를 요청할 수 있어요.</span>
      </label>
    </Modal>
  );
}
