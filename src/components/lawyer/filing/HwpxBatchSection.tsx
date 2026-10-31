import { useState } from 'react';
import JSZip from 'jszip';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { buildCourtFilingMasterData } from '../../../services/documents/courtFilingEngine';
import { buildFilledCourtForm, FILLED_FORMS, type FilledFormCode } from '../../../services/court/courtFormHwpx';
import { downloadBlob } from '../../../services/court/hwpxBuilder';

/**
 * 4단계 'HWPX 일괄 출력' (H-4): 데이터를 채운 법원 원본 양식(HWPX)을 전자소송 제출 순서대로 ZIP으로
 *  * 한글에서 열어 확인·보완한 뒤 PDF로 바꿔 올리는 용도 (전자소송 업로드 API가 없어 업로드는 직접)
 *  * 주민등록번호는 이 화면 메모리에만 두고 저장하지 않는다 (L8)
 *  * 출력 전 검사(CourtDocGuard)가 막은 서식은 ZIP에 넣지 않고 사유를 보여 준다
 */
export default function HwpxBatchSection({ clientRequest, crmExt, lawyerName }: { clientRequest: ConsultRequest; crmExt: CrmClientExtension; lawyerName?: string }) {
  const codes = (Object.keys(FILLED_FORMS) as FilledFormCode[]).sort((a, b) => FILLED_FORMS[a].order - FILLED_FORMS[b].order);
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(codes.map(c => [c, c !== 'D5113'])));
  const [rrn, setRrn] = useState('');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const run = async () => {
    setBusy(true);
    setProblems([]);
    try {
      const master = buildCourtFilingMasterData(clientRequest, crmExt, lawyerName || '');
      const zip = new JSZip();
      const issues: string[] = [];
      let added = 0;
      for (const code of codes.filter(c => picked[c])) {
        const r = await buildFilledCourtForm(code, master, rrn);
        r.warns.forEach(w => issues.push(`${FILLED_FORMS[code].title}: ${w.message} (경고)`));
        if (r.ok === false) { r.issues.forEach(i => issues.push(`${FILLED_FORMS[code].title}: ${i.message}`)); continue; }
        zip.file(r.fileName, r.bytes);
        added += 1;
      }
      setProblems(issues);
      if (!added) { toast.error('만들 수 있는 서식이 없어요. 아래 사유를 확인해 주세요.'); return; }
      const blob = await zip.generateAsync({ type: 'blob' });
      const safe = (clientRequest.clientName || '신청인').replace(/[\\/:*?"<>|\s]+/g, '');
      downloadBlob(blob, `[법원양식HWPX]_개인회생_${safe}.zip`);
      toast.success(`법원 양식 HWPX ${added}개를 내려받았어요. 한글에서 열어 빈칸을 확인하세요.`);
    } catch (e: any) {
      toast.error(e?.message || 'HWPX 묶음을 만들지 못했어요.');
    } finally {
      setRrn('');
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 mt-0.5 text-brand" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-slate-900">법원 원본 양식 HWPX 묶음 (한글 편집용)</p>
          <p className="text-xs text-slate-600">사건 데이터를 대법원 양식에 채워 제출 순서대로 묶어요. 한글에서 열어 빈칸을 확인한 뒤 PDF로 저장해 올리세요.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {codes.map(c => (
          <label key={c} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2.5 min-h-9">
            <input type="checkbox" checked={!!picked[c]} onChange={e => setPicked(p => ({ ...p, [c]: e.target.checked }))} />
            {FILLED_FORMS[c].title}
          </label>
        ))}
      </div>
      <label className="block text-xs font-bold text-slate-700">
        채무자 주민등록번호 (저장하지 않음 — 개시신청서·금지/중지명령·위임장에 넣을 때만)
        <input
          className="mt-1 w-full min-h-10 rounded-xl border border-slate-300 px-3 text-sm"
          value={rrn}
          onChange={e => setRrn(e.target.value.replace(/[^0-9-]/g, '').slice(0, 14))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000000-0000000"
        />
      </label>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="min-h-10 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold whitespace-nowrap cursor-pointer active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? '만드는 중…' : 'HWPX 일괄 출력 (ZIP)'}
      </button>
      {problems.length > 0 && (
        <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
          {problems.map(p => <li key={p}>· {p}</li>)}
        </ul>
      )}
    </div>
  );
}
