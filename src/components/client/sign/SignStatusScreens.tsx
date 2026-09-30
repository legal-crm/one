import React from 'react';
import {
  AlertCircle, CheckCircle2, Clock, Download, FileQuestion, FileX, Fingerprint, Hourglass, Link2Off, RotateCw, WifiOff,
} from 'lucide-react';
import type { ElectronicContract } from '../../../types';
import { Badge, Button, Skeleton, buttonClassName } from '../ui';
import { SignHeader, SignPage } from './SignLayout';
import { formatDateTimeKo } from './signFormat';

/* ─────────────────────────────────────────────
   원격 전자서명: 불러오는 중 · 오류 유형별 화면 · 서명 후 화면
   ───────────────────────────────────────────── */

export function SignLoadingScreen() {
  return (
    <SignPage header={<SignHeader />}>
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">계약서를 불러오는 중이에요</span>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        {[0, 1].map(i => (
          <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </SignPage>
  );
}

export type SignErrorKind = 'invalid_link' | 'not_found' | 'expired' | 'cancelled' | 'no_documents' | 'offline' | 'load_failed';

const ERROR_COPY: Record<SignErrorKind, { title: string; desc: string; icon: React.ReactNode; retry?: boolean }> = {
  invalid_link: {
    title: '링크 주소가 완전하지 않아요',
    desc: '문자나 카카오톡으로 받은 링크를 다시 눌러 주세요. 주소 일부만 복사하면 열리지 않을 수 있어요.',
    icon: <Link2Off className="h-6 w-6" />,
  },
  not_found: {
    title: '서명 링크를 확인할 수 없어요',
    desc: '새 링크가 발송되었거나 링크가 바뀌었을 수 있어요. 가장 최근에 받은 링크로 다시 열어 보시고, 그래도 안 되면 담당 변호사 사무실에 새 서명 링크를 요청해 주세요.',
    icon: <Link2Off className="h-6 w-6" />,
    retry: true,
  },
  expired: {
    title: '서명 기한이 지났어요',
    desc: '보안을 위해 서명 링크는 정해진 기간에만 열려요. 담당 변호사 사무실에 새 서명 링크를 요청해 주세요.',
    icon: <Clock className="h-6 w-6" />,
  },
  cancelled: {
    title: '취소된 계약이에요',
    desc: '담당 변호사가 이 계약서를 취소해 서명할 수 없어요. 궁금한 점은 담당 변호사 사무실에 문의해 주세요.',
    icon: <FileX className="h-6 w-6" />,
  },
  no_documents: {
    title: '서명할 문서가 없어요',
    desc: '이 계약서에는 서명할 문서가 들어 있지 않아요. 담당 변호사 사무실에 확인을 요청해 주세요.',
    icon: <FileQuestion className="h-6 w-6" />,
  },
  offline: {
    title: '인터넷에 연결되어 있지 않아요',
    desc: '와이파이나 모바일 데이터를 켠 뒤 다시 시도해 주세요.',
    icon: <WifiOff className="h-6 w-6" />,
    retry: true,
  },
  load_failed: {
    title: '계약서를 불러오지 못했어요',
    desc: '잠시 후 다시 시도해 주세요. 계속 열리지 않으면 담당 변호사 사무실에 알려 주세요.',
    icon: <AlertCircle className="h-6 w-6" />,
    retry: true,
  },
};

export function SignErrorScreen({
  kind,
  expiresAt,
  onRetry,
  retrying,
}: {
  kind: SignErrorKind;
  expiresAt?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const c = ERROR_COPY[kind];
  const canRetry = !!c.retry && !!onRetry;
  return (
    <SignPage header={<SignHeader />}>
      <div role="alert" className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600" aria-hidden="true">
          {c.icon}
        </div>
        <h1 className="text-lg font-bold text-slate-900 break-keep">{c.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 break-keep">{c.desc}</p>
        {kind === 'expired' && expiresAt && (
          <p className="mt-3 text-sm font-bold text-slate-700">서명 기한: {formatDateTimeKo(expiresAt)}</p>
        )}
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          {canRetry && (
            <Button onClick={onRetry} loading={retrying} leftIcon={<RotateCw className="h-4 w-4" aria-hidden="true" />}>
              다시 시도
            </Button>
          )}
          <a href="/" className={buttonClassName(canRetry ? 'secondary' : 'primary', 'md')}>
            my김변 홈으로
          </a>
        </div>
      </div>
    </SignPage>
  );
}

/** 서명 후 화면. 변호사 서명 여부(status)와 방금 제출했는지에 따라 문구가 다르다 */
export function SignCompletedScreen({
  contract,
  justSubmitted,
  downloadingPdf,
  onDownloadPdf,
  onOpenVerify,
  headingRef,
}: {
  contract: ElectronicContract;
  justSubmitted: boolean;
  downloadingPdf: boolean;
  onDownloadPdf: () => void;
  onOpenVerify: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const isFullySigned = contract.status === 'completed';
  const signedDoc = contract.documents.find(d => d.included && d.clientSignature);
  const clientSignedAt = signedDoc?.clientSignedAt || contract.signedAt;
  const finalHash = contract.documentHashes?.finalHash;
  const anchor = contract.blockchainAnchor;
  const idv = contract.identityVerification;
  const lawyerLabel = contract.lawyerName ? `${contract.lawyerName} 변호사` : '담당 변호사';

  const title = isFullySigned
    ? justSubmitted ? '계약이 체결되었어요' : '체결이 끝난 계약이에요'
    : justSubmitted ? '서명을 제출했어요' : '이미 서명을 제출한 계약이에요';
  const desc = isFullySigned
    ? `${contract.clientName}님과 ${lawyerLabel}의 서명이 모두 끝나 계약이 체결되었어요.`
    : `${lawyerLabel}가 서명하면 계약이 체결돼요. 이 링크를 다시 열면 진행 상태를 확인할 수 있어요.`;

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: '계약 번호', value: <span className="font-mono">{contract.contractNumber || contract.id}</span> },
    { label: '수임인', value: [contract.lawFirmName, lawyerLabel].filter(Boolean).join(' · ') },
    {
      label: '본인인증',
      value: idv?.name ? `${idv.name}${idv.providerName ? ` · ${idv.providerName}` : ''}` : '기록 없음',
    },
    { label: '서명 제출', value: clientSignedAt ? formatDateTimeKo(clientSignedAt) : '기록 없음' },
    { label: '계약 상태', value: isFullySigned ? '양쪽 서명 완료(체결)' : '변호사 서명 대기' },
  ];

  return (
    <SignPage header={<SignHeader firmName={contract.lawFirmName} />}>
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-xs">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isFullySigned ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-light text-brand'}`}
            aria-hidden="true"
          >
            {isFullySigned ? <CheckCircle2 className="h-8 w-8" /> : <Hourglass className="h-7 w-7" />}
          </div>
          <Badge tone={isFullySigned ? 'success' : 'warning'}>{isFullySigned ? '체결 완료' : '변호사 서명 대기'}</Badge>
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 break-keep outline-none">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 break-keep">{desc}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-labelledby="sign-done-next">
          <h2 id="sign-done-next" className="text-base font-bold text-slate-900">
            다음 순서
          </h2>
          <ol className="mt-3 space-y-2.5 text-sm text-slate-700">
            {isFullySigned ? (
              <>
                <NextItem n={1}>계약서에 적힌 일정과 계좌로 수임료를 납부해 주세요.</NextItem>
                <NextItem n={2}>필요한 서류와 진행 순서는 담당 변호사 사무실의 안내를 따라 주세요.</NextItem>
              </>
            ) : (
              <>
                <NextItem n={1}>{lawyerLabel}가 계약서에 서명해요.</NextItem>
                <NextItem n={2}>양쪽 서명이 끝나면 계약이 체결돼요. 이 링크에서 체결 여부를 확인할 수 있어요.</NextItem>
              </>
            )}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-labelledby="sign-done-info">
          <h2 id="sign-done-info" className="text-base font-bold text-slate-900">
            계약 정보
          </h2>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            {rows.map(r => (
              <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-slate-600">{r.label}</dt>
                <dd className="min-w-0 text-right font-bold text-slate-900 break-keep [overflow-wrap:anywhere]">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 전자지문(SHA-256) — 양쪽 서명 후 실제 값이 있을 때만. 블록체인 표기는 실제 온체인 기록이 있을 때만 */}
        {finalHash && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-labelledby="sign-done-hash">
            <div className="flex items-center justify-between gap-2">
              <h2 id="sign-done-hash" className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <Fingerprint className="h-4 w-4 text-brand" aria-hidden="true" />
                체결본 전자지문
              </h2>
              {anchor?.isRealOnChain && <Badge tone="info">블록체인 기록됨</Badge>}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 break-keep">
              체결 시점의 계약서 내용과 서명으로 만든 고유 값(SHA-256)이에요. 나중에 계약서 내용이 바뀌면 이 값이 달라져 변경 여부를 확인할 수 있어요.
            </p>
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 break-all">{finalHash}</p>
          </section>
        )}

        <div className="space-y-2 pt-1">
          <Button
            fullWidth
            size="lg"
            onClick={onDownloadPdf}
            loading={downloadingPdf}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            {downloadingPdf ? 'PDF 만드는 중' : '계약서 PDF 받기'}
          </Button>
          {!isFullySigned && (
            <p className="text-center text-xs text-slate-600 break-keep">변호사 서명 전 사본이에요. 체결 후 다시 받으면 양쪽 서명이 모두 들어가요.</p>
          )}
          {finalHash && (
            <Button fullWidth variant="secondary" onClick={onOpenVerify} leftIcon={<Fingerprint className="h-4 w-4" aria-hidden="true" />}>
              전자지문으로 원본 확인
            </Button>
          )}
          <a href="/" className={buttonClassName('ghost', 'md', 'w-full')}>
            my김변 홈으로
          </a>
        </div>
      </div>
    </SignPage>
  );
}

function NextItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand" aria-hidden="true">
        {n}
      </span>
      <span className="break-keep leading-relaxed">{children}</span>
    </li>
  );
}
