import React, { useEffect, useState } from 'react';
import { ExternalLink, Send, ShieldCheck } from 'lucide-react';
import { Button, Modal } from './ui';

export interface ConsentRecipient {
  id: string;
  name: string;
  firmName?: string;
}

interface ThirdPartyConsentModalProps {
  open: boolean;
  /** selected: 의뢰인이 고른 변호사에게 요청 · open: 공개 요청(등록·승인된 변호사가 확인 후 제안) */
  scope: 'selected' | 'open';
  recipients: ConsentRecipient[];
  onClose: () => void;
  /** 동의 후 실제 요청을 보낸다. 실패하면 예외를 던져 모달을 열어 둔다 */
  onAgree: () => Promise<void> | void;
}

/**
 * 개인정보 제3자 제공 동의 (변호사에게 상담 정보를 보내는 시점마다)
 * 받는 사람·목적·항목·보관 기간·거부 권리를 요청 직전에 보여 주고, 직접 체크해야 보낼 수 있다.
 * 문구 기준: public/privacy.html 제5조(개인정보의 제3자 제공)
 */
export default function ThirdPartyConsentModal({ open, scope, recipients, onClose, onAgree }: ThirdPartyConsentModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setChecked(false);
      setSubmitting(false);
    }
  }, [open]);

  const handleAgree = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      await onAgree();
    } finally {
      setSubmitting(false);
    }
  };

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: '받는 사람',
      value: scope === 'open' ? (
        <span>마이김변에 등록·승인된 변호사 중 요청을 확인한 변호사</span>
      ) : (
        <ul className="space-y-1">
          {recipients.map(r => (
            <li key={r.id}>
              <strong className="font-bold text-slate-900">{r.name} 변호사</strong>
              {r.firmName && <span className="text-slate-600"> · {r.firmName}</span>}
            </li>
          ))}
        </ul>
      ),
    },
    { label: '목적', value: '법률 상담 검토와 수임 제안(제안서 작성)' },
    { label: '보내는 정보', value: '스텔스 가명, 내 상황 체크 결과(소득·채무·재산·가족 등), 변호사에게 남긴 메모, 1:1 대화 내용' },
    { label: '보내지 않는 정보', value: '실명과 연락처 (수임 계약 때 본인인증을 거쳐서만 사용합니다)' },
    { label: '보관 기간', value: '상담 종료 후 3년 (변호사법 관련 기록 보관)' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      icon={<ShieldCheck className="w-5 h-5" />}
      title={scope === 'open' ? '공개 요청으로 제안을 받을까요?' : '변호사에게 상담 정보를 보낼까요?'}
      description="요청을 보내기 전에 받는 사람과 보내는 정보를 확인해 주세요."
      dismissible={!submitting}
      footer={
        <>
          {/* 동의 체크는 하단 고정 영역에 두어 모바일에서도 스크롤 없이 보이게 한다 */}
          <label className="w-full flex items-start gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-light/60">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-400 text-brand focus:ring-brand cursor-pointer"
              data-autofocus
            />
            <span className="text-sm font-semibold text-slate-900 leading-relaxed break-keep">
              <span className="text-brand">(필수)</span> 위 내용을 확인했고, 변호사에게 상담 정보를 제공하는 데 동의합니다.
            </span>
          </label>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button onClick={handleAgree} disabled={!checked} loading={submitting} leftIcon={<Send className="w-4 h-4" aria-hidden="true" />}>
            동의하고 요청 보내기
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50/60 text-sm">
          {rows.map(row => (
            <div key={row.label} className="grid grid-cols-[5rem_1fr] sm:grid-cols-[6.5rem_1fr] gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3">
              <dt className="font-bold text-slate-600 break-keep">{row.label}</dt>
              <dd className="text-slate-800 leading-relaxed break-keep">{row.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-sm text-slate-600 leading-relaxed break-keep">
          동의하지 않을 수 있습니다. 동의하지 않으면 변호사에게 상담을 요청할 수 없지만, 내 상황 체크 결과는 계속 볼 수 있습니다.{' '}
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-bold text-brand underline underline-offset-2"
          >
            개인정보 처리방침 제5조
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
        </p>
      </div>
    </Modal>
  );
}
