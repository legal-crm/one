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
  Clock
} from 'lucide-react';
import { SalesLead, RecordingItem } from '../../../types/leadTypes';
import { CustomAudioPlayer, CustomAudioPlayerRef } from './CustomAudioPlayer';
import { parseAiTranscript, generateAiCallSummary } from '../../../services/aiCallSummaryService';
import { toast } from 'sonner';

interface CaseDetailAiSummaryProps {
  lead: SalesLead;
  onUpdateLead: (updated: SalesLead) => void;
  onSaveSummaryToMemo?: (summaryText: string) => void;
}

export const CaseDetailAiSummary: React.FC<CaseDetailAiSummaryProps> = ({
  lead,
  onUpdateLead,
  onSaveSummaryToMemo
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'transcript'>('summary');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedSummary, setEditedSummary] = useState(lead.aiSummary || '');

  const playerRef = useRef<CustomAudioPlayerRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse raw text into structured summary and timestamped transcript lines
  const { summaryText, transcriptLines, rawTranscript } = useMemo(() => {
    return parseAiTranscript(lead.aiSummary);
  }, [lead.aiSummary]);

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

  // Active audio URL: local selected file blob URL, or current audio URL, or latest recording
  const activeAudioUrl = useMemo(() => {
    if (currentAudioUrl) return currentAudioUrl;
    if (lead.recordings && lead.recordings.length > 0) {
      return lead.recordings[0].url;
    }
    return null;
  }, [currentAudioUrl, lead.recordings]);

  const activeFileName = useMemo(() => {
    if (selectedFile) return selectedFile.name;
    if (currentAudioUrl) {
      const found = lead.recordings?.find(r => r.url === currentAudioUrl);
      if (found) return found.filename;
    }
    if (lead.recordings && lead.recordings.length > 0) {
      return lead.recordings[0].filename;
    }
    return '통화 녹음 파일';
  }, [selectedFile, currentAudioUrl, lead.recordings]);

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    toast.success(`'${file.name}' 파일이 로드되었습니다. [AI 분석]을 클릭하세요.`);
  };

  // Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Generate AI Summary
  const handleGenerateAiSummary = async () => {
    if (!selectedFile && (!lead.recordings || lead.recordings.length === 0)) {
      toast.error('분석할 통화 녹음 파일을 먼저 업로드해주세요.');
      triggerFileInput();
      return;
    }

    setIsAiLoading(true);
    toast.info('Gemini AI가 통화 녹음을 정밀 분석하고 있습니다...');

    try {
      const fileToAnalyze = selectedFile || new File(['mock'], activeFileName, { type: 'audio/mp3' });
      const context = {
        customerName: lead.customerName,
        phone: lead.phone,
        managerName: lead.assigneeName || '진성훈 사무장',
        caseType: lead.caseType || '개인회생'
      };

      const resultText = await generateAiCallSummary(fileToAnalyze, context);

      // Create new recording item if new file selected
      const newRecordings = [...(lead.recordings || [])];
      if (selectedFile && currentAudioUrl) {
        newRecordings.unshift({
          id: `rec-${Date.now()}`,
          filename: selectedFile.name,
          uploadDate: new Date().toISOString(),
          url: currentAudioUrl,
          mimeType: selectedFile.type || 'audio/mp3'
        });
      }

      const updatedLead: SalesLead = {
        ...lead,
        aiSummary: resultText,
        recordings: newRecordings,
        updatedAt: new Date().toISOString()
      };

      onUpdateLead(updatedLead);
      setEditedSummary(resultText);
      toast.success('AI 통화 요약 및 대화록 작성이 완료되었습니다!');
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

  // Send summary to memo & briefing
  const handleTransferToMemo = () => {
    const textToTransfer = summaryText || lead.aiSummary;
    if (!textToTransfer) return;

    if (onSaveSummaryToMemo) {
      onSaveSummaryToMemo(textToTransfer);
    } else {
      // Default: Append to lead memos and special memo
      const newMemo = {
        id: `memo-${Date.now()}`,
        content: `[AI 통화 요약]\n${textToTransfer}`,
        createdAt: new Date().toISOString(),
        authorName: 'AI 통화 비서'
      };

      const updatedLead: SalesLead = {
        ...lead,
        memos: [newMemo, ...(lead.memos || [])],
        specialMemo: lead.specialMemo 
          ? `${lead.specialMemo}\n\n[AI 상담 요약]\n${textToTransfer}`
          : textToTransfer,
        updatedAt: new Date().toISOString()
      };
      onUpdateLead(updatedLead);
      toast.success('상담 메모 및 브리핑에 성공적으로 반영되었습니다.');
    }
  };

  return (
    <div className="bg-purple-50/60 rounded-2xl border border-purple-200/80 p-4 shadow-sm space-y-3.5">
      {/* 헤더 & 액션 버튼 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
              <span>AI 통화 요약 & 대화록</span>
              <span className="text-[10px] bg-purple-200/80 text-purple-800 font-bold px-1.5 py-0.5 rounded-full">
                Gemini 2.5 Flash
              </span>
            </h3>
            <p className="text-[11px] text-purple-700/80">
              통화 녹음 업로드 시 18개 항목 구조화 요약 및 타임스탬프 대화록 자동 작성
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*,.mp3,.m4a,.wav,.aac"
            onChange={handleFileSelect}
          />
          <button
            onClick={triggerFileInput}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border transition-all font-medium ${
              selectedFile
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <UploadCloud size={14} className="shrink-0 text-purple-600" />
            <span className="truncate max-w-[120px]">
              {selectedFile ? selectedFile.name : '녹음 파일 선택'}
            </span>
          </button>

          <button
            onClick={handleGenerateAiSummary}
            disabled={isAiLoading}
            className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 transition-all shadow-xs press-scale whitespace-nowrap cursor-pointer"
          >
            <Sparkles size={13} className={isAiLoading ? 'animate-spin' : ''} />
            {isAiLoading ? '정밀 분석 중...' : 'AI 분석 실행'}
          </button>
        </div>
      </div>

      {/* 오디오 플레이어 (seekTo 연동) */}
      {activeAudioUrl && (
        <CustomAudioPlayer
          ref={playerRef}
          src={activeAudioUrl}
          fileName={activeFileName}
        />
      )}

      {/* 녹음 파일 아카이브 (이전 녹음 목록이 있을 때) */}
      {lead.recordings && lead.recordings.length > 0 && (
        <div className="bg-white/80 rounded-xl border border-purple-100 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-purple-900 font-bold px-1">
            <span className="flex items-center gap-1">
              <Archive size={12} className="text-purple-600" /> 녹음 파일 보관함 ({lead.recordings.length}건)
            </span>
            <span className="text-slate-400 text-[10px]">클릭 시 해당 녹음으로 전환</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto no-scrollbar">
            {lead.recordings.map((rec) => {
              const isCurrent = activeAudioUrl === rec.url;
              return (
                <div
                  key={rec.id}
                  onClick={() => setCurrentAudioUrl(rec.url)}
                  className={`flex items-center justify-between p-1.5 px-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-purple-100 text-purple-900 font-bold border border-purple-200'
                      : 'bg-slate-50 hover:bg-purple-50/50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <PlayCircle size={14} className={isCurrent ? 'text-purple-600' : 'text-slate-400'} />
                    <span className="truncate">{rec.filename}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {rec.uploadDate ? new Date(rec.uploadDate).toLocaleDateString() : ''}
                  </span>
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

      {/* 하단 전달 버튼 */}
      {lead.aiSummary && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-purple-800 font-medium">
            💡 요약 결과를 상담 메모로 전송하면 브리핑 보드에 즉시 반영됩니다.
          </span>
          <button
            onClick={handleTransferToMemo}
            className="flex items-center gap-1.5 text-xs bg-purple-700 hover:bg-purple-800 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition-colors press-scale cursor-pointer"
          >
            <Send size={13} />
            <span>상담 메모로 전송 (특이사항 추가)</span>
          </button>
        </div>
      )}
    </div>
  );
};
