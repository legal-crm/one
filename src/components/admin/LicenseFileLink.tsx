// 통합어드민 변호사 심사: 비공개 저장소 등록증 열람 (OP-8)
// 열 때마다 5분짜리 주소를 받는다. 사진이면 미리 보기, PDF면 새 창 링크.
import { useEffect, useState } from 'react';
import { getLawyerLicenseUrl } from '../../services/lawyers/lawyerLicenseService';

export default function LicenseFileLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let stop = false;
    setUrl(undefined);
    void getLawyerLicenseUrl(path).then(u => { if (!stop) setUrl(u); });
    return () => { stop = true; };
  }, [path]);
  const isPdf = /\.pdf$/i.test(path);
  return (
    <div className="space-y-1.5 bg-[#0B0F19] border border-amber-500/20 rounded-xl p-3">
      <span className="text-sm font-bold text-amber-400 block">첨부된 변호사 등록증</span>
      {url === undefined && <div className="h-24 rounded-lg bg-slate-800 animate-pulse" aria-busy="true" />}
      {url === null && <p className="text-sm text-rose-300">등록증을 열지 못했어요. 이미 삭제됐거나(확인 30일 뒤 자동 삭제) 권한이 없어요.</p>}
      {url && (isPdf ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center px-4 rounded-xl border border-amber-500/40 text-sm font-bold text-amber-300 hover:bg-amber-500/10">PDF 열기 (5분 동안)</a>
      ) : (
        <img src={url} alt="변호사 등록증" className="w-full max-h-48 object-contain rounded-lg border border-[#1E293B]/40" />
      ))}
    </div>
  );
}
