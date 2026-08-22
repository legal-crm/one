import React, { useState, useEffect } from 'react';
import { Send, ClipboardList, Pin, Clock, CheckCircle2, User, ChevronRight, MessageSquare } from 'lucide-react';

interface TeamworkTabProps {
  tenantId: string;
  targetType: 'consult_request';
  targetId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  staffMembers: { id: string; name: string; role: string; isActive: boolean }[];
}

interface TeamworkItem {
  id: string;
  type: 'message' | 'task';
  content: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  isPinned?: boolean;
  assigneeId?: string;
  assigneeName?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  dueDate?: string;
  taskStatus?: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
  completionNote?: string;
}

export default function TeamworkTab({
  tenantId,
  targetType,
  targetId,
  currentUserId,
  currentUserName,
  currentUserRole,
  staffMembers
}: TeamworkTabProps) {
  const [items, setItems] = useState<TeamworkItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'message' | 'task'>('all');
  
  const [inputValue, setInputValue] = useState('');
  const [isTaskMode, setIsTaskMode] = useState(false);
  const [taskAssignee, setTaskAssignee] = useState<string>('');
  const [taskPriority, setTaskPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  const messagesKey = `teamwork_messages_${tenantId}_${targetId}`;
  const tasksKey = `teamwork_tasks_${tenantId}_${targetId}`;

  useEffect(() => {
    const loadItems = () => {
      const messagesStr = localStorage.getItem(messagesKey);
      const tasksStr = localStorage.getItem(tasksKey);
      const messages: TeamworkItem[] = messagesStr ? JSON.parse(messagesStr) : [];
      const tasks: TeamworkItem[] = tasksStr ? JSON.parse(tasksStr) : [];
      const allItems = [...messages, ...tasks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setItems(allItems);
    };
    loadItems();
  }, [messagesKey, tasksKey]);

  const saveItems = (newItems: TeamworkItem[]) => {
    setItems(newItems);
    const messages = newItems.filter(i => i.type === 'message');
    const tasks = newItems.filter(i => i.type === 'task');
    localStorage.setItem(messagesKey, JSON.stringify(messages));
    localStorage.setItem(tasksKey, JSON.stringify(tasks));
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    const newItem: TeamworkItem = {
      id: Math.random().toString(36).substring(2, 9),
      type: isTaskMode ? 'task' : 'message',
      content: inputValue,
      authorId: currentUserId,
      authorName: currentUserName,
      authorRole: currentUserRole,
      createdAt: new Date().toISOString(),
    };
    if (isTaskMode) {
      const assignee = staffMembers.find(s => s.id === taskAssignee);
      newItem.assigneeId = taskAssignee || undefined;
      newItem.assigneeName = assignee ? assignee.name : undefined;
      newItem.priority = taskPriority;
      newItem.dueDate = taskDueDate || undefined;
      newItem.taskStatus = 'pending';
    } else {
      newItem.isPinned = false;
    }
    saveItems([newItem, ...items]);
    setInputValue('');
    if (isTaskMode) {
      setIsTaskMode(false);
      setTaskAssignee('');
      setTaskPriority('normal');
      setTaskDueDate('');
    }
  };

  const togglePin = (id: string) => {
    const newItems = items.map(item =>
      item.id === id ? { ...item, isPinned: !item.isPinned } : item
    );
    saveItems(newItems);
  };

  const updateTaskStatus = (id: string, status: 'pending' | 'in_progress' | 'completed', note?: string) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          taskStatus: status,
          ...(status === 'completed' && {
            completedAt: new Date().toISOString(),
            completionNote: note
          })
        };
      }
      return item;
    });
    saveItems(newItems);
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const pinnedMessages = items.filter(item => item.type === 'message' && item.isPinned);

  const priorityConfig = {
    urgent: { label: '\uD83D\uDD34 \uAE34\uAE09', color: 'text-red-600 bg-red-50' },
    high: { label: '\uD83D\uDFE0 \uB192\uC74C', color: 'text-orange-600 bg-orange-50' },
    normal: { label: '\uD83D\uDFE2 \uBCF4\uD1B5', color: 'text-green-600 bg-green-50' },
    low: { label: '\u26AA \uB0AE\uC74C', color: 'text-slate-600 bg-slate-100' }
  };

  const getDDay = (dateStr?: string) => {
    if (!dateStr) return '';
    const due = new Date(dateStr);
    const now = new Date();
    due.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  const getStatusBorder = (status?: string) => {
    switch (status) {
      case 'in_progress': return 'border-l-amber-400';
      case 'completed': return 'border-l-emerald-400';
      case 'pending':
      default: return 'border-l-slate-300';
    }
  };

  const timeAgo = (dateStr: string) => {
    const now = Date.now();
    const d = new Date(dateStr).getTime();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return '\uBC29\uAE08 \uC804';
    if (diff < 60) return `${diff}\uBD84 \uC804`;
    if (diff < 1440) return `${Math.floor(diff / 60)}\uC2DC\uAC04 \uC804`;
    return `${Math.floor(diff / 1440)}\uC77C \uC804`;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header & Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-slate-700" />
          <h3 className="font-semibold text-slate-800">{'\uD300\uC6CC\uD06C'}</h3>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer ${filter === 'all' ? 'bg-brand text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            {'\uC804\uCCB4'}
          </button>
          <button onClick={() => setFilter('message')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer ${filter === 'message' ? 'bg-brand text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            {'\uD83D\uDCAC \uB300\uD654'}
          </button>
          <button onClick={() => setFilter('task')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer ${filter === 'task' ? 'bg-brand text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            {'\uD83D\uDCCB \uC5C5\uBB34'}
          </button>
        </div>
      </div>

      {/* Pinned Section */}
      {pinnedMessages.length > 0 && (
        <div className="mb-3 bg-amber-50/50 rounded-xl p-2.5 border border-amber-100 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold px-1">
            <Pin className="w-3.5 h-3.5" />
            {'\uACE0\uC815\uB41C \uBA54\uC2DC\uC9C0'}
          </div>
          {pinnedMessages.map(msg => (
            <div key={msg.id} className="bg-white/80 rounded-lg p-2 text-sm text-slate-700 flex justify-between items-start">
              <div className="flex-1 mr-2 truncate">{msg.content}</div>
              <button onClick={() => togglePin(msg.id)} className="text-amber-400 hover:text-amber-600 cursor-pointer">
                <Pin className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto max-h-[400px] flex flex-col gap-2.5 pr-1 pb-4">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <ClipboardList className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">{'\uD300\uC6CC\uD06C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4'}</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id}>
              {item.type === 'message' ? (
                <div className="bg-slate-50 rounded-xl p-3 flex gap-3 group relative">
                  <div className="w-7 h-7 rounded-full bg-brand/10 text-brand text-xs flex items-center justify-center font-bold shrink-0">
                    {item.authorName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-800">{item.authorName}</span>
                      <span className="text-[11px] text-slate-400">{timeAgo(item.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.content}</p>
                  </div>
                  <button onClick={() => togglePin(item.id)}
                    className={`absolute top-3 right-3 p-1 rounded-md transition-colors cursor-pointer ${item.isPinned ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100'}`}>
                    <Pin className={`w-4 h-4 ${item.isPinned ? 'fill-current' : ''}`} />
                  </button>
                </div>
              ) : (
                <div className={`bg-white rounded-xl p-3.5 border border-slate-100 border-l-4 ${getStatusBorder(item.taskStatus)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-800">
                        {'\uD83D\uDCCB'} {item.authorName}{'\uC758 \uC5C5\uBB34 \uC694\uCCAD'}
                      </span>
                      {item.priority && (
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${priorityConfig[item.priority].color}`}>
                          {priorityConfig[item.priority].label}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(item.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-700 mb-3 whitespace-pre-wrap">{item.content}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      {item.assigneeName && (
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{'\uB2F4\uB2F9'}: <strong>{item.assigneeName}</strong></span>
                        </div>
                      )}
                      {item.dueDate && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{'\uAE30\uD55C'}: {item.dueDate.slice(5)}
                            <strong className={`ml-1 ${getDDay(item.dueDate).startsWith('D+') ? 'text-red-500' : 'text-brand'}`}>
                              ({getDDay(item.dueDate)})
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.taskStatus === 'pending' && (
                        <button onClick={() => updateTaskStatus(item.id, 'in_progress')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg active:scale-[0.98] cursor-pointer">
                          {'\uC2DC\uC791'}
                        </button>
                      )}
                      {item.taskStatus === 'in_progress' && completingTaskId !== item.id && (
                        <button onClick={() => setCompletingTaskId(item.id)}
                          className="px-2.5 py-1 bg-brand text-white text-xs font-bold rounded-lg active:scale-[0.98] cursor-pointer">
                          {'\uC644\uB8CC'}
                        </button>
                      )}
                      {item.taskStatus === 'completed' && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {'\uC644\uB8CC\uB428'}
                        </span>
                      )}
                    </div>
                  </div>
                  {completingTaskId === item.id && (
                    <div className="mt-3 flex gap-2">
                      <input type="text" value={completionNote} onChange={(e) => setCompletionNote(e.target.value)}
                        placeholder={'\uC644\uB8CC \uBA54\uBAA8 (\uC120\uD0DD)'}
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" autoFocus />
                      <button onClick={() => { updateTaskStatus(item.id, 'completed', completionNote); setCompletingTaskId(null); setCompletionNote(''); }}
                        className="px-3 py-1.5 bg-brand text-white text-xs font-bold rounded-lg active:scale-[0.98] cursor-pointer">
                        {'\uD655\uC778'}
                      </button>
                      <button onClick={() => { setCompletingTaskId(null); setCompletionNote(''); }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg active:scale-[0.98] cursor-pointer">
                        {'\uCDE8\uC18C'}
                      </button>
                    </div>
                  )}
                  {item.taskStatus === 'completed' && item.completionNote && (
                    <div className="mt-2 bg-slate-50 p-2 rounded-lg text-sm text-slate-600 flex items-start gap-2 border border-slate-100">
                      <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                      <span>{item.completionNote}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 pt-3 mt-auto">
        {isTaskMode && (
          <div className="flex flex-wrap gap-2 mb-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
              <label className="text-[10px] font-bold text-slate-500">{'\uB2F4\uB2F9\uC790'}</label>
              <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                <option value="">{'\uC120\uD0DD'}</option>
                {staffMembers.filter(s => s.isActive).map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
              <label className="text-[10px] font-bold text-slate-500">{'\uC6B0\uC120\uC21C\uC704'}</label>
              <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as any)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
              <label className="text-[10px] font-bold text-slate-500">{'\uAE30\uD55C'}</label>
              <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5" />
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button onClick={() => setIsTaskMode(!isTaskMode)}
            className={`p-2.5 rounded-xl transition-colors active:scale-[0.98] cursor-pointer ${isTaskMode ? 'bg-brand/10 text-brand border border-brand/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent'}`}
            title={'\uC5C5\uBB34 \uB4F1\uB85D \uBAA8\uB4DC'}>
            <ClipboardList className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder={isTaskMode ? '\uC5C5\uBB34 \uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694...' : '\uBA54\uC2DC\uC9C0\uB97C \uC785\uB825\uD558\uC138\uC694... (Enter\uB85C \uC804\uC1A1)'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white focus:border-brand focus:ring-1 focus:ring-brand resize-none transition-colors"
              rows={1} style={{ minHeight: '44px', maxHeight: '120px' }} />
          </div>
          <button onClick={handleSubmit} disabled={!inputValue.trim()}
            className="p-2.5 bg-brand text-white rounded-xl hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer shrink-0">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
