import React, { useState } from 'react';
import { 
  Send, Phone, MessageSquare, Clock, FileText, CheckCircle2, 
  Sparkles, X, ChevronRight, AlertCircle, Copy, AlertTriangle,
  Inbox, ListChecks, History, PhoneCall
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User, AlimtokMilestone } from '../../../types';
import type { PipelineStage } from './WorkflowPipelineStepper';
import { addClientNotification } from '../../../services/clientNotificationService';
import AlimtalkSendConfirmModal from './AlimtalkSendConfirmModal';

interface ClientCommunicationSidePanelProps {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyer: User;
  pipelineStage: PipelineStage;
  onAddNote: (text: string) => void;
  onClose?: () => void;
}

type PanelTab = 'action_required' | 'active_requests' | 'timeline' | 'calls';

export default function ClientCommunicationSidePanel({
  clientRequest,
  crmExt,
  activeLawyer,
  pipelineStage,
  onAddNote,
  onClose,
}: ClientCommunicationSidePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('action_required');
  const [quickMemo, setQuickMemo] = useState('');
  const [callDuration, setCallDuration] = useState('5분');
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    desc?: string;
    emoji: string;
    defaultMessage: string;
    milestone?: AlimtokMilestone;
  } | null>(null);

  const clientName = clientRequest.clientName || '고객';
  const cleanPhone = clientRequest.phone ? clientRequest.phone.replace(/[^0-9]/g, '') : '';

  // 6단계별 추천 알림톡 템플릿
  const stageTemplates: Record<number, Array<{ title: string; desc: string; emoji: string; message: string }>> = {
    1: [
      {
        title: '신청 적격 판정 결과 안내',
        desc: '회생/파산 적격 요건 충족 및 향후 절차',
        emoji: '⚖️',
        message: `[적격 진단] ${clientName}님, 제출해주신 정보를 검토한 결과 개인회생 신청 적격 요건을 충족하셨습니다. 정식 위임 절차를 안내해 드립니다.`
      },
      {
        title: '상담 일정 및 준비사항 안내',
        desc: '유선/방문 심층 상담 안내',
        emoji: '📅',
        message: `[상담 안내] ${clientName}님, 정밀 채무 진단을 위한 변호사 상담 일정이 조율되었습니다.`
      }
    ],
    2: [
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
    3: [
      {
        title: '미제출 서류 간편발급함 안내톡',
        desc: '정부24/홈택스 간편 발급 링크 전송',
        emoji: '📑',
        message: `[서류 수합 안내] ${clientName}님, 법원 제출에 필요한 미제출 서류 목록과 스마트폰 간편 발급 링크가 모바일 서류함에 업데이트되었습니다.`
      },
      {
        title: '채무경위 진술서 작성 요청',
        desc: '모바일 10문 10답 진술서 링크',
        emoji: '🎙️',
        message: `[진술서 작성] ${clientName}님, 법원에 제출할 채무 증대 경위서(진술서)를 스마트폰에서 간편하게 작성해 주세요.`
      },
      {
        title: '제3자 주민번호 마스킹 재발급 요청',
        desc: '가족 뒷자리 별표 표기 서류 재발급',
        emoji: '⚠️',
        message: `[서류 보완요청] ${clientName}님, 법원 제출 기준에 맞추어 가족 주민등록번호 뒷자리가 미표기(******)된 서류로 다시 발급해 업로드해주세요.`
      }
    ],
    4: [
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
    5: [
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
    6: [
      {
        title: '개시결정 축하 & 가상계좌 스케줄',
        desc: '인가 전 적립금 입금 스케줄 안내',
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

  // 알림톡 템플릿 사전 확인 팝업 오픈
  const handleOpenSendModal = (tpl: { title: string; desc?: string; message: string; emoji: string }) => {
    const stageMilestoneMap: Record<number, AlimtokMilestone> = {
      1: 'consult_booked',
      2: 'contract_signed',
      3: 'document_request',
      4: 'court_filed',
      5: 'correction_order',
      6: 'commenced',
    };
    setConfirmModalConfig({
      isOpen: true,
      title: tpl.title,
      desc: tpl.desc,
      emoji: tpl.emoji,
      defaultMessage: tpl.message,
      milestone: stageMilestoneMap[pipelineStage] || 'consult_booked',
    });
  };

  // 메모 작성 및 저장
  const handleSaveMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMemo.trim()) return;
    onAddNote(`[통화/상담 ${callDuration}] ${quickMemo.trim()}`);
    setQuickMemo('');
    toast.success('고객 상담 메모가 사건 타임라인에 저장되었습니다.');
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-slate-200 shadow-sm">
      {/* 패널 헤더 */}
      <div className="p-4 bg-[#1E3A5F] text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/10 text-white">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-xs block text-slate-100">
              사건 실행형 고객 소통창
            </span>
            <span className="text-[11px] text-blue-200">
              {clientName} 고객 ({clientRequest.phone ? clientRequest.phone.slice(-4) : ''})
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="패널 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 고객 연락처 및 빠른 전화걸기 바 */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono font-bold text-slate-800">{clientRequest.phone || '연락처 없음'}</span>
          <button
            type="button"
            onClick={() => {
              if (clientRequest.phone) {
                navigator.clipboard.writeText(clientRequest.phone);
                toast.success('전화번호가 복사되었습니다.');
              }
            }}
            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
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

      {/* 4대 탭 바 (처리 필요 / 요청 현황 / 전체 타임라인 / 통화 메모) */}
      <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('action_required')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'action_required'
              ? 'bg-white text-[#1E3A5F] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertCircle className="w-3 h-3 text-amber-500" />
          <span>처리 필요</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('active_requests')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'active_requests'
              ? 'bg-white text-[#1E3A5F] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ListChecks className="w-3 h-3 text-blue-600" />
          <span>요청 현황</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'timeline'
              ? 'bg-white text-[#1E3A5F] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3 h-3 text-slate-500" />
          <span>타임라인</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calls')}
          className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'calls'
              ? 'bg-white text-[#1E3A5F] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PhoneCall className="w-3 h-3 text-emerald-600" />
          <span>상담 메모</span>
        </button>
      </div>

      {/* 탭 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* 탭 1: 처리 필요 (Action Required) */}
        {activeTab === 'action_required' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>고객 질문 및 확인 요청 (1건)</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                "급여명세서는 최근 몇 개월분이 필요한가요?" (14분 전 카카오톡 수신)
              </p>
              <button
                type="button"
                onClick={() => {
                  handleOpenSendModal({
                    title: '고객 질문 답변 안내',
                    desc: '급여명세서 준비 범위 및 대체 서류 안내',
                    emoji: '💬',
                    message: `[답변 안내] ${clientName}님, 문의해주신 급여명세서 서류 관련 안내드립니다.\n\n급여명세서는 최근 1년(12개월)분을 준비해 주시면 되며, 회사 직인 날인이 어렵거나 발급이 어려우신 경우 급여 입금 통장 거래내역서로 대체 가능합니다. 스마트폰 마이페이지 서류함에서 촬영하여 업로드해 주시기 바랍니다.`,
                  });
                }}
                className="mt-1 text-[11px] font-bold text-[#1E3A5F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>답변하기 ➔</span>
              </button>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>서류 제출 도착 (2건 대기)</span>
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                주민등록등본, 원천징수영수증이 모바일로 업로드되었습니다.
              </p>
            </div>
          </div>
        )}

        {/* 탭 2: 요청 현황 (Active Tasks) */}
        {activeTab === 'active_requests' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-[11px]">필수서류 6건 일괄 요청</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">진행중</span>
              </div>
              <p className="text-[11px] text-slate-500">
                발송 9/13 14:20 | 열람 14:32 | 현재 2/6건 제출됨
              </p>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: '33%' }} />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenSendModal({
                      title: '미제출 서류 제출 재촉 리마인더',
                      desc: '법원 접수 지연 방지를 위한 서류 신속 제출 독촉',
                      emoji: '📑',
                      message: `[서류 제출 재촉] ${clientName}님, 법원 접수를 위한 필수 서류 중 아직 미제출된 항목이 남아있습니다.\n\n서류 제출이 지체되면 채권자 추심·압류를 방지하는 [금지명령] 신청 또한 늦어지게 됩니다. 스마트폰으로 사진을 촬영하여 모바일 서류함에 업로드해 주시기 바랍니다.`,
                    });
                  }}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>서류 재촉 알림톡 발송 ➔</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-[11px]">모바일 전자계약서</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">서명 완료</span>
              </div>
              <p className="text-[11px] text-slate-500">2026.09.12 전자서명 체결 완료됨</p>
            </div>
          </div>
        )}

        {/* 탭 3: 전체 타임라인 (Timeline) */}
        {activeTab === 'timeline' && (
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold text-slate-400">오늘 (9월 13일)</div>
            <div className="space-y-2 pl-2 border-l-2 border-slate-200">
              <div className="text-[11px] space-y-0.5">
                <div className="text-slate-400 text-[10px]">16:35</div>
                <div className="font-bold text-slate-800">근로소득세 원천징수영수증 제출됨</div>
              </div>
              <div className="text-[11px] space-y-0.5">
                <div className="text-slate-400 text-[10px]">16:20</div>
                <div className="font-bold text-slate-800">주민등록등본 모바일 제출됨</div>
              </div>
              <div className="text-[11px] space-y-0.5">
                <div className="text-slate-400 text-[10px]">14:32</div>
                <div className="font-medium text-slate-600">고객이 카카오톡 서류함 링크 열람함</div>
              </div>
              <div className="text-[11px] space-y-0.5">
                <div className="text-slate-400 text-[10px]">14:20</div>
                <div className="font-medium text-[#1E3A5F]">미제출 서류 묶음 요청 알림톡 발송됨</div>
              </div>
            </div>
          </div>
        )}

        {/* 탭 4: 통화·상담 메모 (Calls) */}
        {activeTab === 'calls' && (
          <div className="space-y-3">
            <form onSubmit={handleSaveMemo} className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-[11px]">통화 내용 기록</span>
                <select
                  value={callDuration}
                  onChange={e => setCallDuration(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-600"
                >
                  <option value="3분">3분</option>
                  <option value="5분">5분</option>
                  <option value="10분">10분</option>
                  <option value="15분+">15분 이상</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={quickMemo}
                onChange={e => setQuickMemo(e.target.value)}
                placeholder="통화 중 협의된 채무 사유, 가족 관계, 서류 발급 기한을 기록하세요..."
                className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] resize-none"
              />
              <button
                type="submit"
                disabled={!quickMemo.trim()}
                className="w-full py-1.5 bg-[#1E3A5F] hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                메모 저장
              </button>
            </form>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700">이전 상담 메모 ({crmExt.notes.length})</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {crmExt.notes.slice(-4).reverse().map(n => (
                  <div key={n.id} className="p-2 bg-white rounded-lg border border-slate-200 text-[11px]">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="font-bold text-slate-600">{n.authorName}</span>
                      <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-800">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 하단: 현재 단계 추천 알림톡 발송기 ── */}
        <div className="pt-3 border-t border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-slate-900 flex items-center gap-1 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
              Stage 0{pipelineStage} 추천 알림톡
            </span>
            <span className="text-[10px] text-slate-400 font-medium">원클릭 발송</span>
          </div>

          <div className="space-y-2">
            {currentTemplates.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleOpenSendModal(tpl)}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-[#1E3A5F] bg-white hover:bg-slate-50 transition-all shadow-2xs group cursor-pointer press-scale space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{tpl.emoji}</span>
                    <span className="group-hover:text-[#1E3A5F] transition-colors">{tpl.title}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1E3A5F] transition-all" />
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">{tpl.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 카카오 알림톡 발송 전 사전 확인 & 실시간 말풍선 미리보기 모달 ── */}
      {confirmModalConfig && confirmModalConfig.isOpen && (
        <AlimtalkSendConfirmModal
          isOpen={confirmModalConfig.isOpen}
          onClose={() => setConfirmModalConfig(null)}
          clientName={clientName}
          clientPhone={clientRequest.phone || ''}
          templateTitle={confirmModalConfig.title}
          templateDesc={confirmModalConfig.desc}
          emoji={confirmModalConfig.emoji}
          defaultMessage={confirmModalConfig.defaultMessage}
          firmName={activeLawyer.lawFirmName || activeLawyer.firm || '법무법인'}
          lawyerName={activeLawyer.name || '담당 변호사'}
          stageNumber={pipelineStage}
          milestone={confirmModalConfig.milestone}
          onSent={(sentMsg) => {
            onAddNote(`[카카오 알림톡 발송 - ${confirmModalConfig.title}] ${sentMsg}`);
            setConfirmModalConfig(null);
          }}
        />
      )}
    </div>
  );
}
