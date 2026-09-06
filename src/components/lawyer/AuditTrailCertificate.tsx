import React from 'react';
import { ShieldCheck, Lock, CheckCircle2, FileText, Cpu, Clock, Smartphone, Building2 } from 'lucide-react';
import type { ElectronicContract } from '../../types';
import { buildAuditTrailCertificateData } from '../../services/integrityService';

interface Props {
  contract: ElectronicContract;
}

export default function AuditTrailCertificate({ contract }: Props) {
  const data = buildAuditTrailCertificateData(contract);

  return (
    <div className="bg-white border-2 border-slate-800 rounded-2xl p-6 md:p-8 shadow-md text-slate-800 text-xs leading-relaxed max-w-3xl mx-auto my-6 font-sans">
      
      {/* ── 상단 헤더 ── */}
      <div className="border-b-2 border-slate-800 pb-5 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-slate-900 text-white font-black text-[10px] rounded tracking-wider">OFFICIAL</span>
            <span className="text-[11px] font-bold text-slate-500 tracking-wider">KOREA E-SIGNATURE ACT VERIFIED</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand" />
            <span>전자계약 체결 및 감사추적 인증서</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            본 문서는 전자서명법 제3조 및 전자문서및전자거래기본법 제4조의2에 의거하여 생성된 공인 규격 증거 보고서입니다.
          </p>
        </div>
        <div className="text-right border-l-2 md:border-l border-slate-200 pl-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Contract Identifier</p>
          <p className="text-sm font-black text-slate-900 font-mono">{data.contractId}</p>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{data.completedAt.slice(0, 19).replace('T', ' ')} (KST)</p>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── 1. 사업자 및 계약 권한 검증 (Authority) ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Building2 className="w-4 h-4 text-brand" />
              <span>1. 사업자 실체 및 계약 권한 검증 (Authority Verification)</span>
            </h4>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" /> {data.authority.authorityStatus}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">상호명 (법인/개인)</span>
              <span className="font-bold text-slate-800">{data.authority.companyName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">사업자등록번호</span>
              <span className="font-bold text-slate-800 font-mono">{data.authority.businessNumber}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">국세청 등록 대표자</span>
              <span className="font-bold text-slate-800">{data.authority.representativeName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">국세청 진위확인 상태</span>
              <span className="font-bold text-emerald-700">{data.authority.ntsStatusName}</span>
            </div>
          </div>
        </div>

        {/* ── 2. 서명자 스마트폰 본인확인 정보 (Identity) ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Smartphone className="w-4 h-4 text-brand" />
              <span>2. 스마트폰 본인인증 정보 (Signer Identity & Non-Repudiation)</span>
            </h4>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" /> 통신 3사 KISA 공인 확인
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">인증 서명자 실명</span>
              <span className="font-bold text-slate-900">{data.identity.signerName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">인증 통신사 / 기관</span>
              <span className="font-bold text-slate-800">{data.identity.carrier}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">통신사 공인 거래번호</span>
              <span className="font-bold text-slate-800 font-mono text-[10px]">{data.identity.txId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">통신사 공인 시각</span>
              <span className="font-bold text-slate-800 font-mono">{data.identity.certifiedAt.slice(0, 19).replace('T', ' ')}</span>
            </div>
            <div className="md:col-span-2 flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">접속 IP / 단말기 환경</span>
              <span className="font-mono text-[10px] text-slate-700">{data.identity.ipAddress} · {data.identity.deviceInfo}</span>
            </div>
          </div>
        </div>

        {/* ── 3. 의사 확인 및 서명 기록 (Intent) ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <FileText className="w-4 h-4 text-brand" />
              <span>3. 의사 확인 및 자필 서명 날인 (Intent & Consent)</span>
            </h4>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" /> 자필 서명 날인 완료
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">전문 열람 및 스크롤 감지</span>
              <span className="font-bold text-emerald-700">{data.intent.viewDurationText}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">필수 법률 약관 동의</span>
              <span className="font-bold text-slate-800">{data.intent.agreedTermsCount}개 조항 개별 확인 완료</span>
            </div>
            <div className="md:col-span-2 flex justify-between border-b border-slate-200/60 pb-1">
              <span className="text-slate-500 font-medium">서명 날인 방식</span>
              <span className="font-bold text-slate-800">{data.intent.signatureMethod}</span>
            </div>
          </div>
        </div>

        {/* ── 4. 무결성 암호화 및 3중 타임스탬프 (Integrity & Time-Stamp) ── */}
        <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>4. 문서 무결성 봉인 및 3중 타임스탬프 (Cryptographic Time-Stamp)</span>
            </h4>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded">
              <Lock className="w-3 h-3" /> FIPS 180-4 SHA-256 SEALED
            </span>
          </div>

          <div className="space-y-1.5 text-[10px] font-mono">
            <div>
              <span className="text-slate-400 block">Original Document Hash (서명 전 원본 해시):</span>
              <span className="text-slate-200 break-all select-all">{data.integrity.originalHash}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Final Document Hash (최종 체결본 해시):</span>
              <span className="text-emerald-400 break-all select-all font-bold">{data.integrity.finalHash}</span>
            </div>
            <div className="pt-1 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="text-slate-400">Timestamp Token: </span>
                <span className="text-amber-300">{data.integrity.timestampToken}</span>
              </div>
              <div className="text-slate-400 text-[9px]">
                한국표준시(KST) 및 통신사 시점 봉인
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── 하단 법적 고지 ── */}
      <div className="mt-5 pt-4 border-t border-slate-200 text-[10px] text-slate-500 leading-relaxed">
        <p>
          <strong>법적 효력 보증 안내:</strong> 본 감사추적 인증서는 전자서명법 제3조 제1항에 따라 자필 서명 날인과 동일한 효력을 지니며, 민사소송법 제358조에 의거하여 당사자의 진정한 의사에 기하여 작성된 사문서로서의 진정성립을 증명합니다. 본 문서는 체결 시점 이후 임의 수정이나 위·변조가 일체 불가능하도록 암호학적으로 봉인되었습니다.
        </p>
      </div>

    </div>
  );
}
