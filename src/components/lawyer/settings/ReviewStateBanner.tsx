import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { loadMyLawyerReviewState, type MyLawyerReviewState } from '../../../services/admin/adminOpsService';

/**
 * 변호사 본인 심사 결과 안내 (OP-8): 보완 요청·반려·이용 정지면 관리자가 적은 사유를 보여 준다.
 * 심사 대기·승인 상태면 아무것도 그리지 않는다.
 */
export default function ReviewStateBanner() {
  const [state, setState] = useState<MyLawyerReviewState | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadMyLawyerReviewState().then(s => { if (!cancelled) setState(s); });
    return () => { cancelled = true; };
  }, []);
  if (!state || (state.status !== 'info_requested' && state.status !== 'rejected' && state.status !== 'suspended')) return null;
  const title = state.status === 'info_requested' ? '심사에 보완이 필요해요' : state.status === 'rejected' ? '이번 심사는 승인되지 않았어요' : '마이김변 이용이 정지됐어요';
  const next = state.status === 'info_requested'
    ? '아래 사유를 확인해 서류·정보를 고친 뒤 다시 제출해 주세요. 제출하면 다시 심사해요.'
    : '궁금한 점은 마이김변 문의로 남겨 주세요.';
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-left space-y-1.5" role="alert">
      <p className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {title}
      </p>
      {state.reason && <p className="text-xs text-rose-900 leading-relaxed">사유: {state.reason}</p>}
      <p className="text-xs text-rose-800 leading-relaxed">{next}</p>
    </div>
  );
}
