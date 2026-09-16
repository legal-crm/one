import React, { useRef, useState, useMemo } from 'react';
import { 
  Sparkles, 
  Mic, 
  PlayCircle, 
  Send, 
  FileText, 
  ListOrdered, 
  Copy, 
  Check, 
  Edit2, 
  Trash2, 
  Archive, 
  UploadCloud,
  Search,
  CheckCircle2,
  Clock,
  MessageCircle,
  X,
  Cloud,
  Settings
} from 'lucide-react';
import { SalesLead, RecordingItem } from '../../../types/leadTypes';
import { CustomAudioPlayer, CustomAudioPlayerRef } from './CustomAudioPlayer';
import { parseAiTranscript, generateAiCallSummary, extractSpecialMemoFromSummary } from '../../../services/aiCallSummaryService';
import { uploadRecordingToDrive, getGoogleDriveConfig } from '../../../services/communicationService';
import { GoogleDriveSettingsModal } from './GoogleDriveSettingsModal';
import { toast } from 'sonner';

interface CaseDetailAiSummaryProps {
  lead: SalesLead;
  onUpdateLead: (updated: SalesLead) => void;
  onSaveSummaryToMemo?: (summaryText: string) => void;
  activeLawyerEmail?: string;
  activeLawyerName?: string;
}

export const CaseDetailAiSummary: React.FC<CaseDetailAiSummaryProps> = ({
  lead,
  onUpdateLead,
  onSaveSummaryToMemo,
  activeLawyerEmail,
  activeLawyerName
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'transcript'>('summary');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedSummary, setEditedSummary] = useState(lead.aiSummary || '');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramRooms] = useState<Array<{ id: string; name: string; url: string }>>(() => {
    try {
      const saved = localStorage.getItem('lm_telegramRooms') || localStorage.getItem('legal_crm_telegram_rooms');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'room-1', name: '회생파산 전담팀', url: 'https://t.me/c/123456789/1' },
      { id: 'room-2', name: '상담 브리핑 채널', url: 'https://t.me/c/987654321/1' }
    ];
  });

  const playerRef = useRef<CustomAudioPlayerRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatArchiveDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yy}.${mm}.${dd} ${hh}:${min}`;
    } catch {
      return '';
    }
  };

  const handleDeleteRecording = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm('해당 통화 녹음 파일을 삭제하시겠습니까?')) {
      const filtered = (lead.recordings || []).filter(r => r.id !== id);
      onUpdateLead({
        ...lead,
        recordings: filtered,
        updatedAt: new Date().toISOString()
      });
      if (currentAudioUrl && lead.recordings?.find(r => r.id === id)?.url === currentAudioUrl) {
        setCurrentAudioUrl(filtered.length > 0 ? filtered[0].url : null);
      }
      toast.info('녹음 파일이 삭제되었습니다.');
    }
  };

  const handleDeleteAiSummary = () => {
    if (window.confirm('AI 요약본을 삭제하시겠습니까?')) {
      onUpdateLead({
        ...lead,
        aiSummary: undefined,
        updatedAt: new Date().toISOString()
      });
      toast.info('AI 요약본이 삭제되었습니다.');
    }
  };

  const handleTelegramSendClick = () => {
    if (!lead.aiSummary) return;

    const textToCopy = summaryText || lead.aiSummary;
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (telegramRooms.length === 1) {
        window.open(telegramRooms[0].url, '_blank');
        toast.success('텔레그램 방이 열렸습니다. 붙여넣기(Ctrl+V)하여 전송하세요.');
      } else {
        setIsTelegramModalOpen(true);
      }
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
      toast.error('클립보드 복사에 실패했습니다.');
    });
  };

  const handleRoomSelect = (url: string) => {
    window.open(url, '_blank');
    setIsTelegramModalOpen(false);
    toast.success('텔레그램 방이 열렸습니다. 붙여넣기(Ctrl+V)하여 전송하세요.');
  };

  // ── [누적 아카이빙] 현재 활성화된 녹음 아이템 탐색 ──
  const activeRecording = useMemo(() => {
    if (activeRecordingId) {
      const found = lead.recordings?.find(r => r.id === activeRecordingId);
      if (found) return found;
    }
    if (lead.recordings && lead.recordings.length > 0) {
      return lead.recordings[0];
    }
    return null;
  }, [activeRecordingId, lead.recordings]);

  // 현재 표시할 요약문 원문 (선택된 녹음의 개별 요약문 우선, 없으면 케이스 대표 aiSummary)
  const currentRawSummary = useMemo(() => {
    if (activeRecording?.aiSummary) {
      return activeRecording.aiSummary;
    }
    return lead.aiSummary || '';
  }, [activeRecording, lead.aiSummary]);

  // Parse raw text into structured summary and timestamped transcript lines
  const { summaryText, transcriptLines, rawTranscript } = useMemo(() => {
    return parseAiTranscript(currentRawSummary);
  }, [currentRawSummary]);

  // Filtered transcript lines for search
  const filteredTranscriptLines = useMemo(() => {
    if (!transcriptSearch.trim()) return transcriptLines;
    const q = transcriptSearch.toLowerCase();
    return transcriptLines.filter(line =>
      line.text.toLowerCase().includes(q) ||
      line.speaker.toLowerCase().includes(q) ||
      line.time.includes(q)
    );
  }, [transcriptLines, transcriptSearch]);

  // Active audio URL: local selected file blob URL, or active recording URL
  const activeAudioUrl = useMemo(() => {
    if (currentAudioUrl) return currentAudioUrl;
    if (activeRecording) return activeRecording.url;
    if (lead.recordings && lead.recordings.length > 0) {
      return lead.recordings[0].url;
    }
    return null;
  }, [currentAudioUrl, activeRecording, lead.recordings]);

  const activeFileName = useMemo(() => {
    if (selectedFile) return selectedFile.name;
    if (activeRecording) return activeRecording.filename;
    if (lead.recordings && lead.recordings.length > 0) {
      return lead.recordings[0].filename;
    }
    return '통화 녹음 파일';
  }, [selectedFile, activeRecording, lead.recordings]);

  // Handle file select & 자동 구글 드라이브 업로드
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate audio mime type or extension
    const validExtensions = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.webm'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!file.type.startsWith('audio/') && !hasValidExt) {
      toast.error('음성 녹음 파일(MP3, M4A, WAV 등)만 업로드할 수 있습니다.');
      return;
    }

    setSelectedFile(file);
    const blobUrl = URL.createObjectURL(file);
    setCurrentAudioUrl(blobUrl);

    // 구글 드라이브 자동 업로드 시도
    const driveCfg = getGoogleDriveConfig();
    setIsUploadingToDrive(true);
    toast.info(`'${file.name}'을 구글 드라이브에 안전하게 업로드하고 있습니다...`);

    try {
      const uploadRes = await uploadRecordingToDrive(file, driveCfg, activeLawyerEmail);
      if (uploadRes.status === 'success') {
        setCurrentAudioUrl(uploadRes.url);
        toast.success(`구글 드라이브에 업로드되었습니다! [AI 분석]을 클릭하여 대화록을 생성하세요.`);
      } else {
        toast.info(`파일이 로드되었습니다. (로컬 플레이어 모드)`);
      }
    } catch {
      toast.info(`파일이 로드되었습니다. [AI 분석]을 클릭하세요.`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Generate AI Summary (Gemini 3.5 기반 + 누적 아카이빙)
  const handleGenerateAiSummary = async () => {
    if (!selectedFile && (!lead.recordings || lead.recordings.length === 0)) {
      toast.error('분석할 통화 녹음 파일을 먼저 업로드해주세요.');
      triggerFileInput();
      return;
    }

    setIsAiLoading(true);
    toast.info('Gemini 3.5가 통화 녹음을 화자분리 대화록으로 정밀 분석하고 있습니다...');

    try {
      const fileToAnalyze = selectedFile || new File(['mock'], activeFileName, { type: 'audio/mp3' });
      const context = {
        customerName: lead.customerName,
        phone: lead.phone,
        managerName: lead.assigneeName || '진성훈 사무장',
        caseType: lead.caseType || '개인회생'
      };

      const resultText = await generateAiCallSummary(fileToAnalyze, context);

      // Create new recording item if new file selected (or update existing)
      const newRecId = `rec-${Date.now()}`;
      const newRecordingItem: RecordingItem = {
        id: newRecId,
        filename: selectedFile ? selectedFile.name : activeFileName,
        uploadDate: new Date().toISOString(),
        url: currentAudioUrl || activeAudioUrl || '',
        mimeType: selectedFile?.type || 'audio/mp3',
        aiSummary: resultText,
        accountEmail: activeLawyerEmail
      };

      const existingRecordings = lead.recordings || [];
      const updatedRecordings = selectedFile 
        ? [newRecordingItem, ...existingRecordings]
        : existingRecordings.map(r => r.id === activeRecording?.id ? { ...r, aiSummary: resultText } : r);

      const updatedLead: SalesLead = {
        ...lead,
        aiSummary: resultText,
        recordings: updatedRecordings,
        updatedAt: new Date().toISOString()
      };

      onUpdateLead(updatedLead);
      setActiveRecordingId(newRecId);
      setEditedSummary(resultText);
      setSelectedFile(null);
      toast.success('Gemini 3.5 통화 요약 및 대화록 작성이 완료되었습니다! (누적 아카이빙 저장)');
    } catch (err) {
      console.error('AI summary error:', err);
      toast.error('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Seek to timestamp on clicking timestamp
  const handleSeekToTimestamp = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
      toast.info(`⏱️ ${Math.floor(seconds / 60)}분 ${seconds % 60}초 구간으로 이동합니다.`);
    } else {
      toast.error('재생할 오디오가 로드되지 않았습니다.');
    }
  };

  // Copy transcript
  const handleCopyTranscript = () => {
    const textToCopy = rawTranscript || transcriptLines.map(l => `[${l.time}] ${l.speaker}: ${l.text}`).join('\n');
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedTranscript(true);
      toast.success('전체 대화록이 클립보드에 복사되었습니다.');
      setTimeout(() => setCopiedTranscript(false), 2000);
    }).catch(() => {
      toast.error('복사에 실패했습니다.');
    });
  };

  // Save edited summary text
  const handleSaveEditedSummary = () => {
    const updatedLead: SalesLead = {
      ...lead,
      aiSummary: editedSummary,
      updatedAt: new Date().toISOString()
    };
    onUpdateLead(updatedLead);
    setEditMode(false);
    toast.success('요약문이 수정 저장되었습니다.');
  };

  // Send summary to memo & briefing (특이사항만 정제 추출하여 전달)
  const handleTransferToMemo = () => {
    const textToTransfer = summaryText || lead.aiSummary;
    if (!textToTransfer) return;

    // 특이사항 섹션만 깨끗하게 분리 (대화록 원문 유입 차단)
    const refinedMemo = extractSpecialMemoFromSummary(textToTransfer);

    if (onSaveSummaryToMemo) {
      onSaveSummaryToMemo(refinedMemo);
    } else {
      // Default: Append to lead memos and special memo
      const newMemo = {
        id: `memo-${Date.now()}`,
        content: `[AI 통화 특이사항 요약]\n${refinedMemo}`,
        createdAt: new Date().toISOString(),
        authorName: 'Gemini 3.5 비서'
      };

      const updatedLead: SalesLead = {
        ...lead,
        memos: [newMemo, ...(lead.memos || [])],
        specialMemo: lead.specialMemo 
          ? `${lead.specialMemo}\n\n[AI 통화 요약]\n${refinedMemo}`
          : refinedMemo,
        updatedAt: new Date().toISOString()
      };
      onUpdateLead(updatedLead);
      toast.success('특이사항 요약이 상담 메모 및 브리핑에 성공적으로 반영되었습니다.');
    }
  };

  return (
    <div className="bg-purple-50/60 rounded-2xl border border-purple-200/80 p-4 shadow-sm space-y-3.5">
      {/* 헤더 & 액션 버튼 */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
              <span>AI 상담 요약</span>
              <span className="text-[10px] bg-purple-200/90 text-purple-900 font-extrabold px-2 py-0.5 rounded-full">
                Gemini 3.5 Transcribe
              </span>
            </h3>
            <p className="text-[11px] text-purple-700/80">
              구글 드라이브 자동 보관 & 화자분리 타임스탬프 대화록 누적 아카이빙
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 구글 드라이브 설정 버튼 */}
          <button
            type="button"
            onClick={() => setIsDriveModalOpen(true)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 font-bold transition-all cursor-pointer"
            title="통화 녹취 보관용 구글 계정 및 드라이브 설정"
          >
            <Cloud size={13} className="text-purple-600" />
            <span>구글 드라이브 설정</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*,.mp3,.m4a,.wav,.aac"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={triggerFileInput}
            disabled={isUploadingToDrive}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border transition-all font-bold cursor-pointer ${
              selectedFile
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <UploadCloud size={14} className="shrink-0 text-purple-600" />
            <span className="truncate max-w-[120px]">
              {isUploadingToDrive ? '드라이브 업로드 중...' : selectedFile ? selectedFile.name : '녹음 업로드'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleGenerateAiSummary}
            disabled={isAiLoading}
            className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-1.5 rounded-xl font-extrabold disabled:opacity-50 transition-all shadow-xs press-scale whitespace-nowrap cursor-pointer active:scale-[0.98]"
          >
            <Sparkles size={13} className={isAiLoading ? 'animate-spin' : ''} />
            <span>{isAiLoading ? '정밀 분석 중...' : 'AI 분석'}</span>
          </button>
        </div>
      </div>

      {/* 오디오 플레이어 (seekTo 연동 & 구글 드라이브 표준 플레이어) */}
      {activeAudioUrl && (
        <CustomAudioPlayer
          ref={playerRef}
          src={activeAudioUrl}
          fileName={activeFileName}
        />
      )}

      {/* 녹음 파일 아카이브 (누적 보관된 녹취 목록) */}
      {lead.recordings && lead.recordings.length > 0 && (
        <div className="mb-2 bg-white/90 rounded-xl border border-purple-100 p-2.5 shadow-2xs">
          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between px-0.5">
            <span className="flex items-center gap-1.5">
              <Archive size={13} className="text-purple-600" />
              <span>녹음 아카이브 ({lead.recordings.length}건)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              * 클릭 시 해당 녹음 파일 및 당시 대화록으로 즉시 전환
            </span>
          </h4>
          <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
            {lead.recordings.map((rec) => {
              const isSelected = activeRecording?.id === rec.id || activeAudioUrl === rec.url;
              return (
                <div
                  key={rec.id}
                  onClick={() => {
                    setActiveRecordingId(rec.id);
                    setCurrentAudioUrl(rec.url);
                    setSelectedFile(null);
                    toast.info(`'${rec.filename}' 녹음 파일 및 당시 대화록으로 전환되었습니다.`);
                  }}
                  className={`flex justify-between items-center p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-100/90 border-purple-400 font-bold shadow-2xs ring-1 ring-purple-400/30'
                      : 'bg-white border-slate-200/80 hover:bg-purple-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <PlayCircle
                      size={15}
                      className={isSelected ? 'text-purple-600 shrink-0' : 'text-slate-400 shrink-0'}
                    />
                    <div className="truncate">
                      <span className={isSelected ? 'text-purple-900' : 'font-medium text-slate-800'}>
                        {rec.filename}
                      </span>
                      <span className="text-slate-400 text-[10px] ml-2 font-mono">
                        {formatArchiveDate(rec.uploadDate)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRecording(rec.id, e);
                    }}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors ml-1 cursor-pointer"
                    title="녹음 파일 삭제"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 서브 탭 스위처 (1. 요약문 vs 2. 전체 대화록) */}
      <div className="flex items-center justify-between border-b border-purple-200 pt-1">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveSubTab('summary')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
              activeSubTab === 'summary'
                ? 'bg-white text-purple-800 border-t border-l border-r border-purple-200 shadow-2xs'
                : 'text-slate-500 hover:text-purple-700'
            }`}
          >
            <FileText size={13} />
            <span>1. 상담 요약문</span>
          </button>
          <button
            onClick={() => setActiveSubTab('transcript')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
              activeSubTab === 'transcript'
                ? 'bg-white text-purple-800 border-t border-l border-r border-purple-200 shadow-2xs'
                : 'text-slate-500 hover:text-purple-700'
            }`}
          >
            <ListOrdered size={13} />
            <span>2. 전체 대화록</span>
            {transcriptLines.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full text-[10px] font-mono">
                {transcriptLines.length}
              </span>
            )}
          </button>
        </div>

        {activeSubTab === 'transcript' && transcriptLines.length > 0 && (
          <button
            onClick={handleCopyTranscript}
            className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 px-2 py-1 rounded hover:bg-purple-100 transition-colors font-medium cursor-pointer"
            title="전체 대화록 복사"
          >
            {copiedTranscript ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            <span>{copiedTranscript ? '복사완료' : '전체 복사'}</span>
          </button>
        )}
      </div>

      {/* 탭 1: AI 상담 요약문 */}
      {activeSubTab === 'summary' && (
        <div className="bg-white p-3.5 rounded-xl border border-purple-200/70 shadow-2xs relative min-h-[140px]">
          {editMode ? (
            <div className="space-y-2">
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className="w-full h-48 p-2.5 text-xs text-slate-800 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed font-sans resize-y"
                placeholder="AI 요약 내용을 편집하세요..."
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setEditMode(false)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEditedSummary}
                  className="px-3 py-1 text-xs rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700"
                >
                  수정 저장
                </button>
              </div>
            </div>
          ) : (
            <div>
              {lead.aiSummary ? (
                <div>
                  <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-purple-600" />
                      18개 항목 정밀 분석 요약
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditedSummary(lead.aiSummary || '');
                          setEditMode(true);
                        }}
                        className="text-slate-400 hover:text-purple-700 p-1 rounded hover:bg-purple-50 transition-colors"
                        title="요약문 직접 수정"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={handleDeleteAiSummary}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                        title="AI 요약본 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed space-y-1">
                    {summaryText || lead.aiSummary}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mx-auto">
                    <Mic size={20} />
                  </div>
                  <p className="text-xs font-medium text-slate-600">아직 분석된 AI 통화 요약이 없습니다.</p>
                  <p className="text-[11px] text-slate-400">
                    상단의 [녹음 파일 선택] 후 [AI 분석 실행]을 누르면 18개 항목 구조화 요약이 생성됩니다.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 탭 2: 화자분리 & 타임스탬프 대화록 */}
      {activeSubTab === 'transcript' && (
        <div className="bg-white p-3.5 rounded-xl border border-purple-200/70 shadow-2xs min-h-[160px] space-y-2.5">
          {transcriptLines.length > 0 ? (
            <div>
              {/* 대화록 검색창 */}
              <div className="relative mb-2.5">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="대화 키워드, 화자, 타임스탬프 검색..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>

              {/* 대화 목록 (스크롤) */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredTranscriptLines.map((line) => {
                  const isAgent = 
                    line.speaker.includes('상담원') || 
                    line.speaker.includes('사무장') || 
                    line.speaker.includes('변호사') ||
                    line.speaker.includes('담당자');

                  return (
                    <div
                      key={line.id}
                      className={`p-2.5 rounded-xl border text-xs leading-relaxed transition-all ${
                        isAgent
                          ? 'bg-indigo-50/70 border-indigo-100 text-indigo-950'
                          : 'bg-purple-50/50 border-purple-100 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isAgent
                                ? 'bg-indigo-600 text-white'
                                : 'bg-purple-600 text-white'
                            }`}
                          >
                            {isAgent ? '👤 상담원' : '🧑 고객'}
                          </span>
                          {line.speaker !== '상담원' && line.speaker !== '고객' && (
                            <span className="text-slate-500 text-[11px]">({line.speaker})</span>
                          )}
                        </div>

                        {/* 타임스탬프 클릭 시 해당 오디오 구간으로 seekTo 점프 */}
                        <button
                          onClick={() => handleSeekToTimestamp(line.seconds)}
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-purple-200 hover:border-purple-400 text-purple-700 hover:bg-purple-50 rounded text-[10px] font-mono transition-colors shadow-2xs cursor-pointer font-bold"
                          title="이 발언 시점으로 이동하여 오디오 재생"
                        >
                          <PlayCircle size={11} className="text-purple-600" />
                          <span>{line.time}</span>
                        </button>
                      </div>

                      <div className="pl-1 text-slate-800 whitespace-pre-wrap">
                        {line.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 space-y-2">
              <Clock size={22} className="mx-auto text-purple-300" />
              <p className="text-xs font-medium text-slate-600">분석된 타임스탬프 대화록이 없습니다.</p>
              <p className="text-[11px] text-slate-400">
                음성 녹음 파일을 업로드하고 [AI 분석 실행]을 누르면 구간별 대화록이 생성됩니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 하단 전달 & 텔레그램 버튼 */}
      {lead.aiSummary && !editMode && (
        <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
          <button
            onClick={handleTransferToMemo}
            className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold px-3 py-2 rounded-xl transition-colors shadow-2xs press-scale cursor-pointer"
          >
            <Send size={13} />
            <span>상담 내용으로 보내기 (특이사항 추가)</span>
          </button>
          <button
            onClick={handleTelegramSendClick}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors press-scale cursor-pointer"
          >
            <MessageCircle size={14} />
            <span>텔레그램 전송</span>
          </button>
        </div>
      )}

      {/* 텔레그램 전송 대상 방 선택 모달 */}
      {isTelegramModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden transform transition-all animate-scale-in">
            <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <MessageCircle size={17} /> 전송할 방 선택
              </h3>
              <button
                onClick={() => setIsTelegramModalOpen(false)}
                className="text-indigo-200 hover:text-white transition-colors p-0.5"
              >
                <X size={17} />
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              <p className="text-xs text-slate-500 leading-relaxed">
                요약문이 클립보드에 자동 복사되었습니다.<br/>
                전송할 방을 선택하시고 브라우저가 열리면 붙여넣기(Ctrl+V)해 주세요.
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                {telegramRooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => handleRoomSelect(room.url)}
                    className="w-full text-left p-3 border border-indigo-100 flex items-center justify-between rounded-xl bg-indigo-50/70 hover:bg-indigo-100 transition-colors group cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-xs text-indigo-950 group-hover:text-indigo-700">{room.name}</span>
                      <span className="text-[10px] text-indigo-400 mt-0.5 truncate max-w-[180px]">{room.url}</span>
                    </div>
                    <Send size={13} className="text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 구글 드라이브 연동 설정 모달 */}
      <GoogleDriveSettingsModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        activeLawyerEmail={activeLawyerEmail}
        activeLawyerName={activeLawyerName}
      />
    </div>
  );
};
