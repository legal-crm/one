import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, AlertCircle, Gauge } from 'lucide-react';

export interface CustomAudioPlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
}

export interface CustomAudioPlayerProps {
  src: string;
  fileName?: string;
  onClose?: () => void;
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const CustomAudioPlayer = forwardRef<CustomAudioPlayerRef, CustomAudioPlayerProps>(
  ({ src, fileName, onClose }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const [error, setError] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (audioRef.current) {
          const clamped = Math.max(0, Math.min(seconds, audioRef.current.duration || seconds));
          audioRef.current.currentTime = clamped;
          setCurrentTime(clamped);
          audioRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(err => {
            console.warn('[CustomAudioPlayer] Auto-play on seek failed:', err);
          });
        }
      },
      play: () => {
        if (audioRef.current && !isPlaying) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
        }
      },
      pause: () => {
        if (audioRef.current && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }
    }));

    useEffect(() => {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setError(false);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.load();
      }
    }, [src]);

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error('[CustomAudioPlayer] Playback failed', err);
          setError(true);
        });
      }
    };

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
        audioRef.current.playbackRate = playbackRate;
        setError(false);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    };

    const skip = (seconds: number) => {
      if (audioRef.current) {
        const nextTime = Math.max(0, Math.min(audioRef.current.duration || 9999, audioRef.current.currentTime + seconds));
        audioRef.current.currentTime = nextTime;
        setCurrentTime(nextTime);
      }
    };

    const cyclePlaybackRate = () => {
      const rates = [1, 1.25, 1.5, 2.0];
      const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
      const nextRate = rates[nextIdx];
      setPlaybackRate(nextRate);
      if (audioRef.current) {
        audioRef.current.playbackRate = nextRate;
      }
    };

    const isDriveUrl = src.includes('drive.google.com');

    return (
      <div className="bg-white rounded-xl shadow-md border border-purple-200/80 p-3.5 w-full">
        {/* 헤더: 파일명 & 재생 상태 */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <div className="bg-purple-100 p-1.5 rounded-lg text-purple-700 shrink-0">
              <Volume2 size={15} />
            </div>
            <span className="text-xs font-bold text-slate-800 truncate" title={fileName}>
              {fileName || '통화 녹음 파일'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 배속 조절 버튼 */}
            <button
              onClick={cyclePlaybackRate}
              className="px-2 py-0.5 text-[11px] font-mono font-bold rounded border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1"
              title="재생 배속 변경 (1x, 1.25x, 1.5x, 2x)"
            >
              <Gauge size={11} />
              {playbackRate}x
            </button>
            {onClose && (
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-0.5 rounded text-xs">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 숨김 오디오 엘리먼트 */}
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setError(true);
            setIsPlaying(false);
          }}
        />

        {error ? (
          <div className="bg-rose-50 text-rose-700 text-xs p-2.5 rounded-lg flex items-center justify-between border border-rose-200">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertCircle size={14} className="shrink-0 text-rose-500" />
              오디오를 재생할 수 없습니다.
            </span>
            {src && (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold text-rose-700 hover:text-rose-900"
              >
                다운로드/열기
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* 타임라인 슬라이더 */}
            <div className="relative">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600 transition-all"
                style={{
                  background: `linear-gradient(to right, #9333ea ${(currentTime / (duration || 1)) * 100}%, #e2e8f0 ${(currentTime / (duration || 1)) * 100}%)`
                }}
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1 px-0.5">
                <span className="font-semibold text-purple-700">{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 컨트롤 버튼 */}
            <div className="flex justify-center items-center gap-5 pt-0.5">
              <button
                onClick={() => skip(-10)}
                className="text-slate-400 hover:text-purple-700 transition-colors p-1.5 hover:bg-purple-50 rounded-full cursor-pointer"
                title="10초 뒤로 건너뛰기"
              >
                <RotateCcw size={17} />
              </button>

              <button
                onClick={togglePlay}
                className="bg-purple-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md hover:bg-purple-700 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title={isPlaying ? '일시정지' : '재생'}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              <button
                onClick={() => skip(15)}
                className="text-slate-400 hover:text-purple-700 transition-colors p-1.5 hover:bg-purple-50 rounded-full cursor-pointer"
                title="15초 앞으로 건너뛰기"
              >
                <RotateCw size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

CustomAudioPlayer.displayName = 'CustomAudioPlayer';
