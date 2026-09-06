import React, { useState } from 'react';
import { X, Copy, Check, Share2, Smartphone, ShieldCheck, Clock, Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract } from '../../types';

interface Props {
  contract: ElectronicContract;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClientSignShareModal({ contract, isOpen, onClose }: Props) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  if (!isOpen) return null;

  // 일회용 보안 서명 URL 생성
  const signToken = contract.remoteSignToken || `sgn-${contract.id.toLowerCase()}-${Date.now()}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mykimlawyer.kr';
  const signUrl = `${origin}?view=sign&token=${signToken}&cid=${contract.id}`;

  const feeFormatted = ((contract.totalFee || 0) * 10000).toLocaleString();

  // 안내 문자/알림톡 템플릿 문안
  const messageTemplate = `[${contract.lawFirmName}] 전자계약서 서명 요청 안내

${contract.clientName} 의뢰인님,
의뢰하신 사건에 대한 전자위임계약서 작성이 준비되었습니다.
아래 링크에 접속하시어 내용을 검토하신 후 대표자 스마트폰 본인인증 및 전자서명을 완료해 주시기 바랍니다.

■ 계약명: 개인회생/파산 사건 수임 계약
■ 총 수임료: ${feeFormatted}원
■ 서명 기한: 72시간 이내
■ 안전 서명 링크:
${signUrl}

※ 본 계약은 전자서명법 제3조에 따라 법적 효력을 가지며, 대표자 명의의 스마트폰(PASS 또는 문자)으로 본인확인이 진행됩니다.`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(signUrl);
    setCopiedLink(true);
    toast.success('서명 링크가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageTemplate);
    setCopiedMsg(true);
    toast.success('카카오톡/문자 안내 문구가 복사되었습니다.');
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
        
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">고객 원격 모바일 서명 발송</h3>
              <p className="text-xs text-slate-500">{contract.id} · {contract.clientName} 의뢰인</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-4 text-xs">
          
          {/* 보안 서명 링크 */}
          <div>
            <label className="font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>📱 일회용 모바일 보안 서명 링크</span>
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 3중 암호화 보안 적용
              </span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                readOnly
                value={signUrl}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors shadow-xs"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? '복사됨' : '링크 복사'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" /> 발송 후 72시간 동안 유효하며, 1회 서명 완료 시 자동 만료됩니다.
            </p>
          </div>

          {/* 알림톡 / 문자 전송 문안 미리보기 */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-brand" />
                <span>카카오톡 / 문자 안내 템플릿</span>
              </label>
              <button
                onClick={handleCopyMessage}
                className="text-[11px] font-bold text-brand hover:text-brand/80 flex items-center gap-1 cursor-pointer"
              >
                {copiedMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMsg ? '복사 완료' : '문안 전체 복사'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={8}
              value={messageTemplate}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed font-sans resize-none focus:outline-none select-all"
            />
          </div>

          {/* 인증 절차 안내 */}
          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-[11px] text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" /> 서명 시 의뢰인 본인인증 절차:
            </p>
            <p className="text-amber-700 pl-4.5">
              1. 링크 접속 시 통신 3사(PASS/문자) 스마트폰 본인인증 팝업이 실행됩니다.<br />
              2. 국세청에 등록된 대표자명과 일치해야 계약서 열람 및 자필 서명이 허용됩니다.
            </p>
          </div>

        </div>

        {/* 푸터 */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            닫기
          </button>
          <button
            onClick={handleCopyMessage}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand hover:bg-brand/90 rounded-xl cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>안내 문구 복사하고 닫기</span>
          </button>
        </div>

      </div>
    </div>
  );
}
