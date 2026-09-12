import React, { useState, useMemo } from 'react';
import { 
  X, FileText, Download, CheckCircle2, AlertCircle, 
  Archive, FileSpreadsheet, RefreshCw, Upload, Eye, 
  Layers, Check, AlertTriangle, ShieldCheck, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  CourtBatchFilingService, 
  REHAB_14_STANDARD_ORDER, 
  BANKRUPTCY_10_STANDARD_ORDER,
  REHAB_7_BUNDLE_SPEC,
  type FilingDocumentSlot,
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

export default function BatchFilingPackagingModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  isBankruptcy = false,
  onOpenDocHub,
  onOpenIncomeExpenseModal,
  onOpenPropertyModal,
}: BatchFilingPackagingModalProps) {
  if (!isOpen) return null;

  const clientName = clientRequest.clientName || '신청인';
  const caseTypeTitle = isBankruptcy ? '개인파산 및 면책' : '개인회생';

  // 1. 초기 슬롯 데이터 매핑
  const standardTemplates = isBankruptcy ? BANKRUPTCY_10_STANDARD_ORDER : REHAB_14_STANDARD_ORDER;
  
  // 업로드된 파일 및 시스템 생성 서류와 슬롯 매칭
  const [slots, setSlots] = useState<FilingDocumentSlot[]>(() => {
    const uploaded = crmExt.uploadedFiles || [];
    return standardTemplates.map(t => {
      // 1. linkedDocId 매칭
      // 2. 파일명 키워드 매칭
      // 3. 법원 진술서(R10, B02) 고객 작성 데이터 매칭
      // 4. 수입 및 지출에 관한 목록(R08, B08) D5103 데이터 매칭
      // 5. 재산목록(R06, B06) D5102 데이터 매칭
      const isStatementSlot = t.code === 'R10' || t.code === 'B02';
      const hasCompletedStatement = isStatementSlot && (crmExt.courtStatement?.status === 'client_completed' || !!crmExt.courtStatement?.story?.initialCauseDetail);

      const isIncomeExpenseSlot = t.code === 'R08' || t.code === 'B08';
      const hasIncomeExpenseData = isIncomeExpenseSlot && (!!crmExt.incomeExpenseD5103 || !!crmExt.repaymentPlan);

      const isPropertySlot = t.code === 'R06' || t.code === 'B06';
      const hasPropertyData = isPropertySlot && (!!crmExt.propertyListD5102 || (crmExt.repaymentPlan?.assets && crmExt.repaymentPlan.assets.length > 0));

      const matched = uploaded.find(u => 
        (u as any).linkedDocId === t.code ||
        (isStatementSlot && u.name.includes('진술서')) ||
        (isIncomeExpenseSlot && (u.name.includes('수입') || u.name.includes('D5103'))) ||
        (isPropertySlot && (u.name.includes('재산') || u.name.includes('D5102'))) ||
        u.name.toLowerCase().includes(t.title.split('.')[1]?.trim().slice(0, 4).toLowerCase() || '')
      );

      const isReady = !!matched || hasCompletedStatement || hasIncomeExpenseData || hasPropertyData;

      return {
        ...t,
        status: isReady ? 'READY' : (t.isRequired ? 'MISSING' : 'OPTIONAL_SKIPPED'),
        file: matched ? {
          name: matched.name,
          dataUrl: matched.dataUrl,
          mimeType: matched.mimeType
        } : (hasPropertyData ? {
          name: `[전산양식_D5102]_재산목록_${clientName}.pdf`,
          mimeType: 'application/pdf'
        } : (hasIncomeExpenseData ? {
          name: `[전산양식_D5103]_수입및지출목록_${clientName}.pdf`,
          mimeType: 'application/pdf'
        } : (hasCompletedStatement ? {
          name: `[고객작성완료]_${isBankruptcy ? '개인파산' : '개인회생'}_진술서_${clientName}.pdf`,
          mimeType: 'application/pdf'
        } : undefined)))
      };
    });
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processLabel, setProcessLabel] = useState('');
  const [viewMode, setViewMode] = useState<'SLOTS_14' | 'BUNDLES_7'>('SLOTS_14');

  // 채권자 목록 추출 (변제계획안 ➔ 부채증명서 발급목록 ➔ 상담 채권자 순으로 fallback)
  const creditors: RepaymentCreditor[] = useMemo(() => {
    if (crmExt.repaymentPlan?.creditors && crmExt.repaymentPlan.creditors.length > 0) {
      return crmExt.repaymentPlan.creditors;
    }
    const debtOrders = crmExt.debtCertificateOrders;
    if (debtOrders && debtOrders.length > 0 && debtOrders[0].items.length > 0) {
      return convertDebtItemsToRepaymentCreditors(debtOrders[0].items);
    }
    // 기본 상담 금융기관 목업 fallback
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

  // 송달주소 누락 검증 (법원 송달불능 사전 차단)
  const missingAddressCount = useMemo(() => {
    return creditors.filter(c => !c.address || !c.address.trim()).length;
  }, [creditors]);

  // 준비 완료 통계
  const totalSlots = slots.length;
  const readyCount = slots.filter(s => s.status === 'READY').length;
  const missingCount = slots.filter(s => s.status === 'MISSING').length;
  const progressPct = Math.round((readyCount / totalSlots) * 100);

  // 1. 단일 PDF 일괄 결합 다운로드
  const handleDownloadMergedPdf = async () => {
    setIsProcessing(true);
    setProcessLabel('대법원 표준 순서로 단일 PDF 결합 중...');
    try {
      const caseTitle = `${caseTypeTitle} (${clientRequest.court || '서울회생법원'})`;
      const bytes = await CourtBatchFilingService.mergeCourtFilingPdf(slots, caseTitle, clientName);
      const filename = `[법원제출용]_${caseTypeTitle}_${clientName}_일괄제출본.pdf`;
      CourtBatchFilingService.downloadPdf(bytes, filename);
      toast.success('🎉 대법원 전자소송 순서 단일 PDF 결합 다운로드가 완료되었습니다!');
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
        toast.warning(`⚠️ 주의: 채권자 ${missingAddressCount}곳의 송달주소가 미입력 상태입니다. 대법원 전자소송 제출 시 법원 송달불능 위험이 있습니다.`);
      }
      const csv = CourtBatchFilingService.generateCourtCreditorCsv(creditors, clientName);
      const filename = `[대법원전자소송]_${clientName}_채권자목록_일괄등록양식.csv`;
      CourtBatchFilingService.downloadCsv(csv, filename);
      toast.success('📊 대법원 전자소송 호환 채권자목록 CSV(UTF-8 BOM) 파일이 다운로드되었습니다!');
    } catch (err: any) {
      toast.error('CSV 생성 실패: ' + (err?.message || ''));
    }
  };

  // 4. [신규: 매뉴얼 7-1 준용] 전자소송 7대 묶음 PDF 일괄 압축 다운로드
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

  // 슬롯 파일 직접 변경/업로드
  const handleSlotFileUpload = (order: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSlots(prev => prev.map(s => s.order === order ? {
        ...s,
        status: 'READY',
        file: {
          name: file.name,
          dataUrl,
          mimeType: file.type
        }
      } : s));
      toast.success(`${order}번 서류 (${file.name}) 연결 완료`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center text-lg">
              ⚖️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white">
                  법원 전자소송 일괄 패키징 & 채권자목록 내보내기
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {caseTypeTitle} {isBankruptcy ? '10종' : '14종'} 규격
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-slate-200">{clientName}</strong> · 대법원 전자소송 포털 제출 순서로 자동 번호순 정렬 결합
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 요약 바 & 다운로드 액션 */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">제출 준비율:</span>
              <div className="w-32 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${progressPct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-extrabold font-mono text-slate-900">{progressPct}%</span>
            </div>
            <div className="text-xs text-slate-500">
              <strong className="text-emerald-600 font-bold">{readyCount}</strong> 준비완료 / 
              <strong className="text-rose-600 font-bold ml-1">{missingCount}</strong> 누락(간지대체)
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenDocHub && (
              <button
                onClick={onOpenDocHub}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap"
                title="80여 종 서식 허브에서 부속서류 작성 및 모바일 요청"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>⚡ 서식 허브</span>
              </button>
            )}

            {/* 1. 채권자목록 CSV */}
            <button
              onClick={handleDownloadCreditorCsv}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap"
              title="대법원 전자소송 양식 채권자목록 CSV 다운로드"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>채권자목록 CSV</span>
              {missingAddressCount > 0 ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5" title={`송달주소 미입력 ${missingAddressCount}건`}>
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>주소누락 {missingAddressCount}</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-0.5" title="모든 채권자 송달주소 등록 완료">
                  <Check className="w-2.5 h-2.5" />
                  <span>주소검증완료</span>
                </span>
              )}
            </button>

            {/* 2. 개별 PDF ZIP */}
            <button
              onClick={handleDownloadZip}
              disabled={isProcessing}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5 text-indigo-600" />
              <span>번호순 ZIP 다운로드</span>
            </button>

            {/* 3. [신규: 매뉴얼 7-1 준용] 전자소송 7대 묶음 ZIP */}
            {!isBankruptcy && (
              <button
                onClick={handleDownload7BundleZip}
                disabled={isProcessing}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
                title="매뉴얼 7-1 규격: 전자소송 등록용 7대 그룹 묶음 PDF 일괄 압축"
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>전자소송 7대 묶음 ZIP</span>
              </button>
            )}

            {/* 4. 통합 단일 PDF 결합 */}
            <button
              onClick={handleDownloadMergedPdf}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer press-scale whitespace-nowrap disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>결합 처리중...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>통합 단일 PDF 결합</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* [신규] 뷰 모드 탭 스위처 (14종 슬롯 vs 매뉴얼 7-1 전자소송 7대 묶음) */}
        {!isBankruptcy && (
          <div className="px-6 pt-2.5 bg-white border-b border-slate-200 flex items-center gap-2">
            <button
              onClick={() => setViewMode('SLOTS_14')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                viewMode === 'SLOTS_14'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              대법원 표준 14종 개별 슬롯
            </button>
            <button
              onClick={() => setViewMode('BUNDLES_7')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'BUNDLES_7'
                  ? 'border-purple-600 text-purple-700 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>⭐ 전자소송 7대 그룹 묶음(Bundle) 규격</span>
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded-full font-bold">실무 7-1</span>
            </button>
          </div>
        )}

        {isProcessing && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-800 flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>{processLabel}</span>
          </div>
        )}

        {/* 서류 리스트 영역 (14종 슬롯 또는 7대 그룹 묶음) */}
        <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
          {viewMode === 'BUNDLES_7' && !isBankruptcy ? (
            // ── 매뉴얼 7-1 전자소송 7대 묶음 뷰 ──
            <div className="space-y-3">
              <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-200 text-purple-900 text-xs flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-purple-950">
                    법원 실무 매뉴얼 (7-1) 규격: 전자소송 등록용 7개 그룹 묶음 스캔 체계
                  </p>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    개인회생 신청 시 법원 전자소송 포털에 제출 서류를 올릴 때는 아래 7개 표준 PDF 파일로 그룹화하여 스캔·등록합니다.
                    상단의 <strong>[전자소송 7대 묶음 ZIP]</strong> 버튼을 누르면 각 묶음별로 자동 병합된 7개의 표준 파일이 일괄 다운로드됩니다.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {REHAB_7_BUNDLE_SPEC.map((bundle) => {
                  // 매칭된 슬롯 및 업로드 파일 확인
                  const matchedSlots = slots.filter(s => bundle.slotCodes.includes(s.code) && s.file);
                  const matchedUploads = (crmExt.uploadedFiles || []).filter(u => {
                    const uName = (u.name || '').toLowerCase();
                    return bundle.sourceKeywords.some(kw => uName.includes(kw.toLowerCase()));
                  });
                  const totalMatchedDocs = matchedSlots.length + matchedUploads.length;
                  const isReady = totalMatchedDocs > 0;

                  return (
                    <div 
                      key={bundle.bundleOrder}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isReady 
                          ? 'bg-white border-purple-200 hover:border-purple-300 shadow-2xs' 
                          : bundle.isRequired 
                            ? 'bg-amber-50/40 border-amber-200' 
                            : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`w-8 h-8 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${
                          isReady ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                        }`}>
                          #{bundle.bundleOrder}
                        </span>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900">
                              {bundle.title}
                            </span>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                              📄 {bundle.bundleFileName}
                            </span>
                            {bundle.isRequired ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-700">
                                필수 묶음
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-500">
                                해당시 제출
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {bundle.description}
                          </p>

                          <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                            {isReady ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>구비 서류 {totalMatchedDocs}건 연결 완료 (자동 병합 대상)</span>
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>첨부 서류 대기중 (ZIP 추출 시 법원 규격 안내 간지 자동 생성)</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <span className="text-[11px] text-slate-400 font-mono">
                          Slot: {bundle.slotCodes.join(', ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // ── 대법원 표준 14종 개별 슬롯 뷰 (기존) ──
            <>
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  대법원 전자소송 제출 표준 순서 목록
                </span>
                <span className="text-[11px] text-slate-400">
                  * 미첨부 서류는 결합 시 법원 표준 "서류 간지(Cover Sheet)"가 자동 대체 삽입됩니다.
                </span>
              </div>

              <div className="space-y-2">
                {slots.map((slot) => {
                  const isReady = slot.status === 'READY';
                  return (
                    <div 
                      key={slot.order}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isReady 
                          ? 'bg-white border-slate-200 hover:border-blue-200' 
                          : slot.isRequired 
                            ? 'bg-rose-50/50 border-rose-200' 
                            : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-7 h-7 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          isReady ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {slot.order}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {slot.title}
                            </span>
                            {slot.isRequired ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-700 whitespace-nowrap">
                                필수
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-500 whitespace-nowrap">
                                선택
                              </span>
                            )}
                          </div>

                          {slot.file ? (
                            <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>연결 파일: {slot.file.name}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-rose-500 font-medium mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>미제출 상태 (결합 시 번호순 간지 자동 생성)</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(slot.code === 'R06' || slot.code === 'B06') && onOpenPropertyModal && (
                          <button
                            type="button"
                            onClick={onOpenPropertyModal}
                            className="text-[11px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl border border-indigo-200 cursor-pointer press-scale whitespace-nowrap flex items-center gap-1 shadow-xs"
                          >
                            <span>🏛️ D5102 작성</span>
                          </button>
                        )}
                        {(slot.code === 'R08' || slot.code === 'B08') && onOpenIncomeExpenseModal && (
                          <button
                            type="button"
                            onClick={onOpenIncomeExpenseModal}
                            className="text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-xl border border-amber-200 cursor-pointer press-scale whitespace-nowrap flex items-center gap-1 shadow-xs"
                          >
                            <span>💰 D5103 작성</span>
                          </button>
                        )}
                        <label className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer press-scale whitespace-nowrap flex items-center gap-1">
                          <Upload className="w-3 h-3 text-slate-500" />
                          <span>{slot.file ? '파일 변경' : '파일 연결'}</span>
                          <input 
                            type="file" 
                            accept=".pdf,.jpg,.jpeg,.png" 
                            className="hidden" 
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleSlotFileUpload(slot.order, f);
                            }} 
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 하단 푸터 안내 */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>대법원 전자소송 문서 업로드 규격 (PDF v1.4+ 및 UTF-8 BOM 인코딩)을 보증합니다.</span>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
