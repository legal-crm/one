import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { User } from '../../../types';
import { getLawyerProfileMissing, LAWYER_PROFILE_MISSING_LABELS } from '../../client/lawyerDirectory';

/**
 * 변호사 찾기 목록 공개 안내 (LD-3, LD-Q4).
 * 승인된 변호사라도 실명·사무소 이름·사무소 시·도·본인 사진·분야·소개 50자를 채워야 목록에 보이고 상담 요청을 받는다.
 * 서버(lawyers 읽기 정책·client_request_lawyers)가 같은 조건으로 판단한다.
 */
export default function ProfileListingNotice({ lawyer, onEdit, compact = false }: { lawyer: User; onEdit?: () => void; compact?: boolean }) {
  if (lawyer.approved === false) return null;
  const missing = getLawyerProfileMissing(lawyer);
  if (missing.length === 0) {
    if (compact) return null;
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-900 flex items-center gap-2" role="status">
        <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="font-bold">프로필이 공개 조건을 채워 변호사 찾기 목록에 보이고 있어요.</span>
      </div>
    );
  }
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3" role="status">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <EyeOff className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="text-sm text-amber-950 leading-relaxed break-keep">
          <p className="font-bold">프로필을 채우면 변호사 찾기 목록에 보여요</p>
          <p className="text-amber-900">
            지금은 목록에 보이지 않고 새 상담 요청도 받을 수 없어요. 남은 항목: {missing.map(m => LAWYER_PROFILE_MISSING_LABELS[m]).join(' · ')}
          </p>
        </div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer self-start sm:self-auto"
        >
          프로필 채우기
        </button>
      )}
    </div>
  );
}
