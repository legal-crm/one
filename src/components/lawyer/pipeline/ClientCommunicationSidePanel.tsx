import React, { useState, useRef } from 'react';
import { 
  Send, Phone, MessageSquare, Clock, FileText, CheckCircle2, 
  Sparkles, X, ChevronRight, AlertCircle, Copy, AlertTriangle,
  Inbox, ListChecks, History, PhoneCall, Lock, PlayCircle,
  UploadCloud, FileAudio, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User, AlimtokMilestone } from '../../../types';
import type { RecordingItem } from '../../../types/leadTypes';
import type { PipelineStage } from './WorkflowPipelineStepper';
import { addClientNotification } from '../../../services/clientNotificationService';
import { enqueueCall, uploadRecordingToDrive } from '../../../services/communicationService';
import { generateAiCallSummary, extractSpecialMemoFromSummary } from '../../../services/aiCallSummaryService';
import { CustomAudioPlayer } from '../leads/CustomAudioPlayer';
import AlimtalkSendConfirmModal from './AlimtalkSendConfirmModal';

interface ClientCommunicationSidePanelProps {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyer: User;
  pipelineStage: PipelineStage;
  onAddNote: (text: string) => void;
  onClose?: () => void;
  onUpdateExt?: (updated: CrmClientExtension) => void;
}

type PanelTab = 'action_required' | 'active_requests' | 'timeline' | 'calls';

export default function ClientCommunicationSidePanel({
  clientRequest,
  crmExt,
  activeLawyer,
  pipelineStage,
  onAddNote,
  onClose,
  onUpdateExt,
}: ClientCommunicationSidePanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('action_required');
  const [quickMemo, setQuickMemo] = useState('');
  const [callDuration, setCallDuration] = useState('5분');
  const [playingRecording, setPlayingRecording] = useState<RecordingItem | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    desc?: string;
    emoji: string;
    defaultMessage: string;
    milestone?: AlimtokMilestone;
  } | null>(null);

  // 제안서 발송 상태 및 고객 연락처 공개 여부 판별
  const proposals = clientRequest.proposals || [];
  const myProposal = proposals.find(p => p.lawyerId === activeLawyer.id) || proposals[0];
  const hasProposalSent = Boolean(myProposal);
  const isContracted = clientRequest.status === 'contracted' || crmExt?.thirteenStage === 'contract_done';

  const isContactShared = Boolean(
    clientRequest.phoneConsultationRequested || 
    clientRequest.contactDisclosureStatus === 'contact_shared' ||
    myProposal?.phoneConsultRequestedAt ||
    isContracted
  );

  // 스텔스 가명 및 실명 분리
  const rawClientName = clientRequest.clientName || '고객';
  const nameParts = rawClientName.split('_');
  const stealthName = clientRequest.stealthNickname || (nameParts.length > 1 ? nameParts[1] : rawClientName);
  const realName = clientRequest.realClientName || (nameParts.length > 1 ? nameParts[0] : rawClientName);

  const displayClientName = isContactShared ? `${realName} (${stealthName})` : `${stealthName} (스텔스 가명)`;
  const displayPhone = isContactShared && clientRequest.phone ? clientRequest.phone : '010-****-****';
  const cleanPhone = isContactShared && clientRequest.phone ? clientRequest.phone.replace(/[^0-9]/g, '') : '';
  const clientName = isContactShared ? realName : stealthName;

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

  // 통화 녹음 파일 업로드 & Gemini 3.5 Transcribe
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsTranscribing(true);
    setUploadProgressText('구글 드라이브 업로드 & Gemini AI 전사 중...');

    try {
      const driveRes = await uploadRecordingToDrive(file, crmExt.googleDriveConfig, activeLawyer.email);
      const newRec: RecordingItem = {
        id: `rec-${Date.now()}`,
        filename: file.name,
        url: driveRes.url,
        driveFileId: driveRes.driveFileId,
        uploadedAt: new Date().toISOString(),
        duration: 0,
      };

      const aiRes = await generateAiCallSummary(file, {
        customerName: clientName,
        phone: clientRequest.phone,
        managerName: activeLawyer.name,
        caseType: crmExt.caseType === 'bankruptcy' ? '개인파산·면책' : '개인회생'
      });

      const updatedRecordings = [newRec, ...(crmExt.recordings || [])];
      const updated: CrmClientExtension = {
        ...crmExt,
        recordings: updatedRecordings,
        aiSummary: aiRes.rawTranscript,
        lastActivityAt: new Date().toISOString()
      };

      if (onUpdateExt) {
        onUpdateExt(updated);
      }
      setPlayingRecording(newRec);
      toast.success('통화 녹취 업로드 및 AI 대화록 작성이 완료되었습니다.');
    } catch (err: any) {
      console.error(err);
      toast.error(`녹취 분석 실패: ${err.message || '오류 발생'}`);
    } finally {
      setIsTranscribing(false);
      setUploadProgressText('');
    }
  };

  // AI 요약 특이사항을 사건 메모로 등록
  const handleSendAiMemo = () => {
    if (!crmExt.aiSummary) return;
    const memo = extractSpecialMemoFromSummary(crmExt.aiSummary);
    onAddNote(`[AI 통화 요약 특이사항]\n${memo}`);
    toast.success('AI 요약 특이사항이 사건 상담 메모로 전송되었습니다.');
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-slate-200 shadow-sm">
      {/* 패널 헤더 (모던 클린 드로어 헤더) */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-400/30 text-blue-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs text-white">
                고객 소통창
              </span>
              {!isContactShared && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                  익명 보호
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <span>{displayClientName}</span>
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold border border-slate-700/60"
            title="소통창 닫고 서류 작업 복귀"
          >
            <span className="text-[11px]">닫기</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── 소통 상태 게이트 배너 (Gate Banner) ── */}
      <div className={`px-3.5 py-2 text-[11px] font-bold flex items-center gap-2 border-b transition-all ${
        isContactShared 
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
          : hasProposalSent 
            ? 'bg-amber-50 text-amber-800 border-amber-200' 
            : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}>
        {isContactShared ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>소통 해금: 고객이 전화상담을 요청했습니다. (연락처 제공 완료)</span>
          </>
        ) : hasProposalSent ? (
          <>
            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
            <span>고객 확인 대기: 제안서 확인 후 전화상담 요청 시 연락처가 공개됩니다.</span>
          </>
        ) : (
          <>
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>제안서 발송 전에는 직접 소통이 제한됩니다.</span>
          </>
        )}
      </div>

      {/* 고객 연락처 및 빠른 전화걸기 바 */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono font-bold text-slate-800">{displayPhone}</span>
          {isContactShared ? (
            <button
              type="button"
              onClick={() => {
                if (clientRequest.phone) {
                  navigator.clipboard.writeText(clientRequest.phone);
                  toast.success('전화번호가 복사되었습니다.');
                }
              }}
              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              title="전화번호 복사"
            >
              <Copy className="w-3 h-3" />
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title="제안서 확인 후 고객 동의 시 공개">
              <Lock className="w-2.5 h-2.5" />
              미공개
            </span>
          )}
        </div>

        {isContactShared ? (
          <a
            href={`tel:${cleanPhone}`}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Phone className="w-3 h-3" />
            <span>전화 걸기</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              toast.info(hasProposalSent 
                ? '의뢰인이 제안서를 확인하고 전화 상담을 요청하면 전화 걸기가 활성화됩니다.'
                : '의뢰인에게 맞춤 제안서를 먼저 작성하여 발송해주세요.'
              );
            }}
            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-500 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            title="고객 제안서 확인 후 통화 가능"
          >
            <Lock className="w-3 h-3 text-slate-400" />
            <span>전화 걸기</span>
          </button>
        )}
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
          <span>통화·AI</span>
          {(crmExt.recordings || []).length > 0 && (
            <span className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.2 rounded-full font-bold">
              {(crmExt.recordings || []).length}
            </span>
          )}
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
                  if (!isContactShared) {
                    toast.info(hasProposalSent 
                      ? '고객이 제안서를 확인하고 상담을 요청한 후 답변할 수 있습니다.'
                      : '스텔스 익명 보호 상태에서는 직접 답변이 제한됩니다. 맞춤 제안서에 검토 의견을 담아 먼저 발송해주세요.'
                    );
                    return;
                  }
                  handleOpenSendModal({
                    title: '고객 질문 답변 안내',
                    desc: '급여명세서 준비 범위 및 대체 서류 안내',
                    emoji: '💬',
                    message: `[답변 안내] ${clientName}님, 문의해주신 급여명세서 서류 관련 안내드립니다.\n\n급여명세서는 최근 1년(12개월)분을 준비해 주시면 되며, 회사 직인 날인이 어렵거나 발급이 어려우신 경우 급여 입금 통장 거래내역서로 대체 가능합니다. 스마트폰 마이페이지 서류함에서 촬영하여 업로드해 주시기 바랍니다.`,
                  });
                }}
                className={`mt-1 text-[11px] font-bold flex items-center gap-1 ${
                  isContactShared 
                    ? 'text-[#1E3A5F] hover:underline cursor-pointer' 
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                {!isContactShared && <Lock className="w-3 h-3 text-slate-400" />}
                <span>{isContactShared ? '답변하기 ➔' : '답변 대기 (제안서 확인 필요)'}</span>
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

        {/* 탭 4: 통화·AI 분석 & 상담 메모 (Calls) */}
        {activeTab === 'calls' && (
          <div className="space-y-3">
            {/* 1. 빠른 통화 실행 & 녹음 업로드 버튼 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!clientRequest.phone) {
                    toast.error('연락처가 등록되어 있지 않습니다.');
                    return;
                  }
                  enqueueCall(clientRequest.phone, clientName);
                  toast.success(`${clientName}님께 스마트폰 다이얼러 호출 요청을 보냈습니다.`);
                }}
                className="py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer press-scale"
                title="스마트폰으로 즉시 전화 걸기"
              >
                <Phone size={13} className="text-blue-600" />
                <span>스마트폰 통화</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTranscribing}
                className="py-2 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer press-scale disabled:opacity-50"
                title="녹음 파일(.m4a, .mp3) 업로드 및 Gemini 3.5 AI 분석"
              >
                <UploadCloud size={13} className="text-purple-600" />
                <span>{isTranscribing ? 'AI 분석 중...' : '녹음 AI 분석'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
              />
            </div>

            {/* AI 분석 중 인디케이터 */}
            {isTranscribing && (
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 text-purple-800 text-[11px] font-bold animate-pulse">
                <Sparkles size={14} className="text-purple-600 animate-spin shrink-0" />
                <span className="truncate">{uploadProgressText}</span>
              </div>
            )}

            {/* 오디오 플레이어 (선택된 녹음 재생) */}
            {playingRecording && (
              <div className="animate-fadeIn">
                <CustomAudioPlayer
                  src={playingRecording.url}
                  fileName={playingRecording.filename}
                  onClose={() => setPlayingRecording(null)}
                />
              </div>
            )}

            {/* 구글 드라이브 보관 녹취 목록 */}
            {(crmExt.recordings || []).length > 0 && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <FileAudio size={12} className="text-purple-600" />
                    <span>보관된 녹취 ({crmExt.recordings?.length}건)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">구글 드라이브</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {crmExt.recordings?.slice(0, 5).map((rec) => (
                    <div key={rec.id} className="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-[10px]">
                      <span className="truncate max-w-[150px] font-medium text-slate-700">{rec.filename}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPlayingRecording(rec)}
                          className="px-1.5 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[10px] font-bold cursor-pointer"
                        >
                          청취
                        </button>
                        <a
                          href={rec.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 요약 특이사항 메모 등록 버튼 */}
            {crmExt.aiSummary && (
              <button
                type="button"
                onClick={handleSendAiMemo}
                className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText size={12} className="text-blue-600" />
                <span>AI 요약 특이사항을 사건 메모로 등록</span>
              </button>
            )}

            {/* 2. 빠른 통화 내용 수동 기록 폼 */}
            <form onSubmit={handleSaveMemo} className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-[11px]">통화 내용 직접 메모</span>
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
                rows={2}
                value={quickMemo}
                onChange={e => setQuickMemo(e.target.value)}
                placeholder="통화 중 협의된 채무 사유, 가족 관계, 서류 발급 기한..."
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

            {/* 3. 이전 상담 메모 목록 */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-700">이전 상담 메모 ({crmExt.notes.length})</span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
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
            <span className="text-[10px] text-slate-400 font-medium">
              {isContactShared ? '원클릭 발송' : '🔒 제안서 확인 후 발송'}
            </span>
          </div>

          <div className="space-y-2">
            {currentTemplates.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!isContactShared) {
                    toast.info(hasProposalSent 
                      ? '고객이 제안서를 확인하고 전화 상담을 요청한 후 알림톡을 발송할 수 있습니다.'
                      : '의뢰인 연락처가 미공개 상태입니다. 맞춤 제안서를 먼저 작성하여 발송해주세요.'
                    );
                    return;
                  }
                  handleOpenSendModal(tpl);
                }}
                className={`w-full text-left p-2.5 rounded-xl border transition-all shadow-2xs group space-y-0.5 ${
                  isContactShared 
                    ? 'border-slate-200 hover:border-[#1E3A5F] bg-white hover:bg-slate-50 cursor-pointer press-scale' 
                    : 'border-slate-200 bg-slate-50/70 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>{tpl.emoji}</span>
                    <span className={isContactShared ? 'group-hover:text-[#1E3A5F] transition-colors' : 'text-slate-600'}>
                      {tpl.title}
                    </span>
                  </span>
                  {isContactShared ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1E3A5F] transition-all" />
                  ) : (
                    <Lock className="w-3 h-3 text-slate-400" />
                  )}
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
