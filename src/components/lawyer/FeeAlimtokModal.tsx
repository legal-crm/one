import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Send, Edit3, Sparkles, 
  CheckCircle2, Plus, ExternalLink, ChevronDown, 
  Layers, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { FeeInstallment, AlimtokMilestone } from '../../types';
import { 
  sendFeeAlimtok, 
  loadPopbillTemplates, 
  extractTemplateVariables, 
  compileTemplateWithVariables,
  fetchPopbillLiveTemplates,
  loadFeeNotificationSettings,
  type PopbillAlimtokTemplate 
} from '../../services/alimtokService';
import ModalPortal from '../common/ModalPortal';
import AlimtalkTemplateRegisterModal from './pipeline/AlimtalkTemplateRegisterModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  client: { id: string; clientName: string; phone: string };
  installment: FeeInstallment;
  totalFeeManwon: number;
  totalPaidManwon: number;
  firmName: string;
  lawyerName: string;
  onSent?: (milestone: AlimtokMilestone) => void;
  initialMilestone?: AlimtokMilestone;
}

const MILESTONE_CONFIGS: { value: AlimtokMilestone; label: string; templateCode: string; desc: string }[] = [
  { value: 'fee_upcoming', label: '납부 사전 안내 (D-3)', templateCode: 'MYKIM_ATS_12', desc: '분납 기한 전 사전 리마인드 및 계좌 안내' },
  { value: 'fee_due', label: '당일 납부 안내 (D-Day)', templateCode: 'MYKIM_ATS_13', desc: '약정 납부 당일 입금 계좌 리마인드' },
  { value: 'fee_overdue', label: '연체 미납 안내', templateCode: 'MYKIM_ATS_14', desc: '납부 기한 경과 시 일정 조율 및 납부 요청' },
  { value: 'fee_receipt', label: '입금 확인 영수증', templateCode: 'MYKIM_ATS_15', desc: '정상 입금 확인 및 잔여 미수금 안내' },
];

export default function FeeAlimtokModal({ 
  isOpen, 
  onClose, 
  client, 
  installment, 
  totalFeeManwon, 
  totalPaidManwon,
  firmName,
  lawyerName,
  onSent,
  initialMilestone = 'fee_upcoming',
}: Props) {
  const [templates, setTemplates] = useState<PopbillAlimtokTemplate[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<AlimtokMilestone>(initialMilestone);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('MYKIM_ATS_12');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [fallbackSms, setFallbackSms] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [templateMgtUrl, setTemplateMgtUrl] = useState('https://www.popbill.com/KakaoTalk/?TG=TEMPLATE');

  const settings = loadFeeNotificationSettings();
  const bankAccountStr = `${settings.bankInfo.bankName} ${settings.bankInfo.accountNumber} (예금주: ${settings.bankInfo.accountHolder})`;
  const amountWon = installment.amount >= 10000 ? installment.amount : installment.amount * 10000;
  const remainingWon = Math.max(0, (totalFeeManwon - totalPaidManwon) * 10000);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(installment.dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = diffDays > 0 ? String(diffDays) : '0';

  // 1. 팝빌 승인 템플릿 목록 로드 및 라이브 동기화
  useEffect(() => {
    const loaded = loadPopbillTemplates();
    setTemplates(loaded);

    fetchPopbillLiveTemplates().then(res => {
      if (res.templates && res.templates.length > 0) {
        setTemplates(res.templates);
      }
      if (res.templateMgtUrl) {
        setTemplateMgtUrl(res.templateMgtUrl);
      }
    }).catch(() => {});
  }, []);

  // 2. 초기 마일스톤에 맞춘 템플릿 자동 선택
  useEffect(() => {
    if (initialMilestone) {
      setSelectedMilestone(initialMilestone);
      const matchedConfig = MILESTONE_CONFIGS.find(c => c.value === initialMilestone);
      if (matchedConfig) {
        setSelectedTemplateCode(matchedConfig.templateCode);
      }
    }
  }, [initialMilestone]);

  // 마일스톤 버튼 클릭 시 템플릿 코드 동기화
  const handleMilestoneChange = (milestone: AlimtokMilestone) => {
    setSelectedMilestone(milestone);
    const matchedConfig = MILESTONE_CONFIGS.find(c => c.value === milestone);
    if (matchedConfig) {
      const found = templates.find(t => t.templateCode === matchedConfig.templateCode);
      if (found) {
        setSelectedTemplateCode(found.templateCode);
      } else {
        setSelectedTemplateCode(matchedConfig.templateCode);
      }
    }
  };

  // 선택된 템플릿 객체
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.templateCode === selectedTemplateCode) || templates[0];
  }, [templates, selectedTemplateCode]);

  // 템플릿 치환 변수 목록 추출
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
          initialVars[v] = client.clientName || '고객';
          break;
        case '법무법인':
          initialVars[v] = firmName || '법무법인';
          break;
        case '담당변호사':
          initialVars[v] = lawyerName || '담당 변호사';
          break;
        case '납부항목':
        case '납부회차':
          initialVars[v] = installment.memo || `${installment.round}차 분납`;
          break;
        case '입금금액':
        case '납부금액':
          initialVars[v] = `${amountWon.toLocaleString()}원`;
          break;
        case '입금계좌':
          initialVars[v] = bankAccountStr;
          break;
        case '마감기한':
        case '납부기한':
          initialVars[v] = `${installment.dueDate}${diffDays > 0 ? ` (${diffDays}일 남음)` : diffDays === 0 ? ' (오늘 마감)' : ' (기한 경과)'}`;
          break;
        case '남은일수':
          initialVars[v] = daysLeft;
          break;
        case '입금일시':
          initialVars[v] = installment.paidDate || new Date().toISOString().split('T')[0];
          break;
        case '잔여금액':
        case '남은잔금':
          initialVars[v] = `${remainingWon.toLocaleString()}원`;
          break;
        case '수임료':
          initialVars[v] = `${(totalFeeManwon * 10000).toLocaleString()}원`;
          break;
        case '사건유형':
          initialVars[v] = '개인회생';
          break;
        case '안내링크':
          initialVars[v] = `${origin}/my`;
          break;
        case '문의처':
          initialVars[v] = `${firmName || '법무법인'} (직통 02-588-1123)`;
          break;
        default:
          initialVars[v] = variableValues[v] || '';
      }
    }

    setVariableValues(initialVars);
  }, [selectedTemplate, detectedVars, client.clientName, firmName, lawyerName, installment, amountWon, remainingWon, bankAccountStr, daysLeft, diffDays]);

  if (!isOpen) return null;

  // 실시간 조립된 발송 문안
  const compiledMessage = selectedTemplate 
    ? compileTemplateWithVariables(selectedTemplate.template, variableValues)
    : '';

  // 변수 변경 핸들러
  const handleVariableChange = (key: string, val: string) => {
    setVariableValues(prev => ({ ...prev, [key]: val }));
  };

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
      const cleanPhone = client.phone.replace(/[^0-9]/g, '');

      const res = await sendFeeAlimtok({
        clientId: client.id,
        clientName: client.clientName,
        phone: cleanPhone,
        firmName,
        lawyerName,
        milestone: selectedMilestone,
        installment,
        remainingFeeManwon: totalFeeManwon - totalPaidManwon,
        bankInfo: settings.bankInfo,
        templateCode: selectedTemplate?.templateCode,
        customMessage: compiledMessage,
        buttons: selectedTemplate?.buttons,
        variableValues,
        altSubject: `[${firmName || '법무법인'}] ${selectedTemplate?.templateName || '수임료 안내'}`,
        altContent: compiledMessage,
        fallbackSms,
      });

      if (res.ok) {
        toast.success(`${client.clientName}님께 '${selectedTemplate?.templateName}' 팝빌 승인 알림톡이 발송되었습니다.`);
        onSent?.(selectedMilestone);
        onClose();
      } else {
        toast.error(`발송 실패: ${res.error || '알 수 없는 오류가 발생했습니다.'}`);
      }
    } catch (err: any) {
      toast.error(err?.message || '알림톡 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* 모달 헤더 */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FAE100] text-[#391B1B] flex items-center justify-center font-black text-xs shadow-xs">
                TALK
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">팝빌 승인 수임료 알림톡 발송</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>카카오 사전심사 승인 전용</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  팝빌에 등록·승인된 수임료 템플릿의 고정 문안은 보호되며, 치환 변수값만 입력하여 안전하게 발송합니다.
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

          {/* 본문 영역 (스크롤) */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            
            {/* 수신인 및 발송 채널 요약 바 */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px]">수신 고객:</span>
                <span className="font-bold text-slate-900">
                  {client.clientName} ({client.phone || '연락처 없음'})
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 font-medium">
                  {installment.memo || `${installment.round}차 분납`} ({amountWon.toLocaleString()}원)
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

            {/* 1. 수임료 전용 4종 퀵 선택 탭 */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block text-xs">수임료 안내 시나리오 선택</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MILESTONE_CONFIGS.map(c => {
                  const isSelected = selectedMilestone === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => handleMilestoneChange(c.value)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-yellow-400 bg-yellow-50/80 shadow-xs ring-1 ring-yellow-400' 
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className={`font-bold text-xs ${isSelected ? 'text-yellow-950' : 'text-slate-800'}`}>
                        {c.label}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {c.templateCode}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. 팝빌 등록 승인 템플릿 선택 및 신규 심사 신청 버튼 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  <span>팝빌 승인 템플릿 상세 선택</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    (총 {templates.length}건 등록)
                  </span>
                </label>

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

              {/* 템플릿 드롭다운 선택 상자 */}
              <div className="relative">
                <select
                  value={selectedTemplateCode}
                  onChange={(e) => setSelectedTemplateCode(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#1E3A5F] focus:outline-none appearance-none cursor-pointer pr-9 shadow-xs"
                >
                  {templates.map((t) => (
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
                  {selectedTemplate.state === '승인' ? (
                    <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>검수 승인 완료</span>
                    </span>
                  ) : (
                    <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                      <span>⏳ {selectedTemplate.state} (승인 대기)</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 3. 치환 변수 입력 영역 (핵심: 고정 문안 자동 보호 / 변수만 입력 가능) */}
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

            {/* 4. 카카오톡 실시간 말풍선 미리보기 (텍스트 수정 불가 잠금 화면) */}
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

              {/* 카카오 알림톡 노란색 말풍선 카드 */}
              <div className="bg-[#FAE100] rounded-2xl p-4 shadow-inner space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#391B1B]/80 font-bold border-b border-[#391B1B]/10 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#391B1B] text-white flex items-center justify-center font-black text-[8px]">
                      TALK
                    </div>
                    <span>{firmName || '법무법인'} 회생파산 지원센터</span>
                  </div>
                  <span className="text-[10px] opacity-75">알림톡 도착</span>
                </div>

                {/* 읽기 전용 흰색 말풍선 (직접 수정 불가, 변수 입력에 따라 실시간 렌더링) */}
                <div className="bg-white rounded-xl rounded-tl-none p-3.5 text-xs leading-relaxed text-slate-900 border border-yellow-300/80 shadow-xs whitespace-pre-wrap font-sans select-text">
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

          {/* 모달 액션 바 */}
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
          initialStage={7}
          templateMgtUrl={templateMgtUrl}
          onRegistered={(newTpl) => {
            setTemplates(prev => [newTpl, ...prev]);
            setSelectedTemplateCode(newTpl.templateCode);
            toast.success(`신규 템플릿 [${newTpl.templateName}]이 등록되었습니다.`);
          }}
        />
      )}
    </ModalPortal>
  );
}
