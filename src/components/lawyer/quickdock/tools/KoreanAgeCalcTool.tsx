import React, { useState } from 'react';
import { CalendarCheck, Copy, Check, Sparkles, UserCheck, AlertCircle, Baby, Briefcase, HeartHandshake } from 'lucide-react';
import { toast } from 'sonner';

export default function KoreanAgeCalcTool() {
  // 생년월일 입력값 (기본값: 1995-05-15)
  const [birthInput, setBirthInput] = useState('1998-08-20');
  const [copied, setCopied] = useState(false);

  // 생년월일 파싱 및 유효성 검사
  const parseBirthDate = (raw: string): Date | null => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    let year = 0;
    let month = 0;
    let day = 0;

    if (cleaned.length === 6) {
      // YYMMDD
      const yy = parseInt(cleaned.slice(0, 2), 10);
      year = yy >= 30 ? 1900 + yy : 2000 + yy;
      month = parseInt(cleaned.slice(2, 4), 10);
      day = parseInt(cleaned.slice(4, 6), 10);
    } else if (cleaned.length === 8) {
      // YYYYMMDD
      year = parseInt(cleaned.slice(0, 4), 10);
      month = parseInt(cleaned.slice(4, 6), 10);
      day = parseInt(cleaned.slice(6, 8), 10);
    } else if (raw.includes('-')) {
      const parts = raw.split('-');
      if (parts.length === 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      }
    }

    if (year < 1920 || year > 2026 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const birthDate = parseBirthDate(birthInput);
  const today = new Date();

  // 나이 계산
  let internationalAge = 0;
  let yearAge = 0;
  let countingAge = 0;
  let isBirthdayPassed = false;
  let nextBirthdayDday = 0;
  let age19Date: Date | null = null;
  let monthsUntil19 = 0;

  if (birthDate) {
    const birthYear = birthDate.getFullYear();
    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    yearAge = currentYear - birthYear;
    countingAge = yearAge + 1;

    // 생일 지났는지 여부
    if (currentMonth > birthMonth || (currentMonth === birthMonth && currentDay >= birthDay)) {
      isBirthdayPassed = true;
      internationalAge = yearAge;
    } else {
      isBirthdayPassed = false;
      internationalAge = Math.max(0, yearAge - 1);
    }

    // 다음 생일까지 D-day
    const nextBdayYear = isBirthdayPassed ? currentYear + 1 : currentYear;
    const nextBday = new Date(nextBdayYear, birthMonth, birthDay);
    const diffTime = nextBday.getTime() - today.getTime();
    nextBirthdayDday = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 만 19세 도달일 (성년)
    age19Date = new Date(birthYear + 19, birthMonth, birthDay);
    const diffMonths = (age19Date.getFullYear() - today.getFullYear()) * 12 + (age19Date.getMonth() - today.getMonth());
    monthsUntil19 = Math.max(0, diffMonths);
  }

  // ── 도산 실무 특례 판정 ──
  const isMinorUnder19 = birthDate ? internationalAge < 19 : false;
  const isYouthUnder29 = birthDate ? internationalAge <= 29 : false;
  const isYouthUnder34 = birthDate ? internationalAge <= 34 : false;
  const isSeniorOver65 = birthDate ? internationalAge >= 65 : false;

  const handleCopy = () => {
    if (!birthDate) {
      toast.error('올바른 생년월일을 입력해주세요.');
      return;
    }

    const text = `[만나이 및 도산 실무 자격 판정]
• 생년월일: ${birthDate.toISOString().slice(0, 10)}
• 만 나이: 만 ${internationalAge}세 (${isBirthdayPassed ? '올해 생일 지남' : `생일 전, D-${nextBirthdayDday}`})
• 연 나이 / 세는나이: ${yearAge}세 / ${countingAge}세
-------------------------------------------
[실무상 자격 판정]
1. 미성년 부양가족: ${isMinorUnder19 ? `✅ 미성년 인정 (만 19세까지 약 ${monthsUntil19}개월 잔여)` : '❌ 만 19세 성년 (부양가족 제외 원칙)'}
2. 청년 회생 24개월 단축: ${isYouthUnder29 ? '✅ 만 29세 이하 청년 특례 대상 (변제기간 24개월)' : isYouthUnder34 ? '🟡 만 34세 이하 청년 (일부 법원 단축특례 검토 대상)' : '❌ 청년 특례 비해당 (일반 36개월)'}
3. 고령자 부양가족: ${isSeniorOver65 ? '✅ 만 65세 이상 고령자 (부양가족 산입 및 단축변제 검토 가능)' : '❌ 만 65세 미만'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('나이 및 실무 자격 판정 결과가 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 space-y-3.5 text-xs text-slate-800">
      {/* 생년월일 입력 */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
          <span>생년월일 입력 (주민번호 앞자리 또는 YYYY-MM-DD)</span>
          <span className="text-[10px] text-rose-600 font-mono font-medium">기준일: 오늘</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={birthInput}
            onChange={e => setBirthInput(e.target.value)}
            placeholder="예: 980820 또는 1998-08-20"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
        </div>
        <p className="text-[10px] text-slate-500">
          💡 주민등록번호 앞 6자리(예: 051120)만 쳐도 자동으로 만 나이와 특례가 계산됩니다.
        </p>
      </div>

      {birthDate ? (
        <>
          {/* 나이 결과 요약 카드 */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 p-3.5 rounded-2xl border border-rose-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-rose-600" />
                법정 만 나이 (대한민국 표준)
              </span>
              <span className="text-[11px] text-rose-700 font-bold">
                {isBirthdayPassed ? '올해 생일 지남' : `생일까지 D-${nextBirthdayDday}`}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t border-rose-200/60">
              <span className="text-2xl font-black text-rose-600 font-mono tracking-tight">
                만 {internationalAge}세
              </span>
              <div className="text-right text-[11px] text-slate-500">
                <span>연 나이: {yearAge}세</span>
                <span className="mx-1 text-slate-300">|</span>
                <span>세는나이: {countingAge}세</span>
              </div>
            </div>
          </div>

          {/* ── 도산 실무 특례 3대 판정 리포트 ── */}
          <div className="space-y-2">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              회생·파산 실무상 자격 판정
            </span>

            {/* 1. 미성년 자녀 부양가족 */}
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
              isMinorUnder19 ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isMinorUnder19 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                <Baby className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs">
                    {isMinorUnder19 ? '미성년 자녀 (부양가족 인정 O)' : '만 19세 성년 (원칙상 부양가족 제외)'}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isMinorUnder19 ? 'bg-emerald-200/70 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isMinorUnder19 ? '부양가능' : '제외대상'}
                  </span>
                </div>
                {isMinorUnder19 ? (
                  <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                    만 19세 성년 도달일까지 <strong>약 {monthsUntil19}개월</strong> 남음. 
                    {monthsUntil19 <= 36 && ' (36개월 내 성년 도달 시 단계적 변제계획 검토 필요)'}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    성년 자녀는 중증 장애 또는 지속적 질병 등 특별사유 소명 시에만 예외적 인정.
                  </p>
                )}
              </div>
            </div>

            {/* 2. 청년 회생 24개월 단축 특례 */}
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
              isYouthUnder29 
                ? 'bg-blue-50/80 border-blue-300 text-blue-950' 
                : isYouthUnder34 
                ? 'bg-cyan-50/80 border-cyan-300 text-cyan-950'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                isYouthUnder29 ? 'bg-blue-600 text-white' : isYouthUnder34 ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs">
                    {isYouthUnder29 
                      ? '청년 회생 24개월 단축 특례 (만 29세 이하)' 
                      : isYouthUnder34 
                      ? '청년 회생 준칙 검토 대상 (만 34세 이하)'
                      : '청년 단축 특례 비해당 (36개월 원칙)'}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isYouthUnder29 
                      ? 'bg-blue-200/80 text-blue-800' 
                      : isYouthUnder34 
                      ? 'bg-cyan-200/80 text-cyan-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isYouthUnder29 ? '24개월 단축' : isYouthUnder34 ? '준칙확인' : '일반36개월'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  {isYouthUnder29 
                    ? '서울·수원·부산회생법원 실무준칙에 따라 변제기간을 24개월로 1년 단축 신청 가능!' 
                    : isYouthUnder34 
                    ? '관할 법원에 따라 청년 지원 정책으로 변제기간 단축 대상 여부 확인 권장.' 
                    : '일반 채무자로 기본 36개월(청산가치 초과 시 최장 60개월) 변제계획안 작성.'}
                </p>
              </div>
            </div>

            {/* 3. 고령자 부양가족 / 고령자 특례 */}
            <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
              isSeniorOver65 ? 'bg-purple-50/80 border-purple-200 text-purple-950' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSeniorOver65 ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                <HeartHandshake className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs">
                    {isSeniorOver65 ? '만 65세 이상 고령자 (부양가족 인정 O)' : '만 65세 미만'}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isSeniorOver65 ? 'bg-purple-200/80 text-purple-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isSeniorOver65 ? '고령자부양' : '일반'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  {isSeniorOver65 
                    ? '부모님 부양 시 소득 유무 확인 후 기본 부양가족 산입 가능. 채무자 본인인 경우 고령자 단축변제 검토 가능.' 
                    : '부모님 만 65세 미만인 경우 근로능력이 인정되어 중증 질환 소명 없이는 부양가족 불인정 경향.'}
                </p>
              </div>
            </div>
          </div>

          {/* 복사 버튼 */}
          <button
            onClick={handleCopy}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사 완료' : '만나이 & 실무 판정결과 복사'}</span>
          </button>
        </>
      ) : (
        <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-500 border border-slate-200">
          <AlertCircle className="w-5 h-5 mx-auto text-slate-400 mb-1" />
          <p className="font-bold">올바른 생년월일 형식으로 입력해주세요.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">예: 950515 또는 1995-05-15</p>
        </div>
      )}
    </div>
  );
}
