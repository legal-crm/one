import { DELIVERY_UNIT_FEE_KRW } from '../../../services/court/courtFees';
import React, { useState, useMemo } from 'react';
import { 
  X, FileText, Download, CheckCircle2, AlertCircle, 
  Archive, FileSpreadsheet, RefreshCw, Upload, Eye, 
  Layers, Check, AlertTriangle, ShieldCheck, MapPin,
  Coins, Landmark, CheckCheck, FolderArchive, ShieldAlert,
  Sparkles, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { getOfficeProfile } from '../../../services/lawyer/officeProfile';
import ModalPortal from '../../common/ModalPortal';
import { 
  CourtBatchFilingService, 
  REHAB_14_STANDARD_ORDER, 
  BANKRUPTCY_10_STANDARD_ORDER,
  REHAB_7_BUNDLE_SPEC,
  matchFileToSlot,
  type FilingDocumentSlot,
  type FilingFileItem,
  type FilingBundleItem
} from '../../../services/court/CourtBatchFilingService';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { RepaymentCreditor } from '../../../services/repayment/repaymentTypes';
import { convertDebtItemsToRepaymentCreditors } from '../../../services/repayment/debtCertificateService';
import { matchCreditorPreset } from '../../../services/court/creditorAddressDirectory';

interface BatchFilingPackagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  isBankruptcy?: boolean;
  onOpenDocHub?: () => void;
  onOpenIncomeExpenseModal?: () => void;
  onOpenPropertyModal?: () => void;
}

function BatchFilingPackagingModalInner({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  isBankruptcy = false,
  onOpenDocHub,
  onOpenIncomeExpenseModal,
  onOpenPropertyModal,
}: BatchFilingPackagingModalProps) {

  const clientName = clientRequest.clientName || '신청인';
  const caseTypeTitle = isBankruptcy ? '개인파산 및 면책' : '개인회생';
  const courtName = clientRequest.court || crmExt.courtCase?.courtName || '서울회생법원';

  // 채권자 목록 추출 (변제계획안 ➔ 부채증명서 발급목록 ➔ 상담 채권자 순으로 fallback)
  const creditors: RepaymentCreditor[] = useMemo(() => {
    if (crmExt.repaymentPlan?.creditors && crmExt.repaymentPlan.creditors.length > 0) {
      return crmExt.repaymentPlan.creditors;
    }
    const debtOrders = crmExt.debtCertificateOrders;
    if (debtOrders && debtOrders.length > 0 && debtOrders[0].items.length > 0) {
      return convertDebtItemsToRepaymentCreditors(debtOrders[0].items);
    }
    const debts = clientRequest.financialProfile?.debts || [];
    return debts.map((d: any, idx: number) => {
      const name = d.creditorName || d.name || `금융기관 #${idx + 1}`;
      const preset = matchCreditorPreset(name);
      return {
        id: `cred-${idx + 1}`,
        creditorNumber: idx + 1,
        name,
        principal: (d.amount || 1000) * 10000,
        interest: 0,
        isSecured: false,
        isUnconfirmed: false,
        isPriority: preset?.isPriorityDefault ?? false,
        allocationRatio: 1 / Math.max(1, debts.length),
        monthlyRepayment: 100000,
        totalRepayment: 3600000,
        repaymentRate: 40,
        zipCode: preset?.zipCode || '',
        address: preset?.address || '',
        serviceAddress: preset?.serviceAddress || '',
        representative: preset?.representative || '',
        bizNumber: preset?.bizNumber || '',
        debtCauseDetail: '대여금 / 신용대출',
        borrowedDate: '2023-01-01',
      };
    });
  }, [crmExt.repaymentPlan, crmExt.debtCertificateOrders, clientRequest]);

  // 실제 법원 인지액 및 송달료 자동 계산 (실서류 4종 전수분석 반영)
  const stampFee = 32000;
  const creditorCount = Math.max(1, creditors.length);
  const serviceFee = (10 + creditorCount * 8) * DELIVERY_UNIT_FEE_KRW;

  // 1. 초기 슬롯 데이터 매핑 (14단계 표준 편철 순서 + 스마트 다중 파일 매핑)
  const standardTemplates = isBankruptcy ? BANKRUPTCY_10_STANDARD_ORDER : REHAB_14_STANDARD_ORDER;
  
  const [slots, setSlots] = useState<FilingDocumentSlot[]>(() => {
    const uploaded = crmExt.uploadedFiles || [];
    return standardTemplates.map(t => {
      const isSystemCoreForm = t.category === 'CORE_FORM' || t.category === 'POWER_OF_ATTORNEY';

      // 스마트 다중 파일 매칭 (linkedDocId, 슬롯코드, 키워드 사전 대조)
      const matchedFiles: FilingFileItem[] = [];
      uploaded.forEach(u => {
        const detectedSlot = matchFileToSlot(u.name || '', (u as any).linkedDocId);
        if (detectedSlot === t.code) {
          matchedFiles.push({
            name: u.name,
            dataUrl: u.dataUrl,
            mimeType: u.mimeType
          });
        }
      });

      // 시스템 서식은 시스템 데이터 기반으로 100% 자동 생성 가능하므로 항상 READY
      const hasUploadedFiles = matchedFiles.length > 0;
      const isReady = hasUploadedFiles || isSystemCoreForm;

      return {
        ...t,
        status: isReady ? 'READY' : (t.isRequired ? 'MISSING' : 'OPTIONAL_SKIPPED'),
        files: matchedFiles,
        file: hasUploadedFiles ? matchedFiles[0] : (isSystemCoreForm ? {
          name: `[법원전산양식_자동완성]_${t.title.split('.')[1]?.trim() || t.title}_${clientName}.pdf`,
          mimeType: 'application/pdf'
        } : undefined)
      };
    });
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processLabel, setProcessLabel] = useState('');
  const [viewMode, setViewMode] = useState<'COURT_VIEWER' | 'SLOTS_14' | 'BUNDLES_7'>('COURT_VIEWER');
  const [selectedViewerIdx, setSelectedViewerIdx] = useState<number>(0);

  // 송달주소 누락 검증 (법원 송달불능 사전 차단)
  const missingAddressCount = useMemo(() => {
    return creditors.filter(c => !c.address || !c.address.trim()).length;
  }, [creditors]);

  // 준비 완료 통계
  const totalSlots = slots.length;
  const readyCount = slots.filter(s => s.status === 'READY').length;
  const missingCount = slots.filter(s => s.status === 'MISSING').length;
  const progressPct = Math.round((readyCount / totalSlots) * 100);

  // 법원 전자기록 뷰어 목차 시뮬레이션 항목 계산
  const simulatedManifest = useMemo(() => {
    const list: {
      order: number;
      code: string;
      fileName: string;
      title: string;
      category: string;
      isCore: boolean;
      fileCount: number;
      sizeEst: string;
      isDigital: boolean;
      isOver20MB: boolean;
      status: 'READY' | 'MISSING';
      notes?: string;
    }[] = [];

    // 00. 대법원 전자소송 채권자목록 CSV
    if (creditors.length > 0) {
      list.push({
        order: 0,
        code: 'CSV',
        fileName: `00_대법원전자소송_${clientName}_채권자목록.csv`,
        title: '대법원 전자소송 채권자목록 일괄등록 CSV (UTF-8 BOM)',
        category: 'CORE_FORM',
        isCore: true,
        fileCount: 1,
        sizeEst: `${Math.round(creditors.length * 0.4 + 2)} KB`,
        isDigital: true,
        isOver20MB: false,
        status: 'READY',
        notes: `채권사 ${creditors.length}개소 자동 매핑 완료 (전국대표번호 02 국번 자동 보정)`
      });
    }

    slots.forEach(s => {
      const padded = String(s.order).padStart(2, '0');
      const cleanTitle = s.title.replace(/[\/:*?"<>|]/g, '_').substring(0, 24);
      const isCore = s.category === 'CORE_FORM' || s.category === 'POWER_OF_ATTORNEY';
      const fileCount = s.files?.length || (s.file ? 1 : 0);
      const isReady = s.status === 'READY';

      // 예상 용량 산출 (실제 파일 바이트 기반 또는 평균 추산)
      let sizeBytes = 0;
      if (s.files && s.files.length > 0) {
        s.files.forEach(f => {
          if (f.dataUrl) sizeBytes += Math.round(f.dataUrl.length * 0.75);
        });
      } else if (s.file?.dataUrl) {
        sizeBytes = Math.round(s.file.dataUrl.length * 0.75);
      } else if (isCore) {
        sizeBytes = 250 * 1024; // 코어 전산양식 평균 250KB
      }

      const sizeEst = sizeBytes > 0 
        ? (sizeBytes > 1024 * 1024 ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(sizeBytes / 1024)} KB`)
        : '미첨부';

      const isOver20MB = sizeBytes > 19 * 1024 * 1024;

      list.push({
        order: s.order,
        code: s.code,
        fileName: `${padded}_${cleanTitle}_${clientName}.pdf`,
        title: s.title,
        category: s.category,
        isCore,
        fileCount,
        sizeEst,
        isDigital: isCore,
        isOver20MB,
        status: isReady ? 'READY' : 'MISSING',
        notes: isCore ? '법원 전산양식 공식 렌더링 (텍스트 레이어 내장)' : (fileCount > 0 ? `${fileCount}개 증빙 결합` : '의뢰인 업로드 필요')
      });
    });

    return list;
  }, [slots, creditors, clientName]);

  // 0. 대한민국 법원 전자소송 표준 ZIP 패키지 다운로드 (회생위원 뷰어 1:1 최적화 - 추천)
  const handleDownloadCourtStandardZip = async () => {
    setIsProcessing(true);
    setProcessLabel('회생위원 전자기록 뷰어 1:1 표준 패키지(개별 PDF + 20MB 자동분할 + CSV) 생성 중...');
    try {
      const formDataContext = {
        clientRequest,
        crmExt,
        creditors,
        lawyerName: crmExt?.petitionInfo?.lawyerName || '',
        firmName: crmExt?.petitionInfo?.firmName || getOfficeProfile().firmName,
        courtName,
      };

      const result = await CourtBatchFilingService.buildFilingPackage(
        slots,
        clientName,
        formDataContext,
        { creditors, isBankruptcy }
      );

      const filename = `[대법원전자소송표준]_${caseTypeTitle}_${clientName}_뷰어목차최적화.zip`;
      CourtBatchFilingService.downloadZip(result.zipBlob, filename);

      if (result.hasSplitFiles) {
        toast.success(`🎉 전자소송 패키지 다운로드 완료! (20MB 초과 서류는 _part1, _part2로 자동 분할되었습니다)`);
      } else {
        toast.success(`🎉 회생위원 뷰어 최적화 표준 ZIP 패키지(총 ${result.totalFiles}개 파일, ${result.totalSizeFormatted}) 다운로드 완료!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('전자소송 패키지 생성 중 오류: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
      setProcessLabel('');
    }
  };

  // 1. 단일 PDF 일괄 결합 다운로드 (사무실 보관용)
  const handleDownloadMergedPdf = async () => {
    setIsProcessing(true);
    setProcessLabel('사무실 보관용 14단계 단일 PDF 결합 중...');
    try {
      const caseTitle = `${caseTypeTitle} (${courtName})`;
      const formDataContext = {
        clientRequest,
        crmExt,
        creditors,
        lawyerName: crmExt?.petitionInfo?.lawyerName || '',
        firmName: crmExt?.petitionInfo?.firmName || getOfficeProfile().firmName,
        courtName,
      };

      const bytes = await CourtBatchFilingService.mergeCourtFilingPdf(
        slots, 
        caseTitle, 
        clientName,
        formDataContext
      );
      const filename = `[사무실보관용]_${caseTypeTitle}_${clientName}_14단계_단일통합본.pdf`;
      CourtBatchFilingService.downloadPdf(bytes, filename);
      toast.success('사무실 보관용 14단계 단일 PDF 결합 다운로드가 완료되었습니다.');
    } catch (err: any) {
      console.error(err);
      toast.error('PDF 결합 중 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
      setProcessLabel('');
    }
  };

  // 2. 번호순 개별 PDF ZIP 압축 다운로드
  const handleDownloadZip = async () => {
    setIsProcessing(true);
    setProcessLabel('번호순 개별 서류 ZIP 패키징 중...');
    try {
      const zipBlob = await CourtBatchFilingService.createFilingZip(slots, clientName);
      const filename = `[전자소송업로드용]_${caseTypeTitle}_${clientName}_번호순정렬.zip`;
      CourtBatchFilingService.downloadZip(zipBlob, filename);
      toast.success('📦 전자소송 등록용 번호순 ZIP 파일이 성공적으로 다운로드되었습니다!');
    } catch (err: any) {
      console.error(err);
      toast.error('ZIP 압축 중 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
      setProcessLabel('');
    }
  };

  // 3. 대법원 규격 채권자목록 CSV 다운로드
  const handleDownloadCreditorCsv = () => {
    try {
      if (missingAddressCount > 0) {
        toast.warning(`⚠️ 주의: 채권자 ${missingAddressCount}곳의 송달주소가 미입력 상태입니다.`);
      }
      const csv = CourtBatchFilingService.generateCourtCreditorCsv(creditors, clientName);
      const filename = `[대법원전자소송]_${clientName}_채권자목록_일괄등록양식.csv`;
      CourtBatchFilingService.downloadCsv(csv, filename);
      toast.success('📊 대법원 전자소송 호환 채권자목록 CSV(UTF-8 BOM) 파일이 다운로드되었습니다!');
    } catch (err: any) {
      toast.error('CSV 생성 실패: ' + (err?.message || ''));
    }
  };

  // 4. 전자소송 7대 묶음 ZIP
  const handleDownload7BundleZip = async () => {
    setIsProcessing(true);
    setProcessLabel('매뉴얼 7-1 규격 전자소송 7대 묶음 PDF 결합 및 압축 중...');
    try {
      const zipBlob = await CourtBatchFilingService.exportCourt7BundleZip(
        slots,
        clientName,
        crmExt.uploadedFiles || []
      );
      const filename = `[전자소송7대묶음]_개인회생_${clientName}.zip`;
      CourtBatchFilingService.downloadZip(zipBlob, filename);
      toast.success('🎉 법원 매뉴얼(7-1) 규격 전자소송 7대 묶음 ZIP 파일이 다운로드되었습니다!');
    } catch (err: any) {
      console.error(err);
      toast.error('7대 묶음 ZIP 생성 중 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsProcessing(false);
      setProcessLabel('');
    }
  };

  // 슬롯 파일 직접 추가/업로드
  const handleSlotFileUpload = (order: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newFileItem: FilingFileItem = {
        name: file.name,
        dataUrl,
        mimeType: file.type
      };

      setSlots(prev => prev.map(s => {
        if (s.order !== order) return s;
        const currentFiles = s.files || [];
        return {
          ...s,
          status: 'READY',
          file: newFileItem,
          files: [newFileItem, ...currentFiles]
        };
      }));
      toast.success(`${order}번 서류 (${file.name}) 연결 완료`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] max-h-[calc(100vh-2.5rem)]">
        
        {/* 상단 모달 헤더 */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  법원 정식 전자소송 14단계 서류 패키징 & 원스톱 단일 PDF 생성
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {courtName} 실무 규격 100% 일치
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <span className="text-white font-bold">{clientName}</span> ({caseTypeTitle}) · 관할: <span className="text-white font-bold">{courtName}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 법정 인지액 & 송달료 자동 산출 배너 */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-slate-600">법정 인지액:</span>
              <span className="font-extrabold text-slate-900">{stampFee.toLocaleString()}원</span>
              <span className="text-[10px] text-slate-600 font-medium">(신청 3만+금지명령 2천)</span>
            </div>
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              <span className="text-slate-600">법정 송달료:</span>
              <span className="font-extrabold text-blue-700">{serviceFee.toLocaleString()}원</span>
              <span className="text-[10px] text-slate-600 font-medium">
                (기본 10회 5.5만 + 채권자 {creditorCount}명 × 8회 × 5,500원)
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">서류 편철 완료도:</span>
            <div className="w-28 h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-900">{readyCount}/{totalSlots} ({progressPct}%)</span>
          </div>
        </div>

        {/* 회생위원 전자기록 뷰어 맞춤 제출 가이드 배너 */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/70 to-slate-50 px-6 py-3 border-b border-indigo-100 flex items-start gap-3 text-xs">
          <ShieldAlert className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
          <div className="text-slate-700 leading-relaxed">
            <span className="font-bold text-indigo-950 mr-1.5">💡 회생위원 전산 뷰어 심사 특성:</span>
            회생위원은 서류를 일일이 다운로드하지 않고, 법원 전산망 내 <strong>[전자기록 뷰어 좌측 목차]</strong>를 클릭해 검토합니다. 
            모든 서류를 1개 대용량 PDF로 묶어 제출하면 목차에 1개만 떠서 <strong>"첨부서류를 항목별로 구분하여 재제출하라"는 보정권고</strong>가 내려질 수 있습니다. 
            본 시스템의 <strong>[🏛️ 전자소송 표준 ZIP 패키지]</strong>로 제출하시면 뷰어 목차에 각 서류가 직관적으로 배치되어 심사가 가장 빨라집니다. (개별 파일 20MB 제한 자동 분할)
          </div>
        </div>

        {/* 액션 바: 정렬 옵션 및 다운로드 버튼군 */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">보기 모드:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('COURT_VIEWER')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'COURT_VIEWER' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏛️ 법원 뷰어 목차 (시뮬레이터)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  viewMode === 'COURT_VIEWER' ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  추천
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('SLOTS_14')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'SLOTS_14' 
                    ? 'bg-white text-blue-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                14단계 정식 편철 순서
              </button>
              <button
                type="button"
                onClick={() => setViewMode('BUNDLES_7')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  viewMode === 'BUNDLES_7' 
                    ? 'bg-white text-blue-700 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전자소송 7대 묶음
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. 표준 전자소송 ZIP 패키지 다운로드 (추천) */}
            <button
              type="button"
              onClick={handleDownloadCourtStandardZip}
              disabled={isProcessing}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
              title="회생위원 전산 뷰어 목차와 1:1 일치하는 번호순 개별 파일 + 20MB 단위 자동 분할 + 채권자목록 CSV 패키지"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>🏛️ 전자소송 표준 ZIP 다운로드</span>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                1:1 뷰어 최적화
              </span>
            </button>

            {/* 2. 채권자목록 CSV */}
            <button
              type="button"
              onClick={handleDownloadCreditorCsv}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer press-scale whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>채권자 CSV</span>
            </button>

            {/* 3. 7대 묶음 ZIP */}
            {!isBankruptcy && (
              <button
                type="button"
                onClick={handleDownload7BundleZip}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>7대 묶음 ZIP</span>
              </button>
            )}

            {/* 4. 단일 통합 PDF 결합 (사무실 보관용) */}
            <button
              type="button"
              onClick={handleDownloadMergedPdf}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
              title="사무실 기록 열람 및 보관용 단일 PDF 결합본"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>사무실 보관용 단일 PDF</span>
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-800 flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>{processLabel}</span>
          </div>
        )}

        {/* ═══ 1. 회생위원 전자기록 뷰어 시뮬레이터 뷰 ═══ */}
        {viewMode === 'COURT_VIEWER' && (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-100 border-t border-slate-200">
            {/* 좌측: 법원 전자기록 뷰어 목차 패널 */}
            <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs font-bold border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-blue-400" />
                  <span>법원 전자기록 뷰어 목차</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {simulatedManifest.length}개 서류
                </span>
              </div>

              <div className="p-2 bg-blue-50/60 border-b border-blue-100 text-[11px] text-blue-900 flex items-center justify-between">
                <span>회생위원 화면 1:1 프리뷰</span>
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  20MB 제한 준수
                </span>
              </div>

              {/* 목차 리스트 */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
                {simulatedManifest.map((item, idx) => {
                  const isSelected = selectedViewerIdx === idx;
                  return (
                    <button
                      key={item.fileName}
                      type="button"
                      onClick={() => setSelectedViewerIdx(idx)}
                      className={`w-full p-2.5 text-left transition-colors flex items-start gap-2 cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50/80 border-l-4 border-blue-600 text-blue-900 font-bold' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-600 mt-0.5 shrink-0">
                        {String(item.order).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium leading-tight">
                          {item.fileName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                          <span>{item.sizeEst}</span>
                          <span>·</span>
                          {item.isDigital ? (
                            <span className="text-emerald-600 font-semibold">Ctrl+F 검색가능</span>
                          ) : (
                            <span className="text-amber-600">스캔 PDF (OCR 권장)</span>
                          )}
                          {item.isOver20MB && (
                            <span className="text-red-600 font-bold">20MB 분할</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 우측: 회생위원 심사 문서 상세 및 법원 규격 검증 패널 */}
            <div className="flex-1 bg-white p-6 overflow-y-auto flex flex-col justify-between">
              {simulatedManifest[selectedViewerIdx] ? (
                <div className="space-y-5">
                  {/* 상단 서류 헤더 */}
                  <div className="pb-4 border-b border-slate-200 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                          목차 #{String(simulatedManifest[selectedViewerIdx].order).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {simulatedManifest[selectedViewerIdx].title}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 font-mono">
                        {simulatedManifest[selectedViewerIdx].fileName}
                      </h3>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                      simulatedManifest[selectedViewerIdx].status === 'READY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {simulatedManifest[selectedViewerIdx].status === 'READY' ? '준비 완료' : '미첨부'}
                    </span>
                  </div>

                  {/* 전자기록 뷰어 심사 체크리스트 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-blue-600" />
                        <span>회생위원 뷰어 목차 연동</span>
                      </span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        전자소송 접수 시 '파일명과 동일'로 등록되어 뷰어 목차에서 단 한 번의 클릭으로 즉시 열람됩니다.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>20MB 파일 제한 검증</span>
                      </span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        현재 예상 크기 <strong>{simulatedManifest[selectedViewerIdx].sizeEst}</strong>로, 법원 20MB 제한을 안전하게 준수합니다.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>텍스트 레이어 및 검색 (Ctrl+F)</span>
                      </span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {simulatedManifest[selectedViewerIdx].isDigital
                          ? '✅ 공식 전산 서식으로 회생위원이 텍스트를 즉시 검색·복사할 수 있습니다.'
                          : '⚠️ 스캔 서류는 회생위원 검색 편의를 위해 OCR 처리를 강력 권장합니다.'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>서류 분류 및 구성</span>
                      </span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {simulatedManifest[selectedViewerIdx].notes || '표준 법원 제출 서류'}
                      </p>
                    </div>
                  </div>

                  {/* 뷰어 화면 시뮬레이션 프레임 */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[160px]">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-blue-600">
                      <Landmark className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        대한민국 법원 전자기록 뷰어 1:1 표준 서류
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {courtName} · 사건번호: {crmExt?.courtCase?.caseNumber || '접수 준비중'} · 신청인 {clientName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleDownloadCourtStandardZip}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>이 서류 포함 전자소송 표준 ZIP 다운로드</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  좌측 목차에서 서류를 선택해 주세요.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ 2. 14단계 서류 슬롯 리스트 뷰 ═══ */}
        {viewMode === 'SLOTS_14' && (
          <div className="p-6 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/50">
            {slots.map((slot) => {
              const isCore = slot.category === 'CORE_FORM' || slot.category === 'POWER_OF_ATTORNEY';
              const isReady = slot.status === 'READY';
              const fileCount = slot.files?.length || (slot.file && !isCore ? 1 : 0);

              return (
                <div 
                  key={slot.code}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isReady 
                      ? 'bg-white border-slate-200 shadow-2xs hover:border-blue-300' 
                      : slot.isRequired 
                        ? 'bg-amber-50/40 border-amber-200' 
                        : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${
                      isReady 
                        ? (isCore ? 'bg-blue-600 text-white shadow-xs' : 'bg-emerald-600 text-white shadow-xs') 
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {String(slot.order).padStart(2, '0')}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">
                          {slot.title}
                        </span>
                        {slot.isRequired && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                            필수
                          </span>
                        )}
                        {isCore ? (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 flex items-center gap-1">
                            <CheckCheck className="w-2.5 h-2.5" />
                            <span>법원 전산양식 자동생성(완료)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            소명서류
                          </span>
                        )}
                        {fileCount > 1 && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 flex items-center gap-1">
                            <FolderArchive className="w-2.5 h-2.5" />
                            <span>{fileCount}개 서류 결합</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 truncate">
                        {isCore ? (
                          <span className="text-blue-600 font-medium truncate flex items-center gap-1">
                            <FileText className="w-3 h-3 shrink-0" />
                            {slot.file?.name || `[법원공식전산서식] ${slot.title}`}
                          </span>
                        ) : slot.files && slot.files.length > 0 ? (
                          <span className="text-emerald-700 font-medium truncate flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            {slot.files.length === 1 
                              ? slot.files[0].name 
                              : `${slot.files[0].name} 외 ${slot.files.length - 1}건`}
                          </span>
                        ) : slot.file ? (
                          <span className="text-emerald-700 font-medium truncate flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            {slot.file.name}
                          </span>
                        ) : (
                          <span className="text-amber-600">
                            {slot.isRequired ? '⚠️ 의뢰인 업로드 또는 전산 확인 필요' : '선택적 첨부 서류'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 우측 조작 버튼 */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <label className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer press-scale">
                      <Upload className="w-3 h-3 text-slate-600" />
                      <span>{slot.file || (slot.files && slot.files.length > 0) ? '파일 추가/교체' : '서류 등록'}</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSlotFileUpload(slot.order, file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 3. 전자소송 7대 묶음 뷰 ═══ */}
        {viewMode === 'BUNDLES_7' && (
          <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
            {REHAB_7_BUNDLE_SPEC.map((bundle) => {
              const matchedSlots = slots.filter(s => bundle.slotCodes.includes(s.code));
              const hasReady = matchedSlots.some(s => s.status === 'READY');

              return (
                <div 
                  key={bundle.bundleCode}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 font-mono text-xs font-black flex items-center justify-center shrink-0">
                        {bundle.bundleOrder}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{bundle.title}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {bundle.bundleFileName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{bundle.description}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      hasReady ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {hasReady ? '증빙 매칭됨' : '미매칭'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 하단 모달 푸터 */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>대한민국 법원(서울회생법원 등) 전자소송 접수 기준 100% 호환</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl transition-all cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

/** 닫힌 상태에서는 내부 훅을 실행하지 않도록 바깥에서 먼저 분기 (Rules of Hooks: 조건부 return을 훅보다 앞에 두지 않음) */
export default function BatchFilingPackagingModal(props: React.ComponentProps<typeof BatchFilingPackagingModalInner>) {
  if (!props.isOpen) return null;
  return <BatchFilingPackagingModalInner {...props} />;
}
