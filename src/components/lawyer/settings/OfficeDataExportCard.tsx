// 설정 › 사무소 설정 › 데이터 내보내기 (ST-13, 대표만)
// 기본은 암호 건 파일. 암호 없는 파일은 대표가 한 번 더 확인하고, 내려받은 사실은 활동 기록에 남는다.
import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Lock } from 'lucide-react';
import { downloadOfficeExport, MIN_BACKUP_PASSWORD } from '../../../services/office/officeExportService';
import { useDialog } from '../../common/DialogProvider';

const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';
const field = 'w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-800';

export default function OfficeDataExportCard({ officeId }: { officeId: string }) {
  const dialog = useDialog();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (password: string | null) => {
    setBusy(true);
    const r = await downloadOfficeExport(officeId, password);
    setBusy(false);
    if (r.ok === false) { setErr(r.message); return; }
    const total = Object.values(r.data.counts).reduce((s, n) => s + (Number(n) || 0), 0);
    toast.success(`내려받았어요. 모두 ${total.toLocaleString('ko-KR')}줄이에요.${r.data.truncated.length ? ' 너무 많은 표는 앞부분 20,000줄만 들어갔어요.' : ''}`);
    setPw(''); setPw2('');
  };

  const encrypted = () => {
    setErr('');
    if (pw.length < MIN_BACKUP_PASSWORD) { setErr(`암호는 ${MIN_BACKUP_PASSWORD}자 이상으로 정해 주세요.`); return; }
    if (pw !== pw2) { setErr('두 암호가 서로 달라요.'); return; }
    void run(pw);
  };

  const plain = async () => {
    setErr('');
    const ok = await dialog.confirm({
      title: '암호 없이 내려받기',
      message: '의뢰인 이름·연락처·사건 내용이 그대로 담긴 파일이에요. 파일이 새면 누구나 열 수 있어요. 내려받은 사실은 사무소 활동 기록에 남아요. 계속할까요?',
      confirmText: '암호 없이 내려받기',
      variant: 'danger',
    });
    if (ok) void run(null);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" aria-label="데이터 내보내기">
      <div>
        <h3 className="font-extrabold text-slate-900">사무소 데이터 내보내기</h3>
        <p className="text-sm text-slate-600 mt-0.5">사건·의뢰인·서류 정보·수임료 기록·영업 DB·광고 주문·활동 기록을 한 파일로 받아요. 서류·녹음·도장 파일 본문은 들어가지 않고 파일 정보만 들어가요.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="exp-pw" className="text-sm font-bold text-slate-800">파일 암호 ({MIN_BACKUP_PASSWORD}자 이상)</label>
          <input id="exp-pw" type="password" autoComplete="new-password" value={pw} onChange={e => { setPw(e.target.value); setErr(''); }} className={field} aria-invalid={!!err} aria-describedby={err ? 'exp-err' : undefined} />
        </div>
        <div>
          <label htmlFor="exp-pw2" className="text-sm font-bold text-slate-800">암호 다시 입력</label>
          <input id="exp-pw2" type="password" autoComplete="new-password" value={pw2} onChange={e => { setPw2(e.target.value); setErr(''); }} className={field} />
        </div>
      </div>
      {err && <p id="exp-err" role="alert" className="text-xs font-semibold text-rose-700">{err}</p>}
      <p className="text-xs text-slate-500">암호는 서버로 보내지 않아요. 암호를 잃어버리면 마이김변도 파일을 열 수 없어요.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy} onClick={() => void plain()} className={`${btn} bg-white border border-slate-300 text-slate-700`}><Download className="w-4 h-4" /> 암호 없이 받기</button>
        <button type="button" disabled={busy} onClick={encrypted} className={`${btn} bg-[#1E3A5F] text-white`}><Lock className="w-4 h-4" /> {busy ? '만드는 중…' : '암호 걸어 내려받기'}</button>
      </div>
    </section>
  );
}
