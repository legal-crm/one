import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, ExternalLink } from 'lucide-react';
import { loadClientConsents, type ClientConsents } from '../../services/clientConsentService';
import { Skeleton } from './ui';

const formatDateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * 동의 상태: 계정에 남은 실제 기록만 보여 준다 (기록이 없으면 '기록 없음')
 * - 로그인 필수 동의(약관·개인정보 수집·이용)
 * - 변호사에게 상담 정보 제공(제3자 제공): 상담을 요청할 때마다 받은 동의
 */
export default function ConsentStatusList() {
  const [consents, setConsents] = useState<ClientConsents | null>(null);

  useEffect(() => {
    let alive = true;
    loadClientConsents().then(c => { if (alive) setConsents(c); }).catch(() => { if (alive) setConsents({}); });
    return () => { alive = false; };
  }, []);

  if (!consents) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  const lastThirdParty = consents.thirdParty?.[0];
  const items: Array<{ key: string; title: string; done: boolean; detail: string; href?: string }> = [
    {
      key: 'terms',
      title: '서비스 이용약관',
      done: !!consents.terms,
      detail: consents.terms ? `${formatDateTime(consents.terms.at)} 동의` : '동의 기록이 없습니다. 다음 로그인 때 다시 확인합니다.',
      href: '/tos.html',
    },
    {
      key: 'privacy',
      title: '개인정보 수집·이용',
      done: !!consents.privacy,
      detail: consents.privacy ? `${formatDateTime(consents.privacy.at)} 동의` : '동의 기록이 없습니다. 다음 로그인 때 다시 확인합니다.',
      href: '/privacy.html',
    },
    {
      key: 'third-party',
      title: '변호사에게 상담 정보 제공',
      done: !!lastThirdParty,
      detail: lastThirdParty
        ? `최근 ${formatDateTime(lastThirdParty.at)} · ${lastThirdParty.scope === 'open' ? '공개 요청' : `변호사 ${lastThirdParty.lawyerIds.length}명`}${(consents.thirdParty?.length || 0) > 1 ? ` (총 ${consents.thirdParty!.length}회)` : ''}`
        : '아직 변호사에게 상담 정보를 보내지 않았습니다. 상담을 요청할 때 받는 변호사를 확인하고 동의합니다.',
    },
  ];

  return (
    <ul className="space-y-4">
      {items.map(item => (
        <li key={item.key} className="flex items-start gap-2.5">
          {item.done ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CircleDashed className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="space-y-0.5 text-left min-w-0">
            <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
              {item.title}
              <span className="sr-only">{item.done ? '동의함' : '기록 없음'}</span>
              {item.href && (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-brand"
                >
                  전문 보기
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">(새 창)</span>
                </a>
              )}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed break-keep">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
