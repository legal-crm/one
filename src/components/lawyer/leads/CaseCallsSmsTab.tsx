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
  X
} from 'lucide-react';
import { SalesLead, CommunicationLog, CommunicationType, SmsTemplate, RecordingItem } from '../../../types/leadTypes';
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
  DEFAULT_SMS_TEMPLATES 
} from '../../../services/communicationService';
import { CustomAudioPlayer } from './CustomAudioPlayer';
import { toast } from 'sonner';

interface CaseCallsSmsTabProps {
  lead: SalesLead;
  onUpdateLead: (updated: SalesLead) => void;
}

export const CaseCallsSmsTab: React.FC<CaseCallsSmsTabProps> = ({ lead, onUpdateLead }) => {
  const [dbLogs, setDbLogs] = useState<CommunicationLog[]>(lead.communicationLogs || []);
  const [templates, setTemplates] = useState<SmsTemplate[]>(DEFAULT_SMS_TEMPLATES);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [activeTemplateId, setActiveTemplateId] = useState<string>('custom');
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'calls' | 'sms'>('all');
  const [simLine, setSimLine] = useState<'기본' | '투넘버'>('기본');
  const [playingRecording, setPlayingRecording] = useState<RecordingItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 분쟁 대비 통화 및 문자 내역 공식 소명 증빙 파일 다운로드 (TXT)
  const handleExportLogs = () => {
    if (dbLogs.length === 0) {
      toast.error('내보낼 통화 및 문자 내역이 없습니다.');
      return;
    }
    const textContent = exportCommunicationLogsAsText(dbLogs, lead.customerName, lead.phone);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `[통화문자증빙]_${lead.customerName}_${lead.phone.replace(/[^0-9]/g, '')}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('통화 및 문자 소명 증빙 파일이 다운로드되었습니다.');
  };

  // Fetch real logs from Supabase & subscribe to Realtime changes
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setIsLoadingLogs(true);
      try {
        const [fetchedLogs, fetchedTemplates] = await Promise.all([
          fetchCommunicationLogs(lead.phone),
          fetchSmsTemplates()
        ]);
        if (isMounted) {
          if (fetchedLogs && fetchedLogs.length > 0) {
            setDbLogs(fetchedLogs);
          } else if (lead.communicationLogs && lead.communicationLogs.length > 0) {
            setDbLogs(lead.communicationLogs);
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

    const unsubscribe = subscribeToCommunicationLogs(lead.phone, (newLog) => {
      setDbLogs(prev => {
        if (prev.some(l => l.id === newLog.id)) return prev;
        return [...prev, newLog];
      });
      toast.info(`스마트폰에서 새 ${newLog.type.includes('CALL') ? '통화' : '문자'} 기록이 수신되었습니다.`);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [lead.phone]);

  // Auto-scroll timeline when logs change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dbLogs]);

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
      const res = await enqueueSms(lead.phone, messageContent, simLine);
      if (res.success) {
        toast.success(res.message);
        if (res.log) {
          const updated = [...dbLogs, res.log];
          setDbLogs(updated);
          onUpdateLead({
            ...lead,
            communicationLogs: updated,
            updatedAt: new Date().toISOString()
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

  // Quick Call Log Simulation
  const handleAddQuickCall = (type: 'CALL_OUT' | 'CALL_IN' | 'CALL_MISSED', duration: number, memo: string) => {
    const newLog: CommunicationLog = {
      id: `call-${Date.now()}`,
      phoneNumber: lead.phone,
      type,
      duration,
      content: memo,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      lineInfo: simLine
    };

    const updatedLogs = [...(lead.communicationLogs || logs), newLog];
    const updatedLead: SalesLead = {
      ...lead,
      communicationLogs: updatedLogs,
      callCount: (lead.callCount || 0) + 1,
      lastCallAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onUpdateLead(updatedLead);
    toast.success('통화 기록이 타임라인에 기록되었습니다.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
      {/* ========================================================================= */}
      {/* 좌측 (Col 1~7): 카카오톡 스타일 통화 및 문자 실시간 대화 타임라인 */}
      {/* ========================================================================= */}
      <div className="lg:col-span-7 bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col h-[640px]">
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
              <p className="text-[10px] text-slate-500">
                스마트폰 삭제 대비 CRM 영구 보관 (통화 클릭 시 구글 드라이브 녹취 즉시 재생)
              </p>
            </div>
          </div>

          {/* 우측 액션: 증빙 다운로드 & 필터 칩 */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleExportLogs}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer press-scale active:scale-[0.98]"
              title="분쟁 대비 공식 통화/문자 소명 증빙 파일 다운로드"
            >
              <Download size={12} className="text-blue-600" />
              <span>증빙 다운로드</span>
            </button>

            {/* 필터 칩 */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors ${
                  selectedFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setSelectedFilter('calls')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors ${
                  selectedFilter === 'calls' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                통화
              </button>
              <button
                onClick={() => setSelectedFilter('sms')}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors ${
                  selectedFilter === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                문자
              </button>
            </div>
          </div>
        </div>

        {/* 상단 오디오 플레이어 (통화 카드 클릭 시 즉시 활성화) */}
        {playingRecording && (
          <div className="mb-3 animate-fadeIn">
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
              <p className="text-xs font-medium">기록된 통화 및 문자 내역이 없습니다.</p>
              <p className="text-[11px] text-slate-400">우측에서 문자를 발송하거나 스마트폰 앱과 동기화하세요.</p>
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
              const matchedRec = isCall ? findMatchingRecordingForLog(log, lead.recordings) : undefined;
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
                                enqueueCall(lead.phone, lead.customerName);
                                toast.success(`${lead.customerName}님께 스마트폰 다이얼러 호출 요청을 보냈습니다.`);
                              }}
                              className="w-8 h-8 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors cursor-pointer"
                              title="스마트폰으로 전화 걸기"
                            >
                              <Phone size={13} />
                            </button>
                          </div>
                        </div>

                        {log.content && (
                          <div className="mt-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 leading-relaxed">
                            {log.content}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* 카카오톡 말풍선 문자 UI */
                    <div className={`flex items-end gap-1.5 w-full ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      {/* 수신인 경우 시간은 우측, 발신인 경우 시간은 좌측 */}
                      {!isInbound && (
                        <div className="flex flex-col items-end text-[10px] text-slate-400 font-mono mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold px-1 rounded mb-0.5 ${
                            log.lineInfo === '투넘버' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {log.lineInfo || '기본'}
                          </span>
                          <span>{timeStr}</span>
                        </div>
                      )}

                      <div
                        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl shadow-2xs text-xs whitespace-pre-wrap leading-relaxed break-words ${
                          isInbound
                            ? 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                            : 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                        }`}
                      >
                        {log.content}
                      </div>

                      {isInbound && (
                        <div className="flex flex-col items-start text-[10px] text-slate-400 font-mono mb-0.5 shrink-0">
                          <span className={`text-[9px] font-bold px-1 rounded mb-0.5 ${
                            log.lineInfo === '투넘버' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {log.lineInfo || '기본'}
                          </span>
                          <span>{timeStr}</span>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 빠른 통화 기록 시뮬레이션 바 (테스트 및 간편 기록용) */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Clock size={12} /> 빠른 통화 수동 기록:
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAddQuickCall('CALL_MISSED', 0, '부재중 (고객 미수신)')}
              className="px-2 py-1 text-[10px] font-bold rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
            >
              📞 부재중
            </button>
            <button
              onClick={() => handleAddQuickCall('CALL_OUT', 120, '아웃바운드 상담 완료')}
              className="px-2 py-1 text-[10px] font-bold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              📤 발신(2분)
            </button>
            <button
              onClick={() => handleAddQuickCall('CALL_IN', 300, '고객 인바운드 문의 접수')}
              className="px-2 py-1 text-[10px] font-bold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              📥 수신(5분)
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 우측 (Col 8~12): 문자 템플릿 독 및 스마트폰 연동 발송 컴포넌트 */}
      {/* ========================================================================= */}
      <div className="lg:col-span-5 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col h-[640px] space-y-3.5">
        {/* 헤더: 문자 템플릿 & 발송 모드 */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Send size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">문자 템플릿 & 발송</h3>
              <p className="text-[10px] text-slate-400">자주 쓰는 문자를 원클릭 선택하여 즉시 발송합니다.</p>
            </div>
          </div>

          {/* SIM 라인 선택 칩 */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
            <button
              onClick={() => setSimLine('기본')}
              className={`px-2 py-0.5 rounded transition-all ${
                simLine === '기본' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              기본 SIM
            </button>
            <button
              onClick={() => setSimLine('투넘버')}
              className={`px-2 py-0.5 rounded transition-all ${
                simLine === '투넘버' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-500'
              }`}
            >
              투넘버
            </button>
          </div>
        </div>

        {/* 템플릿 버튼 그리드 (최대 5개 + 직접 입력 + 템플릿 추가) */}
        <div className="space-y-1.5 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold px-0.5">
            <span>자주 쓰는 템플릿 ({templates.length}/5)</span>
            {templates.length < 5 && (
              <button
                onClick={() => setEditingTemplate({ id: '', title: '', content: '', createdAt: '', updatedAt: '' })}
                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-bold cursor-pointer"
              >
                <Plus size={12} /> 템플릿 추가
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                setActiveTemplateId('custom');
                setEditingTemplate(null);
              }}
              className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                activeTemplateId === 'custom' && !editingTemplate
                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <Edit2 size={12} /> 직접 입력
            </button>

            {templates.map((tmpl) => {
              const isSelected = activeTemplateId === tmpl.id && !editingTemplate;
              return (
                <div key={tmpl.id} className="relative group">
                  <button
                    onClick={() => {
                      setActiveTemplateId(tmpl.id);
                      setEditingTemplate(null);
                    }}
                    className={`w-full p-2 rounded-xl text-xs font-bold border text-left truncate transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {tmpl.title}
                  </button>

                  {/* 템플릿 수정/삭제 호버 버튼 */}
                  <div className="absolute right-1.5 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white/90 rounded px-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTemplate(tmpl);
                      }}
                      className="text-slate-400 hover:text-indigo-600 p-0.5"
                      title="템플릿 수정"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                      className="text-slate-400 hover:text-rose-600 p-0.5"
                      title="템플릿 삭제"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 템플릿 편집 모드 or 메시지 작성 폼 */}
        {editingTemplate ? (
          <div className="flex-1 flex flex-col p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900">
                {editingTemplate.id ? '템플릿 수정' : '새 템플릿 작성'}
              </span>
              <button
                onClick={() => setEditingTemplate(null)}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
            </div>

            <input
              type="text"
              placeholder="템플릿 제목 (예: 서류 접수 안내)"
              value={editingTemplate.title}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
              className="w-full text-xs p-2 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
            />

            <textarea
              placeholder="문자 본문 내용을 입력하세요."
              value={editingTemplate.content}
              onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
              className="flex-1 w-full text-xs p-2.5 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed custom-scrollbar"
            />

            <div className="flex justify-end gap-1.5 pt-1">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-white"
              >
                취소
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-3.5 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-2xs"
              >
                <Save size={13} /> 저장
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Smartphone size={13} className="text-blue-600" />
                수신자: <span className="font-mono text-blue-700">{lead.customerName} ({lead.phone})</span>
              </span>

              {/* 글자수 및 SMS/LMS 상태 뱃지 */}
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className={`px-1.5 py-0.2 rounded font-bold ${
                  isLms ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {isLms ? 'LMS (장문)' : 'SMS (단문)'}
                </span>
                <span className="text-slate-400">
                  <b className={isLms ? 'text-amber-700' : 'text-slate-700'}>{charLength}</b>/90자
                </span>
              </div>
            </div>

            {/* 문자 내용 입력창 */}
            <textarea
              value={activeTemplateId === 'custom' ? customMessage : (templates.find(t => t.id === activeTemplateId)?.content || '')}
              onChange={(e) => {
                if (activeTemplateId === 'custom') {
                  setCustomMessage(e.target.value);
                } else {
                  // If modifying selected template text, switch to custom with current content
                  setActiveTemplateId('custom');
                  setCustomMessage(e.target.value);
                }
              }}
              placeholder="발송할 문자 내용을 작성하세요..."
              className="flex-1 w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-800 leading-relaxed resize-none custom-scrollbar"
            />

            {/* 하단 발송 버튼 */}
            <button
              onClick={handleSendSms}
              disabled={!messageContent.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 press-scale cursor-pointer"
            >
              <Send size={15} />
              <span>스마트폰({simLine})으로 즉시 발송 요청</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
