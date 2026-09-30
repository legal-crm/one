import React, { useState } from 'react';
import { FileText, CheckCircle2, ChevronDown, Mic, Send, Calculator, Layers, ClipboardList } from 'lucide-react';
import LawyerDocShareModal from './LawyerDocShareModal';
import type { SharedDocPackageItem } from '../../services/lawyerDocShareService';
import { Badge, Button, Callout, Modal } from './ui';
import { cn } from '../../utils/cn';

interface Fast2ndDocHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientId?: string;
  hasStatement?: boolean;
  hasIncomeExpense?: boolean;
  hasProperty?: boolean;
  statementData?: any;
  incomeExpenseData?: any;
  propertySummary?: any;
  debtSummary?: any;
  onOpenStatementModal: () => void;
  onOpenIncomeExpenseModal: () => void;
  onOpenPropertyModal: () => void;
}

interface DocCardInfo {
  id: 'stmt' | 'inc' | 'prop';
  title: string;
  formCode: string;
  summary: string;
  done: boolean;
  icon: React.ReactNode;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onOpen: () => void;
  why: string;
  how: string;
}

/**
 * 서류 준비 허브 — 진술서·수지표·재산 기초자료를 한곳에서 작성하고 담당자에게 링크로 보낸다.
 * 각 서류 창은 부모가 이 허브 위에 연다(나중에 열린 창이 위).
 */
export default function Fast2ndDocHubModal({
  isOpen,
  onClose,
  clientName = '신청인',
  clientId = 'client-self',
  // 작성 여부는 실제 데이터로만 판단 (기본값을 '완료'로 두지 않음)
  hasStatement = false,
  hasIncomeExpense = false,
  hasProperty = false,
  statementData,
  incomeExpenseData,
  propertySummary,
  debtSummary,
  onOpenStatementModal,
  onOpenIncomeExpenseModal,
  onOpenPropertyModal
}: Fast2ndDocHubModalProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [expandedWhyHow, setExpandedWhyHow] = useState<string | null>(null);

  if (!isOpen) return null;

  // 전체 완성도 계산
  const completedCount = (hasStatement ? 1 : 0) + (hasIncomeExpense ? 1 : 0) + (hasProperty ? 1 : 0);
  const totalCount = 3;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const docPackage: SharedDocPackageItem = {
    hasStatement,
    statementData,
    hasIncomeExpense,
    incomeExpenseData,
    hasProperty,
    // 실제 데이터가 없으면 공유 패키지에 가짜 요약 수치를 넣지 않는다
    propertySummary: propertySummary || null,
    hasDebtSummary: !!debtSummary,
    debtSummary: debtSummary || null
  };

  const cards: DocCardInfo[] = [
    {
      id: 'stmt',
      title: '진술서',
      formCode: 'D5104',
      summary: '학력·경력, 주거, 채무가 늘어난 경위, 갚기 어려워진 사정, 앞으로의 다짐',
      done: hasStatement,
      icon: <Mic className="w-5 h-5" aria-hidden="true" />,
      actionLabel: hasStatement ? '이어서 고치기' : '말로 작성하기',
      actionIcon: <Mic className="w-4 h-4" aria-hidden="true" />,
      onOpen: onOpenStatementModal,
      why: '진술서는 채무가 생긴 경위를 신청인이 직접 설명하는 서류입니다. 법원과 회생위원은 진술서와 증빙을 함께 보고 채무 발생 경위를 확인합니다.',
      how: '질문에 말로 답하거나 메모로 적으면, AI가 진술서에 흔히 쓰는 순서(채무 발생 원인 → 늘어난 경위 → 갚기 어려워진 시점 → 반성과 다짐)로 초안을 정리합니다. 초안이 사실과 맞는지 꼭 확인해 주세요.',
    },
    {
      id: 'inc',
      title: '수입·지출 내역서(수지표)',
      formCode: 'D5103',
      summary: '사업자·프리랜서·일용직이라면 필요해요. 한 달 평균 수입과 필요한 경비',
      done: hasIncomeExpense,
      icon: <Calculator className="w-5 h-5" aria-hidden="true" />,
      actionLabel: hasIncomeExpense ? '이어서 고치기' : '작성하기',
      actionIcon: <Calculator className="w-4 h-4" aria-hidden="true" />,
      onOpen: onOpenIncomeExpenseModal,
      why: '수지표는 매달 갚을 돈(월 변제금)을 정할 때 쓰이는 서류입니다. 사업을 한다면 매출에서 월세·배달료·재료비 같은 영업 경비를 증빙과 함께 적어야 실제 소득이 제대로 반영됩니다.',
      how: '12개월 표를 몰라도 괜찮아요. 한 달 평균 매출과 경비를 적거나 말로 입력하면 12개월 표로 정리됩니다. 반영하기 전에 금액을 꼭 확인해 주세요.',
    },
    {
      id: 'prop',
      title: '재산 기초자료',
      formCode: 'D5102',
      summary: '예금·보험 해약환급금, 자동차, 임차보증금, 부동산 등 가진 재산',
      done: hasProperty,
      icon: <ClipboardList className="w-5 h-5" aria-hidden="true" />,
      actionLabel: hasProperty ? '이어서 고치기' : '작성하기',
      actionIcon: <FileText className="w-4 h-4" aria-hidden="true" />,
      onOpen: onOpenPropertyModal,
      why: '개인회생에서는 갚을 돈의 합계가 가진 재산의 가치(청산가치)보다 적으면 안 됩니다. 재산 기초자료는 이를 확인하는 자료이고, 소액 보증금처럼 빼 주는 재산은 담당 변호사가 검토해 반영합니다.',
      how: '통장 잔액, 자동차, 보증금 등을 항목별로 적으면 법원 양식 모양의 재산 목록으로 정리됩니다.',
    },
  ];

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        size="lg"
        mobile="fullscreen"
        className="sm:max-w-3xl"
        icon={<Layers className="w-5 h-5" />}
        title="회생 서류 한곳에서 준비하기"
        description="진술서·수지표·재산 기초자료를 작성하고 담당자에게 링크로 보낼 수 있어요."
        closeLabel="서류 준비 닫기"
        bodyClassName="bg-slate-50 px-4 py-5 sm:px-6"
        subHeader={
          <div className="bg-white px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-800">준비한 서류</span>
              <span className="font-bold text-brand tabular-nums">
                {completedCount}/{totalCount}건
              </span>
            </div>
            <div
              className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-label="서류 준비 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            >
              <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        }
        footerClassName="justify-between"
        footer={
          <>
            <p className="hidden sm:block text-sm text-slate-600">다 쓴 서류를 담당자 휴대폰 번호로 보낼 수 있어요.</p>
            <Button
              onClick={() => setIsShareModalOpen(true)}
              leftIcon={<Send className="w-4 h-4" aria-hidden="true" />}
              className="flex-1 sm:flex-none"
            >
              변호사·사무소에 보내기
            </Button>
          </>
        }
      >
        <ul className="space-y-3">
          {cards.map(card => {
            const open = expandedWhyHow === card.id;
            const panelId = `doc-hub-why-${card.id}`;
            return (
              <li key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                      {card.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
                        <span className="text-xs text-slate-500">법원 양식 {card.formCode}</span>
                        {card.done ? (
                          <Badge tone="success" icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}>작성 완료</Badge>
                        ) : (
                          <Badge tone="warning">작성 전</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">{card.summary}</p>
                    </div>
                  </div>
                  <Button
                    variant={card.done ? 'secondary' : 'primary'}
                    onClick={card.onOpen}
                    leftIcon={card.actionIcon}
                    className="w-full sm:w-auto shrink-0"
                  >
                    {card.actionLabel}
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedWhyHow(open ? null : card.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="min-h-11 inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-brand"
                >
                  왜 필요하고 어떻게 쓰나요?
                  <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                </button>
                {open && (
                  <div id={panelId} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 text-sm leading-relaxed">
                    <div>
                      <p className="font-bold text-slate-900">왜 필요한가요?</p>
                      <p className="mt-0.5 text-slate-700 break-keep">{card.why}</p>
                    </div>
                    <div className="pt-2.5 border-t border-slate-200">
                      <p className="font-bold text-slate-900">어떻게 쓰나요?</p>
                      <p className="mt-0.5 text-slate-700 break-keep">{card.how}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <Callout tone="neutral" className="mt-4">
          서류는 모두 초안이고, 법원에 내는 최종본은 담당 변호사가 검토해 확정합니다. 다른 사무소에서 진행 중이거나 직접 준비하는 분도 이용할 수 있어요.
        </Callout>
      </Modal>

      {/* 변호사·사무소 직원에게 보내기 — 허브 위에 뜨는 창 */}
      {isShareModalOpen && (
        <LawyerDocShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          clientId={clientId}
          clientName={clientName}
          docPackage={docPackage}
        />
      )}
    </>
  );
}
