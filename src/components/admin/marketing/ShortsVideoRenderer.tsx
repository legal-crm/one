/**
 * 숏폼 영상 렌더러 (유튜브 쇼츠·틱톡·릴스 공용 9:16)
 * 1) 장면별 AI 배경(서버 Gemini 이미지 모델, 실패 시 무료 폴백) 2) 선택: 장면별 AI 나레이션(Gemini TTS)
 * 3) 캔버스에서 켄 번스 모션 + 키네틱 자막 합성 4) MediaRecorder로 실시간 녹화 → MP4(지원 브라우저) 또는 WebM
 * 서버 렌더링·유료 툴 없이 관리자 브라우저에서 완성한다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Film, ImagePlus, Mic, Download, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import {
  autopilotApi, fallbackImageUrl, pcmBase64ToAudioBuffer, toDataUrl, Scene,
} from '../../../services/marketingAutopilotService';
import { drawVideoFrame, ensureFonts, loadImage, sceneAt, canvasToBlob, downloadBlob } from './canvasArt';

interface Props {
  scenes: Scene[];
  badge: string;
  disclaimer: string;
  fileBase: string;
}

const W = 1080, H = 1920;

function pickMime(): { mime: string; ext: string } {
  const cands = [
    { mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  if (typeof MediaRecorder === 'undefined') return { mime: '', ext: '' };
  return cands.find(c => MediaRecorder.isTypeSupported(c.mime)) || { mime: '', ext: '' };
}

export default function ShortsVideoRenderer({ scenes, badge, disclaimer, fileBase }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<(HTMLImageElement | null)[]>(() => scenes.map(() => null));
  const [imgState, setImgState] = useState<('idle' | 'loading' | 'ai' | 'fallback' | 'error')[]>(() => scenes.map(() => 'idle'));
  const [audio, setAudio] = useState<(AudioBuffer | null)[]>(() => scenes.map(() => null));
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const [t, setT] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const fmt = useMemo(pickMime, []);

  // 장면 구성(배경 프롬프트)이 바뀌면 배경 초기화, 나레이션 문장이 바뀌면 음성 초기화
  const visualKey = scenes.map(s => s.visualPrompt).join('|');
  const narrationKey = scenes.map(s => s.narration).join('|');
  useEffect(() => {
    setImages(scenes.map(() => null));
    setImgState(scenes.map(() => 'idle'));
    setT(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualKey]);
  useEffect(() => {
    setAudio(scenes.map(() => null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationKey]);

  // 나레이션 길이에 맞춰 장면 길이를 늘린다
  const durations = useMemo(
    () => scenes.map((s, i) => Math.max(s.seconds, audio[i] ? audio[i]!.duration + 0.3 : 0)),
    [scenes, audio],
  );
  const total = durations.reduce((a, b) => a + b, 0);

  const draw = useCallback((time: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawVideoFrame(ctx, { scenes, durations, images, t: time, badge, disclaimer });
  }, [scenes, durations, images, badge, disclaimer]);

  useEffect(() => {
    ensureFonts([...scenes.map(s => `${s.caption} ${s.narration}`), badge, disclaimer]).then(() => draw(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  const stopAudio = () => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch { /* ignore */ } });
    sourcesRef.current = [];
  };

  const scheduleAudio = (ac: AudioContext, dest: AudioNode, from: number) => {
    let acc = 0;
    const now = ac.currentTime + 0.05;
    audio.forEach((buf, i) => {
      const start = acc;
      acc += durations[i];
      if (!buf || start + buf.duration < from) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(dest);
      const offset = Math.max(0, from - start);
      src.start(now + Math.max(0, start - from), offset);
      sourcesRef.current.push(src);
    });
  };

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  };

  const play = () => {
    if (playing) {
      cancelAnimationFrame(rafRef.current);
      stopAudio();
      setPlaying(false);
      return;
    }
    const from = t >= total - 0.05 ? 0 : t;
    const ac = getAudioCtx();
    ac.resume();
    scheduleAudio(ac, ac.destination, from);
    const startWall = performance.now();
    setPlaying(true);
    const loop = () => {
      const now = from + (performance.now() - startWall) / 1000;
      if (now >= total) { draw(total - 0.001); setT(total); setPlaying(false); return; }
      draw(now);
      setT(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); stopAudio(); audioCtxRef.current?.close(); }, []);

  const loadBackgrounds = async () => {
    setImgState(scenes.map(() => 'loading'));
    const results = await Promise.all(scenes.map(async (s, i) => {
      try {
        const r = await autopilotApi.image(s.visualPrompt, '9:16');
        return { img: await loadImage(r.dataUrl), state: 'ai' as const };
      } catch {
        try {
          const dataUrl = await toDataUrl(fallbackImageUrl(s.visualPrompt, 1080, 1920, 101 + i * 17));
          return { img: await loadImage(dataUrl), state: 'fallback' as const };
        } catch {
          return { img: null, state: 'error' as const };
        }
      }
    }));
    setImages(results.map(r => r.img));
    setImgState(results.map(r => r.state));
    const fb = results.filter(r => r.state === 'fallback').length;
    const err = results.filter(r => r.state === 'error').length;
    if (err) toast.error(`배경 ${err}장을 만들지 못해 그라데이션을 씁니다.`);
    else if (fb) toast.info(`AI 이미지 모델 대신 무료 폴백 배경 ${fb}장을 썼습니다.`);
    else toast.success('장면별 AI 배경을 만들었습니다.');
  };

  const loadNarration = async () => {
    setAudioLoading(true);
    const ac = getAudioCtx();
    try {
      const bufs = await Promise.all(scenes.map(async s => {
        try {
          const r = await autopilotApi.tts(s.narration);
          return await pcmBase64ToAudioBuffer(ac, r.data, r.mimeType);
        } catch { return null; }
      }));
      setAudio(bufs);
      const miss = bufs.filter(b => !b).length;
      if (miss === bufs.length) toast.error('AI 나레이션을 만들지 못했습니다. 자막만으로 녹화할 수 있습니다.');
      else if (miss) toast.info(`${miss}개 장면은 음성 없이 진행됩니다.`);
      else toast.success('장면별 AI 나레이션을 만들었습니다. 장면 길이가 음성에 맞춰 조정됩니다.');
    } finally {
      setAudioLoading(false);
    }
  };

  const record = async () => {
    const c = canvasRef.current;
    if (!c || !fmt.mime) { toast.error('이 브라우저는 영상 녹화를 지원하지 않습니다. 최신 Chrome/Edge를 사용하세요.'); return; }
    cancelAnimationFrame(rafRef.current); stopAudio(); setPlaying(false);
    await ensureFonts(scenes.map(s => `${s.caption} ${s.narration}`));
    const ac = getAudioCtx();
    await ac.resume();
    const dest = ac.createMediaStreamDestination();
    const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>(res => { rec.onstop = () => res(); });
    setRecording(true);
    draw(0);
    rec.start(250);
    scheduleAudio(ac, dest, 0);
    const startWall = performance.now();
    await new Promise<void>(resolve => {
      const loop = () => {
        const now = (performance.now() - startWall) / 1000;
        if (now >= total + 0.3) { resolve(); return; }
        draw(Math.min(now, total - 0.001));
        setRecProgress(Math.min(1, now / total));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    });
    rec.stop();
    await done;
    stopAudio();
    setRecording(false);
    setRecProgress(0);
    const blob = new Blob(chunks, { type: fmt.mime.split(';')[0] });
    downloadBlob(blob, `${fileBase}.${fmt.ext}`);
    toast.success(`${fmt.ext.toUpperCase()} 영상(${Math.round(total)}초)을 내려받았습니다.`);
  };

  const exportScenes = async () => {
    const zip = new JSZip();
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const ctx = off.getContext('2d')!;
    await ensureFonts(scenes.map(s => `${s.caption} ${s.narration}`));
    let acc = 0;
    for (let i = 0; i < scenes.length; i++) {
      drawVideoFrame(ctx, { scenes, durations, images, t: acc + durations[i] * 0.7, badge, disclaimer });
      zip.file(`${fileBase}-scene${i + 1}.png`, await canvasToBlob(off));
      acc += durations[i];
    }
    zip.file(`${fileBase}-script.txt`, scenes.map((s, i) => `#${i + 1} ${durations[i].toFixed(1)}초\n자막: ${s.caption}\n나레이션: ${s.narration}`).join('\n\n'));
    downloadBlob(await zip.generateAsync({ type: 'blob' }), `${fileBase}-scenes.zip`);
  };

  const cur = sceneAt(durations, t).index;
  const busy = recording || audioLoading || imgState.some(s => s === 'loading');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,300px)_1fr] gap-5">
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 aspect-[9/16] max-h-[540px] mx-auto">
          <canvas ref={canvasRef} width={W} height={H} className="w-full h-full" aria-label="숏폼 영상 미리보기" />
          {imgState.some(s => s === 'loading') && (
            <div className="absolute inset-0 bg-slate-900/70 flex flex-col gap-2 p-4 justify-end" aria-live="polite">
              <div className="h-3 rounded bg-slate-700 animate-pulse w-2/3" />
              <div className="h-3 rounded bg-slate-700 animate-pulse w-1/2" />
              <p className="text-xs text-slate-300">장면 배경 생성 중 (장면당 10~30초)</p>
            </div>
          )}
          {recording && (
            <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-lg" role="status">
              ● 녹화 {Math.round(recProgress * 100)}%
            </div>
          )}
        </div>
        <div className="flex gap-1" role="group" aria-label="장면 타임라인">
          {durations.map((d, i) => (
            <button
              key={i}
              type="button"
              disabled={recording}
              onClick={() => { const start = durations.slice(0, i).reduce((a, b) => a + b, 0); setT(start + 0.4); draw(start + 0.4); }}
              style={{ flexGrow: d }}
              className={`h-8 rounded-lg text-[11px] font-bold transition-colors ${i === cur ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              aria-label={`${i + 1}번 장면 ${d.toFixed(1)}초`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 text-center">{t.toFixed(1)}초 / {total.toFixed(1)}초</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={play} disabled={recording} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap press-scale disabled:opacity-50">
            {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? '일시정지' : '미리보기 재생'}
          </button>
          <button type="button" onClick={loadBackgrounds} disabled={busy} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap press-scale disabled:opacity-50">
            <ImagePlus size={16} />장면 배경 생성
          </button>
          <button type="button" onClick={loadNarration} disabled={busy} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap press-scale disabled:opacity-50">
            <Mic size={16} />{audioLoading ? '음성 생성 중…' : audio.some(Boolean) ? 'AI 나레이션 다시 만들기' : 'AI 나레이션 추가'}
          </button>
          <button type="button" onClick={record} disabled={busy || !fmt.mime} className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap press-scale disabled:opacity-50">
            <Film size={16} />{recording ? '녹화 중…' : `${fmt.ext ? fmt.ext.toUpperCase() : '영상'} 녹화·다운로드`}
          </button>
          <button type="button" onClick={exportScenes} disabled={recording} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap press-scale disabled:opacity-50">
            <Download size={16} />장면 PNG+대본 ZIP
          </button>
          {audio.some(Boolean) && (
            <button type="button" onClick={() => setAudio(scenes.map(() => null))} disabled={busy} className="min-h-[44px] px-3 rounded-xl text-slate-300 hover:text-white text-sm flex items-center gap-1.5 whitespace-nowrap">
              <RotateCcw size={14} />음성 빼기
            </button>
          )}
        </div>
        <ul className="text-xs text-slate-400 space-y-1 leading-relaxed">
          <li>• 녹화는 실시간으로 진행됩니다({Math.round(total)}초). 녹화 중에는 이 탭을 화면에 띄워 두세요 (백그라운드 탭은 프레임이 멈춥니다).</li>
          <li>• {fmt.ext === 'mp4' ? 'MP4로 저장되어 쇼츠·틱톡·릴스에 바로 올릴 수 있습니다.' : 'WebM으로 저장됩니다. 유튜브·틱톡은 WebM 업로드를 받지만, 인스타그램 릴스는 MP4 변환(CapCut 등)이 필요합니다.'}</li>
          <li>• 배경음악은 넣지 않습니다. 저작권 문제가 없도록 각 플랫폼 앱의 라이선스 음원을 게시할 때 추가하세요.</li>
        </ul>
        {imgState.includes('fallback') && (
          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            일부 배경은 무료 폴백(Pollinations)으로 만들었습니다. 상업 이용 조건은 보장되지 않으니 중요한 게시물은 AI 배경을 다시 생성하세요.
          </p>
        )}
        <ol className="space-y-2">
          {scenes.map((s, i) => (
            <li key={i} className={`rounded-xl border p-3 text-sm ${i === cur ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-800 bg-[#0B0F19]'}`}>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <span className="font-mono text-indigo-300">#{i + 1} · {durations[i].toFixed(1)}초</span>
                <span>{s.motion || '자동 모션'}</span>
                <span>{imgState[i] === 'ai' ? 'AI 배경' : imgState[i] === 'fallback' ? '폴백 배경' : imgState[i] === 'error' ? '배경 실패' : ''}</span>
                {audio[i] && <span className="text-emerald-300">음성 {audio[i]!.duration.toFixed(1)}초</span>}
              </div>
              <p className="font-bold text-white">{s.caption}</p>
              <p className="text-slate-300">{s.narration}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
