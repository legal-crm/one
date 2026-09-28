// ============================================================
// 사무소 내부 스레드 메시지 서비스 (사건·상담별)
// - Supabase 설정 시 서버만 사용하고 실패는 예외로 알린다.
//   (이전: 'msg-…' 문자열 ID를 UUID 컬럼에 넣어 저장이 항상 실패 → 보낸 사람 브라우저에만 남고 목록에서 사라짐)
// - 열람 제한(변호사 전용·지정 대상)의 최종 차단은 DB RLS(020)가 맡고, 화면은 canViewMessage로 한 번 더 거른다.
// - Supabase 미설정(로컬 개발)일 때만 localStorage를 쓴다.
// ============================================================

import { supabase, isSupabaseConfigured } from '../supabaseClient';
import type {
  InternalMessage, MessageCategory, MessageVisibility, MessageTargetType
} from '../types/communication';
import { createNotification } from './notificationCenterService';
import { generateUUID } from '../utils/deviceDetector';

const STORAGE_KEY = 'internal-messages';
const MAX_CONTENT_LENGTH = 5000;

function loadFromStorage(tenantId: string): InternalMessage[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${tenantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(tenantId: string, messages: InternalMessage[]) {
  localStorage.setItem(`${STORAGE_KEY}-${tenantId}`, JSON.stringify(messages));
}

function messageError(action: string, error: any): Error {
  const msg = error?.message || String(error || '');
  console.error(`[InternalMessage] ${action} 실패:`, msg);
  return new Error(`메시지를 ${action}하지 못했습니다.${msg ? ` (${msg})` : ''}`);
}

const isLawyerRole = (role: string) => role === 'OWNER' || role === 'LAWYER';

/** 열람 가능 여부 (알 수 없는 공개 범위는 차단) */
export function canViewMessage(msg: Pick<InternalMessage, 'visibility' | 'designatedUserIds' | 'authorId'>, viewerRole: string, viewerId: string): boolean {
  if (msg.authorId && msg.authorId === viewerId) return true;
  if (msg.visibility === 'all_staff') return true;
  if (msg.visibility === 'lawyers_only') return isLawyerRole(viewerRole);
  if (msg.visibility === 'designated') return (msg.designatedUserIds || []).includes(viewerId);
  return false;
}

export async function createMessage(
  tenantId: string, targetType: MessageTargetType, targetId: string,
  authorId: string, authorName: string, authorRole: string, content: string,
  options: {
    category?: MessageCategory; visibility?: MessageVisibility;
    designatedUserIds?: string[]; mentions?: string[]; parentId?: string | null;
  } = {}
): Promise<{ message: InternalMessage; notifyFailed: number }> {
  const text = content.trim();
  if (!text) throw new Error('메시지 내용을 입력해 주세요.');
  if (text.length > MAX_CONTENT_LENGTH) throw new Error(`메시지는 ${MAX_CONTENT_LENGTH.toLocaleString()}자까지 쓸 수 있습니다.`);

  // 답글은 원글의 공개 범위를 그대로 따른다 (이전: 답글을 항상 '전체 직원 공개'로 저장 → 변호사 전용 스레드 답글이 직원에게 노출)
  let visibility: MessageVisibility = options.visibility || 'all_staff';
  let designatedUserIds = options.designatedUserIds || [];
  let parentMsg: InternalMessage | null = null;
  if (options.parentId) {
    parentMsg = await getMessage(tenantId, options.parentId);
    if (!parentMsg) throw new Error('원글을 찾을 수 없습니다.');
    visibility = parentMsg.visibility;
    designatedUserIds = parentMsg.designatedUserIds || [];
  }
  if (visibility === 'lawyers_only' && !isLawyerRole(authorRole) && !parentMsg) {
    throw new Error('변호사만 변호사 전용 메시지를 작성할 수 있습니다.');
  }
  if (visibility === 'designated' && designatedUserIds.length === 0) {
    throw new Error('지정 공개 메시지는 받을 사람을 한 명 이상 선택해야 합니다.');
  }

  const msg: InternalMessage = {
    id: generateUUID(), tenantId, targetType, targetId,
    parentId: options.parentId || null,
    authorId, authorName, authorRole, content: text,
    category: options.category || 'general',
    visibility,
    designatedUserIds,
    mentions: options.mentions || [],
    isPinned: false, isEdited: false,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('internal_messages').insert({
      id: msg.id, tenant_id: msg.tenantId, target_type: msg.targetType,
      target_id: msg.targetId, parent_id: msg.parentId,
      author_id: msg.authorId, author_name: msg.authorName, author_role: msg.authorRole,
      content: msg.content, category: msg.category, visibility: msg.visibility,
      designated_user_ids: msg.designatedUserIds, mentions: msg.mentions, is_pinned: msg.isPinned,
    });
    if (error) throw messageError('보내', error);
  } else {
    const all = loadFromStorage(tenantId); all.unshift(msg); saveToStorage(tenantId, all);
  }

  // 알림: 받을 권한이 있는 사람에게만 (변호사 전용 글의 멘션이 직원에게 내용 일부를 노출하지 않도록 본문 미리보기는 권한 확인 후)
  let notifyFailed = 0;
  const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
  const recipients = new Set<string>(msg.mentions.filter(id => id !== authorId));
  for (const userId of recipients) {
    try {
      await createNotification(tenantId, userId, {
        type: 'MENTION', title: `${authorName}님이 회원님을 언급했습니다`,
        body: preview, senderId: authorId, senderName: authorName, linkType: targetType as any, linkId: targetId,
      });
    } catch { notifyFailed++; }
  }
  if (parentMsg && parentMsg.authorId !== authorId && !recipients.has(parentMsg.authorId)) {
    try {
      await createNotification(tenantId, parentMsg.authorId, {
        type: 'REPLY_RECEIVED', title: `${authorName}님이 답글을 남겼습니다`,
        body: preview, senderId: authorId, senderName: authorName, linkType: targetType as any, linkId: targetId,
      });
    } catch { notifyFailed++; }
  }

  return { message: msg, notifyFailed };
}

export async function getMessage(tenantId: string, messageId: string): Promise<InternalMessage | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('internal_messages').select('*')
      .eq('tenant_id', tenantId).eq('id', messageId).maybeSingle();
    if (error) throw messageError('불러오', error);
    return data ? mapDbRow(data) : null;
  }
  return loadFromStorage(tenantId).find(m => m.id === messageId) || null;
}

export async function getMessages(
  tenantId: string, targetType: MessageTargetType, targetId: string,
  viewerRole: string, viewerId: string
): Promise<InternalMessage[]> {
  let messages: InternalMessage[];
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('internal_messages').select('*')
      .eq('tenant_id', tenantId).eq('target_type', targetType).eq('target_id', targetId)
      .is('parent_id', null)
      .order('created_at', { ascending: false });
    if (error) throw messageError('불러오', error);
    messages = (data || []).map(mapDbRow);
  } else {
    messages = loadFromStorage(tenantId)
      .filter(m => m.targetType === targetType && m.targetId === targetId && !m.parentId);
  }
  return messages.filter(m => canViewMessage(m, viewerRole, viewerId));
}

export async function getReplies(
  tenantId: string, parentId: string, viewerRole: string, viewerId: string
): Promise<InternalMessage[]> {
  let replies: InternalMessage[];
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('internal_messages').select('*')
      .eq('tenant_id', tenantId).eq('parent_id', parentId)
      .order('created_at', { ascending: true });
    if (error) throw messageError('불러오', error);
    replies = (data || []).map(mapDbRow);
  } else {
    replies = loadFromStorage(tenantId).filter(m => m.parentId === parentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return replies.filter(m => canViewMessage(m, viewerRole, viewerId));
}

/** 본인 메시지만 수정 */
export async function updateMessage(
  tenantId: string, messageId: string, newContent: string, actorId: string
): Promise<boolean> {
  const text = newContent.trim();
  if (!text) throw new Error('메시지 내용을 입력해 주세요.');
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('internal_messages')
      .update({ content: text, is_edited: true, edited_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('id', messageId).eq('author_id', actorId).select('id');
    if (error) throw messageError('수정', error);
    if (!data || data.length === 0) throw new Error('본인이 쓴 메시지만 수정할 수 있습니다.');
    return true;
  }
  const all = loadFromStorage(tenantId);
  const idx = all.findIndex(m => m.id === messageId && m.authorId === actorId);
  if (idx === -1) throw new Error('본인이 쓴 메시지만 수정할 수 있습니다.');
  all[idx] = { ...all[idx], content: text, isEdited: true, editedAt: new Date().toISOString() };
  saveToStorage(tenantId, all);
  return true;
}

/** 본인 메시지만 삭제 (답글 포함) — 이전: 작성자 확인 없이 삭제하고 실패해도 '삭제되었습니다' */
export async function deleteMessage(tenantId: string, messageId: string, actorId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('internal_messages').delete()
      .eq('tenant_id', tenantId).eq('id', messageId).eq('author_id', actorId).select('id');
    if (error) throw messageError('삭제', error);
    if (!data || data.length === 0) throw new Error('본인이 쓴 메시지만 삭제할 수 있습니다.');
    return true;
  }
  const all = loadFromStorage(tenantId);
  if (!all.some(m => m.id === messageId && m.authorId === actorId)) throw new Error('본인이 쓴 메시지만 삭제할 수 있습니다.');
  saveToStorage(tenantId, all.filter(m => m.id !== messageId && m.parentId !== messageId));
  return true;
}

/** 중요 메시지 고정/해제 — 이전: 조회 오류를 확인하지 않아 아무것도 안 바뀌어도 성공 처리 */
export async function togglePin(tenantId: string, messageId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const current = await getMessage(tenantId, messageId);
    if (!current) throw new Error('메시지를 찾을 수 없습니다.');
    const { data, error } = await supabase.from('internal_messages')
      .update({ is_pinned: !current.isPinned })
      .eq('tenant_id', tenantId).eq('id', messageId).select('id');
    if (error) throw messageError('고정', error);
    if (!data || data.length === 0) throw new Error('메시지를 고정하지 못했습니다. 권한을 확인해 주세요.');
    return !current.isPinned;
  }
  const all = loadFromStorage(tenantId);
  const idx = all.findIndex(m => m.id === messageId);
  if (idx === -1) throw new Error('메시지를 찾을 수 없습니다.');
  all[idx].isPinned = !all[idx].isPinned;
  saveToStorage(tenantId, all);
  return all[idx].isPinned;
}

function mapDbRow(row: any): InternalMessage {
  return {
    id: row.id, tenantId: row.tenant_id, targetType: row.target_type,
    targetId: row.target_id, parentId: row.parent_id,
    authorId: row.author_id, authorName: row.author_name, authorRole: row.author_role,
    content: row.content, category: row.category, visibility: row.visibility,
    designatedUserIds: row.designated_user_ids || [], mentions: row.mentions || [],
    isPinned: row.is_pinned, isEdited: row.is_edited, editedAt: row.edited_at,
    createdAt: row.created_at,
  };
}

/**
 * '@이름' 멘션 추출 — 이름 뒤가 글자·숫자로 이어지면 다른 사람으로 본다.
 * (이전: includes('@김철') 이 '@김철수'에도 걸려 엉뚱한 사람에게 알림)
 */
export function parseMentions(content: string, staffList: { id: string; name: string }[]): string[] {
  const ids: string[] = [];
  const sorted = [...staffList].filter(s => s.name && s.name.trim()).sort((a, b) => b.name.length - a.name.length);
  let rest = content;
  for (const s of sorted) {
    const escaped = s.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`@${escaped}(?![0-9A-Za-z가-힣])`, 'g');
    if (re.test(rest)) {
      ids.push(s.id);
      rest = rest.replace(re, ' ');
    }
  }
  return ids;
}
