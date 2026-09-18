import React, { useState } from 'react';
import { 
  X, ExternalLink, ShieldCheck, AlertTriangle, CheckCircle2, 
  Upload, Printer, Send, Copy, FileText, Check, HelpCircle, Building2, PhoneCall
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from './ModalPortal';

export interface IssuanceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  docTitle: string;
  docCode?: string;
  agencyName: string;
  agencyUrl?: string;
  agencyPhone?: string;
  steps?: string[];
  tips?: string;
  maskingRequired?: boolean;
  validityPeriod?: string;
  clientName?: string;
  onUploadFile?: (file: File) => void;
  isUploaded?: boolean;
}

export default function DocumentIssuanceGuideModal({
  isOpen,
  onClose,
  docTitle,
  docCode,
  agencyName,
  agencyUrl,
  agencyPhone,
  steps = [],
  tips,
  maskingRequired = true,
  validityPeriod = '최근 1개월 이내 발급분 권장',
  clientName = '신청인',
  onUploadFile,
  isUploaded = false
}: IssuanceGuideModalProps) {
  if (!isOpen) return null;

  const [copiedLink, setCopiedLink] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 기본 스텝이 없는 경우 관공서별 디폴트 가이드 자동 제공
  const defaultSteps = steps.length > 0 ? steps : [
    `${agencyName} 공식 웹사이트에 접속합니다.`,
    '공동인증서, 금융인증서 또는 간편인증(카카오·토스·PASS)으로 본인확인 로그인을 진행합니다.',
    `민원 발급 메뉴에서 [${docTitle}]을(를) 검색 및 선택합니다.`,
    maskingRequired 
      ? '신청 옵션에서 "본인 외 주민등록번호 뒷자리 미표기(마스킹)"를 반드시 선택합니다.'
      : '발급 옵션에서 과거 이력 전체 포함 옵션을 선택합니다.',
    '발급 완료 후 PDF 파일로 다운로드하거나 스마트폰으로 선명하게 촬영하여 업로드합니다.'
  ];

  const handleCopyLink = () => {
    if (agencyUrl && navigator.clipboard) {
      navigator.clipboard.writeText(agencyUrl);
      setCopiedLink(true);
      toast.success('발급처 바로가기 링크가 복사되었습니다.');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSendKakaoGuide = () => {
    const msg = `[법률사무소 서류 발급 안내]\n${clientName} 님, 회생·파산 법원 제출용 [${docTitle}] 발급 방법 안내입니다.\n\n▶ 발급기관: ${agencyName}\n▶ 발급링크: ${agencyUrl || '관할 주민센터 또는 웹사이트'}\n▶ 주의사항: ${maskingRequired ? '본인 외 가족 주민번호 뒷자리 마스킹(******) 필수' : '과거 이력 전체 포함 발급'}\n\n발급 후 모바일 서류함에 업로드해 주시기 바랍니다.`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg);
      toast.success(`[알림톡 안내문 복사 완료] ${clientName}님께 전송할 카카오톡/문자 안내 문구가 복사되었습니다.`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (onUploadFile) {
        onUploadFile(file);
      }
      toast.success(`'${file.name}' 파일이 등록되었습니다.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (onUploadFile) {
        onUploadFile(file);
      }
      toast.success(`'${file.name}' 파일이 등록되었습니다.`);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-xs animate-fadeIn text-left">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
          
          {/* 상단 헤더 */}
          <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-lg">
                🏛️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {docCode ? `서식 #${docCode}` : '관공서 발급 서류'}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    {agencyName}
                  </span>
                </div>
                <h3 className="font-extrabold text-base text-white mt-1">
                  {docTitle} 발급 안내
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 본문 스크롤 영역 */}
          <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-xs">
            
            {/* 1. 발급처 배너 & 원클릭 이동 버튼 */}
            <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>공식 발급처: {agencyName}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {agencyPhone ? `문의 콜센터: ${agencyPhone}` : '공인 온라인 포털 또는 전국 주민센터/지사 방문 발급 가능'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {agencyUrl && (
                  <a
                    href={agencyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale whitespace-nowrap cursor-pointer text-xs"
                  >
                    <span>온라인 바로가기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {agencyUrl && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-xl transition-all cursor-pointer"
                    title="발급 URL 복사"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* 2. 개인정보보호 제3자 마스킹 준칙 (법원 보정명령 1순위 사전 예방) */}
            {maskingRequired && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <div className="font-extrabold text-xs flex items-center gap-2 text-amber-900">
                    <span>법원 개인정보보호 필수 준칙: 제3자 주민번호 뒷자리 마스킹</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 font-bold">보정 예방</span>
                  </div>
                  <p className="text-[11px] text-slate-700">
                    신청인 본인을 제외한 <strong>가족(배우자, 부모, 자녀 등)의 주민등록번호 뒷자리는 반드시 미표기(******)</strong>된 서류를 발급받으셔야 법원에 정상 접수되며 보정명령을 받지 않습니다.
                  </p>
                </div>
              </div>
            )}

            {/* 3. 단계별 발급 절차 */}
            <div className="space-y-2.5">
              <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[11px]">
                  📋
                </span>
                <span>상세 발급 순서 및 요령</span>
              </h4>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                {defaultSteps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-white border border-slate-300 text-slate-600 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="leading-relaxed flex-1 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 유효기간 및 추가 실무 팁 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                <span className="text-[10px] font-bold text-slate-400">법원 제출 권장 유효기간</span>
                <p className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{validityPeriod}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                <span className="text-[10px] font-bold text-slate-400">발급 형태 권장</span>
                <p className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>전자문서 PDF 원본 또는 선명한 사진</span>
                </p>
              </div>
            </div>

            {tips && (
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>실무 팁:</strong> {tips}</span>
              </div>
            )}

            {/* 5. 파일 드래그앤드롭 업로드 영역 */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>발급된 서류 바로 등록하기</span>
                </h4>
                {isUploaded && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    제출 완료됨
                  </span>
                )}
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  id={`guide-upload-${docCode || 'temp'}`}
                  onChange={handleFileChange}
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  className="hidden"
                />
                <label
                  htmlFor={`guide-upload-${docCode || 'temp'}`}
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-blue-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800">
                      {selectedFile ? selectedFile.name : '클릭하여 파일을 선택하거나 이곳에 끌어다 놓으세요'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      PDF, JPG, PNG 파일 지원 (최대 50MB)
                    </p>
                  </div>
                </label>
              </div>
            </div>

          </div>

          {/* 하단 버튼 툴바 */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={handleSendKakaoGuide}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-amber-950 font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs press-scale cursor-pointer text-xs"
              title="고객에게 알림톡/카톡으로 이 발급 가이드를 즉시 전송합니다"
            >
              <Send className="w-3.5 h-3.5" />
              <span>고객에게 카톡 가이드 발송</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer text-xs"
            >
              닫기
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
}
