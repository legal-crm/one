import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, MessageCircle, Send, RotateCcw, Edit3, Sparkles, Clock, 
  Smartphone, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contract: ElectronicContract | null;
  onSend: (templateKey: string, message: string, channel: 'alimtok' | 'sms' | 'both') => Promise<void> | void;
}

type TemplateKey = 'standard' | 'urgent' | 'expiry';

interface TemplateOption {
  key: TemplateKey;
  label: string;
  badge: string;
  badgeColor: string;
  description: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    key: 'urgent',
    label: '🚨 골든타임 긴급 경고',
    badge: '추천 (골든타임 지체)',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    description: '서명 지연 시 채권자 추심/압류 방지(금지명령) 지연 경고'
  },
  {
    key: 'standard',
    label: '📋 정중한 서명 리마인드',
    badge: 'D+1 권장',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: '스마트폰 본인인증 및 전자서명 진행 절차 안내'
  },
  {
    key: 'expiry',
    label: '⏱️ 72시간 링크 만료 임박',
    badge: 'D+2~3',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: '일회용 보안 서명 링크 자동 폐기 전 신속 서명 안내'
  }
];

export default function ContractReminderModal({
  isOpen,
  onClose,
  contract,
  onSend
}: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('urgent');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isFallbackSmsEnabled, setIsFallbackSmsEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // 일회용 보안 서명 링크 계산
  const signUrl = useMemo(() => {
    if (!contract) return '';
    const signToken = contract.remoteSignToken || `sgn-${contract.id.toLowerCase()}-${Date.now()}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mykimlawyer.kr';
    return `${origin}?view=sign&token=${signToken}&cid=${contract.id}`;
  }, [contract]);

  // 기본 템플릿 문구 매핑
  const defaultTemplates = useMemo<Record<TemplateKey, string>>(() => {
    if (!contract) {
      return { standard: '', urgent: '', expiry: '' };
    }

    const firm = contract.lawFirmName || '법무법인';
    const lawyer = contract.lawyerName || '담당 변호사';
    const client = contract.clientName || '의뢰인';
    const feeFormatted = ((contract.totalFee || 0) * 10000).toLocaleString();

    return {
      urgent: `[${firm}] 🚨 [긴급] 전자계약 서명 골든타임 경과 안내

${client} 의뢰인님,
발송해 드린 회생·파산 전자위임계약서 서명이 지체되고 있어 긴급 안내드립니다.

⚠️ 중요 안내:
의뢰인님의 전자서명이 완료되어야 법원에 정식 사건 접수가 진행됩니다. 서명이 늦어질 경우 채권자의 독촉 전화, 자택 방문, 급여/통장 압류를 법적으로 중단시키는 [금지명령] 신청 또한 지연됩니다.

채권자 추심의 조속한 차단과 권리 보호를 위해, 지금 즉시 아래 링크에서 스마트폰 본인인증(PASS/문자) 후 서명을 완료해 주시기 바랍니다.

■ 사건명: 개인회생/파산 사건 전자위임계약
■ 약정 수임료: ${feeFormatted}원
■ 1분 간편 서명 링크:
${signUrl}

※ 본 계약은 전자서명법 제3조에 따라 공인된 법적 효력을 갖습니다.
${firm} ${lawyer} 변호사 배상`,

      standard: `[${firm}] 전자계약서 서명 요청 안내

${client} 의뢰인님,
의뢰하신 개인회생/파산 사건 진행을 위한 전자위임계약서 작성이 완료되어 대기 중입니다.

본인 명의 스마트폰으로 간편 본인인증(PASS 또는 문자) 후 내용을 확인하시고 자필 전자서명을 진행해 주시기 바랍니다. (약 1분 소요)

■ 계약명: 개인회생/파산 사건 위임계약
■ 약정 수임료: ${feeFormatted}원
■ 전자서명 바로가기:
${signUrl}

궁금하신 점은 언제든 사무소로 연락 부탁드립니다.
감사합니다.
${firm} ${lawyer} 변호사`,

      expiry: `[${firm}] ⏱️ 전자서명 보안 링크 만료 예정 안내

${client} 의뢰인님,
안전한 계약 체결을 위해 발급된 일회용 모바일 전자서명 링크의 유효시간(72시간)이 곧 만료됩니다.

보안 링크가 만료되면 본인확인 및 계약서 재발급 절차를 다시 진행하셔야 하므로, 만료 전에 접속하시어 서명을 완료해 주시기 바랍니다.

■ 보안 서명 링크:
${signUrl}

※ 72시간 경과 또는 1회 서명 완료 시 보안 링크는 즉시 자동 폐기됩니다.
${firm} 드림`
    };
  }, [contract, signUrl]);

  // 템플릿 변경 시 텍스트 반영
  useEffect(() => {
    if (defaultTemplates[selectedTemplate]) {
      setCustomMessage(defaultTemplates[selectedTemplate]);
    }
  }, [selectedTemplate, defaultTemplates]);

  if (!isOpen || !contract) return null;

  const currentDefaultText = defaultTemplates[selectedTemplate];
  const isCustomized = customMessage.trim() !== currentDefaultText.trim();

  const handleResetToDefault = () => {
    setCustomMessage(currentDefaultText);
    toast.info('기본 템플릿 문구로 복원되었습니다.');
  };

  const handleSend = async () => {
    if (!customMessage.trim()) {
      toast.error('발송할 메시지 내용을 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      const channel = isFallbackSmsEnabled ? 'both' : 'alimtok';
      await onSend(selectedTemplate, customMessage.trim(), channel);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || '알림톡 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const feeFormatted = ((contract.totalFee || 0) * 10000).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* ── 1. 헤더 ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FAE100] flex items-center justify-center text-[#391B1B] shadow-xs">
              <MessageCircle className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">전자계약 서명 재촉 알림 발송</h3>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  사전 확인
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                수신자와 발송될 알림톡 내용을 확인 후 승인해야 최종 발송됩니다.
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

          {/* 수신자 & 계약 정보 요약 카드 */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  {contract.clientName} 의뢰인
                </span>
                <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  {contract.clientPhone || '연락처 미등록'}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  ({contract.lawFirmName} {contract.lawyerName} 변호사)
                </span>
              </div>
              <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3 text-red-500" />
                <span>발송 24시간+ 경과 (골든타임 지체)</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">계약번호</span>
                <span className="font-mono font-bold text-slate-700">{contract.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block">약정 수임료</span>
                <span className="font-extrabold text-slate-900">{feeFormatted}원</span>
              </div>
              <div>
                <span className="text-slate-400 block">원격 서명 보안상태</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> PASS 본인인증 연동
                </span>
              </div>
            </div>
          </div>

          {/* 템플릿 선택 탭 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>1. 재촉 템플릿 프리셋 선택</span>
              </label>
              <span className="text-[11px] text-slate-400">상황에 맞는 문구를 선택하세요</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TEMPLATE_OPTIONS.map(opt => {
                const isSelected = selectedTemplate === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedTemplate(opt.key)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between press-scale ${
                      isSelected
                        ? 'border-yellow-400 bg-yellow-50/70 shadow-xs ring-1 ring-yellow-400'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-xs text-slate-900">{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-fit mt-2 ${opt.badgeColor}`}>
                      {opt.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 카카오 알림톡 실시간 미리보기 & 편집 에디터 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-brand" />
                <span>2. 카카오 알림톡 실시간 미리보기 & 문구 편집</span>
              </label>
              <div className="flex items-center gap-2">
                {isCustomized && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    title="기본 템플릿 문구로 되돌립니다"
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

            {/* 노란색 카카오 알림톡 박스 */}
            <div className="bg-[#FAE100] rounded-2xl p-4 shadow-inner space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-yellow-300/60">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#391B1B] flex items-center justify-center text-white font-black text-[9px]">
                    TALK
                  </div>
                  <span className="font-extrabold text-xs text-[#391B1B]">
                    알림톡 도착
                  </span>
                  <span className="text-[10px] text-yellow-900/80 bg-yellow-200/60 px-1.5 py-0.5 rounded font-bold">
                    마이김변 인증로펌
                  </span>
                </div>
                <span className="text-[10px] text-yellow-950/70 font-mono">
                  {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* 말풍선 텍스트 수정창 */}
              <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm border border-yellow-300/80 space-y-2">
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={8}
                  className="w-full text-xs leading-relaxed text-slate-900 focus:outline-none resize-none font-sans select-text"
                  placeholder="의뢰인에게 발송될 알림톡 내용을 확인하고 필요 시 수정하세요."
                />

                {/* 카카오톡 공식 링크 버튼 모의 */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl text-center border border-slate-200 flex items-center justify-center gap-1.5 cursor-default select-none">
                    <Smartphone className="w-3.5 h-3.5 text-brand" />
                    <span>✍️ 1분 간편 전자서명 바로가기 (본인인증)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center mt-1">
                    의뢰인이 카카오톡에서 위 버튼을 누르면 즉시 휴대폰 본인인증 및 서명 화면으로 이동합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-yellow-950 px-1 font-medium">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-900" />
                  문구를 클릭하여 원하는 내용으로 자유롭게 수정할 수 있습니다.
                </span>
                {isCustomized && (
                  <span className="font-bold text-amber-950 bg-amber-200 px-2 py-0.5 rounded-md">
                    ✏️ 변호사 직접 수정본
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. 발송 채널 옵션 ── */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-800 block text-xs">발송 채널 설정</span>
              <p className="text-[11px] text-slate-500">
                카카오 알림톡 우선 발송 + 카카오톡 미설치/수신 거부 시 SMS/LMS 자동 대체 전송
              </p>
            </div>
            <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                checked={isFallbackSmsEnabled}
                onChange={(e) => setIsFallbackSmsEnabled(e.target.checked)}
                className="w-4 h-4 text-brand rounded border-slate-300 focus:ring-brand accent-brand cursor-pointer"
              />
              <span className="text-xs">SMS 대체 발송 포함</span>
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
            disabled={isSending || !customMessage.trim()}
            className="min-h-[44px] px-6 py-2.5 text-xs font-bold text-[#391B1B] bg-[#FAE100] hover:bg-[#F4D700] rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {isSending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#391B1B]/30 border-t-[#391B1B] rounded-full animate-spin" />
                <span>발송 처리 중...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 fill-current" />
                <span>{isCustomized ? '수정된 내용으로 재촉 알림톡 발송' : '📱 재촉 알림톡 발송하기'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
