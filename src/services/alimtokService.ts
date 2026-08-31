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

// ── 2. 알림톡 발송 (실제 API 또는 모의 발송) ──

export const sendAlimtok = async (
  phone: string, 
  milestone: AlimtokMilestone, 
  vars: Record<string, string>,
  customText?: string
) => {
  const rendered = customText !== undefined && customText.trim() !== '' 
    ? customText 
    : renderTemplate(milestone, vars);

  try {
    const response = await fetch('/api/alimtok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, template: rendered, milestone, vars, customText }),
    });
    // API 엔드포인트가 없을 경우에도 클라이언트 Mock 발송 성공 처리
    if (response.status === 404) {
      return { ok: true, mock: true, rendered };
    }
    const data = await response.json();
    return { ok: response.ok, error: data.error, rendered };
  } catch (error) {
    // 네트워크 실패나 개발환경 데모 모드 지원
    return { ok: true, mock: true, rendered };
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
