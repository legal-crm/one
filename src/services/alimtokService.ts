import { 
  AlimtokMilestone, AlimtokLog, ALIMTOK_MILESTONE_CONFIG, 
  STATUS_TO_MILESTONE, CrmStatus, FeeNotificationSettings, 
  FeeAutoNotificationRule, FeeInstallment 
} from '../types';
import { addClientNotification } from './clientNotificationService';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

function logSupabaseError(op: string, error: any) {
  console.error(`[Alimtok] ${op} 실패:`, error?.message || error);
}

const FEE_SETTINGS_KEY = 'fee_notification_settings';

// ── 1. 기본 템플릿 변수 렌더러 ──

export const renderTemplate = (milestone: AlimtokMilestone, vars: Record<string, string>): string => {
  const config = ALIMTOK_MILESTONE_CONFIG[milestone];
  if (!config) return '';
  let template = config.template;
  for (const [key, value] of Object.entries(vars)) {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return template;
};

export interface SendAlimtokOptions {
  receiverName?: string;
  customText?: string;
  altSubject?: string;
  altContent?: string;
  buttons?: Array<{ name: string; url: string; urlPc?: string; urlMobile?: string }>;
  sender?: string;
  templateCode?: string;
}

export interface SendAlimtokResult {
  ok: boolean;
  mock?: boolean;
  channel?: 'alimtalk' | 'lms_fallback' | 'sms_fallback' | 'mock_alimtalk';
  receiptNum?: string;
  sentAt?: string;
  notice?: string;
  error?: string;
  rendered: string;
}

// ── 2. 알림톡 발송 (실제 API 또는 모의 발송) ──

export const sendAlimtok = async (
  phone: string, 
  milestone: AlimtokMilestone, 
  vars: Record<string, string>,
  customTextOrOptions?: string | SendAlimtokOptions
): Promise<SendAlimtokResult> => {
  const options: SendAlimtokOptions = typeof customTextOrOptions === 'string'
    ? { customText: customTextOrOptions }
    : (customTextOrOptions || {});

  const customText = options.customText;
  const rendered = customText !== undefined && customText.trim() !== '' 
    ? customText 
    : renderTemplate(milestone, vars);

  try {
    const response = await fetch('/api/alimtok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        phone, 
        receiverName: options.receiverName || vars.clientName || '',
        template: rendered, 
        customText,
        milestone, 
        templateCode: options.templateCode,
        altSubject: options.altSubject || `[my김변] ${ALIMTOK_MILESTONE_CONFIG[milestone]?.label || '안내'}`,
        altContent: options.altContent || rendered,
        sender: options.sender,
        buttons: options.buttons,
        vars 
      }),
    });

    if (response.status === 429) {
      const errData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: errData.error || '알림톡 발송 요청 한도를 초과하여 일시 차단되었습니다. 잠시 후 다시 시도해 주세요.',
        sentAt: new Date().toISOString(),
        rendered
      };
    }

    if (response.status === 404) {
      return { 
        ok: true, 
        mock: true, 
        channel: 'mock_alimtalk',
        receiptNum: `MOCK-${Date.now()}`,
        sentAt: new Date().toISOString(),
        rendered 
      };
    }

    const data = await response.json();
    return { 
      ok: data.ok !== undefined ? data.ok : response.ok, 
      mock: data.mock,
      channel: data.channel,
      receiptNum: data.receiptNum,
      sentAt: data.sentAt,
      notice: data.notice,
      error: data.error, 
      rendered 
    };
  } catch (error: any) {
    // 네트워크 실패나 개발환경 데모 모드 지원
    return { 
      ok: true, 
      mock: true, 
      channel: 'mock_alimtalk',
      receiptNum: `MOCK-${Date.now()}`,
      sentAt: new Date().toISOString(),
      rendered 
    };
  }
};

// ── 3. 알림 로그 관리 ──

export const loadAlimtokLogs = async (clientId: string): Promise<AlimtokLog[]> => {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('alimtok_logs').select('*').eq('client_id', clientId).order('sent_at', { ascending: false });
      if (error) logSupabaseError('loadAlimtokLogs', error);
      else if (data) return data.map((r: any) => ({
        id: r.id, milestone: r.milestone, clientName: r.client_name, phone: r.phone,
        sentAt: r.sent_at, status: r.status, errorMessage: r.error_message,
      }));
    } catch (e) { logSupabaseError('loadAlimtokLogs (exception)', e); }
  }
  try {
    const raw = localStorage.getItem(`alimtok_logs_${clientId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveAlimtokLog = async (clientId: string, log: AlimtokLog) => {
  try {
    const logs = await loadAlimtokLogs(clientId);
    logs.unshift(log);
    if (logs.length > 50) logs.splice(50);
    localStorage.setItem(`alimtok_logs_${clientId}`, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save alimtok log', e);
  }
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('alimtok_logs').upsert({
        id: log.id, client_id: clientId, client_name: log.clientName || '',
        phone: log.phone || '', milestone: log.milestone, status: log.status || 'sent',
        error_message: log.errorMessage || '', sent_at: log.sentAt || new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) logSupabaseError('saveAlimtokLog', error);
    } catch (e) { logSupabaseError('saveAlimtokLog (exception)', e); }
  }
};

// ── 4. 수임료 스마트 알림 설정 (기본값 및 로드/저장) ──

export const getDefaultFeeNotificationSettings = (): FeeNotificationSettings => ({
  autoTriggerEnabled: true,
  rules: [
    {
      id: 'rule-upcoming',
      enabled: true,
      type: 'upcoming',
      milestone: 'fee_upcoming',
      daysOffset: -3,
      sendTime: '10:00',
      label: 'D-3 납부 사전 안내',
    },
    {
      id: 'rule-due',
      enabled: true,
      type: 'due',
      milestone: 'fee_due',
      daysOffset: 0,
      sendTime: '09:30',
      label: '당일 납부 리마인드',
    },
    {
      id: 'rule-overdue',
      enabled: true,
      type: 'overdue',
      milestone: 'fee_overdue',
      daysOffset: 1,
      sendTime: '11:00',
      label: '1차 연체 미납 안내',
    },
    {
      id: 'rule-final',
      enabled: false,
      type: 'final_warning',
      milestone: 'fee_overdue',
      daysOffset: 3,
      sendTime: '14:00',
      label: '2차 연체 독촉 고지',
    },
  ],
  bankInfo: {
    bankName: '신한은행',
    accountNumber: '110-542-897612',
    accountHolder: '법무법인 로앤',
  },
  sendReceiptOnPaid: true,
});

export const loadFeeNotificationSettings = (): FeeNotificationSettings => {
  try {
    const raw = localStorage.getItem(FEE_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getDefaultFeeNotificationSettings(), ...parsed };
    }
  } catch { /* ignore */ }
  return getDefaultFeeNotificationSettings();
};

export const saveFeeNotificationSettings = (settings: FeeNotificationSettings) => {
  try {
    localStorage.setItem(FEE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save fee notification settings', e);
  }
};

// ── 5. 수임료 전용 알림 발송 헬퍼 (수동/자동 공용) ──

export interface SendFeeAlimtokParams {
  clientId: string;
  clientName: string;
  phone: string;
  firmName: string;
  lawyerName: string;
  milestone: AlimtokMilestone;
  installment: FeeInstallment;
  remainingFeeManwon?: number;
  bankInfo?: { bankName: string; accountNumber: string; accountHolder: string };
  trackingUrl?: string;
  customMessage?: string;
}

export const sendFeeAlimtok = async (params: SendFeeAlimtokParams): Promise<{ ok: boolean; rendered: string; error?: string }> => {
  const settings = loadFeeNotificationSettings();
  const bank = params.bankInfo || settings.bankInfo;
  const bankAccountStr = `${bank.bankName} ${bank.accountNumber} (예금주: ${bank.accountHolder})`;

  // 금액 변환: 만원 단위인 경우 원 단위로 변환 표시 (100 -> 1,000,000)
  const amountWon = params.installment.amount >= 10000 
    ? params.installment.amount 
    : params.installment.amount * 10000;
  
  const remainingWon = (params.remainingFeeManwon || 0) * 10000;

  // D-Day 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(params.installment.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = diffDays > 0 ? String(diffDays) : '0';

  const vars: Record<string, string> = {
    firmName: params.firmName || '법무법인',
    lawyerName: params.lawyerName || '담당 변호사',
    clientName: params.clientName,
    feeRound: params.installment.memo || `${params.installment.round}차 분납`,
    feeAmount: amountWon.toLocaleString(),
    dueDate: params.installment.dueDate,
    paidDate: params.installment.paidDate || new Date().toISOString().split('T')[0],
    remainingFee: remainingWon.toLocaleString(),
    bankAccount: bankAccountStr,
    daysLeft,
    trackingUrl: params.trackingUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/my`,
  };

  const res = await sendAlimtok(params.phone, params.milestone, vars, params.customMessage);

  // 알림 로그 저장
  const log: AlimtokLog = {
    id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    milestone: params.milestone,
    clientName: params.clientName,
    phone: params.phone,
    sentAt: new Date().toISOString(),
    status: res.ok ? 'sent' : 'failed',
    errorMessage: res.error,
  };
  saveAlimtokLog(params.clientId, log);

  // 의뢰인 마이페이지 인앱 알림 동시 적재
  try {
    const config = ALIMTOK_MILESTONE_CONFIG[params.milestone];
    addClientNotification({
      type: 'fee_reminder',
      title: `[수임료 안내] ${config.label}`,
      body: `${params.installment.memo || params.installment.round + '차 분납'} (${amountWon.toLocaleString()}원) 안내가 발송되었습니다.`,
      emoji: config.emoji,
      linkTab: 'fees',
    });
  } catch { /* ignore */ }

  return { ok: res.ok, rendered: res.rendered, error: res.error };
};

// ── 6. CRM 단계 변경 시 기존 자동 알림 ──

export const triggerAlimtokOnStatusChange = async (
  prevStatus: CrmStatus,
  newStatus: CrmStatus,
  clientData: { clientName: string; phone: string; firmName: string; lawyerName: string },
  settings: { autoTrigger: boolean; enabledMilestones: AlimtokMilestone[] }
) => {
  const milestone = STATUS_TO_MILESTONE[newStatus];
  if (!milestone) return false;

  if (settings.autoTrigger && settings.enabledMilestones.includes(milestone)) {
    const vars = {
      clientName: clientData.clientName,
      firmName: clientData.firmName,
      lawyerName: clientData.lawyerName,
      date: new Date().toLocaleDateString('ko-KR'),
      trackingUrl: '#',
    };
    const { ok, error } = await sendAlimtok(clientData.phone, milestone, vars);
    
    const log: AlimtokLog = {
      id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      milestone,
      clientName: clientData.clientName,
      phone: clientData.phone,
      sentAt: new Date().toISOString(),
      status: ok ? 'sent' : 'failed',
      errorMessage: error,
    };
    
    saveAlimtokLog(clientData.clientName, log);
    return ok;
  }
  return false;
};

// ── 7. 팝빌 알림톡 서버 연동 상태 확인 ──

export interface PopbillServerStatus {
  ok: boolean;
  configured: boolean;
  isTest?: boolean;
  corpNum?: string;
  userId?: string;
  plusFriendId?: string;
  senderPhone?: string;
  balance?: number;
  partnerBalance?: number;
  channelStatus?: string;
  statusMessage?: string;
  senders?: string[];
  plusFriends?: Array<{ plusFriendID: string; state: string }>;
  templates?: Array<{ templateCode: string; templateName: string; template?: string }>;
  error?: string;
}

export const checkAlimtokServerStatus = async (): Promise<PopbillServerStatus> => {
  try {
    const res = await fetch('/api/alimtok?action=status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      ok: false,
      configured: false,
      error: err.message || '상태 조회 실패',
      statusMessage: '로컬/서버리스 환경 상태 확인 불가',
      balance: 0,
      templates: []
    };
  }
};

// ── 8. 관리자/변호사용 실시간 단독 테스트 발송 ──

export const testSendAlimtok = async (params: {
  phone: string;
  receiverName?: string;
  text: string;
  milestone?: AlimtokMilestone;
  sender?: string;
}): Promise<SendAlimtokResult> => {
  try {
    const response = await fetch('/api/alimtok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: params.phone,
        receiverName: params.receiverName || '테스트 수신자',
        template: params.text,
        customText: params.text,
        milestone: params.milestone || 'general_announcement',
        sender: params.sender,
      }),
    });
    const data = await response.json();
    return {
      ok: data.ok,
      mock: data.mock,
      channel: data.channel,
      receiptNum: data.receiptNum,
      sentAt: data.sentAt,
      notice: data.notice,
      error: data.error,
      rendered: params.text,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || '테스트 발송 요청 실패',
      rendered: params.text,
    };
  }
};

// ── 9. 통합 관리자용 전사 알림톡 발송 이력 조회 ──

export const loadAllPlatformAlimtokLogs = async (): Promise<AlimtokLog[]> => {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('alimtok_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(200);
      if (error) logSupabaseError('loadAllPlatformAlimtokLogs', error);
      else if (data && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          milestone: r.milestone,
          clientName: r.client_name,
          phone: r.phone,
          sentAt: r.sent_at,
          status: r.status,
          errorMessage: r.error_message,
        }));
      }
    } catch (e) {
      logSupabaseError('loadAllPlatformAlimtokLogs (exception)', e);
    }
  }

  // 로컬 스토리지 누적 로그 집계 (Mock/로컬 보조)
  try {
    const allLogs: AlimtokLog[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('alimtok_logs_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) allLogs.push(...parsed);
        }
      }
    }
    return allLogs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  } catch {
    return [];
  }
};

// ── 10. 팝빌 등록/승인 카카오 알림톡 템플릿 관리 시스템 ──

export interface PopbillAlimtokTemplate {
  templateCode: string;
  templateName: string;
  template: string;
  state: '승인' | '심사중' | '반려' | '대기';
  stage: number;
  category: string;
  buttons?: Array<{ name: string; type: string; urlMobile?: string; urlPc?: string }>;
  registeredAt?: string;
  reviewedAt?: string;
  memo?: string;
}

export const DEFAULT_POPBILL_TEMPLATES: PopbillAlimtokTemplate[] = [
  // Stage 01: 상담 및 적격 검토
  {
    templateCode: '026090000408',
    templateName: '신청 적격 판정 결과 안내',
    template: `[#{법무법인}] 신청 적격 판정 결과 안내\n\n#{고객명}님, 제출해주신 정보를 검토한 결과 #{사건유형} 신청 적격 요건을 충족하셨습니다.\n\n■ 담당 변호사: #{담당변호사}\n■ 사건 유형: #{사건유형}\n■ 다음 절차: #{다음절차}\n\n아래 링크에서 상세 진단 결과와 향후 절차를 확인하실 수 있습니다.\n▶ 확인 링크: #{안내링크}`,
    state: '승인',
    stage: 1,
    category: '상담·적격',
    buttons: [{ name: '적격 진단결과 확인', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-01',
    reviewedAt: '2026-08-03',
  },
  {
    templateCode: 'MYKIM_ATS_01',
    templateName: '상담 일정 및 준비사항 안내',
    template: `[#{법무법인}] 상담 일정 및 준비사항 안내\n\n#{고객명}님, 정밀 채무 진단을 위한 변호사 상담 일정이 조율되었습니다.\n\n■ 상담 일시: #{상담일시}\n■ 상담 방식: #{상담방식}\n■ 준비 사항: #{준비사항}\n\n원활한 상담을 위해 일정을 확인해 주시기 바랍니다.\n▶ 예약 확인: #{안내링크}`,
    state: '승인',
    stage: 1,
    category: '상담·적격',
    buttons: [{ name: '상담 예약 확인', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-05',
    reviewedAt: '2026-08-07',
  },

  // Stage 02: 계약 체결 및 착수
  {
    templateCode: 'MYKIM_ATS_04',
    templateName: '모바일 전자계약 서명 요청',
    template: `[#{법무법인}] 모바일 전자계약 서명 요청\n\n#{고객명}님, 사건 위임을 위한 모바일 전자계약서가 준비되었습니다.\n\n■ 계약명: #{사건유형} 사건 수임계약\n■ 약정 수임료: #{수임료}\n■ 서명 기한: #{마감기한}\n\n아래 보안 링크에서 대표자 본인인증(PASS/문자) 후 서명을 완료해 주시기 바랍니다.\n▶ 전자서명 링크: #{서명링크}`,
    state: '승인',
    stage: 2,
    category: '계약·착수',
    buttons: [{ name: '1분 간편 전자서명', type: 'WL', urlMobile: 'https://mykim.kr?view=sign', urlPc: 'https://mykim.kr?view=sign' }],
    registeredAt: '2026-08-10',
    reviewedAt: '2026-08-12',
  },
  {
    templateCode: 'MYKIM_ATS_12',
    templateName: '착수금 및 전용 수임료 계좌 안내',
    template: `[#{법무법인}] 착수금 및 입금 전용 계좌 안내\n\n#{고객명}님, 사건 착수를 위한 전용 계좌를 안내해 드립니다.\n\n■ 납부 항목: #{납부항목}\n■ 입금 금액: #{입금금액}\n■ 입금 계좌: #{입금계좌}\n■ 입금 기한: #{마감기한}\n\n입금 확인 후 법원 제출서류 수합이 즉시 진행됩니다.\n▶ 납부 현황 확인: #{안내링크}`,
    state: '승인',
    stage: 2,
    category: '계약·착수',
    buttons: [{ name: '계좌 및 영수증 확인', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-10',
    reviewedAt: '2026-08-12',
  },

  // Stage 03: 고객정보 및 서류수집
  {
    templateCode: 'MYKIM_ATS_05_P1',
    templateName: '[1차] 착수 기본서류 빠른등기 발송 안내',
    template: `[#{법무법인}] 개인회생 신속 착수 [1차 기본서류] 빠른등기 안내\n\n#{고객명}님, 금융기관 부채증명서 발급 대행(약 7일 소요)을 위해 아래 실물 서류를 사무소로 빠른 등기 발송해 주세요.\n\n■ 1차 준비 서류 목록\n1. 주민등록등본 1부 (전체 포함)\n2. 주민등록초본 1부 (주소이력 포함)\n3. 가족관계증명서 1부 (상세)\n4. 혼인관계증명서 1부 (상세)\n5. 신분증 사본 (앞/뒤)\n6. 인감도장 (서명대체 불가)\n7. 인감증명서 #{인감부수} (채권사 #{채권사수}곳 + 5부 / 주민센터 본인발급)\n8. 세목별과세증명서 1부 (최근 5년, 본인/배우자)\n9. 자동차등록원부 갑/을 (차량 소유 시)\n\n📮 등기 발송 주소: #{등기주소}\n수신: #{법무법인} 회생전담팀 앞\n▶ 1차 서류 발급 가이드: #{안내링크}`,
    state: '승인',
    stage: 3,
    category: '서류수집',
    buttons: [{ name: '등기 주소 복사 및 가이드', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-09-10',
    reviewedAt: '2026-09-12',
  },
  {
    templateCode: 'MYKIM_ATS_05_P2',
    templateName: '[2차] 1차 수령 확인 및 부채증명서 발급중 2차 안내',
    template: `[#{법무법인}] 1차 서류 수령 완료 & 2차 서류 간편제출 안내\n\n#{고객명}님, 보내주신 1차 서류(인감 등)가 안전하게 도착하여 각 금융기관 부채증명서 발급(약 7일 소요)에 착수했습니다.\n\n부채증명서가 발급되는 동안 아래 2차 서류를 스마트폰으로 촬영하여 간편하게 업로드해 주시기 바랍니다.\n\n■ 2차 준비 서류\n- 주거래 통장 1년 입출금 거래내역\n- 보험가입내역 및 예상 해약환급금 확인서\n- 건강보험 자격득실확인서 & 납부확인서\n- 지적전산자료(스마트국토정보 무소유증명)\n- 재직증명서 & 최근 6개월 급여명세서\n- 개인회생 진술서 및 임대차계약서\n\n▶ 2차 서류 스마트폰 업로드: #{안내링크}`,
    state: '승인',
    stage: 3,
    category: '서류수집',
    buttons: [{ name: '모바일 2차 서류함 업로드', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-09-10',
    reviewedAt: '2026-09-12',
  },
  {
    templateCode: 'MYKIM_ATS_05_P2R',
    templateName: '[2차] 부채증명서 완료 임박 2차 서류 마감 리마인더',
    template: `[#{법무법인}] ⏰ 부채증명서 발급 완료 임박! 2차 서류 마감 안내\n\n#{고객명}님, 금융기관 부채증명서 발급이 이번 주 중 완료될 예정입니다.\n완료 즉시 법원 회생신청서 및 금지명령을 접수할 수 있도록 미제출 2차 서류(#{미제출건수}건)의 업로드를 부탁드립니다.\n\n■ 미제출 서류: #{미제출서류목록}\n■ 마감 기한: #{마감기한}\n▶ 2차 서류 모바일 즉시 업로드: #{안내링크}`,
    state: '승인',
    stage: 3,
    category: '서류수집',
    buttons: [{ name: '모바일 서류 즉시 제출', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-09-10',
    reviewedAt: '2026-09-12',
  },
  {
    templateCode: 'MYKIM_ATS_05',
    templateName: '미제출 서류 간편발급함 안내 (공통)',
    template: `[#{법무법인}] 필수 서류 간편 발급 안내\n\n#{고객명}님, 법원 제출에 필요한 서류 목록이 모바일 서류함에 업데이트되었습니다.\n\n■ 미제출 서류: #{미제출서류목록}\n■ 제출 마감: #{마감기한}\n\n정부24 및 홈택스 모바일 간편 발급 링크를 통해 스마트폰으로 바로 촬영/업로드해 주시기 바랍니다.\n▶ 모바일 서류함: #{안내링크}`,
    state: '승인',
    stage: 3,
    category: '서류수집',
    buttons: [{ name: '모바일 서류함 바로가기', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-15',
    reviewedAt: '2026-08-17',
  },
  {
    templateCode: 'MYKIM_ATS_05B',
    templateName: '채무경위 진술서 모바일 작성 안내',
    template: `[#{법무법인}] 채무경위 진술서 모바일 작성 안내\n\n#{고객명}님, 법원에 제출할 채무 증대 경위서(진술서) 작성을 요청드립니다.\n\n스마트폰에서 10문 10답 가이드를 따라 간편하게 작성하실 수 있습니다.\n■ 작성 마감: #{마감기한}\n▶ 진술서 작성 링크: #{안내링크}`,
    state: '승인',
    stage: 3,
    category: '서류수집',
    buttons: [{ name: '진술서 간편 작성하기', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-15',
    reviewedAt: '2026-08-17',
  },
  {
    templateCode: 'MYKIM_ATS_05C',
    templateName: '서류 보완(재발급) 요청 안내',
    template: `[#{법무법인}] 서류 보완(재발급) 요청 안내\n\n#{고객명}님, 제출해주신 서류 중 법원 기준에 맞춘 보완이 필요합니다.\n\n■ 대상 서류: #{대상서류}\n■ 보완 사유: #{보완사유}\n■ 마감 기한: #{마감기한}\n\n가족 주민번호 뒷자리 마스킹(******) 여부를 확인하신 후 다시 업로드해 주세요.\n▶ 서류 재업로드: #{안내링크}`,
    state: '승인',
    stage: 3,
    category: '서류수집',
    buttons: [{ name: '서류 재업로드하기', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-20',
    reviewedAt: '2026-08-22',
  },

  // Stage 04: 신청서 작성 및 법원 접수
  {
    templateCode: 'MYKIM_ATS_06',
    templateName: '법원 개시신청서 접수완료 안내',
    template: `[#{법무법인}] 법원 개시신청서 정식 접수 완료\n\n#{고객명}님, 대법원 전자소송을 통해 #{사건유형} 신청서가 정식 접수되었습니다.\n\n■ 관할 법원: #{관할법원}\n■ 사건 번호: #{사건번호}\n■ 다음 단계: #{다음단계}\n\n▶ 나의사건 진행현황: #{안내링크}`,
    state: '승인',
    stage: 4,
    category: '법원접수',
    buttons: [{ name: '대법원 나의사건 확인', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-20',
    reviewedAt: '2026-08-22',
  },
  {
    templateCode: 'MYKIM_ATS_07',
    templateName: '법원 금지명령 인용 통보',
    template: `[#{법무법인}] 법원 금지명령 인용 결정 안내\n\n#{고객명}님, 법원에서 채권자 추심 금지명령이 인용 결정되었습니다.\n\n■ 결정 일자: #{결정일자}\n■ 법적 효력: 급여/통장 압류 및 빚 독촉 전화 전면 금지\n■ 대응 요령: 채권자 연락 시 사건번호(#{사건번호}) 및 대리인 선임 사실 고지\n\n▶ 결정문 상세 확인: #{안내링크}`,
    state: '승인',
    stage: 4,
    category: '법원접수',
    buttons: [{ name: '금지명령 결정문 열람', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-25',
    reviewedAt: '2026-08-27',
  },

  // Stage 05: 법원대응 및 보정
  {
    templateCode: 'MYKIM_ATS_08',
    templateName: '법원 보정권고 소명자료 제출 요청',
    template: `[#{법무법인}] 법원 보정권고에 따른 소명자료 요청\n\n#{고객명}님, 법원 회생위원 보정요구에 따른 추가 소명자료 제출이 필요합니다.\n\n■ 보정 내용: #{보정요구내용}\n■ 제출 기한: #{마감기한}\n\n기한 내 소명자료가 미제출될 경우 사건 기각 위험이 있으니 빠른 업로드 부탁드립니다.\n▶ 소명자료 업로드: #{안내링크}`,
    state: '승인',
    stage: 5,
    category: '보정대응',
    buttons: [{ name: '소명자료 간편 업로드', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-08-25',
    reviewedAt: '2026-08-27',
  },
  {
    templateCode: 'MYKIM_ATS_08B',
    templateName: '법원 보정기한 마감 임박 긴급 리마인더',
    template: `[#{법무법인}] 🚨 [긴급] 법원 보정서 제출 기한 임박 안내\n\n#{고객명}님, 법원 보정서 제출 마감일(#{마감기한})이 얼마 남지 않았습니다.\n\n서류 제출이 지연되면 사건이 기각될 수 있습니다. 확인 즉시 담당자에게 연락 바랍니다.\n■ 담당 변호사: #{담당변호사}\n■ 직통 번호: #{직통전화}`,
    state: '승인',
    stage: 5,
    category: '보정대응',
    registeredAt: '2026-08-28',
    reviewedAt: '2026-08-30',
  },

  // Stage 06: 사후관리 및 면책
  {
    templateCode: 'MYKIM_ATS_09',
    templateName: '개시결정 축하 & 가상계좌 스케줄 안내',
    template: `[#{법무법인}] 🎉 개인회생 개시결정 통보\n\n#{고객명}님, 축하드립니다! 법원 개인회생 개시결정이 내려졌습니다.\n\n■ 월 변제금: #{월변제금}\n■ 1회차 납부일: #{1회차납부일}\n■ 법원 가상계좌: #{법원가상계좌}\n\n인가 전 적립금을 성실히 납부하셔야 최종 인가결정이 내려집니다.\n▶ 변제금 납부 가이드: #{안내링크}`,
    state: '승인',
    stage: 6,
    category: '사후관리',
    buttons: [{ name: '가상계좌 적립금 확인', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-09-01',
    reviewedAt: '2026-09-03',
  },
  {
    templateCode: 'MYKIM_ATS_10',
    templateName: '채권자집회 출석 지도 및 유의사항',
    template: `[#{법무법인}] 법원 채권자집회 기일 출석 안내\n\n#{고객명}님, 법원 채권자집회 기일이 지정되어 안내드립니다.\n\n■ 집회 일시: #{집회일시}\n■ 법정 장소: #{법정장소}\n■ 지참물: 주민등록증 원본 필수 (15분 전 입실)\n\n원활한 참석을 위해 사전에 진행 요령을 안내해 드립니다.\n▶ 집회 유의사항 확인: #{안내링크}`,
    state: '승인',
    stage: 6,
    category: '사후관리',
    buttons: [{ name: '집회 장소 및 유의사항', type: 'WL', urlMobile: 'https://mykim.kr/my', urlPc: 'https://mykim.kr/my' }],
    registeredAt: '2026-09-01',
    reviewedAt: '2026-09-03',
  },
];

const LOCAL_STORAGE_TEMPLATES_KEY = 'popbill_custom_alimtok_templates';

/**
 * 팝빌 등록 및 검수 승인 템플릿 목록 로드 (기본 승인 템플릿 + 로컬 등록 템플릿)
 */
export const loadPopbillTemplates = (): PopbillAlimtokTemplate[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    const customList: PopbillAlimtokTemplate[] = raw ? JSON.parse(raw) : [];
    
    // 기본 템플릿 코드와 중복되지 않는 커스텀 템플릿 병합
    const defaultCodes = new Set(DEFAULT_POPBILL_TEMPLATES.map(t => t.templateCode));
    const merged = [...DEFAULT_POPBILL_TEMPLATES];
    for (const custom of customList) {
      if (!defaultCodes.has(custom.templateCode)) {
        merged.push(custom);
      }
    }
    return merged;
  } catch {
    return DEFAULT_POPBILL_TEMPLATES;
  }
};

/**
 * 신규 알림톡 템플릿 등록 및 카카오 검수 심사 신청 저장
 */
export const registerNewTemplateForReview = (newTemplate: PopbillAlimtokTemplate): void => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    const currentList: PopbillAlimtokTemplate[] = raw ? JSON.parse(raw) : [];
    const filtered = currentList.filter(t => t.templateCode !== newTemplate.templateCode);
    filtered.unshift({
      ...newTemplate,
      state: '심사중',
      registeredAt: new Date().toISOString().split('T')[0],
    });
    localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to save custom template:', err);
  }
};

/**
 * 팝빌 API 실시간 템플릿 및 SSO 심사 관리 URL 조회
 */
export const fetchPopbillLiveTemplates = async (): Promise<{
  templates: PopbillAlimtokTemplate[];
  templateMgtUrl: string;
}> => {
  try {
    const res = await fetch('/api/alimtok?action=templates');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      templates: Array.isArray(data.templates) && data.templates.length > 0 ? data.templates : loadPopbillTemplates(),
      templateMgtUrl: data.templateMgtUrl || 'https://www.popbill.com/KakaoTalk/?TG=TEMPLATE',
    };
  } catch {
    return {
      templates: loadPopbillTemplates(),
      templateMgtUrl: 'https://www.popbill.com/KakaoTalk/?TG=TEMPLATE',
    };
  }
};

/**
 * 템플릿 문자열에서 #{변수명} 또는 {{변수명}} 추출
 */
export const extractTemplateVariables = (templateStr: string): string[] => {
  if (!templateStr) return [];
  const matches = templateStr.match(/#\{([^}]+)\}|\{\{([^}]+)\}\}/g) || [];
  const vars = matches.map(m => m.replace(/[#{}]/g, '').trim());
  return Array.from(new Set(vars));
};

/**
 * 템플릿 본문의 #{변수}를 실제 입력값으로 치환하여 최종 발송 문안 생성
 */
export const compileTemplateWithVariables = (
  templateStr: string,
  vars: Record<string, string>
): string => {
  if (!templateStr) return '';
  let result = templateStr;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`#\\{${key}\\}|\\{\\{${key}\\}\\}`, 'g'), val || '');
  }
  return result;
};


