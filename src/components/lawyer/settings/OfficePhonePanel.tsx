// 설정 › 업무폰 (CL-3·AP) — 마이김변 업무폰 연결·기기 관리·사무소 정책·등록 요청함·확인 필요 기록·문구함
// 기기 토큰은 서버에 해시만 있고, 연결 코드는 10분·1회용이다. 등록한 번호의 통화·문자만 올라온다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Smartphone, QrCode, RefreshCw, ShieldCheck, Inbox, MessageSquareText, AlertTriangle } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import { supabase } from '../../../supabaseClient';
import { listOfficeMembers, type OfficeMember } from '../../../services/office/officeService';
import { findProhibitedExpressions } from '../../../services/proposalCompliance';
import {
  TEMPLATE_PURPOSE_LABEL, approveDevice, archiveCommTemplate, createPairingCode, describeLog, formatPhone, listCommTemplates,
  listOfficeDevices, listRegisterRequests, listReviewCommLogs, loadCommPolicy, relinkCommLog, resolveRegisterRequest,
  revokeDevice, saveCommPolicy, saveCommTemplate, updateDevice, RELATION_LABEL,
  type CommLog, type CommPolicy, type CommTemplate, type ContactRelation, type OfficeDevice, type PairingCode, type RegisterRequest,
} from '../../../services/comm/commService';

interface Props {
  officeId: string;
  myUserId?: string | null;
  /** 직원·권한 관리 (기기 승인·해지) */
  canManageDevices: boolean;
  /** 사무소 설정 수정 (정책) */
  canEditPolicy: boolean;
  /** 연결할 사건 목록 (작업 공간 키 → 화면 이름) */
  caseOptions: Array<{ key: string; label: string }>;
}

const STATUS_LABEL: Record<OfficeDevice['status'], string> = { pending: '승인 대기', active: '사용 중', revoked: '해지됨' };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function OfficePhonePanel({ officeId, myUserId, canManageDevices, canEditPolicy, caseOptions }: Props) {
  const dialog = useDialog();
  const [devices, setDevices] = useState<OfficeDevice[] | null>(null);
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [policy, setPolicy] = useState<CommPolicy | null>(null);
  const [policyDraft, setPolicyDraft] = useState<CommPolicy | null>(null);
  const [requests, setRequests] = useState<RegisterRequest[]>([]);
  const [review, setReview] = useState<CommLog[]>([]);
  const [templates, setTemplates] = useState<CommTemplate[]>([]);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [pairing, setPairing] = useState<(PairingCode & { qrImage: string }) | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [linkPick, setLinkPick] = useState<Record<string, { key: string; relation: ContactRelation }>>({});
  const [tplForm, setTplForm] = useState<{ id?: string; title: string; body: string; purpose: CommTemplate['purpose'] } | null>(null);
  const [uid, setUid] = useState<string | null>(myUserId ?? null);
  useEffect(() => {
    if (uid) return;
    void supabase.auth.getUser().then(r => setUid(r.data.user?.id ?? null));
  }, [uid]);

  const load = useCallback(async () => {
    const [d, m, p, r, rv, t] = await Promise.all([
      listOfficeDevices(officeId), listOfficeMembers(officeId), loadCommPolicy(officeId),
      listRegisterRequests(officeId), listReviewCommLogs(officeId), listCommTemplates(officeId),
    ]);
    if (!d.ok) { setError(d.message); setDevices([]); return; }
    setError('');
    setDevices(d.data);
    setMembers(m.ok ? m.data : []);
    if (p.ok) { setPolicy(p.data); setPolicyDraft(p.data); }
    setRequests(r.ok ? r.data : []);
    setReview(rv.ok ? rv.data : []);
    setTemplates(t.ok ? t.data : []);
  }, [officeId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!pairing) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pairing]);

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of members) m.set(x.userId, x.displayName || x.email || '구성원');
    return (uid: string | null) => (uid ? m.get(uid) || '구성원' : '');
  }, [members]);

  const remainSec = pairing ? Math.max(0, Math.floor((new Date(pairing.expiresAt).getTime() - now) / 1000)) : 0;

  const makeCode = async () => {
    setBusy(true);
    const res = await createPairingCode(officeId, label.trim());
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    const qrImage = await QRCode.toDataURL(res.data.qr, { margin: 1, width: 220 }).catch(() => '');
    setPairing({ ...res.data, qrImage });
  };

  const approve = async (d: OfficeDevice) => {
    const res = await approveDevice(d.id);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('업무폰을 승인했어요.');
    void load();
  };

  const revoke = async (d: OfficeDevice) => {
    const own = d.userId === uid;
    const reason = await dialog.prompt({
      title: '업무폰 연결 해지',
      message: `${d.label || d.model || '업무폰'} 연결을 끊어요. 휴대폰 앱은 다음 접속 때 저장한 기록을 지워요.${own ? '' : '\n해지 사유를 적어 주세요(활동 기록에 남아요).'}`,
      placeholder: own ? '사유 (선택)' : '예: 분실 신고, 퇴사',
    });
    if (reason === null) return;
    if (!own && !reason.trim()) { toast.error('다른 사람 기기를 해지하려면 사유가 필요해요.'); return; }
    const res = await revokeDevice(d.id, reason.trim());
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('연결을 해지했어요.');
    void load();
  };

  const rename = async (d: OfficeDevice) => {
    const v = await dialog.prompt({ title: '기기 이름', message: '목록에 보일 이름과 회선 이름을 바꿔요.', defaultValue: d.label });
    if (v === null) return;
    const line = await dialog.prompt({ title: '회선 이름', message: '예: 대표번호, 상담 1번', defaultValue: d.lineLabel });
    if (line === null) return;
    const res = await updateDevice(d.id, { label: v, lineLabel: line });
    if (!res.ok) { toast.error(res.message); return; }
    void load();
  };

  const savePolicy = async () => {
    if (!policyDraft || !policy) return;
    setBusy(true);
    const res = await saveCommPolicy(officeId, policyDraft, policy.version);
    setBusy(false);
    if (!res.ok) { toast.error(res.message); return; }
    setPolicy(res.data); setPolicyDraft(res.data);
    toast.success('업무폰 정책을 저장했어요. 휴대폰은 다음 접속 때 새 정책을 받아요.');
  };

  const linkRequest = async (r: RegisterRequest) => {
    const pick = linkPick[r.id];
    if (!pick?.key) { toast.error('연결할 사건을 골라 주세요.'); return; }
    const res = await resolveRegisterRequest(r.id, 'link', { workspaceKey: pick.key }, pick.relation || 'self');
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('번호를 사건에 등록했어요.');
    void load();
  };

  const ignoreRequest = async (r: RegisterRequest) => {
    const res = await resolveRegisterRequest(r.id, 'ignore');
    if (!res.ok) { toast.error(res.message); return; }
    void load();
  };

  const settleReview = async (l: CommLog, key: string) => {
    const res = await relinkCommLog(l.id, { workspaceKey: key }, '같은 번호가 여러 사건에 등록돼 담당자가 사건을 고름');
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('기록을 사건에 연결했어요.');
    void load();
  };

  const saveTemplate = async () => {
    if (!tplForm) return;
    if (!tplForm.title.trim() || !tplForm.body.trim()) { toast.error('제목과 내용을 모두 적어 주세요.'); return; }
    const hits = findProhibitedExpressions(tplForm.body);
    if (hits.length > 0) toast.warning(`확인이 필요한 표현이 있어요: ${hits.join(', ')}. 보낼 때 다시 확인을 받아요.`);
    const res = await saveCommTemplate(officeId, tplForm);
    if (!res.ok) { toast.error(res.message); return; }
    setTplForm(null);
    void load();
  };

  const archiveTemplate = async (t: CommTemplate) => {
    const ok = await dialog.confirm({ title: '문구 보관', message: `'${t.title}' 문구를 목록에서 빼요.`, confirmText: '빼기', variant: 'warning' });
    if (!ok) return;
    const res = await archiveCommTemplate(t.id);
    if (!res.ok) { toast.error(res.message); return; }
    void load();
  };

  const caseLabel = (key: string | null) => caseOptions.find(o => o.key === key)?.label || '사건';

  if (devices === null) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-56 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between gap-3 text-sm text-rose-800">
        <span>{error}</span>
        <button type="button" onClick={() => void load()} className="min-h-10 px-4 rounded-xl bg-white border border-rose-200 font-bold whitespace-nowrap active:scale-[0.98]">다시 불러오기</button>
      </div>
    );
  }

  const visibleDevices = devices.filter(d => d.status !== 'revoked');
  const revokedDevices = devices.filter(d => d.status === 'revoked');

  return (
    <div className="space-y-4">
      {/* 1. 내 업무폰 연결 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><QrCode className="w-4 h-4 text-brand" aria-hidden="true" />내 업무폰 연결</h3>
        <p className="mt-1 text-xs text-slate-600">
          휴대폰의 마이김변 업무폰 앱에서 'QR로 연결'을 누르고 아래 코드를 찍거나 8자리를 입력하세요. 코드는 10분 동안 한 번만 쓸 수 있어요.
          {policy?.requireApproval && !canManageDevices ? ' 연결한 뒤 대표가 승인해야 기록이 올라와요.' : ''}
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input value={label} onChange={e => setLabel(e.target.value)} maxLength={40} placeholder="기기 이름 (예: 상담 1번 폰)" aria-label="기기 이름" className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
          <button type="button" disabled={busy} onClick={() => void makeCode()} className="min-h-11 px-5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-60 active:scale-[0.98] whitespace-nowrap">연결 코드 만들기</button>
        </div>
        {pairing && (
          <div className="mt-3 flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {pairing.qrImage && <img src={pairing.qrImage} alt="업무폰 연결 QR 코드" width={160} height={160} className="rounded-xl bg-white p-1" />}
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold text-slate-600">연결 코드</p>
              <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.3em] text-slate-900">{pairing.code}</p>
              <p className={`mt-1 text-xs ${remainSec > 0 ? 'text-slate-600' : 'text-rose-700 font-bold'}`}>
                {remainSec > 0 ? `${Math.floor(remainSec / 60)}분 ${remainSec % 60}초 남음` : '만료됐어요. 새 코드를 만들어 주세요.'}
                {pairing.preApproved ? ' · 연결하면 바로 사용' : ' · 연결 후 대표 승인 필요'}
              </p>
            </div>
          </div>
        )}
        {policy?.staffNotice && <p className="mt-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-900">직원 안내: {policy.staffNotice}</p>}
      </section>

      {/* 2. 기기 목록 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><Smartphone className="w-4 h-4 text-brand" aria-hidden="true" />{canManageDevices ? '사무소 업무폰' : '내 업무폰'}</h3>
          <button type="button" onClick={() => void load()} aria-label="새로고침" className="min-h-10 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
        </div>
        {visibleDevices.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-600">
            연결된 업무폰이 없어요. 위에서 연결 코드를 만들어 휴대폰 앱에서 연결해 주세요.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {visibleDevices.map(d => (
              <li key={d.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-slate-900">{d.label || d.model || '업무폰'}</span>
                  <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${d.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{STATUS_LABEL[d.status]}</span>
                  <span className="text-xs text-slate-600">{memberName(d.userId)}{d.lineLabel ? ` · ${d.lineLabel}` : ''}{d.lineMode === 'shared' ? ' · 공용 회선' : ''}</span>
                  <span className="ml-auto flex gap-1.5">
                    {d.status === 'pending' && canManageDevices && (
                      <button type="button" onClick={() => void approve(d)} className="min-h-9 px-3 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover active:scale-[0.98] whitespace-nowrap">승인</button>
                    )}
                    {(canManageDevices || d.userId === uid) && (<>
                      <button type="button" onClick={() => void rename(d)} className="min-h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap">이름 바꾸기</button>
                      <button type="button" onClick={() => void revoke(d)} className="min-h-9 px-3 rounded-xl border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50 active:scale-[0.98] whitespace-nowrap">해지</button>
                    </>)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {[d.model, d.osVersion && `안드로이드 ${d.osVersion}`, d.appVersion && `앱 ${d.appVersion}`].filter(Boolean).join(' · ') || '기기 정보 없음'}
                  {' · '}마지막 접속 {fmt(d.lastSeenAt)}
                  {d.pendingUploads > 0 ? ` · 올릴 녹음 ${d.pendingUploads}건` : ''}
                  {d.failedUploads > 0 ? ` · 올리지 못한 녹음 ${d.failedUploads}건` : ''}
                </p>
                {d.clockSkewSec != null && Math.abs(d.clockSkewSec) > 120 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-800"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />휴대폰 시계가 서버와 {Math.round(Math.abs(d.clockSkewSec) / 60)}분 차이 나요. 휴대폰의 '자동 날짜 및 시간'을 켜 주세요.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {revokedDevices.length > 0 && <p className="mt-2 text-xs text-slate-500">해지한 기기 {revokedDevices.length}대는 기록 보존을 위해 목록에만 남아 있어요.</p>}
      </section>

      {/* 3. 사무소 정책 */}
      {policyDraft && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><ShieldCheck className="w-4 h-4 text-brand" aria-hidden="true" />업무폰 정책</h3>
          {!canEditPolicy && <p className="mt-1 text-xs text-slate-500">정책은 사무소 설정 권한이 있는 사람만 바꿀 수 있어요.</p>}
          <fieldset disabled={!canEditPolicy} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {([
              ['requireApproval', '직원이 연결한 기기는 대표 승인 뒤 사용'],
              ['uploadRecordings', '통화 녹음 자동 업로드'],
              ['appSmsAllowed', '웹에서 업무폰으로 문자 보내기 허용'],
            ] as const).map(([k, text]) => (
              <label key={k} className="flex items-center gap-2 min-h-10">
                <input type="checkbox" checked={!!policyDraft[k]} onChange={e => setPolicyDraft(p => (p ? { ...p, [k]: e.target.checked } : p))} className="w-4 h-4" />
                <span className="text-slate-800">{text}</span>
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">녹음 업로드 네트워크
              <select value={policyDraft.uploadNetwork} onChange={e => setPolicyDraft(p => (p ? { ...p, uploadNetwork: e.target.value as 'any' | 'wifi' } : p))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800">
                <option value="any">모든 네트워크</option><option value="wifi">와이파이에서만</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">기기당 하루 문자 한도
              <input type="number" min={0} max={500} value={policyDraft.smsDailyLimit} onChange={e => setPolicyDraft(p => (p ? { ...p, smsDailyLimit: Math.max(0, Math.min(500, Number(e.target.value) || 0)) } : p))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800" />
            </label>
            <div className="flex flex-col gap-1 text-xs font-bold text-slate-600">문자 발송 금지 시간
              <div className="flex items-center gap-2">
                <select aria-label="금지 시작" value={policyDraft.smsQuietStart} onChange={e => setPolicyDraft(p => (p ? { ...p, smsQuietStart: Number(e.target.value) } : p))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800">
                  {HOURS.map(h => <option key={h} value={h}>{h}시</option>)}
                </select>
                <span className="font-normal">부터</span>
                <select aria-label="금지 끝" value={policyDraft.smsQuietEnd} onChange={e => setPolicyDraft(p => (p ? { ...p, smsQuietEnd: Number(e.target.value) } : p))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm font-normal text-slate-800">
                  {HOURS.map(h => <option key={h} value={h}>{h}시</option>)}
                </select>
                <span className="font-normal">까지</span>
              </div>
            </div>
            <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-bold text-slate-600">직원 안내 문구 (앱 첫 화면에 보여요)
              <textarea value={policyDraft.staffNotice} onChange={e => setPolicyDraft(p => (p ? { ...p, staffNotice: e.target.value } : p))} rows={3} maxLength={1000} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" />
            </label>
          </fieldset>
          {canEditPolicy && (
            <div className="mt-3 flex justify-end">
              <button type="button" disabled={busy} onClick={() => void savePolicy()} className="min-h-10 px-5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover disabled:opacity-60 active:scale-[0.98] whitespace-nowrap">정책 저장</button>
            </div>
          )}
        </section>
      )}

      {/* 4. 등록 요청함 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><Inbox className="w-4 h-4 text-brand" aria-hidden="true" />번호 등록 요청함</h3>
        <p className="mt-1 text-xs text-slate-600">업무폰 앱에서 '이 번호 등록'을 누른 번호예요. 사건에 연결하면 그때부터 기록돼요(이전 통화는 올라오지 않아요).</p>
        {requests.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-3 text-center text-sm text-slate-500">처리할 요청이 없어요.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map(r => (
              <li key={r.id} className="rounded-xl border border-slate-200 p-3 flex flex-col lg:flex-row lg:items-center gap-2 text-sm">
                <div className="flex-1">
                  <span className="font-bold text-slate-900">{formatPhone(r.phone)}</span>
                  <span className="ml-2 text-xs text-slate-500">{memberName(r.userId)} · {fmt(r.occurredAt || r.createdAt)}{r.note ? ` · ${r.note}` : ''}</span>
                </div>
                <select aria-label="연결할 사건" value={linkPick[r.id]?.key || ''} onChange={e => setLinkPick(s => ({ ...s, [r.id]: { key: e.target.value, relation: s[r.id]?.relation || 'self' } }))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm lg:w-64">
                  <option value="">사건 고르기</option>
                  {caseOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <select aria-label="관계" value={linkPick[r.id]?.relation || 'self'} onChange={e => setLinkPick(s => ({ ...s, [r.id]: { key: s[r.id]?.key || '', relation: e.target.value as ContactRelation } }))} className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm">
                  {(Object.keys(RELATION_LABEL) as ContactRelation[]).map(k => <option key={k} value={k}>{RELATION_LABEL[k]}</option>)}
                </select>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => void linkRequest(r)} className="min-h-10 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover active:scale-[0.98] whitespace-nowrap">연결</button>
                  <button type="button" onClick={() => void ignoreRequest(r)} className="min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap">무시</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5. 확인 필요 기록 */}
      {review.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><AlertTriangle className="w-4 h-4 text-amber-700" aria-hidden="true" />사건을 골라야 하는 기록 {review.length}건</h3>
          <p className="mt-1 text-xs text-slate-600">같은 번호가 여러 사건에 등록돼 있어 어느 사건 기록인지 정하지 못했어요.</p>
          <ul className="mt-3 space-y-2">
            {review.map(l => (
              <li key={l.id} className="rounded-xl border border-amber-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                <span className="flex-1 text-slate-800">{describeLog(l)} · {fmt(l.occurredAt)}</span>
                <span className="flex flex-wrap gap-1.5">
                  {l.candidates.filter(c => c.workspace_key).map(c => (
                    <button key={c.workspace_key!} type="button" onClick={() => void settleReview(l, c.workspace_key!)} className="min-h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap">{caseLabel(c.workspace_key)}</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 6. 문구함 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><MessageSquareText className="w-4 h-4 text-brand" aria-hidden="true" />문자·카톡 문구함</h3>
          <button type="button" onClick={() => setTplForm({ title: '', body: '', purpose: 'general' })} className="min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap">문구 추가</button>
        </div>
        <p className="mt-1 text-xs text-slate-600">사건 화면의 '카톡으로 보내기'·'업무폰으로 문자'에서 골라 쓸 수 있어요. 보낼 때 발송 문구 규칙으로 한 번 더 확인해요.</p>
        {tplForm && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={tplForm.title} onChange={e => setTplForm(f => (f ? { ...f, title: e.target.value } : f))} maxLength={40} placeholder="제목" aria-label="문구 제목" className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
              <select value={tplForm.purpose} onChange={e => setTplForm(f => (f ? { ...f, purpose: e.target.value as CommTemplate['purpose'] } : f))} aria-label="용도" className="min-h-10 rounded-xl border border-slate-200 px-2 text-sm">
                {(Object.keys(TEMPLATE_PURPOSE_LABEL) as CommTemplate['purpose'][]).map(k => <option key={k} value={k}>{TEMPLATE_PURPOSE_LABEL[k]}</option>)}
              </select>
            </div>
            <textarea value={tplForm.body} onChange={e => setTplForm(f => (f ? { ...f, body: e.target.value } : f))} rows={4} maxLength={1000} placeholder="예: 안녕하세요, ○○법률사무소입니다. 요청드린 서류를 마이김변 '내 사건'에서 올려 주세요." aria-label="문구 내용" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTplForm(null)} className="min-h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-white active:scale-[0.98] whitespace-nowrap">취소</button>
              <button type="button" onClick={() => void saveTemplate()} className="min-h-10 px-4 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover active:scale-[0.98] whitespace-nowrap">저장</button>
            </div>
          </div>
        )}
        {templates.length === 0 && !tplForm ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-3 text-center text-sm text-slate-500">저장한 문구가 없어요. 자주 보내는 안내를 문구로 저장해 두세요.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {templates.map(t => (
              <li key={t.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{TEMPLATE_PURPOSE_LABEL[t.purpose]}</span>
                  <span className="font-bold text-slate-900">{t.title}</span>
                  <span className="ml-auto flex gap-1.5">
                    <button type="button" onClick={() => setTplForm({ id: t.id, title: t.title, body: t.body, purpose: t.purpose })} className="min-h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap">고치기</button>
                    <button type="button" onClick={() => void archiveTemplate(t)} className="min-h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.98] whitespace-nowrap">빼기</button>
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">{t.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
