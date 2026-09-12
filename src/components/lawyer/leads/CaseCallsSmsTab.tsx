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
  Sparkles
} from 'lucide-react';
import { SalesLead, CommunicationLog, CommunicationType, SmsTemplate } from '../../../types/leadTypes';
import { toast } from 'sonner';

interface CaseCallsSmsTabProps {
  lead: SalesLead;
  onUpdateLead: (updated: SalesLead) => void;
}

const DEFAULT_SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'tmpl-1',
    title: '부재중 1차 안내',
    content: '[법률사무소] 고객님, 신청하신 개인회생/파산 무료 상담 관련하여 연락드렸으나 부재중이셔서 문자 남깁니다. 통화 가능하신 편한 시간대를 알려주시면 다시 연락드리겠습니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-2',
    title: '필수 서류 목록 안내',
    content: '[법률사무소] 개인회생 1차 심사 필수 서류 안내입니다.\n1. 주민등록등본·초본(전체주소 포함)\n2. 가족관계증명서(상세)\n3. 최근 1년 급여명세서 또는 통장거래내역\n4. 부채증명서\n서류 사진을 찍어 본 번호로 회신해 주시면 빠른 검토가 가능합니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-3',
    title: '방문/출장 미팅 안내',
    content: '[법률사무소] 대면 상담 일정 안내드립니다.\n- 일시: 상담 예약 확정 후 개별 안내\n- 장소: 법률사무소 서초 상담센터\n- 준비물: 신분증, 소득 증빙 서류\n주차 가능하며, 도착 10분 전 연락 부탁드립니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-4',
    title: '금지명령 결정 안내',
    content: '[법률사무소] 법원에서 채권자 금지명령이 발령되었습니다. 이제 모든 채권추심, 독촉 전화 및 급여/통장 압류가 법적으로 전면 금지됩니다. 세부 진행사항은 유선으로 안내드리겠습니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-5',
    title: '개인파산 자격 검토',
    content: '[법률사무소] 고령 또는 질병·장애로 근로능력이 부족하신 경우 파산면책을 통해 채무 100% 탕감이 가능합니다. 전문 변호사 심층 검토를 위해 추가 통화 부탁드립니다.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const CaseCallsSmsTab: React.FC<CaseCallsSmsTabProps> = ({ lead, onUpdateLead }) => {
  // Load templates from localStorage or fallback to defaults
  const [templates, setTemplates] = useState<SmsTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('legal_crm_sms_templates');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved sms templates', e);
    }
    return DEFAULT_SMS_TEMPLATES;
  });

  const [activeTemplateId, setActiveTemplateId] = useState<string>('custom');
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'calls' | 'sms'>('all');
  const [simLine, setSimLine] = useState<'기본' | '투넘버'>('기본');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll timeline when logs change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lead.communicationLogs]);

  // Initial mock logs if empty
  const logs: CommunicationLog[] = lead.communicationLogs || [
    {
      id: 'log-init-1',
      phoneNumber: lead.phone,
      type: 'CALL_MISSED',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      lineInfo: '기본',
      content: '1차 부재중 (신호음 45초 후 종료)'
    },
    {
      id: 'log-init-2',
      phoneNumber: lead.phone,
      type: 'SMS_OUT',
      content: '[법률사무소] 고객님, 요청하신 개인회생 상담 관련하여 연락드렸으나 부재중이셔서 문자 남깁니다.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
      lineInfo: '기본'
    },
    {
      id: 'log-init-3',
      phoneNumber: lead.phone,
      type: 'CALL_IN',
      duration: 185,
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      lineInfo: '투넘버',
      content: '고객 인바운드 회신 통화 (월 소득 265만, 총 채무 7,800만 확인)'
    }
  ];

  // Filter logs
  const filteredLogs = logs.filter(log => {
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

  // Send SMS handler
  const handleSendSms = () => {
    if (!messageContent.trim()) {
      toast.error('발송할 문자 내용을 입력해주세요.');
      return;
    }

    const newLog: CommunicationLog = {
      id: `comm-${Date.now()}`,
      phoneNumber: lead.phone,
      type: 'SMS_OUT',
      content: messageContent,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      lineInfo: simLine
    };

    const updatedLogs = [...(lead.communicationLogs || logs), newLog];
    const updatedLead: SalesLead = {
      ...lead,
      communicationLogs: updatedLogs,
      updatedAt: new Date().toISOString()
    };

    onUpdateLead(updatedLead);
    if (activeTemplateId === 'custom') {
      setCustomMessage('');
    }

    toast.success(`스마트폰(${simLine})을 통해 ${isLms ? 'LMS(장문)' : 'SMS(단문)'} 발송 요청이 등록되었습니다.`);
  };

  // Save template
  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    if (!editingTemplate.title.trim() || !editingTemplate.content.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    let nextTemplates = [...templates];
    if (editingTemplate.id && templates.some(t => t.id === editingTemplate.id)) {
      // Edit existing
      nextTemplates = nextTemplates.map(t => t.id === editingTemplate.id ? editingTemplate : t);
      toast.success('템플릿이 수정되었습니다.');
    } else {
      // New template - max 5 limit
      if (templates.length >= 5) {
        toast.error('문자 템플릿은 최대 5개까지만 등록할 수 있습니다.');
        return;
      }
      nextTemplates.push({
        ...editingTemplate,
        id: `tmpl-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('새 템플릿이 추가되었습니다.');
    }

    setTemplates(nextTemplates);
    localStorage.setItem('legal_crm_sms_templates', JSON.stringify(nextTemplates));
    setEditingTemplate(null);
  };

  // Delete template
  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextTemplates = templates.filter(t => t.id !== id);
    setTemplates(nextTemplates);
    localStorage.setItem('legal_crm_sms_templates', JSON.stringify(nextTemplates));
    if (activeTemplateId === id) {
      setActiveTemplateId('custom');
    }
    toast.info('템플릿이 삭제되었습니다.');
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
                <span>통화 및 문자 타임라인</span>
                <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">
                  {filteredLogs.length}건
                </span>
              </h3>
              <p className="text-[10px] text-slate-500">
                스마트폰(LeadMasterApp)과 실시간 연동되어 통화 및 문자 송수신 내역이 기록됩니다.
              </p>
            </div>
          </div>

          {/* 필터 칩 */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                selectedFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedFilter('calls')}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                selectedFilter === 'calls' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              통화
            </button>
            <button
              onClick={() => setSelectedFilter('sms')}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                selectedFilter === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              문자
            </button>
          </div>
        </div>

        {/* 타임라인 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-12">
              <MessageSquare size={32} className="text-slate-300" />
              <p className="text-xs font-medium text-slate-600">통화 및 문자 내역이 없습니다.</p>
              <p className="text-[11px] text-slate-400">우측 발송 도크에서 문자를 발송하거나 통화를 기록해보세요.</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const dateObj = new Date(log.timestamp);
              const dateHeader = dateObj.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
              });
              const prevLog = index > 0 ? filteredLogs[index - 1] : null;
              const prevDateHeader = prevLog ? new Date(prevLog.timestamp).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
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

              return (
                <React.Fragment key={log.id}>
                  {/* 날짜 구분 배너 */}
                  {showDateSeparator && (
                    <div className="flex justify-center my-3">
                      <span className="bg-slate-200/90 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-2xs">
                        {dateHeader}
                      </span>
                    </div>
                  )}

                  {/* 통화 카드 UI */}
                  {isCall ? (
                    <div className={`flex w-full ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div className="w-full max-w-[88%] bg-white rounded-2xl p-3 shadow-xs border border-slate-200/80 transition-all hover:border-slate-300">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isMissed
                                ? 'bg-rose-100 text-rose-600'
                                : isInbound
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isMissed ? <PhoneMissed size={16} /> : isInbound ? <PhoneIncoming size={16} /> : <PhoneOutgoing size={16} />}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-bold ${isMissed ? 'text-rose-700' : 'text-slate-900'}`}>
                                  {isMissed ? '부재중 통화' : isInbound ? '수신 통화 (인바운드)' : '발신 통화 (아웃바운드)'}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  log.lineInfo === '투넘버' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {log.lineInfo || '기본'}
                                </span>
                                {log.duration && log.duration > 0 && (
                                  <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                                    ⏱️ {formatDuration(log.duration)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{timeStr}</span>
                            </div>
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
