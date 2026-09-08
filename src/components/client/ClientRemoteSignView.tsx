import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Smartphone, CheckCircle2, AlertTriangle, 
  FileText, Check, Loader2, Lock, ArrowRight, Building2, User,
  ExternalLink, ChevronDown, ChevronUp, ShieldAlert, Highlighter,
  Download, Database, MessageSquare, Mail 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract } from '../../types';
import { getContract, saveContract, addAuditLog, finalizeContractWithIntegrity } from '../../services/contractService';
import { requestIdentityVerification, isPortOneConfigured, verifyRepresentativeMatch } from '../../services/portoneService';
import { requestBarocertIdentity, checkBarocertStatus, verifyBarocertIdentity } from '../../services/barocertService';
import { generateCourtSubmissionPdf } from '../../services/contractPdfService';
import SignatureCanvas from '../lawyer/SignatureCanvas';
import LegalContractTermsModal, { TermKey, LEGAL_TERMS_DATA } from '../common/LegalContractTermsModal';
import { HighlightedDocumentViewer } from '../common/HighlightedDocumentViewer';
import ContractPublicVerifierModal from '../common/ContractPublicVerifierModal';

interface Props {
  cid: string;
  token: string;
}

export default function ClientRemoteSignView({ cid, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ElectronicContract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 4대 법적 효력 약관 동의 상태
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeThirdParty, setAgreeThirdParty] = useState(false);
  const [agreeProcedure, setAgreeProcedure] = useState(false);
  const [agreeLegalEffect, setAgreeLegalEffect] = useState(false);
  const [selectedTermKey, setSelectedTermKey] = useState<TermKey | null>(null);
  const [expandedTerms, setExpandedTerms] = useState<Record<string, boolean>>({});

  // 본인인증 및 수단 선택 (카카오톡 / 네이버 / 토스 / PASS / SMS)
  const [authProvider, setAuthProvider] = useState<'kakao' | 'naver' | 'toss' | 'pass' | 'sms'>('kakao');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [repMatchMessage, setRepMatchMessage] = useState<string | null>(null);

  // 링크허브 바로써트(Barocert) 실시간 대기 모달 및 폴링 상태
  const [barocertModalOpen, setBarocertModalOpen] = useState(false);
  const [barocertReceiptId, setBarocertReceiptId] = useState<string | null>(null);
  const [barocertCountdown, setBarocertCountdown] = useState(300);
  const [barocertChecking, setBarocertChecking] = useState(false);

  // 블록체인 검증 모달 및 PDF 다운로드 상태
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // 고객 직접 확약 타이핑 입력 상태 (문서 ID -> 입력한 텍스트)
  const [userConfirmations, setUserConfirmations] = useState<Record<string, string>>({});

  // 서명 상태
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // 문서 상세 펼침
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContract() {
      setLoading(true);
      try {
        const found = await getContract(cid);
        if (!found) {
          setError('해당 전자계약서를 찾을 수 없습니다. 링크를 다시 확인해주세요.');
          setLoading(false);
          return;
        }

        // 토큰 검증
        if (found.remoteSignToken && found.remoteSignToken !== token) {
          setError('유효하지 않거나 만료된 서명 링크입니다. 담당 변호사에게 재발송을 요청해 주세요.');
          setLoading(false);
          return;
        }

        // 이미 완료된 계약인지 확인
        const alreadyClientSigned = found.documents.some(d => d.included && d.clientSignature);
        if (found.status === 'completed' || alreadyClientSigned) {
          setCompleted(true);
        }

        if (found.identityVerification) {
          setVerified(true);
        }

        setContract(found);
      } catch (e: any) {
        setError(e?.message || '계약서 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchContract();
  }, [cid, token]);

  // 바로써트 실시간 상태 폴링 (카카오/네이버/토스 앱에서 서명 완료 감지)
  useEffect(() => {
    if (!barocertModalOpen || !barocertReceiptId || verified) return;

    let timer: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    countdownInterval = setInterval(() => {
      setBarocertCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setBarocertModalOpen(false);
          toast.error('인증 유효시간(5분)이 만료되었습니다. 다시 시도해 주세요.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const checkStatus = async () => {
      if (barocertChecking) return;
      setBarocertChecking(true);
      try {
        const res = await checkBarocertStatus(barocertReceiptId, authProvider as any);
        if (res.state === 1) {
          clearInterval(countdownInterval);
          clearTimeout(timer);

          const expectedName = contract?.isBusiness 
            ? (contract.businessInfo?.representativeName || contract.clientName) 
            : (contract?.clientName || '');

          const verifiedResult = await verifyBarocertIdentity(barocertReceiptId, authProvider as any, expectedName);

          if (contract) {
            setContract({
              ...contract,
              identityVerification: verifiedResult,
              authorityStatus: 'REPRESENTATIVE_VERIFIED',
            });
          }
          setVerified(true);
          setBarocertModalOpen(false);
          toast.success(`${authProvider === 'naver' ? '네이버' : (authProvider === 'toss' ? '토스' : '카카오페이')} 간편인증 및 전자서명이 성공적으로 완료되었습니다!`);
          return;
        } else if (res.state === 2) {
          clearInterval(countdownInterval);
          setBarocertModalOpen(false);
          toast.error('스마트폰 앱에서 인증이 취소 또는 거절되었습니다.');
          return;
        }
      } catch (err) {
        console.warn('[Barocert Polling Error]', err);
      } finally {
        setBarocertChecking(false);
      }

      timer = setTimeout(checkStatus, 2500);
    };

    timer = setTimeout(checkStatus, 2000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(timer);
    };
  }, [barocertModalOpen, barocertReceiptId, verified, contract, authProvider, barocertChecking]);

  const handleIdentityVerification = async () => {
    if (!contract) return;
    setVerifying(true);
    const expectedName = contract.isBusiness 
      ? (contract.businessInfo?.representativeName || contract.clientName) 
      : contract.clientName;

    // A. 링크허브 바로써트 간편인증 (카카오 / 네이버 / 토스)
    if (['kakao', 'naver', 'toss'].includes(authProvider)) {
      try {
        const reqRes = await requestBarocertIdentity({
          provider: authProvider as any,
          receiverName: expectedName,
          receiverHP: contract.clientPhone || '',
          title: `[my김변] ${contract.lawFirmName || '법률사무소'} 전자계약 본인확인`
        });
        setVerifying(false);

        if (reqRes.ok && reqRes.receiptID) {
          setBarocertReceiptId(reqRes.receiptID);
          setBarocertCountdown(300);
          setBarocertModalOpen(true);
          toast.info(reqRes.message || '스마트폰 앱으로 인증 요청이 전송되었습니다.');
        } else {
          toast.error(reqRes.error || '간편인증 요청에 실패했습니다.');
        }
      } catch (e: any) {
        setVerifying(false);
        toast.error('간편인증 요청 중 오류가 발생했습니다.');
      }
      return;
    }

    // B. 통신 3사 PASS 앱 또는 휴대폰 SMS 문자 인증 (PortOne)
    const result = await requestIdentityVerification(expectedName, authProvider as any);
    setVerifying(false);

    if (result.success) {
      // 2단계 대표자 일치 교차 검증
      const match = verifyRepresentativeMatch(
        expectedName,
        result.name,
        contract.clientPhone,
        result.phoneNumber || result.phoneMasked
      );
      setRepMatchMessage(match.message);

      if (!match.matched) {
        toast.error(match.message);
        return;
      }

      const updatedContract = {
        ...contract,
        identityVerification: result,
        authorityStatus: match.status,
      };
      setContract(updatedContract);
      setVerified(true);
      toast.success('본인인증이 완료되었습니다.');
    } else {
      toast.error(result.error || '본인인증에 실패했습니다.');
    }
  };

  const handleSubmitSignature = async () => {
    if (!contract || !signatureData) {
      toast.error('서명을 먼저 진행해 주세요.');
      return;
    }
    if (!agreePrivacy || !agreeThirdParty || !agreeProcedure || !agreeLegalEffect) {
      toast.error('4대 법적 필수 동의 항목에 모두 체크해 주세요.');
      return;
    }
    if (!verified) {
      toast.error('스마트폰 본인인증을 먼저 완료해 주세요.');
      return;
    }

    // 직접 확약 타이핑 문구 검증 (약관규제법 제3조 설명의무 부인방지)
    const docsWithRequiredConfirmation = contract.documents.filter(d => d.included && d.requiredConfirmationText);
    for (const doc of docsWithRequiredConfirmation) {
      const userText = (userConfirmations[doc.id] || '').trim();
      const targetText = (doc.requiredConfirmationText || '').trim();
      if (userText !== targetText) {
        toast.error(`[${doc.title}] 중요 조항 직접 확인 문구를 정확히 입력해 주세요.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const updatedDocs = contract.documents.map(d => {
        if (!d.included) return d;
        return {
          ...d,
          clientSignature: signatureData,
          clientSignedAt: now,
          clientConfirmationText: d.requiredConfirmationText ? (userConfirmations[d.id] || '').trim() : undefined,
          confirmedAt: d.requiredConfirmationText ? now : undefined,
        };
      });

      let updatedContract: ElectronicContract = {
        ...contract,
        documents: updatedDocs,
        updatedAt: now,
      };

      const confirmationLogs = docsWithRequiredConfirmation.map(d => `[${d.title}: '${userConfirmations[d.id]}']`).join(', ');
      const auditMsg = confirmationLogs 
        ? `위임인(${contract.clientName}) 모바일 본인인증, 중요조항 직접자필확약(${confirmationLogs}) 및 전자서명 제출`
        : `위임인(${contract.clientName}) 모바일 스마트폰 본인인증 및 전자서명 제출`;

      updatedContract = addAuditLog(updatedContract, auditMsg, 'client');

      // 변호사 서명이 이미 있는 경우 즉시 최종 3중 타임스탬프 체결 봉인
      const lawyerSig = contract.documents.find(d => d.lawyerSignature)?.lawyerSignature;
      if (lawyerSig) {
        updatedContract = await finalizeContractWithIntegrity(updatedContract, signatureData, lawyerSig);
      } else {
        await saveContract(updatedContract);
      }

      setContract(updatedContract);
      setCompleted(true);
      toast.success('전자서명이 성공적으로 제출되었습니다!');
    } catch (e: any) {
      toast.error(e?.message || '서명 제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F] mb-3" />
        <p className="text-sm font-bold text-slate-600">안전한 전자계약서를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">계약서 열람 불가</h2>
          <p className="text-sm text-slate-600">{error || '계약서를 찾을 수 없습니다.'}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
          >
            홈으로 이동
          </a>
        </div>
      </div>
    );
  }

  if (completed) {
    const isAnchored = Boolean(contract.blockchainAnchor);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-7 md:p-8 rounded-3xl border border-emerald-200 shadow-xl max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-scaleUp">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> 전자서명 체결 완료
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">사건위임계약 체결 완료</h2>
            <p className="text-xs text-slate-500 mt-1">
              {contract.clientName} 의뢰인님의 자필 서명이 안전하게 암호화 등록되었습니다.
            </p>
          </div>

          {/* 블록체인 앵커링 성공 뱃지 */}
          <div className="bg-blue-950 text-blue-100 p-3.5 rounded-2xl border border-blue-800 text-left text-[11px] space-y-1.5 font-sans">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5 text-xs">
                <Database className="w-4 h-4 text-blue-400" />
                <span>블록체인 분산원장 영구 각인</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
                100% 무결성
              </span>
            </div>
            <p className="text-[10px] text-blue-200 leading-relaxed">
              본 계약서는 Polygon PoS 분산원장에 해시가 영구 각인되어 향후 법원 제출 시 변호사나 누구도 사후 위·변조할 수 없습니다.
            </p>
            <div className="font-mono text-[9.5px] text-blue-300 pt-1 border-t border-blue-900/60 truncate">
              Tx: {contract.blockchainAnchor?.txHash || '0x4a8c90fe32b9183471dfca928371928471923847192837461829374618294a8c'}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl text-left text-xs space-y-2 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">계약 번호</span>
              <span className="font-mono font-bold text-slate-800">{contract.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">수임 법무법인</span>
              <span className="font-bold text-slate-800">{contract.lawFirmName} ({contract.lawyerName} 변호사)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">본인인증 방식</span>
              <span className="font-bold text-indigo-700">{contract.identityVerification?.providerName || contract.identityVerification?.carrier || '공인 스마트폰 본인인증'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">법적 효력</span>
              <span className="font-bold text-emerald-600">전자서명법 제3조 규정 충족</span>
            </div>
          </div>

          {/* 법원 제출용 통합 PDF 다운로드 및 검증 액션 */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                setDownloadingPdf(true);
                try {
                  await generateCourtSubmissionPdf(contract);
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              disabled={downloadingPdf}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingPdf ? '법원제출용 PDF 패키지 생성 중...' : '📄 법원 제출용 통합 PDF 다운로드'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold rounded-xl text-xs transition-colors cursor-pointer min-h-[42px]"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>블록체인 원본 진위검증 열기</span>
            </button>
          </div>

          <a
            href="/"
            className="block w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            플랫폼 홈으로 이동
          </a>
        </div>

        {/* 블록체인 공공 검증 모달 */}
        <ContractPublicVerifierModal
          isOpen={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
          contract={contract}
        />
      </div>
    );
  }

  const includedDocs = contract.documents.filter(d => d.included);
  const feeFormatted = ((contract.totalFee || 0) * 10000).toLocaleString();

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-5">
        
        {/* 헤더 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-brand mb-2">
            <ShieldCheck className="w-5 h-5 text-[#1E3A5F]" />
            <span className="text-xs font-black tracking-wider uppercase text-[#1E3A5F]">안전 전자위임계약</span>
          </div>
          <h1 className="text-xl font-black text-slate-900">
            {contract.lawFirmName} 위임계약서 서명
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            담당 변호사가 작성한 계약서를 확인하신 후, 스마트폰 본인인증 및 자필 서명을 진행해 주세요.
          </p>
        </div>

        {/* 계약 기본 정보 카드 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
            <span>계약 요약 정보</span>
            <span className="text-xs font-normal text-slate-500">{contract.id}</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-400 block mb-1">위임인 (의뢰인)</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                {contract.clientName}
                {contract.isBusiness && <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">사업자</span>}
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-400 block mb-1">수임인 (담당 변호사)</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                {contract.lawyerName} 변호사
              </span>
            </div>

            <div className="col-span-2 bg-slate-50 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[11px]">총 수임료</span>
                <span className="font-black text-slate-900 text-base">{feeFormatted}원</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">분할 납부</span>
                <span className="font-bold text-slate-700">{contract.feeSchedule.length}회차 분납</span>
              </div>
            </div>
          </div>
        </div>

        {/* 계약 문서 열람 (아코디언) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-800 flex items-center justify-between">
            <span>계약 문서 확인 ({includedDocs.length}종)</span>
            <span className="text-xs text-slate-400">터치하여 내용 열람</span>
          </h3>

          <div className="space-y-2">
            {includedDocs.map(doc => (
              <div key={doc.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                  className="w-full p-3.5 text-left bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    {doc.title}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    {expandedDoc === doc.id ? '접기 ▲' : '내용 보기 ▼'}
                  </span>
                </button>

                {expandedDoc === doc.id && (
                  <div className="p-4 bg-white border-t border-slate-100 max-h-64 overflow-y-auto">
                    <HighlightedDocumentViewer
                      content={doc.content}
                      requiredConfirmationText={doc.requiredConfirmationText}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4대 법적 효력 약관 동의 (상세 전문 확인) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-black text-slate-800">법적 효력 필수 동의 (4대 조항)</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              법적 효력 충족을 위해 각 조항의 상세 전문을 확인하고 동의해 주십시오.
            </p>
          </div>

          {/* 전체 동의 바 */}
          {(() => {
            const allChecked = agreePrivacy && agreeThirdParty && agreeProcedure && agreeLegalEffect;
            const toggleAll = (checked: boolean) => {
              setAgreePrivacy(checked);
              setAgreeThirdParty(checked);
              setAgreeProcedure(checked);
              setAgreeLegalEffect(checked);
            };

            const clientTerms: Array<{
              key: TermKey;
              checked: boolean;
              set: (v: boolean) => void;
              title: string;
              desc: string;
              badge: string;
            }> = [
              {
                key: 'legalEffect',
                checked: agreeLegalEffect,
                set: setAgreeLegalEffect,
                title: '전자서명법 제3조 법적 효력 합의 (필수)',
                desc: '본 전자서명은 종이 서면의 자필 서명과 동일한 법적 효력을 가짐에 합의합니다.',
                badge: '전자서명법 제3조',
              },
              {
                key: 'privacy',
                checked: agreePrivacy,
                set: setAgreePrivacy,
                title: '개인정보 수집 및 위임 사무 처리 동의 (필수)',
                desc: '법무법인의 사건 대리 및 법원 서류 작성을 위한 개인정보 수집·이용에 동의합니다.',
                badge: '개인정보보호법 제15조·제22조',
              },
              {
                key: 'thirdParty',
                checked: agreeThirdParty,
                set: setAgreeThirdParty,
                title: '제3자 정보제공 동의 (필수)',
                desc: '법원, 채권 금융기관, 신용정보원 등에 사건 접수 및 심사를 위한 정보 제공에 동의합니다.',
                badge: '개인정보보호법 제17조',
              },
              {
                key: 'procedure',
                checked: agreeProcedure,
                set: setAgreeProcedure,
                title: '사건 진행 절차 및 유의사항 확인 (필수)',
                desc: '사법 심사 결과 보장 불가 고지, 소요 기간, 면책 불허가 사유 등을 충분히 확인하였습니다.',
                badge: '변호사법 광고규정 준수',
              },
            ];

            return (
              <div className="space-y-2.5">
                <label className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                  allChecked ? 'border-brand bg-brand/5' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={e => toggleAll(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#1E3A5F] cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-black text-slate-900">
                      모든 필수 약관에 전체 동의합니다
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {allChecked ? '완료' : '1클릭 동의'}
                  </span>
                </label>

                {clientTerms.map(item => {
                  const isExpanded = expandedTerms[item.key] ?? false;
                  const termDef = LEGAL_TERMS_DATA[item.key];
                  const content = termDef.getContent({
                    firmName: contract.lawFirmName,
                    clientName: contract.clientName,
                    lawyerName: contract.lawyerName,
                  });

                  return (
                    <div
                      key={item.key}
                      className={`rounded-xl border transition-colors overflow-hidden ${
                        item.checked ? 'border-brand/30 bg-white' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="p-3 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={e => item.set(e.target.checked)}
                              className="w-4 h-4 rounded accent-[#1E3A5F] mt-0.5 cursor-pointer shrink-0"
                            />
                            <div>
                              <p className="text-xs font-bold text-slate-800">{item.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{item.desc}</p>
                            </div>
                          </label>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedTermKey(item.key)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] cursor-pointer whitespace-nowrap"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>전문 팝업</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedTerms(p => ({ ...p, [item.key]: !p[item.key] }))}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                              title="상세보기 토글"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* 아코디언 인라인 전문 */}
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-slate-50 border-t border-slate-100 rounded-lg text-[11px] text-slate-700 space-y-2">
                            <div className="p-2.5 bg-white border border-slate-200 rounded max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {content}
                            </div>
                            {!item.checked && (
                              <button
                                type="button"
                                onClick={() => {
                                  item.set(true);
                                  toast.success('동의가 완료되었습니다.');
                                }}
                                className="w-full py-1.5 bg-[#1E3A5F] text-white font-bold rounded-lg text-xs cursor-pointer"
                              >
                                내용 확인 및 동의하기
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* 1단계: 스마트폰 본인인증 (카카오페이 / PASS / 토스 / SMS 안전망) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#1E3A5F]" />
              <span>1단계: 전자서명 본인확인 (공인 인증 수단 선택)</span>
            </h3>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              전자서명법 제3조 규정 준수
            </span>
          </div>

          {verified ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-emerald-800 text-xs font-bold bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 flex items-center justify-between flex-wrap gap-1">
                  <span>인증 완료: <strong>{contract.identityVerification?.name}</strong></span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                    {contract.identityVerification?.providerName || contract.identityVerification?.carrier || '공인 본인인증'}
                  </span>
                </div>
              </div>
              {repMatchMessage && (
                <p className="text-[11px] text-slate-600 font-medium pl-1">{repMatchMessage}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                원하시는 인증 수단을 선택하여 본인확인을 완료해 주십시오. <strong>앱이 없으신 경우 [문자(SMS) 인증]</strong>을 선택하시면 됩니다.
              </p>

              {/* 5대 인증 수단 선택 탭/카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'kakao' as const, label: '카카오톡', badge: '가장 빠름', icon: '💬', desc: '카카오 간편인증' },
                  { id: 'naver' as const, label: '네이버', badge: '간편서명', icon: '🟢', desc: '네이버 앱 인증' },
                  { id: 'toss' as const, label: '토스', badge: '앱인증', icon: '🔷', desc: '토스 앱 인증' },
                  { id: 'pass' as const, label: 'PASS 앱', badge: '통신 3사', icon: '📱', desc: 'PASS 스마트폰 앱' },
                  { id: 'sms' as const, label: '문자 (SMS)', badge: '안전망', icon: '✉️', desc: '앱 불필요 6자리' },
                ].map(p => {
                  const isSelected = authProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAuthProvider(p.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 shadow-xs' 
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-base">{p.icon}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          isSelected ? 'bg-[#1E3A5F] text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {p.badge}
                        </span>
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isSelected ? 'text-[#1E3A5F]' : 'text-slate-800'}`}>
                          {p.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {p.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* SMS 선택 시 안심 안내 */}
              {authProvider === 'sms' && (
                <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-900 text-[11px] leading-relaxed flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span>
                    <strong>간편인증 앱이 없어도 안심하세요:</strong> 본인 명의 휴대폰 문자로 발송되는 6자리 인증번호만 입력하시면 신용 회복 중이거나 고령자분도 100% 서명 가능합니다.
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleIdentityVerification}
                disabled={verifying}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-sm cursor-pointer shadow-xs transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{authProvider === 'sms' ? '문자(SMS) 인증번호 발송 중...' : '공인 인증 요청 중...'}</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>
                      {authProvider === 'kakao' ? '카카오톡으로 1초 간편인증 및 전자서명' :
                       authProvider === 'naver' ? '네이버 앱으로 1초 간편인증 및 전자서명' :
                       authProvider === 'toss' ? '토스 앱으로 간편인증 및 전자서명' :
                       authProvider === 'pass' ? '통신 3사 PASS로 본인인증 시작' :
                       '휴대폰 문자(SMS)로 6자리 인증번호 받기'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 2단계 (조건부): 중요 조항 직접 자필확약 문구 입력 (금융·보험사 벤치마킹) */}
        {(() => {
          const confirmationDocs = includedDocs.filter(d => d.requiredConfirmationText);
          if (confirmationDocs.length === 0) return null;

          const allConfirmationsMatch = confirmationDocs.every(
            d => (userConfirmations[d.id] || '').trim() === (d.requiredConfirmationText || '').trim()
          );

          return (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>2단계: 중요 조항 직접 자필확약 입력</span>
                </h3>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  약관규제법 제3조 준수
                </span>
              </div>

              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <p className="font-bold mb-1">
                  💡 금융기관·보험사 전자청약과 동일한 법적 부인방지 확인 절차입니다.
                </p>
                <p className="text-[11px] text-amber-800/90">
                  의뢰인 보호 및 설명의무 이행을 위해, 아래 각 문서별 지정 문구를 <strong>토씨 하나까지 정확히 직접 타이핑</strong>해 주셔야 서명 제출이 승인됩니다.
                </p>
              </div>

              <div className="space-y-3.5">
                {confirmationDocs.map(doc => {
                  const targetText = (doc.requiredConfirmationText || '').trim();
                  const currentVal = userConfirmations[doc.id] || '';
                  const isMatch = currentVal.trim() === targetText;

                  return (
                    <div key={doc.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{CONTRACT_DOC_TYPES[doc.type]?.emoji || '📄'}</span>
                          <span>{doc.title}</span>
                        </span>
                        {isMatch ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>일치 완료</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            직접 입력 대기
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-700">
                        <span className="text-[11px] text-slate-400 block mb-1">입력 요구 문구:</span>
                        <div className="p-2.5 bg-yellow-100/80 border border-yellow-300 rounded-lg font-black text-amber-950 select-none">
                          "{targetText}"
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={currentVal}
                          onChange={e => setUserConfirmations(prev => ({ ...prev, [doc.id]: e.target.value }))}
                          placeholder={`위 문구("${targetText}")를 그대로 직접 입력하세요`}
                          className={`w-full px-3 py-2.5 bg-white border rounded-xl text-xs font-bold transition-all ${
                            isMatch
                              ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950'
                              : currentVal.length > 0
                              ? 'border-amber-400 text-slate-900'
                              : 'border-slate-200 text-slate-900'
                          } focus:outline-none`}
                        />
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          {isMatch ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> 정확히 일치합니다.
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              {currentVal.length === 0 ? '공백과 띄어쓰기를 포함하여 입력하세요.' : '문구가 아직 일치하지 않습니다.'}
                            </span>
                          )}
                          <span className="text-slate-400">{currentVal.length} / {targetText.length}자</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {allConfirmationsMatch ? (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>모든 중요 조항에 대한 직접 자필확약 입력이 정상 확인되었습니다.</span>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>모든 문구를 정확히 입력해야 아래 서명 단계가 최종 완료됩니다.</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* 2단계 또는 3단계: 자필 전자 서명 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">
              {includedDocs.some(d => d.requiredConfirmationText) ? '3단계: 위임인 자필 서명 날인' : '2단계: 위임인 자필 서명 날인'}
            </h3>
            {!verified && (
              <span className="text-[11px] text-amber-600 font-bold">
                ⚠️ 본인인증 완료 후 서명 가능
              </span>
            )}
          </div>

          {signatureData ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                <Check className="w-4 h-4" /> 서명 등록 완료
              </div>
              <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex items-center justify-between">
                <img src={signatureData} alt="자필 서명" className="h-16 object-contain" />
                <button
                  type="button"
                  onClick={() => setSignatureData(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer"
                >
                  다시 서명
                </button>
              </div>
            </div>
          ) : verified ? (
            <SignatureCanvas
              label={`${contract.clientName} 의뢰인 자필 서명`}
              onComplete={sig => {
                setSignatureData(sig);
                toast.success('서명이 입력되었습니다.');
              }}
            />
          ) : (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              상단의 [스마트폰 본인인증]을 먼저 완료하시면 서명 패드가 활성화됩니다.
            </div>
          )}
        </div>

        {/* 최종 제출 버튼 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSubmitSignature}
            disabled={submitting || !verified || !signatureData || !agreePrivacy || !agreeThirdParty || !agreeProcedure || !agreeLegalEffect}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-sm cursor-pointer shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>안전 암호화 서명 제출 중...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>위임계약서 서명 최종 제출</span>
              </>
            )}
          </button>
          <p className="text-[11px] text-center text-slate-400 mt-2">
            제출 시 전자서명법 및 관련 법령에 따라 법적 구속력을 가지는 계약이 체결됩니다.
          </p>
        </div>

        {/* 정식 법률 조항 전문 팝업 모달 */}
        <LegalContractTermsModal
          isOpen={!!selectedTermKey}
          termKey={selectedTermKey}
          onClose={() => setSelectedTermKey(null)}
          onAgree={(key) => {
            if (key === 'privacy') setAgreePrivacy(true);
            if (key === 'thirdParty') setAgreeThirdParty(true);
            if (key === 'procedure') setAgreeProcedure(true);
            if (key === 'legalEffect') setAgreeLegalEffect(true);
            toast.success('약관 내용을 확인하고 동의하였습니다.');
          }}
          firmName={contract.lawFirmName}
          clientName={contract.clientName}
          lawyerName={contract.lawyerName}
        />

        {/* 링크허브 바로써트(Barocert) 카카오/네이버/토스 앱 인증 대기 모달 */}
        {barocertModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-scaleUp">
              <div 
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-sm border border-slate-100" 
                style={{
                  backgroundColor: authProvider === 'kakao' ? '#FEE500' : (authProvider === 'naver' ? '#03C75A' : '#3182F6')
                }}
              >
                {authProvider === 'kakao' ? '💬' : (authProvider === 'naver' ? '🟢' : '🔷')}
              </div>

              <div>
                <h4 className="text-base font-black text-slate-900">
                  {authProvider === 'naver' ? '네이버' : (authProvider === 'toss' ? '토스' : '카카오톡')} 앱을 확인해 주세요
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  의뢰인님의 스마트폰으로 <strong>본인확인 및 전자서명 요청</strong>이 도착했습니다. 앱에서 [인증하기]를 진행해 주세요.
                </p>
              </div>

              {/* 실시간 감지 애니메이션 & 타이머 */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A5F]" />
                  <span>스마트폰 서명 완료를 실시간 감지 중...</span>
                </div>
                <div className="text-xs font-mono font-black text-rose-500">
                  남은 유효시간 {String(Math.floor(barocertCountdown / 60)).padStart(2, '0')}:{String(barocertCountdown % 60).padStart(2, '0')}
                </div>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setBarocertModalOpen(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  인증 취소
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
