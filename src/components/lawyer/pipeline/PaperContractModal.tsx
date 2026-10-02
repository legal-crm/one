import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Mail, 
  UploadCloud, 
  FileText, 
  Printer, 
  CheckCircle2, 
  ExternalLink, 
  Trash2, 
  AlertCircle,
  HelpCircle,
  Calendar,
  MapPin,
  PackageCheck
} from 'lucide-react';
import type { ElectronicContract } from '../../../types';

export interface PaperContractSubmitData {
  method: 'in_person' | 'postal';
  signedDate: string;
  scannedFiles: Array<{
    id: string;
    name: string;
    url: string;
    size?: number;
    uploadedAt: string;
  }>;
  postalInfo?: {
    recipientAddress: string;
    recipientDetailAddress?: string;
    postcode?: string;
    carrier?: string;
    trackingNumber?: string;
    sentDate?: string;
    returnedSignedDate?: string;
  };
  notes?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contract: ElectronicContract;
  onConfirm: (data: PaperContractSubmitData) => Promise<void>;
  onPrint: () => void;
}

export default function PaperContractModal({
  isOpen,
  onClose,
  contract,
  onConfirm,
  onPrint,
}: Props) {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const existingPaper = contract.paperContractInfo;
  const initialMethod = (contract.contractMethod === 'postal' || existingPaper?.method === 'postal') ? 'postal' : 'in_person';

  const [method, setMethod] = useState<'in_person' | 'postal'>(initialMethod);
  const [signedDate, setSignedDate] = useState<string>(existingPaper?.signedDate || todayStr);
  const [notes, setNotes] = useState<string>(existingPaper?.notes || '');

  // 우편 등기 정보
  const [carrier, setCarrier] = useState<string>(existingPaper?.postalInfo?.carrier || '우체국 등기');
  const [trackingNumber, setTrackingNumber] = useState<string>(existingPaper?.postalInfo?.trackingNumber || '');
  const [sentDate, setSentDate] = useState<string>(existingPaper?.postalInfo?.sentDate || todayStr);
  const [returnedSignedDate, setReturnedSignedDate] = useState<string>(existingPaper?.postalInfo?.returnedSignedDate || todayStr);
  const [recipientAddress, setRecipientAddress] = useState<string>(existingPaper?.postalInfo?.recipientAddress || '');
  const [recipientDetailAddress, setRecipientDetailAddress] = useState<string>(existingPaper?.postalInfo?.recipientDetailAddress || '');
  const [postcode, setPostcode] = useState<string>(existingPaper?.postalInfo?.postcode || '');

  // 스캔본 / 사진 파일
  const [scannedFiles, setScannedFiles] = useState<Array<{
    id: string;
    name: string;
    url: string;
    size?: number;
    uploadedAt: string;
  }>>(() => existingPaper?.scannedFiles || []);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 파일 업로드 처리 (이미지 / PDF Base64 변환)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    const fileList = Array.from(files);
    let processed = 0;
    const newItems: typeof scannedFiles = [];

    fileList.forEach(file => {
      // 15MB 제한
      if (file.size > 15 * 1024 * 1024) {
        setErrorMessage(`'${file.name}' 파일이 15MB를 초과하여 제외되었습니다.`);
        processed++;
        if (processed === fileList.length) setIsUploading(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const resultUrl = event.target?.result as string;
        newItems.push({
          id: `paper-scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          url: resultUrl,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
        processed++;
        if (processed === fileList.length) {
          setScannedFiles(prev => [...prev, ...newItems]);
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        processed++;
        if (processed === fileList.length) setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (id: string) => {
    setScannedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async () => {
    if (!signedDate) {
      setErrorMessage('계약 체결(날인) 일자를 입력해 주세요.');
      return;
    }

    if (method === 'postal' && !trackingNumber.trim() && !recipientAddress.trim()) {
      setErrorMessage('우편 등기 체결 시 배송지 주소 또는 등기번호를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const submitData: PaperContractSubmitData = {
        method,
        signedDate,
        scannedFiles,
        notes: notes.trim(),
        postalInfo: method === 'postal' ? {
          carrier,
          trackingNumber: trackingNumber.trim(),
          sentDate,
          returnedSignedDate: returnedSignedDate || undefined,
          recipientAddress: recipientAddress.trim(),
          recipientDetailAddress: recipientDetailAddress.trim() || undefined,
          postcode: postcode.trim() || undefined,
        } : undefined,
      };

      await onConfirm(submitData);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || '서면 계약 체결 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 우체국 등기조회 URL 열기
  const openEpostTracking = () => {
    const cleaned = trackingNumber.replace(/[^0-9]/g, '');
    if (!cleaned) {
      alert('등기번호(숫자)를 먼저 입력해 주세요.');
      return;
    }
    const url = `https://service.epost.go.kr/trace.RetrieveDomRcvTraceList.comm?sid1=${cleaned}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                서면 수임계약 체결 등록
              </h2>
              <p className="text-xs text-slate-500">
                의뢰인: <span className="font-semibold text-slate-700">{contract.clientName}</span> ({contract.clientPhone || '연락처 없음'}) · {contract.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 모달 본문 (스크롤) */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* 체결 방식 선택 탭 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              체결 방식 선택 <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod('in_person')}
                className={`p-4 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                  method === 'in_person'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  method === 'in_person' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">사무소 내방(방문) 체결</span>
                  <span className="text-xs text-slate-500 mt-1 block leading-relaxed">
                    의뢰인이 법률사무소에 직접 내방하여 종이 계약서에 자필 서명 또는 인감 날인
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMethod('postal')}
                className={`p-4 rounded-xl border-2 text-left flex items-start gap-3 transition-all ${
                  method === 'postal'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  method === 'postal' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block text-sm">우편(등기) 계약 체결</span>
                  <span className="text-xs text-slate-500 mt-1 block leading-relaxed">
                    계약서 2부를 등기우편으로 발송하고, 날인된 1부를 회수하여 체결 완료
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* 공통 체결 일자 & 인쇄 바로가기 안내 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                체결(날인) 일자 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={signedDate}
                onChange={(e) => setSignedDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                종이 계약서 서식 출력
              </label>
              <button
                type="button"
                onClick={onPrint}
                className="w-full px-3.5 py-2 text-sm font-semibold border border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100/60 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>표준 위임계약서 즉시 인쇄</span>
              </button>
            </div>
          </div>

          {/* 우편 등기 체결 시 전용 필드 */}
          {method === 'postal' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-indigo-600" />
                  우체국 등기우편 배송 및 회수 정보
                </span>
                <span className="text-[11px] text-slate-500">배송추적 연동</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    우체국 등기번호 (13자리)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="예: 6890123456789"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 bg-white"
                    />
                    <button
                      type="button"
                      onClick={openEpostTracking}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0"
                      title="우체국 배송조회 페이지 열기"
                    >
                      <span>조회</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    우편 발송일 / 회수 완료일
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={sentDate}
                      onChange={(e) => setSentDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 bg-white"
                      title="발송일"
                    />
                    <input
                      type="date"
                      value={returnedSignedDate}
                      onChange={(e) => setReturnedSignedDate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 bg-white"
                      title="회수(날인) 완료일"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  수령인 배송지 주소 (의뢰인 수령처)
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="기본 주소 (예: 서울특별시 서초구 서초대로 123)"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 bg-white"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="상세 주소 (동/호수)"
                      value={recipientDetailAddress}
                      onChange={(e) => setRecipientDetailAddress(e.target.value)}
                      className="col-span-2 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="우편번호"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 날인 실물 계약서 스캔본 / 사진 파일 업로드 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-indigo-600" />
                날인된 실물 계약서 스캔본 / 사진 파일 첨부
              </label>
              <span className="text-[11px] text-slate-500">
                PDF, JPG, PNG 파일 (문서함 자동 보관)
              </span>
            </div>

            {/* 업로드 드롭존 영역 */}
            <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
              <input
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
              <UploadCloud className="w-7 h-7 text-slate-400 group-hover:text-indigo-600 mb-1.5 transition-colors" />
              <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700">
                {isUploading ? '파일을 읽는 중...' : '클릭하거나 파일을 여기로 드래그하세요'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                의뢰인 자필 서명 또는 인감이 날인된 계약서 스캔본이나 스마트폰 촬영본
              </span>
            </label>

            {/* 업로드된 파일 리스트 */}
            {scannedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <span className="text-xs font-semibold text-slate-600">
                  등록된 실물 계약서 증빙 ({scannedFiles.length}건)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scannedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="p-1.5 rounded-lg bg-white border border-slate-200 text-indigo-600 shrink-0">
                          <FileText className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {file.size ? `${(file.size / 1024).toFixed(0)} KB` : '증빙'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => window.open(file.url, '_blank')}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          title="미리보기"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 비고 및 특이사항 */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              특이사항 / 서면 체결 사유
            </label>
            <input
              type="text"
              placeholder="예: 배우자 동행 상담 후 내방 날인, 휴대폰 본인인증 곤란으로 등기 회수 등"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 실무 주의 안내 */}
          <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              서면 계약 체결 실무 안내
            </p>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              서면 체결 완료 확정 시 사건 상태가 <span className="font-bold">계약 체결(contracted)</span>로 변경되며, 등록된 계약서 사본은 사건 관리 문서함(Stage 03)에 자동 보관됩니다.
            </p>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrint}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>서식 인쇄</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{submitting ? '체결 등록 중...' : '서면 체결 완료 확정'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
