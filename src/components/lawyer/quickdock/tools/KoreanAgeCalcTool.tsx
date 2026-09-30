import React, { useState } from 'react';
import { CalendarCheck, AlertCircle, Baby, HeartHandshake, Briefcase } from 'lucide-react';
import { calculateKoreanAgeInfo } from '../../../../services/documents/familyParserService';
import { checkSpecial24Eligibility, COURTS_ALLOWING_24_MONTHS } from '../../../../services/repayment/rehabLegalCore';
import { localYmd, parseLocalYmd } from '../../../../utils/localDate';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';

type Subject = 'child' | 'parent' | 'debtor';

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'child', label: '자녀' },
  { value: 'parent', label: '부모' },
  { value: 'debtor', label: '채무자 본인' },
];

const COURTS_24_LABEL = COURTS_ALLOWING_24_MONTHS.map(c => c.replace('회생법원', '')).join('·') + '회생법원';

/** 기준일부터 target까지 남은 개월 수 (지났으면 0) */
function monthsUntil(target: Date, base: Date): number {
  let months = (target.getFullYear() - base.getFullYear()) * 12 + (target.getMonth() - base.getMonth());
  if (target.getDate() < base.getDate()) months -= 1;
  return Math.max(0, months);
}

function addYears(d: Date, years: number): Date {
  return new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
}

/**
 * 만나이 & 부양자격 판정
 * - 나이 분류는 가족관계 서류 파서(calculateKoreanAgeInfo)와 같은 기준:
 *   만 19세 미만 미성년 / 만 19~20세 성년 자녀(서울회생법원 소명 대상) / 만 21세 이상 / 만 65세 이상
 * - 24개월 단축 특례는 rehabLegalCore.checkSpecial24Eligibility와 같은 기준(만 30세 미만·고령자, 운영 법원 한정)
 * - 생년월일은 저장하지 않는다.
 */
export default function KoreanAgeCalcTool() {
  const [subject, setSubject] = useState<Subject>('child');
  const [birthInput, setBirthInput] = useState('');
  const [baseDate, setBaseDate] = useState(() => localYmd());
  const { copied, copy } = useCopyFeedback();

  const base = parseLocalYmd(baseDate) || new Date();
  const info = calculateKoreanAgeInfo(birthInput.trim(), base);

  // 파서가 통과시킨 값도 실제 달력 날짜인지(예: 2월 31일) 한 번 더 확인
  let birth: Date | null = null;
  if (info.birthDateFormatted) {
    const [y, m, d] = info.birthDateFormatted.split('.').map(Number);
    const candidate = new Date(y, m - 1, d);
    if (candidate.getFullYear() === y && candidate.getMonth() === m - 1 && candidate.getDate() === d && candidate <= base) {
      birth = candidate;
    }
  }

  const fullAge = info.fullAge;
  const yearAge = birth ? base.getFullYear() - birth.getFullYear() : 0;
  const birthdayPassed = birth
    ? base.getMonth() > birth.getMonth() || (base.getMonth() === birth.getMonth() && base.getDate() >= birth.getDate())
    : false;
  const nextBirthday = birth
    ? new Date(base.getFullYear() + (birthdayPassed ? 1 : 0), birth.getMonth(), birth.getDate())
    : null;
  const nextBirthdayDday = nextBirthday ? Math.round((nextBirthday.getTime() - base.getTime()) / 86_400_000) : 0;

  const special24 = checkSpecial24Eligibility({ courtAllows24: true, age: fullAge, elderly: fullAge >= 65 });
  const monthsTo19 = birth ? monthsUntil(addYears(birth, 19), base) : 0;
  const monthsTo21 = birth ? monthsUntil(addYears(birth, 21), base) : 0;
  const monthsTo65 = birth ? monthsUntil(addYears(birth, 65), base) : 0;
  const turns30 = birth ? localYmd(addYears(birth, 30)) : '';

  // ── 대상별 판정 문구 ──
  let verdictTitle = '';
  let verdictBody = '';
  let verdictTone: 'good' | 'check' | 'neutral' = 'neutral';

  if (birth) {
    if (subject === 'child') {
      if (fullAge < 19) {
        verdictTone = 'good';
        verdictTitle = '미성년 자녀 — 부양가족 산정 대상 (원칙)';
        verdictBody = `만 19세까지 약 ${monthsTo19}개월 남았습니다.${
          monthsTo19 <= 60 ? ' 변제기간 중 성년이 되면 부양가족 수 변동을 변제계획에 반영할지 검토하세요.' : ''
        }`;
      } else if (fullAge <= 20) {
        verdictTone = 'check';
        verdictTitle = '성년 자녀 (만 19~20세) — 소명 시 인정 검토';
        verdictBody = `경제적으로 자립하지 못한 경우 서울회생법원 등에서 부양가족으로 인정한 기준이 있습니다. 재학·취업준비 사실을 소명하고 관할 법원 기준을 확인하세요. 만 21세까지 약 ${monthsTo21}개월.`;
      } else {
        verdictTone = 'neutral';
        verdictTitle = '성년 자녀 (만 21세 이상) — 원칙적으로 부양가족 제외';
        verdictBody = '중증 장애·질병 등으로 근로능력이 없음을 진단서 등으로 소명하면 예외적으로 검토될 수 있습니다.';
      }
    } else if (subject === 'parent') {
      if (fullAge >= 65) {
        verdictTone = 'good';
        verdictTitle = '만 65세 이상 부모 — 부양가족 산정 검토 대상';
        verdictBody = '소득·재산이 없음(지방세 세목별 과세증명서, 건강보험 자격)과 생활비 지원 사실을 소명하면 부양가족으로 검토될 수 있습니다.';
      } else {
        verdictTone = 'neutral';
        verdictTitle = '만 65세 미만 부모 — 근로능력이 있는 것으로 보는 경향';
        verdictBody = `중증 질환·장애 등 근로능력이 없다는 소명이 필요합니다. 만 65세까지 약 ${monthsTo65}개월.`;
      }
    } else {
      if (special24.eligible) {
        verdictTone = 'good';
        verdictTitle = `24개월 단축 특례 검토 대상 (${special24.reason})`;
        verdictBody = `플랫폼 기준 특례 운영 법원: ${COURTS_24_LABEL}. 소득·재산 요건과 재판부 기준을 확인하세요.${
          fullAge < 30 ? ` 만 30세가 되는 날: ${turns30}.` : ''
        }`;
      } else {
        verdictTone = 'neutral';
        verdictTitle = '연령 특례 비해당 — 기본 36개월';
        verdictBody = '기초생활수급자·중증장애인·한부모 가족·전세사기 피해자 등 다른 특례 요건을 확인하세요. 청산가치 보장 등 필요 시 최장 60개월.';
      }
    }
  }

  const handleCopy = () => {
    if (!birth) return;
    const subjectLabel = SUBJECTS.find(s => s.value === subject)?.label || '';
    const text = `[만나이 및 도산 실무 판정 (참고)]
• 대상: ${subjectLabel}
• 생년월일: ${localYmd(birth)} / 기준일: ${baseDate}
• 만 나이: 만 ${fullAge}세 (${birthdayPassed ? '올해 생일 지남' : `생일까지 ${nextBirthdayDday}일`}) · 연 나이 ${yearAge}세
• 판정: ${verdictTitle}
• 참고: ${verdictBody}
※ 부양가족 인정·특례 적용은 소명 자료와 관할 법원 판단에 따릅니다.`;
    copy(text, '나이 및 실무 판정 결과가 복사되었습니다.');
  };

  const toneClass =
    verdictTone === 'good'
      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
      : verdictTone === 'check'
      ? 'bg-blue-50/80 border-blue-200 text-blue-950'
      : 'bg-slate-50 border-slate-200 text-slate-800';
  const VerdictIcon = subject === 'child' ? Baby : subject === 'parent' ? HeartHandshake : Briefcase;

  return (
    <div className="p-4 space-y-3.5 text-xs text-slate-800">
      {/* 판정 대상 */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl" role="radiogroup" aria-label="판정 대상">
        {SUBJECTS.map(s => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={subject === s.value}
            onClick={() => setSubject(s.value)}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              subject === s.value ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 입력 */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-3">
          <label htmlFor="age-birth" className="text-[11px] font-bold text-slate-700 block mb-1">생년월일</label>
          <input
            id="age-birth"
            type="text"
            autoComplete="off"
            value={birthInput}
            onChange={e => setBirthInput(e.target.value)}
            placeholder="예: 980820 또는 1998-08-20"
            aria-describedby="age-birth-help"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="age-base" className="text-[11px] font-bold text-slate-700 block mb-1">기준일</label>
          <input
            id="age-base"
            type="date"
            value={baseDate}
            onChange={e => setBaseDate(e.target.value || localYmd())}
            className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
        </div>
      </div>
      <p id="age-birth-help" className="text-[10px] text-slate-500 -mt-2">
        주민번호는 앞 6자리(필요하면 성별 1자리)까지만 입력하세요. 입력값은 저장되지 않습니다.
      </p>

      {birth ? (
        <>
          {/* 나이 요약 */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 p-3.5 rounded-2xl border border-rose-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-rose-700" aria-hidden="true" />
                법정 만 나이 ({baseDate} 기준)
              </span>
              <span className="text-[11px] text-rose-800 font-bold">
                {birthdayPassed ? '올해 생일 지남' : `생일까지 D-${nextBirthdayDday}`}
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-rose-200/60">
              <span className="text-2xl font-black text-rose-700 tabular-nums tracking-tight">만 {fullAge}세</span>
              <span className="text-[11px] text-slate-600">연 나이 {yearAge}세 · 생년월일 {localYmd(birth)}</span>
            </div>
          </div>

          {/* 판정 */}
          <div className={`p-3 rounded-2xl border flex items-start gap-2.5 ${toneClass}`} aria-live="polite">
            <div className="p-1.5 rounded-lg shrink-0 mt-0.5 bg-white/70">
              <VerdictIcon className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-extrabold text-xs">{verdictTitle}</p>
              <p className="text-[11px] leading-relaxed opacity-90">{verdictBody}</p>
            </div>
          </div>

          <CopyButton copied={copied} onClick={handleCopy} label="만나이 & 실무 판정 복사" copiedLabel="복사 완료" />
        </>
      ) : (
        <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-600 border border-slate-200 space-y-1">
          <AlertCircle className="w-5 h-5 mx-auto text-slate-500" aria-hidden="true" />
          <p className="font-bold">{birthInput.trim() ? '생년월일 형식을 확인해 주세요.' : '생년월일을 입력하세요.'}</p>
          <p className="text-[11px] text-slate-500">예: 950515, 950515-1, 1995-05-15, 1995.5.15</p>
        </div>
      )}
    </div>
  );
}
