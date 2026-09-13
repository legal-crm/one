import React, { useState } from 'react';
import { 
  Send, Phone, MessageSquare, Clock, FileText, CheckCircle2, 
  Sparkles, X, ChevronRight, AlertCircle, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';

interface ClientCommunicationSidePanelProps {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyer: User;
  pipelineStage: 1 | 2 | 3 | 4 | 5;
  onAddNote: (text: string) => void;
  onClose?: () => void;
}

export default function ClientCommunicationSidePanel({
  clientRequest,
  crmExt,
  activeLawyer,
  pipelineStage,
  onAddNote,
  onClose,
}: ClientCommunicationSidePanelProps) {
  const [quickMemo, setQuickMemo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const clientName = clientRequest.clientName || '고객';
  const cleanPhone = clientRequest.phone ? clientRequest.phone.replace(/[^0-9]/g, '') : '';

  // 현재 단계별 추천 알림톡 템플릿
  const stageTemplates: Record<number, Array<{ title: string; desc: string; emoji: string; message: string }>> = {
    1: [
      {
        title: '모바일 전자계약 서명 요청',
        desc: '카카오 알림톡 전자서명 링크 전송',
        emoji: '✍️',
        message: `[전자계약서 발송] ${clientName}님, 개인회생 사건 위임을 위한 모바일 전자계약서가 준비되었습니다. 알림톡 링크를 통해 서명을 완료해주세요.`
      },
      {
        title: '착수금 및 수임료 계좌 안내',
        desc: '약정된 착수금 입금 계좌 전송',
        emoji: '💳',
        message: `[착수금 안내] ${clientName}님, 개인회생 진행을 위한 법무법인 전용 착수금 계좌가 안내되었습니다. 확인 후 입금 부탁드립니다.`
      }
    ],
    2: [
      {
        title: '미제출 4대 서류 발급 안내톡',
        desc: '정부24/홈택스 간편 발급 링크 전송',
        emoji: '📑',
        message: `[서류 수합 안내] ${clientName}님, 법원 제출에 필요한 미제출 서류 목록과 스마트폰 간편 발급 링크가 모바일 서류함에 업데이트되었습니다.`
      },
      {
        title: '부채증명서 발급 위임동의 요청',
        desc: '채권자별 부채발급 전자동의',
        emoji: '📜',
        message: `[부채증명 발급] ${clientName}님, 금융기관 부채증명서 대리 발급을 위한 전자위임 동의를 모바일에서 진행해주세요.`
      },
      {
        title: '채무경위 진술서 작성 요청',
        desc: '모바일 10문 10답 진술서 링크',
        emoji: '🎙️',
        message: `[진술서 작성] ${clientName}님, 법원에 제출할 채무 증대 경위서(진술서)를 스마트폰에서 간편하게 작성해 주세요.`
      }
    ],
    3: [
      {
        title: '법원 개시신청 접수완료 안내',
        desc: '사건번호 및 관할법원 통보',
        emoji: '⚖️',
        message: `[법원 접수 완료] ${clientName}님, 대법원 전자소송을 통해 개인회생 개시신청서 및 금지명령신청서가 정식 접수되었습니다.`
      },
      {
        title: '금지명령 인용 & 추심 대응 요령',
        desc: '채권자 독촉 전화 방어 매뉴얼',
        emoji: '🛡️',
        message: `[금지명령 결정] ${clientName}님, 법원의 금지명령이 인용되었습니다. 이제 채권자의 독촉 전화 및 급여 압류가 전면 금지됩니다.`
      }
    ],
    4: [
      {
        title: '법원 보정권고 소명자료 요청',
        desc: '회생위원 요구 소명서류 요청',
        emoji: '📮',
        message: `[보정권고 안내] ${clientName}님, 회생위원 보정요구에 따른 추가 소명자료(대출금 사용처/통장거래)를 기한 내에 업로드해주세요.`
      },
      {
        title: '보정기한 마감 임박 긴급 리마인더',
        desc: '기각 방지를 위한 긴급 제출 독촉',
        emoji: '⏰',
        message: `[긴급] ${clientName}님, 법원 보정서 제출 기한이 얼마 남지 않았습니다. 서류 제출이 지연되면 기각될 수 있으니 즉시 확인해주세요.`
      }
    ],
    5: [
      {
        title: '개시결정 축하 & 가상계좌 스케줄 안내',
        desc: '인가 전 적립금 입금 스케줄',
        emoji: '🏦',
        message: `[개시결정 축하] ${clientName}님, 개인회생 개시결정이 내려졌습니다! 법원 가상계좌로 인가 전 적립금을 성실히 납부해주세요.`
      },
      {
        title: '채권자집회 출석 지도 및 유의사항',
        desc: '집회 기일, 장소, 준비물 가이드',
        emoji: '🏛️',
        message: `[채권자집회 안내] ${clientName}님, 법원 채권자집회 출석 기일 및 신분증 지참 등 준비물을 안내해 드립니다.`
      }
    ]
  };

  const currentTemplates = stageTemplates[pipelineStage] || stageTemplates[1];

  // 알림톡 템플릿 원클릭 발송
  const handleSendTemplate = (tpl: { title: string; message: string; emoji: string }) => {
    setIsSending(true);
    addClientNotification({
      type: 'status_change',
      title: tpl.message,
      emoji: tpl.emoji,
      linkTab: 'diagnosis',
    });
    setTimeout(() => {
      setIsSending(false);
      toast.success(`${clientName}님께 '${tpl.title}' 카카오 알림톡이 성공적으로 발송되었습니다.`);
    }, 300);
  };

  // 메모 작성 및 저장
  const handleSaveMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMemo.trim()) return;
    onAddNote(`[상담소통] ${quickMemo.trim()}`);
    setQuickMemo('');
    toast.success('고객 상담 메모가 저장되었습니다.');
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-slate-200/90 shadow-sm">
      {/* 패널 헤더 */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/10 text-white">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-xs block text-slate-100">
              원스톱 고객 소통 패널
            </span>
            <span className="text-[11px] text-slate-400">
              {clientName} 의뢰인과 실시간 연결
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="패널 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 고객 연락처 카드 */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono font-bold text-slate-800">{clientRequest.phone || '연락처 없음'}</span>
          <button
            onClick={() => {
              if (clientRequest.phone) {
                navigator.clipboard.writeText(clientRequest.phone);
                toast.success('전화번호가 복사되었습니다.');
              }
            }}
            className="text-slate-400 hover:text-slate-700 p-0.5"
            title="복사"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>

        <a
          href={`tel:${cleanPhone}`}
          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 shadow-2xs"
        >
          <Phone className="w-3 h-3" />
          <span>전화 걸기</span>
        </a>
      </div>

      {/* 스크롤 가능한 본문 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* 1. 현재 단계 맞춤 알림톡 빠른 발송 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900 flex items-center gap-1 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              Stage 0{pipelineStage} 추천 알림톡
            </span>
            <span className="text-[10px] text-slate-400 font-medium">원클릭 발송</span>
          </div>

          <div className="space-y-2">
            {currentTemplates.map((tpl, idx) => (
              <button
                key={idx}
                onClick={() => handleSendTemplate(tpl)}
                disabled={isSending}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-brand/40 bg-white hover:bg-slate-50 transition-all shadow-2xs group cursor-pointer press-scale space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{tpl.emoji}</span>
                    <span className="group-hover:text-brand transition-colors">{tpl.title}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">
                  {tpl.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 2. 빠른 상담 통화 메모 입력 */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <span className="font-extrabold text-slate-900 flex items-center gap-1 text-xs">
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            상담 통화 메모 작성
          </span>
          <form onSubmit={handleSaveMemo} className="space-y-2">
            <textarea
              rows={3}
              value={quickMemo}
              onChange={e => setQuickMemo(e.target.value)}
              placeholder="고객과의 통화 내용이나 특이사항을 빠르게 기록하세요..."
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-slate-50/50 focus:bg-white resize-none"
            />
            <button
              type="submit"
              disabled={!quickMemo.trim()}
              className="w-full py-2 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed press-scale cursor-pointer"
            >
              메모 기록 저장
            </button>
          </form>
        </div>

        {/* 3. 최근 상담 메모 히스토리 */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900 flex items-center gap-1 text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              최근 소통 메모 ({crmExt.notes.length})
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {crmExt.notes.length === 0 ? (
              <p className="text-slate-400 text-[11px] text-center py-4 bg-slate-50 rounded-xl">
                아직 기록된 소통 메모가 없습니다.
              </p>
            ) : (
              crmExt.notes.slice(-5).reverse().map((n) => (
                <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span className="font-bold text-slate-700">{n.authorName}</span>
                    <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-800 font-medium whitespace-pre-wrap">{n.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
