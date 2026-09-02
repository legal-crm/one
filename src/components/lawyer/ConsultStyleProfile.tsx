import React, { useState, useCallback } from 'react';
import { Save, Plus, Trash2, MessageSquare, AlertTriangle, BookOpen, Ban, Link2, FileText, Check } from 'lucide-react';
import type { ConsultStyleProfile as ConsultStyleProfileType } from '../../types/copilot';

// ============================================================
// 상담 스타일 프로필 설정 (고밀도 슬림 UI)
// ============================================================

interface ConsultStyleProfileProps {
  tenantId: string;
  actorId: string;
  actorName: string;
  onBack?: () => void;
}

const EXPLANATION_OPTIONS = [
  { value: 'brief', label: '간결하게', desc: '핵심 요약' },
  { value: 'normal', label: '보통', desc: '표준 분량' },
  { value: 'detailed', label: '상세하게', desc: '배경+예시' },
];

const TERMINOLOGY_OPTIONS = [
  { value: 'easy', label: '쉬운 표현', desc: '풀어서 설명' },
  { value: 'moderate', label: '보통', desc: '기본 용어' },
  { value: 'professional', label: '전문 용어', desc: '법리·조문 중심' },
];

const LINK_STYLE_OPTIONS = [
  { value: 'inline', label: '본문 삽입' },
  { value: 'footnote', label: '각주 표시' },
  { value: 'appendix', label: '별첨 첨부' },
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
      postConsultDocuments: ['주민등록등본(전체주소 포함)', '소득금액증명원', '부채증명서'],
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
      {/* ── 헤더 바 ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand" />
            <span>AI 및 상담 스타일 프로필</span>
          </h3>
          <p className="text-xs text-slate-500">
            의뢰인에게 발송되는 제안서·안내문·상담 답변의 어조, 용어 수준, 법적 고지 및 금지 표현을 설정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {onBack && (
            <button onClick={onBack} className="bg-slate-100 text-slate-700 rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-slate-200 active:scale-[0.98] transition-all">
              ← 돌아가기
            </button>
          )}
          <button
            onClick={handleSave}
            className={`rounded-xl px-4 py-2 font-bold text-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              saved ? 'bg-emerald-600 text-white' : 'bg-brand text-white hover:bg-brand-hover'
            }`}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saved ? '저장 완료' : '설정 저장'}</span>
          </button>
        </div>
      </div>

      {/* ── 2열 고밀도 설정 그리드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 1. 설명 분량 (세그먼트 컨트롤) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand" /> 설명 분량
            </h4>
            <span className="text-[11px] text-slate-400">제안서 및 상담문 기본 길이</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            {EXPLANATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProfile(p => ({ ...p, explanationLength: opt.value as any }))}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  profile.explanationLength === opt.value
                    ? 'bg-white text-brand shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="text-xs">{opt.label}</div>
                <div className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 2. 용어 수준 (세그먼트 컨트롤) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-brand" /> 용어 수준
            </h4>
            <span className="text-[11px] text-slate-400">의뢰인 눈높이 맞춤</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            {TERMINOLOGY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProfile(p => ({ ...p, terminologyLevel: opt.value as any }))}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  profile.terminologyLevel === opt.value
                    ? 'bg-white text-brand shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="text-xs">{opt.label}</div>
                <div className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. 필수 주의사항 (법적 고지) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> 필수 주의사항 (법적 면책 고지)
            </h4>
            <span className="text-[10px] text-amber-600 font-bold">발송문 하단 필수 삽입</span>
          </div>
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
            {profile.requiredCautions.map((c, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-50/70 border border-amber-200/60 rounded-xl p-2 text-xs">
                <p className="text-amber-900 flex-1 leading-relaxed text-[11px] font-medium">{c}</p>
                <button onClick={() => removeFromList('requiredCautions', i)} className="text-amber-400 hover:text-rose-500 shrink-0 p-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            <input
              value={newCaution}
              onChange={e => setNewCaution(e.target.value)}
              placeholder="추가할 주의사항 안내문 입력..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === 'Enter' && addToList('requiredCautions', newCaution, setNewCaution)}
            />
            <button onClick={() => addToList('requiredCautions', newCaution, setNewCaution)} className="bg-amber-100 text-amber-800 rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-amber-200 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4. 금지 표현 (변호사법 광고 규정 필터) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-rose-500" /> 금지 표현 (변호사법 광고 규정 필터)
            </h4>
            <span className="text-[10px] text-rose-600 font-bold">단정적·과장 광고 방지</span>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 bg-slate-50 border border-slate-100 rounded-xl">
            {profile.prohibitedExpressions.map((exp, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-2 py-0.5 text-xs font-bold">
                {exp}
                <button onClick={() => removeFromList('prohibitedExpressions', i)} className="text-rose-400 hover:text-rose-700 p-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            <input
              value={newProhibited}
              onChange={e => setNewProhibited(e.target.value)}
              placeholder="금지 표현 추가 (예: 획기적 탕감)..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === 'Enter' && addToList('prohibitedExpressions', newProhibited, setNewProhibited)}
            />
            <button onClick={() => addToList('prohibitedExpressions', newProhibited, setNewProhibited)} className="bg-rose-100 text-rose-800 rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-rose-200 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 5. 상담 후 안내 서류 (템플릿 서류) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-500" /> 상담 후 필수 안내 서류 목록
            </h4>
            <span className="text-[10px] text-blue-600 font-bold">1차 상담 시 동봉</span>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 bg-slate-50 border border-slate-100 rounded-xl">
            {profile.postConsultDocuments.map((doc, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-2 py-0.5 text-xs font-bold">
                {doc}
                <button onClick={() => removeFromList('postConsultDocuments', i)} className="text-blue-400 hover:text-blue-700 p-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            <input
              value={newDoc}
              onChange={e => setNewDoc(e.target.value)}
              placeholder="서류명 추가 (예: 원천징수영수증)..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={e => e.key === 'Enter' && addToList('postConsultDocuments', newDoc, setNewDoc)}
            />
            <button onClick={() => addToList('postConsultDocuments', newDoc, setNewDoc)} className="bg-blue-100 text-blue-800 rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-blue-200 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 6. 공식 링크 표시 방식 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-slate-600" /> 공식 링크 표시 방식
            </h4>
            <span className="text-[11px] text-slate-400">대법원 판례·전자소송 링크</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            {LINK_STYLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProfile(p => ({ ...p, officialLinkStyle: opt.value as any }))}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                  profile.officialLinkStyle === opt.value
                    ? 'bg-white text-brand shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

