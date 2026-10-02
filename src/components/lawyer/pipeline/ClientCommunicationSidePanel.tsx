import React, { useState, useRef, useMemo } from 'react';
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
import { getDisplayClientName, getDisplayPhoneNumber, isClientContactDisclosed } from '../../../utils/clientDisplay';

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
  const isContracted = ['contracted', 'document', 'documents_pending', 'filed', 'commenced', 'repaying', 'discharged'].includes(crmExt?.crmStatus || clientRequest.status || '') || crmExt?.thirteenStage === 'contract_done';

  const isContactShared = isClientContactDisclosed(clientRequest, crmExt);

  const clientName = getDisplayClientName(clientRequest, crmExt);
  const displayClientName = clientName;
  const displayPhone = getDisplayPhoneNumber(clientRequest, crmExt);
  const cleanPhone = isContactShared && clientRequest.phone ? clientRequest.phone.replace(/[^0-9]/g, '') : '';

  // 실제 데이터 기반 처리 필요 항목 도출 (가짜 하드코딩 제거)
  const actionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      desc: string;
      isUrgent?: boolean;
      badge?: string;
    }> = [];

    // 1. 검토 대기 서류 확인
    const docs = (crmExt?.stage3DocsState as any)?.customDocs || crmExt?.documents || [];
    const pendingDocs = docs.filter((d: any) => d.status === 'review_needed' || d.status === 'submitted');
    if (pendingDocs.length > 0) {
      items.push({
        id: 'docs-review',
        title: `서류 제출 도착 (${pendingDocs.length}건 검토 대기)`,
        desc: `${pendingDocs.slice(0, 2).map((d: any) => d.name || d.docType).join(', ')} 등 검토 대기 중인 서류가 있습니다.`,
        badge: '서류 검토',
        isUrgent: true,
      });
    }

    // 2. 제안서 미발송 상태
    if (!hasProposalSent && !isContracted) {
      items.push({
        id: 'proposal-needed',
        title: '맞춤 솔루션 및 제안서 작성 필요',
        desc: '의뢰인에게 적합한 탕감 솔루션 및 비용 제안서를 먼저 작성해 발송하세요.',
        badge: '제안서 대기',
        isUrgent: true,
      });
    }

    // 3. 연락처 공유 완료 & 계약 미체결 상태
    if (isContactShared && !isContracted) {
      items.push({
        id: 'consult-contract',
        title: '유선 상담 및 수임계약 체결 필요',
        desc: '의뢰인이 연락처를 제공했습니다. 통화 상담 후 수임 계약을 진행하세요.',
        badge: '계약 대기',
        isUrgent: true,
      });
    }

    // 4. 보정 단계 시 개시결정 미등록 상태
    if (pipelineStage === 5 && !crmExt?.courtCase?.commencementDate) {
      items.push({
        id: 'correction-commence',
        title: '법원 보정권고 대응 및 개시결정 확인',
        desc: '보정기한 내 소명서를 제출하고, 법원 개시결정 통지 시 사건 정보를 등록하세요.',
        badge: '법원 진행',
      });
    }

    return items;
  }, [crmExt, hasProposalSent, isContracted, isContactShared, pipelineStage]);

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
    setUploadProgressText('녹음 파일 처리 중 (드라이브 업로드 · AI 대화록)...');

    try {
      const driveRes = await uploadRecordingToDrive(file, crmExt.googleDriveConfig, activeLawyer.email);
      const newRec: RecordingItem = {
        id: `rec-${Date.now()}`,
        filename: file.name,
        url: driveRes.url,
        driveFileId: driveRes.driveFileId,
        uploadDate: new Date().toISOString(),
        duration: 0,
      } as RecordingItem;
      const uploaded = driveRes.status === 'success';

      // AI 대화록은 별도로 시도 — 실패해도 업로드된 녹음은 저장 (이전: AI 실패 시 드라이브 파일이 기록 없이 남음)
      let aiRes: string | null = null;
      let aiError = '';
      try {
        aiRes = await generateAiCallSummary(file, {
          customerName: clientName,
          phone: clientRequest.phone,
          managerName: activeLawyer.name,
          caseType: crmExt.caseType === 'bankruptcy' ? '개인파산·면책' : '개인회생'
        });
      } catch (aiErr: any) {
        aiError = aiErr?.message || 'AI 대화록 생성 실패';
      }

      if (uploaded || aiRes) {
        const updated: CrmClientExtension = {
          ...crmExt,
          recordings: uploaded ? [newRec, ...(crmExt.recordings || [])] : (crmExt.recordings || []),
          ...(aiRes ? { aiSummary: aiRes } : {}),
          lastActivityAt: new Date().toISOString()
        };
        if (onUpdateExt) onUpdateExt(updated);
      }
      if (uploaded) setPlayingRecording(newRec);

      const driveMsg = uploaded ? '녹음 파일을 구글 드라이브에 저장했습니다' :
        driveRes.status === 'not_configured' ? '구글 드라이브 연동이 설정되지 않아 녹음 파일은 저장되지 않았습니다' :
        '구글 드라이브 업로드에 실패해 녹음 파일은 저장되지 않았습니다';
      const aiMsg = aiRes ? 'AI 대화록을 작성했습니다' : `AI 대화록은 작성하지 못했습니다 (${aiError})`;
      if (uploaded && aiRes) toast.success(`${driveMsg}. ${aiMsg}.`);
      else if (uploaded || aiRes) toast.warning(`${driveMsg}. ${aiMsg}.`);
      else toast.error(`${driveMsg}. ${aiMsg}.`);
    } catch (err: any) {
      console.error(err);
      toast.error(`녹취 처리 실패: ${err.message || '오류 발생'}`);
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
                <span className="text-xs px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                  익명 보호
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
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
            <span className="text-xs">닫기</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── 소통 상태 게이트 배너 (Gate Banner) ── */}
      <div className={`px-3.5 py-2 text-xs font-bold flex items-center gap-2 border-b transition-all ${
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
            <span className="text-xs text-slate-400 flex items-center gap-0.5" title="제안서 확인 후 고객 동의 시 공개">
              <Lock className="w-2.5 h-2.5" />
              미공개
            </span>
          )}
        </div>

        {isContactShared ? (
          <a
            href={`tel:${cleanPhone}`}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
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
            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-500 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="고객 제안서 확인 후 통화 가능"
          >
            <Lock className="w-3 h-3 text-slate-400" />
            <span>전화 걸기</span>
          </button>
        )}
      </div>

      {/* 4대 탭 바 (처리 필요 / 요청 현황 / 전체 타임라인 / 통화 메모) */}
      <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1 text-xs font-bold">
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
          {actionItems.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
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
            <span className="text-xs bg-purple-100 text-purple-700 px-1 py-0.2 rounded-full font-bold">
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
            {actionItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500/80" />
                <p className="font-bold text-slate-700 text-xs">현재 대기 중인 처리 요청이 없습니다</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  새로운 서류 제출, 의뢰인 문의, 단계별 할 일이 발생하면 이곳에 표시됩니다.
                </p>
              </div>
            ) : (
              actionItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border space-y-1.5 ${
                    item.isUrgent
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : 'bg-blue-50/80 border-blue-200 text-blue-950'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.isUrgent ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                      <span className="truncate text-xs">{item.title}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          item.isUrgent
                            ? 'bg-amber-200/80 text-amber-900'
                            : 'bg-blue-200/80 text-blue-900'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* 탭 2: 요청 현황 (Active Tasks) */}
        {activeTab === 'active_requests' && (
          <div className="space-y-3">
            {/* 서류 현황 카드 */}
            {(() => {
              const allDocs = (crmExt?.stage3DocsState as any)?.customDocs || crmExt?.documents || [];
              const submittedDocs = allDocs.filter((d: any) => d.status === 'submitted' || d.status === 'approved' || d.fileUrl);
              const totalCount = allDocs.length || 0;
              const percent = totalCount > 0 ? Math.round((submittedDocs.length / totalCount) * 100) : 0;

              return (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      {totalCount > 0 ? `필수 서류 제출 현황 (${totalCount}종)` : '필수 서류 요청'}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                      percent === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {percent === 100 ? '완료' : totalCount > 0 ? `${percent}%` : '준비'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {totalCount > 0
                      ? `제출/승인: ${submittedDocs.length}/${totalCount}건`
                      : '3단계에서 관공서 필수 서류 발급 안내를 요청할 수 있습니다.'}
                  </p>
                  {totalCount > 0 && (
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                  {totalCount > 0 && percent < 100 && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenSendModal({
                            title: '미제출 서류 제출 재촉 리마인더',
                            desc: '법원 접수 지연 방지를 위한 서류 신속 제출 독촉',
                            emoji: '📑',
                            message: `[서류 제출 안내] ${clientName}님, 법원 접수를 위한 필수 서류 중 아직 미제출된 항목이 남아있습니다.\n\n서류 제출이 완료되어야 법원 접수 및 금지명령 신청을 신속히 진행할 수 있습니다. 스마트폰으로 서류를 촬영하여 모바일 서류함에 업로드해 주시기 바랍니다.`,
                          });
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>서류 안내 알림 발송 ➔</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 전자계약 현황 카드 */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">전자 수임계약</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                  isContracted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {isContracted ? '체결 완료' : '미체결'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isContracted
                  ? (crmExt?.contractDate ? `${crmExt.contractDate} 계약 체결됨` : '정식 위임계약 체결 완료')
                  : 'Stage 02에서 전자계약서 작성 및 발송을 진행하세요.'}
              </p>
            </div>
          </div>
        )}

        {/* 탭 3: 전체 타임라인 (Timeline) */}
        {activeTab === 'timeline' && (
          <div className="space-y-2.5">
            {(() => {
              const notes = (crmExt?.notes || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              if (notes.length === 0) {
                return (
                  <div className="p-6 text-center text-slate-400 space-y-1.5">
                    <History className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">등록된 활동 타임라인이 없습니다</p>
                    <p className="text-xs text-slate-400">통화 메모나 상태 변경 이력이 발생하면 여기에 기록됩니다.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                  {notes.slice(0, 10).map((note) => (
                    <div key={note.id} className="text-xs space-y-0.5">
                      <div className="text-slate-400 text-xs flex items-center gap-1.5">
                        <span>{note.createdAt ? note.createdAt.slice(0, 16).replace('T', ' ') : ''}</span>
                        {note.authorName && <span className="font-bold text-slate-600">({note.authorName})</span>}
                      </div>
                      <div className="font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 탭 4: 통화·AI 분석 & 상담 메모 (Calls) */}
        {activeTab === 'calls' && (
          <div className="space-y-3">
            {/* 1. 빠른 통화 실행 & 녹음 업로드 버튼 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!clientRequest.phone) {
                    toast.error('연락처가 등록되어 있지 않습니다.');
                    return;
                  }
                  const r = await enqueueCall(clientRequest.phone, clientName);
                  if (r.success) toast.success(`${clientName}님께 스마트폰 다이얼러 호출 요청을 보냈습니다.`);
                  else toast.error(r.message);
                }}
                className="py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer press-scale"
                title="스마트폰으로 즉시 전화 걸기"
              >
                <Phone size={13} className="text-blue-600" />
                <span>스마트폰 통화</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTranscribing}
                className="py-2 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer press-scale disabled:opacity-50"
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
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 text-purple-800 text-xs font-bold animate-pulse">
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
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                    <FileAudio size={12} className="text-purple-600" />
                    <span>보관된 녹취 ({crmExt.recordings?.length}건)</span>
                  </span>
                  <span className="text-xs text-slate-400">구글 드라이브</span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {crmExt.recordings?.slice(0, 5).map((rec) => (
                    <div key={rec.id} className="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                      <span className="truncate max-w-[150px] font-medium text-slate-700">{rec.filename}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPlayingRecording(rec)}
                          className="px-1.5 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-xs font-bold cursor-pointer"
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
                className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText size={12} className="text-blue-600" />
                <span>AI 요약 특이사항을 사건 메모로 등록</span>
              </button>
            )}

            {/* 2. 빠른 통화 내용 수동 기록 폼 */}
            <form onSubmit={handleSaveMemo} className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">통화 내용 직접 메모</span>
                <select
                  value={callDuration}
                  onChange={e => setCallDuration(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-600"
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
              <span className="text-xs font-bold text-slate-700">이전 상담 메모 ({crmExt.notes.length})</span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {crmExt.notes.slice(-4).reverse().map(n => (
                  <div key={n.id} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                    <div className="flex justify-between text-xs text-slate-400 mb-0.5">
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
            <span className="text-xs text-slate-400 font-medium">
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
                <p className="text-xs text-slate-500 line-clamp-1">{tpl.desc}</p>
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
          firmName={activeLawyer.firmName || activeLawyer.firm || '법무법인'}
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
