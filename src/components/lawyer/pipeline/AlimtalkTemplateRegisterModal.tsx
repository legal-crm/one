import React, { useState } from 'react';
import { 
  X, Send, Sparkles, ExternalLink, ShieldCheck, 
  HelpCircle, AlertCircle, Plus, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  registerNewTemplateForReview, 
  extractTemplateVariables, 
  compileTemplateWithVariables,
  type PopbillAlimtokTemplate 
} from '../../../services/alimtokService';

interface AlimtalkTemplateRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStage?: number;
  templateMgtUrl?: string;
  onRegistered?: (newTemplate: PopbillAlimtokTemplate) => void;
}

const COMMON_VARIABLE_CHIPS = [
  { label: '고객명', tag: '#{고객명}' },
  { label: '법무법인', tag: '#{법무법인}' },
  { label: '담당변호사', tag: '#{담당변호사}' },
  { label: '사건유형', tag: '#{사건유형}' },
  { label: '마감기한', tag: '#{마감기한}' },
  { label: '수임료', tag: '#{수임료}' },
  { label: '입금계좌', tag: '#{입금계좌}' },
  { label: '사건번호', tag: '#{사건번호}' },
  { label: '관할법원', tag: '#{관할법원}' },
  { label: '안내링크', tag: '#{안내링크}' },
];

export default function AlimtalkTemplateRegisterModal({
  isOpen,
  onClose,
  initialStage = 1,
  templateMgtUrl = 'https://www.popbill.com/KakaoTalk/?TG=TEMPLATE',
  onRegistered,
}: AlimtalkTemplateRegisterModalProps) {
  const [templateName, setTemplateName] = useState('');
  const [templateCode, setTemplateCode] = useState(`MYKIM_ATS_${Date.now().toString().slice(-4)}`);
  const [stage, setStage] = useState(initialStage);
  const [templateText, setTemplateText] = useState(
    `[#{법무법인}] 안내 말씀\n\n#{고객명}님, 의뢰하신 #{사건유형} 사건과 관련하여 안내해 드립니다.\n\n■ 마감 기한: #{마감기한}\n■ 담당 변호사: #{담당변호사}\n\n상세 내용은 아래 링크에서 확인하실 수 있습니다.\n▶ 안내 링크: #{안내링크}`
  );
  const [buttonName, setButtonName] = useState('진행상황 확인하기');
  const [buttonUrl, setButtonUrl] = useState('https://mykim.kr/my');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const detectedVariables = extractTemplateVariables(templateText);

  // 변수 삽입 헬퍼
  const handleInsertTag = (tag: string) => {
    setTemplateText(prev => prev + tag);
  };

  // 모의 치환 미리보기
  const previewSampleVars: Record<string, string> = {
    '법무법인': '법무법인 김우진',
    '고객명': '홍길동',
    '담당변호사': '김우진 변호사',
    '사건유형': '개인회생',
    '마감기한': '3일 이내 (9월 16일)',
    '수임료': '150만원',
    '입금계좌': '신한은행 110-384-918231',
    '사건번호': '2026개회104291',
    '관할법원': '서울회생법원',
    '안내링크': 'https://mykim.kr/my',
  };

  const previewCompiled = compileTemplateWithVariables(templateText, previewSampleVars);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!templateName.trim()) {
      toast.error('템플릿 명칭을 입력해주세요.');
      return;
    }
    if (!templateText.trim()) {
      toast.error('템플릿 문안을 작성해주세요.');
      return;
    }
    if (detectedVariables.length === 0) {
      toast.error('최소 1개 이상의 치환 변수(#{변수명})가 포함되어야 합니다.');
      return;
    }

    setIsSubmitting(true);

    const newTemplate: PopbillAlimtokTemplate = {
      templateCode: templateCode.trim(),
      templateName: templateName.trim(),
      template: templateText.trim(),
      state: '심사중',
      stage,
      category: `Stage 0${stage}`,
      buttons: buttonName ? [{ name: buttonName, type: 'WL', urlMobile: buttonUrl, urlPc: buttonUrl }] : undefined,
      registeredAt: new Date().toISOString().split('T')[0],
      memo: '신규 검수 심사 신청 접수됨',
    };

    registerNewTemplateForReview(newTemplate);

    setTimeout(() => {
      setIsSubmitting(false);
      toast.success(`[${templateName}] 템플릿이 팝빌/카카오 검수 심사에 성공적으로 접수되었습니다. (검수 상태: 심사중)`);
      if (onRegistered) {
        onRegistered(newTemplate);
      }
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* 헤더 */}
        <div className="p-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FAE100] text-[#391B1B] flex items-center justify-center font-black text-xs shadow-xs">
              TALK
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">알림톡 신규 템플릿 등록 및 심사 신청</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                  팝빌 공식 연동
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                카카오 비즈니스 심사 가이드라인에 따라 템플릿을 등록하고 승인을 요청합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 가이드 배너 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed space-y-0.5">
              <p className="font-bold">카카오 알림톡 사전 검수 승인 제도</p>
              <p className="text-blue-700">
                카카오 규정에 따라 광고성 문구는 반려될 수 있으며, 정보성 안내문구만 심사 통과됩니다.
                가변적인 정보는 반드시 <span className="font-bold font-mono bg-blue-100 px-1 py-0.5 rounded text-blue-800">#&#123;변수명&#125;</span> 형태로 지정하세요.
              </p>
            </div>
          </div>

          {/* 템플릿 기본 정보 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">템플릿 명칭 <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="예: [보정] 2차 서류 미제출 소명요청 안내"
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#1E3A5F] focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">파이프라인 단계</label>
              <select
                value={stage}
                onChange={e => setStage(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#1E3A5F] focus:outline-none font-bold"
              >
                <option value={1}>Stage 01 상담·적격</option>
                <option value={2}>Stage 02 계약·착수</option>
                <option value={3}>Stage 03 서류수집</option>
                <option value={4}>Stage 04 법원접수</option>
                <option value={5}>Stage 05 법원보정</option>
                <option value={6}>Stage 06 사후관리</option>
              </select>
            </div>
          </div>

          {/* 템플릿 본문 에디터 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>템플릿 고정 문안 및 변수 삽입</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (감지된 변수: {detectedVariables.length}개)
                </span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {templateText.length}자 / 최대 1,000자
              </span>
            </div>

            {/* 치환 변수 원클릭 삽입 칩 */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mr-1">
                <Plus className="w-3 h-3 text-slate-400" />
                변수 삽입:
              </span>
              {COMMON_VARIABLE_CHIPS.map(chip => (
                <button
                  key={chip.tag}
                  type="button"
                  onClick={() => handleInsertTag(chip.tag)}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 font-mono text-[10px] transition-all cursor-pointer shadow-2xs press-scale"
                  title={`${chip.tag} 삽입`}
                >
                  +{chip.label}
                </button>
              ))}
            </div>

            <textarea
              rows={6}
              value={templateText}
              onChange={e => setTemplateText(e.target.value)}
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs leading-relaxed text-slate-900 focus:ring-1 focus:ring-[#1E3A5F] focus:outline-none resize-none font-sans"
              placeholder="알림톡 본문을 입력하세요. 고정 문구와 #{변수명}을 조합하여 작성합니다."
            />
          </div>

          {/* 버튼 링크 설정 (옵션) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-[11px]">카카오 알림톡 하단 버튼명 (선택)</label>
              <input
                type="text"
                value={buttonName}
                onChange={e => setButtonName(e.target.value)}
                placeholder="예: 마이페이지 확인하기"
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-[11px]">연결 웹링크 URL</label>
              <input
                type="text"
                value={buttonUrl}
                onChange={e => setButtonUrl(e.target.value)}
                placeholder="https://mykim.kr/my"
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* 실시간 승인 미리보기 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>카카오톡 승인 시 수신 화면 실시간 미리보기</span>
            </label>
            <div className="bg-[#FAE100] rounded-2xl p-3.5 shadow-inner space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#391B1B]/80 font-bold border-b border-[#391B1B]/10 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#391B1B] text-white flex items-center justify-center font-black text-[8px]">
                    TALK
                  </div>
                  <span>알림톡 도착</span>
                </div>
                <span className="text-[10px] opacity-75">승인 후 수신자 화면</span>
              </div>

              <div className="bg-white rounded-xl rounded-tl-none p-3 text-xs leading-relaxed text-slate-900 border border-yellow-300 whitespace-pre-wrap shadow-xs">
                {previewCompiled}
              </div>

              {buttonName && (
                <div className="pt-1">
                  <div className="w-full py-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-800 text-xs shadow-2xs">
                    {buttonName} ↗
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 하단 팝빌 관리자 센터 이동 안내 */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>팝빌 콘솔에서 직접 검수 상태를 확인하고 승인 내역을 관리할 수 있습니다.</span>
            <a
              href={templateMgtUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#1E3A5F] hover:underline flex items-center gap-1 shrink-0"
            >
              <span>팝빌 템플릿 관리센터</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* 모달 버튼 액션 */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-bold text-xs text-slate-600 cursor-pointer press-scale"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#FAE100] hover:bg-[#F4D700] text-[#391B1B] font-extrabold text-xs shadow-xs cursor-pointer press-scale flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '심사 접수 중...' : '카카오 알림톡 검수 심사 신청'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
