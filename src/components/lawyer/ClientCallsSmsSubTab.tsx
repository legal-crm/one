import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  MessageSquare, 
  Plus, 
  Save, 
  Send, 
  Smartphone, 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  Filter, 
  Clock, 
  Sparkles, 
  Download, 
  PlayCircle, 
  Volume2, 
  ExternalLink, 
  X,
  Cloud,
  UploadCloud,
  FileAudio,
  Check
} from 'lucide-react';
import type { ConsultRequest, CrmClientExtension, User } from '../../types';
import type { CommunicationLog, SmsTemplate, RecordingItem } from '../../types/leadTypes';
import { 
  fetchCommunicationLogs, 
  fetchSmsTemplates, 
  saveSmsTemplate, 
  deleteSmsTemplate, 
  enqueueSms,
  enqueueCall,
  subscribeToCommunicationLogs,
  findMatchingRecordingForLog,
  exportCommunicationLogsAsText,
  DEFAULT_SMS_TEMPLATES,
  uploadRecordingToDrive,
  getGoogleDriveConfig
} from '../../services/communicationService';
import { generateAiCallSummary } from '../../services/aiCallSummaryService';
import { CustomAudioPlayer } from './leads/CustomAudioPlayer';
import { GoogleDriveSettingsModal } from './leads/GoogleDriveSettingsModal';
import { toast } from 'sonner';

interface ClientCallsSmsSubTabProps {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyer: User;
  onUpdateExt: (updated: CrmClientExtension) => void;
}

export const ClientCallsSmsSubTab: React.FC<ClientCallsSmsSubTabProps> = ({
  clientRequest,
  crmExt,
  activeLawyer,
  onUpdateExt,
}) => {
  const [dbLogs, setDbLogs] = useState<CommunicationLog[]>(crmExt.communicationLogs || []);
  const [templates, setTemplates] = useState<SmsTemplate[]>(DEFAULT_SMS_TEMPLATES);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Template & Custom Message State
  const [activeTemplateId, setActiveTemplateId] = useState<string>('custom');
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'calls' | 'sms'>('all');
  const [simLine, setSimLine] = useState<'기본' | '투넘버'>('기본');
  const [playingRecording, setPlayingRecording] = useState<RecordingItem | null>(null);

  // Quick Call Modal / Form
  const [showQuickCall, setShowQuickCall] = useState(false);
  const [quickCallType, setQuickCallType] = useState<'CALL_OUT' | 'CALL_IN' | 'CALL_MISSED'>('CALL_OUT');
  const [quickCallDuration, setQuickCallDuration] = useState(180);
  const [quickCallMemo, setQuickCallMemo] = useState('');

  // Audio Upload & Gemini 3.5 Transcribe
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [uploadAudioFile, setUploadAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clientPhone = clientRequest.phone || '';
  const clientName = clientRequest.realClientName || clientRequest.clientName || '의뢰인';

  // 분쟁 대비 통화 및 문자 내역 공식 소명 증빙 파일 다운로드 (TXT)
  const handleExportLogs = () => {
    if (dbLogs.length === 0) {
      toast.error('내보낼 통화 및 문자 내역이 없습니다.');
      return;
    }
    const textContent = exportCommunicationLogsAsText(dbLogs, clientName, clientPhone);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `[통화문자증빙]_${clientName}_${clientPhone.replace(/[^0-9]/g, '')}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('통화 및 문자 소명 증빙 파일(TXT)이 다운로드되었습니다.');
  };

  // Fetch real logs from Supabase & subscribe to Realtime changes
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setIsLoadingLogs(true);
      try {
        const [fetchedLogs, fetchedTemplates] = await Promise.all([
          fetchCommunicationLogs(clientPhone),
          fetchSmsTemplates()
        ]);
        if (isMounted) {
          if (fetchedLogs && fetchedLogs.length > 0) {
            setDbLogs(fetchedLogs);
          } else if (crmExt.communicationLogs && crmExt.communicationLogs.length > 0) {
            setDbLogs(crmExt.communicationLogs);
          }
          if (fetchedTemplates && fetchedTemplates.length > 0) {
            setTemplates(fetchedTemplates);
          }
        }
      } catch (err) {
        console.warn('Init communication tab failed:', err);
      } finally {
        if (isMounted) setIsLoadingLogs(false);
      }
    };

    init();

    const unsubscribe = subscribeToCommunicationLogs(clientPhone, (newLog) => {
      setDbLogs(prev => {
        if (prev.some(l => l.id === newLog.id)) return prev;
        const next = [...prev, newLog];
        onUpdateExt({
          ...crmExt,
          communicationLogs: next,
          lastActivityAt: new Date().toISOString()
        });
        return next;
      });
      toast.info(`스마트폰에서 새 ${newLog.type.includes('CALL') ? '통화' : '문자'} 기록이 수신되었습니다.`);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [clientPhone]);

  // Filter logs
  const filteredLogs = dbLogs.filter(log => {
    if (selectedFilter === 'calls') return log.type.includes('CALL');
    if (selectedFilter === 'sms') return log.type.includes('SMS');
    return true;
  });

  // Calculate message length & SMS/LMS type
  const messageContent = activeTemplateId === 'custom'
    ? customMessage
    : (templates.find(t => t.id === activeTemplateId)?.content || '');
  const charLength = messageContent.length;
  const isLms = charLength > 90;

  // Send SMS handler (writes into pending_sms queue for Android App)
  const handleSendSms = async () => {
    if (!messageContent.trim()) {
      toast.error('발송할 문자 내용을 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      const res = await enqueueSms(clientPhone, messageContent, simLine);
      if (res.success) {
        toast.success(res.message);
        if (res.log) {
          const updated = [...dbLogs, res.log];
          setDbLogs(updated);
          onUpdateExt({
            ...crmExt,
            communicationLogs: updated,
            lastActivityAt: new Date().toISOString()
          });
        }
        if (activeTemplateId === 'custom') {
          setCustomMessage('');
        }
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      console.error(e);
      toast.error('문자 발송 요청 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.title.trim() || !editingTemplate.content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    if (!editingTemplate.id && templates.length >= 5) {
      toast.error('문자 템플릿은 최대 5개까지만 등록할 수 있습니다.');
      return;
    }

    try {
      const saved = await saveSmsTemplate(editingTemplate);
      const nextTemplates = editingTemplate.id
        ? templates.map(t => t.id === saved.id ? saved : t)
        : [...templates, saved];
      setTemplates(nextTemplates);
      setEditingTemplate(null);
      toast.success('템플릿이 저장되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('템플릿 저장 실패');
    }
  };

  // Delete template
  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSmsTemplate(id);
      const nextTemplates = templates.filter(t => t.id !== id);
      setTemplates(nextTemplates);
      if (activeTemplateId === id) {
        setActiveTemplateId('custom');
      }
      toast.info('템플릿이 삭제되었습니다.');
    } catch (e) {
      console.error(e);
    }
  };

  // Manual Quick Call Log Simulation
  const handleAddQuickCall = () => {
    const newLog: CommunicationLog = {
      id: `call-${Date.now()}`,
      phoneNumber: clientPhone,
      type: quickCallType,
      duration: quickCallType === 'CALL_MISSED' ? 0 : quickCallDuration,
      content: quickCallMemo.trim() || (quickCallType === 'CALL_MISSED' ? '부재중 통화' : '의뢰인 유선 상담'),
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      lineInfo: simLine
    };

    const updatedLogs = [...dbLogs, newLog];
    setDbLogs(updatedLogs);
    onUpdateExt({
      ...crmExt,
      communicationLogs: updatedLogs,
      lastActivityAt: new Date().toISOString()
    });
    setQuickCallMemo('');
    setShowQuickCall(false);
    toast.success('통화 기록이 타임라인에 등록되었습니다.');
  };

  // Direct Audio File Upload & Gemini 3.5 Transcribe
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadAudioFile(file);
    e.target.value = '';

    setIsTranscribing(true);
    setUploadProgressText('구글 드라이브에 통화 녹취 업로드 중...');

    try {
      // 1. Google Drive Upload
      const driveRes = await uploadRecordingToDrive(file, crmExt.googleDriveConfig, activeLawyer.email);
      
      const newRecording: RecordingItem = {
        id: `rec-${Date.now()}`,
        filename: file.name,
        url: driveRes.url,
        driveFileId: driveRes.driveFileId,
        uploadedAt: new Date().toISOString(),
        duration: 0,
      };

      setUploadProgressText('Gemini 3.5 Transcribe로 화자분리 및 대화록 작성 중...');

      // 2. Gemini 3.5 Transcribe Analysis
      const aiResult = await generateAiCallSummary(file, {
        customerName: clientName,
        phone: clientPhone,
        managerName: activeLawyer.name,
        caseType: crmExt.caseType === 'bankruptcy' ? '개인파산·면책' : '개인회생'
      });

      const updatedRecordings = [newRecording, ...(crmExt.recordings || [])];
      const updated: CrmClientExtension = {
        ...crmExt,
        recordings: updatedRecordings,
        aiSummary: aiResult.rawTranscript,
        lastActivityAt: new Date().toISOString()
      };

      onUpdateExt(updated);
      setPlayingRecording(newRecording);
      toast.success('통화 녹취 업로드 및 Gemini 3.5 AI 대화록 생성이 완료되었습니다.');
    } catch (err: any) {
      console.error(err);
      toast.error(`녹음 분석 실패: ${err.message || '오류 발생'}`);
    } finally {
      setIsTranscribing(false);
      setUploadProgressText('');
      setUploadAudioFile(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── 상단 정보 바: 의뢰인 통화·문자 영구 보존 안내 및 도구 ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Smartphone size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900">
                {clientName} 의뢰인 통화 및 문자 영구 보존 보관함
              </h3>
              <span className="text-[11px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                {clientPhone}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              스마트폰 삭제 대비 법적 분쟁 소명용 영구 보존 (구글 드라이브 녹취 실시간 스트리밍 재생)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 구글 드라이브 설정 모달 트리거 */}
          <button
            type="button"
            onClick={() => setIsDriveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer press-scale"
            title="구글 드라이브 녹취 보관 계정 및 폴더 설정"
          >
            <Cloud size={14} className="text-blue-500" />
            <span>구글 드라이브 설정</span>
          </button>

          {/* 녹취 파일 직접 업로드 & AI 전사 트리거 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTranscribing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all cursor-pointer press-scale disabled:opacity-50"
            title="통화 녹음 파일(.m4a, .mp3) 업로드 및 Gemini 3.5 AI 분석"
          >
            <UploadCloud size={14} className="text-purple-600" />
            <span>{isTranscribing ? 'AI 분석 중...' : '녹음 파일 업로드'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* 분쟁 소명 증빙 파일 다운로드 */}
          <button
            type="button"
            onClick={handleExportLogs}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer press-scale"
            title="법적 분쟁 소명용 타임라인 TXT 파일 다운로드"
          >
            <Download size={14} />
            <span>분쟁 증빙 다운로드 (TXT)</span>
          </button>
        </div>
      </div>

      {/* AI 분석 진행 중 배너 */}
      {isTranscribing && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-purple-800 text-xs font-bold">
            <Sparkles size={16} className="text-purple-600 animate-spin" />
            <span>{uploadProgressText}</span>
          </div>
          <span className="text-[11px] text-purple-600 font-mono">Gemini 3.5 Transcribe</span>
        </div>
      )}

      {/* 메인 2열 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* 좌측 (Col 1~7): 카카오톡 스타일 통화 및 문자 실시간 대화 타임라인 */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col h-[680px]">
          {/* 상단 타임라인 헤더 & 필터 칩 */}
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>통화 및 문자 기록</span>
                  <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">
                    {filteredLogs.length}건
                  </span>
                </h3>
              </div>
            </div>

            {/* 필터 칩 & 수동 통화 등록 버튼 */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setShowQuickCall(!showQuickCall)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer press-scale"
              >
                <Plus size={12} className="text-blue-600" />
                <span>통화 기록 추가</span>
              </button>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  onClick={() => setSelectedFilter('all')}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    selectedFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setSelectedFilter('calls')}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    selectedFilter === 'calls' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  통화
                </button>
                <button
                  onClick={() => setSelectedFilter('sms')}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    selectedFilter === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  문자
                </button>
              </div>
            </div>
          </div>

          {/* 수동 통화 기록 추가 폼 */}
          {showQuickCall && (
            <div className="mb-3 p-3 bg-white rounded-xl border border-blue-200 shadow-xs space-y-2 animate-fadeIn shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">새 통화 내역 직접 기록</span>
                <button
                  type="button"
                  onClick={() => setShowQuickCall(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">구분</label>
                  <select
                    value={quickCallType}
                    onChange={(e: any) => setQuickCallType(e.target.value)}
                    className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="CALL_OUT">발신 통화</option>
                    <option value="CALL_IN">수신 통화</option>
                    <option value="CALL_MISSED">부재중 통화</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">통화 시간 (초)</label>
                  <input
                    type="number"
                    value={quickCallDuration}
                    onChange={(e) => setQuickCallDuration(Number(e.target.value) || 0)}
                    disabled={quickCallType === 'CALL_MISSED'}
                    placeholder="초 단위"
                    className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>
              </div>
              <input
                type="text"
                value={quickCallMemo}
                onChange={(e) => setQuickCallMemo(e.target.value)}
                placeholder="통화 메모 (예: 보정권고 서류 제출 독촉 통화 완료)"
                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowQuickCall(false)}
                  className="px-2.5 py-1 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAddQuickCall}
                  className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  기록 저장
                </button>
              </div>
            </div>
          )}

          {/* 상단 오디오 플레이어 (통화 카드 클릭 시 즉시 활성화) */}
          {playingRecording && (
            <div className="mb-3 animate-fadeIn shrink-0">
              <CustomAudioPlayer
                src={playingRecording.url}
                fileName={playingRecording.filename}
                onClose={() => setPlayingRecording(null)}
              />
            </div>
          )}

          {/* 타임라인 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 py-12">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Clock size={24} className="text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-500">기록된 통화 및 문자 내역이 없습니다.</p>
                <p className="text-[11px] text-slate-400">우측에서 문자를 발송하거나 통화 기록을 추가하세요.</p>
              </div>
            ) : (
              filteredLogs.map((log, index) => {
                const dateObj = new Date(log.timestamp);
                const dateHeader = dateObj.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                });
                const prevDateHeader = index > 0 ? new Date(filteredLogs[index - 1].timestamp).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long'
                }) : null;
                const showDateSeparator = dateHeader !== prevDateHeader;

                const isCall = log.type.includes('CALL');
                const isMissed = log.type === 'CALL_MISSED';
                const isInbound = log.type.includes('IN') || isMissed;
                const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });

                const formatDuration = (seconds?: number) => {
                  if (!seconds) return '';
                  const m = Math.floor(seconds / 60);
                  const s = seconds % 60;
                  if (m === 0) return `${s}초`;
                  return `${m}분 ${s}초`;
                };

                // 해당 통화 로그에 매칭되는 구글 드라이브 녹취 파일 탐색
                const matchedRec = isCall ? findMatchingRecordingForLog(log, crmExt.recordings) : undefined;
                const isCurrentPlaying = playingRecording && matchedRec && playingRecording.url === matchedRec.url;

                return (
                  <React.Fragment key={log.id}>
                    {/* 날짜 구분 배너 */}
                    {showDateSeparator && (
                      <div className="flex justify-center my-3">
                        <span className="bg-slate-200/90 text-slate-600 text-[11px] font-bold px-3 py-1 rounded-full shadow-2xs">
                          {dateHeader}
                        </span>
                      </div>
                    )}

                    {/* 통화 카드 UI */}
                    {isCall ? (
                      <div className={`flex w-full ${isInbound ? 'justify-start' : 'justify-end'}`}>
                        <div className={`w-full max-w-[90%] bg-white rounded-2xl p-3 shadow-xs border transition-all ${
                          isCurrentPlaying 
                            ? 'border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/20' 
                            : 'border-slate-200/90 hover:border-slate-300'
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isMissed
                                  ? 'bg-rose-100 text-rose-600'
                                  : isInbound
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isMissed ? <PhoneMissed size={16} /> : isInbound ? <PhoneIncoming size={16} /> : <PhoneOutgoing size={16} />}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs font-bold ${isMissed ? 'text-rose-700' : 'text-slate-900'}`}>
                                    {isMissed ? '부재중 통화' : isInbound ? '수신 통화' : '발신 통화'}
                                  </span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    log.lineInfo === '투넘버' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {log.lineInfo || '기본'}
                                  </span>
                                  {log.duration && log.duration > 0 && (
                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                      {formatDuration(log.duration)}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{timeStr}</span>
                              </div>
                            </div>

                            {/* 우측 액션: 구글 드라이브 녹취 청취 버튼 & 다이얼 버튼 */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {matchedRec ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPlayingRecording(matchedRec);
                                    toast.info(`녹음 파일 '${matchedRec.filename}'을 로드하여 재생합니다.`);
                                  }}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                                    isCurrentPlaying
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs animate-pulse'
                                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                  }`}
                                  title="구글 드라이브 녹취 스트리밍 재생"
                                >
                                  <PlayCircle size={12} />
                                  <span>{isCurrentPlaying ? '재생 중' : '녹음 듣기'}</span>
                                </button>
                              ) : null}

                              {/* 스마트폰으로 전화 걸기 버튼 */}
                              <button
                                type="button"
                                onClick={() => {
                                  enqueueCall(clientPhone, clientName);
                                  toast.success(`${clientName}님께 스마트폰 다이얼러 호출 요청을 보냈습니다.`);
                                }}
                                className="w-8 h-8 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors cursor-pointer"
                                title="스마트폰으로 전화 걸기"
                              >
                                <Phone size={13} />
                              </button>
                            </div>
                          </div>

                          {log.content && (
                            <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-700 bg-slate-50/50 p-2 rounded-lg">
                              {log.content}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* 문자 말풍선 UI */
                      <div className={`flex w-full ${isInbound ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 shadow-2xs ${
                          isInbound
                            ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                            : 'bg-blue-600 text-white rounded-tr-xs'
                        }`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={`text-[10px] font-bold ${isInbound ? 'text-slate-500' : 'text-blue-100'}`}>
                              {isInbound ? '수신 문자' : `발신 문자 (${log.lineInfo || '기본'})`}
                            </span>
                            <span className={`text-[10px] ${isInbound ? 'text-slate-400' : 'text-blue-200'}`}>
                              {timeStr}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                            {log.content}
                          </p>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 우측 (Col 8~12): 스마트폰 연계 원격 문자 발송 및 안내 템플릿 독 */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          {/* 문자 발송 카드 */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Send size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">문자 발송 & 템플릿</h3>
                  <p className="text-[10px] text-slate-400">스마트폰 통신사 회선으로 자동 전송</p>
                </div>
              </div>

              {/* SIM 회선 선택 토글 */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSimLine('기본')}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    simLine === '기본' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  SIM 1 (기본)
                </button>
                <button
                  type="button"
                  onClick={() => setSimLine('투넘버')}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    simLine === '투넘버' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  SIM 2 (투넘버)
                </button>
              </div>
            </div>

            {/* 템플릿 선택 칩 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>상담 템플릿 선택</span>
                <span className="text-[10px] text-slate-400 font-normal">최대 5개 등록 가능</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTemplateId('custom')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    activeTemplateId === 'custom'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  직접 입력
                </button>

                {templates.map((tpl) => (
                  <div key={tpl.id} className="relative group flex items-center">
                    <button
                      type="button"
                      onClick={() => setActiveTemplateId(tpl.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        activeTemplateId === tpl.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tpl.title}
                    </button>

                    {/* 수정 / 삭제 아이콘 */}
                    <div className="hidden group-hover:flex items-center gap-0.5 ml-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setEditingTemplate(tpl)}
                        className="p-1 hover:text-blue-600 text-slate-400"
                        title="템플릿 수정"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        className="p-1 hover:text-rose-600 text-slate-400"
                        title="템플릿 삭제"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}

                {templates.length < 5 && !editingTemplate && (
                  <button
                    type="button"
                    onClick={() => setEditingTemplate({ id: '', title: '', content: '' } as any)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 bg-slate-50/50 transition-all cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>추가</span>
                  </button>
                )}
              </div>
            </div>

            {/* 템플릿 수정 폼 모달/인라인 */}
            {editingTemplate && (
              <div className="p-3 bg-slate-50 rounded-xl border border-blue-200 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {editingTemplate.id ? '템플릿 수정' : '새 템플릿 등록'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={editingTemplate.title}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  placeholder="템플릿 제목 (예: 보정서류 독촉)"
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                />
                <textarea
                  rows={3}
                  value={editingTemplate.content}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                  placeholder="문자 본문 내용 입력..."
                  className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-800 resize-none"
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(null)}
                    className="px-2.5 py-1 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    저장
                  </button>
                </div>
              </div>
            )}

            {/* 메시지 본문 입력 에디터 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">문자 본문</label>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className={`px-1.5 py-0.2 rounded font-bold ${
                    isLms ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isLms ? 'LMS (장문)' : 'SMS (단문)'}
                  </span>
                  <span className="text-slate-500 font-bold">{charLength}자</span>
                </div>
              </div>

              <textarea
                rows={5}
                value={activeTemplateId === 'custom' ? customMessage : (templates.find(t => t.id === activeTemplateId)?.content || '')}
                onChange={(e) => {
                  if (activeTemplateId === 'custom') {
                    setCustomMessage(e.target.value);
                  }
                }}
                disabled={activeTemplateId !== 'custom'}
                placeholder="의뢰인에게 전송할 문자 내용을 입력하세요..."
                className={`w-full p-3 rounded-xl border text-xs sm:text-sm font-sans leading-relaxed transition-all resize-none ${
                  activeTemplateId === 'custom'
                    ? 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 cursor-not-allowed'
                }`}
              />
            </div>

            {/* 발송 버튼 */}
            <button
              type="button"
              onClick={handleSendSms}
              disabled={isSending || !messageContent.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer press-scale"
            >
              <Send size={15} />
              <span>{isSending ? '발송 요청 중...' : '스마트폰으로 발송 요청 (통신사 회선)'}</span>
            </button>
          </div>

          {/* 보관된 통화 녹음 목록 (구글 드라이브 아카이브) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <FileAudio size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">구글 드라이브 녹취 아카이브</h4>
                  <p className="text-[10px] text-slate-400">의뢰인 통화 녹음 영구 보존 목록</p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                {(crmExt.recordings || []).length}개 보관
              </span>
            </div>

            {(crmExt.recordings || []).length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                보관된 통화 녹음 파일이 없습니다. 상단 '녹음 파일 업로드'를 통해 추가하세요.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(crmExt.recordings || []).map((rec) => {
                  const isCurrent = playingRecording?.url === rec.url;
                  return (
                    <div
                      key={rec.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        isCurrent
                          ? 'border-purple-400 bg-purple-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{rec.filename}</p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(rec.uploadedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPlayingRecording(rec);
                            toast.info(`녹음 파일 '${rec.filename}'을 로드합니다.`);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                          }`}
                        >
                          {isCurrent ? '재생 중' : '청취'}
                        </button>
                        <a
                          href={rec.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="구글 드라이브에서 직접 열기"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 구글 드라이브 설정 모달 */}
      <GoogleDriveSettingsModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        activeLawyerEmail={activeLawyer.email}
        activeLawyerName={activeLawyer.name}
      />
    </div>
  );
};
