// 사건(또는 영업 리드) 소통 기록 — 서버 원본 (CL-5·CL-6·KT-1)
// 연락처(업무폰이 아는 번호) · 통화·문자·카톡·방문 기록 · 녹음(기기·서버 지문) · 업무폰으로 걸기/문자
// 기록 내용은 고칠 수 없고 메모와 연결(사유)만 바꾼다. 녹음은 들을 때마다 열람 기록이 남는다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, Copy, FileAudio, FileText, Link2, MessageCircle, Phone, PhoneIncoming, PhoneOutgoing, Plus, RefreshCw,
  ShieldCheck, ShieldAlert, Trash2, Upload, Footprints, StickyNote, Smartphone,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../../supabaseClient';
import { useDialog } from '../../common/DialogProvider';
import { canUse } from '../../../services/office/officePermissions';
import { confirmClientCopy } from '../../../services/proposalCompliance';
import {
  CHANNEL_LABEL, RELATION_LABEL, TEMPLATE_PURPOSE_LABEL, describeLog, formatPhone,
  getRecordingPlayUrl, listCommLogs, listCommTemplates, listContacts, listOfficeDevices, listRecordings,
  recordManualLog, relinkCommLog, removeContact, saveContact, sendDeviceCommand, setCommLogNote, uploadRecording,
  type CallRecording, type ClientContact, type CommLog, type CommTarget, type CommTemplate, type ContactRelation, type ManualLogInput, type OfficeDevice,
} from '../../../services/comm/commService';
import { listNoticeTasks } from '../../../services/comm/clientNoticeService';
import KakaoNoticeSection from './KakaoNoticeSection';
import KakaoExportImportModal from './KakaoExportImportModal';

interface Props {
  officeId: string;
  target: CommTarget;
  /** 서버 사무소 권한표 */
  permissions?: Record<string, string> | null;
  /** 연결 바꾸기 대상 (사건 작업 공간 키 → 화면 이름) */
  caseOptions?: Array<{ key: string; label: string }>;
  defaultOpen?: boolean;
}

const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function LogIcon({ log }: { log: CommLog }) {
  const cls = 'w-4 h-4';
  if (log.channel === 'call') return log.direction === 'in' ? <PhoneIncoming className={cls} aria-hidden="true" /> : <PhoneOutgoing className={cls} aria-hidden="true" />;
  if (log.channel === 'visit') return <Footprints className={cls} aria-hidden="true" />;
  return <MessageCircle className={cls} aria-hidden="true" />;
}

function RecordingBadge({ rec }: { rec: CallRecording }) {
  if (rec.status === 'verified') return <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold"><ShieldCheck className="w-3 h-3" aria-hidden="true" />지문 일치</span>;
  if (rec.status === 'mismatch') return <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 text-[11px] font-bold"><ShieldAlert className="w-3 h-3" aria-hidden="true" />지문 불일치</span>;
  if (rec.status === 'failed') return <span className="rounded-lg bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-bold">올리지 못함</span>;
  return <span className="rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-bold">확인 중</span>;
}

export default function CaseCommPanel({ officeId, target, permissions, caseOptions, defaultOpen = false }: Props) {
  const dialog = useDialog();
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [myDevice, setMyDevice] = useState<OfficeDevice | null>(null);
  const [mode, setMode] = useState<'none' | 'contact' | 'manual' | 'kakao' | 'sms'>('none');
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadLogId, setUploadLogId] = useState<string | null>(null);
  // 카톡 안내·대화 백업 (KT-2·KT-4)
  const [exportLines, setExportLines] = useState<CommLog[]>([]);
  const [showExportLines, setShowExportLines] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [pendingNotices, setPendingNotices] = useState(0);
  const [noticeReload, setNoticeReload] = useState(0);

  // 알림·업무함에서 '소통 기록'으로 들어오면 펼친다
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);

  // 접혀 있어도 보낼 카톡 안내 수는 보여 준다
  const refreshPendingNotices = useCallback(async () => {
    if (!isSupabaseConfigured || !officeId || !target.workspaceKey) return;
    const r = await listNoticeTasks(officeId, target.workspaceKey, false);
    if (r.ok) setPendingNotices(r.data.filter(t => t.status === 'pending' || t.status === 'fallback_failed').length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId, target.workspaceKey]);
  useEffect(() => { void refreshPendingNotices(); }, [refreshPendingNotices]);

  const canContact = canUse(permissions, 'client.contact');
  const canRecording = canUse(permissions, 'comm.recording');
  const targetKey = target.workspaceKey || `lead:${target.salesLeadId || ''}`;

  // 폼 상태
  const [contactForm, setContactForm] = useState<{ phone: string; relation: ContactRelation; label: string; error: string }>({ phone: '', relation: 'self', label: '', error: '' });
  const [manual, setManual] = useState<ManualLogInput & { at: string; minutes: string }>({ channel: 'call', direction: 'out', at: toLocalInput(new Date()), minutes: '', body: '', note: '' });
  const [message, setMessage] = useState('');
  const [smsContactId, setSmsContactId] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !officeId || (!target.workspaceKey && !target.salesLeadId)) return;
    setLoading(true);
    const [c, l, r, t, d, u, x] = await Promise.all([
      listContacts(officeId, target), listCommLogs(officeId, target, 200, { kakaoExport: 'exclude' }), listRecordings(officeId, target),
      listCommTemplates(officeId), listOfficeDevices(officeId), supabase.auth.getUser(),
      listCommLogs(officeId, target, 300, { kakaoExport: 'only' }),
    ]);
    setLoading(false);
    if (!l.ok) { setError(l.message); return; }
    setError('');
    setLogs(l.data);
    setExportLines(x.ok ? x.data : []);
    setContacts(c.ok ? c.data : []);
    setRecordings(r.ok ? r.data : []);
    setTemplates(t.ok ? t.data : []);
    const uid = u.data.user?.id;
    setMyDevice(d.ok ? (d.data.find(x => x.userId === uid && x.status === 'active') || null) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeId, targetKey]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const recByLog = useMemo(() => {
    const m = new Map<string, CallRecording[]>();
    for (const r of recordings) if (r.commLogId) m.set(r.commLogId, [...(m.get(r.commLogId) || []), r]);
    return m;
  }, [recordings]);
  const looseRecordings = recordings.filter(r => !r.commLogId || !logs.some(l => l.id === r.commLogId));

  // ── 연락처 ──
  const addContact = async () => {
    const digits = contactForm.phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 13) { setContactForm(f => ({ ...f, error: '전화번호를 확인해 주세요.' })); return; }
    setBusy(true);
    const res = await saveContact(officeId, target, { phone: contactForm.phone, relation: contactForm.relation, label: contactForm.label });
    setBusy(false);
    if (!res.ok) { setContactForm(f => ({ ...f, error: res.message })); return; }
    if (res.data.sharedCount > 0) toast.warning('같은 번호가 다른 사건에도 등록돼 있어요. 이 번호의 통화는 \'확인 필요\'로 들어와요.');
    else toast.success('번호를 등록했어요. 업무폰이 다음 동기화 때 이 번호의 통화·문자를 기록해요.');
    setContactForm({ phone: '', relation: 'self', label: '', error: '' });
    setMode('none');
    void load();
  };

  const deleteContact = async (c: ClientContact) => {
    const ok = await dialog.confirm({ title: '번호 등록 해제', message: `${formatPhone(c.phone)} 번호를 이 사건에서 빼요. 이미 남은 기록은 그대로예요.`, confirmText: '빼기', variant: 'warning' });
    if (!ok) return;
    const res = await removeContact(c.id);
    if (!res.ok) { toast.error(res.message); return; }
    void load();
  };

  const dial = async (c: ClientContact) => {
    if (!myDevice) return;
    const res = await sendDeviceCommand(myDevice.id, 'dial', c.id);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('업무폰에 알림을 보냈어요. 휴대폰 알림을 누르면 다이얼러에 번호가 들어가요(2분 안).');
  };

  // ── 직접 기록 ──
  const saveManual = async () => {
    setBusy(true);
    const minutes = Number(manual.minutes);
    const res = await recordManualLog(officeId, target, {
      channel: manual.channel, direction: manual.direction, result: manual.result,
      occurredAt: manual.at ? new Date(manual.at).toISOString() : undefined,
      durationSec: manual.channel === 'call' && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null,
      body: manual.channel === 'call' || manual.channel === 'visit' ? '' : manual.body, note: manual.note,
    });
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('기록을 남겼어요.');
    setManual({ channel: 'call', direction: 'out', at: toLocalInput(new Date()), minutes: '', body: '', note: '' });
    setMode('none');
    void load();
  };

  // ── 카톡으로 보내기 (KT-1): 문구 확인 → 복사 → 보낸 기록 ──
  const copyForKakao = async () => {
    const text = message.trim();
    if (!text) { toast.error('보낼 내용을 적어 주세요.'); return; }
    const ok = await confirmClientCopy(text, 'kakao', (o) => dialog.prompt(o), (m) => toast.error(m));
    if (!ok) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error('복사하지 못했어요. 내용을 직접 선택해 복사해 주세요.');
      return;
    }
    setBusy(true);
    const res = await recordManualLog(officeId, target, { channel: 'kakao', direction: 'out', body: text });
    setBusy(false);
    if (!res.ok) { toast.error(`복사는 했지만 기록을 남기지 못했어요: ${res.message}`); return; }
    toast.success('복사했어요. 카카오톡 대화방에 붙여 넣어 보내 주세요. 보낸 기록을 남겼어요.');
    setMessage('');
    setMode('none');
    void load();
  };

  // ── 업무폰으로 문자 ──
  const sendSms = async () => {
    const text = message.trim();
    if (!myDevice || !smsContactId || !text) { toast.error('번호와 내용을 확인해 주세요.'); return; }
    const ok = await confirmClientCopy(text, 'sms', (o) => dialog.prompt(o), (m) => toast.error(m));
    if (!ok) return;
    setBusy(true);
    const res = await sendDeviceCommand(myDevice.id, 'sms', smsContactId, text);
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('업무폰으로 보냈어요. 휴대폰이 문자를 보내면 기록에 \'문자 보냄\'으로 남아요(30분 안).');
    setMessage('');
    setMode('none');
  };

  // ── 메모·연결 바꾸기 ──
  const editNote = async (l: CommLog) => {
    const note = await dialog.prompt({ title: '통화 메모', message: '이 기록에 메모를 남겨요. 기록 내용은 바뀌지 않아요.', defaultValue: l.note || '' });
    if (note === null) return;
    const res = await setCommLogNote(l.id, note, l.nextContactAt);
    if (!res.ok) { toast.error(res.message); return; }
    void load();
  };

  const relink = async (l: CommLog) => {
    const others = (caseOptions || []).filter(o => o.key !== target.workspaceKey);
    if (others.length === 0) { toast.info('옮길 수 있는 다른 사건이 없어요.'); return; }
    const list = others.slice(0, 30).map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    const pick = await dialog.prompt({ title: '다른 사건으로 옮기기', message: `옮길 사건 번호를 적어 주세요.\n${list}`, placeholder: '예: 1' });
    if (!pick) return;
    const chosen = others[Number(pick) - 1];
    if (!chosen) { toast.error('목록의 번호를 적어 주세요.'); return; }
    const reason = await dialog.prompt({ title: '옮기는 사유', message: '사유는 기록 이력에 남아요.', placeholder: '예: 배우자 번호라 본 사건으로 옮김' });
    if (!reason || !reason.trim()) return;
    const res = await relinkCommLog(l.id, { workspaceKey: chosen.key }, reason.trim());
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`'${chosen.label}' 사건으로 옮겼어요.`);
    void load();
  };

  // ── 녹음 ──
  const pickRecording = (logId: string | null) => { setUploadLogId(logId); fileRef.current?.click(); };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    const t = toast.loading('녹음을 올리고 지문을 확인하는 중…');
    const res = await uploadRecording(officeId, target, f, { commLogId: uploadLogId });
    setBusy(false);
    toast.dismiss(t);
    if (!res.ok) { toast.error(res.message); void load(); return; }
    if (res.data.status === 'verified') toast.success('녹음을 올렸어요. 올린 파일과 서버 파일의 지문이 같아요.');
    else toast.error('올린 파일의 지문이 다르게 나왔어요. 원본 파일을 다시 올려 주세요.');
    void load();
  };

  const play = async (rec: CallRecording, action: 'play' | 'download') => {
    const res = await getRecordingPlayUrl(rec.id, action);
    if (!res.ok) { toast.error(res.message); return; }
    if (action === 'download') { window.open(res.data, '_blank', 'noopener'); return; }
    setPlaying({ id: rec.id, url: res.data });
  };

  const recordingRow = (rec: CallRecording) => (
    <div key={rec.id} className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FileAudio className="w-4 h-4 text-slate-500" aria-hidden="true" />
        <span className="font-bold text-slate-800 truncate max-w-[220px]">{rec.originalName || '통화 녹음'}</span>
        <RecordingBadge rec={rec} />
        {rec.deviceId ? <span className="text-slate-500">업무폰 자동 업로드</span> : <span className="text-slate-500">직접 올림</span>}
        {canRecording && (rec.status === 'verified' || rec.status === 'mismatch') && (
          <span className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => void play(rec, 'play')} className="min-h-9 px-3 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 active:scale-[0.98] whitespace-nowrap">듣기</button>
            <button type="button" onClick={() => void play(rec, 'download')} className="min-h-9 px-3 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 active:scale-[0.98] whitespace-nowrap">내려받기</button>
          </span>
        )}
      </div>
      {rec.serverSha256 && <p className="mt-1 text-[11px] text-slate-500 break-all">서버 지문 {rec.serverSha256.slice(0, 16)}… · 확인 {fmtTime(rec.verifiedAt)}</p>}
      {playing?.id === rec.id && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio className="mt-2 w-full" controls autoPlay src={playing.url} onError={() => toast.error('재생 주소가 만료됐어요. 듣기를 다시 눌러 주세요.')} />
      )}
    </div>
  );

  if (!isSupabaseConfigured || !officeId) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:scale-[0.99]" aria-expanded={open}>
        <span className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
          <Phone className="w-4 h-4 text-brand" aria-hidden="true" />소통 기록
          {open && logs.length > 0 && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{logs.length}건</span>}
          {pendingNotices > 0 && <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">보낼 카톡 {pendingNotices}</span>}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          통화·문자·카톡·방문·녹음
          {open ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {/* 의뢰인 카톡 이름 · 담당자 카톡으로 보낼 안내 (사건만, 영업 리드는 없음) */}
          {target.workspaceKey && (
            <KakaoNoticeSection key={`notice-${noticeReload}`} officeId={officeId} workspaceKey={target.workspaceKey}
              onChanged={() => { void refreshPendingNotices(); void load(); }} />
          )}

          {/* 연락처 */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold text-slate-700">업무폰이 기록하는 번호</h4>
              {canContact && (
                <button type="button" onClick={() => setMode(mode === 'contact' ? 'none' : 'contact')} className="inline-flex items-center gap-1 min-h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap">
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />번호 등록
                </button>
              )}
            </div>
            {contacts.length === 0 && !loading && (
              <p className="mt-1.5 text-xs text-slate-500">등록한 번호가 없어요. 번호를 등록하면 연결된 업무폰이 그 번호와 주고받은 통화·문자만 기록해요.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-1 py-1 text-xs">
                  <span className="font-bold text-slate-800">{formatPhone(c.phone)}</span>
                  <span className="rounded-lg bg-white border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">{RELATION_LABEL[c.relation]}{c.label ? ` · ${c.label}` : ''}</span>
                  {myDevice && (
                    <button type="button" onClick={() => void dial(c)} title="업무폰으로 걸기" className="min-h-8 px-2 rounded-lg text-brand font-bold hover:bg-white active:scale-[0.98] whitespace-nowrap">걸기</button>
                  )}
                  {canContact && (
                    <button type="button" onClick={() => void deleteContact(c)} aria-label="번호 빼기" className="min-h-8 px-2 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-white active:scale-[0.98]"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  )}
                </div>
              ))}
            </div>
            {mode === 'contact' && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2">
                <input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value, error: '' }))} inputMode="tel" placeholder="010-0000-0000" aria-label="전화번호" className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                <select value={contactForm.relation} onChange={e => setContactForm(f => ({ ...f, relation: e.target.value as ContactRelation }))} aria-label="관계" className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm">
                  {(Object.keys(RELATION_LABEL) as ContactRelation[]).map(r => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
                </select>
                <input value={contactForm.label} onChange={e => setContactForm(f => ({ ...f, label: e.target.value }))} maxLength={40} placeholder="메모 (예: 퇴근 후 연락)" aria-label="번호 메모" className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm" />
                <button type="button" disabled={busy} onClick={() => void addContact()} className="min-h-10 px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-60 active:scale-[0.98] whitespace-nowrap">등록</button>
                {contactForm.error && <p className="sm:col-span-4 text-xs text-rose-700">{contactForm.error}</p>}
              </div>
            )}
          </div>

          {/* 동작 버튼 */}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode(mode === 'manual' ? 'none' : 'manual')} className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap"><StickyNote className="w-4 h-4" aria-hidden="true" />직접 기록</button>
            <button type="button" onClick={() => setMode(mode === 'kakao' ? 'none' : 'kakao')} className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap"><Copy className="w-4 h-4" aria-hidden="true" />카톡으로 보내기</button>
            {myDevice && contacts.length > 0 && (
              <button type="button" onClick={() => { setMode(mode === 'sms' ? 'none' : 'sms'); setSmsContactId(contacts[0]?.id || ''); }} className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap"><Smartphone className="w-4 h-4" aria-hidden="true" />업무폰으로 문자</button>
            )}
            {canRecording && (
              <button type="button" disabled={busy} onClick={() => pickRecording(null)} className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 active:scale-[0.98] whitespace-nowrap"><Upload className="w-4 h-4" aria-hidden="true" />녹음 올리기</button>
            )}
            <button type="button" onClick={() => setShowExportModal(true)} className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap"><FileText className="w-4 h-4" aria-hidden="true" />카톡 대화 백업</button>
            <button type="button" onClick={() => { void load(); void refreshPendingNotices(); setNoticeReload(n => n + 1); }} aria-label="새로고침" className="ml-auto min-h-10 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98]"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /></button>
            <input ref={fileRef} type="file" accept="audio/*,.m4a,.amr,.3gp" className="hidden" onChange={e => void onFile(e)} />
          </div>

          {mode === 'manual' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">종류
                <select value={manual.channel} onChange={e => setManual(m => ({ ...m, channel: e.target.value as ManualLogInput['channel'] }))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800">
                  {(['call', 'sms', 'kakao', 'visit', 'other'] as const).map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              </label>
              {manual.channel !== 'visit' && (
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">방향
                  <select value={manual.direction} onChange={e => setManual(m => ({ ...m, direction: e.target.value as 'in' | 'out' }))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800">
                    <option value="out">사무소 → 의뢰인</option><option value="in">의뢰인 → 사무소</option>
                  </select>
                </label>
              )}
              {manual.channel === 'call' && (
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">결과
                  <select value={manual.result || 'answered'} onChange={e => setManual(m => ({ ...m, result: e.target.value as ManualLogInput['result'] }))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800">
                    <option value="answered">연결됨</option><option value="missed">부재</option><option value="rejected">거절</option>
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">일시
                <input type="datetime-local" value={manual.at} onChange={e => setManual(m => ({ ...m, at: e.target.value }))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800" />
              </label>
              {manual.channel === 'call' && (
                <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">통화 길이(분)
                  <input type="number" min={0} step={1} value={manual.minutes} onChange={e => setManual(m => ({ ...m, minutes: e.target.value }))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800" />
                </label>
              )}
              {(manual.channel === 'sms' || manual.channel === 'kakao' || manual.channel === 'other') && (
                <label className="col-span-2 sm:col-span-4 flex flex-col gap-1 text-xs font-bold text-slate-600">주고받은 내용
                  <textarea value={manual.body} onChange={e => setManual(m => ({ ...m, body: e.target.value }))} rows={2} maxLength={2000} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" />
                </label>
              )}
              <label className="col-span-2 sm:col-span-4 flex flex-col gap-1 text-xs font-bold text-slate-600">메모
                <textarea value={manual.note} onChange={e => setManual(m => ({ ...m, note: e.target.value }))} rows={2} maxLength={2000} placeholder="통화 요지, 다음에 할 일" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" />
              </label>
              <div className="col-span-2 sm:col-span-4 flex justify-end">
                <button type="button" disabled={busy} onClick={() => void saveManual()} className="min-h-10 px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-60 active:scale-[0.98] whitespace-nowrap">기록 남기기</button>
              </div>
            </div>
          )}

          {(mode === 'kakao' || mode === 'sms') && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs text-slate-600">
                {mode === 'kakao'
                  ? '카카오톡은 자동으로 보내지 않아요. 문구를 확인하고 복사한 뒤 담당자 카카오톡에서 붙여 넣어 보내 주세요. 복사할 때 보낸 기록이 남아요.'
                  : '내 업무폰으로 보내요. 휴대폰이 문자를 보낸 뒤에 기록이 남아요. 사무소 정책의 발송 금지 시간·하루 한도를 따라요.'}
              </p>
              {mode === 'sms' && (
                <select value={smsContactId} onChange={e => setSmsContactId(e.target.value)} aria-label="받는 번호" className="min-h-10 w-full rounded-xl border border-slate-200 px-2 text-sm">
                  {contacts.map(c => <option key={c.id} value={c.id}>{formatPhone(c.phone)} · {RELATION_LABEL[c.relation]}</option>)}
                </select>
              )}
              {templates.length > 0 && (
                <select defaultValue="" onChange={e => { const t = templates.find(x => x.id === e.target.value); if (t) setMessage(t.body); }} aria-label="문구함에서 고르기" className="min-h-10 w-full rounded-xl border border-slate-200 px-2 text-sm">
                  <option value="">문구함에서 고르기</option>
                  {templates.map(t => <option key={t.id} value={t.id}>[{TEMPLATE_PURPOSE_LABEL[t.purpose]}] {t.title}</option>)}
                </select>
              )}
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={2000} aria-label="보낼 내용" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <div className="flex justify-end">
                <button type="button" disabled={busy} onClick={() => void (mode === 'kakao' ? copyForKakao() : sendSms())} className="min-h-10 px-4 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-60 active:scale-[0.98] whitespace-nowrap">
                  {mode === 'kakao' ? '복사하고 기록 남기기' : '업무폰으로 보내기'}
                </button>
              </div>
            </div>
          )}

          {/* 타임라인 */}
          {loading && logs.length === 0 ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" onClick={() => void load()} className="min-h-9 px-3 rounded-xl bg-white border border-rose-200 font-bold whitespace-nowrap active:scale-[0.98]">다시 불러오기</button>
            </div>
          ) : logs.length === 0 && looseRecordings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
              <Phone className="w-6 h-6 mx-auto text-slate-400" aria-hidden="true" />
              <p className="mt-1.5 text-sm font-bold text-slate-700">아직 소통 기록이 없어요</p>
              <p className="mt-0.5 text-xs text-slate-500">번호를 등록하고 업무폰을 연결하면 통화·문자가 자동으로 쌓여요. 사무실 전화·방문은 '직접 기록'으로 남겨 주세요.</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {logs.map(l => (
                <li key={l.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${l.result === 'missed' || l.result === 'rejected' || l.result === 'failed' ? 'bg-amber-50 text-amber-700' : 'bg-brand/10 text-brand'}`}><LogIcon log={l} /></span>
                    <span className="font-bold text-slate-800">{describeLog(l)}</span>
                    <span className="text-slate-500">{fmtTime(l.occurredAt)}</span>
                    {l.lineLabel && <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{l.lineLabel}</span>}
                    {l.linkStatus === 'needs_review' && <span className="rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[11px] font-bold">확인 필요</span>}
                    <span className="ml-auto flex gap-1">
                      <button type="button" onClick={() => void editNote(l)} className="min-h-8 px-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold whitespace-nowrap active:scale-[0.98]">메모</button>
                      {caseOptions && caseOptions.length > 1 && (
                        <button type="button" onClick={() => void relink(l)} title="다른 사건으로 옮기기" className="min-h-8 px-2 rounded-lg text-slate-600 hover:bg-slate-100 active:scale-[0.98]"><Link2 className="w-3.5 h-3.5" aria-label="다른 사건으로 옮기기" /></button>
                      )}
                      {canRecording && l.channel === 'call' && !(recByLog.get(l.id) || []).some(r => r.status === 'verified') && (
                        <button type="button" onClick={() => pickRecording(l.id)} className="min-h-8 px-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold whitespace-nowrap active:scale-[0.98]">녹음 붙이기</button>
                      )}
                    </span>
                  </div>
                  {l.body && <p className="mt-1.5 text-sm text-slate-700 whitespace-pre-wrap break-words line-clamp-4">{l.body}</p>}
                  {l.note && <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1 whitespace-pre-wrap">메모: {l.note}</p>}
                  {l.linkHistory.length > 0 && <p className="mt-1 text-[11px] text-slate-500">연결 변경 {l.linkHistory.length}회 · 마지막 사유: {String(l.linkHistory[l.linkHistory.length - 1]?.reason || '')}</p>}
                  {(recByLog.get(l.id) || []).map(recordingRow)}
                </li>
              ))}
              {looseRecordings.map(r => <li key={r.id}>{recordingRow(r)}</li>)}
            </ol>
          )}

          {/* 카톡 대화 백업 줄 (따로 접어 둔다: 많아서 다른 기록을 가리지 않게) */}
          {exportLines.length > 0 && (
            <div className="rounded-xl border border-slate-200">
              <button type="button" onClick={() => setShowExportLines(s => !s)} aria-expanded={showExportLines} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">
                <span>카톡 대화 백업 {exportLines.length >= 300 ? '최근 300' : exportLines.length}줄</span>
                {showExportLines ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
              </button>
              {showExportLines && (
                <ol className="border-t border-slate-100 max-h-[420px] overflow-y-auto divide-y divide-slate-50">
                  {exportLines.map(l => (
                    <li key={l.id} className={`px-3 py-2 text-sm ${l.direction === 'in' ? '' : 'bg-slate-50/60'}`}>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className={`font-bold ${l.direction === 'in' ? 'text-amber-800' : 'text-brand'}`}>{l.senderName || (l.direction === 'in' ? '의뢰인' : '사무소')}</span>
                        <span>{fmtTime(l.occurredAt)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800">{l.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
          <p className="text-[11px] text-slate-500">기록 내용은 고칠 수 없어요(메모·연결만 바뀌고 이력이 남아요). 녹음을 듣거나 대화 원본을 내려받으면 열람 기록이 남아요.</p>
        </div>
      )}
      {showExportModal && (
        <KakaoExportImportModal officeId={officeId} target={target} onClose={() => setShowExportModal(false)} onImported={() => void load()} />
      )}
    </section>
  );
}
