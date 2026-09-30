// ============================================================
// 전자계약 원본 검증 모달
// 저장된 계약서 본문·서명으로 SHA-256 전자지문을 브라우저에서 다시 계산해
// 체결(봉인) 당시 값과 비교한다. (기존: 저장된 두 필드끼리만 비교해 항상 '100% 원본'으로 표시)
// 블록체인 기록은 실제 온체인 전송(isRealOnChain)된 경우에만 그렇게 표기한다.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, ExternalLink,
  Copy, Check, Download, Database, FileText, X, RefreshCw, Loader2, Info
} from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract } from '../../types';
import { verifyTxOnChain } from '../../services/blockchainAnchorService';
import { verifyContractIntegrity, type IntegrityCheckStatus } from '../../services/integrityService';
import { generateCourtSubmissionPdf } from '../../services/contractPdfService';
import { maskPersonName, type PublicContractVerification } from '../../services/contractPublicVerifyService';
import ModalPortal from './ModalPortal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 계약서 전체(변호사·관리자·서명 당사자 화면). 공개 검증 화면은 null을 주고 publicView를 쓴다 */
  contract: ElectronicContract | null;
  /**
   * 공개 검증(QR·?verify=) 결과 — 서버가 전자지문을 검증하고 개인정보를 뺀 값.
   * 있으면 브라우저에서 다시 계산하지 않고, 계약서 PDF 내려받기도 보이지 않는다.
   */
  publicView?: PublicContractVerification | null;
  /**
   * 로그인한 변호사·관리자 화면처럼 실명을 봐도 되는 곳에서만 true.
   * 기본값(false)은 링크만 있으면 열리는 공개 검증 화면 — 위임인 이름 일부를 가린다.
   */
  revealFullName?: boolean;
}

/** 검증 결과 상태 + 이 화면에서 검증을 끝내지 못한 경우('error') */
type VerifierStatus = IntegrityCheckStatus | 'error';

const STATUS_COPY: Record<VerifierStatus, { title: string; desc: string; tone: 'ok' | 'bad' | 'info' }> = {
  match: {
    title: '원본 일치',
    desc: '저장된 계약서 본문과 서명으로 전자지문(문서 해시)을 다시 계산한 결과, 체결 당시 기록된 값과 같습니다. 전자지문이 같으면 서명 후 내용이 바뀌지 않았다는 뜻입니다.',
    tone: 'ok',
  },
  mismatch: {
    title: '원본 불일치 — 확인 필요',
    desc: '다시 계산한 전자지문이 체결 당시 값과 다릅니다. 체결 이후 계약서가 변경되었거나 저장본이 손상되었을 수 있습니다. 담당 변호사에게 원본 확인을 요청해 주세요.',
    tone: 'bad',
  },
  unsigned: {
    title: '체결 전',
    desc: '양 당사자 서명이 모두 끝나면 전자지문이 만들어지고 검증할 수 있습니다.',
    tone: 'info',
  },
  unsupported: {
    title: '재계산 검증 미지원',
    desc: '이전 방식으로 봉인된 계약서라 이 화면에서 전자지문을 다시 계산할 수 없습니다. 원본 확인이 필요하면 담당 변호사에게 요청해 주세요.',
    tone: 'info',
  },
  // 계산 중 오류는 '불일치'가 아니다 — 계약서가 바뀌었다고 안내하지 않는다
  error: {
    title: '검증을 완료하지 못했습니다',
    desc: '이 화면에서 전자지문을 다시 계산하지 못했습니다. 계약서가 바뀌었다는 뜻은 아닙니다. 잠시 후 다시 열어 보시거나, 원본 확인이 필요하면 담당 변호사에게 요청해 주세요.',
    tone: 'info',
  },
};

export default function ContractPublicVerifierModal({ isOpen, onClose, contract, publicView = null, revealFullName = false }: Props) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [verifyingNode, setVerifyingNode] = useState(false);
  const [integrity, setIntegrity] = useState<{ status: VerifierStatus; recomputedFinalHash?: string } | null>(null);
  const [liveResult, setLiveResult] = useState<{ verifiedOnChain: boolean; hashMatched?: boolean; statusText: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // 공개 검증: 서버가 계산한 결과를 그대로 쓴다 (본문·서명은 브라우저로 오지 않는다)
    if (publicView) {
      setIntegrity({ status: publicView.integrity });
      setLiveResult(null);
      return;
    }
    if (!contract) return;
    let cancelled = false;
    setIntegrity(null);
    setLiveResult(null);
    verifyContractIntegrity(contract)
      .then(r => { if (!cancelled) setIntegrity(r); })
      .catch(() => { if (!cancelled) setIntegrity({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [isOpen, contract, publicView]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || (!contract && !publicView)) return null;

  // 화면에 보일 값: 공개 검증은 서버 결과(가린 이름), 그 밖은 계약서 원본에서
  const view = publicView
    ? {
        id: publicView.id,
        signedAt: publicView.signedAt,
        finalHash: publicView.finalHash || '',
        anchor: publicView.blockchainAnchor,
        clientDisplayName: publicView.clientNameMasked || '-',
        lawFirmName: publicView.lawFirmName,
        lawyerName: publicView.lawyerName,
        cancelled: publicView.cancelled,
      }
    : {
        id: contract!.id,
        signedAt: contract!.documentHashes?.signedAt || null,
        finalHash: contract!.documentHashes?.finalHash || '',
        anchor: contract!.blockchainAnchor || null,
        // 공개 검증 화면에서는 위임인 실명을 그대로 노출하지 않는다
        clientDisplayName: revealFullName ? (contract!.clientName || '-') : maskPersonName(contract!.clientName),
        lawFirmName: contract!.lawFirmName,
        lawyerName: contract!.lawyerName,
        cancelled: contract!.status === 'cancelled',
      };
  const finalHash = view.finalHash;
  const anchor = view.anchor;
  const onChain = !!anchor?.isRealOnChain && !!anchor?.txHash;
  const copy = integrity ? STATUS_COPY[integrity.status] : null;
  const clientDisplayName = view.clientDisplayName;

  const handleCopyHash = async () => {
    if (!finalHash) return;
    try {
      await navigator.clipboard.writeText(finalHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
      toast.success('전자지문을 복사했습니다.');
    } catch {
      toast.error('복사하지 못했습니다.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!contract || !contract.documents || contract.documents.length === 0) {
      toast.info('이 화면에서는 계약서 원문 PDF를 내려받을 수 없습니다. (사건 당사자와 담당 변호사만 가능)');
      return;
    }
    setDownloadingPdf(true);
    try {
      await generateCourtSubmissionPdf(contract);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleLiveNodeCheck = async () => {
    if (!onChain || !anchor?.txHash) return;
    setVerifyingNode(true);
    try {
      const res = await verifyTxOnChain(anchor.txHash, finalHash);
      setLiveResult({ verifiedOnChain: res.verifiedOnChain, hashMatched: res.hashMatched, statusText: res.statusText });
    } catch {
      toast.error('블록체인 조회 중 네트워크 오류가 발생했습니다.');
    } finally {
      setVerifyingNode(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contract-verifier-title"
          className="bg-white border border-slate-300 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2.5rem)]"
          onClick={e => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
                <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 id="contract-verifier-title" className="text-lg font-black text-white tracking-tight">
                전자계약 원본 검증
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="검증 창 닫기"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            {/* 검증 결과 */}
            <div
              role="status"
              aria-live="polite"
              className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 ${
                !copy ? 'bg-slate-50 border-slate-300 text-slate-800'
                : copy.tone === 'ok' ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                : copy.tone === 'bad' ? 'bg-rose-50 border-rose-400 text-rose-950'
                : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              {!copy ? (
                <Loader2 className="w-6 h-6 text-slate-500 shrink-0 mt-0.5 animate-spin" aria-hidden="true" />
              ) : copy.tone === 'ok' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : copy.tone === 'bad' ? (
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Info className="w-6 h-6 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="flex-1">
                <h4 className="font-black text-sm">{copy ? copy.title : '전자지문을 다시 계산하는 중...'}</h4>
                {copy && <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">{copy.desc}</p>}
              </div>
            </div>

            {/* 취소된 계약 안내 */}
            {view.cancelled && (
              <div role="note" className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs leading-relaxed">
                  <strong className="font-bold">취소된 계약서입니다.</strong> 담당 사무소에서 이 계약을 취소해 서명을 받지 않습니다. 자세한 내용은 담당 변호사에게 확인해 주세요.
                </p>
              </div>
            )}

            {/* 계약 기본 정보 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <h5 className="font-bold text-slate-800 mb-2.5 flex items-center gap-1.5 text-xs">
                <FileText className="w-4 h-4 text-brand" aria-hidden="true" />
                <span>계약 정보</span>
              </h5>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex justify-between border-b border-slate-200/70 pb-1">
                  <dt className="text-slate-600">계약 번호</dt>
                  <dd className="font-mono font-bold text-slate-800">{view.id}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-200/70 pb-1">
                  <dt className="text-slate-600">체결(서명) 시각</dt>
                  <dd className="font-bold text-slate-800">
                    {view.signedAt
                      ? new Date(view.signedAt).toLocaleString('ko-KR')
                      : '서명 전'}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-slate-200/70 pb-1">
                  <dt className="text-slate-600">위임인</dt>
                  <dd className="font-bold text-slate-900">{clientDisplayName}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-200/70 pb-1">
                  <dt className="text-slate-600">수임 변호사</dt>
                  <dd className="font-bold text-slate-900">{view.lawFirmName} {view.lawyerName}</dd>
                </div>
              </dl>
              {!revealFullName && (
                <p className="mt-2 text-[10px] text-slate-500">
                  공개 검증 화면에서는 개인정보 보호를 위해 위임인 이름 일부를 가려서 표시합니다.
                </p>
              )}
            </div>

            {/* 전자지문 */}
            {finalHash && (
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-2">
                <h5 className="font-bold text-white text-xs">체결본 전자지문 (SHA-256)</h5>
                <div className="flex items-start gap-1">
                  <span className="text-emerald-300 font-mono font-bold break-all flex-1 bg-slate-950/60 p-2 rounded border border-slate-800 text-[10px]">
                    {finalHash}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    aria-label="전자지문 복사"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer transition-colors shrink-0"
                  >
                    {copiedHash ? <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  전자지문은 계약서 본문과 양 당사자 서명 이미지로 계산합니다. 같은 내용이면 항상 같은 값이 나오고, 한 글자라도 바뀌면 값이 달라집니다.
                </p>
              </div>
            )}

            {/* 블록체인 기록 — 실제 온체인 전송된 경우에만 */}
            {anchor && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Database className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span>블록체인 기록</span>
                </h5>
                {onChain ? (
                  <>
                    <dl className="space-y-1 text-[11px]">
                      <div className="flex justify-between gap-2"><dt className="text-slate-600">네트워크</dt><dd className="font-bold text-slate-800">{anchor.network}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-slate-600">블록 번호</dt><dd className="font-mono font-bold text-slate-800">#{anchor.blockNumber?.toLocaleString()}</dd></div>
                      <div><dt className="text-slate-600">트랜잭션</dt><dd className="font-mono text-[10px] text-slate-800 break-all">{anchor.txHash}</dd></div>
                    </dl>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {anchor.explorerUrl && (
                        <a
                          href={anchor.explorerUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 min-h-[44px] px-3 text-blue-700 hover:text-blue-900 underline font-bold"
                        >
                          <span>블록 탐색기에서 보기</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleLiveNodeCheck}
                        disabled={verifyingNode}
                        className="inline-flex items-center gap-1 min-h-[44px] px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${verifyingNode ? 'animate-spin' : ''}`} aria-hidden="true" />
                        <span>{verifyingNode ? '조회 중...' : '블록체인에서 직접 조회'}</span>
                      </button>
                    </div>
                    {liveResult && (
                      <p className={`text-[11px] font-bold ${liveResult.verifiedOnChain && liveResult.hashMatched ? 'text-emerald-700' : 'text-amber-800'}`}>
                        {liveResult.verifiedOnChain && liveResult.hashMatched
                          ? '블록체인 트랜잭션에 이 전자지문이 기록되어 있습니다.'
                          : liveResult.verifiedOnChain
                            ? '트랜잭션은 확인되었지만 전자지문 일치 여부는 확인하지 못했습니다.'
                            : '블록체인에서 트랜잭션을 확인하지 못했습니다.'}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    이 계약서의 전자지문은 블록체인에 전송되지 않았고 서버에만 보관되어 있습니다.
                  </p>
                )}
              </div>
            )}

            <p className="p-3 bg-slate-100 rounded-xl text-[10px] text-slate-600 leading-relaxed border border-slate-200">
              이 검증은 저장된 계약서가 체결 당시와 같은지를 확인하는 기술적 확인이며, 계약의 법적 효력이나 분쟁 시 판단을 보증하지 않습니다.
            </p>
          </div>

          {/* 하단 */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 min-h-[44px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer transition-colors"
            >
              닫기
            </button>
            {publicView ? (
              // 공개 검증 화면은 계약서 원문을 받지 않으므로 PDF 버튼 대신 안내만
              <p className="text-[11px] text-slate-600 text-right leading-relaxed">
                계약서 원문 PDF는 사건 당사자와 담당 변호사만 받을 수 있습니다.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="flex items-center gap-1.5 px-4 min-h-[44px] bg-brand hover:bg-brand/90 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>{downloadingPdf ? 'PDF 생성 중...' : '계약서 PDF 다운로드'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
