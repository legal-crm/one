import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { DialogProvider } from './components/common/DialogProvider';
import { 
  loadConsultRequests, 
  saveConsultRequest, 
  saveAllConsultRequests, 
  loadConsultMessages, 
  saveConsultMessage, 
  saveAllConsultMessages, 
  migrateAnonymousRequests,
  setConsultSyncContext
} from './services/consultService';
import { 
  mockLawyers, 
  initialConsultRequests as SEED_CONSULT_REQUESTS, 
  mockTestProposals as SEED_TEST_PROPOSALS,
  initialConsultMessages as SEED_CONSULT_MESSAGES, 
  initialCases as SEED_CASES,
  mockNewsArticles,
  initialQAs,
  initialReviews,
  initialBanners,
  initialNotices,
  initialMembers,
  initialActivityLogs,
  initialInquiries,
  initialPlatformConfig,
  initialPopupConfig,
  initialLawyerInquiries
} from './data';
import { ConsultRequest, ConsultMessage, Case, User as LawyerType, NewsArticle, ClientQA, SuccessReview, MainBanner, Notice, Member, ActivityLog, MemberRole, ClientInquiry, LawyerInquiry, PlatformConfig, PopupConfig } from './types';
const ClientRole = React.lazy(() => import('./components/ClientRole'));
const LawyerRole = React.lazy(() => import('./components/LawyerRole'));
const AdminRole = React.lazy(() => import('./components/AdminRole'));
const HoneypotAdminLogin = React.lazy(() => import('./components/admin/HoneypotAdminLogin'));
import { ShieldCheck, Info, Sparkles, Scale, RefreshCw, Lock, AlertCircle, Shield } from 'lucide-react';
import { openSharedReport } from './services/sharedReportService';
import SharedReportViewer from './components/client/SharedReportViewer';
// 원격 전자서명(?view=sign)은 문자 링크로만 여는 독립 화면이라 첫 화면 번들에서 뺀다
const ClientRemoteSignView = React.lazy(() => import('./components/client/ClientRemoteSignView'));
import UnregisteredLawyerDocViewer from './components/client/UnregisteredLawyerDocViewer';
import ContractPublicVerifierModal from './components/common/ContractPublicVerifierModal';
import { getContract } from './services/contractService';
import type { ElectronicContract } from './types';
import { secureGetItem, secureSetItem } from './utils/secureStorage';
import { ADMIN_PORTAL_PATH, isAdminPortalRole, readAdminMarker } from './utils/adminPortal';
import { recordMemberActivity, sanitizeActivityDetails } from './services/platformActivityService';
import { useLawyerProfileSync } from './hooks/useLawyerProfileSync';

// [SECURITY] 관리자 포털 경로는 utils/adminPortal.ts (VITE_ADMIN_SECRET_PATH, 운영 미설정 시 비활성).
// 뻔한 ?role=admin은 허니팟으로 유인. 실제 인가는 서버(JWT role=admin + MFA aal2)가 판정.

// ── 시연용 시드 (DEV 전용) ──
// 운영 빌드에서는 가상 상담 요청(req-mock-*, req-amjone-*)·가상 제안서·가상 사건을 주입하지 않는다.
// (이전에는 모든 브라우저에 주입되어 변호사 CRM에 실제 의뢰인처럼 표시되고 DB로 동기화됐으며,
//  테스트 변호사를 선택한 실제 의뢰인 요청에 가짜 제안서가 자동으로 붙었음)
const initialConsultRequests: ConsultRequest[] = import.meta.env.DEV ? SEED_CONSULT_REQUESTS : [];
const mockTestProposals = import.meta.env.DEV ? SEED_TEST_PROPOSALS : [];
const initialConsultMessages: ConsultMessage[] = import.meta.env.DEV ? SEED_CONSULT_MESSAGES : [];
const initialCases: Case[] = import.meta.env.DEV ? SEED_CASES : [];
const SEED_REQUEST_IDS = new Set(SEED_CONSULT_REQUESTS.map(r => r.id));
const SEED_CASE_IDS = new Set(SEED_CASES.map(c => c.id));
/** 운영 환경에서 과거에 저장된 시연 데이터 식별 */
const isProdSeedRequest = (id: string) => import.meta.env.PROD && SEED_REQUEST_IDS.has(id);
const isProdSeedCase = (id: string) => import.meta.env.PROD && SEED_CASE_IDS.has(id);

// [PART 3-2] 가상 회원 18명·가상 활동 로그 16건(가짜 IP·가짜 상담 대화)도 DEV 전용.
// (이전: 운영 관리자 대시보드의 회원 수·가입 채널·전환율·활동 피드에 그대로 섞여 표시됨)
const SEED_MEMBERS: Member[] = import.meta.env.DEV ? initialMembers : [];
const SEED_ACTIVITY_LOGS: ActivityLog[] = import.meta.env.DEV ? initialActivityLogs : [];
// 운영 번들에 시드 본문(가짜 이메일·전화·대화)이 포함되지 않도록 ID만 명시 (data.ts initialMembers / initialActivityLogs)
const SEED_MEMBER_IDS = new Set([
  'lawyer-1', 'lawyer-2', 'lawyer-3', 'staff-1', 'lawyer-4', 'lawyer-5', 'lawyer-ex-1', 'lawyer-ex-2',
  'client-1', 'client-2', 'client-3', 'client-4', 'client-5', 'client-today-1', 'client-today-2',
  'client-withdrawn-1', 'client-withdrawn-2', 'client-dormant-1',
]);
const SEED_LOG_IDS = new Set(Array.from({ length: 16 }, (_, i) => `log-${i + 1}`));
// 시연용 샘플 변호사 ID — DB에 없는 샘플 프로필은 lawyers 테이블로 올리지 않는다
const SEED_LAWYER_IDS: ReadonlySet<string> = new Set(mockLawyers.map(l => l.id));
const stripProdSeedMembers = (list: Member[]): Member[] =>
  import.meta.env.PROD ? list.filter(m => m && !SEED_MEMBER_IDS.has(m.id)) : list;
const stripProdSeedLogs = (list: ActivityLog[]): ActivityLog[] =>
  import.meta.env.PROD ? list.filter(l => l && !SEED_LOG_IDS.has(l.id)) : list;

/** [SECURITY] 로컬 저장소·시드에서 과거 평문 비밀번호 필드를 제거 (변호사 인증은 Supabase Auth 전용) */
function stripLawyerSecrets(list: LawyerType[]): LawyerType[] {
  return list.map(l => {
    if (!l || typeof l !== 'object' || !('password' in l)) return l;
    const { password: _drop, ...rest } = l as LawyerType & { password?: unknown };
    return rest as LawyerType;
  });
}

export default function App() {
  // Quad role state: 'client' | 'lawyer' | 'admin' | 'honeypot'
  // 1순위: URL 쿼리 파라미터, 2순위: 활성 세션 감지 (새로고침 시 홈페이지 플래시 방지)
  const [currentRole, setCurrentRole] = useState<'client' | 'lawyer' | 'admin' | 'honeypot'>(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'admin') return 'honeypot'; // [SECURITY] 공격자/봇은 가짜 허니팟으로 유인

    // [SECURITY Zero-Trust] 관리자 경로 진입 (하드코딩된 예비 경로 2종 제거, 환경변수 값만 허용)
    // 진입 후 AdminRole이 서버에서 관리자 권한·MFA를 확인한다.
    if (isAdminPortalRole(roleParam)) return 'admin';

    if (roleParam === 'lawyer') return 'lawyer';
    if (roleParam) return 'client';

    // URL에 role 파라미터가 없을 때 → 활성 세션으로 역할 복원
    try {
      if (sessionStorage.getItem('legal_crm_lawyer_session')) return 'lawyer';
      // 표시용 마커(30분 이내 활동)만 확인 — 권한은 AdminRole이 서버에서 다시 확인
      if (ADMIN_PORTAL_PATH && readAdminMarker()) return 'admin';
    } catch {}

    return 'client';
  });

  // Share report viewer states (URL에서 즉시 읽어 플래시 방지)
  const [sharePayload, setSharePayload] = useState<string | null>(() => {
    // 신규 링크는 #share= (fragment는 서버·액세스 로그·Referer로 전송되지 않음), 기존 ?share= 링크도 호환
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('share');
    return fromHash || new URLSearchParams(window.location.search).get('share');
  });
  const [docShareToken, setDocShareToken] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('docShare');
  });
  const [unlockedData, setUnlockedData] = useState<{ result: any; userInput: any } | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState('');
  const [shareLocked, setShareLocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // 모바일 원격 전자서명 뷰 파라미터 감지 (?view=sign&cid=...&token=...)
  const [signParams] = useState<{ cid: string; token: string } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'sign' && params.get('cid')) {
      return {
        cid: params.get('cid') || '',
        token: params.get('token') || '',
      };
    }
    return null;
  });

  // 블록체인 공공 원본 검증 URL 파라미터 감지 (?verifyContractId=... 또는 ?verify=...)
  const [verifyContractId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('verifyContractId') || params.get('verify') || null;
  });
  const [verifiedContract, setVerifiedContract] = useState<ElectronicContract | null>(null);
  const [showPublicVerifyModal, setShowPublicVerifyModal] = useState(false);

  // 고객용 화면(고객 셸·원격 서명·공유 리포트)은 라이트 고정 + 고객 타이포 스케일 적용 (index.css CLIENT SURFACE SCOPE)
  // body에 붙여야 포털로 띄우는 모달까지 같은 규칙을 받는다.
  const isClientSurface = !docShareToken && (currentRole === 'client' || !!signParams?.cid || !!sharePayload);
  useEffect(() => {
    const classes = ['client-light', 'client-scale'];
    if (isClientSurface) document.body.classList.add(...classes);
    else document.body.classList.remove(...classes);
  }, [isClientSurface]);

  useEffect(() => {
    if (verifyContractId) {
      // 찾지 못하면 이전에는 아무 안내 없이 첫 화면만 보였다
      const notFound = () => toast.error('검증할 계약서를 찾지 못했어요. QR 코드나 링크 주소를 다시 확인해 주세요.');
      getContract(verifyContractId)
        .then(c => {
          if (c) {
            setVerifiedContract(c);
            setShowPublicVerifyModal(true);
          } else {
            notFound();
          }
        })
        .catch(notFound);
    }
  }, [verifyContractId]);

  useEffect(() => {
    // [FLASH 방지] index.html의 전체 화면 로더를 페이드아웃 후 제거
    const appLoader = document.getElementById('app-loader');
    if (appLoader) {
      appLoader.style.opacity = '0';
      setTimeout(() => appLoader.remove(), 200);
    }

    // [보안 정화] localStorage에 남아있는 모든 Supabase 세션 및 청크 토큰 정리
    // sessionStorage로 전환했으므로 localStorage의 세션 데이터는 전수 소각
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (_) { /* silent */ }

    // OAuth 리다이렉트 후 URL에 남는 #access_token=... 또는 ?code=... 또는 빈 # 제거
    const hasHashToken = window.location.hash && (
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('error') ||
      window.location.hash.includes('refresh_token')
    );
    const hasSearchCode = window.location.search && (
      window.location.search.includes('code=') ||
      window.location.search.includes('error=')
    );

    if (hasHashToken || hasSearchCode) {
      // Supabase가 토큰 또는 authorization code를 파싱/교환할 수 있도록 2초 대기 후 URL 정화
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.hash = '';
        window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
      }, 2000);
    } else if (window.location.hash) {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Share/Role parameter detection은 useState 초기화에서 동기적으로 처리됨 (플래시 방지)
  }, []);

  // [SECURITY] 검색엔진 봇 차단 동적 메타태그 (제주항공 검색엔진 노출 사태 방지)
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const isPrivate = currentRole !== 'client' || Boolean(sharePayload) || Boolean(signParams) || window.location.search.includes('share=') || window.location.search.includes('reqId=') || window.location.search.includes('view=sign');
    if (isPrivate) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'robots';
        document.head.appendChild(meta);
      }
      meta.content = 'noindex, nofollow, noarchive, nosnippet';
    } else {
      if (meta) {
        meta.content = 'index, follow';
      }
    }
  }, [currentRole, sharePayload, signParams]);

  const handleUnlock = async () => {
    if (pin.length !== 6 || !sharePayload || shareLocked || isUnlocking) return;
    setIsUnlocking(true);
    try {
      // 서버에서 PIN 검증 (5회 실패 시 링크 잠금) 후 브라우저에서 복호화
      const res = await openSharedReport(sharePayload, pin);
      if (res.ok === true) {
        setUnlockedData((res as Extract<typeof res, { ok: true }>).data);
        setPinError(false);
        setPinErrorMessage('');
        return;
      }
      const fail = res as Extract<typeof res, { ok: false }>;
      const messages: Record<string, string> = {
        wrong_pin: `비밀번호가 일치하지 않습니다. (남은 시도 ${fail.remaining ?? 0}회)`,
        locked: '비밀번호 입력 횟수를 초과해 링크가 잠겼습니다. 보낸 분께 새 링크를 요청해 주세요.',
        not_found: '존재하지 않거나 만료된 링크입니다.',
        legacy: '보안이 강화되어 이전 형식의 링크는 열 수 없습니다. 보낸 분께 새 링크를 요청해 주세요.',
        error: '보고서를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      };
      if (fail.reason === 'locked' || fail.reason === 'legacy' || fail.reason === 'not_found') setShareLocked(true);
      setPinErrorMessage(messages[fail.reason] || messages.error);
      setPinError(true);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPin('');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRedirectToSelfDiagnosis = () => {
    // Clear URL parameter and reset view states
    window.history.replaceState({}, document.title, window.location.pathname);
    setSharePayload(null);
    setUnlockedData(null);
    setCurrentRole('client');
  };

  // ── Helper: Smart merge for consult requests (preserves mock edits & incoming data) ──
  const mergeConsultRequests = React.useCallback((existingList: ConsultRequest[], incomingList: ConsultRequest[] = []): ConsultRequest[] => {
    const map = new Map<string, ConsultRequest>();

    // 1. Base mock requests
    initialConsultRequests.forEach(mock => {
      map.set(mock.id, { ...mock });
    });

    // 2. Apply existing requests (preserves user actions on mocks or created ones)
    existingList.forEach(item => {
      const mockBase = map.get(item.id);
      if (mockBase) {
        map.set(item.id, {
          ...mockBase,
          ...item,
          financialProfile: {
            ...mockBase.financialProfile,
            ...(item.financialProfile || {}),
          },
          proposals: item.proposals && item.proposals.length > 0 ? item.proposals : mockBase.proposals,
          acceptedLawyerIds: item.acceptedLawyerIds && item.acceptedLawyerIds.length > 0 ? item.acceptedLawyerIds : mockBase.acceptedLawyerIds,
          status: item.status || mockBase.status,
        });
      } else {
        // 동적으로 생성된 요청 중, 테스트 변호사 5 또는 6에게 요청을 보낸 상태(또는 proposals가 비어있는 대기 상태)인 경우
        // 테스트 5변호사(AI 정밀 진단형)와 테스트 6변호사(직접 검토형)의 가상 제안서를 자동 연동
        const hasTestLawyerRequested = item.selectedLawyerIds?.some(id => id === 'test-lawyer-5' || id === 'test-lawyer-6');
        const shouldInjectTestProposals = import.meta.env.DEV && hasTestLawyerRequested && (!item.proposals || item.proposals.length === 0);

        map.set(item.id, {
          ...item,
          proposals: shouldInjectTestProposals ? mockTestProposals : item.proposals,
          status: shouldInjectTestProposals ? 'comparing' : item.status,
        });
      }
    });

    // 3. Apply incoming DB requests
    incomingList.forEach(item => {
      const existing = map.get(item.id);
      if (existing) {
        const mergedProposals = (existing.proposals?.length || 0) > (item.proposals?.length || 0)
          ? existing.proposals
          : (item.proposals || existing.proposals);
        const mergedAcceptedLawyerIds = Array.from(new Set([
          ...(existing.acceptedLawyerIds || []),
          ...(item.acceptedLawyerIds || [])
        ]));
        map.set(item.id, {
          ...existing,
          ...item,
          proposals: mergedProposals,
          acceptedLawyerIds: mergedAcceptedLawyerIds,
          status: existing.status !== 'requested' && item.status === 'requested' ? existing.status : (item.status || existing.status),
        });
      } else {
        map.set(item.id, item);
      }
    });

    return Array.from(map.values()).filter(r => r.id !== 'req-1' && r.id !== 'req-2' && r.id !== 'req-3' && !isProdSeedRequest(r.id));
  }, []);

  // ── Helper: Smart merge for messages ──
  const mergeConsultMessages = React.useCallback((existingList: ConsultMessage[], incomingList: ConsultMessage[] = []): ConsultMessage[] => {
    const map = new Map<string, ConsultMessage>();
    existingList.forEach(m => map.set(m.id, m));
    incomingList.forEach(m => {
      const prev = map.get(m.id);
      // 서버 행에는 대상 변호사(targetLawyerId) 칸이 없다. 이 기기에서 만든 메시지의 대상 정보를 유지해야
      // 비교 상담 중 보낸 메시지가 5초 동기화 뒤 사라지거나 다른 변호사 탭에 섞이지 않는다.
      // 서버에서 온 행이 들어오면 전송 상태(deliveryStatus)는 자연히 지워진다(= 전송 완료).
      map.set(m.id, prev?.targetLawyerId && !m.targetLawyerId ? { ...m, targetLawyerId: prev.targetLawyerId } : m);
    });
    return Array.from(map.values())
      .filter(m => m.consultRequestId !== 'req-1' && m.consultRequestId !== 'req-2' && m.consultRequestId !== 'req-3' && !isProdSeedRequest(m.consultRequestId))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, []);

  // Core application states
  // Initial load from localStorage (instant)
  const [requests, _setRequests] = useState<ConsultRequest[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_requests');
      if (saved) {
        const parsed = JSON.parse(saved).filter((r: any) => 
          r.id !== 'req-1' && r.id !== 'req-2' && r.id !== 'req-3'
        );
        return mergeConsultRequests(parsed);
      }
    } catch {}
    return initialConsultRequests;
  });

  const setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>> = React.useCallback((action) => {
    _setRequests(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try { secureSetItem('legal_crm_requests', JSON.stringify(next)); } catch {}
      saveAllConsultRequests(next).catch(() => {});
      return next;
    });
  }, []);

  // DB 쓰기 권한 경로를 현재 역할에 맞춤 (의뢰인: 본인 행 / 변호사: RPC / 관리자: 전체)
  useEffect(() => {
    const actorId = currentRole === 'lawyer' ? sessionStorage.getItem('legal_crm_lawyer_session') : null;
    setConsultSyncContext(currentRole, actorId);
  }, [currentRole]);

  const [messages, _setMessages] = useState<ConsultMessage[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_messages');
      if (saved) {
        return JSON.parse(saved)
          .filter((m: any) => m.consultRequestId !== 'req-1' && m.consultRequestId !== 'req-2' && m.consultRequestId !== 'req-3' && !isProdSeedRequest(m.consultRequestId))
          // 보내는 도중 창을 닫은 메시지는 실패로 보여 '다시 보내기'를 할 수 있게 한다
          .map((m: ConsultMessage) => (m.deliveryStatus === 'sending' ? { ...m, deliveryStatus: 'failed' as const } : m));
      }
    } catch {}
    return [];
  });

  // Async load from Supabase + 5초 간격 폴링 동기화 (역할 및 본인 세션에 한정하여 BOLA 원천 차단)
  useEffect(() => {
    let isMounted = true;

    const syncFromDb = async () => {
      try {
        let dbRequests: ConsultRequest[] = [];
        
        if (currentRole === 'client') {
          // [ANTI-BOLA] 의뢰인은 본인의 상담 요청만 조회
          const currentClientId = secureGetItem('legal_crm_client_id') || 'client-temp';
          dbRequests = await loadConsultRequests({ clientId: currentClientId });
        } else if (currentRole === 'lawyer') {
          // [ANTI-BOLA] 변호사는 본인에게 배정된 상담 + 신규 오픈 상담만 조회
          const lawyerId = sessionStorage.getItem('legal_crm_lawyer_session') || undefined;
          dbRequests = await loadConsultRequests({ lawyerId, includeOpen: true });
        } else if (currentRole === 'admin') {
          // [ANTI-BOLA] 관리자 화면이 활성일 때만 조회 — 실제 반환 범위는 RLS(is_platform_admin: role=admin AND aal2)가 결정
          if (readAdminMarker()) {
            dbRequests = await loadConsultRequests({ isAdmin: true });
          }
        }

        if (!isMounted) return;

        // 상담 메시지는 현재 사용자에게 인가된 상담 요청 ID들에 한해서만 로드
        const reqIds = dbRequests.map(r => r.id);
        const dbMessages = reqIds.length > 0 ? await loadConsultMessages(reqIds) : [];
        if (!isMounted) return;

        if (dbRequests.length > 0) {
          _setRequests(prev => {
            const merged = mergeConsultRequests(prev, dbRequests);
            try { secureSetItem('legal_crm_requests', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
        if (dbMessages.length > 0) {
          _setMessages(prev => {
            const merged = mergeConsultMessages(prev, dbMessages);
            try { secureSetItem('legal_crm_messages', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      } catch {}
    };

    // 초기 로드
    syncFromDb();

    // 5초 간격 폴링 (변호사 ↔ 고객 실시간 동기화)
    const intervalId = setInterval(syncFromDb, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [mergeConsultRequests, mergeConsultMessages, currentRole]);

  const setMessages: React.Dispatch<React.SetStateAction<ConsultMessage[]>> = React.useCallback((action) => {
    _setMessages(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try { secureSetItem('legal_crm_messages', JSON.stringify(next)); } catch {}
      saveAllConsultMessages(next).catch(() => {});
      return next;
    });
  }, []);
  const [cases, setCases] = useState<Case[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_cases');
      return saved ? (JSON.parse(saved) as Case[]).filter(c => !isProdSeedCase(c.id)) : initialCases;
    } catch {
      return initialCases;
    }
  });
  const [lawyers, setLawyers] = useState<LawyerType[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_lawyers');
      if (saved) {
        const parsed: LawyerType[] = JSON.parse(saved);
        if (parsed.length >= mockLawyers.length) {
          return stripLawyerSecrets(parsed);
        }
      }
    } catch {}
    return stripLawyerSecrets(mockLawyers);
  });
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_members');
      return saved ? stripProdSeedMembers(JSON.parse(saved)) : SEED_MEMBERS;
    } catch {
      return SEED_MEMBERS;
    }
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    try {
      const saved = secureGetItem('legal_crm_activity_logs');
      return saved ? stripProdSeedLogs(JSON.parse(saved)) : SEED_ACTIVITY_LOGS;
    } catch {
      return SEED_ACTIVITY_LOGS;
    }
  });
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>(() => {
    const savedNews = secureGetItem('legal_crm_news');
    return savedNews ? JSON.parse(savedNews) : mockNewsArticles;
  });

  const [qas, setQas] = useState<ClientQA[]>(() => {
    const saved = secureGetItem('legal_crm_qas');
    if (saved) {
      const parsed: ClientQA[] = JSON.parse(saved);
      const existingIds = new Set(parsed.map(q => q.id));
      const newEntries = initialQAs.filter(q => !existingIds.has(q.id));
      return newEntries.length > 0 ? [...parsed, ...newEntries] : parsed;
    }
    return initialQAs;
  });

  const [reviews, setReviews] = useState<SuccessReview[]>(() => {
    const saved = secureGetItem('legal_crm_reviews');
    if (!saved) return initialReviews;
    try {
      const parsed: SuccessReview[] = JSON.parse(saved);
      // 예전 기본 데이터(rev-1~rev-20: 결과 수치가 들어간 가상 후기)가 저장돼 있으면 걷어내고 절차 예시로 대체
      const LEGACY_SEED_REVIEW_ID = /^rev-([1-9]|1\d|20)$/;
      const cleaned = Array.isArray(parsed) ? parsed.filter(r => !LEGACY_SEED_REVIEW_ID.test(r.id)) : [];
      if (cleaned.length === 0) return initialReviews;
      return cleaned;
    } catch {
      return initialReviews;
    }
  });

  const [banners, setBanners] = useState<MainBanner[]>(() => {
    const saved = secureGetItem('legal_crm_banners');
    return saved ? JSON.parse(saved) : initialBanners;
  });

  const [notices, setNotices] = useState<Notice[]>(() => {
    const saved = secureGetItem('legal_crm_notices');
    return saved ? JSON.parse(saved) : initialNotices;
  });

  const [matchingCooldownHours, setMatchingCooldownHours] = useState<number>(() => {
    const saved = secureGetItem('legal_crm_matching_cooldown_hours');
    return saved ? Number(saved) : 24;
  });

  const [inquiries, setInquiries] = useState<ClientInquiry[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(() => {
    const saved = secureGetItem('legal_crm_platform_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          companyRepresentative: initialPlatformConfig.companyRepresentative,
          companyBusinessNumber: initialPlatformConfig.companyBusinessNumber,
          companyAddress: initialPlatformConfig.companyAddress,
          termsOfService: initialPlatformConfig.termsOfService,
          privacyPolicy: initialPlatformConfig.privacyPolicy,
        };
      } catch (e) {
        return initialPlatformConfig;
      }
    }
    return initialPlatformConfig;
  });

  const [popupConfig, setPopupConfig] = useState<PopupConfig>(() => {
    const saved = secureGetItem('legal_crm_popup_config');
    return saved ? JSON.parse(saved) : initialPopupConfig;
  });

  // 시연용 변호사 문의(가상 변호사 '김민수'·'이서연')는 DEV에서만 — 운영에서는 과거 저장분도 제거
  const [lawyerInquiries, setLawyerInquiries] = useState<LawyerInquiry[]>(() => {
    const seedIds = new Set(initialLawyerInquiries.map(i => i.id));
    const saved = secureGetItem('legal_crm_lawyer_inquiries');
    if (saved) {
      try {
        const parsed: LawyerInquiry[] = JSON.parse(saved);
        return import.meta.env.PROD ? parsed.filter(i => !seedIds.has(i.id)) : parsed;
      } catch { /* 손상된 저장값은 무시 */ }
    }
    return import.meta.env.DEV ? initialLawyerInquiries : [];
  });

  // Sync states to localStorage
  useEffect(() => {
    secureSetItem('legal_crm_news', JSON.stringify(newsArticles));
  }, [newsArticles]);

  useEffect(() => {
    secureSetItem('legal_crm_qas', JSON.stringify(qas));
  }, [qas]);

  useEffect(() => {
    secureSetItem('legal_crm_reviews', JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    secureSetItem('legal_crm_banners', JSON.stringify(banners));
  }, [banners]);

  useEffect(() => {
    secureSetItem('legal_crm_notices', JSON.stringify(notices));
  }, [notices]);

  useEffect(() => {
    secureSetItem('legal_crm_matching_cooldown_hours', String(matchingCooldownHours));
  }, [matchingCooldownHours]);

  useEffect(() => {
    if (inquiries.length > 0) {
      secureSetItem('legal_crm_inquiries', JSON.stringify(inquiries));
    }
  }, [inquiries]);

  useEffect(() => {
    secureSetItem('legal_crm_platform_config', JSON.stringify(platformConfig));
  }, [platformConfig]);

  useEffect(() => {
    secureSetItem('legal_crm_popup_config', JSON.stringify(popupConfig));
  }, [popupConfig]);

  useEffect(() => {
    secureSetItem('legal_crm_lawyer_inquiries', JSON.stringify(lawyerInquiries));
  }, [lawyerInquiries]);

  // Load state from localStorage on startup or fallback to initial mock data.
  useEffect(() => {
    const savedCases = secureGetItem('legal_crm_cases');
    const savedLawyers = secureGetItem('legal_crm_lawyers');
    const savedMembers = secureGetItem('legal_crm_members');
    const savedLogs = secureGetItem('legal_crm_activity_logs');

    // requests와 messages는 lazy initializer에서 이미 로드됨

    if (savedCases) {
      setCases((JSON.parse(savedCases) as Case[]).filter(c => !isProdSeedCase(c.id)));
    } else {
      setCases(initialCases);
    }

    if (savedLawyers && JSON.parse(savedLawyers).length >= mockLawyers.length) {
      const parsed: LawyerType[] = JSON.parse(savedLawyers);
      setLawyers(stripLawyerSecrets(parsed));
    } else {
      setLawyers(stripLawyerSecrets(mockLawyers));
    }

    if (savedMembers) {
      setMembers(stripProdSeedMembers(JSON.parse(savedMembers)));
    } else {
      setMembers(SEED_MEMBERS);
    }

    if (savedLogs) {
      setActivityLogs(stripProdSeedLogs(JSON.parse(savedLogs)));
    } else {
      setActivityLogs(SEED_ACTIVITY_LOGS);
    }

    // [PART 3-6] 시연 문의('파란고래_38' 등)는 DEV 전용. 실제 문의는 관리자 화면이 서버(/api/inquiry admin-list)에서 불러온다
    const seedInquiryIds = new Set(['inquiry-1', 'inquiry-2']); // data.ts initialInquiries (운영 번들에 본문 미포함)
    const savedInquiries = secureGetItem('legal_crm_inquiries');
    if (savedInquiries) {
      const parsed: ClientInquiry[] = JSON.parse(savedInquiries);
      setInquiries(import.meta.env.PROD ? parsed.filter(i => !seedInquiryIds.has(i.id)) : parsed);
    } else {
      setInquiries(import.meta.env.DEV ? initialInquiries : []);
    }
  }, []);


  // requests/messages는 setRequests/setMessages 래퍼에서 즉시 동기 저장됨

  useEffect(() => {
    if (cases.length > 0) {
      secureSetItem('legal_crm_cases', JSON.stringify(cases));
    }
  }, [cases]);

  useEffect(() => {
    if (lawyers.length > 0) {
      secureSetItem('legal_crm_lawyers', JSON.stringify(lawyers));
    }
  }, [lawyers]);

  // 변호사 프로필 DB 동기화 (localStorage는 오프라인 캐시로만 사용)
  useLawyerProfileSync({ lawyers, setLawyers, currentRole, seedIds: SEED_LAWYER_IDS });

  useEffect(() => {
    if (members.length > 0) {
      secureSetItem('legal_crm_members', JSON.stringify(members));
    }
  }, [members]);

  useEffect(() => {
    if (activityLogs.length > 0) {
      secureSetItem('legal_crm_activity_logs', JSON.stringify(activityLogs));
    }
  }, [activityLogs]);

  // 메시지 한 건의 화면 상태만 바꾼다 (서버 전체 재동기화 없이 기기 저장만)
  const patchMessageLocal = React.useCallback((id: string, patch: Partial<ConsultMessage>) => {
    _setMessages(prev => {
      const next = prev.map(m => (m.id === id ? { ...m, ...patch } : m));
      try { secureSetItem('legal_crm_messages', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Method to add customized chat messages
  // @returns 서버 저장까지 끝났으면 true. 의뢰인 대화 메시지는 전송 상태(보내는 중/실패)를 말풍선에 표시한다.
  const handleAddMessage = (
    reqId: string, 
    text: string, 
    sender: 'client' | 'lawyer' | 'system', 
    senderId: string, 
    name: string,
    targetLawyerId?: string
  ): Promise<boolean> => {
    const tracksDelivery = sender === 'client' && senderId !== 'system';
    const newMessage: ConsultMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      consultRequestId: reqId,
      senderType: sender,
      senderId,
      senderName: name,
      message: text,
      createdAt: new Date().toISOString(),
      ...(targetLawyerId ? { targetLawyerId } : {}),
      ...(tracksDelivery ? { deliveryStatus: 'sending' as const } : {}),
    };
    setMessages(prev => mergeConsultMessages(prev, [newMessage]));
    const delivery = saveConsultMessage(newMessage)
      .catch(() => false)
      .then(ok => {
        if (tracksDelivery) patchMessageLocal(newMessage.id, { deliveryStatus: ok ? undefined : 'failed' });
        return ok;
      });

    // Update the corresponding request status to active 'counseling' & preserve acceptedLawyerIds
    const isActualChat = (sender === 'client' && senderId !== 'system') || (sender === 'lawyer' && senderId !== 'system');
    setRequests(prev => prev.map(req => {
      if (req.id === reqId) {
        const accepted = req.acceptedLawyerIds || [];
        const isLawyerSender = sender === 'lawyer' && senderId && senderId !== 'system';
        const updatedAccepted = isLawyerSender && !accepted.includes(senderId) ? [...accepted, senderId] : accepted;
        return {
          ...req,
          acceptedLawyerIds: updatedAccepted,
          status: (isActualChat && (req.status === 'requested' || req.status === 'responding')) ? 'counseling' : req.status
        };
      }
      return req;
    }));
    return delivery;
  };

  // 전송 실패한 메시지를 같은 id로 다시 보낸다 (이미 서버에 있으면 그대로 두고 성공 처리)
  const handleRetryMessage = (messageId: string): Promise<boolean> => {
    const target = messages.find(m => m.id === messageId);
    if (!target) return Promise.resolve(false);
    patchMessageLocal(messageId, { deliveryStatus: 'sending' });
    return saveConsultMessage(target)
      .catch(() => false)
      .then(ok => {
        patchMessageLocal(messageId, { deliveryStatus: ok ? undefined : 'failed' });
        return ok;
      });
  };

  // Log activity helper
  const handleLogActivity = (
    memberId: string,
    memberName: string,
    role: MemberRole,
    action: ActivityLog['action'],
    details: string
  ) => {
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      memberId,
      memberName,
      role,
      action,
      details: sanitizeActivityDetails(action, details),
      // 브라우저는 자신의 공인 IP를 알 수 없음 — IP는 서버 기록(audit_logs, 021 트리거)에만 남는다
      // (이전: 121.138.45.x 난수로 만든 가짜 IP를 저장·표시)
      ipAddress: '',
      createdAt: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev.slice(0, 199)]); // 이 브라우저 기록은 최근 200건
    recordMemberActivity(newLog);
  };

  // Reset entire database to default mock
  const handleResetData = () => {
    if (confirm('모든 입력 데이터를 기동 초기값으로 리셋하시겠습니까?')) {
      localStorage.removeItem('legal_crm_requests');
      localStorage.removeItem('legal_crm_messages');
      localStorage.removeItem('legal_crm_cases');
      localStorage.removeItem('legal_crm_lawyers');
      localStorage.removeItem('legal_crm_news');
      localStorage.removeItem('legal_crm_qas');
      localStorage.removeItem('legal_crm_reviews');
      localStorage.removeItem('legal_crm_banners');
      localStorage.removeItem('legal_crm_notices');
      localStorage.removeItem('legal_crm_matching_cooldown_hours');
      localStorage.removeItem('legal_crm_members');
      localStorage.removeItem('legal_crm_activity_logs');
      localStorage.removeItem('legal_crm_inquiries');
      localStorage.removeItem('legal_crm_platform_config');
      localStorage.removeItem('legal_crm_popup_config');
      setRequests(initialConsultRequests);
      setMessages(initialConsultMessages);

      saveAllConsultRequests(initialConsultRequests).catch(() => {});
      saveAllConsultMessages(initialConsultMessages).catch(() => {});

      setCases(initialCases);
      setMembers(SEED_MEMBERS);
      setActivityLogs(SEED_ACTIVITY_LOGS);
      window.location.reload();
    }
  };

  // 모바일 원격 전자서명 뷰 렌더링 (?view=sign&cid=...&token=...)
  if (signParams && signParams.cid) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <React.Suspense
          fallback={<div className="min-h-dvh bg-slate-50" role="status" aria-label="계약서 화면을 불러오는 중이에요" />}
        >
          <ClientRemoteSignView cid={signParams.cid} token={signParams.token} />
        </React.Suspense>
      </>
    );
  }

  // 변호사·사무장 서류 패키지 모바일 열람 모드 (?docShare=TOKEN)
  if (docShareToken) {
    return (
      <UnregisteredLawyerDocViewer
        token={docShareToken}
        onLawyerRegistered={(lawyerId) => {
          setDocShareToken(null);
          setCurrentRole('lawyer');
          const cleanUrl = window.location.pathname + '?role=lawyer';
          window.history.replaceState({}, document.title, cleanUrl);
        }}
        onNavigateHome={() => {
          setDocShareToken(null);
          window.history.replaceState({}, document.title, window.location.pathname);
          setCurrentRole('client');
        }}
      />
    );
  }

  // Share mode conditional rendering
  if (sharePayload) {
    if (unlockedData) {
      return (
        <SharedReportViewer 
          result={unlockedData.result}
          userInput={unlockedData.userInput}
          onStartSelfDiagnosis={handleRedirectToSelfDiagnosis}
        />
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        {/* Shaking & unlock css inject */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
            20%, 40%, 60%, 80% { transform: translateX(6px); }
          }
          .shake-input {
            animation: shake 0.4s ease-in-out;
          }
        `}</style>

        <div className={`w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-lg flex flex-col items-center text-center space-y-5 ${isShaking ? 'shake-input' : ''}`}>
          <div className="p-4 bg-brand-light text-brand rounded-2xl">
            <Lock className="w-8 h-8" aria-hidden="true" />
          </div>
          
          <div className="space-y-2">
            <h1 className="font-extrabold text-lg text-slate-900">비밀번호로 보호된 채무 정리 리포트</h1>
            <p className="text-sm text-slate-600 leading-relaxed px-2 break-keep">
              리포트를 공유한 분에게 받은 <strong className="text-slate-900">숫자 6자리 비밀번호</strong>를 입력해 주세요.
            </p>
          </div>

          <div className="w-full space-y-3">
            <input 
              type="password"
              maxLength={6}
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, ''));
                if (pinError && !shareLocked) setPinError(false);
              }}
              disabled={shareLocked}
              placeholder="••••••"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="보고서 비밀번호 6자리"
              aria-invalid={pinError || undefined}
              className={`w-full text-center text-3xl tracking-[0.6em] font-bold py-3.5 border-2 ${
                pinError ? 'border-red-500 bg-red-50 focus:border-red-600' : 'border-slate-300 bg-white focus:border-brand'
              } rounded-xl outline-none transition-colors placeholder:text-slate-400 text-slate-900`}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />

            {pinError && (
              <div role="alert" className="flex items-start gap-1.5 justify-center text-red-700 text-[13px] font-bold">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{pinErrorMessage || '비밀번호가 일치하지 않습니다.'}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleUnlock}
            disabled={pin.length !== 6 || shareLocked || isUnlocking}
            className="w-full min-h-12 py-3.5 bg-brand hover:bg-brand-hover disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {isUnlocking ? '확인 중...' : shareLocked ? '열 수 없는 링크입니다' : '보고서 잠금 해제하기'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <DialogProvider>
      <div className="flex flex-col min-h-screen text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-500 selection:text-white">
        
        {/* Role View Render */}
        <div className="flex-1">
          <React.Suspense fallback={
            <div className="flex flex-col min-h-screen bg-slate-50 items-center justify-center p-4">
              <div className="w-full max-w-md bg-white border border-slate-200 shadow-xl rounded-3xl p-8 space-y-6 text-center animate-pulse">
                <div className="flex items-center justify-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-200"></div>
                  <div className="h-6 w-36 bg-slate-200 rounded-lg"></div>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="h-10 bg-slate-100 rounded-2xl"></div>
                  <div className="h-12 bg-slate-200/70 rounded-xl"></div>
                  <div className="h-12 bg-slate-100 rounded-xl"></div>
                </div>
                <p className="text-xs text-slate-400 font-medium pt-1">보안 포털 로딩 중...</p>
              </div>
            </div>
          }>
            {currentRole === 'honeypot' ? (
              <HoneypotAdminLogin />
            ) : currentRole === 'client' ? (
              <ClientRole 
                requests={requests}
                setRequests={setRequests}
                messages={messages}
                setMessages={setMessages}
                lawyers={lawyers}
                onAddMessage={handleAddMessage}
                onRetryMessage={handleRetryMessage}
                newsArticles={newsArticles}
                setNewsArticles={setNewsArticles}
                qas={qas}
                setQas={setQas}
                reviews={reviews}
                setReviews={setReviews}
                banners={banners}
                setBanners={setBanners}
                notices={notices}
                setNotices={setNotices}
                matchingCooldownHours={matchingCooldownHours}
                members={members}
                setMembers={setMembers}
                onLogActivity={handleLogActivity}
                platformConfig={platformConfig}
                inquiries={inquiries}
                setInquiries={setInquiries}
                popupConfig={popupConfig}
                lawyerInquiries={lawyerInquiries}
                setLawyerInquiries={setLawyerInquiries}
              />
            ) : currentRole === 'lawyer' ? (
              <LawyerRole 
                requests={requests}
                setRequests={setRequests}
                messages={messages}
                setMessages={setMessages}
                lawyers={lawyers}
                setLawyers={setLawyers}
                onAddMessage={handleAddMessage}
                cases={cases}
                setCases={setCases}
                members={members}
                setMembers={setMembers}
                onLogActivity={handleLogActivity}
                platformConfig={platformConfig}
                qas={qas}
                setQas={setQas}
                popupConfig={popupConfig}
                lawyerInquiries={lawyerInquiries}
                setLawyerInquiries={setLawyerInquiries}
                notices={notices}
              />
            ) : (
              <AdminRole 
                requests={requests}
                setRequests={setRequests}
                lawyers={lawyers}
                setLawyers={setLawyers}
                newsArticles={newsArticles}
                setNewsArticles={setNewsArticles}
                qas={qas}
                setQas={setQas}
                reviews={reviews}
                setReviews={setReviews}
                banners={banners}
                setBanners={setBanners}
                notices={notices}
                setNotices={setNotices}
                matchingCooldownHours={matchingCooldownHours}
                setMatchingCooldownHours={setMatchingCooldownHours}
                members={members}
                setMembers={setMembers}
                activityLogs={activityLogs}
                setActivityLogs={setActivityLogs}
                onLogActivity={handleLogActivity}
                platformConfig={platformConfig}
                setPlatformConfig={setPlatformConfig}
                inquiries={inquiries}
                setInquiries={setInquiries}
                popupConfig={popupConfig}
                setPopupConfig={setPopupConfig}
                lawyerInquiries={lawyerInquiries}
                setLawyerInquiries={setLawyerInquiries}
              />
            )}
          </React.Suspense>
        </div>

        <Toaster position="top-center" richColors closeButton />

        {/* 블록체인 공공 원본 검증기 (QR 스캔 또는 URL 직접 접근) */}
        <ContractPublicVerifierModal
          isOpen={showPublicVerifyModal}
          onClose={() => setShowPublicVerifyModal(false)}
          contract={verifiedContract}
        />
      </div>
    </DialogProvider>
  );
}

