import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { writeCopilotAuditLog } from './copilotAuditService';
import type { 
  ReviewRuleSet, ReviewRule, CourtPracticeNote, GlobalRuleTemplate, RuleTemplateUpdate 
} from '../types/copilot';

const RULES_STORAGE_KEY = 'legal_crm_rulesets';
const GLOBAL_TEMPLATES_KEY = 'legal_crm_global_templates';
const COURT_NOTES_KEY = 'legal_crm_court_notes';

function getLocalData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setLocalData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export async function getGlobalTemplates(): Promise<GlobalRuleTemplate[]> {
  return getLocalData<GlobalRuleTemplate[]>(GLOBAL_TEMPLATES_KEY, []);
}

export async function cloneGlobalTemplate(templateId: string, tenantId: string, lawyerId: string): Promise<ReviewRuleSet> {
  const templates = await getGlobalTemplates();
  const template = templates.find(t => t.id === templateId);
  if (!template) throw new Error('템플릿을 찾을 수 없습니다.');

  const rs: ReviewRuleSet = {
    id: crypto.randomUUID(),
    tenantId,
    name: `${template.name} (복제)`,
    description: template.description,
    version: 1,
    status: 'DRAFT',
    effectiveFrom: new Date().toISOString(),
    reviewDueAt: new Date().toISOString(), // 설정 필요
    createdBy: lawyerId,
    approvedByLawyerId: '',
    approvedAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const store = getLocalData<Record<string, ReviewRuleSet>>(RULES_STORAGE_KEY, {});
  store[rs.id] = rs;
  setLocalData(RULES_STORAGE_KEY, store);

  writeCopilotAuditLog(tenantId, lawyerId, 'LAWYER', 'RULESET_CREATED', 'ReviewRuleSet', rs.id, { templateId });
  return rs;
}

export async function createRuleSet(tenantId: string, name: string, description: string, createdBy: string): Promise<ReviewRuleSet> {
  const rs: ReviewRuleSet = {
    id: crypto.randomUUID(),
    tenantId,
    name,
    description,
    version: 1,
    status: 'DRAFT',
    effectiveFrom: new Date().toISOString(),
    reviewDueAt: new Date().toISOString(),
    createdBy,
    approvedByLawyerId: '',
    approvedAt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const store = getLocalData<Record<string, ReviewRuleSet>>(RULES_STORAGE_KEY, {});
  store[rs.id] = rs;
  setLocalData(RULES_STORAGE_KEY, store);
  writeCopilotAuditLog(tenantId, createdBy, 'LAWYER', 'RULESET_CREATED', 'ReviewRuleSet', rs.id, {});
  return rs;
}

export async function getRuleSet(ruleSetId: string, tenantId: string): Promise<ReviewRuleSet | null> {
  const store = getLocalData<Record<string, ReviewRuleSet>>(RULES_STORAGE_KEY, {});
  const rs = store[ruleSetId];
  if (rs && rs.tenantId === tenantId) return rs;
  return null;
}

export async function getRuleSetsByTenant(tenantId: string): Promise<ReviewRuleSet[]> {
  const store = getLocalData<Record<string, ReviewRuleSet>>(RULES_STORAGE_KEY, {});
  return Object.values(store).filter(rs => rs.tenantId === tenantId);
}

export async function getActiveRuleSet(tenantId: string): Promise<ReviewRuleSet | null> {
  const sets = await getRuleSetsByTenant(tenantId);
  return sets.find(rs => rs.status === 'ACTIVE') || null;
}

export async function updateRuleSet(ruleSetId: string, tenantId: string, changes: Partial<ReviewRuleSet>): Promise<ReviewRuleSet> {
  const rs = await getRuleSet(ruleSetId, tenantId);
  if (!rs) throw new Error('RuleSet not found');
  Object.assign(rs, changes, { updatedAt: new Date().toISOString() });
  const store = getLocalData<Record<string, ReviewRuleSet>>(RULES_STORAGE_KEY, {});
  store[rs.id] = rs;
  setLocalData(RULES_STORAGE_KEY, store);
  writeCopilotAuditLog(tenantId, 'system', 'system', 'RULESET_UPDATED', 'ReviewRuleSet', rs.id, { changes });
  return rs;
}

export async function addRule(ruleSetId: string, tenantId: string, rule: Partial<ReviewRule>): Promise<ReviewRule> {
  // 실제 환경에서는 DB에 개별 룰 저장. 여기서는 로컬 스토리지 키 관리
  const r: ReviewRule = {
    id: crypto.randomUUID(),
    ruleSetId,
    ...rule
  } as ReviewRule;
  const key = `rules_${ruleSetId}`;
  const rules = getLocalData<ReviewRule[]>(key, []);
  rules.push(r);
  setLocalData(key, rules);
  return r;
}

export async function updateRule(ruleId: string, ruleSetId: string, tenantId: string, changes: Partial<ReviewRule>): Promise<ReviewRule> {
  const key = `rules_${ruleSetId}`;
  const rules = getLocalData<ReviewRule[]>(key, []);
  const idx = rules.findIndex(r => r.id === ruleId);
  if (idx > -1) {
    Object.assign(rules[idx], changes);
    setLocalData(key, rules);
    return rules[idx];
  }
  throw new Error('Rule not found');
}

export async function deleteRule(ruleId: string, ruleSetId: string, tenantId: string): Promise<void> {
  const key = `rules_${ruleSetId}`;
  const rules = getLocalData<ReviewRule[]>(key, []);
  setLocalData(key, rules.filter(r => r.id !== ruleId));
}

export async function submitForApproval(ruleSetId: string, tenantId: string): Promise<void> {
  await updateRuleSet(ruleSetId, tenantId, { status: 'PENDING_APPROVAL' });
}

export async function approveRuleSet(ruleSetId: string, tenantId: string, lawyerId: string): Promise<void> {
  await updateRuleSet(ruleSetId, tenantId, { status: 'ACTIVE', approvedByLawyerId: lawyerId, approvedAt: new Date().toISOString() });
  writeCopilotAuditLog(tenantId, lawyerId, 'LAWYER', 'RULESET_APPROVED', 'ReviewRuleSet', ruleSetId, {});
}

export async function archiveRuleSet(ruleSetId: string, tenantId: string): Promise<void> {
  await updateRuleSet(ruleSetId, tenantId, { status: 'ARCHIVED' });
}

export async function checkExpiredRules(tenantId: string): Promise<ReviewRule[]> {
  return []; // Mock implementation
}

export async function getCourtPracticeNotes(tenantId: string, courtName?: string): Promise<CourtPracticeNote[]> {
  const notes = getLocalData<CourtPracticeNote[]>(COURT_NOTES_KEY, []);
  return notes.filter(n => n.tenantId === tenantId && (!courtName || n.courtName === courtName));
}

export async function saveCourtPracticeNote(tenantId: string, note: Partial<CourtPracticeNote>): Promise<CourtPracticeNote> {
  const n: CourtPracticeNote = {
    id: note.id || crypto.randomUUID(),
    tenantId,
    ...note
  } as CourtPracticeNote;
  const notes = getLocalData<CourtPracticeNote[]>(COURT_NOTES_KEY, []);
  const idx = notes.findIndex(x => x.id === n.id);
  if (idx > -1) notes[idx] = n;
  else notes.push(n);
  setLocalData(COURT_NOTES_KEY, notes);
  return n;
}

export async function proposeTemplateUpdate(templateId: string, tenantId: string): Promise<RuleTemplateUpdate> {
  const u: RuleTemplateUpdate = {
    id: crypto.randomUUID(),
    templateId,
    tenantId,
    status: 'PENDING',
    proposedAt: new Date().toISOString()
  };
  return u;
}

export async function respondToTemplateUpdate(updateId: string, tenantId: string, accepted: boolean, lawyerId: string): Promise<void> {
  // Mock implementation
}
