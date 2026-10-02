/**
 * SmartDocumentDropzone — v2.0 스마트 서류 통합 투입함
 * 
 * Stage 3 서류 수집 허브 최상단에 배치.
 * 여러 파일(PDF/이미지)을 드래그앤드롭하면 AI가 자동 분류하여
 * 채무정보/재산정보/수입생계비/금융거래분석 탭으로 값을 분배합니다.
 * 
 * 지원 서류 유형:
 *  - DEBT_CERTIFICATE (부채증명서) → 채무정보
 *  - FAMILY_RELATION (주민등록등본/가족관계증명서) → 수입·생계비
 *  - JOB_HISTORY (건강보험 자격득실확인서) → 수입·생계비
 *  - INSURANCE_REFUND (보험해약환급금확인서) → 재산정보
 *  - BANK_STATEMENT (통장거래내역서) → 금융거래분석
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export interface ClassifiedDocument {
  fileName: string;
  documentType: string;
  documentLabel: string;
  confidence: number;
  extractedFields: Record<string, any>;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
}

interface SmartDocumentDropzoneProps {
  clientId: string;
  clientName: string;
  onDocumentsClassified?: (docs: ClassifiedDocument[]) => void;
  /** v2.0: 분류된 서류를 문서 자료함(uploadedFiles)에 저장하는 콜백 */
  onSaveToVault?: (docs: ClassifiedDocument[], files: File[]) => void;
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  DEBT_CERTIFICATE: { label: '부채증명서', icon: '💳', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  FAMILY_RELATION: { label: '등본/가족관계', icon: '👨‍👩‍👧', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  JOB_HISTORY: { label: '자격득실확인서', icon: '💼', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  INSURANCE_REFUND: { label: '보험해약환급금', icon: '🛡️', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  BANK_STATEMENT: { label: '통장거래내역', icon: '🏦', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  CORRECTION_ORDER: { label: '보정권고서', icon: '📮', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  DEBT_DISCOVERY: { label: '신용정보 조회', icon: '🔍', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  UNKNOWN: { label: '미분류', icon: '❓', color: 'text-slate-500 bg-slate-50 border-slate-200' },
};

export default function SmartDocumentDropzone({
  clientId,
  clientName,
  onDocumentsClassified,
  onSaveToVault,
}: SmartDocumentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [classifiedDocs, setClassifiedDocs] = useState<ClassifiedDocument[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processedFilesRef = useRef<File[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const classifyFile = async (file: File): Promise<ClassifiedDocument> => {
    const result: ClassifiedDocument = {
      fileName: file.name,
      documentType: 'UNKNOWN',
      documentLabel: '분류 중...',
      confidence: 0,
      extractedFields: {},
      status: 'processing',
    };

    try {
      // 엑셀/CSV 파일은 통장거래내역으로 바로 분류 (OCR 불필요)
      if (/\.(xlsx?|csv)$/i.test(file.name)) {
        return {
          ...result,
          documentType: 'BANK_STATEMENT',
          documentLabel: '통장거래내역 (엑셀)',
          confidence: 0.99,
          status: 'done',
        };
      }

      // 이미지/PDF → Gemini Vision으로 서류 종류 분류
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 서류 분류 전용 경량 호출 (분류만 하고 필드 추출은 별도)
      const res = await fetch('/api/ocr?kind=case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, fileName: file.name }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          // OCR 결과로부터 서류 유형 판별
          let docType = 'UNKNOWN';
          if (data.courtName || data.caseNumber) {
            docType = 'CORRECTION_ORDER'; // 법원 문서
          }

          return {
            ...result,
            documentType: docType,
            documentLabel: DOC_TYPE_LABELS[docType]?.label || '기타 서류',
            confidence: data.confidenceScore || 0.8,
            extractedFields: data,
            status: 'done',
          };
        }
      }

      // 파일명 기반 휴리스틱 분류 (API 실패 시 폴백)
      const nameNorm = file.name.toLowerCase();
      let fallbackType = 'UNKNOWN';
      if (/부채|채무|채권/.test(nameNorm)) fallbackType = 'DEBT_CERTIFICATE';
      else if (/등본|가족|주민/.test(nameNorm)) fallbackType = 'FAMILY_RELATION';
      else if (/자격|건강보험|득실/.test(nameNorm)) fallbackType = 'JOB_HISTORY';
      else if (/보험|환급|해약/.test(nameNorm)) fallbackType = 'INSURANCE_REFUND';
      else if (/거래|통장|계좌/.test(nameNorm)) fallbackType = 'BANK_STATEMENT';
      else if (/보정|명령|권고/.test(nameNorm)) fallbackType = 'CORRECTION_ORDER';

      return {
        ...result,
        documentType: fallbackType,
        documentLabel: DOC_TYPE_LABELS[fallbackType]?.label || '미분류',
        confidence: fallbackType !== 'UNKNOWN' ? 0.6 : 0.1,
        status: 'done',
      };
    } catch (err) {
      return {
        ...result,
        status: 'error',
        errorMessage: '파일 분석 실패 — 수동으로 분류해 주세요.',
      };
    }
  };

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => 
      f.size <= 10 * 1024 * 1024 && // 10MB 제한
      (/\.(pdf|jpg|jpeg|png|gif|bmp|webp|xlsx?|csv)$/i.test(f.name))
    );

    if (fileArray.length === 0) {
      toast.error('지원되는 파일 형식이 아닙니다.', {
        description: 'PDF, 이미지(JPG/PNG), 엑셀(XLSX/CSV) 파일을 올려 주세요.',
      });
      return;
    }

    setIsProcessing(true);
    setIsExpanded(true);

    // 초기 pending 상태로 표시
    const pendingDocs: ClassifiedDocument[] = fileArray.map(f => ({
      fileName: f.name,
      documentType: 'UNKNOWN',
      documentLabel: '분류 대기...',
      confidence: 0,
      extractedFields: {},
      status: 'pending' as const,
    }));
    setClassifiedDocs(prev => [...prev, ...pendingDocs]);

    // 순차적으로 분류 (API 부하 제한)
    const results: ClassifiedDocument[] = [];
    for (let i = 0; i < fileArray.length; i++) {
      const classified = await classifyFile(fileArray[i]);
      results.push(classified);
      setClassifiedDocs(prev => {
        const updated = [...prev];
        const pendingIdx = updated.findIndex(d => d.fileName === fileArray[i].name && d.status === 'pending');
        if (pendingIdx >= 0) updated[pendingIdx] = classified;
        return updated;
      });
    }

    setIsProcessing(false);
    processedFilesRef.current = [...processedFilesRef.current, ...fileArray];
    onDocumentsClassified?.(results);

    const successCount = results.filter(r => r.status === 'done' && r.documentType !== 'UNKNOWN').length;
    if (successCount > 0) {
      toast.success(`${successCount}건의 서류를 자동 분류했습니다.`, {
        description: onSaveToVault ? '분류 결과를 자동으로 자료함에 반영합니다.' : '분류 결과를 확인하고 [사건에 반영] 버튼을 눌러 주세요.',
      });
      // v2.0: 자료함 자동 저장
      if (onSaveToVault) {
        onSaveToVault(results.filter(r => r.status === 'done'), fileArray);
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearResults = () => {
    setClassifiedDocs([]);
    setIsExpanded(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* 드롭존 헤더 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-200 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">📁 AI 서류 자동 분류 투입함</h3>
              <p className="text-xs text-slate-500">서류를 끌어다 놓으면 AI가 종류를 자동 판별하여 사건 탭에 분배합니다</p>
            </div>
          </div>
          {classifiedDocs.length > 0 && (
            <button
              onClick={clearResults}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer press-scale"
            >
              <X className="w-3.5 h-3.5" />
              초기화
            </button>
          )}
        </div>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-violet-400 bg-violet-50 scale-[1.01]'
              : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.xlsx,.xls,.csv"
            className="sr-only"
            onChange={handleFileSelect}
          />
          
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              <p className="text-sm font-bold text-violet-700">서류 분석 중...</p>
              <p className="text-xs text-slate-500">Gemini AI가 서류 종류를 판별하고 있습니다</p>
            </div>
          ) : isDragging ? (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-violet-500" />
              <p className="text-sm font-bold text-violet-700">여기에 놓으세요</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-4 text-slate-400">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                서류를 끌어다 놓거나 클릭하여 업로드
              </p>
              <p className="text-xs text-slate-400">
                부채증명서 · 등본 · 보험해약환급금 · 거래내역(Excel) · 보정권고서 등
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 분류 결과 목록 */}
      {isExpanded && classifiedDocs.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {classifiedDocs.map((doc, idx) => {
            const typeInfo = DOC_TYPE_LABELS[doc.documentType] || DOC_TYPE_LABELS.UNKNOWN;
            return (
              <div key={`${doc.fileName}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {doc.status === 'processing' || doc.status === 'pending' ? (
                    <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />
                  ) : doc.status === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{doc.fileName}</p>
                    {doc.status === 'error' && (
                      <p className="text-xs text-rose-500">{doc.errorMessage}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${typeInfo.color}`}>
                    {typeInfo.icon} {doc.documentLabel}
                  </span>
                  {doc.confidence > 0 && (
                    <span className="text-xs text-slate-400">{Math.round(doc.confidence * 100)}%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
