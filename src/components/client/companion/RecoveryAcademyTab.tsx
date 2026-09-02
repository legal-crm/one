import React, { useState } from 'react';
import { BookOpen, CheckCircle, Download, FileText, Sparkles, TrendingUp, ShieldCheck, ChevronRight, Award } from 'lucide-react';
import { toast } from 'sonner';

const ACADEMY_LESSONS = [
  {
    id: 'lesson-1',
    month: '1개월 차',
    title: '법원 전용 가상계좌 자동이체 실패 방지 팁',
    category: '납부 안전',
    readTime: '1분',
    summary: '법원 가상계좌는 은행 정기 자동이체가 지원되지 않는 경우가 많습니다. 매월 변제일 D-3일 급여통장 알림을 설정하고 직접 이체하는 안전 수칙을 알아봅니다.',
    keyPoints: ['급여일 직후 즉시 송금 습관화', '이체 후 법원 사건번호와 입금자명 일치 확인', '신한/우리 등 법원 보관금 수납은행 전산 점검']
  },
  {
    id: 'lesson-2',
    month: '3개월 차',
    title: '회생 중 신용카드 없이 알뜰하게 살기 (후불교통 체크카드)',
    category: '생활 금융',
    readTime: '2분',
    summary: '신용카드가 발급되지 않더라도 소액 신용한도가 탑재된 후불교통 체크카드 발급 요령과 통신비·공과금 캐시백 혜택을 챙기는 법을 안내합니다.',
    keyPoints: ['케이뱅크/토스/카카오뱅크 후불교통 체크카드', '지역화폐 및 제로페이 충전 인센티브 활용', '통신사 알뜰폰 유심 변경으로 월 4만 원 절약']
  },
  {
    id: 'lesson-3',
    month: '6개월 차',
    title: '성실상환자(6회 완납)가 누릴 수 있는 공적 혜택 총정리',
    category: '공적 혜택',
    readTime: '2분',
    summary: '6회차 이상 미납 없이 납부하면 서민금융진흥원 및 신용회복위원회의 긴급 소액 생활안정자금 신청 자격이 부여됩니다.',
    keyPoints: ['서민금융진흥원 연 2~4%대 긴급의료비·학자금', '신용회복위원회 소액대출 요건 점검', '사금융 고금리 대출 유혹 절대 금지']
  },
  {
    id: 'lesson-4',
    month: '12개월 차',
    title: '주소·직장이 바뀌었을 때 법원 주소보정 신고 방법',
    category: '법률 절차',
    readTime: '2분',
    summary: '이사나 이직을 했을 때 법원에 송달장소 변경신고를 하지 않으면 중요 통지서를 놓쳐 불이익을 받을 수 있습니다. 전자소송 셀프 신고법을 소개합니다.',
    keyPoints: ['대법원 전자소송 송달장소 변경신청서 제출', '담당 변호사 사무소에 변동사실 즉시 고지', '우체국 우편물 전입지 전송 서비스 신청']
  },
  {
    id: 'lesson-5',
    month: '24개월 차',
    title: '회생 반환점(2년 완납) 돌파! 특별면책 요건 알아보기',
    category: '면책 대비',
    readTime: '2분',
    summary: '불가피한 중대 사고나 질병으로 잔여 변제 수행이 불가능해진 경우, 법에 정해진 요건을 갖추면 남은 변제를 면제받는 특별면책 제도를 설명합니다.',
    keyPoints: ['채무자의 책임 없는 사유 증빙(진단서 등)', '청산가치 이상 변제 수행 여부 검토', '변호사 상담을 통한 특별면책 신청서 작성']
  },
  {
    id: 'lesson-6',
    month: '36개월 차',
    title: '36회 완납 후 필수! 법원 면책신청서 제출 가이드',
    category: '최종 면책',
    readTime: '3분',
    summary: '변제금을 모두 완납해도 자동으로 면책되지 않습니다. 법원에 면책신청서를 접수하고 면책결정문이 확정되어야 모든 빚이 법적으로 소멸됩니다.',
    keyPoints: ['법원 변제현황조회서 최종 완납 내역 확인', '면책신청서 작성 및 전자소송 접수', '면책결정문 송달 후 2주 확정 대기']
  }
];

export default function RecoveryAcademyTab() {
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);

  const handleDownloadForm = () => {
    toast.success('표준 개인회생 면책신청서 서식(HWP/PDF)이 다운로드되었습니다.');
  };

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      
      {/* 아카데미 헤더 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full">
              회생 완주 & 신용 리스타트
            </span>
            <span className="text-[11px] bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 rounded-full font-bold">
              1분 숏폼 가이드
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            마이김변 회복 아카데미
          </h2>
          <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
            3~5년의 변제 여정 동안 꼭 알아야 할 금융 지식, 법률 팁, 그리고 완납 후 정상 신용 복귀까지의 모든 노하우를 담았습니다.
          </p>
        </div>

        {/* 36회 완납 고객 전용 면책 서식 다운로드 배너 */}
        <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-750 shrink-0 w-full md:w-72 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            변제 완료 고객 필수 자료
          </span>
          <p className="text-xs font-bold text-slate-800 dark:text-white">
            법원 면책신청서 표준 양식
          </p>
          <button
            type="button"
            onClick={handleDownloadForm}
            className="w-full py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>면책신청서 무료 다운로드</span>
          </button>
        </div>
      </div>

      {/* 12개월 신용 리스타트 로드맵 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-black text-sm md:text-base">
            면책 확정 후 12개월 신용 회복 4단계 로드맵
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
              Step 1. 면책 직후
            </span>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">1101 공공기록 삭제 확인</h4>
            <p className="text-[11px] text-slate-500 leading-tight">
              한국신용정보원(크레딧포유)에서 법원 특수기록 해제 여부 조회
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
              Step 2. 3개월 차
            </span>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">주거래은행 실적 재구축</h4>
            <p className="text-[11px] text-slate-500 leading-tight">
              급여이체, 예·적금 납입, 체크카드 월 30만 원 이상 꾸준한 사용
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
              Step 3. 6개월 차
            </span>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">신용점수 600점대 진입</h4>
            <p className="text-[11px] text-slate-500 leading-tight">
              KCB/NICE 소액 신용카드 발급 및 통신비 납부실적 가점 등록
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
              Step 4. 12개월 차
            </span>
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">1금융권 정상 금융 복귀</h4>
            <p className="text-[11px] text-slate-500 leading-tight">
              햇살론·디딤돌 등 정책 대출 및 1금융권 저금리 금융거래 정상화
            </p>
          </div>
        </div>
      </div>

      {/* 월별 아카데미 카드 그리드 */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand" />
          <span>월간 회생동행 필수 가이드북</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACADEMY_LESSONS.map((lesson) => (
            <div
              key={lesson.id}
              onClick={() => setSelectedLesson(lesson)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-brand/40 transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-lg">
                    {lesson.month}
                  </span>
                  <span className="text-[10px] font-bold bg-brand/10 text-brand px-2 py-0.5 rounded-lg">
                    {lesson.category}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 flex items-center gap-0.5 group-hover:text-brand transition-colors">
                  읽기 {lesson.readTime} ➔
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-brand transition-colors">
                  {lesson.title}
                </h4>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {lesson.summary}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>핵심 포인트 {lesson.keyPoints.length}개 포함</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 가이드 상세 보기 모달 */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5 text-left animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand bg-brand/10 px-2.5 py-0.5 rounded-full">
                  {selectedLesson.month}
                </span>
                <span className="text-xs text-slate-400 font-semibold">{selectedLesson.category}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLesson(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {selectedLesson.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedLesson.summary}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                📌 실천 핵심 체크리스트
              </span>
              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {selectedLesson.keyPoints.map((pt: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLesson(null)}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
