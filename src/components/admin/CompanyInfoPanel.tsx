// 통합어드민 › 플랫폼 설정 › 회사 정보 (CT-12)
// 한 곳에서 고치면 고객·변호사 화면 푸터는 바로, 정적 페이지 푸터·회사 소개·JSON-LD·llms.txt는 다음 사이트 빌드 때 바뀐다.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { COMPANY_INFO_FIELDS, companyInfoProblems, normalizeCompanyInfo } from '../../../api/_lib/company-info.js';
import { setCompanyInfoCache, type CompanyInfo } from '../../services/cms/companyInfo';

type Field = keyof CompanyInfo;

export default function CompanyInfoPanel() {
  const [saved, setSaved] = useState<CompanyInfo | null>(null);
  const [draft, setDraft] = useState<CompanyInfo | null>(null);
  const [fromServer, setFromServer] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error: e } = await supabase.from('platform_config').select('data').eq('id', 'company_info').maybeSingle();
      if (e) { setError('회사 정보를 불러오지 못했어요.'); }
      const info = normalizeCompanyInfo(data?.data || null) as CompanyInfo;
      setFromServer(!!data?.data);
      setSaved(info);
      setDraft(info);
    })();
  }, []);

  if (!draft || !saved) return <div className="h-40 rounded-2xl bg-[#111622] border border-[#1E293B]/60 animate-pulse" aria-busy="true" />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || !fromServer;
  const problems = companyInfoProblems(draft) as string[];

  const save = async () => {
    if (problems.length > 0) { toast.error(problems[0]); return; }
    setSaving(true);
    const value = Object.fromEntries((COMPANY_INFO_FIELDS as Array<[Field, string, number]>).map(([k]) => [k, draft[k].trim()]));
    const { error: e } = await supabase.from('platform_config').upsert({ id: 'company_info', data: value }, { onConflict: 'id' });
    setSaving(false);
    if (e) { toast.error(/check_violation|company info/i.test(e.message) ? '입력값을 확인해 주세요 (형식·금지 표기).' : '저장하지 못했어요. 2단계 인증을 마친 관리자만 저장할 수 있어요.'); return; }
    const next = normalizeCompanyInfo(value) as CompanyInfo;
    setSaved(next);
    setDraft(next);
    setFromServer(true);
    setCompanyInfoCache(next);
    toast.success('회사 정보를 저장했어요. 화면 푸터는 바로, 정적 페이지는 다음 사이트 빌드 때 바뀌어요.');
  };

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 space-y-4" aria-labelledby="company-info-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="company-info-title" className="flex items-center gap-2 text-base font-extrabold text-white"><Building2 className="w-4 h-4 text-indigo-300" aria-hidden="true" />회사 정보 (법정 표시)</h3>
        <span className="text-xs text-slate-400">{fromServer ? '서버 저장값' : '기본값(사업자등록증) — 아직 서버에 저장 전'}</span>
      </div>
      <p className="text-sm text-slate-300">고객·변호사 화면 푸터, 정적 페이지 푸터·회사 소개 표·검색용 구조화 데이터, llms.txt, 세금계산서 내보내기가 이 값을 써요. 개인사업자라 '주식회사'·'(주)'·'대표이사'는 쓸 수 없어요.</p>
      {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(COMPANY_INFO_FIELDS as Array<[Field, string, number]>).map(([k, label, max]) => (
          <label key={k} className={`space-y-1 ${k === 'address' ? 'md:col-span-2' : ''}`}>
            <span className="text-xs font-bold text-slate-300 block">{label}</span>
            <input value={draft[k]} maxLength={max} onChange={e => setDraft({ ...draft, [k]: e.target.value })}
              className="w-full min-h-[44px] bg-[#07090E] border border-[#1E293B]/80 rounded-xl px-3 text-sm text-slate-100" />
          </label>
        ))}
      </div>
      {problems.length > 0 && <p className="text-sm text-amber-300" role="status">{problems.join(' ')}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">세금계산서 공급자 사업자번호(팝빌 설정)와 같은지는 대시보드 '서비스 상태'에서 확인해요. 정적 페이지 다시 빌드는 Deploy Hook이 설정돼 있어야 자동으로 돌아요.</p>
        <span className="flex gap-2">
          <button type="button" disabled={!dirty || saving} onClick={() => setDraft(saved)} className="min-h-[44px] px-4 rounded-xl bg-[#0B0F19] border border-[#1E293B] text-sm font-bold text-slate-200 whitespace-nowrap disabled:opacity-40 cursor-pointer">되돌리기</button>
          <button type="button" disabled={!dirty || saving} onClick={() => void save()} className="min-h-[44px] px-4 rounded-xl bg-indigo-600 text-white text-sm font-bold whitespace-nowrap disabled:opacity-40 cursor-pointer active:scale-[0.98]">{saving ? '저장 중…' : '저장'}</button>
        </span>
      </div>
    </section>
  );
}
