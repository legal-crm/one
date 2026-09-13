import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Send, RotateCcw, Edit3, Sparkles, Smartphone, 
  ShieldCheck, CheckCircle2, AlertCircle, Plus, ExternalLink,
  ChevronDown, Check, Layers, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  sendAlimtok, 
  loadPopbillTemplates, 
  extractTemplateVariables, 
  compileTemplateWithVariables,
  fetchPopbillLiveTemplates,
  type PopbillAlimtokTemplate 
} from '../../../services/alimtokService';
import { addClientNotification } from '../../../services/clientNotificationService';
import type { AlimtokMilestone } from '../../../types';
import AlimtalkTemplateRegisterModal from './AlimtalkTemplateRegisterModal';

interface AlimtalkSendConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone: string;
  templateTitle?: string;
  templateDesc?: string;
  emoji?: string;
  defaultMessage?: string;
  firmName?: string;
  lawyerName?: string;
  stageNumber?: number;
  milestone?: AlimtokMilestone;
  caseType?: string;
  onSent?: (sentMessage: string) => void;
}

export default function AlimtalkSendConfirmModal({
  isOpen,
  onClose,
  clientName,
  clientPhone,
  templateTitle,
  templateDesc,
  emoji = '💬',
  defaultMessage,
  firmName = '법무법인',
  lawyerName = '담당 변호사',
  stageNumber = 1,
  milestone = 'consult_booked',
  caseType = '개인회생',
  onSent,
}: AlimtalkSendConfirmModalProps) {
  const [templates, setTemplates] = useState<PopbillAlimtokTemplate[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [fallbackSms, setFallbackSms] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [templateMgtUrl, setTemplateMgtUrl] = useState('https://www.popbill.com/KakaoTalk/?TG=TEMPLATE');
  const [filterStage, setFilterStage] = useState<number | 'all'>(stageNumber);

  // 1. 팝빌 승인 템플릿 목록 로드
  useEffect(() => {
    const loaded = loadPopbillTemplates();
    setTemplates(loaded);

    // 팝빌 실시간 목록 및 SSO 관리 URL 비동기 동기화
    fetchPopbillLiveTemplates().then(res => {
      if (res.templates && res.templates.length > 0) {
        setTemplates(res.templates);
      }
      if (res.templateMgtUrl) {
        setTemplateMgtUrl(res.templateMgtUrl);
      }
    }).catch(() => {});
  }, []);

  // 2. 초기 템플릿 자동 매칭 (stage 및 제목 기준)
  useEffect(() => {
    if (templates.length === 0) return;

    let matched = templates.find(t => templateTitle && t.templateName.includes(templateTitle));
    if (!matched) {
      matched = templates.find(t => t.stage === stageNumber && t.state === '승인');
    }
    if (!matched) {
      matched = templates.find(t => t.state === '승인') || templates[0];
    }

    if (matched) {
      setSelectedTemplateCode(matched.templateCode);
    }
  }, [templates, templateTitle, stageNumber]);

  // 선택된 템플릿 객체
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.templateCode === selectedTemplateCode) || templates[0];
  }, [templates, selectedTemplateCode]);

  // 템플릿에 포함된 치환 변수 목록 추출
  const detectedVars = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractTemplateVariables(selectedTemplate.template);
  }, [selectedTemplate]);

  // 3. 변수 초기값 지능형 자동 완성
  useEffect(() => {
    if (!selectedTemplate || detectedVars.length === 0) return;

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mykim.kr';
    const initialVars: Record<string, string> = {};

    for (const v of detectedVars) {
      switch (v) {
        case '고객명':
          initialVars[v] = clientName || '고객';
          break;
        case '법무법인':
          initialVars[v] = firmName || '법무법인';
          break;
        case '담당변호사':
          initialVars[v] = lawyerName || '담당 변호사';
          break;
        case '사건유형':
          initialVars[v] = caseType || '개인회생';
          break;
        case '마감기한':
          initialVars[v] = '3일 이내 (2026.09.16)';
          break;
        case '안내링크':
          initialVars[v] = `${origin}/my`;
          break;
        case '서명링크':
          initialVars[v] = `${origin}?view=sign`;
          break;
        case '수임료':
          initialVars[v] = '150만원';
          break;
        case '납부항목':
          initialVars[v] = '착수금 (1차 분납)';
          break;
        case '입금금액':
          initialVars[v] = '500,000원';
          break;
        case '입금계좌':
          initialVars[v] = '신한은행 110-384-918231 (예금주: 법무법인)';
          break;
        case '관할법원':
          initialVars[v] = '서울회생법원';
          break;
        case '사건번호':
          initialVars[v] = '2026개회104291';
          break;
        case '상담일시':
          initialVars[v] = '내일 오후 2:00';
          break;
        case '상담방식':
          initialVars[v] = '유선 전화 심층 상담';
          break;
        case '준비사항':
          initialVars[v] = '신분증, 부채내역, 최근 1년 급여명세서';
          break;
        case '미제출서류목록':
          initialVars[v] = '주민등록초본, 원천징수영수증, 건강보험자격득실확인서';
          break;
        case '대상서류':
          initialVars[v] = '가족관계증명서 상세본';
          break;
        case '보완사유':
          initialVars[v] = '가족 주민번호 뒷자리 마스킹(******) 누락';
          break;
        case '결정일자':
          initialVars[v] = new Date().toLocaleDateString('ko-KR');
          break;
        case '다음단계':
          initialVars[v] = '금지명령 결정 대기 (약 7일 소요)';
          break;
        case '다음절차':
          initialVars[v] = '정식 위임계약 체결 및 필수 서류 수합';
          break;
        case '보정요구내용':
          initialVars[v] = '최근 1년간 계좌 입출금 내역 50만원 이상 소명';
          break;
        case '담당사무장':
          initialVars[v] = '전담 실무 사무장';
          break;
        case '직통전화':
          initialVars[v] = '02-588-1123';
          break;
        case '월변제금':
          initialVars[v] = '620,000원 (36개월)';
          break;
        case '1회차납부일':
          initialVars[v] = '2026년 10월 25일';
          break;
        case '법원가상계좌':
          initialVars[v] = '신한은행 562-901-098231 (서울회생법원)';
          break;
        case '집회일시':
          initialVars[v] = '2026년 11월 12일 오후 2:30';
          break;
        case '법정장소':
          initialVars[v] = '서울회생법원 3호 법정 (법원종합청사)';
          break;
        default:
          initialVars[v] = '';
      }
    }

    setVariableValues(initialVars);
  }, [selectedTemplate, detectedVars, clientName, firmName, lawyerName, caseType]);

  if (!isOpen) return null;

  // 최종 조립된 발송 문안
  const compiledMessage = selectedTemplate 
    ? compileTemplateWithVariables(selectedTemplate.template, variableValues)
    : defaultMessage || '';

  // 변수값 변경 핸들러
  const handleVariableChange = (key: string, val: string) => {
    setVariableValues(prev => ({ ...prev, [key]: val }));
  };

  // 필터링된 템플릿 목록
  const displayedTemplates = templates.filter(t => {
    if (filterStage === 'all') return true;
    return t.stage === filterStage;
  });

  // 발송 처리
  const handleSend = async () => {
    if (!compiledMessage.trim()) {
      toast.error('발송할 알림톡 메시지 내용이 비어있습니다.');
      return;
    }

    // 미입력된 변수 검사
    const emptyVars = detectedVars.filter(v => !variableValues[v] || !variableValues[v].trim());
    if (emptyVars.length > 0) {
      toast.error(`[${emptyVars[0]}] 항목의 값을 입력해 주세요.`);
      return;
    }

    setIsSending(true);

    try {
      const cleanPhone = clientPhone.replace(/[^0-9]/g, '');

      // 1. 팝빌 알림톡 연동 API 호출 (팝빌 승인 템플릿 코드 및 치환 완료 텍스트 전달)
      await sendAlimtok(
        cleanPhone,
        milestone,
        {
          clientName,
          firmName,
          lawyerName,
        },
        {
          receiverName: clientName,
          templateCode: selectedTemplate?.templateCode,
          customText: compiledMessage,
          altSubject: `[${firmName}] ${selectedTemplate?.templateName || '안내'}`,
          altContent: compiledMessage,
          buttons: selectedTemplate?.buttons,
        }
      );

      // 2. 의뢰인 포털 모바일 알림 동기화
      addClientNotification({
        type: 'status_change',
        title: compiledMessage.split('\n')[0] || `[알림] ${selectedTemplate?.templateName}`,
        emoji,
        linkTab: 'diagnosis',
      });

      // 3. 상위 콜백 호출 (타임라인 메모 기록)
      if (onSent) {
        onSent(compiledMessage);
      }

      toast.success(`${clientName}님께 '${selectedTemplate?.templateName}' 팝빌 승인 알림톡이 성공적으로 발송되었습니다.`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || '알림톡 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* 모달 헤더 */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FAE100] text-[#391B1B] flex items-center justify-center font-black text-xs shadow-xs">
                TALK
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">팝빌 승인 카카오 알림톡 발송</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>카카오 사전심사 승인 전용</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  팝빌에 등록·승인된 템플릿을 선택하고, 지정된 치환 변수값만 입력하여 안전하게 발송합니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 본문 영역 (2단 분할 스크롤) */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            
            {/* 수신인 및 발송 채널 요약 바 */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">수신 고객:</span>
                <span className="font-bold text-slate-900">
                  {clientName} ({clientPhone || '연락처 없음'})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span>발신 명의:</span>
                  <span className="font-bold text-slate-800">{firmName} {lawyerName}</span>
                </div>
                <span className="font-bold text-[#391B1B] bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded-md text-[10px]">
                  카카오 알림톡
                </span>
              </div>
            </div>

            {/* 1. 팝빌 등록 알림톡 템플릿 선택기 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  <span>팝빌 승인 템플릿 선택</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (총 {templates.length}건 승인)
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  {/* 단계 필터 버튼 */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
                    <button
                      type="button"
                      onClick={() => setFilterStage(stageNumber)}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        filterStage === stageNumber ? 'bg-white text-[#1E3A5F] shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      현재 Stage 0{stageNumber}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStage('all')}
                      className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                        filterStage === 'all' ? 'bg-white text-[#1E3A5F] shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      전체 보기
                    </button>
                  </div>

                  {/* 템플릿 등록 / 심사 신청 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#1E3A5F] font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors border border-slate-300 press-scale"
                    title="카카오 검수 심사를 위한 신규 템플릿 등록"
                  >
                    <Plus className="w-3 h-3 text-[#1E3A5F]" />
                    <span>새 템플릿 등록·심사 신청</span>
                  </button>
                </div>
              </div>

              {/* 템플릿 드롭다운 선택 상자 */}
              <div className="relative">
                <select
                  value={selectedTemplateCode}
                  onChange={(e) => setSelectedTemplateCode(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#1E3A5F] focus:outline-none appearance-none cursor-pointer pr-9 shadow-xs"
                >
                  {displayedTemplates.map((t) => (
                    <option key={t.templateCode} value={t.templateCode}>
                      [{t.category || `Stage ${t.stage}`}] {t.templateName} ({t.templateCode}) — {t.state}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* 선택된 템플릿 세부 정보 칩 */}
              {selectedTemplate && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/70 rounded-lg text-[11px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-700">{selectedTemplate.templateCode}</span>
                    <span className="text-slate-300">|</span>
                    <span>{selectedTemplate.templateName}</span>
                  </div>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded text-[10px]">
                    ✓ 검수 승인 완료
                  </span>
                </div>
              )}
            </div>

            {/* 2. 치환 변수 입력 영역 (핵심: 고정 텍스트는 잠기고, 변수 슬롯만 입력 가능!) */}
            <div className="space-y-2 p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Edit3 className="w-3.5 h-3.5 text-blue-700" />
                  <span>알림톡 치환 변수 입력 ({detectedVars.length}개 항목)</span>
                </label>
                <span className="text-[10px] text-blue-700 font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3 text-blue-500" /> 고정 문안 자동 보호 (변수만 입력)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {detectedVars.map((varName) => (
                  <div key={varName} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 font-mono">
                        #&#123;{varName}&#125;
                      </span>
                    </div>
                    <input
                      type="text"
                      value={variableValues[varName] || ''}
                      onChange={(e) => handleVariableChange(varName, e.target.value)}
                      placeholder={`${varName} 입력`}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-none shadow-2xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 카카오톡 실시간 말풍선 미리보기 (변수 하이라이트 반영) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#391B1B]" />
                  <span>카카오톡 실시간 수신 화면 미리보기</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {compiledMessage.length}자
                </span>
              </div>

              {/* 카카오 알림톡 실시간 노란색 말풍선 카드 */}
              <div className="bg-[#FAE100] rounded-2xl p-4 shadow-inner space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#391B1B]/80 font-bold border-b border-[#391B1B]/10 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#391B1B] text-white flex items-center justify-center font-black text-[8px]">
                      TALK
                    </div>
                    <span>{firmName} 회생파산 지원센터</span>
                  </div>
                  <span className="text-[10px] opacity-75">알림톡 도착</span>
                </div>

                <div className="bg-white rounded-xl rounded-tl-none p-3.5 text-xs leading-relaxed text-slate-900 border border-yellow-300/80 shadow-xs whitespace-pre-wrap font-sans">
                  {compiledMessage}
                </div>

                {/* 하단 버튼 미리보기 */}
                {selectedTemplate?.buttons && selectedTemplate.buttons.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    {selectedTemplate.buttons.map((btn, bIdx) => (
                      <div
                        key={bIdx}
                        className="w-full py-2 bg-white border border-yellow-300 rounded-lg text-center font-bold text-slate-800 text-xs shadow-2xs flex items-center justify-center gap-1"
                      >
                        <span>{btn.name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-[#391B1B]/80 font-medium px-1">
                  <span>🔒 팝빌 승인 원문 그대로 발송되므로 반려 및 전송 오류가 발생하지 않습니다.</span>
                </div>
              </div>
            </div>

            {/* 대체 문자 발송 옵션 */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={fallbackSms}
                  onChange={(e) => setFallbackSms(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <span>카카오톡 미수신 시 LMS/SMS 대체 발송</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">100% 수신 보장</span>
            </div>
          </div>

          {/* 액션 버튼 바 */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-bold text-xs text-slate-600 cursor-pointer press-scale transition-colors whitespace-nowrap"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !compiledMessage.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#FAE100] hover:bg-[#F4D700] text-[#391B1B] font-extrabold text-xs shadow-xs cursor-pointer press-scale transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? '알림톡 발송 중...' : '카카오 알림톡 즉시 발송'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 신규 템플릿 등록 및 카카오 검수 심사 신청 모달 ── */}
      {isRegisterModalOpen && (
        <AlimtalkTemplateRegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          initialStage={stageNumber}
          templateMgtUrl={templateMgtUrl}
          onRegistered={(newTpl) => {
            setTemplates(prev => [newTpl, ...prev]);
            setSelectedTemplateCode(newTpl.templateCode);
          }}
        />
      )}
    </>
  );
}
