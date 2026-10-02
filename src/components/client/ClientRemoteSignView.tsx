import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Copy, FileText, Lock, Mail, PenLine, PhoneCall, Smartphone, User,
} from 'lucide-react';
import { toast } from 'sonner';
import type { BankAccountInfo, ElectronicContract } from '../../types';
import {
  getContractForRemoteSign, saveContract, addAuditLog, finalizeContractWithIntegrity, isRemoteSignServerEnabled, submitRemoteSignStage,
} from '../../services/contractService';
import { syncContractToCrm } from '../../services/crmService';
import { requestIdentityVerification, verifyRepresentativeMatch } from '../../services/portoneService';
import { generateCourtSubmissionPdf } from '../../services/contractPdfService';
import { LEGAL_TERMS_DATA, type TermKey } from '../common/LegalContractTermsModal';
import ContractPublicVerifierModal from '../common/ContractPublicVerifierModal';
import { Badge, Button, Callout, Card, Modal, inputClass } from './ui';
import { SignFooter, SignHeader, SignPage, SignStepHeading } from './sign/SignLayout';
import SignDocReader, { type SignReaderDoc } from './sign/SignDocReader';
import SignaturePadModal from './sign/SignaturePadModal';
import { SignCompletedScreen, SignErrorScreen, SignLoadingScreen, type SignErrorKind } from './sign/SignStatusScreens';
import { contractFeeWon, formatDateKo, formatWon, installmentWon } from './sign/signFormat';
import { cn } from '../../utils/cn';

/**
 * 원격 전자서명 (?view=sign&cid=...&token=...) — 모바일 위저드 (docs/mykim_client_ui_upgrade_plan.md 3-7)
 * 한 화면에 한 단계: 계약서 확인 → 필수 동의 → 본인인증 → (중요 조항 확인 문구) → 서명
 * - 저장 흐름(서버 remote-sign 단계 저장, 로컬 저장, 가명→실명 전환, 체결 봉인)은 이전과 같다
 * - 이전 화면: 긴 한 페이지, 단계 번호 불일치, 계약서 256px 상자·12px 글씨, 본인인증 실패 사유가 토스트로만 잠깐 보임
 */

interface Props {
  cid: string;
  token: string;
}

/**
 * 본인인증 호출에 넘기는 수단 값.
 * 포트원 호출에는 수단이 전달되지 않아 어떤 것을 골라도 같은 인증 창이 열린다(실제 수단은 인증 창에서 고른다).
 * 그래서 화면의 수단 선택(카카오·PASS·토스·문자)을 없애고, 기록되는 표시명도 실제와 맞게 하나로 통일한다.
 */
const IDV_PROVIDER = 'pass' as const;
const IDV_PROVIDER_NAME = '휴대폰 본인인증(포트원)';

type StepKey = 'review' | 'terms' | 'identity' | 'confirm' | 'sign';
const STEP_LABEL: Record<StepKey, string> = {
  review: '계약서',
  terms: '약관 동의',
  identity: '본인인증',
  confirm: '확인 문구',
  sign: '서명',
};

const TERM_ORDER: TermKey[] = ['legalEffect', 'privacy', 'thirdParty', 'procedure'];
/** record: 계약서에 저장되는 동의 항목 이름(서버·PDF가 이 값을 쓴다 — 바꾸지 말 것) */
const TERM_COPY: Record<TermKey, { title: string; desc: string; record: string }> = {
  legalEffect: {
    title: '전자서명으로 계약하는 데 동의',
    desc: '이 계약을 전자서명으로 맺는 데 동의해요. 전자서명의 효력은 전자서명법 제3조에 따라요.',
    record: '전자서명 효력 합의',
  },
  privacy: {
    title: '개인정보 수집·이용 동의',
    desc: '사건 대리와 법원 서류 작성을 위해 개인정보를 수집·이용하는 데 동의해요.',
    record: '개인정보 수집·이용',
  },
  thirdParty: {
    title: '개인정보 제3자 제공 동의',
    desc: '사건 접수와 심사를 위해 법원·채권 금융기관 등에 정보를 제공하는 데 동의해요.',
    record: '개인정보 제3자 제공',
  },
  procedure: {
    title: '사건 진행 절차와 유의사항 확인',
    desc: '법원 판단 결과는 보장되지 않는다는 점, 예상 기간, 면책 불허가 사유 등을 확인했어요.',
    record: '사건 진행 절차 및 유의사항',
  },
};

const EMPTY_AGREE: Record<TermKey, boolean> = { legalEffect: false, privacy: false, thirdParty: false, procedure: false };

/** 서버가 '취소된 계약'이라 서명·본인인증을 거부했는지 (api/contract.js CONTRACT_CLOSED_ERROR 문구) */
function isContractClosedError(msg: string | undefined | null): boolean {
  return !!msg && /취소된 계약서/.test(msg);
}

/** 브라우저 네트워크 오류 문구(영문)를 알기 쉬운 문장으로 */
function friendlyError(msg: string | undefined | null, fallback: string): string {
  if (!msg) return fallback;
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return '인터넷 연결이 불안정해 요청을 보내지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  return msg;
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export default function ClientRemoteSignView({ cid, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [contract, setContract] = useState<ElectronicContract | null>(null);
  const [errorKind, setErrorKind] = useState<SignErrorKind | null>(null);
  const [expiredAt, setExpiredAt] = useState<string | undefined>();

  const [stepIdx, setStepIdx] = useState(0);
  const [agree, setAgree] = useState<Record<TermKey, boolean>>(EMPTY_AGREE);
  const [termsAttempted, setTermsAttempted] = useState(false);
  const [readDocIds, setReadDocIds] = useState<string[]>([]);
  const [reader, setReader] = useState<{ kind: 'doc'; id: string } | { kind: 'term'; key: TermKey } | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [identityNote, setIdentityNote] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const [userConfirmations, setUserConfirmations] = useState<Record<string, string>>({});
  const [confirmAttempted, setConfirmAttempted] = useState(false);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signAttempted, setSignAttempted] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [completed, setCompleted] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // 오프라인/서면 체결 전환 요청 상태
  const [offlineReqType, setOfflineReqType] = useState<'in_person' | 'postal' | null>(null);
  const [offlinePostalAddr, setOfflinePostalAddr] = useState('');
  const [offlineReqDone, setOfflineReqDone] = useState<string | null>(null);
  const [submittingOfflineReq, setSubmittingOfflineReq] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const doneHeadingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const signButtonRef = useRef<HTMLButtonElement>(null);
  const stepMountedRef = useRef(false);

  // ── 계약서 불러오기 (오류 유형별 화면) ──
  const load = useCallback(async (mode: 'initial' | 'retry' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'retry') setRetrying(true);
    try {
      if (!cid || !token) {
        setErrorKind('invalid_link');
        return;
      }
      const found = await getContractForRemoteSign(cid, token);
      if (!found) {
        setErrorKind(isOffline() ? 'offline' : 'not_found');
        return;
      }
      // 토큰 검증
      if (found.remoteSignToken && found.remoteSignToken !== token) {
        setErrorKind('not_found');
        return;
      }
      // 변호사가 취소한 계약은 서명·열람 대신 취소 안내
      if (found.status === 'cancelled') {
        setErrorKind('cancelled');
        return;
      }
      const included = (found.documents || []).filter(d => d.included);
      const alreadySigned = found.status === 'completed' || included.some(d => d.clientSignature);
      // 만료 링크 차단 (서명 전 계약만 — 서명 완료본은 확인 화면 열람 허용)
      if (!alreadySigned && found.remoteSignExpiresAt && new Date(found.remoteSignExpiresAt).getTime() < Date.now()) {
        setExpiredAt(found.remoteSignExpiresAt);
        setErrorKind('expired');
        return;
      }
      if (!alreadySigned && included.length === 0) {
        setErrorKind('no_documents');
        return;
      }
      setErrorKind(null);
      setContract(found);
      setCompleted(alreadySigned);
      if (found.identityVerification) setVerified(true);
    } catch (e) {
      console.warn('[remote-sign] 계약서 불러오기 실패', e);
      setErrorKind(isOffline() ? 'offline' : 'load_failed');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [cid, token]);

  useEffect(() => {
    void load('initial');
  }, [load]);

  useEffect(() => {
    const prev = document.title;
    document.title = '전자계약 서명 | my김변';
    return () => {
      document.title = prev;
    };
  }, []);

  // 고정 머리(브랜드+진행 단계)·하단 액션 바에 포커스 대상이 가려지지 않게 (WCAG 2.4.11)
  useEffect(() => {
    const html = document.documentElement;
    const prevTop = html.style.scrollPaddingTop;
    const prevBottom = html.style.scrollPaddingBottom;
    html.style.scrollPaddingTop = '7.5rem';
    html.style.scrollPaddingBottom = 'calc(6.5rem + env(safe-area-inset-bottom))';
    return () => {
      html.style.scrollPaddingTop = prevTop;
      html.style.scrollPaddingBottom = prevBottom;
    };
  }, []);

  // 단계가 바뀌면 맨 위로 + 단계 제목에 포커스
  useEffect(() => {
    if (!stepMountedRef.current) {
      stepMountedRef.current = true;
      return;
    }
    window.scrollTo({ top: 0 });
    const t = window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 30);
    return () => window.clearTimeout(t);
  }, [stepIdx]);

  // 방금 제출해 완료 화면으로 바뀌면 완료 제목에 포커스
  useEffect(() => {
    if (!completed || !justSubmitted) return;
    window.scrollTo({ top: 0 });
    const t = window.setTimeout(() => doneHeadingRef.current?.focus({ preventScroll: true }), 30);
    return () => window.clearTimeout(t);
  }, [completed, justSubmitted]);

  // 인증·제출 오류가 생기면 오류 안내가 보이게
  useEffect(() => {
    if (!identityError && !submitError) return;
    const t = window.setTimeout(() => alertRef.current?.scrollIntoView({ block: 'nearest' }), 30);
    return () => window.clearTimeout(t);
  }, [identityError, submitError]);

  // ── 파생 값 ──
  const includedDocs = useMemo(() => (contract?.documents || []).filter(d => d.included), [contract]);
  const confirmationDocs = useMemo(() => includedDocs.filter(d => (d.requiredConfirmationText || '').trim()), [includedDocs]);
  const steps: StepKey[] = confirmationDocs.length > 0
    ? ['review', 'terms', 'identity', 'confirm', 'sign']
    : ['review', 'terms', 'identity', 'sign'];
  const safeIdx = Math.min(stepIdx, steps.length - 1);
  const stepKey = steps[safeIdx];

  const agreedCount = TERM_ORDER.filter(k => agree[k]).length;
  const allAgreed = agreedCount === TERM_ORDER.length;
  const isConfirmationOk = (d: { id: string; requiredConfirmationText?: string }) =>
    (userConfirmations[d.id] || '').trim() === (d.requiredConfirmationText || '').trim();
  const allConfirmationsMatch = confirmationDocs.every(isConfirmationOk);
  const unreadCount = includedDocs.filter(d => !readDocIds.includes(d.id)).length;
  const lawyerAlreadySigned = !!contract?.documents.some(d => d.lawyerSignature);
  const isRealNameConversion = !!contract?.realNameConversionPending && !contract?.isBusiness;
  const signerName = contract?.clientName || '의뢰인';

  const readerDoc: SignReaderDoc | null = useMemo(() => {
    if (!reader || !contract) return null;
    if (reader.kind === 'doc') {
      const d = includedDocs.find(x => x.id === reader.id);
      if (!d) return null;
      return {
        kind: 'contract',
        title: d.title,
        content: d.content,
        confirmationText: (d.requiredConfirmationText || '').trim() || undefined,
      };
    }
    return {
      kind: 'terms',
      title: TERM_COPY[reader.key].title,
      content: LEGAL_TERMS_DATA[reader.key].getContent({
        firmName: contract.lawFirmName,
        clientName: contract.clientName,
        lawyerName: contract.lawyerName,
      }),
    };
  }, [reader, contract, includedDocs]);

  const openDoc = (id: string) => {
    setReader({ kind: 'doc', id });
    setReadDocIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // ── 단계 이동 ──
  const goBack = () => setStepIdx(i => Math.max(0, Math.min(i, steps.length - 1) - 1));
  const goNext = () => {
    if (stepKey === 'terms' && !allAgreed) {
      setTermsAttempted(true);
      const first = TERM_ORDER.find(k => !agree[k]);
      if (first) document.getElementById(`sign-term-${first}`)?.focus();
      return;
    }
    if (stepKey === 'identity' && !verified) return;
    if (stepKey === 'confirm' && !allConfirmationsMatch) {
      setConfirmAttempted(true);
      const first = confirmationDocs.find(d => !isConfirmationOk(d));
      if (first) document.getElementById(`sign-confirm-${first.id}`)?.focus();
      return;
    }
    setStepIdx(Math.min(steps.length - 1, safeIdx + 1));
  };

  // ── 오프라인 서면(방문/우편) 계약 전환 요청 ──
  const handleSubmitOfflineRequest = async () => {
    if (!contract || !offlineReqType) return;
    if (offlineReqType === 'postal' && !offlinePostalAddr.trim()) {
      toast.error('우편물을 수령하실 배송지 주소를 입력해 주세요.');
      return;
    }
    setSubmittingOfflineReq(true);
    try {
      const modeLabel = offlineReqType === 'in_person' ? '방문 대면 체결' : '우편 등기 계약';
      const detailInfo = offlineReqType === 'postal' ? ` [수령주소: ${offlinePostalAddr.trim()}]` : '';
      const auditMsg = `의뢰인이 휴대폰 본인인증 곤란으로 [${modeLabel}] 전환을 요청함${detailInfo}`;
      
      let updated = addAuditLog(contract, auditMsg, 'client');
      updated = {
        ...updated,
        paperContractInfo: {
          method: offlineReqType,
          signedDate: '',
          notes: `의뢰인 원격서명 페이지에서 오프라인 전환 요청 접수${detailInfo}`,
          postalInfo: offlineReqType === 'postal' ? {
            recipientAddress: offlinePostalAddr.trim(),
          } : undefined,
        },
      };
      await saveContract(updated);
      setContract(updated);
      setOfflineReqDone(modeLabel);
      setOfflineReqType(null);
      toast.success(`${modeLabel} 전환 요청이 법률사무소로 전달되었습니다.`);
    } catch (e: any) {
      toast.error('전환 요청 처리 중 오류가 발생했습니다. 담당 사무소로 직접 문의해 주세요.');
    } finally {
      setSubmittingOfflineReq(false);
    }
  };

  // ── 본인인증 (포트원) ──
  const handleIdentityVerification = async () => {
    if (!contract || verifying) return;
    setVerifying(true);
    setIdentityError(null);
    setIdentityNote(null);
    try {
      // ── 서버 저장 경로 (운영): 포트원 인증 → 서버가 단건 조회로 실명 확인 후 실명 전환/이름 대조·저장 ──
      if (isRemoteSignServerEnabled) {
        const expected = isRealNameConversion
          ? undefined
          : (contract.isBusiness ? (contract.businessInfo?.representativeName || contract.clientName) : contract.clientName);
        const idv = await requestIdentityVerification(expected, IDV_PROVIDER, { contractId: contract.id, remoteSignToken: token });
        if (!idv.success) {
          // 진행 중에 변호사가 계약을 취소한 경우(서버가 거부) → 취소 안내 화면
          if (isContractClosedError(idv.error)) { setErrorKind('cancelled'); return; }
          setIdentityError(friendlyError(idv.error, '본인인증을 마치지 못했어요. 다시 시도해 주세요.'));
          return;
        }
        const saved = await submitRemoteSignStage({
          stage: 'identity',
          contractId: contract.id,
          remoteSignToken: token,
          identityVerificationId: idv.txId,
          provider: IDV_PROVIDER,
          providerName: IDV_PROVIDER_NAME,
        });
        if (saved.ok === false) {
          if (saved.code === 'contract_closed' || isContractClosedError(saved.error)) { setErrorKind('cancelled'); return; }
          setIdentityError(friendlyError(saved.error, '인증 결과를 저장하지 못했어요. 다시 시도해 주세요.'));
          return;
        }
        setContract(saved.contract);
        if (isRealNameConversion) setIdentityNote(`${saved.contract.clientName}님 명의로 계약서가 작성되었어요.`);
        setVerified(true);
        toast.success('본인인증을 마쳤어요.');
        return;
      }

      // ── 스텔스 가명 → 실명 전환 계약 (고객이 제안서에서 직접 시작한 계약) ──
      // 계약서의 이름은 가명이므로 이름 대조 대신, 본인인증으로 확인된 실명·연락처를 계약 당사자로 확정한다.
      if (isRealNameConversion) {
        const result = await requestIdentityVerification(undefined, IDV_PROVIDER, { contractId: contract.id, remoteSignToken: token });
        if (!result.success) {
          setIdentityError(friendlyError(result.error, '본인인증을 마치지 못했어요. 다시 시도해 주세요.'));
          return;
        }
        const realName = (result.name || '').trim();
        if (!realName || realName === '인증회원') {
          setIdentityError('본인인증 결과에서 실명을 확인하지 못했어요. 다시 시도해 주세요.');
          return;
        }
        const providerName = result.isDemo ? `${IDV_PROVIDER_NAME} — 개발 환경` : IDV_PROVIDER_NAME;
        const aliasName = contract.clientName;
        const realPhone = result.phoneNumber || contract.clientPhone || '';
        const replaceAlias = (text: string) =>
          aliasName && aliasName !== realName ? text.split(aliasName).join(realName) : text;

        let converted: ElectronicContract = {
          ...contract,
          clientName: realName,
          clientPhone: realPhone,
          documents: contract.documents.map(d => ({ ...d, content: replaceAlias(d.content) })),
          identityVerification: { ...result, providerName },
          authorityStatus: 'REPRESENTATIVE_VERIFIED',
          realNameConversionPending: false,
        };
        converted = addAuditLog(converted, `본인인증(${providerName}) 완료 — 가명 계약 당사자를 인증된 실명으로 전환`, 'client');
        const savedOk = await saveContract(converted).catch(() => false);
        if (!savedOk) {
          setIdentityError('인증 정보를 저장하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
          return;
        }
        setContract(converted);
        setIdentityNote(`${realName}님 명의로 계약서가 작성되었어요.`);
        setVerified(true);
        toast.success('본인인증을 마쳤어요.');
        return;
      }

      const expectedName = contract.isBusiness
        ? (contract.businessInfo?.representativeName || contract.clientName)
        : contract.clientName;
      // 포트원(PortOne V2) 본인인증
      const result = await requestIdentityVerification(expectedName, IDV_PROVIDER, { contractId: contract.id, remoteSignToken: token });
      if (!result.success) {
        setIdentityError(friendlyError(result.error, '본인인증을 마치지 못했어요. 다시 시도해 주세요.'));
        return;
      }
      // 2단계 대표자 일치 교차 검증
      const match = verifyRepresentativeMatch(expectedName, result.name, contract.clientPhone, result.phoneNumber || result.phoneMasked);
      if (!match.matched) {
        setIdentityError(match.message);
        return;
      }
      const providerName = result.isDemo ? `${IDV_PROVIDER_NAME} — 개발 환경` : IDV_PROVIDER_NAME;
      setContract({ ...contract, identityVerification: { ...result, providerName }, authorityStatus: match.status });
      setVerified(true);
      toast.success('본인인증을 마쳤어요.');
    } catch (e: any) {
      setIdentityError(friendlyError(e?.message, '본인인증 중 문제가 생겼어요. 다시 시도해 주세요.'));
    } finally {
      setVerifying(false);
    }
  };

  // ── 서명 제출 ──
  const handleSubmitSignature = async () => {
    if (!contract || submitting) return;
    if (!signatureData) {
      setConfirmOpen(false);
      setSignAttempted(true);
      return;
    }
    if (!allAgreed || !verified || !allConfirmationsMatch) {
      setConfirmOpen(false);
      setSubmitError('앞 단계에서 끝나지 않은 항목이 있어요. [이전]으로 돌아가 확인해 주세요.');
      return;
    }

    const agreedTerms = TERM_ORDER.filter(k => agree[k]).map(k => TERM_COPY[k].record);
    setSubmitting(true);
    setSubmitError(null);
    try {
      // ── 서버 저장 경로 (운영): 서버가 토큰·본인인증 여부·확약 문구를 재검증하고 서명을 1회만 저장 ──
      if (isRemoteSignServerEnabled) {
        const confirmations: Record<string, string> = {};
        for (const d of confirmationDocs) confirmations[d.id] = (userConfirmations[d.id] || '').trim();
        const saved = await submitRemoteSignStage({
          stage: 'signature',
          contractId: contract.id,
          remoteSignToken: token,
          clientSignature: signatureData,
          confirmations,
          agreedTerms,
        });
        if (saved.ok === false) {
          setConfirmOpen(false);
          // 서명 중에 계약이 취소된 경우(서버가 거부) → 취소 안내 화면
          if (saved.code === 'contract_closed' || isContractClosedError(saved.error)) {
            setErrorKind('cancelled');
            return;
          }
          if (/이미 서명/.test(saved.error)) {
            toast.info('이미 서명이 제출된 계약이에요. 최신 상태로 다시 불러왔어요.');
            await load('refresh');
            return;
          }
          setSubmitError(friendlyError(saved.error, '서명을 제출하지 못했어요. 잠시 후 다시 시도해 주세요.'));
          return;
        }
        try {
          await syncContractToCrm(saved.contract.clientId, saved.contract, { id: 'client', name: saved.contract.clientName, role: 'CLIENT' as any });
        } catch (crmErr) {
          console.warn('CRM sync warning on client sign:', crmErr);
        }
        setContract(saved.contract);
        setConfirmOpen(false);
        setJustSubmitted(true);
        setCompleted(true);
        return;
      }

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
        // 실제로 동의한 약관 목록을 기록 (기존: 미기록 → PDF에 '3개 동의·전문 열람 완료'가 기본값으로 인쇄됨)
        intentVerification: { scrollCompleted: false, agreedTerms },
      };

      const confirmationLogs = confirmationDocs.map(d => `[${d.title}: '${userConfirmations[d.id]}']`).join(', ');
      const auditMsg = confirmationLogs
        ? `위임인(${contract.clientName}) 모바일 본인인증, 중요조항 직접자필확약(${confirmationLogs}) 및 전자서명 제출`
        : `위임인(${contract.clientName}) 모바일 스마트폰 본인인증 및 전자서명 제출`;
      updatedContract = addAuditLog(updatedContract, auditMsg, 'client');

      // 변호사 서명이 이미 있는 경우 즉시 최종 체결 봉인
      const lawyerSig = contract.documents.find(d => d.lawyerSignature)?.lawyerSignature;
      if (lawyerSig) {
        updatedContract = await finalizeContractWithIntegrity(updatedContract, signatureData, lawyerSig);
      } else {
        const savedOk = await saveContract(updatedContract);
        if (!savedOk) {
          throw new Error('서명을 서버에 저장하지 못했어요. 네트워크 상태를 확인한 뒤 다시 제출해 주세요.');
        }
      }

      // CRM 상태 연동 (수임 계약 체결 반영)
      try {
        await syncContractToCrm(updatedContract.clientId, updatedContract, {
          id: 'client',
          name: updatedContract.clientName,
          role: 'CLIENT' as any,
        });
      } catch (crmErr) {
        console.warn('CRM sync warning on client sign:', crmErr);
      }

      setContract(updatedContract);
      setConfirmOpen(false);
      setJustSubmitted(true);
      setCompleted(true);
    } catch (e: any) {
      setConfirmOpen(false);
      setSubmitError(friendlyError(e?.message, '서명을 제출하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!contract || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await generateCourtSubmissionPdf(contract);
    } catch (e) {
      console.warn('[remote-sign] PDF 생성 실패', e);
      toast.error('PDF를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── 화면 분기 ──
  if (loading) return <SignLoadingScreen />;
  if (errorKind) {
    return <SignErrorScreen kind={errorKind} expiresAt={expiredAt} onRetry={() => void load('retry')} retrying={retrying} />;
  }
  if (!contract) return <SignErrorScreen kind="load_failed" onRetry={() => void load('retry')} retrying={retrying} />;

  if (completed) {
    return (
      <>
        <SignCompletedScreen
          contract={contract}
          justSubmitted={justSubmitted}
          downloadingPdf={downloadingPdf}
          onDownloadPdf={handleDownloadPdf}
          onOpenVerify={() => setShowVerifyModal(true)}
          headingRef={doneHeadingRef}
        />
        {/* 서명 링크로 들어온 위임인 본인 화면이라 본인 이름을 가리지 않는다 (공개 검증 링크만 이름 일부를 가린다) */}
        <ContractPublicVerifierModal isOpen={showVerifyModal} onClose={() => setShowVerifyModal(false)} contract={contract} revealFullName />
      </>
    );
  }

  // ── 비용 요약 ──
  const baseFee = contractFeeWon(contract.totalFee);
  const vatAmount = contract.vatIncluded ? Math.round(baseFee * 0.1) : 0;
  const totalFeeWithVat = baseFee + vatAmount;
  const cc = contract.courtCosts;
  const creditorCount = cc?.creditorCount || 0;
  const courtRows = [
    { label: `송달료${creditorCount ? ` (채권자 ${creditorCount}곳 기준)` : ''}`, amount: cc?.deliveryFee || 0 },
    { label: '인지대', amount: cc?.stampFee || 0 },
    { label: `부채증명서 발급 대행비${creditorCount ? ` (${creditorCount}곳)` : ''}`, amount: cc?.debtCertFee || 0 },
    { label: '변제예납금(법원 보관금)', amount: cc?.provisionalDeposit || 0 },
    { label: '기타 공과금·실비', amount: cc?.miscFee || 0 },
  ].filter(r => r.amount > 0);
  const totalCourtCosts = courtRows.reduce((s, r) => s + r.amount, 0);
  const grandTotal = totalFeeWithVat + totalCourtCosts;
  const feeSchedule = (contract.feeSchedule || []).filter(Boolean);

  const sf = contract.successFee;
  const successFeeText = sf?.enabled
    ? sf.type === 'fixed' && sf.amount
      ? formatWon(sf.amount)
      : sf.type === 'reduction_rate' && sf.ratePercent
        ? `${sf.targetType === 'principal' ? '원금 감면액' : sf.targetType === 'total_debt' ? '총 채무 감면액' : '감면액'}의 ${sf.ratePercent}%`
        : sf.description || '계약서 본문 참고'
    : null;
  const successFeeSub = sf?.enabled
    ? [sf.dueDateCondition ? `지급 시점: ${sf.dueDateCondition}` : '', sf.type !== 'custom' && sf.description ? sf.description : '']
        .filter(Boolean)
        .join(' · ')
    : '';

  const idv = contract.identityVerification;
  const identityMismatch = !!identityError && /일치하지|다릅니다|불일치/.test(identityError);

  // ── 단계별 본문 ──
  const renderReview = () => (
    <>
      <SignStepHeading
        ref={headingRef}
        title="계약 내용을 확인해 주세요"
        description={`${contract.lawFirmName || '담당 사무소'}에서 보낸 위임계약서예요. 금액과 문서를 확인한 뒤 다음 단계로 넘어가 주세요.`}
      />
      <div className="space-y-4">
        <Card as="section" padded={false} className="p-5">
          <h2 className="text-base font-bold text-slate-900">계약 당사자</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PartyItem
              icon={<User className="h-4 w-4" />}
              label="위임인(의뢰인)"
              value={
                <>
                  {contract.clientName}
                  {contract.isBusiness && <Badge tone="brand" className="ml-1.5 align-middle">사업자</Badge>}
                </>
              }
              sub={contract.isBusiness ? contract.businessInfo?.companyName : undefined}
            />
            <PartyItem
              icon={<Building2 className="h-4 w-4" />}
              label="수임인(담당 변호사)"
              value={contract.lawyerName ? `${contract.lawyerName} 변호사` : '담당 변호사'}
              sub={contract.lawFirmName}
            />
          </dl>
          {isRealNameConversion && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 break-keep">
              지금은 스텔스 가명으로 표시돼요. 본인인증을 마치면 인증한 실명으로 계약서가 작성돼요.
            </p>
          )}
        </Card>

        <Card as="section" padded={false} className="p-5">
          <h2 className="text-base font-bold text-slate-900">비용</h2>
          <dl className="mt-2 divide-y divide-slate-100 text-sm">
            <MoneyRow
              label="변호사 보수(수임료)"
              value={formatWon(totalFeeWithVat)}
              sub={contract.vatIncluded ? `부가세 ${formatWon(vatAmount)} 포함` : undefined}
              strong
            />
            {successFeeText && <MoneyRow label="성공보수" value={successFeeText} sub={successFeeSub || undefined} />}
            {courtRows.map(r => (
              <MoneyRow key={r.label} label={r.label} value={formatWon(r.amount)} />
            ))}
            {totalCourtCosts > 0 ? (
              <MoneyRow label="합계(수임료 + 법원 비용·실비)" value={formatWon(grandTotal)} strong highlight />
            ) : (
              <MoneyRow label="법원 비용·실비" value="계약서 본문 참고" />
            )}
          </dl>

          {feeSchedule.length > 0 ? (
            <details className="group mt-3 rounded-xl border border-slate-200">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 text-sm font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
                <span>납부 일정 {feeSchedule.length}회</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ol className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
                {feeSchedule.map((inst, i) => (
                  <li key={inst.id || i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0 break-keep">
                      <span className="font-bold text-slate-800">{inst.itemTitle || `${inst.round || i + 1}회차`}</span>
                      {inst.dueDate && <span className="ml-2 text-slate-600">{formatDateKo(inst.dueDate)}</span>}
                    </span>
                    <span className="shrink-0 font-bold text-slate-900">{formatWon(installmentWon(inst))}</span>
                  </li>
                ))}
              </ol>
            </details>
          ) : (
            <p className="mt-3 text-sm text-slate-600 break-keep">납부 일정은 계약서 본문을 확인해 주세요.</p>
          )}

          {contract.feeAccount?.accountNumber && (
            <AccountRow
              label={contract.sameAsFeeAccount ? '수임료·실비 입금 계좌' : '수임료 입금 계좌'}
              account={contract.feeAccount}
            />
          )}
          {!contract.sameAsFeeAccount && contract.courtCostAccount?.accountNumber && (
            <AccountRow label="법원 비용·실비 입금 계좌" account={contract.courtCostAccount} />
          )}
        </Card>

        <Card as="section" padded={false} className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">계약 문서 {includedDocs.length}종</h2>
            <span className="text-sm font-bold text-slate-600">
              {includedDocs.length - unreadCount}/{includedDocs.length} 읽음
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 break-keep">문서를 누르면 전체 내용을 크게 볼 수 있어요.</p>
          <ul className="mt-3 space-y-2">
            {includedDocs.map(d => {
              const read = readDocIds.includes(d.id);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => openDoc(d.id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand/40 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 break-keep">{d.title}</span>
                      {(d.requiredConfirmationText || '').trim() && (
                        <span className="mt-0.5 block text-xs text-slate-600">직접 입력할 확인 문구가 있어요</span>
                      )}
                    </span>
                    {read ? (
                      <Badge tone="success" icon={<Check className="h-3 w-3" aria-hidden="true" />}>읽음</Badge>
                    ) : (
                      <span className="shrink-0 text-sm font-bold text-brand">읽기</span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );

  const renderTerms = () => (
    <>
      <SignStepHeading
        ref={headingRef}
        title="필수 항목에 동의해 주세요"
        description="계약을 맺으려면 아래 4개 항목에 모두 동의해야 해요. [전문]을 누르면 항목마다 전체 내용을 볼 수 있어요."
      />
      <div className="space-y-3">
        <label
          className={cn(
            'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-colors',
            allAgreed ? 'border-brand bg-brand-light' : 'border-slate-200 bg-white hover:bg-slate-50',
          )}
        >
          <input
            type="checkbox"
            checked={allAgreed}
            onChange={e => {
              const v = e.target.checked;
              setAgree({ legalEffect: v, privacy: v, thirdParty: v, procedure: v });
            }}
            className="h-5 w-5 shrink-0 cursor-pointer accent-brand"
          />
          <span className="flex-1 text-base font-bold text-slate-900">모두 동의해요</span>
          <span className="text-sm font-bold text-slate-600" aria-hidden="true">
            {agreedCount}/{TERM_ORDER.length}
          </span>
        </label>

        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {TERM_ORDER.map(key => {
            const t = TERM_COPY[key];
            const invalid = termsAttempted && !agree[key];
            return (
              <li key={key} className="flex items-start gap-1 py-2 pl-4 pr-2">
                <label htmlFor={`sign-term-${key}`} className="flex min-h-11 flex-1 cursor-pointer items-start gap-3 py-1.5">
                  <input
                    id={`sign-term-${key}`}
                    type="checkbox"
                    checked={agree[key]}
                    onChange={e => setAgree(a => ({ ...a, [key]: e.target.checked }))}
                    aria-invalid={invalid || undefined}
                    aria-describedby={`sign-term-${key}-desc`}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 break-keep">
                      {t.title} <span className="text-red-700">(필수)</span>
                    </span>
                    <span id={`sign-term-${key}-desc`} className="mt-0.5 block text-sm leading-relaxed text-slate-600 break-keep">
                      {t.desc}
                    </span>
                  </span>
                </label>
                <Button
                  variant="ghost"
                  className="shrink-0 px-3 text-brand"
                  onClick={() => setReader({ kind: 'term', key })}
                  aria-label={`${t.title} 전문 보기`}
                >
                  전문
                </Button>
              </li>
            );
          })}
        </ul>
        {termsAttempted && !allAgreed && (
          <p role="alert" className="text-sm font-bold text-red-700">
            동의하지 않은 항목이 {TERM_ORDER.length - agreedCount}개 있어요.
          </p>
        )}
      </div>
    </>
  );

  const renderIdentity = () => (
    <>
      <SignStepHeading
        ref={headingRef}
        title="본인인증"
        description="계약하는 분이 본인인지 확인해요. 본인 명의 휴대폰으로 인증해 주세요."
      />
      <div className="space-y-4">
        {verified ? (
          <Card as="section" padded={false} className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden="true">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900">본인인증을 마쳤어요</p>
                <p className="mt-0.5 text-sm text-slate-700 break-keep">
                  {idv?.name ? `${idv.name}님` : '인증 완료'}
                  {idv?.providerName ? ` · ${idv.providerName}` : ''}
                </p>
                {identityNote && <p className="mt-2 text-sm text-slate-600 break-keep">{identityNote}</p>}
              </div>
            </div>
          </Card>
        ) : (
          <Card as="section" padded={false} className="p-5">
            <h2 className="text-base font-bold text-slate-900">이렇게 진행돼요</h2>
            <ol className="mt-3 space-y-2.5 text-sm text-slate-700">
              <StepListItem n={1}>아래 [본인인증 하기]를 누르면 인증 창이 열려요.</StepListItem>
              <StepListItem n={2}>인증 창의 안내에 따라 본인 명의 휴대폰으로 인증해 주세요.</StepListItem>
              <StepListItem n={3}>인증을 마치면 다음 단계로 넘어갈 수 있어요.</StepListItem>
            </ol>
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 break-keep">
              {isRealNameConversion
                ? '지금 계약서에는 스텔스 가명이 적혀 있어요. 인증을 마치면 인증한 실명으로 계약서가 작성돼요.'
                : '인증한 이름과 휴대폰 번호가 계약서의 위임인 정보와 같아야 서명할 수 있어요.'}
            </p>
          </Card>
        )}
        {identityError && (
          <div ref={alertRef} role="alert">
            <Callout tone="danger" title="본인인증을 마치지 못했어요">
              <p className="break-keep">{identityError}</p>
              {identityMismatch && (
                <p className="mt-1 break-keep">이름이나 휴대폰 번호가 바뀌었다면 담당 변호사 사무실에 계약서 정보 수정을 요청해 주세요.</p>
              )}
            </Callout>
          </div>
        )}

        {/* 본인인증 곤란 시 방문/우편 서면계약 전환 안내 (회생·파산 의뢰인 배려) */}
        {!verified && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900">본인 명의 휴대폰 인증이 어려우신가요?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed break-keep">
                  채무 연체, 통신사 일시정지, 타인명의 폰 사용 등으로 전자 인증이 어려우신 경우, <span className="font-semibold text-slate-800">사무소 내방(방문)</span> 또는 <span className="font-semibold text-slate-800">우편(등기)</span>으로 종이 계약서에 서명하실 수 있습니다.
                </p>
              </div>
            </div>

            {offlineReqDone ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span><strong>{offlineReqDone}</strong> 전환 요청이 정상 접수되었습니다. 담당 사무소에서 확인 후 연락드립니다.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOfflineReqType('in_person')}
                  className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer press-scale"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>방문 체결 요청</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOfflineReqType('postal')}
                  className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer press-scale"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>우편 등기 요청</span>
                </button>
                {(contract?.lawyerPhone || contract?.lawFirmPhone) && (
                  <a
                    href={`tel:${contract.lawyerPhone || contract.lawFirmPhone}`}
                    className="col-span-2 sm:col-span-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <PhoneCall className="h-3.5 w-3.5 text-slate-500" />
                    <span>사무소 전화</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  const renderConfirm = () => (
    <>
      <SignStepHeading
        ref={headingRef}
        title="중요 조항을 확인해 주세요"
        description="중요한 조항을 확인했다는 뜻으로, 문서마다 정해진 문구를 그대로 입력해 주세요. 띄어쓰기까지 같아야 해요."
      />
      <div className="space-y-4">
        {confirmationDocs.map(doc => {
          const target = (doc.requiredConfirmationText || '').trim();
          const val = userConfirmations[doc.id] || '';
          const typedLen = val.trim().length;
          const ok = isConfirmationOk(doc);
          const invalid = confirmAttempted && !ok;
          const inputId = `sign-confirm-${doc.id}`;
          return (
            <Card key={doc.id} as="section" padded={false} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 break-keep">{doc.title}</h2>
                {ok ? (
                  <Badge tone="success" icon={<Check className="h-3 w-3" aria-hidden="true" />}>일치</Badge>
                ) : (
                  <Badge tone={invalid ? 'danger' : 'neutral'}>{typedLen === 0 ? '입력 전' : '확인 필요'}</Badge>
                )}
              </div>
              <p className="mt-3 text-xs font-bold text-slate-600">입력할 문구</p>
              <p
                id={`${inputId}-target`}
                className="mt-1 select-none rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base font-bold leading-relaxed text-amber-950 break-keep"
              >
                {target}
              </p>
              <label htmlFor={inputId} className="mt-4 block text-sm font-bold text-slate-800">
                위 문구를 그대로 입력해 주세요
              </label>
              <input
                id={inputId}
                type="text"
                value={val}
                onChange={e => setUserConfirmations(prev => ({ ...prev, [doc.id]: e.target.value }))}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={invalid || undefined}
                aria-describedby={`${inputId}-target ${inputId}-status`}
                className={cn(inputClass, 'mt-1.5', ok && 'border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/20')}
              />
              <p
                id={`${inputId}-status`}
                className={cn('mt-1.5 text-sm', ok ? 'font-bold text-emerald-700' : invalid ? 'font-bold text-red-700' : 'text-slate-600')}
              >
                {ok
                  ? '문구가 일치해요.'
                  : typedLen === 0
                    ? `${target.length}자를 입력해 주세요.`
                    : `아직 문구가 달라요. (${typedLen}/${target.length}자)`}
              </p>
              <span className="sr-only" aria-live="polite">
                {ok ? `${doc.title} 문구가 일치해요.` : ''}
              </span>
              <button
                type="button"
                onClick={() => openDoc(doc.id)}
                className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-bold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                문서에서 보기
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );

  const renderSign = () => (
    <>
      <SignStepHeading
        ref={headingRef}
        title="서명해 주세요"
        description={
          lawyerAlreadySigned
            ? '담당 변호사는 이미 서명했어요. 서명을 제출하면 계약이 바로 체결돼요.'
            : '서명을 제출한 뒤 담당 변호사가 서명하면 계약이 체결돼요.'
        }
      />
      <div className="space-y-4">
        <Card as="section" padded={false} className="p-5">
          <h2 className="text-base font-bold text-slate-900">{signerName}님 서명</h2>
          {signatureData ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
                <img src={signatureData} alt={`${signerName}님 서명`} className="h-24 max-w-full object-contain" />
              </div>
              <Button
                ref={signButtonRef}
                variant="secondary"
                fullWidth
                onClick={() => setPadOpen(true)}
                leftIcon={<PenLine className="h-4 w-4" aria-hidden="true" />}
              >
                다시 서명하기
              </Button>
            </div>
          ) : (
            <>
              <button
                ref={signButtonRef}
                type="button"
                onClick={() => setPadOpen(true)}
                aria-describedby={signAttempted ? 'sign-pad-required' : undefined}
                className={cn(
                  'mt-3 flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-slate-50 px-4 text-slate-700 transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  signAttempted ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <PenLine className="h-7 w-7" aria-hidden="true" />
                <span className="text-base font-bold">눌러서 서명하기</span>
                <span className="text-sm text-slate-600">넓은 화면에서 서명할 수 있어요</span>
              </button>
              {signAttempted && (
                <p id="sign-pad-required" role="alert" className="mt-2 text-sm font-bold text-red-700">
                  먼저 서명을 넣어 주세요.
                </p>
              )}
            </>
          )}
        </Card>

        <Card as="section" padded={false} className="p-5">
          <h2 className="text-base font-bold text-slate-900">제출 전 확인</h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            <CheckRow
              done
              label={`계약 문서 ${includedDocs.length}종`}
              detail={unreadCount > 0 ? `${unreadCount}개는 아직 열어 보지 않았어요` : '모두 열어 봤어요'}
            />
            <CheckRow done={allAgreed} label={`필수 동의 ${TERM_ORDER.length}개`} />
            <CheckRow done={verified} label="본인인증" detail={idv?.name ? `${idv.name}님` : undefined} />
            {confirmationDocs.length > 0 && (
              <CheckRow done={allConfirmationsMatch} label={`확인 문구 ${confirmationDocs.length}개`} />
            )}
            <CheckRow done={!!signatureData} label="서명" />
          </ul>
        </Card>

        {submitError && (
          <div ref={alertRef} role="alert">
            <Callout tone="danger" title="서명을 제출하지 못했어요">
              <p className="break-keep">{submitError}</p>
            </Callout>
          </div>
        )}

        <p className="text-sm leading-relaxed text-slate-600 break-keep">
          제출한 뒤에는 이 링크로 서명을 다시 제출할 수 없어요. 양쪽 서명이 끝나면 계약서 내용과 서명으로 전자지문(SHA-256)을 만들어, 나중에 내용이 바뀌었는지 확인할 수 있게 해요.
        </p>
      </div>
    </>
  );

  // ── 하단 액션 바 ──
  const nextButton = (
    <Button size="lg" className="flex-1" onClick={goNext} rightIcon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}>
      다음
    </Button>
  );
  let primary: React.ReactNode = nextButton;
  if (stepKey === 'identity' && !verified) {
    primary = (
      <Button
        size="lg"
        className="flex-1"
        onClick={handleIdentityVerification}
        loading={verifying}
        leftIcon={<Smartphone className="h-4 w-4" aria-hidden="true" />}
      >
        {verifying ? '인증 진행 중' : '본인인증 하기'}
      </Button>
    );
  } else if (stepKey === 'sign') {
    primary = (
      <Button
        size="lg"
        className="flex-1"
        onClick={() => {
          setSubmitError(null);
          if (!signatureData) {
            setSignAttempted(true);
            signButtonRef.current?.focus();
            return;
          }
          setConfirmOpen(true);
        }}
        leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
      >
        서명 제출하기
      </Button>
    );
  }
  const footerNote =
    stepKey === 'review' && unreadCount > 0 ? (
      <p className="text-xs text-slate-600 break-keep">아직 열어 보지 않은 문서가 {unreadCount}개 있어요. 서명 전에 한 번씩 읽어 보시길 권해요.</p>
    ) : null;

  const footer = (
    <SignFooter note={footerNote}>
      {safeIdx > 0 && (
        <Button
          variant="secondary"
          size="lg"
          className="shrink-0 px-4"
          onClick={goBack}
          disabled={verifying || submitting}
          leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
        >
          이전
        </Button>
      )}
      {primary}
    </SignFooter>
  );

  // ── 리더 하단 버튼 ──
  let readerFooter: React.ReactNode = null;
  if (reader?.kind === 'doc') {
    readerFooter = (
      <Button className="w-full sm:w-auto" onClick={() => setReader(null)}>
        확인했어요
      </Button>
    );
  } else if (reader?.kind === 'term') {
    const key = reader.key;
    readerFooter = agree[key] ? (
      <Button className="w-full sm:w-auto" onClick={() => setReader(null)}>
        닫기
      </Button>
    ) : (
      <>
        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setReader(null)}>
          닫기
        </Button>
        <Button
          className="flex-1 sm:flex-none"
          leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}
          onClick={() => {
            setAgree(a => ({ ...a, [key]: true }));
            setReader(null);
          }}
        >
          동의하기
        </Button>
      </>
    );
  }

  return (
    <>
      <SignPage
        header={<SignHeader firmName={contract.lawFirmName} steps={steps.map(k => STEP_LABEL[k])} current={safeIdx} />}
        footer={footer}
      >
        {stepKey === 'review' && renderReview()}
        {stepKey === 'terms' && renderTerms()}
        {stepKey === 'identity' && renderIdentity()}
        {stepKey === 'confirm' && renderConfirm()}
        {stepKey === 'sign' && renderSign()}
      </SignPage>

      <SignDocReader doc={readerDoc} onClose={() => setReader(null)} footer={readerFooter} />

      <SignaturePadModal
        open={padOpen}
        onClose={() => setPadOpen(false)}
        signerName={signerName}
        onComplete={sig => {
          setSignatureData(sig);
          setSignAttempted(false);
          setSubmitError(null);
          setPadOpen(false);
        }}
      />

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="서명을 제출할까요?"
        description={
          lawyerAlreadySigned
            ? '담당 변호사가 이미 서명해, 제출하면 계약이 바로 체결돼요.'
            : '제출하면 담당 변호사가 서명한 뒤 계약이 체결돼요.'
        }
        size="sm"
        mobile="center"
        dismissible={!submitting}
        hideCloseButton={submitting}
        footer={
          <>
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              다시 확인
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              onClick={handleSubmitSignature}
              loading={submitting}
              leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}
            >
              {submitting ? '제출하는 중' : '제출하기'}
            </Button>
          </>
        }
      >
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">위임인</dt>
            <dd className="font-bold text-slate-900">{contract.clientName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">수임인</dt>
            <dd className="text-right font-bold text-slate-900 break-keep">
              {[contract.lawFirmName, contract.lawyerName ? `${contract.lawyerName} 변호사` : ''].filter(Boolean).join(' · ')}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-600">서명할 문서</dt>
            <dd className="font-bold text-slate-900">{includedDocs.length}종</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 break-keep">
          문서마다 같은 서명이 들어가요. 제출한 뒤에는 이 링크로 서명을 다시 제출할 수 없어요.
        </p>
      </Modal>
    </>
  );
}

/* ── 작은 표시 부품 ── */

function PartyItem({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-base font-bold text-slate-900 break-keep">{value}</dd>
      {sub && <dd className="mt-0.5 text-sm text-slate-600 break-keep">{sub}</dd>}
    </div>
  );
}

function MoneyRow({
  label,
  value,
  sub,
  strong,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className={cn('min-w-0 break-keep', highlight ? 'font-bold text-slate-900' : 'text-slate-600')}>
        {label}
        {sub && <span className="mt-0.5 block text-xs text-slate-600">{sub}</span>}
      </dt>
      <dd className={cn('shrink-0 text-right', strong ? 'text-base font-extrabold' : 'font-bold', highlight ? 'text-brand' : 'text-slate-900')}>
        {value}
      </dd>
    </div>
  );
}

function AccountRow({ label, account }: { label: string; account: BankAccountInfo }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${account.bankName} ${account.accountNumber}`);
      toast.success('계좌번호를 복사했어요.');
    } catch {
      toast.error('복사하지 못했어요. 계좌번호를 길게 눌러 직접 복사해 주세요.');
    }
  };
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-600">{label}</p>
        <p className="mt-0.5 text-sm font-bold text-slate-900 break-all">
          {account.bankName} {account.accountNumber}
        </p>
        {account.accountHolder && <p className="text-xs text-slate-600">예금주 {account.accountHolder}</p>}
      </div>
      <Button
        variant="secondary"
        className="shrink-0 px-3.5"
        onClick={handleCopy}
        leftIcon={<Copy className="h-4 w-4" aria-hidden="true" />}
        aria-label={`${label} 복사`}
      >
        복사
      </Button>
    </div>
  );
}

function StepListItem({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand" aria-hidden="true">
        {n}
      </span>
      <span className="break-keep leading-relaxed">{children}</span>
    </li>
  );
}

function CheckRow({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5">
      {done ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      )}
      <span className="min-w-0 break-keep">
        <span className="sr-only">{done ? '완료: ' : '남음: '}</span>
        <span className={cn('font-bold', done ? 'text-slate-900' : 'text-slate-600')}>{label}</span>
        {detail && <span className="ml-1.5 text-slate-600">{detail}</span>}
      </span>
    </li>
  );
}
