import React, { useId, useState } from 'react';
import { REHAB_GLOSSARY } from '../../services/glossary/rehabGlossary';

/**
 * 용어 풀이 (B-5c) — 누르면 바로 아래에 쉬운 설명이 펼쳐진다. 호버 전용이 아니라 휴대폰에서도 쓸 수 있다.
 * 설명은 용어집(services/glossary/rehabGlossary.ts) 한 곳에서만 가져온다.
 */
export function TermHint({ termKey, children }: { termKey: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const t = REHAB_GLOSSARY[termKey];
  if (!t) return <>{children}</>;
  return (
    <span className="inline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(v => !v)}
        className="inline underline decoration-dotted decoration-slate-400 underline-offset-4 font-semibold text-inherit hover:decoration-slate-700 cursor-pointer"
      >
        {children || t.term}
      </button>
      {open && (
        <span id={id} role="note" className="block mt-1.5 mb-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-700 font-normal">
          <span className="font-bold text-slate-900">{t.term}</span>: {t.plain}
        </span>
      )}
    </span>
  );
}

/** 용어집 목록 (펼침) — 리포트 끝 '용어 풀이' */
export function GlossaryList({ keys }: { keys: string[] }) {
  const items = keys.map(k => REHAB_GLOSSARY[k]).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <dl className="divide-y divide-slate-100">
      {items.map(t => (
        <div key={t.term} className="py-2.5">
          <dt className="text-sm font-bold text-slate-900">{t.term}</dt>
          <dd className="text-sm text-slate-700 leading-relaxed mt-0.5">{t.plain}</dd>
        </div>
      ))}
    </dl>
  );
}

export default TermHint;
