/**
 * 통합 알림 서비스 (Notification Service)
 * - Telegram Bot API
 * - Gmail SMTP (via Vercel API route)
 * - Browser Push Notification
 * - SMS/카카오톡 (스텁, 준비중)
 */
import type { NotificationLog, NotificationSettings } from '../types';

// ═══════════════════════════════════════════════════════
// 설정 저장/로드 (localStorage)
// ═══════════════════════════════════════════════════════

const SETTINGS_KEY = 'notification_settings';
const LOGS_KEY = 'notification_logs';

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return getDefaultSettings();
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getDefaultSettings(): NotificationSettings {
  return {
    telegram: { botToken: '', chatId: '', connected: false },
    email: { senderGmail: '', senderAppPassword: '', recipientEmails: [], enabled: false },
    browserPush: { enabled: false, permission: 'default' },
    sms: { enabled: false as const, status: 'coming_soon' as const },
    kakao: { enabled: false as const, status: 'coming_soon' as const },
  };
}

// ═══════════════════════════════════════════════════════
// 알림 이력 (Notification Logs)
// ═══════════════════════════════════════════════════════

export function loadNotificationLogs(): NotificationLog[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveNotificationLog(log: NotificationLog): void {
  const logs = loadNotificationLogs();
  logs.unshift(log);
  // 최근 100개만 유지
  if (logs.length > 100) logs.length = 100;
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function createLogId(): string {
  return `nlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ═══════════════════════════════════════════════════════
// Telegram Bot API
// ═══════════════════════════════════════════════════════

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Vercel API route를 프록시로 사용 (CORS 우회)
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, chatId, text, parseMode: 'Markdown' }),
    });
    const data = await res.json();
    
    const log: NotificationLog = {
      id: createLogId(),
      channel: 'telegram',
      type: 'test',
      sentAt: new Date().toISOString(),
      status: data.ok ? 'sent' : 'failed',
      detail: `Chat ID: ${chatId}`,
      errorMessage: data.ok ? undefined : data.error,
    };
    saveNotificationLog(log);
    
    return data;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
    const log: NotificationLog = {
      id: createLogId(),
      channel: 'telegram',
      type: 'test',
      sentAt: new Date().toISOString(),
      status: 'failed',
      detail: `Chat ID: ${chatId}`,
      errorMessage: errorMsg,
    };
    saveNotificationLog(log);
    return { ok: false, error: errorMsg };
  }
}

export function formatTelegramConsultCard(data: {
  type: string;
  region: string;
  debt: string;
  income: string;
  tags: string[];
}): string {
  return [
    `🔔 *신규 상담 요청*`,
    `━━━━━━━━━━━━━━`,
    `• 유형: ${data.type}`,
    `• 지역: ${data.region} 법원 관할`,
    `• 채무: ${data.debt}`,
    `• 소득: ${data.income}`,
    `• 태그: ${data.tags.join(' ')}`,
    `━━━━━━━━━━━━━━`,
    `⏰ ${new Date().toLocaleString('ko-KR')} 접수`,
  ].join('\n');
}

export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ ok: boolean; error?: string }> {
  const text = '✅ [다시시작 CRM] 텔레그램 알림 연동 테스트가 성공적으로 완료되었습니다!';
  return sendTelegramMessage(botToken, chatId, text);
}

// ═══════════════════════════════════════════════════════
// 이메일 (Gmail SMTP via Vercel API route)
// ═══════════════════════════════════════════════════════

export async function sendEmailNotification(
  senderGmail: string,
  senderAppPassword: string,
  recipients: string[],
  subject: string,
  htmlBody: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderGmail,
        senderAppPassword,
        recipients,
        subject,
        htmlBody,
      }),
    });
    const data = await res.json();
    
    const log: NotificationLog = {
      id: createLogId(),
      channel: 'email',
      type: 'test',
      sentAt: new Date().toISOString(),
      status: data.ok ? 'sent' : 'failed',
      detail: `수신: ${recipients.join(', ')}`,
      errorMessage: data.ok ? undefined : data.error,
    };
    saveNotificationLog(log);
    
    return data;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
    const log: NotificationLog = {
      id: createLogId(),
      channel: 'email',
      type: 'test',
      sentAt: new Date().toISOString(),
      status: 'failed',
      detail: `수신: ${recipients.join(', ')}`,
      errorMessage: errorMsg,
    };
    saveNotificationLog(log);
    return { ok: false, error: errorMsg };
  }
}

export function formatEmailConsultHtml(data: {
  type: string;
  region: string;
  debt: string;
  income: string;
  tags: string[];
}): { subject: string; html: string } {
  const subject = `[다시시작 CRM] 신규 상담 요청 - ${data.region} 채무 ${data.debt}`;
  const html = `
    <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#1e293b,#334155);color:white;padding:20px 24px;border-radius:16px 16px 0 0;">
        <h2 style="margin:0;font-size:18px;">🔔 신규 상담 요청</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.7;">다시시작 CRM 자동 알림</p>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 16px 16px;">
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;">유형</td><td style="padding:8px 0;font-weight:700;">${data.type}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">지역</td><td style="padding:8px 0;font-weight:700;">${data.region} 법원 관할</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">채무</td><td style="padding:8px 0;font-weight:700;color:#ef4444;">${data.debt}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">소득</td><td style="padding:8px 0;font-weight:700;">${data.income}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">태그</td><td style="padding:8px 0;font-weight:700;">${data.tags.join(', ')}</td></tr>
        </table>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
          <a href="${typeof window !== 'undefined' ? window.location.origin : ''}" 
             style="display:inline-block;background:#7c3aed;color:white;text-decoration:none;padding:10px 24px;border-radius:10px;font-weight:700;font-size:13px;">
            CRM에서 확인하기 →
          </a>
        </div>
        <p style="text-align:center;margin-top:12px;font-size:11px;color:#94a3b8;">
          ⏰ ${new Date().toLocaleString('ko-KR')} 접수
        </p>
      </div>
    </div>
  `;
  return { subject, html };
}

// ═══════════════════════════════════════════════════════
// 브라우저 Push 알림
// ═══════════════════════════════════════════════════════

export async function requestBrowserPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  const perm = await Notification.requestPermission();
  return perm;
}

export function sendBrowserPushNotification(
  title: string,
  body: string,
  icon?: string
): boolean {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  
  try {
    new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: `crm-notification-${Date.now()}`,
    });
    
    const log: NotificationLog = {
      id: createLogId(),
      channel: 'browser_push',
      type: 'test',
      sentAt: new Date().toISOString(),
      status: 'sent',
      detail: title,
    };
    saveNotificationLog(log);
    
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// SMS / 카카오톡 (스텁 — 준비중)
// ═══════════════════════════════════════════════════════

export async function sendSmsNotification(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: 'SMS 알림은 현재 준비 중입니다. 추후 업데이트 예정입니다.' };
}

export async function sendKakaoNotification(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: '카카오톡 알림은 현재 준비 중입니다. 추후 업데이트 예정입니다.' };
}

// ═══════════════════════════════════════════════════════
// 통합 알림 발송 (모든 활성 채널에 발송)
// ═══════════════════════════════════════════════════════

export async function notifyAllChannels(
  settings: NotificationSettings,
  consultData: {
    type: string;
    region: string;
    debt: string;
    income: string;
    tags: string[];
  }
): Promise<{ results: Array<{ channel: string; ok: boolean; error?: string }> }> {
  const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

  // Telegram
  if (settings.telegram.connected && settings.telegram.botToken && settings.telegram.chatId) {
    const text = formatTelegramConsultCard(consultData);
    const res = await sendTelegramMessage(settings.telegram.botToken, settings.telegram.chatId, text);
    results.push({ channel: 'telegram', ...res });
  }

  // Email
  if (settings.email.enabled && settings.email.senderGmail && settings.email.recipientEmails.length > 0) {
    const { subject, html } = formatEmailConsultHtml(consultData);
    const res = await sendEmailNotification(
      settings.email.senderGmail,
      settings.email.senderAppPassword,
      settings.email.recipientEmails,
      subject,
      html
    );
    results.push({ channel: 'email', ...res });
  }

  // Browser Push
  if (settings.browserPush.enabled && typeof window !== 'undefined' && Notification.permission === 'granted') {
    const ok = sendBrowserPushNotification(
      '🔔 신규 상담 요청',
      `${consultData.region} | 채무 ${consultData.debt}`
    );
    results.push({ channel: 'browser_push', ok });
  }

  return { results };
}
