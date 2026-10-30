// 설정 › 알림 (ST-7 내 알림 받기 · ST-8 팀 알림 방) — 서버 저장·서버 발송
// 바깥 채널(이메일·텔레그램)에는 종류·건수·링크만 간다. 가명·채무액·소득·사건번호는 보내지 않는다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import {
  DEFAULT_MY_PREFS, OFFICE_NOTIFICATION_KINDS,
  loadMyNotificationPrefs, loadRecentDeliveries, loadTeamChannelStatus, requestTeamChannelTest, saveMyNotificationPrefs, saveTeamChannel,
  type DeliveryRow, type MyNotificationPrefs, type TeamChannelStatus,
} from '../../../services/notifications/userNotificationService';

const KIND_LABEL: Record<string, string> = Object.fromEntries(OFFICE_NOTIFICATION_KINDS.map(k => [k.kind, k.label]));
const STATUS_LABEL: Record<string, string> = { pending: '보낼 예정', sending: '보내는 중', sent: '보냄', failed: '못 보냄', skipped: '건너뜀' };
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function ServerNotificationSettings({ officeId, canViewTeam, canEditTeam }: { officeId: string; canViewTeam: boolean; canEditTeam: boolean }) {
  // 내 알림
  const [mine, setMine] = useState<MyNotificationPrefs | null>(null);
  const [mineSaved, setMineSaved] = useState<MyNotificationPrefs | null>(null);
  const [savingMine, setSavingMine] = useState(false);
  const [myDeliveries, setMyDeliveries] = useState<DeliveryRow[]>([]);
  // 팀 방
  const [team, setTeam] = useState<TeamChannelStatus | null>(null);
  const [teamForm, setTeamForm] = useState({ enabled: false, chatId: '', token: '', kinds: [] as string[] });
  const [teamError, setTeamError] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);
  const [testing, setTesting] = useState(false);
  const [teamDeliveries, setTeamDeliveries] = useState<DeliveryRow[]>([]);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    const [p, d] = await Promise.all([loadMyNotificationPrefs(), loadRecentDeliveries()]);
    if (!p) { setLoadError(true); return; }
    setLoadError(false);
    setMine(p); setMineSaved(p);
    setMyDeliveries(d.filter(x => x.channel === 'email'));
    if (canViewTeam) {
      const [t, td] = await Promise.all([loadTeamChannelStatus(officeId), loadRecentDeliveries(officeId)]);
      if (t) {
        setTeam(t);
        setTeamForm({ enabled: t.telegramEnabled, chatId: t.chatId, token: '', kinds: t.kinds });
      }
      setTeamDeliveries(td.filter(x => x.channel === 'telegram'));
    }
  }, [officeId, canViewTeam]);

  useEffect(() => { void load(); }, [load]);

  const saveMine = async () => {
    if (!mine) return;
    setSavingMine(true);
    const err = await saveMyNotificationPrefs(mine);
    setSavingMine(false);
    if (err) { toast.error(err); return; }
    toast.success('내 알림 받기 설정을 저장했습니다.');
    setMineSaved(mine);
  };

  const saveTeam = async () => {
    setTeamError('');
    if (teamForm.enabled && (!teamForm.chatId.trim() || (!team?.hasToken && !teamForm.token.trim()))) {
      setTeamError('켜려면 봇 토큰과 채팅방 ID가 모두 필요합니다.');
      return;
    }
    setSavingTeam(true);
    const err = await saveTeamChannel(officeId, { telegramEnabled: teamForm.enabled, chatId: teamForm.chatId, token: teamForm.token || undefined, kinds: teamForm.kinds });
    setSavingTeam(false);
    if (err) { setTeamError(err); return; }
    toast.success('팀 알림 방 설정을 저장했습니다. 테스트를 보내 연결을 확인해 주세요.');
    void load();
  };

  const test = async () => {
    setTesting(true);
    const err = await requestTeamChannelTest(officeId);
    if (err) { setTesting(false); toast.error(err); return; }
    toast.info('테스트를 보냈습니다. 결과를 확인하는 중…');
    // 서버가 보낸 결과를 잠시 뒤 다시 읽는다
    window.setTimeout(() => { void load().finally(() => setTesting(false)); }, 12000);
  };

  const toggleKind = (list: string[], kind: string, on: boolean) => (on ? Array.from(new Set([...list, kind])) : list.filter(k => k !== kind));
  const field = 'p-2.5 rounded-xl border border-slate-200 text-sm bg-white';

  if (loadError) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
        알림 설정을 불러오지 못했습니다.
        <button onClick={() => void load()} className="inline-flex items-center gap-1 px-3 min-h-[40px] rounded-xl bg-white border border-rose-300 font-bold whitespace-nowrap"><RefreshCw className="w-4 h-4" />다시 시도</button>
      </div>
    );
  }
  if (!mine) return <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />;

  return (
    <div className="space-y-4">
      <section className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3" aria-label="내 알림 받기">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><Mail className="w-5 h-5 text-slate-700" />내 알림 받기 (이메일)</h3>
        <p className="text-sm text-slate-600 break-keep">
          <Bell className="w-4 h-4 inline mr-1" aria-hidden="true" />화면 위 종 알림은 늘 옵니다. 이메일은 로그인한 계정 주소로 가고, 종류·건수·링크만 담깁니다(의뢰인 정보 없음). 같은 일은 읽기 전까지 한 번만 보냅니다.
        </p>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <input type="checkbox" checked={mine.emailEnabled} onChange={e => setMine({ ...mine, emailEnabled: e.target.checked })} className="h-4 w-4" />
          이메일로도 받기
        </label>
        <fieldset disabled={!mine.emailEnabled} className="grid grid-cols-2 gap-2 disabled:opacity-50">
          {OFFICE_NOTIFICATION_KINDS.map(k => (
            <label key={k.kind} className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={!mine.kindsOff.includes(k.kind)} onChange={e => setMine({ ...mine, kindsOff: e.target.checked ? mine.kindsOff.filter(x => x !== k.kind) : [...mine.kindsOff, k.kind] })} className="h-4 w-4" />
              {k.label}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
          <span>조용한 시간</span>
          <select aria-label="조용한 시간 시작" value={mine.quietStart} onChange={e => setMine({ ...mine, quietStart: Number(e.target.value) })} className={field}>
            {HOURS.map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
          <span>~</span>
          <select aria-label="조용한 시간 끝" value={mine.quietEnd} onChange={e => setMine({ ...mine, quietEnd: Number(e.target.value) })} className={field}>
            {HOURS.map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
          <span className="text-xs text-slate-500">이 시간에 생긴 알림은 끝나는 시각에 보냅니다. 같은 시각을 고르면 조용한 시간이 없습니다.</span>
        </div>
        <button type="button" onClick={saveMine} disabled={savingMine || JSON.stringify(mine) === JSON.stringify(mineSaved ?? DEFAULT_MY_PREFS)}
          className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-40 active:scale-[0.98]">
          {savingMine ? '저장 중…' : '저장'}
        </button>
        {myDeliveries.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-bold text-slate-600">최근 30일 이메일 {myDeliveries.length}건</summary>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {myDeliveries.map(d => (
                <li key={d.id} className="flex flex-wrap justify-between gap-2 p-2.5 text-xs">
                  <span>{fmt(d.createdAt)} · {KIND_LABEL[d.kind] || d.kind}</span>
                  <span className={d.status === 'sent' ? 'text-emerald-700 font-bold' : d.status === 'failed' ? 'text-rose-700 font-bold' : 'text-slate-500'}>{STATUS_LABEL[d.status] || d.status}{d.error ? ` · ${d.error}` : ''}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {canViewTeam && team && (
        <section className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3" aria-label="팀 알림 방">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><MessageCircle className="w-5 h-5 text-slate-700" />사무소 팀 알림 방 (텔레그램)</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${team.telegramEnabled && team.lastOkAt ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : team.lastError ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {!team.telegramEnabled ? '꺼짐' : team.lastOkAt ? `연결됨 · ${fmt(team.lastOkAt)} 확인` : team.lastError ? '연결 끊김' : '테스트 전'}
            </span>
          </div>
          <p className="text-sm text-slate-600 break-keep">
            사무소가 쓰는 텔레그램 방에 새 일이 생기면 '새 상담 요청 1건 · 확인하기 링크'처럼 짧게 알립니다. 같은 일은 30분에 한 번만 보냅니다. 텔레그램은 해외 서비스라 개인정보 처리방침의 국외 이전 항목에 포함됩니다.
          </p>
          {team.lastError && <p role="alert" className="text-xs text-rose-700">마지막 오류: {team.lastError}</p>}
          <fieldset disabled={!canEditTeam} className="space-y-2 disabled:opacity-60">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <input type="checkbox" checked={teamForm.enabled} onChange={e => setTeamForm(f => ({ ...f, enabled: e.target.checked }))} className="h-4 w-4" />
              팀 알림 방 사용
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-700">봇 토큰 {team.hasToken && <span className="font-normal text-slate-500">(등록됨 · 끝 {team.tokenLast4}, 바꿀 때만 입력)</span>}</span>
                <input type="password" autoComplete="off" value={teamForm.token} onChange={e => setTeamForm(f => ({ ...f, token: e.target.value }))} placeholder={team.hasToken ? '바꾸지 않으려면 비워 두세요' : '123456789:ABC…'} className={`w-full ${field}`} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-700">채팅방 ID</span>
                <input inputMode="numeric" value={teamForm.chatId} onChange={e => setTeamForm(f => ({ ...f, chatId: e.target.value }))} placeholder="-1001234567890" className={`w-full ${field}`} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {OFFICE_NOTIFICATION_KINDS.map(k => (
                <label key={k.kind} className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={teamForm.kinds.includes(k.kind)} onChange={e => setTeamForm(f => ({ ...f, kinds: toggleKind(f.kinds, k.kind, e.target.checked) }))} className="h-4 w-4" />
                  {k.label}
                </label>
              ))}
            </div>
            {teamError && <p role="alert" className="text-xs text-rose-700">{teamError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveTeam} disabled={savingTeam} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-40 active:scale-[0.98]">{savingTeam ? '저장 중…' : '저장'}</button>
              <button type="button" onClick={test} disabled={testing || !team.hasToken || !team.chatId} className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold whitespace-nowrap disabled:opacity-40 active:scale-[0.98]">{testing ? '확인 중…' : '테스트 보내기'}</button>
            </div>
          </fieldset>
          {!canEditTeam && <p className="text-xs text-slate-500">팀 알림 방은 사무소 설정 권한이 있는 사람만 바꿀 수 있습니다.</p>}
          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-bold">연결 방법</summary>
            <ol className="mt-2 list-decimal pl-5 space-y-1 break-keep">
              <li>텔레그램에서 @BotFather에게 /newbot을 보내 봇을 만들고 토큰을 받습니다.</li>
              <li>사무소 단체방에 봇을 초대합니다.</li>
              <li>단체방 ID(-100으로 시작하는 숫자)를 확인해 위에 넣고 저장한 뒤 '테스트 보내기'를 누릅니다.</li>
            </ol>
          </details>
          {teamDeliveries.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-bold text-slate-600">최근 30일 팀 방 알림 {teamDeliveries.length}건</summary>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {teamDeliveries.map(d => (
                  <li key={d.id} className="flex flex-wrap justify-between gap-2 p-2.5 text-xs">
                    <span>{fmt(d.createdAt)} · {d.kind === 'test' ? '연결 테스트' : KIND_LABEL[d.kind] || d.kind}</span>
                    <span className={d.status === 'sent' ? 'text-emerald-700 font-bold' : d.status === 'failed' ? 'text-rose-700 font-bold' : 'text-slate-500'}>{STATUS_LABEL[d.status] || d.status}{d.error ? ` · ${d.error}` : ''}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
