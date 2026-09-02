import {
  Send, MessageSquare, Reply, Pin, Trash2, Edit3, Lock, Users, User, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import {
  createMessage, getMessages, getReplies, deleteMessage, togglePin, parseMentions
} from '../../services/internalMessageService';
import type { InternalMessage, MessageCategory, MessageVisibility } from '../../types/communication';
import { MESSAGE_CATEGORY_CONFIG, VISIBILITY_CONFIG } from '../../types/communication';
import type { StaffMember } from '../../types';

interface InternalThreadTabProps {
  tenantId: string;
  targetType: 'consult_request' | 'case' | 'copilot_review';
  targetId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  staffMembers: StaffMember[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

export default function InternalThreadTab({
  tenantId, targetType, targetId, actorId, actorName, actorRole, staffMembers
}: InternalThreadTabProps) {
  const dialog = useDialog();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [newContent, setNewContent] = useState('');
  const [category, setCategory] = useState<MessageCategory>('general');
  const [visibility, setVisibility] = useState<MessageVisibility>('all_staff');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [repliesMap, setRepliesMap] = useState<Record<string, InternalMessage[]>>({});
  const [categoryFilter, setCategoryFilter] = useState<MessageCategory | 'all'>('all');

  const refresh = useCallback(async () => {
    const msgs = await getMessages(tenantId, targetType, targetId, actorRole, actorId);
    setMessages(msgs);
  }, [tenantId, targetType, targetId, actorRole, actorId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSend = async () => {
    if (!newContent.trim()) return;
    const mentions = parseMentions(newContent, staffMembers.map(s => ({ id: s.id, name: s.name })));
    await createMessage(tenantId, targetType, targetId, actorId, actorName, actorRole, newContent.trim(), {
      category, visibility, mentions,
    });
    setNewContent('');
    refresh();
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    const mentions = parseMentions(replyContent, staffMembers.map(s => ({ id: s.id, name: s.name })));
    await createMessage(tenantId, targetType, targetId, actorId, actorName, actorRole, replyContent.trim(), {
      parentId, mentions, category: 'general', visibility: 'all_staff',
    });
    setReplyContent('');
    setReplyingTo(null);
    loadReplies(parentId);
    refresh();
  };

  const loadReplies = async (parentId: string) => {
    const replies = await getReplies(tenantId, parentId, actorRole, actorId);
    setRepliesMap(prev => ({ ...prev, [parentId]: replies }));
  };

  const toggleReplies = (msgId: string) => {
    const next = new Set(expandedReplies);
    if (next.has(msgId)) { next.delete(msgId); } else { next.add(msgId); loadReplies(msgId); }
    setExpandedReplies(next);
  };

  const handleDelete = async (msgId: string) => {
    const confirmed = await dialog.confirm({
      title: '메시지 삭제',
      message: '이 사내 스레드 메시지를 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    await deleteMessage(tenantId, msgId);
    toast.success('메시지가 삭제되었습니다.');
    refresh();
  };

  const handlePin = async (msgId: string) => {
    await togglePin(tenantId, msgId);
    refresh();
  };

  const filteredMessages = categoryFilter === 'all'
    ? messages
    : messages.filter(m => m.category === categoryFilter);

  const pinnedMessages = filteredMessages.filter(m => m.isPinned);
  const normalMessages = filteredMessages.filter(m => !m.isPinned);

  return (
    <div className="space-y-3">
      {/* 카테고리 필터 */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
            categoryFilter === 'all' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >전체</button>
        {(Object.keys(MESSAGE_CATEGORY_CONFIG) as MessageCategory[]).map(cat => {
          const cfg = MESSAGE_CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                categoryFilter === cat ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >{cfg.emoji} {cfg.label}</button>
          );
        })}
      </div>

      {/* 새 메시지 입력 */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-2">
        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="메시지를 입력하세요... (@이름으로 멘션)"
          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none"
          rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={e => setCategory(e.target.value as MessageCategory)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none"
            >
              {(Object.keys(MESSAGE_CATEGORY_CONFIG) as MessageCategory[]).map(cat => (
                <option key={cat} value={cat}>{MESSAGE_CATEGORY_CONFIG[cat].emoji} {MESSAGE_CATEGORY_CONFIG[cat].label}</option>
              ))}
            </select>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as MessageVisibility)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] outline-none"
            >
              {(Object.keys(VISIBILITY_CONFIG) as MessageVisibility[]).map(vis => (
                <option key={vis} value={vis}>{VISIBILITY_CONFIG[vis].emoji} {VISIBILITY_CONFIG[vis].label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSend}
            disabled={!newContent.trim()}
            className="bg-brand text-white rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" /> 전송
          </button>
        </div>
      </div>

      {/* 고정 메시지 */}
      {pinnedMessages.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1"><Pin className="w-3 h-3" /> 고정됨</p>
          {pinnedMessages.map(msg => renderMessage(msg, true))}
        </div>
      )}

      {/* 메시지 목록 */}
      {normalMessages.length === 0 && pinnedMessages.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-bold">아직 대화가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {normalMessages.map(msg => renderMessage(msg, false))}
        </div>
      )}
    </div>
  );

  function renderMessage(msg: InternalMessage, isPinned: boolean) {
    const catCfg = MESSAGE_CATEGORY_CONFIG[msg.category];
    const visCfg = VISIBILITY_CONFIG[msg.visibility];
    const isOwn = msg.authorId === actorId;
    const replies = repliesMap[msg.id] || [];
    const isExpanded = expandedReplies.has(msg.id);

    return (
      <div key={msg.id} className={`bg-white border rounded-xl overflow-hidden ${isPinned ? 'border-amber-200' : 'border-slate-200'}`}>
        <div className="p-3">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-800">{msg.authorName}</span>
              <span className="text-[10px] text-slate-400">({msg.authorRole})</span>
              <span className={`rounded-lg px-1.5 py-0.5 text-[9px] font-bold ${catCfg.color} bg-slate-50`}>{catCfg.emoji} {catCfg.label}</span>
              {msg.visibility !== 'all_staff' && (
                <span className="rounded-lg px-1.5 py-0.5 text-[9px] font-bold text-slate-500 bg-slate-100">{visCfg.emoji} {visCfg.label}</span>
              )}
              {msg.isEdited && <span className="text-[9px] text-slate-400">(수정됨)</span>}
            </div>
            <span className="text-[10px] text-slate-400">{timeAgo(msg.createdAt)}</span>
          </div>

          {/* 내용 */}
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.content}</p>

          {/* 액션 */}
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => { setReplyingTo(replyingTo === msg.id ? null : msg.id); setReplyContent(''); }}
              className="text-[10px] text-slate-400 hover:text-brand font-bold flex items-center gap-0.5">
              <Reply className="w-3 h-3" /> 답글
            </button>
            <button onClick={() => handlePin(msg.id)}
              className={`text-[10px] font-bold flex items-center gap-0.5 ${msg.isPinned ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
              <Pin className="w-3 h-3" /> {msg.isPinned ? '고정 해제' : '고정'}
            </button>
            {isOwn && (
              <button onClick={() => handleDelete(msg.id)}
                className="text-[10px] text-slate-400 hover:text-red-500 font-bold flex items-center gap-0.5">
                <Trash2 className="w-3 h-3" /> 삭제
              </button>
            )}
            {replies.length > 0 || msg.replyCount ? (
              <button onClick={() => toggleReplies(msg.id)}
                className="text-[10px] text-brand font-bold flex items-center gap-0.5">
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                답글 {replies.length || msg.replyCount || 0}개
              </button>
            ) : null}
          </div>
        </div>

        {/* 답글 입력 */}
        {replyingTo === msg.id && (
          <div className="border-t border-slate-100 p-3 bg-slate-50/50 flex gap-2">
            <input
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              placeholder="답글을 입력하세요..."
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => { if (e.key === 'Enter') handleReply(msg.id); }}
              autoFocus
            />
            <button onClick={() => handleReply(msg.id)} disabled={!replyContent.trim()}
              className="bg-brand text-white rounded-xl px-3 py-2 text-xs font-bold hover:bg-brand/90 active:scale-[0.98] transition-all disabled:opacity-50">
              전송
            </button>
          </div>
        )}

        {/* 답글 목록 */}
        {isExpanded && replies.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/30">
            {replies.map(reply => (
              <div key={reply.id} className="px-4 py-2 border-b border-slate-50 last:border-b-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-bold text-slate-700">↳ {reply.authorName}</span>
                  <span className="text-[10px] text-slate-400">{timeAgo(reply.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-600">{reply.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}
