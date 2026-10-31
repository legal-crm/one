import React, { useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronDown, Download, FileText, HelpCircle, MessageSquare, Phone, Scale, User, X, Users,
} from 'lucide-react';
import { ProposalLegalDisclaimer } from '../../Disclaimers';
import { TermHint, GlossaryList } from '../TermHint';
import {
  EMPLOYMENT_LABEL, HOUSING_LABEL, formatKoDate, proposalCostRows, proposalFaqs, proposalGlossaryKeys,
  proposalPrepDocs, proposalTimeline, proposalValidity,
  type ProposalInputSummary, type ProposalProcedure,
} from '../../../services/proposal/clientProposalModel';

// ============================================================
// 변호사 검토 제안서 — 의뢰인 화면 (B-5c·B-5d)
// 휴대폰 우선 한 줄 스크롤: 요약 → 계산 근거 → 내 정보 → 변호사 의견 → 비용 → 일정 → 준비 서류
// → 질문과 답 → 계약 전 확인 → 다음 할 일. 본문 16px(휴대폰)·최소 14px, 버튼 44px.
// 일반·상세 분석 제안서를 이 한 화면으로 보여 주고, 상세 분석은 '계산 근거' 칸이 늘어난다.
// 감면율·감면액은 보여 주지 않는다(RP-Q1). 숫자는 변호사가 보낸 값만 쓴다(재계산 금지, B-5a).
// ============================================================

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const manWon = (n: number) => {
  const m = Math.round(n / 10000);
  return m > 0 ? `${m.toLocaleString('ko-KR')}만 원` : won(n);
};

export interface ClientProposalReportProps {
  procedure: ProposalProcedure;
  lawyerName: string;
  lawyerFirmName?: string;
  lawyerAvatar?: string;
  lawyerPhone?: string;
  courtName: string;
  isCourtKnown: boolean;
  issuedAt?: string;
  validDays?: number;
  expiresAt?: string;
  totalDebtWon: number;
  monthlyPaymentWon: number;
  months: number;
  totalRepaymentWon: number;
  input: ProposalInputSummary;
  /** 변호사가 작성한 소견 (없으면 빈 문자열) */
  lawyerComment: string;
  specialNotes: string[];
  clientQnA: Array<{ question: string; answer: string }>;
  fees: {
    totalFeeWon: number;
    downPaymentWon: number;
    installments: number;
    monthlyInstallmentWon: number;
    courtDepositWon: number;
    notice?: string;
  };
  /** 상세 분석 제안서 — 계산 근거 줄 */
  analysisRows?: Array<{ label: string; value: string; termKey?: string }>;
  /** 질문과 답 상황 판단용 원본 입력 */
  faqInput?: any;
  isContractDone: boolean;
  /** 계약 진행 버튼을 보여 줄지 (의뢰인 화면에서만) */
  canAccept: boolean;
  onAccept?: () => void;
  onAskLawyer?: (text: string) => void;
  onExportPdf?: () => void;
  isGeneratingPdf?: boolean;
  onClose?: () => void;
  /** 변호사 미리보기 — 버튼은 보이되 동작하지 않는다 */
  preview?: boolean;
}

function Section({ id, title, children, termKey }: { id: string; title: string; children: React.ReactNode; termKey?: string }) {
  return (
    <section aria-labelledby={id} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
      <h3 id={id} className="text-base sm:text-lg font-bold text-slate-900">
        {termKey ? <TermHint termKey={termKey}>{title}</TermHint> : title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value, termKey, strong }: { label: string; value: string; termKey?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <dt className="text-sm sm:text-[15px] text-slate-600 min-w-0">{termKey ? <TermHint termKey={termKey}>{label}</TermHint> : label}</dt>
      <dd className={`text-base text-right shrink-0 max-w-[60%] break-keep ${strong ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{value}</dd>
    </div>
  );
}

export default function ClientProposalReport(p: ClientProposalReportProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);
  const [correction, setCorrection] = useState('');
  const isRehab = p.procedure === 'rehab';
  const validity = proposalValidity(p.issuedAt, p.validDays, p.expiresAt);
  const costRows = useMemo(() => proposalCostRows({ procedure: p.procedure, courtName: p.isCourtKnown ? p.courtName : '', creditorCount: p.input.creditorCount }), [p.procedure, p.courtName, p.isCourtKnown, p.input.creditorCount]);
  const timeline = useMemo(() => proposalTimeline(p.procedure, p.months), [p.procedure, p.months]);
  const docs = useMemo(() => proposalPrepDocs(p.procedure, p.input), [p.procedure, p.input]);
  const faqs = useMemo(() => proposalFaqs(p.procedure, p.faqInput || {}), [p.procedure, p.faqInput]);
  const hasPayment = isRehab && p.monthlyPaymentWon > 0 && p.months > 0;
  const feeKnown = p.fees.totalFeeWon > 0;
  const ask = (text: string) => { if (!p.preview && p.onAskLawyer) p.onAskLawyer(text); };

  const infoRows: Array<{ label: string; value: string }> = [];
  const s = p.input;
  if (s.familySize) infoRows.push({ label: '가구원 수(본인 포함)', value: `${s.familySize}명` });
  if (s.minorChildren !== undefined) infoRows.push({ label: '미성년 자녀', value: `${s.minorChildren}명` });
  if (s.employmentType) infoRows.push({ label: '소득 형태', value: EMPLOYMENT_LABEL[s.employmentType] || s.employmentType });
  if (s.monthlyIncomeWon) infoRows.push({ label: '월 소득(세후)', value: manWon(s.monthlyIncomeWon) });
  if (s.housingType) infoRows.push({ label: '주거', value: HOUSING_LABEL[s.housingType] || s.housingType });
  if (s.depositWon) infoRows.push({ label: '보증금', value: manWon(s.depositWon) });
  if (s.rentWon) infoRows.push({ label: '월세', value: manWon(s.rentWon) });
  const debtWon = s.totalDebtWon || p.totalDebtWon;
  if (debtWon) infoRows.push({ label: '총 채무', value: manWon(debtWon) });
  if (s.priorityDebtWon) infoRows.push({ label: '세금·보험료 체납', value: manWon(s.priorityDebtWon) });
  if (s.creditorCount) infoRows.push({ label: '채권자 수', value: `${s.creditorCount}곳` });

  return (
    <div className="bg-slate-50 text-slate-900 text-base">
      {/* 머리 */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-start gap-3">
        {p.lawyerAvatar ? (
          <img src={p.lawyerAvatar} alt="" className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"><User className="w-6 h-6 text-slate-500" aria-hidden="true" /></div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-600">변호사 검토 제안서{p.analysisRows && p.analysisRows.length > 0 ? ' · 상세 분석 포함' : ''}</p>
          <h2 id="report-modal-title" className="text-lg sm:text-xl font-bold text-slate-900 break-keep">
            {p.lawyerName} 변호사{p.lawyerFirmName ? ` · ${p.lawyerFirmName}` : ''}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {isRehab ? '개인회생' : '개인파산·면책'} · {p.courtName}
            {p.issuedAt ? ` · ${formatKoDate(p.issuedAt)} 발송` : ''}
          </p>
        </div>
        {p.onClose && (
          <button type="button" onClick={p.onClose} aria-label="닫기" className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-[0.98] shrink-0">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-3 sm:px-6 py-4 space-y-4 max-w-3xl mx-auto">
        {/* 유효기간 */}
        {validity.expiresAt && (
          <div role="status" className={`rounded-xl px-4 py-3 text-sm sm:text-[15px] border ${validity.expired ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-slate-200 text-slate-700'}`}>
            {validity.expired
              ? `이 제안서의 유효기간(${formatKoDate(validity.expiresAt)}까지)이 지났어요. 계약하려면 변호사에게 다시 확인해 주세요.`
              : `이 제안서는 ${formatKoDate(validity.expiresAt)}까지 유효해요${validity.daysLeft !== null ? ` (${Math.max(0, validity.daysLeft)}일 남음)` : ''}. 그 뒤에는 조건이 달라질 수 있어요.`}
          </div>
        )}

        {/* 1. 요약 */}
        <Section id="sec-summary" title="요약">
          {isRehab ? (
            hasPayment ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-slate-900 text-white p-4">
                  <p className="text-sm text-slate-300"><TermHint termKey="monthlyPayment">월 변제금(예상)</TermHint></p>
                  <p className="text-2xl font-bold mt-1">{won(p.monthlyPaymentWon)}</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-4">
                  <p className="text-sm text-slate-600"><TermHint termKey="repaymentPeriod">변제기간</TermHint></p>
                  <p className="text-2xl font-bold mt-1 text-slate-900">{p.months}개월</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">총 변제액(예상)</p>
                  <p className="text-2xl font-bold mt-1 text-slate-900">{manWon(p.totalRepaymentWon)}</p>
                </div>
              </div>
            ) : (
              <p className="text-base text-slate-700">변호사가 아직 변제 조건을 정하지 않았어요. 질문하기로 확인해 주세요.</p>
            )
          ) : (
            <p className="text-base text-slate-700 leading-relaxed">
              개인파산·면책 신청을 검토한 제안서예요. 파산은 매달 갚는 금액이 없고, 법원이 지급불능 여부와 면책 여부를 정해요.
            </p>
          )}
          <p className="text-sm text-slate-600 leading-relaxed">
            지금 받은 자료로 변호사가 검토한 예상이에요. 서류 확인과 법원 심리에 따라 달라질 수 있고, 최종 결정은 법원이 해요.
          </p>
        </Section>

        {/* 2. 계산 근거 */}
        {isRehab && hasPayment && (
          <Section id="sec-basis" title="이렇게 계산했어요">
            <ol className="space-y-2 text-base text-slate-800 leading-relaxed list-decimal pl-5">
              <li>월 소득에서 법원이 인정하는 <TermHint termKey="livingCost">생계비</TermHint>를 빼서 <TermHint termKey="disposableIncome">가용소득</TermHint>을 구해요.</li>
              <li>가용소득을 기준으로 월 변제금을 정하고, 총 변제액이 <TermHint termKey="liquidationValue">청산가치</TermHint>보다 적지 않은지 확인해요.</li>
              <li><TermHint termKey="priorityClaim">우선채권</TermHint>이 있으면 앞쪽에서 먼저 갚도록 기간을 정해요.</li>
            </ol>
            {p.analysisRows && p.analysisRows.length > 0 && (
              <dl className="mt-1">
                {p.analysisRows.map(r => <Row key={r.label} label={r.label} value={r.value} termKey={r.termKey} />)}
              </dl>
            )}
          </Section>
        )}

        {/* 3. 내 정보 + 정정 */}
        <Section id="sec-info" title="계산에 쓴 내 정보">
          {infoRows.length > 0 ? (
            <dl>{infoRows.map(r => <Row key={r.label} label={r.label} value={r.value} />)}</dl>
          ) : (
            <p className="text-base text-slate-700">정리해 주신 자료 요약이 이 제안서에 저장되지 않았어요. 변호사에게 어떤 자료로 검토했는지 물어볼 수 있어요.</p>
          )}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <label htmlFor="proposal-correction" className="block text-sm sm:text-[15px] font-bold text-slate-900">사실과 다른 정보가 있나요?</label>
            <textarea
              id="proposal-correction"
              value={correction}
              onChange={e => setCorrection(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="예: 가구원 수가 3명이에요 / 월 소득이 지난달부터 줄었어요"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="button"
              disabled={!correction.trim() || p.preview || !p.onAskLawyer}
              onClick={() => { ask(`[제안서 정보 정정] ${correction.trim()}`); setCorrection(''); }}
              className="min-h-[44px] w-full sm:w-auto px-4 rounded-xl bg-slate-900 text-white text-sm sm:text-base font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]"
            >
              변호사에게 알리기
            </button>
            {!p.onAskLawyer && !p.preview && <p className="text-sm text-slate-600">상담방에서 이 변호사에게 메시지로 알려 주세요.</p>}
          </div>
        </Section>

        {/* 4. 변호사 의견 */}
        <Section id="sec-opinion" title="변호사 의견">
          {p.lawyerComment ? (
            <p className="text-base text-slate-800 leading-relaxed whitespace-pre-line">{p.lawyerComment}</p>
          ) : (
            <p className="text-base text-slate-600">변호사가 아직 의견을 작성하지 않았어요.</p>
          )}
          {p.specialNotes.length > 0 && (
            <div className="pt-1">
              <p className="text-sm font-bold text-slate-900 mb-1.5">함께 확인할 점</p>
              <ul className="space-y-1.5 list-disc pl-5 text-base text-slate-800 leading-relaxed">
                {p.specialNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {/* 5. 비용 */}
        <Section id="sec-cost" title="비용">
          <p className="text-sm font-bold text-slate-900">변호사 수임료</p>
          {feeKnown ? (
            <dl>
              <Row label="총 수임료" value={won(p.fees.totalFeeWon)} strong />
              {p.fees.downPaymentWon > 0 && <Row label="착수금" value={won(p.fees.downPaymentWon)} />}
              {p.fees.installments > 1 && p.fees.monthlyInstallmentWon > 0 && (
                <Row label="나머지 분납" value={`${p.fees.installments}회 × ${won(p.fees.monthlyInstallmentWon)}`} />
              )}
            </dl>
          ) : (
            <p className="text-base text-slate-700">수임료는 변호사와 협의해 정해요.</p>
          )}
          {p.fees.notice && <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">{p.fees.notice}</p>}
          <p className="text-sm font-bold text-slate-900 pt-2">법원에 내는 실비 (수임료와 별도)</p>
          <dl>
            {costRows.map(r => (
              <div key={r.label} className="py-2 border-b border-slate-100 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-sm sm:text-[15px] text-slate-700">{r.termKey ? <TermHint termKey={r.termKey}>{r.label}</TermHint> : r.label}</dt>
                  <dd className="text-base font-semibold text-slate-900 shrink-0">{r.amountWon !== null ? won(r.amountWon) : '정해지면 안내'}</dd>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mt-0.5">{r.note}</p>
              </div>
            ))}
            {p.fees.courtDepositWon > 0 && (
              <Row label="변호사가 적은 예납·실비" value={won(p.fees.courtDepositWon)} />
            )}
          </dl>
          <p className="text-sm text-slate-600">실비 금액은 2026년 7월 송달료 기준이며, 법원 안내에 따라 달라질 수 있어요.</p>
        </Section>

        {/* 6. 일정 */}
        <Section id="sec-timeline" title="진행 순서">
          <ol className="relative border-l-2 border-slate-200 ml-2 space-y-3">
            {timeline.map((t, i) => (
              <li key={i} className="relative pl-4">
                <span className="absolute -left-[7px] top-0 mt-1.5 w-3 h-3 rounded-full bg-slate-900" aria-hidden="true" />
                <p className="text-base font-bold text-slate-900">{t.termKey ? <TermHint termKey={t.termKey}>{t.title}</TermHint> : t.title}</p>
                <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">{t.detail}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-slate-600">단계마다 걸리는 기간은 법원과 사건마다 달라요.</p>
        </Section>

        {/* 7. 준비 서류 */}
        <Section id="sec-docs" title="준비할 서류(대표 목록)">
          <ul className="space-y-1.5 text-base text-slate-800">
            {docs.map(d => (
              <li key={d} className="flex items-start gap-2"><FileText className="w-4 h-4 mt-1 text-slate-500 shrink-0" aria-hidden="true" />{d}</li>
            ))}
          </ul>
          <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
            계약 뒤에는 사무소가 이 사건에 맞는 서류를 &lsquo;내 사건 › 할 일&rsquo;에서 하나씩 요청해요. 미리 떼지 말고 안내를 기다려도 돼요(발급일 기준이 있어요).
          </p>
        </Section>

        {/* 8. 질문과 답 */}
        {(p.clientQnA.length > 0 || faqs.length > 0) && (
          <Section id="sec-faq" title="질문과 답">
            {p.clientQnA.filter(q => q.question).map((q, i) => (
              <div key={`qa-${i}`} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-600">내가 한 질문</p>
                <p className="text-base font-bold text-slate-900 mt-0.5">{q.question}</p>
                <p className="text-base text-slate-800 mt-1.5 leading-relaxed whitespace-pre-line">{q.answer || '변호사가 아직 답하지 않았어요.'}</p>
              </div>
            ))}
            <div className="divide-y divide-slate-100">
              {faqs.map((f, i) => (
                <div key={i}>
                  <button
                    type="button"
                    aria-expanded={openFaq === i}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full min-h-[44px] py-2.5 flex items-center justify-between gap-3 text-left active:scale-[0.99]"
                  >
                    <span className="text-base font-semibold text-slate-900">
                      {f.tag && <span className="mr-1.5 inline-block rounded-lg bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-xs font-bold text-slate-700 align-middle">{f.tag}</span>}
                      {f.q}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {openFaq === i && <p className="pb-3 text-base text-slate-700 leading-relaxed">{f.a}</p>}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-600">일반적인 설명이에요. 내 사건에 맞는 답은 변호사에게 물어봐 주세요.</p>
          </Section>
        )}

        {/* 용어 풀이 */}
        <section className="bg-white rounded-2xl border border-slate-200">
          <button
            type="button"
            aria-expanded={showGlossary}
            onClick={() => setShowGlossary(v => !v)}
            className="w-full min-h-[44px] px-4 sm:px-5 py-3 flex items-center justify-between text-left"
          >
            <span className="text-base font-bold text-slate-900 flex items-center gap-2"><HelpCircle className="w-5 h-5 text-slate-500" aria-hidden="true" />용어 풀이</span>
            <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${showGlossary ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showGlossary && <div className="px-4 sm:px-5 pb-3"><GlossaryList keys={proposalGlossaryKeys(p.procedure)} /></div>}
        </section>

        {/* 9. 계약 전 확인 */}
        <Section id="sec-check" title="계약 전에 확인해 주세요">
          <ul className="space-y-2 text-base text-slate-800 leading-relaxed">
            <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />{isRehab ? '월 변제금·기간은 예상이고, 법원이 최종으로 정해요.' : '파산선고·면책 여부는 법원이 정해요.'}</li>
            <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />수임료와 법원 실비는 따로 내요. 실비는 법원에 직접 내는 돈이에요.</li>
            <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />계약서의 수임료·분납·환불 조항을 꼭 읽어 보세요. 궁금하면 서명 전에 질문하세요.</li>
            <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />마이김변은 변호사를 추천·배정하지 않아요. 여러 제안을 비교하고 직접 고르세요.</li>
          </ul>
          <ProposalLegalDisclaimer />
        </Section>

        {/* 10. 다음 할 일 */}
        <Section id="sec-next" title="다음 할 일">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {p.onAskLawyer && (
              <button type="button" disabled={p.preview} onClick={() => ask('제안서를 보고 궁금한 점이 있어요: ')} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-slate-900 text-base font-bold flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98] disabled:opacity-60">
                <MessageSquare className="w-5 h-5" aria-hidden="true" />변호사에게 질문하기
              </button>
            )}
            {p.lawyerPhone && !p.preview && (
              <a href={`tel:${p.lawyerPhone}`} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-slate-900 text-base font-bold flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98]">
                <Phone className="w-5 h-5" aria-hidden="true" />전화하기
              </a>
            )}
            {p.onExportPdf && (
              <button type="button" disabled={p.isGeneratingPdf} onClick={p.onExportPdf} className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-slate-900 text-base font-bold flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98] disabled:opacity-60">
                {p.isGeneratingPdf ? <Download className="w-5 h-5 animate-pulse" aria-hidden="true" /> : <Users className="w-5 h-5" aria-hidden="true" />}
                가족과 보기(PDF 저장)
              </button>
            )}
            {p.canAccept && (
              p.isContractDone ? (
                <div role="status" className="min-h-[48px] rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-base font-bold flex items-center justify-center gap-2 whitespace-nowrap">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" aria-hidden="true" />계약이 끝난 상담이에요
                </div>
              ) : (
                <button type="button" disabled={p.preview || validity.expired} onClick={p.onAccept} className="min-h-[48px] rounded-xl bg-[#1E3A5F] hover:bg-[#162A45] text-white text-base font-bold flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98] disabled:opacity-60">
                  <Scale className="w-5 h-5" aria-hidden="true" />이 조건으로 계약 진행
                </button>
              )
            )}
          </div>
          {validity.expired && p.canAccept && !p.isContractDone && (
            <p className="text-sm text-amber-900">유효기간이 지나 계약 버튼을 막아 두었어요. 변호사에게 새 제안서를 요청해 주세요.</p>
          )}
          <p className="text-sm text-slate-600">상담 내용은 변호사법 제26조(비밀유지의무)에 따라 보호돼요.</p>
        </Section>
      </div>
    </div>
  );
}
