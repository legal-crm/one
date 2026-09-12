import React, { useState, useRef } from 'react';
import { 
  X, Upload, ShieldCheck, Check, Stamp, Image as ImageIcon,
  FileCheck2, AlertCircle, Trash2, Eye, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import type { LawyerSealInfo } from '../../types';

interface LawyerSealManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lawyerId: string;
  lawyerName: string;
  initialSealInfo?: LawyerSealInfo;
  onSaveSealInfo: (newInfo: LawyerSealInfo) => void;
}

export default function LawyerSealManagerModal({
  isOpen,
  onClose,
  lawyerId,
  lawyerName,
  initialSealInfo,
  onSaveSealInfo,
}: LawyerSealManagerModalProps) {
  const [sealInfo, setSealInfo] = useState<LawyerSealInfo>(() => {
    if (initialSealInfo) return initialSealInfo;
    try {
      const saved = localStorage.getItem(`legal_crm_lawyer_seal_${lawyerId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      autoSealContract: true,
      autoSealPetition: true,
      autoSealCorrection: true,
    };
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'firmLogoUrl' | 'lawyerSealUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('파일 크기는 2MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSealInfo(prev => ({ ...prev, [type]: dataUrl }));
      toast.success(`${type === 'firmLogoUrl' ? '로고' : '직인'} 이미지가 업로드되었습니다.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const updated: LawyerSealInfo = {
      ...sealInfo,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`legal_crm_lawyer_seal_${lawyerId}`, JSON.stringify(updated));
    onSaveSealInfo(updated);
    toast.success('법무법인 로고 및 변호사 직인 설정이 저장되었습니다.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-800">
        {/* 모달 헤더 */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">법무법인 로고 & 직인(인장) 관리</h3>
              <p className="text-xs text-slate-400">{lawyerName} 변호사 전자문서 날인 센터</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* 안내 배너 */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              등록하신 로고와 직인(도장)은 <strong>수임계약서, 소송위임장, 사실조회신청서, 법원 보정서</strong> 등 PDF 전자문서 생성 시 규격에 맞춰 자동 날인되어 출력됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. 법무법인 로고 */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col items-center text-center space-y-3">
              <span className="text-xs font-bold text-slate-700">법무법인/사무소 로고</span>
              
              <div className="w-28 h-20 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shadow-xs">
                {sealInfo.firmLogoUrl ? (
                  <img 
                    src={sealInfo.firmLogoUrl} 
                    alt="로고" 
                    className="max-w-full max-h-full object-contain" 
                  />
                ) : (
                  <div className="text-slate-300 flex flex-col items-center">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-[10px]">미등록</span>
                  </div>
                )}
              </div>

              <input 
                type="file" 
                ref={logoInputRef}
                accept="image/png, image/jpeg, image/svg+xml"
                onChange={e => handleFileUpload(e, 'firmLogoUrl')}
                className="hidden" 
              />

              <div className="flex gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="flex-1 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>로고 업로드</span>
                </button>
                {sealInfo.firmLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setSealInfo(prev => ({ ...prev, firmLogoUrl: undefined }))}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                    title="로고 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. 변호사 공인 직인/도장 (인장) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col items-center text-center space-y-3">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-700">변호사 공인 직인(인장)</span>
                <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 rounded">필수</span>
              </div>

              <div className="w-24 h-24 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-2 shadow-xs relative">
                {sealInfo.lawyerSealUrl ? (
                  <img 
                    src={sealInfo.lawyerSealUrl} 
                    alt="직인" 
                    className="w-full h-full object-contain" 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-red-300 flex flex-col items-center justify-center text-red-300">
                    <Stamp className="w-6 h-6" />
                    <span className="text-[9px] font-bold mt-0.5">인장 도장</span>
                  </div>
                )}
              </div>

              <input 
                type="file" 
                ref={sealInputRef}
                accept="image/png"
                onChange={e => handleFileUpload(e, 'lawyerSealUrl')}
                className="hidden" 
              />

              <div className="flex gap-1.5 w-full">
                <button
                  type="button"
                  onClick={() => sealInputRef.current?.click()}
                  className="flex-1 py-1.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold text-red-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>투명 PNG 도장 업로드</span>
                </button>
                {sealInfo.lawyerSealUrl && (
                  <button
                    type="button"
                    onClick={() => setSealInfo(prev => ({ ...prev, lawyerSealUrl: undefined }))}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                    title="직인 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 자동 날인 옵션 체크박스 */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
            <span className="font-bold text-slate-800 block">자동 날인 연동 설정</span>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input 
                  type="checkbox"
                  checked={sealInfo.autoSealContract ?? true}
                  onChange={e => setSealInfo(prev => ({ ...prev, autoSealContract: e.target.checked }))}
                  className="rounded accent-blue-600"
                />
                전자계약서 (수임 계약 체결본에 변호사 직인 자동 날인)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input 
                  type="checkbox"
                  checked={sealInfo.autoSealPetition ?? true}
                  onChange={e => setSealInfo(prev => ({ ...prev, autoSealPetition: e.target.checked }))}
                  className="rounded accent-blue-600"
                />
                소송위임장 및 사실조회신청서에 직인 자동 날인
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input 
                  type="checkbox"
                  checked={sealInfo.autoSealCorrection ?? true}
                  onChange={e => setSealInfo(prev => ({ ...prev, autoSealCorrection: e.target.checked }))}
                  className="rounded accent-blue-600"
                />
                법원 보정서 표지 및 대리인란 자동 날인
              </label>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>설정 저장하기</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
