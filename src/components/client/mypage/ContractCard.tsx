import { Download, ExternalLink, FileCheck, Shield } from 'lucide-react';
import { generateCourtSubmissionPdf } from '../../../services/contractPdfService';
import { Badge, Button, Card, EmptyState } from '../ui';
import type { MyPageModel } from './useMyPageModel';

/**
 * 내 사건 탭: 전자 수임계약서 카드 (MyPageView에서 분리)
 * - 상태 배지는 글자로(이전: '✅/⏳' 이모지), 체결 전에는 '체결한 계약서' 안내를 보이지 않는다
 * - PDF는 서비스가 진행·완료·실패를 알려 준다(이전: 만들기 전에 '다운로드되었습니다' 토스트를 먼저 띄웠음)
 */
export default function ContractCard({ vm }: { vm: MyPageModel }) {
  const { clientContract } = vm;

  if (!clientContract) {
    return (
      <Card className="border-dashed">
        <EmptyState
          compact
          icon={<FileCheck className="h-6 w-6" />}
          title="체결한 수임계약서가 없어요"
          description="담당 변호사와 상담한 뒤 전자계약서가 오면 이곳에서 계약서를 보고 PDF로 받을 수 있어요."
        />
      </Card>
    );
  }

  const signed = clientContract.status === 'signed';
  const dateLabel = clientContract.signedAt
    ? new Date(clientContract.signedAt).toLocaleDateString('ko-KR')
    : clientContract.createdAt
      ? new Date(clientContract.createdAt).toLocaleDateString('ko-KR')
      : '체결 대기';

  return (
    <Card as="section" aria-labelledby="mypage-contract-title" className="space-y-5">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand" aria-hidden="true">
            <FileCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="mypage-contract-title" className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
              수임 전자계약서
              <Badge tone={signed ? 'success' : 'warning'}>{signed ? '서명 완료' : '서명 진행 중'}</Badge>
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              계약번호 <span className="font-mono">{clientContract.contractNumber || clientContract.id}</span>
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => void generateCourtSubmissionPdf(clientContract)}
          className="self-start sm:self-center"
          leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
        >
          {signed ? '계약서 PDF 받기' : '계약서 사본 PDF 받기'}
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs text-slate-600">수임 사건</dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-900">{clientContract.caseType || clientContract.title || '개인회생 사건'}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs text-slate-600">담당 변호사</dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-900">{clientContract.lawyerName ? `${clientContract.lawyerName} 변호사` : '확인 중'}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <dt className="text-xs text-slate-600">{clientContract.signedAt ? '체결일' : '작성일'}</dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">{dateLabel}</dd>
        </div>
      </dl>

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:flex-row sm:items-center">
        <p className="flex items-start gap-2.5 text-slate-700 break-keep">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          {signed
            ? '전자서명으로 체결한 계약서예요. 체결 시점의 문서 해시(SHA-256)를 기록해 두어 이후 변경 여부를 확인할 수 있어요.'
            : '변호사가 보낸 서명 링크에서 서명을 마치면 계약이 체결돼요. 체결되면 문서 해시(SHA-256)를 기록해 변경 여부를 확인할 수 있어요.'}
        </p>
        {clientContract.contractUrl && (
          <a
            href={clientContract.contractUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 font-bold text-brand hover:underline"
          >
            계약서 전문 보기
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(새 창)</span>
          </a>
        )}
      </div>
    </Card>
  );
}
