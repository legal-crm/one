import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, MessageCircle, Send, RotateCcw, Edit3, Sparkles, 
  Users, AlertTriangle, CheckCircle2, Smartphone, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

interface TargetClient {
  id: string;
  clientName: string;
  phone: string;
  subText?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  channel: 'alimtok' | 'sms';
  filterKey: string;
  filterLabel: string;
  targetClients: TargetClient[];
  firmName: string;
  lawyerName: string;
  onConfirmSend: (message: string, channel: 'alimtok' | 'sms') => Promise<void> | void;
}

export default function BulkMessageSendModal({
  isOpen,
  onClose,
  channel: initialChannel,
  filterKey,
  filterLabel,
  targetClients,
  firmName,
  lawyerName,
  onConfirmSend
}: Props) {
  const [channel, setChannel] = useState<'alimtok' | 'sms'>(initialChannel);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(0);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isConfirmedCheckbox, setIsConfirmedCheckbox] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showRecipientList, setShowRecipientList] = useState<boolean>(false);

  useEffect(() => {
    setChannel(initialChannel);
  }, [initialChannel]);

  // 필터별 추천 템플릿 프리셋
  const presets = useMemo(() => {
    const firm = firmName || '법무법인';
    const lawyer = lawyerName || '담당 변호사';

    switch (filterKey) {
      case 'doc_overdue':
        return [
          {
            title: '📋 서류 미제출 보완 요청 (권장)',
            text: `[${firm}] 회생·파산 사건 필수 서류 제출 안내

#{의뢰인명} 의뢰인님,
회생·파산 사건 접수를 위한 필수 서류가 아직 미제출 상태입니다.

서류 제출이 지체될 경우 법원 사건 접수 및 채권자 추심/압류를 방지하는 [금지명령] 신청 또한 지연됩니다.

스마트폰 카메라로 서류를 촬영하여 마이페이지에서 간편 업로드하시거나, 팩스/이메일로 제출해 주시기 바랍니다.

궁금하신 점은 언제든 사무소로 연락 주세요.
${firm} ${lawyer} 변호사 드림`
          },
          {
            title: '📸 간편 모바일 제출 안내',
            text: `[${firm}] 서류 간편 모바일 업로드 안내

#{의뢰인명} 의뢰인님,
발급받으신 서류는 스마트폰으로 사진을 찍어 마이페이지에 바로 등록하실 수 있습니다. 서류 발급에 어려움이 있으시면 언제든 연락 부탁드립니다.
${firm} 드림`
          }
        ];

      case 'fee_overdue':
        return [
          {
            title: '💸 분납 기한 안내 및 일정 조율 (권장)',
            text: `[${firm}] 수임료 분납 일정 안내

#{의뢰인명} 의뢰인님,
약정된 수임료 분납일이 경과되어 안내드립니다.

혹시 경제적 사정으로 인해 당장 납부가 어려우신 경우, 분납 일정을 조율해 드릴 수 있으니 부담 없이 사무소로 연락 부탁드립니다.

성실하고 신속하게 사건을 돕겠습니다.
${firm} ${lawyer} 변호사`
          },
          {
            title: '🏦 입금 계좌 재안내',
            text: `[${firm}] 수임료 입금 계좌 안내

#{의뢰인명} 의뢰인님,
수임료 분납 안내드립니다. 상세 계좌정보 및 잔여 납부 회차는 마이페이지에서 확인하실 수 있습니다.
${firm} 드림`
          }
        ];

      case 'hearing_month':
        return [
          {
            title: '🏛️ 채권자집회 기일 참석 준비 안내',
            text: `[${firm}] 법원 채권자집회 참석 안내

#{의뢰인명} 의뢰인님,
이번 달 법원 채권자집회 기일이 예정되어 있습니다.

■ 준비물: 신분증(주민등록증 또는 운전면허증) 원본
■ 주의사항: 법정 15분 전 입실 필수

원활한 참석을 위해 사전에 진행 요령을 한 번 더 안내해 드릴 예정입니다.
${firm} ${lawyer} 변호사`
          }
        ];

      case 'correction_urgent':
        return [
          {
            title: '⚠️ [긴급] 법원 보정기한 임박 안내',
            text: `[${firm}] 🚨 법원 보정기한 임박 긴급 안내

#{의뢰인명} 의뢰인님,
법원에서 송달된 보정권고/보정명령에 대한 제출 기한이 임박했습니다.

기한 내 소명자료가 제출되지 않을 경우 사건 기각 위험이 있으므로, 메시지 확인 즉시 담당자에게 연락 부탁드립니다.
${firm} ${lawyer} 변호사`
          }
        ];

      default:
        return [
          {
            title: '📢 진행상황 안내',
            text: `[${firm}] 회생·파산 사건 진행상황 안내

#{의뢰인명} 의뢰인님,
의뢰하신 사건의 원활한 진행을 위해 안내드립니다. 상세 진행 현황은 마이페이지에서 실시간으로 확인하실 수 있습니다.
${firm} ${lawyer} 변호사`
          }
        ];
    }
  }, [filterKey, firmName, lawyerName]);

  // 템플릿 변경 시 텍스트 반영
  useEffect(() => {
    if (presets[selectedPresetIdx]) {
      setCustomMessage(presets[selectedPresetIdx].text);
    }
  }, [presets, selectedPresetIdx]);

  // 모달 닫힐 때 체크박스 초기화
  useEffect(() => {
    if (!isOpen) {
      setIsConfirmedCheckbox(false);
      setIsSending(false);
      setShowRecipientList(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDefaultText = presets[selectedPresetIdx]?.text || '';
  const isCustomized = customMessage.trim() !== currentDefaultText.trim();

  const handleResetToDefault = () => {
    setCustomMessage(currentDefaultText);
    toast.info('기본 템플릿 문구로 복원되었습니다.');
  };

  const handleSend = async () => {
    if (!isConfirmedCheckbox) {
      toast.warning('수신 대상자 및 발송 확인 체크박스에 체크해 주세요.');
      return;
    }
    if (!customMessage.trim()) {
      toast.error('발송할 메시지 내용을 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      await onConfirmSend(customMessage.trim(), channel);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || '대량 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // 대표 의뢰인 이름으로 치환된 미리보기 텍스트
  const sampleClientName = targetClients[0]?.clientName || '홍길동';
  const previewReplacedMessage = customMessage.replace(/#\{의뢰인명\}/g, sampleClientName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* ── 1. 헤더 ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
              channel === 'alimtok' ? 'bg-[#FAE100] text-[#391B1B]' : 'bg-blue-50 text-blue-600'
            }`}>
              {channel === 'alimtok' ? (
                <MessageCircle className="w-5 h-5 fill-current" />
              ) : (
                <Smartphone className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  타겟 대량 메시지 발송 사전 확인
                </h3>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  오발송 방지 검증
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                수신 대상 {targetClients.length}명 및 메시지 내용을 최종 확인 후 발송합니다.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── 2. 본문 스크롤 영역 ── */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4 text-xs">

          {/* 발송 대상 요약 카드 */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">타겟 세그먼트:</span>
                <span className="font-extrabold text-xs text-brand bg-brand/10 px-2.5 py-1 rounded-lg">
                  {filterLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">총 발송 대상:</span>
                <span className="font-black text-sm text-slate-900">
                  {targetClients.length}명
                </span>
                <button
                  type="button"
                  onClick={() => setShowRecipientList(!showRecipientList)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer"
                >
                  {showRecipientList ? '명단 접기' : '명단 보기'}
                </button>
              </div>
            </div>

            {/* 수신자 명단 토글 영역 */}
            {showRecipientList && (
              <div className="mt-2 pt-2 border-t border-slate-200 max-h-36 overflow-y-auto space-y-1">
                <p className="text-[11px] text-slate-400 font-bold mb-1">수신 의뢰인 목록 (전화번호 마스킹):</p>
                <div className="flex flex-wrap gap-1.5">
                  {targetClients.map((tc, idx) => (
                    <span key={tc.id || idx} className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-[11px] text-slate-700 font-medium">
                      {tc.clientName} ({tc.phone ? tc.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1-****-$2') : '미등록'})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 발송 채널 선택 (카카오 알림톡 vs SMS) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">발송 채널:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChannel('alimtok')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  channel === 'alimtok'
                    ? 'bg-[#FAE100] text-[#391B1B] shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 fill-current" />
                <span>카카오 알림톡 (기본)</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  channel === 'sms'
                    ? 'bg-[#1E3A5F] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>SMS / LMS 문자</span>
              </button>
            </div>
          </div>

          {/* 템플릿 프리셋 선택 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800">
                1. 추천 메시지 템플릿 선택
              </label>
              <span className="text-[11px] text-slate-400">
                변수 <code className="bg-slate-100 px-1 py-0.5 rounded text-brand">#&#123;의뢰인명&#125;</code> 자동 치환
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedPresetIdx(idx)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedPresetIdx === idx
                      ? 'border-brand bg-brand/5 shadow-xs ring-1 ring-brand'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-900 mb-1">
                    {preset.title}
                  </span>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {preset.text}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* 메시지 편집 & 실시간 미리보기 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-brand" />
                <span>2. 메시지 내용 편집 & 실시간 미리보기</span>
              </label>
              <div className="flex items-center gap-2">
                {isCustomized && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>기본 문구 복원</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  {customMessage.length}자
                </span>
              </div>
            </div>

            {/* 카카오톡 또는 SMS 말풍선 박스 */}
            <div className={`rounded-2xl p-4 shadow-inner space-y-3 ${
              channel === 'alimtok' ? 'bg-[#FAE100]' : 'bg-slate-800 text-white'
            }`}>
              <div className={`flex items-center justify-between pb-1 border-b ${
                channel === 'alimtok' ? 'border-yellow-300/60 text-[#391B1B]' : 'border-slate-700 text-slate-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs">
                    {channel === 'alimtok' ? '💬 카카오 알림톡 실시간 미리보기' : '📱 SMS 실시간 미리보기'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    channel === 'alimtok' ? 'bg-yellow-200/60 text-yellow-900' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {firmName || '법무법인'}
                  </span>
                </div>
                <span className="text-[10px] opacity-70 font-mono">
                  예시: {sampleClientName}님 수신 화면
                </span>
              </div>

              {/* 말풍선 본문 편집창 */}
              <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 space-y-2">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={8}
                  className="w-full text-xs leading-relaxed text-slate-900 focus:outline-none resize-none font-sans select-text"
                  placeholder="대량 발송될 메시지 내용을 확인하고 수정하세요."
                />

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>실제 전송 시 <code className="bg-slate-100 px-1 py-0.5 rounded text-brand">#&#123;의뢰인명&#125;</code>이 각 의뢰인의 성명으로 자동 치환됩니다.</span>
                </div>
              </div>

              <div className={`flex items-center justify-between text-[10px] px-1 font-medium ${
                channel === 'alimtok' ? 'text-yellow-950' : 'text-slate-300'
              }`}>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  문구를 직접 수정하여 원하는 내용으로 맞춤 발송할 수 있습니다.
                </span>
                {isCustomized && (
                  <span className={`font-bold px-2 py-0.5 rounded-md ${
                    channel === 'alimtok' ? 'bg-amber-200 text-amber-950' : 'bg-slate-700 text-emerald-300'
                  }`}>
                    ✏️ 직접 수정본
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. 실수 방지 안전 확인 체크박스 ── */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={isConfirmedCheckbox}
                onChange={(e) => setIsConfirmedCheckbox(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 accent-amber-600 mt-0.5 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-extrabold text-amber-900 block">
                  총 {targetClients.length}명의 의뢰인에게 {channel === 'alimtok' ? '카카오 알림톡' : 'SMS'}으로 즉시 일괄 발송됨을 확인했습니다.
                </span>
                <span className="text-[11px] text-amber-700">
                  체크박스를 선택하셔야 최종 발송 버튼이 활성화됩니다. 발송 내역은 각 의뢰인의 CRM 활동 로그에 영구 기록됩니다.
                </span>
              </div>
            </label>
          </div>

        </div>

        {/* ── 4. 액션 푸터 ── */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="min-h-[44px] px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors active:scale-[0.98] whitespace-nowrap"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !isConfirmedCheckbox || !customMessage.trim()}
            className={`min-h-[44px] px-6 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
              channel === 'alimtok'
                ? 'text-[#391B1B] bg-[#FAE100] hover:bg-[#F4D700]'
                : 'text-white bg-[#1E3A5F] hover:bg-[#162d4a]'
            }`}
          >
            {isSending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                <span>{targetClients.length}명에게 발송 처리 중...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 fill-current" />
                <span>🚀 {targetClients.length}명에게 일괄 발송하기</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
