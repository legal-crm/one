import React, { useState } from 'react';
import { 
  Calendar, CheckCircle2, User, FileText, ArrowRight, 
  Search, X, Clock, Filter, ShieldCheck
} from 'lucide-react';
import type { CrmActivity, ConsultRequest, CrmClientExtension } from '../../../types';
import ModalPortal from '../../common/ModalPortal';
import { getDisplayClientName } from '../../../utils/clientDisplay';

interface CaseTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
}

export default function CaseTimelineModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
}: CaseTimelineModalProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const activities: CrmActivity[] = crmExt?.activities || [];
  const clientDisplayName = getDisplayClientName(clientRequest, crmExt);

  const filteredActivities = activities
    .filter(act => {
      if (filterType !== 'all' && act.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          act.description.toLowerCase().includes(q) ||
          act.actorName.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-fadeIn">
        <div 
          className="bg-white rounded-3xl border border-slate-200/90 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp"
          onClick={e => e.stopPropagation()}
        >
          {/* 모달 헤더 */}
          <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1E3A5F] text-white flex items-center justify-center shadow-xs">
                <Calendar className="w-5 h-5 text-blue-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-900">사건 활동 기록 (타임라인)</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                    {clientDisplayName}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  총 {activities.length}건의 사건 진행 및 담당자 활동 내역이 기록되어 있습니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 검색 및 필터 툴바 */}
          <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="활동 내용 또는 담당자명 검색..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {[
                { id: 'all', label: '전체' },
                { id: 'status_change', label: '상태변경' },
                { id: 'assigned', label: '담당배정' },
                { id: 'document_checked', label: '서류검토' },
                { id: 'transferred', label: '사건이관' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    filterType === f.id
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 타임라인 본문 목록 */}
          <div className="p-6 overflow-y-auto flex-1 space-y-0">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                {activities.length === 0 ? '기록된 활동 내역이 없습니다.' : '검색/필터 조건에 맞는 활동 내역이 없습니다.'}
              </div>
            ) : (
              filteredActivities.map((act, idx) => {
                const isLast = idx === filteredActivities.length - 1;
                return (
                  <div key={act.id} className="flex gap-4 pb-6 last:pb-2">
                    <div className="flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full mt-1 shrink-0 ${
                        act.type === 'status_change' ? 'bg-blue-600 ring-4 ring-blue-100' :
                        act.type === 'assigned' ? 'bg-emerald-600 ring-4 ring-emerald-100' :
                        act.type === 'transferred' ? 'bg-amber-600 ring-4 ring-amber-100' :
                        act.type === 'document_checked' ? 'bg-purple-600 ring-4 ring-purple-100' :
                        'bg-slate-400 ring-4 ring-slate-100'
                      }`} />
                      {!isLast && <div className="w-px flex-1 bg-slate-200 mt-2" />}
                    </div>

                    <div className="flex-1 pb-1">
                      <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                        {act.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                        <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {act.actorName}
                        </span>
                        <span>·</span>
                        <span className="font-mono">
                          {new Date(act.createdAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 모달 푸터 */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
