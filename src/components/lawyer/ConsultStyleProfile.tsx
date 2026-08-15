import React, { useState, useCallback } from 'react';
import { Save, Plus, Trash2, MessageSquare, AlertTriangle, BookOpen } from 'lucide-react';
import type { ConsultStyleProfile as ConsultStyleProfileType } from '../../types/copilot';

// ============================================================
// 상담 스타일 프로필 설정
// ============================================================

interface ConsultStyleProfileProps {
  tenantId: string;
  actorId: string;
  actorName: string;
  onBack?: () => void;
}

const EXPLANATION_OPTIONS = [
  { value: 'brief', label: '간결하게', desc: '핵심 내용만 짧게 전달' },
  { value: 'normal', label: '보통', desc: '일반적인 설명 분량' },
  { value: 'detailed', label: '상세하게', desc: '배경 설명과 예시 포함' },
];

const TERMINOLOGY_OPTIONS = [
  { value: 'easy', label: '쉬운 표현', desc: '법률 용어를 최대한 풀어서' },
  { value: 'moderate', label: '보통', desc: '기본 법률 용어 사용' },
  { value: 'professional', label: '전문 용어', desc: '정확한 법률 용어 위주' },
];

const LINK_STYLE_OPTIONS = [
  { value: 'inline', label: '본문 삽입' },
  { value: 'footnote', label: '각주' },
  { value: 'appendix', label: '별첨' },
];

export default function ConsultStyleProfileSettings({
  tenantId, actorId, actorName, onBack
}: ConsultStyleProfileProps) {
  const [profile, setProfile] = useState<ConsultStyleProfileType>(() => {
    try {
      const saved = localStorage.getItem(`consult-style-${tenantId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      tenantId,
      explanationLength: 'normal',
      terminologyLevel: 'easy',
      requiredCautions: ['본 내용은 법률 상담을 위한 참고 자료이며, 최종 판단은 담당 변호사와 상의하시기 바랍니다.'],
      postConsultDocuments: [],
      prohibitedExpressions: ['100% 보장', '전격 면책', '무조건', '확실히'],
      officialLinkStyle: 'inline',
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };
  });

  const [saved, setSaved] = useState(false);
  const [newCaution, setNewCaution] = useState('');
  const [newDoc, setNewDoc] = useState('');
  const [newProhibited, setNewProhibited] = useState('');

  const handleSave = useCallback(() => {
    const updated = { ...profile, updatedBy: actorId, updatedAt: new Date().toISOString() };
    localStorage.setItem(`consult-style-${tenantId}`, JSON.stringify(updated));
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [profile, tenantId, actorId]);

  const addToList = (key: 'requiredCautions' | 'postConsultDocuments' | 'prohibitedExpressions', value: string, clearFn: (v: string) => void) => {
    if (!value.trim()) return;
    setProfile(prev => ({ ...prev, [key]: [...prev[key], value.trim()] }));
    clearFn('');
  };

  const removeFromList = (key: 'requiredCautions' | 'postConsultDocuments' | 'prohibitedExpressions', idx: number) => {
    setProfile(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 헤더 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand" />
              상담 스타일 프로필
            </h3>
            <p className="text-xs text-slate-500">
              고객에게 발송되는 상담 내용의 톤, 용어 수준, 주의사항 등을 설정합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="bg-slate-100 text-slate-700 rounded-xl px-4 py-2 font-bold text-sm hover:bg-slate-200 active:scale-[0.98] transition-all">
                ← 돌아가기
              </button>
            )}
            <button
              onClick={handleSave}
              className={`rounded-xl px-4 py-2 font-bold text-sm active:scale-[0.98] transition-all flex items-center gap-1.5 ${
                saved ? 'bg-green-600 text-white' : 'bg-brand text-white hover:bg-brand/90'
              }`}
            >
              <Save className="w-4 h-4" /> {saved ? '저장됨 ✓' : '저장'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 설명 분량 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-sm text-slate-800">📏 설명 분량</h4>
          <div className="space-y-2">
            {EXPLANATION_OPTIONS.map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all ${
                profile.explanationLength === opt.value ? 'bg-brand/5 border border-brand/20' : 'bg-slate-50 border border-transparent hover:bg-slate-100'
              }`}>
                <input
                  type="radio"
                  name="explanationLength"
                  checked={profile.explanationLength === opt.value}
                  onChange={() => setProfile(p => ({ ...p, explanationLength: opt.value as any }))}
                  className="accent-brand"
                />
                <div>
                  <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                  <p className="text-[11px] text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 용어 수준 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-sm text-slate-800">📖 용어 수준</h4>
          <div className="space-y-2">
            {TERMINOLOGY_OPTIONS.map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all ${
                profile.terminologyLevel === opt.value ? 'bg-brand/5 border border-brand/20' : 'bg-slate-50 border border-transparent hover:bg-slate-100'
              }`}>
                <input
                  type="radio"
                  name="terminologyLevel"
                  checked={profile.terminologyLevel === opt.value}
                  onChange={() => setProfile(p => ({ ...p, terminologyLevel: opt.value as any }))}
                  className="accent-brand"
                />
                <div>
                  <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                  <p className="text-[11px] text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 필수 주의사항 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> 필수 주의사항
          </h4>
          <p className="text-[11px] text-slate-500">고객 발송 시 항상 포함되는 안내 문구</p>
          <div className="space-y-1.5">
            {profile.requiredCautions.map((c, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50 rounded-lg p-2.5">
                <p className="text-xs text-amber-800 flex-1">{c}</p>
                <button onClick={() => removeFromList('requiredCautions', i)} className="text-amber-400 hover:text-red-500 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newCaution}
              onChange={e => setNewCaution(e.target.value)}
              placeholder="주의사항 추가..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === 'Enter' && addToList('requiredCautions', newCaution, setNewCaution)}
            />
            <button onClick={() => addToList('requiredCautions', newCaution, setNewCaution)} className="bg-amber-100 text-amber-700 rounded-xl px-3 py-2 text-xs font-bold hover:bg-amber-200 active:scale-[0.98] transition-all">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 금지 표현 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
            🚫 금지 표현
          </h4>
          <p className="text-[11px] text-slate-500">고객 발송문에 사용하면 안 되는 표현 (변호사법 광고 규정)</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.prohibitedExpressions.map((exp, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-red-700 rounded-lg px-2.5 py-1 text-xs font-bold">
                {exp}
                <button onClick={() => removeFromList('prohibitedExpressions', i)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newProhibited}
              onChange={e => setNewProhibited(e.target.value)}
              placeholder="금지 표현 추가..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === 'Enter' && addToList('prohibitedExpressions', newProhibited, setNewProhibited)}
            />
            <button onClick={() => addToList('prohibitedExpressions', newProhibited, setNewProhibited)} className="bg-red-100 text-red-700 rounded-xl px-3 py-2 text-xs font-bold hover:bg-red-200 active:scale-[0.98] transition-all">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 상담 후 안내 서류 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-500" /> 상담 후 안내 서류
          </h4>
          <p className="text-[11px] text-slate-500">1차 상담 후 고객에게 안내할 준비 서류 목록</p>
          <div className="space-y-1.5">
            {profile.postConsultDocuments.map((doc, i) => (
              <div key={i} className="flex items-center gap-2 bg-blue-50 rounded-lg p-2.5">
                <p className="text-xs text-blue-800 flex-1">{doc}</p>
                <button onClick={() => removeFromList('postConsultDocuments', i)} className="text-blue-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newDoc}
              onChange={e => setNewDoc(e.target.value)}
              placeholder="서류명 추가..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === 'Enter' && addToList('postConsultDocuments', newDoc, setNewDoc)}
            />
            <button onClick={() => addToList('postConsultDocuments', newDoc, setNewDoc)} className="bg-blue-100 text-blue-700 rounded-xl px-3 py-2 text-xs font-bold hover:bg-blue-200 active:scale-[0.98] transition-all">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 공식 링크 스타일 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-sm text-slate-800">🔗 공식 링크 표시 방식</h4>
          <div className="space-y-2">
            {LINK_STYLE_OPTIONS.map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all ${
                profile.officialLinkStyle === opt.value ? 'bg-brand/5 border border-brand/20' : 'bg-slate-50 border border-transparent hover:bg-slate-100'
              }`}>
                <input
                  type="radio"
                  name="linkStyle"
                  checked={profile.officialLinkStyle === opt.value}
                  onChange={() => setProfile(p => ({ ...p, officialLinkStyle: opt.value as any }))}
                  className="accent-brand"
                />
                <span className="text-sm font-bold text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
