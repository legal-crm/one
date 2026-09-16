import React, { useState, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, ShieldCheck, Eye, 
  RotateCw, ZoomIn, ZoomOut, ChevronRight, ChevronLeft,
  FileCheck2, CheckCircle2, Send, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export interface ReviewDocItem {
  id: string;
  name: string;
  agency: string;
  isRequired: boolean;
  isThirdPartyMaskingRequired?: boolean;
  fileUrl?: string;
  uploadedAt?: string;
}

interface SpeedDocReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  reviewDocs: ReviewDocItem[];
  onApproveDoc: (docId: string) => void;
  onRejectDoc: (docId: string, reason: string) => void;
}

export default function SpeedDocReviewModal({
  isOpen,
  onClose,
  clientName,
  reviewDocs,
  onApproveDoc,
  onRejectDoc,
}: SpeedDocReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [checkList, setCheckList] = useState({
    docTypeValid: true,
    issueDateValid: true,
    maskingValid: true,
    clarityValid: true,
  });
  const [rejectReason, setRejectReason] = useState('상세증명서가 아닌 일반증명서가 제출되었습니다.');
  const [showRejectBox, setShowRejectBox] = useState(false);

  useEffect(() => {
    // 서류 변경 시 체크리스트 리셋
    setCheckList({
      docTypeValid: true,
      issueDateValid: true,
      maskingValid: true,
      clarityValid: true,
    });
    setShowRejectBox(false);
  }, [currentIndex]);

  if (!isOpen || reviewDocs.length === 0) return null;

  const currentDoc = reviewDocs[currentIndex] || reviewDocs[0];
  const totalCount = reviewDocs.length;
  const isLast = currentIndex >= totalCount - 1;

  const handleApproveCurrent = () => {
    onApproveDoc(currentDoc.id);
    toast.success(`'${currentDoc.name}' 승인 완료되었습니다.`);
    if (isLast) {
      toast.success('모든 대기 서류의 연속 검토가 완료되었습니다!');
      onClose();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) {
      toast.error('보완 요청 사유를 입력해주세요.');
      return;
    }
    onRejectDoc(currentDoc.id, rejectReason);
    toast.warning(`'${currentDoc.name}' 보완 요청 알림톡이 고객에게 전송되었습니다.`);
    if (isLast) {
      onClose();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 md:p-6 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full h-[85vh] max-h-[740px] overflow-hidden flex flex-col">
        {/* 헤더 바 */}
        <div className="px-6 py-3.5 bg-[#1E3A5F] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight">
                  연속 서류 신속 검토 모드
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-[10px] font-bold font-mono">
                  {currentIndex + 1} / {totalCount}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                {clientName} 고객 · <strong className="text-white">{currentDoc.name}</strong> ({currentDoc.agency})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 text-white transition-colors cursor-pointer"
                title="이전 서류"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={() => setCurrentIndex(prev => Math.min(totalCount - 1, prev + 1))}
                className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 text-white transition-colors cursor-pointer"
                title="다음 서류"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 메인 2단 뷰어 & 체크리스트 영역 */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100">
          {/* 좌측: 문서 뷰어 캔버스 (마스킹 하이라이트) */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden bg-slate-900/5 select-none">
            {/* 가상 문서 뷰어 시뮬레이션 */}
            <div className="bg-white rounded-xl shadow-md border border-slate-300 w-full max-w-lg h-full max-h-[580px] p-6 flex flex-col justify-between text-slate-800 relative overflow-hidden font-mono text-xs">
              <div className="text-center border-b pb-3 space-y-1">
                <div className="text-base font-black text-slate-900">{currentDoc.name}</div>
                <div className="text-[10px] text-slate-400">발급처: {currentDoc.agency} | 발급일: 2026.09.11</div>
              </div>

              <div className="space-y-4 py-4 text-[11px] leading-relaxed">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900 mb-1">신청인(본인) 인적사항</div>
                  <div className="flex justify-between text-slate-600">
                    <span>성명: {clientName}</span>
                    <span>주민번호: 820315-1****** (본인 공개)</span>
                  </div>
                  <div className="text-slate-600 mt-1">
                    주소: 인천광역시 미추홀구 석바위로 123
                  </div>
                </div>

                {/* 제3자 마스킹 영역 (주황색 테두리 하이라이트) */}
                <div className={`p-3 rounded-lg border transition-all ${
                  currentDoc.isThirdPartyMaskingRequired 
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30' 
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">세대원 / 가족 관계</span>
                    {currentDoc.isThirdPartyMaskingRequired && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">
                        제3자 마스킹 필수 구간
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>배우자: 이○○ (1984년생)</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">840920-2****** (마스킹 완료)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>자녀: 윤○○ (2015년생)</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">150412-3****** (마스킹 완료)</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 text-[10px] text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>AI 서식 분석: 서식 유효기간(3개월 이내) 및 가족 뒷자리 마스킹 통과</span>
                </div>
              </div>

              <div className="pt-2 border-t text-[10px] text-slate-400 flex justify-between">
                <span>정부24 전자문서 확인번호: 4829-1029-4920</span>
                <span>공공데이터 전자직인 날인됨</span>
              </div>
            </div>

            {/* 플로팅 컨트롤 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xs text-white px-4 py-1.5 rounded-full flex items-center gap-3 text-xs shadow-lg">
              <button type="button" className="hover:text-blue-300 cursor-pointer p-1" title="확대"><ZoomIn className="w-3.5 h-3.5" /></button>
              <button type="button" className="hover:text-blue-300 cursor-pointer p-1" title="축소"><ZoomOut className="w-3.5 h-3.5" /></button>
              <button type="button" className="hover:text-blue-300 cursor-pointer p-1" title="회전"><RotateCw className="w-3.5 h-3.5" /></button>
              <span className="text-[10px] text-slate-400 font-mono">100%</span>
            </div>
          </div>

          {/* 우측: 필수 검증 체크리스트 및 판정 패널 */}
          <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col h-full overflow-hidden">
            {/* 상단 스크롤 가능 체크리스트 본문 */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#1E3A5F]" />
                  <span>사무장 적격 검증 체크리스트</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  법원 보정명령 방지를 위해 4대 항목을 체크하세요.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkList.docTypeValid}
                    onChange={e => setCheckList(p => ({ ...p, docTypeValid: e.target.checked }))}
                    className="mt-0.5 rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                  />
                  <div>
                    <div className="font-bold text-slate-900">문서 종류 일치 확인</div>
                    <div className="text-[10px] text-slate-500">요구 서식('{currentDoc.name}')과 정확히 일치함</div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkList.issueDateValid}
                    onChange={e => setCheckList(p => ({ ...p, issueDateValid: e.target.checked }))}
                    className="mt-0.5 rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                  />
                  <div>
                    <div className="font-bold text-slate-900">발급일 3개월 이내 유효</div>
                    <div className="text-[10px] text-slate-500">2026.09.11 발급 (법원 제출 유효)</div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkList.maskingValid}
                    onChange={e => setCheckList(p => ({ ...p, maskingValid: e.target.checked }))}
                    className="mt-0.5 rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                  />
                  <div>
                    <div className="font-bold text-slate-900">제3자 주민번호 마스킹 확인</div>
                    <div className="text-[10px] text-slate-500">신청인 외 가족 뒷자리 6자리 별표 표시됨</div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkList.clarityValid}
                    onChange={e => setCheckList(p => ({ ...p, clarityValid: e.target.checked }))}
                    className="mt-0.5 rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                  />
                  <div>
                    <div className="font-bold text-slate-900">식별 가능성 및 해상도 양호</div>
                    <div className="text-[10px] text-slate-500">글자 잘림, 빛 반사, 번짐 없음</div>
                  </div>
                </label>
              </div>

              {/* 보완 요청 사유 입력창 (토글 시 노출) */}
              {showRejectBox && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs animate-fadeIn">
                  <div className="font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>고객에게 보낼 보완 사유</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      '상세증명서가 아닌 일반증명서가 제출되었습니다.',
                      '가족 주민등록번호 뒷자리가 마스킹되지 않았습니다.',
                      '발급일이 3개월을 초과하여 재발급이 필요합니다.',
                      '사진이 흐려 글자를 판독하기 어렵습니다.',
                    ].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRejectReason(r)}
                        className="w-full text-left p-1.5 rounded hover:bg-rose-100 text-[11px] text-rose-800 transition-colors cursor-pointer"
                      >
                        • {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    className="w-full p-2 border border-rose-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectBox(false)}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReject}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg cursor-pointer press-scale"
                    >
                      알림톡 발송
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 고정 2대 액션 버튼 (항상 100% 온전히 노출되는 Sticky Footer) */}
            <div className="p-4 bg-slate-50/90 border-t border-slate-200 shrink-0 space-y-2">
              <button
                type="button"
                onClick={handleApproveCurrent}
                className="w-full py-3 bg-[#1E3A5F] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer press-scale"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>✓ 승인하고 다음 서류로 {isLast ? '(마지막)' : ''}</span>
              </button>

              {!showRejectBox && (
                <button
                  type="button"
                  onClick={() => setShowRejectBox(true)}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>보완 요청 알림톡 보내기</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
