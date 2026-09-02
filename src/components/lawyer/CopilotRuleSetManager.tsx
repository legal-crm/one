import React, { useState, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, CheckCircle2, Archive, ChevronDown, ChevronUp,
  AlertTriangle, Shield, Copy, Save, Search, Filter, Clock, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import type {
  ReviewRuleSet, ReviewRule, RuleCondition, RuleOutputType,
  RuleSourceType, RuleSetStatus, RuleExpiryStatus
} from '../../types/copilot';
import { RULE_SOURCE_TYPE_CONFIG } from '../../types/copilot';
import { useCopilotPermissions } from '../../hooks/useCopilotPermissions';
import type { StaffRole } from '../../types';

// ============================================================
// 코파일럿 검토 기준 관리 UI
// ============================================================

interface CopilotRuleSetManagerProps {
  tenantId: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  onBack?: () => void;
}

const OUTPUT_TYPE_OPTIONS: { value: RuleOutputType; label: string; emoji: string }[] = [
  { value: 'REVIEW_FLAG', label: '검토 플래그', emoji: '🏳️' },
  { value: 'ADDITIONAL_QUESTION', label: '추가 질문', emoji: '❓' },
  { value: 'REQUIRED_DOCUMENT', label: '필요 서류', emoji: '📄' },
  { value: 'CAUTION', label: '주의사항', emoji: '⚠️' },
  { value: 'HIGH_RISK', label: '고위험', emoji: '🔴' },
];

const SOURCE_TYPE_OPTIONS: { value: RuleSourceType; label: string }[] = [
  { value: 'OFFICIAL', label: '공식 (법원 공고 등)' },
  { value: 'PUBLISHED', label: '공개 자료 (논문, 판례)' },
  { value: 'FIRM_EXPERIENCE', label: '사무실 경험' },
  { value: 'UNVERIFIED', label: '미검증' },
];

const CONDITION_FIELDS = [
  { value: 'totalDebt', label: '총 채무' },
  { value: 'securedDebt', label: '담보 채무' },
  { value: 'unsecuredDebt', label: '무담보 채무' },
  { value: 'taxDebt', label: '조세 채무' },
  { value: 'monthlyIncome', label: '월 소득' },
  { value: 'monthlyExpense', label: '월 지출' },
  { value: 'disposableIncome', label: '가용소득' },
  { value: 'dependents', label: '부양가족 수' },
  { value: 'creditorCount', label: '채권자 수' },
  { value: 'delinquencyMonths', label: '연체 개월' },
  { value: 'previousHistory', label: '과거 이력 여부' },
  { value: 'assets.totalMarketValue', label: '총 자산 시가' },
  { value: 'assets.netAssetValue', label: '순자산가치' },
  { value: 'assets.hasRealEstate', label: '부동산 보유' },
];

const OPERATOR_OPTIONS: { value: RuleCondition['operator']; label: string }[] = [
  { value: 'GT', label: '>' },
  { value: 'GTE', label: '≥' },
  { value: 'LT', label: '<' },
  { value: 'LTE', label: '≤' },
  { value: 'EQ', label: '=' },
  { value: 'NEQ', label: '≠' },
  { value: 'EXISTS', label: '있음' },
  { value: 'NOT_EXISTS', label: '없음' },
];

const STATUS_BADGE: Record<RuleSetStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: '초안', color: 'text-slate-600', bg: 'bg-slate-100' },
  PENDING_APPROVAL: { label: '승인 대기', color: 'text-amber-700', bg: 'bg-amber-100' },
  ACTIVE: { label: '활성', color: 'text-green-700', bg: 'bg-green-100' },
  ARCHIVED: { label: '보관', color: 'text-slate-500', bg: 'bg-slate-50' },
};

/** 기본 빈 규칙 생성 */
function createEmptyRule(ruleSetId: string): ReviewRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    ruleSetId,
    category: 'GENERAL',
    title: '',
    description: '',
    conditions: [{ field: 'totalDebt', operator: 'GT', value: 0 }],
    outputType: 'REVIEW_FLAG',
    outputMessage: '',
    sourceType: 'FIRM_EXPERIENCE',
    sourceReference: '',
    effectiveFrom: '',
    reviewDueAt: '',
    approvedByLawyerId: '',
    approvedAt: '',
    version: 1,
    status: 'ACTIVE',
    expiryStatus: 'CURRENT',
  };
}

export default function CopilotRuleSetManager({
  tenantId, actorId, actorRole, actorName, onBack
}: CopilotRuleSetManagerProps) {
  const dialog = useDialog();
  const permissions = useCopilotPermissions(actorRole as StaffRole);

  // RuleSet 목록 (localStorage 기반)
  const [ruleSets, setRuleSets] = useState<ReviewRuleSet[]>(() => {
    try {
      const saved = localStorage.getItem(`copilot-rulesets-${tenantId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 선택된 RuleSet
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  // 규칙 목록
  const [rules, setRules] = useState<ReviewRule[]>(() => {
    try {
      const saved = localStorage.getItem(`copilot-rules-${tenantId}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 규칙 편집
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  // 새 RuleSet 생성
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const selectedSet = ruleSets.find(s => s.id === selectedSetId);
  const selectedRules = rules.filter(r => r.ruleSetId === selectedSetId);

  const saveToStorage = useCallback((sets: ReviewRuleSet[], rls: ReviewRule[]) => {
    localStorage.setItem(`copilot-rulesets-${tenantId}`, JSON.stringify(sets));
    localStorage.setItem(`copilot-rules-${tenantId}`, JSON.stringify(rls));
  }, [tenantId]);

  // RuleSet 생성
  const handleCreateSet = () => {
    if (!newName.trim()) return;
    const newSet: ReviewRuleSet = {
      id: `rs-${Date.now()}`,
      tenantId,
      name: newName.trim(),
      description: newDesc.trim(),
      version: 1,
      status: 'DRAFT',
      effectiveFrom: '',
      reviewDueAt: '',
      createdBy: actorId,
      approvedByLawyerId: '',
      approvedAt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...ruleSets, newSet];
    setRuleSets(updated);
    saveToStorage(updated, rules);
    setSelectedSetId(newSet.id);
    setShowNewForm(false);
    setNewName('');
    setNewDesc('');
  };

  // RuleSet 활성화
  const handleActivateSet = (setId: string) => {
    const updated = ruleSets.map(s => ({
      ...s,
      status: (s.id === setId ? 'ACTIVE' : s.status === 'ACTIVE' ? 'ARCHIVED' : s.status) as RuleSetStatus,
      approvedByLawyerId: s.id === setId ? actorId : s.approvedByLawyerId,
      approvedAt: s.id === setId ? new Date().toISOString() : s.approvedAt,
      updatedAt: s.id === setId ? new Date().toISOString() : s.updatedAt,
    }));
    setRuleSets(updated);
    saveToStorage(updated, rules);
  };

  // RuleSet 보관
  const handleArchiveSet = (setId: string) => {
    const updated = ruleSets.map(s =>
      s.id === setId ? { ...s, status: 'ARCHIVED' as RuleSetStatus, updatedAt: new Date().toISOString() } : s
    );
    setRuleSets(updated);
    saveToStorage(updated, rules);
  };

  // 규칙 추가
  const handleAddRule = () => {
    if (!selectedSetId) return;
    const newRule = createEmptyRule(selectedSetId);
    const updated = [...rules, newRule];
    setRules(updated);
    setEditingRuleId(newRule.id);
    setExpandedRuleId(newRule.id);
    saveToStorage(ruleSets, updated);
  };

  // 규칙 수정
  const handleUpdateRule = (ruleId: string, changes: Partial<ReviewRule>) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, ...changes } : r);
    setRules(updated);
    saveToStorage(ruleSets, updated);
  };

  // 규칙 삭제
  const handleDeleteRule = async (ruleId: string) => {
    const targetRule = rules.find(r => r.id === ruleId);
    const confirmed = await dialog.confirm({
      title: '규칙 삭제',
      message: `'${targetRule?.title || '규칙'}' 항목을 삭제하시겠습니까?`,
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    const updated = rules.filter(r => r.id !== ruleId);
    setRules(updated);
    saveToStorage(ruleSets, updated);
    toast.success('규칙이 삭제되었습니다.');
  };

  // 조건 추가
  const handleAddCondition = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    handleUpdateRule(ruleId, {
      conditions: [...rule.conditions, { field: 'totalDebt', operator: 'GT', value: 0 }],
    });
  };

  // 조건 수정
  const handleUpdateCondition = (ruleId: string, idx: number, changes: Partial<RuleCondition>) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    const newConds = [...rule.conditions];
    newConds[idx] = { ...newConds[idx], ...changes };
    handleUpdateRule(ruleId, { conditions: newConds });
  };

  // 조건 삭제
  const handleDeleteCondition = async (ruleId: string, idx: number) => {
    const confirmed = await dialog.confirm({
      title: '조건 삭제',
      message: '해당 판정 조건을 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    handleUpdateRule(ruleId, {
      conditions: rule.conditions.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 헤더 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand" />
              사건검토 기준 관리
            </h3>
            <p className="text-xs text-slate-500">
              사무실 고유의 검토 규칙을 설정합니다. 각 규칙은 변호사 승인 후 활성화됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="bg-slate-100 text-slate-700 rounded-xl px-4 py-2 font-bold text-sm hover:bg-slate-200 active:scale-[0.98] transition-all">
                ← 돌아가기
              </button>
            )}
            {permissions.canManageRuleSets && (
              <button
                onClick={() => setShowNewForm(true)}
                className="bg-brand text-white rounded-xl px-4 py-2 font-bold text-sm hover:bg-brand/90 active:scale-[0.98] transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> 새 기준 세트
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 새 RuleSet 생성 폼 */}
      {showNewForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-sm text-blue-800">새 기준 세트 만들기</h4>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="기준 세트 이름 (예: 2024년 하반기 기준)"
            className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand/30 outline-none"
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="설명 (선택)"
            className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-brand/30 outline-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button onClick={handleCreateSet} className="bg-brand text-white rounded-xl px-4 py-2 font-bold text-sm hover:bg-brand/90 active:scale-[0.98] transition-all">생성</button>
            <button onClick={() => setShowNewForm(false)} className="bg-slate-100 text-slate-600 rounded-xl px-4 py-2 font-bold text-sm hover:bg-slate-200 active:scale-[0.98] transition-all">취소</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 좌측: RuleSet 목록 */}
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-bold text-slate-500 px-1">기준 세트 목록</p>
          {ruleSets.length === 0 ? (
            <div className="bg-slate-50 rounded-xl p-6 text-center">
              <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-bold">아직 기준 세트가 없습니다</p>
              <p className="text-xs text-slate-400 mt-1">"새 기준 세트" 버튼으로 시작하세요.</p>
            </div>
          ) : (
            ruleSets.map(set => {
              const stBadge = STATUS_BADGE[set.status];
              const ruleCount = rules.filter(r => r.ruleSetId === set.id).length;
              return (
                <button
                  key={set.id}
                  onClick={() => setSelectedSetId(set.id)}
                  className={`w-full text-left bg-white border rounded-xl p-3 transition-all hover:shadow-sm active:scale-[0.99] ${
                    selectedSetId === set.id ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-slate-800 truncate">{set.name}</span>
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${stBadge.bg} ${stBadge.color}`}>{stBadge.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">v{set.version} · {ruleCount}개 규칙</p>
                </button>
              );
            })
          )}
        </div>

        {/* 우측: 선택된 RuleSet 규칙 편집 */}
        <div className="lg:col-span-2">
          {!selectedSet ? (
            <div className="bg-slate-50 rounded-xl p-12 text-center">
              <Eye className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-bold">기준 세트를 선택하세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 선택된 세트 헤더 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-800">{selectedSet.name}</h4>
                  {selectedSet.description && <p className="text-xs text-slate-500 mt-0.5">{selectedSet.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {permissions.canApproveRuleSets && selectedSet.status !== 'ACTIVE' && (
                    <button
                      onClick={() => handleActivateSet(selectedSet.id)}
                      className="bg-green-600 text-white rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-green-700 active:scale-[0.98] transition-all flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> 승인·활성화
                    </button>
                  )}
                  {selectedSet.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleArchiveSet(selectedSet.id)}
                      className="bg-slate-100 text-slate-600 rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center gap-1"
                    >
                      <Archive className="w-3.5 h-3.5" /> 보관
                    </button>
                  )}
                  {permissions.canManageRuleSets && (
                    <button
                      onClick={handleAddRule}
                      className="bg-brand text-white rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-brand/90 active:scale-[0.98] transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> 규칙 추가
                    </button>
                  )}
                </div>
              </div>

              {/* 규칙 목록 */}
              {selectedRules.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-8 text-center">
                  <p className="text-sm text-slate-500">"규칙 추가" 버튼으로 검토 규칙을 만드세요.</p>
                </div>
              ) : (
                selectedRules.map(rule => {
                  const isExpanded = expandedRuleId === rule.id;
                  const outCfg = OUTPUT_TYPE_OPTIONS.find(o => o.value === rule.outputType);
                  return (
                    <div key={rule.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      {/* 규칙 헤더 */}
                      <button
                        onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                        className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm">{outCfg?.emoji || '🏳️'}</span>
                          <span className="font-bold text-sm text-slate-800 truncate">{rule.title || '(제목 없음)'}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{rule.conditions.length}개 조건</span>
                          {rule.status === 'INACTIVE' && (
                            <span className="bg-slate-100 text-slate-500 rounded-lg px-1.5 py-0.5 text-[10px] font-bold">비활성</span>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>

                      {/* 규칙 편집 영역 */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/50">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500">규칙 제목</label>
                              <input
                                value={rule.title}
                                onChange={e => handleUpdateRule(rule.id, { title: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand/30 outline-none"
                                placeholder="예: 채무한도 초과 확인"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500">카테고리</label>
                              <input
                                value={rule.category}
                                onChange={e => handleUpdateRule(rule.id, { category: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand/30 outline-none"
                                placeholder="예: 채무한도"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500">플래그 메시지 (검토 요청 문구)</label>
                            <textarea
                              value={rule.outputMessage}
                              onChange={e => handleUpdateRule(rule.id, { outputMessage: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm resize-none focus:ring-2 focus:ring-brand/30 outline-none"
                              rows={2}
                              placeholder="예: 채무액이 5억 원을 초과하여 확인이 필요합니다."
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500">출력 유형</label>
                              <select
                                value={rule.outputType}
                                onChange={e => handleUpdateRule(rule.id, { outputType: e.target.value as RuleOutputType })}
                                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand/30 outline-none"
                              >
                                {OUTPUT_TYPE_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-500">출처 유형</label>
                              <select
                                value={rule.sourceType}
                                onChange={e => handleUpdateRule(rule.id, { sourceType: e.target.value as RuleSourceType })}
                                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand/30 outline-none"
                              >
                                {SOURCE_TYPE_OPTIONS.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* 조건 편집 */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-500">조건 (모두 AND로 결합)</label>
                              <button
                                onClick={() => handleAddCondition(rule.id)}
                                className="text-brand text-[11px] font-bold hover:underline flex items-center gap-0.5"
                              >
                                <Plus className="w-3 h-3" /> 조건 추가
                              </button>
                            </div>
                            {rule.conditions.map((cond, ci) => (
                              <div key={ci} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100">
                                <select
                                  value={cond.field}
                                  onChange={e => handleUpdateCondition(rule.id, ci, { field: e.target.value })}
                                  className="flex-1 bg-transparent text-xs border-none outline-none"
                                >
                                  {CONDITION_FIELDS.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                  ))}
                                </select>
                                <select
                                  value={cond.operator}
                                  onChange={e => handleUpdateCondition(rule.id, ci, { operator: e.target.value as RuleCondition['operator'] })}
                                  className="w-16 bg-transparent text-xs border-none outline-none text-center font-bold"
                                >
                                  {OPERATOR_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={String(cond.value)}
                                  onChange={e => {
                                    const v = e.target.value;
                                    handleUpdateCondition(rule.id, ci, { value: isNaN(Number(v)) ? v : Number(v) });
                                  }}
                                  className="w-28 bg-slate-50 rounded-lg px-2 py-1 text-xs text-right outline-none focus:ring-1 focus:ring-brand/30"
                                />
                                <button
                                  onClick={() => handleDeleteCondition(rule.id, ci)}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* 액션 버튼 */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleUpdateRule(rule.id, { status: rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                              className="text-xs text-slate-500 hover:text-slate-700 font-bold"
                            >
                              {rule.status === 'ACTIVE' ? '비활성화' : '활성화'}
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> 규칙 삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
