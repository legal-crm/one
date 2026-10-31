// 의뢰인 '내 사건' › 채권자집회 준비 카드 (NF-8) — 기일이 잡히면 날짜·준비물·당일 흐름 일반 안내
// 일반 정보만 (결과·가능성 표현 없음). 시간·장소는 법원 통지서와 사무소 안내가 기준
import { CalendarClock } from 'lucide-react';

const daysUntil = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
};

export default function MyMeetingPrepCard({ meetingOn, courtName }: { meetingOn: string; courtName?: string | null }) {
  const left = daysUntil(meetingOn);
  if (left === null || left < 0) return null;
  return (
    <section className="rounded-2xl border border-brand/20 bg-brand-light p-3 sm:p-4 space-y-2" aria-label="채권자집회 준비">
      <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
        <CalendarClock className="w-4 h-4 text-brand" aria-hidden="true" />
        채권자집회 {meetingOn}{left === 0 ? ' (오늘)' : ` (${left}일 남음)`}{courtName ? ` · ${courtName}` : ''}
      </p>
      <ul className="text-xs text-slate-700 space-y-1 leading-relaxed list-disc pl-4">
        <li>채무자 본인이 출석해요. 시간·장소(법정 호수)는 법원 통지서와 사무소 안내를 확인해 주세요.</li>
        <li>신분증을 꼭 챙기고, 조금 일찍 도착해 주세요.</li>
        <li>회생위원이 변제계획을 설명하고, 출석한 채권자가 질문할 수 있어요. 질문에는 아는 사실대로 답하면 돼요.</li>
        <li>사정이 생겨 출석하기 어려우면 바로 담당 사무소에 알려 주세요.</li>
      </ul>
    </section>
  );
}
