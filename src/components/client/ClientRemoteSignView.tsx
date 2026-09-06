import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Smartphone, CheckCircle2, AlertTriangle, 
  FileText, Check, Loader2, Lock, ArrowRight, Building2, User 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract } from '../../types';
import { getContract, saveContract, addAuditLog, finalizeContractWithIntegrity } from '../../services/contractService';
import { requestIdentityVerification, isPortOneConfigured, verifyRepresentativeMatch } from '../../services/portoneService';
import SignatureCanvas from '../lawyer/SignatureCanvas';

interface Props {
  cid: string;
  token: string;
}

export default function ClientRemoteSignView({ cid, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ElectronicContract | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 약관 동의
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeLegalEffect, setAgreeLegalEffect] = useState(false);

  // 본인인증
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [repMatchMessage, setRepMatchMessage] = useState<string | null>(null);

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

  const handleIdentityVerification = async () => {
    if (!contract) return;
    setVerifying(true);
    const expectedName = contract.isBusiness 
      ? (contract.businessInfo?.representativeName || contract.clientName) 
      : contract.clientName;

    const result = await requestIdentityVerification(expectedName);
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
    if (!agreePrivacy || !agreeLegalEffect) {
      toast.error('필수 동의 항목에 모두 체크해 주세요.');
      return;
    }
    if (!verified) {
      toast.error('스마트폰 본인인증을 먼저 완료해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const updatedDocs = contract.documents.map(d => 
        d.included ? { ...d, clientSignature: signatureData, clientSignedAt: now } : d
      );

      let updatedContract: ElectronicContract = {
        ...contract,
        documents: updatedDocs,
        updatedAt: now,
      };

      updatedContract = addAuditLog(
        updatedContract, 
        `위임인(${contract.clientName}) 모바일 스마트폰 본인인증 및 전자서명 제출`, 
        'client'
      );

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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-lg max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-scaleUp">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              서명 제출 완료
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">전자위임계약 서명 완료</h2>
            <p className="text-sm text-slate-500 mt-1">
              {contract.clientName} 의뢰인님의 자필 서명이 안전하게 등록되었습니다.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl text-left text-xs space-y-2 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">계약 번호</span>
              <span className="font-bold text-slate-800">{contract.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">수임 법무법인</span>
              <span className="font-bold text-slate-800">{contract.lawFirmName} ({contract.lawyerName} 변호사)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">서명 일시</span>
              <span className="font-bold text-slate-800">{new Date().toLocaleString('ko-KR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">법적 효력</span>
              <span className="font-bold text-emerald-600">전자서명법 제3조 규정 충족</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            작성된 계약서는 암호화되어 담당 변호사에게 전달되며, 사건 진행에 즉시 반영됩니다.
          </p>

          <a
            href="/"
            className="block w-full py-3 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-xs"
          >
            플랫폼 홈으로 이동
          </a>
        </div>
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
                  <div className="p-4 bg-white border-t border-slate-100 text-xs text-slate-600 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-sans">
                    {doc.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4대 법적 효력 약관 동의 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-black text-slate-800">법적 효력 필수 동의</h3>
          
          <div className="space-y-2.5">
            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${agreeLegalEffect ? 'border-brand/30 bg-brand/5' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input
                type="checkbox"
                checked={agreeLegalEffect}
                onChange={e => setAgreeLegalEffect(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1E3A5F] mt-0.5 cursor-pointer shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-slate-800">[필수] 전자서명법 제3조 법적 효력 합의</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  본 전자서명은 종이 서면의 자필 서명 및 날인과 동일한 법적 효력을 가짐에 동의합니다.
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${agreePrivacy ? 'border-brand/30 bg-brand/5' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={e => setAgreePrivacy(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1E3A5F] mt-0.5 cursor-pointer shrink-0"
              />
              <div>
                <p className="text-xs font-bold text-slate-800">[필수] 개인정보 수집 및 위임 사무 처리 동의</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  법무법인의 사건 대리 및 법원 제출 서류 작성을 위한 개인정보 수집·이용에 동의합니다.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 1단계: 스마트폰 본인인증 (PASS / 문자 실명확인) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#1E3A5F]" />
              <span>1단계: 스마트폰 본인인증 (통신 3사 실명확인)</span>
            </h3>
            <span className="text-[10px] text-slate-400">
              {isPortOneConfigured() ? 'PortOne PASS 연동' : '데모 실명 인증'}
            </span>
          </div>

          {verified ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>본인인증 완료: {contract.identityVerification?.name} ({contract.identityVerification?.carrier || 'SKT'})</span>
              </div>
              {repMatchMessage && (
                <p className="text-[11px] text-slate-600 font-medium pl-1">{repMatchMessage}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600">
                의뢰인 본인 명의의 스마트폰으로 통신사(SKT/KT/LGU+) 실명 인증을 완료해 주십시오.
              </p>
              <button
                type="button"
                onClick={handleIdentityVerification}
                disabled={verifying}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-sm cursor-pointer shadow-xs transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>통신사 인증 창 호출 중...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>스마트폰 본인인증 시작</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 2단계: 자필 전자 서명 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">
              2단계: 위임인 자필 서명
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
            disabled={submitting || !verified || !signatureData || !agreePrivacy || !agreeLegalEffect}
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

      </div>
    </div>
  );
}
