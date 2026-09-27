import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, RotateCw, RotateCcw, Trash2, CheckCircle2, AlertTriangle, 
  FileText, Download, Sparkles, RefreshCw, SlidersHorizontal, 
  Layers, Check, Upload, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from './ModalPortal';
import { 
  inspectPdfPages, 
  autoRotateLandscapePages, 
  rotatePages, 
  removePagesFromPdf, 
  autoRemoveBlankPages,
  type PdfInspectionOverview,
  type PdfPageMeta
} from '../../services/pdfPreprocessingService';

interface PdfPreprocessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFile?: File | { name: string; dataUrl: string };
  onSaveToCrm?: (preprocessedFile: { name: string; dataUrl: string; fileSize: number }) => void;
  clientName?: string;
}

export default function PdfPreprocessorModal({
  isOpen,
  onClose,
  initialFile,
  onSaveToCrm,
  clientName = '신청인'
}: PdfPreprocessorModalProps) {
  const [currentFile, setCurrentFile] = useState<File | { name: string; dataUrl: string } | null>(initialFile || null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [overview, setOverview] = useState<PdfInspectionOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 초기 파일 로드
  useEffect(() => {
    if (initialFile) {
      setCurrentFile(initialFile);
      loadPdfBytes(initialFile);
    }
  }, [initialFile]);

  // DataURL 또는 File로부터 Uint8Array 로드 및 검사
  const loadPdfBytes = async (fileObj: File | { name: string; dataUrl: string }) => {
    try {
      setIsLoading(true);
      let bytes: Uint8Array;

      if (fileObj instanceof File) {
        const buffer = await fileObj.arrayBuffer();
        bytes = new Uint8Array(buffer);
      } else {
        const base64 = fileObj.dataUrl.split(',')[1] || fileObj.dataUrl;
        const binary = atob(base64);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
      }

      setPdfBytes(bytes);
      const inspected = await inspectPdfPages(bytes);
      setOverview(inspected);
      setSelectedPages(new Set());
    } catch (err: any) {
      console.error(err);
      toast.error('PDF 파일 로드 중 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  // 새 파일 업로드 핸들러
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('PDF 파일만 전처리할 수 있습니다.');
      return;
    }
    setCurrentFile(file);
    loadPdfBytes(file);
  };

  // 1. 가로 페이지 일괄 세로 회전
  const handleAutoRotateAll = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const result = await autoRotateLandscapePages(pdfBytes);
      if (result.rotatedCount === 0) {
        toast.info('가로 방향 페이지가 없습니다. 모든 페이지가 이미 세로 방향입니다.');
        return;
      }
      setPdfBytes(result.bytes);
      const inspected = await inspectPdfPages(result.bytes);
      setOverview(inspected);
      toast.success(`가로 방향 페이지 ${result.rotatedCount}개를 법원 표준 세로로 자동 회전했습니다!`);
    } catch (err: any) {
      toast.error('회전 처리 중 오류: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. 단일 페이지 회전 핸들러
  const handleRotateSinglePage = async (pageIndex: number, delta: 90 | -90 | 180) => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const updatedBytes = await rotatePages(pdfBytes, [{ pageIndex, deltaDegrees: delta }]);
      setPdfBytes(updatedBytes);
      const inspected = await inspectPdfPages(updatedBytes);
      setOverview(inspected);
      toast.success(`${pageIndex + 1}페이지를 ${delta > 0 ? `${delta}° 회전` : `${Math.abs(delta)}° 반시계 회전`}했습니다.`);
    } catch (err: any) {
      toast.error('페이지 회전 오류: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. 빈 페이지 자동 감지 및 삭제
  const handleAutoRemoveBlanks = async () => {
    if (!pdfBytes) return;
    try {
      setIsProcessing(true);
      const result = await autoRemoveBlankPages(pdfBytes);
      if (result.removedCount === 0) {
        toast.info('감지된 빈 페이지가 없습니다.');
        return;
      }
      setPdfBytes(result.bytes);
      const inspected = await inspectPdfPages(result.bytes);
      setOverview(inspected);
      setSelectedPages(new Set());
      toast.success(`빈 페이지 ${result.removedCount}개를 성공적으로 제거했습니다! (남은 페이지: ${inspected.totalPages}p)`);
    } catch (err: any) {
      toast.error('빈 페이지 제거 오류: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. 선택한 페이지 삭제
  const handleDeleteSelectedPages = async () => {
    if (!pdfBytes || selectedPages.size === 0) return;
    try {
      setIsProcessing(true);
      const indices = Array.from(selectedPages);
      const result = await removePagesFromPdf(pdfBytes, indices);
      setPdfBytes(result.bytes);
      const inspected = await inspectPdfPages(result.bytes);
      setOverview(inspected);
      setSelectedPages(new Set());
      toast.success(`선택한 ${result.removedCount}개 페이지를 삭제했습니다.`);
    } catch (err: any) {
      toast.error('페이지 삭제 실패: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. 전처리 완료 PDF 다운로드
  const handleDownloadPreprocessed = () => {
    if (!pdfBytes) return;
    const originalName = currentFile?.name || 'preprocessed_document.pdf';
    const cleanBase = originalName.replace(/\.pdf$/i, '');
    const filename = `${cleanBase}_법원최적화.pdf`;

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filename} 파일이 다운로드되었습니다.`);
  };

  // 6. CRM에 직접 반영
  const handleApplyToCrm = () => {
    if (!pdfBytes || !onSaveToCrm) return;
    const originalName = currentFile?.name || 'document.pdf';
    const cleanBase = originalName.replace(/\.pdf$/i, '');
    const filename = `${cleanBase}_정리완료.pdf`;

    // Base64 DataURL 생성
    let binary = '';
    const len = pdfBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const dataUrl = `data:application/pdf;base64,${btoa(binary)}`;

    onSaveToCrm({
      name: filename,
      dataUrl,
      fileSize: pdfBytes.byteLength
    });
    toast.success('전처리된 서류가 CRM 제출 서류함에 저장되었습니다.');
    onClose();
  };

  const togglePageSelection = (pageIndex: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageIndex)) next.delete(pageIndex);
      else next.add(pageIndex);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 text-left">
        <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* ═══ 1. 헤더 ═══ */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0 shadow-sm">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-400 text-slate-950">
                    스캔 서류 전처리 엔진
                  </span>
                  <span className="text-xs text-indigo-300 font-semibold">
                    신청인: {clientName}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  PDF 페이지 회전 보정 및 빈 페이지 정리 허브
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>다른 PDF 열기</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ═══ 2. 스마트 분석 스코어보드 & 일괄 전처리 액션 바 ═══ */}
          {overview && (
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 text-[10px] block">총 페이지수</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {overview.totalPages}면
                  </span>
                  <span className="text-[10px] text-slate-400 ml-1">({overview.fileSizeFormatted})</span>
                </div>

                <div className={`px-3 py-1.5 rounded-xl border ${
                  overview.landscapeCount > 0 
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200' 
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                }`}>
                  <span className="text-[10px] block font-bold">가로 방향 페이지</span>
                  <span className="font-extrabold text-sm">{overview.landscapeCount}면</span>
                  <span className="text-[10px] ml-1">
                    {overview.landscapeCount > 0 ? '⚠️ 세로 회전 권장' : '✅ 전원 세로'}
                  </span>
                </div>

                <div className={`px-3 py-1.5 rounded-xl border ${
                  overview.blankCount > 0 
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200' 
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  <span className="text-[10px] block font-bold">빈 페이지(이면지) 의심</span>
                  <span className="font-extrabold text-sm">{overview.blankCount}면</span>
                  <span className="text-[10px] ml-1">
                    {overview.blankCount > 0 ? '⚠️ 삭제 권장' : '없음'}
                  </span>
                </div>
              </div>

              {/* 일괄 액션 버튼 */}
              <div className="flex items-center gap-2 flex-wrap">
                {overview.landscapeCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoRotateAll}
                    disabled={isProcessing}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer press-scale disabled:opacity-50"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>가로 {overview.landscapeCount}면 일괄 세로 회전</span>
                  </button>
                )}

                {overview.blankCount > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoRemoveBlanks}
                    disabled={isProcessing}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer press-scale disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>빈 페이지 {overview.blankCount}면 일괄 제거</span>
                  </button>
                )}

                {selectedPages.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedPages}
                    disabled={isProcessing}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer press-scale"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>선택 {selectedPages.size}면 삭제</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ 3. 페이지 썸네일 카드 그리드 ═══ */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60 dark:bg-slate-950/40">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm font-bold">PDF 페이지 구조 및 스트림을 분석하는 중...</p>
              </div>
            ) : overview && overview.pages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {overview.pages.map((p) => {
                  const isSelected = selectedPages.has(p.pageIndex);
                  return (
                    <div
                      key={p.pageIndex}
                      className={`p-3 rounded-2xl bg-white dark:bg-slate-800 border transition-all flex flex-col justify-between space-y-2 relative group ${
                        isSelected 
                          ? 'border-indigo-600 ring-2 ring-indigo-500/30' 
                          : p.isBlankSuspected 
                            ? 'border-red-200 dark:border-red-900 bg-red-50/20' 
                            : p.isLandscape 
                              ? 'border-amber-200 dark:border-amber-900 bg-amber-50/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {/* 상단 페이지 번호 & 체크박스 */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePageSelection(p.pageIndex)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                            #{p.pageNumber}
                          </span>
                        </label>

                        {/* 상태 뱃지 */}
                        {p.isBlankSuspected ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded">
                            빈면 의심
                          </span>
                        ) : p.isLandscape ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                            가로
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                            세로
                          </span>
                        )}
                      </div>

                      {/* 페이지 비주얼 프레임 시뮬레이터 */}
                      <div className="py-4 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 min-h-[90px]">
                        <div 
                          className={`bg-white dark:bg-slate-800 shadow-xs border border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center p-1 transition-all text-slate-400 ${
                            p.isLandscape ? 'w-16 h-12' : 'w-12 h-16'
                          }`}
                        >
                          <FileText className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          <span className="text-[8px] font-mono mt-0.5">
                            {p.width}×{p.height}
                          </span>
                        </div>
                      </div>

                      {/* 하단 개별 조작 버튼 */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => handleRotateSinglePage(p.pageIndex, -90)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                          title="반시계방향 90도 회전"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateSinglePage(p.pageIndex, 180)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                          title="180도 상하 반전"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateSinglePage(p.pageIndex, 90)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                          title="시계방향 90도 회전"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!pdfBytes) return;
                            try {
                              const res = await removePagesFromPdf(pdfBytes, [p.pageIndex]);
                              setPdfBytes(res.bytes);
                              const ins = await inspectPdfPages(res.bytes);
                              setOverview(ins);
                              toast.success(`${p.pageNumber}페이지가 삭제되었습니다.`);
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="이 페이지만 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                <FileText className="w-12 h-12 text-slate-300" />
                <p className="text-sm font-bold">열린 PDF 문서가 없습니다. 상단의 [다른 PDF 열기] 버튼으로 파일을 선택해주세요.</p>
              </div>
            )}
          </div>

          {/* ═══ 4. 하단 모달 푸터 ═══ */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
            <span className="text-slate-500 dark:text-slate-400">
              💡 회생위원 뷰어는 세로(Portrait) 규격을 기본으로 하므로 가로 스캔 문서는 세로 회전 후 제출을 권장합니다.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPreprocessed}
                disabled={!pdfBytes || isProcessing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition-all cursor-pointer press-scale flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>전처리본 다운로드</span>
              </button>

              {onSaveToCrm && (
                <button
                  type="button"
                  onClick={handleApplyToCrm}
                  disabled={!pdfBytes || isProcessing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-xs transition-all cursor-pointer press-scale flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>CRM 서류함에 저장</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
