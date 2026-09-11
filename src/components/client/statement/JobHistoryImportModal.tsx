import React, { useState } from 'react';
import { 
  X, Building2, Smartphone, FileUp, CheckCircle2, 
  AlertCircle, RefreshCw, ShieldCheck, ArrowRight, Check, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import type { RetrievedJobHistoryItem, JobHistoryImportParams } from '../../../types/jobHistoryTypes';
import { JobHistoryService } from '../../../services/jobHistoryService';
import type { JobHistoryItem } from '../../../types/statementTypes';

interface JobHistoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  onConfirmImport: (importedItems: JobHistoryItem[]) => void;
}

export default function JobHistoryImportModal({
  isOpen,
  onClose,
  clientName = '신청인',
  onConfirmImport
}: JobHistoryImportModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'auth' | 'document'>('auth');
  const [isLoading, setIsLoading] = useState(false);

  // A안: 간편인증 폼 상태
  const [authName, setAuthName] = useState(clientName);
  const [rrnFront, setRrnFront] = useState('850101');
  const [phone, setPhone] = useState('01012345678');
  const [telecom, setTelecom] = useState<'SKT' | 'KT' | 'LGU' | 'MVNO'>('SKT');
  const [authType, setAuthType] = useState<'KAKAO' | 'PASS' | 'NAVER' | 'TOSS'>('KAKAO');

  // 조회된 경력 목록
  const [retrievedItems, setRetrievedItems] = useState<RetrievedJobHistoryItem[]>([]);
  const [hasQueried, setHasQueried] = useState(false);

  // A안: 간편인증 실행
  const handleRunAuthScraping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authName || !rrnFront || !phone) {
      toast.error('이름, 생년월일, 휴대폰 번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      toast.info(`[${authType}] 간편인증 요청을 전송 중입니다. 스마트폰 알림을 확인해 주세요.`);
      const result = await JobHistoryService.fetchFromNationalPension({
        name: authName,
        rrnFront,
        phone,
        telecom,
        authType
      });

      if (result.ok && result.items.length > 0) {
        setRetrievedItems(result.items);
        setHasQueried(true);
        toast.success(`국민연금공단에서 ${result.items.length}건의 직장 가입 이력을 성공적으로 불러왔습니다!`);
      } else {
        toast.error('가입 이력을 불러오지 못했습니다. 다시 시도해 주세요.');
      }
    } catch {
      toast.error('조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // B안: 자격득실확인서 파일 업로드 및 Vision OCR
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (uploadEvt) => {
      const base64 = uploadEvt.target?.result as string;
      try {
        toast.info('제미나이 Vision AI가 자격득실확인서 표를 분석 중입니다...');
        const result = await JobHistoryService.parseJobHistoryFromDocumentImage(base64, file.name);
        if (result.ok && result.items.length > 0) {
          setRetrievedItems(result.items);
          setHasQueried(true);
          toast.success(`서류에서 ${result.items.length}건의 직장 경력을 성공적으로 추출했습니다!`);
        } else {
          toast.error('서류에서 경력을 인식하지 못했습니다. 선명한 사진으로 다시 시도해 주세요.');
        }
      } catch {
        toast.error('OCR 파싱 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // 체크박스 토글
  const toggleItemSelect = (id: string) => {
    setRetrievedItems(prev => prev.map(it => 
      it.id === id ? { ...it, selected: !it.selected } : it
    ));
  };

  // 진술서에 넣기 확정
  const handleApplyToStatement = () => {
    const selected = retrievedItems.filter(it => it.selected);
    if (selected.length === 0) {
      toast.error('진술서에 추가할 경력을 1개 이상 선택해 주세요.');
      return;
    }

    const mapped: JobHistoryItem[] = selected.map(it => ({
      period: it.periodText,
      companyName: it.workplaceName,
      position: it.suggestedPosition || '직원',
      reasonForLeaving: it.leaveReason || (it.isCurrent ? '재직 중' : '퇴직')
    }));

    onConfirmImport(mapped);
    toast.success(`${mapped.length}개 직장 경력이 진술서에 자동으로 채워졌습니다!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              🏢
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  내 과거 직장경력 한 번에 불러오기
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300">
                  국민연금 · 건강보험 연동
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                기억나지 않는 과거 직장명과 입·퇴사일을 공단 데이터로 1초 만에 조회합니다.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 전환 (A안: 간편인증 vs B안: 서류사진 업로드) */}
        {!hasQueried && (
          <div className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'auth'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>📱 카카오/PASS 간편인증 (추천)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('document')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'document'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>📷 자격득실확인서 사진/PDF (1초 OCR)</span>
            </button>
          </div>
        )}

        {/* 본문 컨텐츠 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* 1. 조회 결과가 나왔을 때 (선택 화면) */}
          {hasQueried ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>공단에서 확인된 과거 직장 목록 ({retrievedItems.length}건)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    법원 진술서에 포함할 직장 경력을 선택해 주세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHasQueried(false);
                    setRetrievedItems([]);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>다시 조회하기</span>
                </button>
              </div>

              <div className="space-y-2">
                {retrievedItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleItemSelect(item.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      item.selected
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => {}}
                      className="mt-1 accent-indigo-600 w-4 h-4 rounded-md cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {item.workplaceName}
                        </span>
                        {item.isCurrent && (
                          <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-md">
                            재직 중
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                        <span>📅 기간: {item.periodText}</span>
                        <span>({item.durationMonths}개월)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* 2. A안: 간편인증 폼 */}
              {activeTab === 'auth' && (
                <form onSubmit={handleRunAuthScraping} className="space-y-4 animate-fadeIn">
                  <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      국민연금공단(NPS)에 등록된 과거 직장 이력을 안전하게 1회성으로 조회합니다. 조회된 정보는 진술서 표 작성 외 다른 목적으로 저장되지 않습니다.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">성명</label>
                      <input
                        type="text"
                        value={authName}
                        onChange={e => setAuthName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                        placeholder="이름"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">생년월일 (6자리)</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={rrnFront}
                        onChange={e => setRrnFront(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                        placeholder="예: 850101"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">휴대폰 번호</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                        placeholder="01012345678"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">통신사</label>
                      <select
                        value={telecom}
                        onChange={e => setTelecom(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      >
                        <option value="SKT">SKT</option>
                        <option value="KT">KT</option>
                        <option value="LGU">LG U+</option>
                        <option value="MVNO">알뜰폰</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">간편인증 수단</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'KAKAO', label: '카카오톡', emoji: '🟡' },
                        { id: 'PASS', label: 'PASS 인증', emoji: '🔴' },
                        { id: 'NAVER', label: '네이버', emoji: '🟢' },
                        { id: 'TOSS', label: '토스', emoji: '🔵' },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAuthType(t.id as any)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            authType === t.id
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-xs'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span>{t.emoji}</span>
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer press-scale disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>국민연금공단에서 경력을 불러오는 중...</span>
                        </>
                      ) : (
                        <>
                          <span>국민연금 가입경력 1초 만에 불러오기</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* 3. B안: 자격득실확인서 서류 사진 업로드 OCR */}
              {activeTab === 'document' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 rounded-2xl flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <span>
                      정부24나 The건강보험 앱에서 다운받은 <strong>[건강보험 자격득실확인서]</strong> 또는 <strong>[국민연금 가입증명서]</strong> 캡처 사진/PDF를 올리시면, 제미나이 AI가 표를 인식하여 회사명과 기간을 자동으로 추출합니다.
                    </span>
                  </div>

                  <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3 cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                      <FileUp className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        확인서 사진 또는 PDF 파일을 이곳에 올려주세요
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        스마트폰 앨범 사진, 스크린샷 캡처, PDF 파일 지원
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </>
          )}

        </div>

        {/* 하단 버튼 바 */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
          >
            닫기
          </button>

          {hasQueried && (
            <button
              type="button"
              onClick={handleApplyToStatement}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Check className="w-4 h-4" />
              <span>선택한 경력 진술서에 넣기</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
