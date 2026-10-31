// ============================================================
// 통합어드민 › 콘텐츠 › 문의함 (CT-8, CT-Q4)
// 의뢰인(회원·비회원)·변호사 문의를 한 화면에서. 상태 4개·담당·처리 기한(접수 + 2영업일), 답변 문구함.
// 의뢰인 문의는 /api/inquiry(서버가 첨부 비공개 저장소·첫 답변 알림·조치 기록), 변호사 문의는 서버 표(lawyer_inquiries).
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Paperclip, RefreshCw, Search } from 'lucide-react';
import type React from 'react';
import type { LawyerInquiry } from '../../types';
import { useDialog } from '../common/DialogProvider';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { DEFAULT_PROHIBITED_EXPRESSIONS, findProhibitedExpressions } from '../../services/proposalCompliance';
import { signInquiryAttachments } from '../../services/cms/inquiryFiles';
import {
  INQUIRY_STATUS_LABEL, adminLoadInquiries, adminReplyInquiry, adminUpdateInquiry, inquiryDueInfo,
  type AdminInquiry, type InquiryStatus,
} from '../../services/inquiryService';

type Source = 'all' | 'client' | 'lawyer';
type StatusFilter = 'open' | InquiryStatus | 'all';

interface Row {
  key: string;
  source: 'client' | 'lawyer';
  id: string;
  writer: string;
  writerSub: string;
  title: string;
  content: string;
  category?: string;
  status: InquiryStatus;
  assignee?: string;
  createdAt: string;
  dueAt?: string;
  reply?: string;
  repliedAt?: string;
  contactInfo?: string;
  attachments: { fileName: string; fileSize: number; fileType: string; url?: string; path?: string }[];
  notice?: AdminInquiry['replyNotice'];
}

interface Template { id: string; title: string; body: string; audience: 'all' | 'client' | 'lawyer' }

const CLIENT_CATEGORY: Record<string, string> = {
  site_usage: '사이트 이용', account: '회원가입·로그인', diagnosis: '내 상황 체크', lawyer_matching: '변호사 찾기',
  payment: '결제', bug_report: '오류 신고', suggestion: '제안', privacy: '개인정보', report: '신고', other: '기타',
};
const LAWYER_CATEGORY: Record<string, string> = {
  platform_usage: '플랫폼 사용법', feature_request: '기능 개선 제안', billing_contract: '요금·계약', ad_marketing: '광고', other: '기타',
};
const STATUS_TONE: Record<InquiryStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  in_progress: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  replied: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  closed: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
};
const NOTICE_LABEL: Record<string, string> = { app: '앱 알림', email: '이메일', sms: '문자' };
const normStatus = (s: string | undefined): InquiryStatus => (s === 'in_progress' || s === 'replied' || s === 'closed' ? s : 'pending');

export default function InquiryBoxPanel({ lawyerInquiries, setLawyerInquiries, adminEmail }: {
  lawyerInquiries: LawyerInquiry[];
  setLawyerInquiries: React.Dispatch<React.SetStateAction<LawyerInquiry[]>>;
  adminEmail: string;
}) {
  const dialog = useDialog();
  const [clientItems, setClientItems] = useState<AdminInquiry[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [source, setSource] = useState<Source>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  // 변호사 문의 첨부(비공개 저장소)는 고를 때 5분 주소를 만든다
  const [lawyerUrls, setLawyerUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!selectedKey.startsWith('l:')) return;
    const inq = lawyerInquiries.find(i => `l:${i.id}` === selectedKey);
    const need = (inq?.attachments || []).filter(a => a.path && !lawyerUrls[a.path]);
    if (need.length === 0) return;
    void signInquiryAttachments(need).then(m => setLawyerUrls(prev => ({ ...prev, ...m })));
  }, [selectedKey, lawyerInquiries, lawyerUrls]);

  const loadClient = useCallback(async () => {
    setLoadError('');
    const r = await adminLoadInquiries();
    if (r.ok === false) { setLoadError(r.error); setClientItems([]); return; }
    setClientItems(r.items);
  }, []);
  const loadTemplates = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.from('admin_reply_templates').select('id, title, body, audience').order('sort_order').order('title');
    setTemplates((data || []) as Template[]);
  }, []);
  useEffect(() => { void loadClient(); void loadTemplates(); }, [loadClient, loadTemplates]);

  const rows: Row[] = useMemo(() => {
    const c: Row[] = (clientItems || []).map(i => ({
      key: `c:${i.id}`, source: 'client', id: i.id, writer: i.clientName || (i.isMember ? '회원' : '비회원'), writerSub: i.isMember ? '회원' : '비회원',
      title: i.title, content: i.content, category: i.category ? CLIENT_CATEGORY[i.category] || i.category : undefined,
      status: normStatus(i.status), assignee: i.assignee, createdAt: i.createdAt, dueAt: i.dueAt, reply: i.replyContent, repliedAt: i.repliedAt,
      contactInfo: i.isMember ? undefined : i.contactInfo,
      attachments: (i.attachments || []).map(a => ({ fileName: a.fileName, fileSize: a.fileSize, fileType: a.fileType, url: a.dataUrl || undefined })),
      notice: i.replyNotice,
    }));
    const l: Row[] = lawyerInquiries.map(i => ({
      key: `l:${i.id}`, source: 'lawyer', id: i.id, writer: i.lawyerName, writerSub: '변호사',
      title: i.title, content: i.content, category: LAWYER_CATEGORY[i.category] || i.category,
      status: normStatus(i.status), assignee: i.assignee, createdAt: i.createdAt, reply: i.replyContent, repliedAt: i.repliedAt,
      attachments: (i.attachments || []).map(a => ({ fileName: a.fileName, fileSize: a.fileSize, fileType: a.fileType, url: a.dataUrl || lawyerUrls[a.path || ''] || undefined, path: a.path })),
    }));
    return [...c, ...l].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [clientItems, lawyerInquiries, lawyerUrls]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r =>
      (source === 'all' || r.source === source) &&
      (statusFilter === 'all' ? true : statusFilter === 'open' ? (r.status === 'pending' || r.status === 'in_progress') : r.status === statusFilter) &&
      (!q || r.title.toLowerCase().includes(q) || r.writer.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)));
  }, [rows, source, statusFilter, query]);

  const counts = useMemo(() => ({
    open: rows.filter(r => r.status === 'pending' || r.status === 'in_progress').length,
    overdue: rows.filter(r => inquiryDueInfo(r.createdAt, r.dueAt, r.status)?.overdue).length,
  }), [rows]);

  const selected = rows.find(r => r.key === selectedKey) || null;
  const select = (r: Row) => { setSelectedKey(r.key); setReplyText(r.reply || ''); };

  // ── 바꾸기 ──
  const patchLawyer = (id: string, patch: Partial<LawyerInquiry>) =>
    setLawyerInquiries(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const updateMeta = async (r: Row, patch: { status?: InquiryStatus; assignee?: string }) => {
    if (patch.status === 'replied' && !r.reply) { toast.error('답변을 먼저 작성해 주세요.'); return; }
    if (r.source === 'client') {
      setBusy(true);
      const res = await adminUpdateInquiry(r.id, patch);
      setBusy(false);
      if (res.ok === false) { toast.error(res.error); return; }
      setClientItems(prev => (prev || []).map(i => (i.id === r.id ? { ...i, status: res.item.status, assignee: res.item.assignee } : i)));
    } else {
      patchLawyer(r.id, { ...(patch.status ? { status: patch.status } : {}), ...(patch.assignee !== undefined ? { assignee: patch.assignee || undefined } : {}) });
    }
    toast.success(patch.status ? `상태를 '${INQUIRY_STATUS_LABEL[patch.status]}'(으)로 바꿨어요.` : '담당자를 바꿨어요.');
  };

  const sendReply = async (r: Row, text: string) => {
    const hits = findProhibitedExpressions(text, undefined, DEFAULT_PROHIBITED_EXPRESSIONS);
    if (hits.length > 0) {
      const ok = await dialog.confirm({ title: '주의할 표현이 있어요', message: `${hits.join(', ')} 표현이 들어 있습니다. 그대로 보낼까요?`, confirmText: '그대로 보내기', variant: 'warning' });
      if (!ok) return;
    }
    if (r.source === 'client') {
      setBusy(true);
      const res = await adminReplyInquiry(r.id, text);
      setBusy(false);
      if (res.ok === false) { toast.error(`답변을 저장하지 못했어요: ${res.error}`); return; }
      setClientItems(prev => (prev || []).map(i => (i.id === r.id ? { ...i, ...res.item } : i)));
      const n = res.item.replyNotice;
      if (!r.reply && n) {
        const sent = n.sent.map(c => NOTICE_LABEL[c] || c).join('·');
        const failed = n.failed.map(c => NOTICE_LABEL[c] || c).join('·');
        if (failed) toast.warning(`답변을 저장했어요. ${sent ? `${sent}로 알렸고 ` : ''}${failed} 알림은 보내지 못했어요.`);
        else toast.success(sent ? `답변을 저장하고 ${sent}로 알렸어요.` : '답변을 저장했어요. 연락처가 없어 따로 알리지 못했어요(문의번호로 조회).');
      } else {
        toast.success(text ? '답변을 고쳤어요. 고친 답변은 다시 알리지 않아요.' : '답변을 지웠어요.');
      }
    } else {
      patchLawyer(r.id, text
        ? { replyContent: text, repliedAt: new Date().toISOString(), status: r.status === 'closed' ? 'closed' : 'replied', assignee: r.assignee || adminEmail || undefined }
        : { replyContent: undefined, repliedAt: undefined, status: 'in_progress' });
      toast.success(text ? '답변을 저장했어요. 변호사에게 알림이 가요.' : '답변을 지웠어요.');
    }
  };

  // ── 문구함 ──
  const saveTemplate = async () => {
    const body = replyText.trim();
    if (!body) { toast.error('문구함에 넣을 답변을 먼저 써 주세요.'); return; }
    const title = await dialog.prompt({ title: '답변 문구함에 저장', message: '문구 이름을 적어 주세요.', placeholder: '예: 로그인 안 될 때' });
    if (!title || !title.trim()) return;
    const { error } = await supabase.from('admin_reply_templates').insert({ title: title.trim().slice(0, 60), body: body.slice(0, 4000), audience: selected?.source || 'all' });
    if (error) { toast.error('문구를 저장하지 못했어요.'); return; }
    toast.success('문구함에 저장했어요.');
    void loadTemplates();
  };
  const deleteTemplate = async (t: Template) => {
    const ok = await dialog.confirm({ title: '문구 삭제', message: `'${t.title}' 문구를 지울까요?`, confirmText: '삭제', variant: 'danger' });
    if (!ok) return;
    const { error } = await supabase.from('admin_reply_templates').delete().eq('id', t.id);
    if (error) { toast.error('문구를 지우지 못했어요.'); return; }
    void loadTemplates();
  };

  const field = 'w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-slate-200 text-sm';
  const hits = findProhibitedExpressions(replyText, undefined, DEFAULT_PROHIBITED_EXPRESSIONS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111622] rounded-xl border border-[#1E293B]/60 p-3 text-sm text-slate-300">
        <span>열린 문의 <strong className="text-white">{counts.open}</strong>건{counts.overdue > 0 && <span className="text-rose-300 font-bold"> · 기한 지남 {counts.overdue}건</span>} · 처리 기한은 접수 뒤 2영업일(평일 10~18시 운영)</span>
        <button type="button" onClick={() => { setClientItems(null); void loadClient(); }} className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-bold text-slate-200 whitespace-nowrap cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />새로고침
        </button>
      </div>
      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-2 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-200">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />의뢰인 문의를 불러오지 못했어요: {loadError}</span>
          <button type="button" onClick={() => void loadClient()} className="min-h-[40px] px-3 rounded-xl bg-[#0B0F19] border border-rose-500/30 font-bold whitespace-nowrap cursor-pointer">다시 시도</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {([['all', '전체'], ['client', '의뢰인'], ['lawyer', '변호사']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setSource(k)} aria-pressed={source === k}
            className={`min-h-[40px] px-3 rounded-xl text-sm font-bold whitespace-nowrap cursor-pointer ${source === k ? 'bg-indigo-600 text-white' : 'bg-[#111622] border border-[#1E293B]/60 text-slate-300'}`}>{label}</button>
        ))}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} aria-label="상태"
          className="min-h-[40px] rounded-xl bg-[#111622] border border-[#1E293B]/60 px-3 text-sm text-slate-200">
          <option value="open">열린 문의 (접수·확인 중)</option>
          {(Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[]).map(s => <option key={s} value={s}>{INQUIRY_STATUS_LABEL[s]}</option>)}
          <option value="all">전체</option>
        </select>
        <label className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·작성자·문의번호" aria-label="문의 검색"
            className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-[#111622] border border-[#1E293B]/60 text-sm text-slate-200 placeholder:text-slate-500" />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 bg-[#111622] rounded-2xl border border-[#1E293B]/60 overflow-hidden">
          {clientItems === null ? (
            <div className="p-4 space-y-2" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-800/60 animate-pulse" />)}</div>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">{rows.length === 0 ? '아직 접수된 문의가 없어요.' : '조건에 맞는 문의가 없어요.'}</p>
          ) : (
            <ul className="divide-y divide-[#1E293B]/50">
              {visible.map(r => {
                const due = inquiryDueInfo(r.createdAt, r.dueAt, r.status);
                return (
                  <li key={r.key}>
                    <button type="button" onClick={() => select(r)} aria-current={r.key === selectedKey}
                      className={`w-full text-left p-3 space-y-1 cursor-pointer ${r.key === selectedKey ? 'bg-indigo-600/10' : 'hover:bg-[#0B0F19]/50'}`}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${r.source === 'client' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-teal-500/10 text-teal-300 border-teal-500/30'}`}>{r.source === 'client' ? '의뢰인' : '변호사'}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${STATUS_TONE[r.status]}`}>{INQUIRY_STATUS_LABEL[r.status]}</span>
                        {due && <span className={`text-xs font-bold ${due.overdue ? 'text-rose-300' : 'text-slate-400'}`}>{due.label}</span>}
                        {r.attachments.length > 0 && <Paperclip className="w-3.5 h-3.5 text-slate-400" aria-label="첨부 있음" />}
                      </span>
                      <span className="block font-bold text-slate-100 truncate">{r.title}</span>
                      <span className="block text-xs text-slate-400">{r.writer} · {r.writerSub} · {new Date(r.createdAt).toLocaleDateString('ko-KR')}{r.assignee ? ` · 담당 ${r.assignee}` : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="lg:col-span-5 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 space-y-4">
          {!selected ? (
            <p className="py-10 text-center text-sm text-slate-400">왼쪽에서 문의를 고르면 내용과 답변 창이 열려요.</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">{selected.source === 'client' ? '의뢰인' : '변호사'} 문의 · {selected.id}{selected.category ? ` · ${selected.category}` : ''}</p>
                <h3 className="text-base font-extrabold text-white break-words">{selected.title}</h3>
                <p className="text-xs text-slate-400">{selected.writer} · {new Date(selected.createdAt).toLocaleString('ko-KR')}{selected.contactInfo ? ` · 연락처 ${selected.contactInfo}` : ''}</p>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-[#0B0F19] border border-[#1E293B]/50 rounded-xl p-3">{selected.content}</p>
              {selected.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.attachments.map((a, i) => a.url ? (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2 py-1 rounded-lg">{a.fileName} ({Math.ceil(a.fileSize / 1024)}KB)</a>
                  ) : (
                    <span key={i} className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">{a.fileName} (주소를 만들지 못함)</span>
                  ))}
                  {selected.source === 'client' && <span className="text-xs text-slate-500">첨부 주소는 5분 동안만 열려요.</span>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-300 block">상태</span>
                  <select value={selected.status} disabled={busy} onChange={e => void updateMeta(selected, { status: e.target.value as InquiryStatus })}
                    className={`w-full min-h-[40px] rounded-xl border px-2 text-sm font-bold bg-transparent ${STATUS_TONE[selected.status]}`}>
                    {(Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[]).map(s => <option key={s} value={s} className="bg-slate-900 text-slate-100">{INQUIRY_STATUS_LABEL[s]}</option>)}
                  </select>
                </label>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-300 block">담당</span>
                  <div className="flex gap-1">
                    <span className="flex-1 min-h-[40px] flex items-center px-2 rounded-xl bg-[#0B0F19] border border-[#1E293B]/60 text-xs text-slate-200 truncate">{selected.assignee || '없음'}</span>
                    {adminEmail && selected.assignee !== adminEmail && (
                      <button type="button" disabled={busy} onClick={() => void updateMeta(selected, { assignee: adminEmail })} className="min-h-[40px] px-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-100 whitespace-nowrap cursor-pointer">내가 맡기</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-indigo-300">답변</span>
                  {templates.filter(t => t.audience === 'all' || t.audience === selected.source).length > 0 && (
                    <select value="" aria-label="문구함에서 넣기" onChange={e => { const t = templates.find(x => x.id === e.target.value); if (t) setReplyText(prev => (prev ? `${prev}\n\n${t.body}` : t.body)); }}
                      className="min-h-[36px] rounded-xl bg-[#0B0F19] border border-[#1E293B]/60 px-2 text-xs text-slate-200">
                      <option value="">문구함에서 넣기</option>
                      {templates.filter(t => t.audience === 'all' || t.audience === selected.source).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  )}
                </div>
                <textarea rows={7} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="답변을 써 주세요. 법률 판단이 필요한 질문이면 변호사 상담을 안내해 주세요." className={field} />
                {hits.length > 0 && <p className="text-xs text-amber-300" role="status">광고 규정상 주의할 표현: {hits.join(', ')}</p>}
                {selected.source === 'client' && selected.notice && (
                  <p className="text-xs text-slate-400">첫 답변 알림: {selected.notice.sent.length ? selected.notice.sent.map(c => NOTICE_LABEL[c] || c).join('·') : '보낸 곳 없음'}{selected.notice.failed.length ? ` · 실패 ${selected.notice.failed.map(c => NOTICE_LABEL[c] || c).join('·')}` : ''} ({new Date(selected.notice.at).toLocaleString('ko-KR')})</p>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button type="button" onClick={() => void saveTemplate()} className="min-h-[40px] px-3 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-xs font-bold text-slate-200 whitespace-nowrap cursor-pointer">문구함에 저장</button>
                  {selected.reply && (
                    <button type="button" disabled={busy} onClick={async () => {
                      const ok = await dialog.confirm({ title: '답변 지우기', message: '등록한 답변을 지울까요? 상태는 확인 중으로 돌아가요.', confirmText: '지우기', variant: 'danger' });
                      if (ok) { await sendReply(selected, ''); setReplyText(''); }
                    }} className="min-h-[40px] px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-200 whitespace-nowrap cursor-pointer">답변 지우기</button>
                  )}
                  <button type="button" disabled={busy || !replyText.trim()} onClick={() => void sendReply(selected, replyText.trim())}
                    className="min-h-[40px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold whitespace-nowrap disabled:opacity-40 cursor-pointer active:scale-[0.98]">
                    {busy ? '저장 중…' : selected.reply ? '답변 고치기' : '답변 보내기'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">{selected.source === 'client' ? '첫 답변 때 한 번만 알려요: 회원은 앱 알림·이메일, 비회원은 연락처가 휴대폰이면 문자·이메일이면 메일.' : '답변을 저장하면 변호사 화면 종 알림으로 알려요.'}</p>
              </div>

              {templates.length > 0 && (
                <details className="text-xs text-slate-300">
                  <summary className="cursor-pointer font-bold">답변 문구함 ({templates.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {templates.map(t => (
                      <li key={t.id} className="flex items-center justify-between gap-2 bg-[#0B0F19] border border-[#1E293B]/50 rounded-lg px-2 py-1">
                        <span className="truncate">{t.title} <span className="text-slate-500">({t.audience === 'all' ? '공통' : t.audience === 'client' ? '의뢰인' : '변호사'})</span></span>
                        <button type="button" onClick={() => void deleteTemplate(t)} className="text-rose-300 font-bold whitespace-nowrap cursor-pointer">삭제</button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
