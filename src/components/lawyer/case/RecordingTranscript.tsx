// 통화 녹음 아래 '대화록·요약' (CL-8). 대화록은 AI가 받아 적은 참고 자료이고, 원본 녹음이 기준이다.
import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { createTranscript, fmtStart, type CallTranscript } from '../../../services/comm/callTranscriptService';

export default function RecordingTranscript({ recordingId, transcript, onCreated }: {
  recordingId: string; transcript?: CallTranscript; onCreated: (t: CallTranscript) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const make = async () => {
    setBusy(true);
    const t = toast.loading('녹음을 받아 적는 중이에요 (최대 1분)…');
    const r = await createTranscript(recordingId);
    toast.dismiss(t);
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(`대화록 ${r.data.version}번째 버전을 만들었어요.`);
    setOpen(true);
    onCreated(r.data);
  };

  if (!transcript) {
    return (
      <div className="mt-2">
        <button type="button" disabled={busy} onClick={() => void make()}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 active:scale-[0.98] whitespace-nowrap">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />대화록·요약 만들기
        </button>
      </div>
    );
  }

  const f = transcript.facts || {};
  return (
    <div className="mt-2 rounded-xl border border-indigo-100 bg-white p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="inline-flex items-center gap-1 min-h-9 text-xs font-bold text-indigo-800">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}대화록·요약 (버전 {transcript.version})
        </button>
        <span className="text-[11px] text-slate-500">AI가 받아 적은 참고 자료예요. 정확한 내용은 원본 녹음으로 확인해 주세요.</span>
        <button type="button" disabled={busy} onClick={() => void make()} title="다시 만들기 (새 버전)"
          className="ml-auto inline-flex items-center gap-1 min-h-9 px-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60 active:scale-[0.98] whitespace-nowrap">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />다시 만들기
        </button>
      </div>
      {transcript.summary && <p className="text-xs text-slate-800 whitespace-pre-wrap bg-slate-50 rounded-lg p-2">{transcript.summary}</p>}
      {(f.next_contact || f.client_documents || f.office_todo) && (
        <ul className="text-xs text-slate-700 space-y-0.5">
          {f.next_contact && <li><span className="font-bold">다음 연락:</span> {f.next_contact}</li>}
          {f.client_documents && <li><span className="font-bold">의뢰인이 낼 서류:</span> {f.client_documents}</li>}
          {f.office_todo && <li><span className="font-bold">사무소 할 일:</span> {f.office_todo}</li>}
        </ul>
      )}
      {open && (
        <ol className="max-h-80 overflow-y-auto space-y-1 border-t border-slate-100 pt-2">
          {transcript.segments.map((s, i) => (
            <li key={i} className="text-xs leading-relaxed">
              <span className={`font-bold ${s.speaker === '의뢰인' ? 'text-emerald-700' : s.speaker === '사무소' ? 'text-indigo-700' : 'text-slate-600'}`}>{s.speaker}</span>
              {s.start !== null && <span className="text-slate-400 ml-1">{fmtStart(s.start)}</span>}
              <span className="text-slate-800 ml-1.5">{s.text}</span>
            </li>
          ))}
          {transcript.segments.length === 0 && <li className="text-xs text-slate-500">받아 적은 말이 없어요.</li>}
        </ol>
      )}
    </div>
  );
}
