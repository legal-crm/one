import { AlimtokMilestone, AlimtokLog, ALIMTOK_MILESTONE_CONFIG, STATUS_TO_MILESTONE, CrmStatus } from '../types';

export const renderTemplate = (milestone: AlimtokMilestone, vars: Record<string, string>): string => {
  let template = ALIMTOK_MILESTONE_CONFIG[milestone].template;
  for (const [key, value] of Object.entries(vars)) {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return template;
};

export const sendAlimtok = async (phone: string, milestone: AlimtokMilestone, vars: Record<string, string>) => {
  const rendered = renderTemplate(milestone, vars);
  try {
    const response = await fetch('/api/alimtok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, template: rendered, milestone }),
    });
    const data = await response.json();
    return { ok: response.ok, error: data.error };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
};

export const loadAlimtokLogs = (clientId: string): AlimtokLog[] => {
  try {
    const data = localStorage.getItem(`alimtok_logs_${clientId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveAlimtokLog = (clientId: string, log: AlimtokLog) => {
  try {
    const logs = loadAlimtokLogs(clientId);
    logs.push(log);
    localStorage.setItem(`alimtok_logs_${clientId}`, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save alimtok log', e);
  }
};

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
