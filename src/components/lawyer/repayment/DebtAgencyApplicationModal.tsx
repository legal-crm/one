import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Printer, Download, Upload, FileSpreadsheet, Plus, Trash2, 
  CheckSquare, Square, FileText, Check, AlertCircle, RefreshCw, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { 
  DebtCertificateOrder, 
  DebtAgencyApplicationData,
  DebtAgencyCreditorRow 
} from '../../../services/repayment/repaymentTypes';
import { 
  createDefaultAgencyApplicationData,
  exportAgencyApplicationExcel,
  saveAgencyCustomExcelTemplate,
  getAgencyCustomExcelTemplate,
  removeAgencyCustomExcelTemplate,
  saveDebtCertificateOrder,
  exportDebtAgencyZipPackage
} from '../../../services/repayment/debtCertificateService';

interface DebtAgencyApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientRequest?: ConsultRequest;
  crmExt?: CrmClientExtension;
  order: DebtCertificateOrder;
  onSaveOrder: (newOrder: DebtCertificateOrder) => void;
  activeLawyerName?: string;
}

export default function DebtAgencyApplicationModal({
  isOpen,
  onClose,
  clientId,
  clientRequest,
  crmExt,
  order,
  onSaveOrder,
  activeLawyerName,
}: DebtAgencyApplicationModalProps) {
  const sanitizeAgencyData = (data: DebtAgencyApplicationData): DebtAgencyApplicationData => ({
    ...data,
    officeName: (data.officeName === '법률사무소 보광' || data.officeName === '법률사무소 명경') ? '' : (data.officeName || ''),
    caseManager: (data.caseManager === '박명국' || data.caseManager === '남윤국') ? '' : (data.caseManager || ''),
    billingManager: (data.billingManager === '박명국' || data.billingManager === '남윤국') ? '' : (data.billingManager || ''),
    tel: data.tel === '02-3492-4246' ? '' : (data.tel || ''),
    fax: data.fax === '02-2179-8487' ? '' : (data.fax || ''),
    hp: data.hp === '010-4064-4246' ? '' : (data.hp || ''),
  });

  const [appData, setAppData] = useState<DebtAgencyApplicationData>(() => {
    if (order.agencyApplication) {
      return sanitizeAgencyData(order.agencyApplication);
    }
    return createDefaultAgencyApplicationData(order, clientRequest, activeLawyerName);
  });

  const [customTemplate, setCustomTemplate] = useState<{ fileName: string; dataUrl: string } | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 템플릿 로드
  useEffect(() => {
    if (clientId) {
      const saved = getAgencyCustomExcelTemplate(clientId);
      if (saved) setCustomTemplate(saved);
    }
  }, [clientId]);

  // 주문 채권자가 바뀌었을 때 appData에 동기화
  useEffect(() => {
    if (order.agencyApplication) {
      setAppData(sanitizeAgencyData(order.agencyApplication));
    } else {
      setAppData(createDefaultAgencyApplicationData(order, clientRequest, activeLawyerName));
    }
  }, [order.items.length, order.agencyApplication]);

  if (!isOpen) return null;

  // 전체 저장
  const handleSave = () => {
    const updatedOrder: DebtCertificateOrder = {
      ...order,
      agencyApplication: appData,
    };
    onSaveOrder(updatedOrder);
    saveDebtCertificateOrder(updatedOrder);
    toast.success('부채증명서 대행 신청서 정보가 저장되었습니다.');
  };

  // 🖨️ A4 고해상도 인쇄 실행
  const handlePrint = () => {
    handleSave();
    window.print();
  };

  // 📥 엑셀 신청서 다운로드
  const handleExportExcel = () => {
    handleSave();
    exportAgencyApplicationExcel(appData);
    toast.success('대행업체 제출용 엑셀 신청서가 다운로드되었습니다.');
  };

  // 📤 커스텀 대행사 엑셀 폼 업로드
  const handleUploadCustomTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('엑셀 파일(.xlsx, .xls)만 등록 가능합니다.');
      return;
    }

    try {
      const saved = await saveAgencyCustomExcelTemplate(clientId, file);
      setCustomTemplate(saved);
      setAppData((prev) => ({ ...prev, customTemplateName: file.name }));
      toast.success(`대행사 엑셀 양식 [${file.name}]이 등록되었습니다.`);
    } catch (err) {
      console.error(err);
      toast.error('엑셀 양식 저장 중 오류가 발생했습니다.');
    }
    e.target.value = '';
  };

  // 📦 원클릭 ZIP 팩 다운로드
  const handleExportZip = async () => {
    handleSave();
    setIsZipping(true);
    try {
      await exportDebtAgencyZipPackage(
        { ...order, agencyApplication: appData },
        crmExt?.uploadedFiles || []
      );
      toast.success('대행사 전달용 ZIP 압축팩이 다운로드되었습니다.');
    } catch (err) {
      toast.error('ZIP 패키지 생성 실패');
    } finally {
      setIsZipping(false);
    }
  };

  // 채권사 행 추가
  const handleAddCreditorRow = () => {
    const newRow: DebtAgencyCreditorRow = {
      id: `cred_row_${Date.now()}`,
      creditorName: '',
      requestDebtCert: true,
      requestCardHistory: false,
      requestBankHistory: false,
      note: '',
    };
    setAppData((prev) => ({
      ...prev,
      creditors: [...prev.creditors, newRow],
    }));
  };

  // 채권사 행 삭제
  const handleDeleteCreditorRow = (idx: number) => {
    setAppData((prev) => ({
      ...prev,
      creditors: prev.creditors.filter((_, i) => i !== idx),
    }));
  };

  // 채권사 행 업데이트
  const handleUpdateCreditorRow = (idx: number, updates: Partial<DebtAgencyCreditorRow>) => {
    setAppData((prev) => {
      const newCreds = [...prev.creditors];
      newCreds[idx] = { ...newCreds[idx], ...updates };
      return { ...prev, creditors: newCreds };
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex justify-center items-start sm:items-center p-2 sm:p-4 md:p-6">
      {/* ── 인쇄 전용 CSS (A4 1매 최적화) ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-agency-app, #printable-agency-app * {
            visibility: visible !important;
          }
          #printable-agency-app {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 4mm !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}</style>

      {/* 모달 컨테이너 (my-auto로 상단 잘림 원천 방지) */}
      <div className="my-auto relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── 상단 툴바 (인쇄 제외, shrink-0 및 컴팩트 버튼) ── */}
        <div className="no-print shrink-0 px-4 py-3 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold shrink-0">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                부채증명서 서류대행 신청서
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold shrink-0">
                실무 엑셀 서식 100% 매칭
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block truncate">
              대행업체 전달용 공식 신청서 작성 ➔ A4 인쇄 / 엑셀 다운로드 / 대행사 맞춤 폼 연동
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap shrink-0 justify-end">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer press-scale whitespace-nowrap"
              title="A4 1매 고해상도 인쇄 (인감증명서/위임장과 함께 우편 발송)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 인쇄 / PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              title="그림 1 양식의 완성된 엑셀(.xlsx) 파일 다운로드"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>엑셀 다운로드</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              title="거래 중인 대행업체 엑셀 서식 파일 업로드"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>대행사 폼</span>
            </button>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleUploadCustomTemplate} 
            />

            <button
              onClick={handleExportZip}
              disabled={isZipping}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
              title="신청서 + 위임장 + 신분증 + 인감증명서 + NPKI 일괄 압축"
            >
              {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>ZIP 팩</span>
            </button>

            <button
              onClick={handleSave}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>저장</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer shrink-0"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 안내 바 (인쇄 제외, shrink-0) ── */}
        <div className="no-print shrink-0 px-4 py-2 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="truncate">
              <strong>실무 팁:</strong> <strong>[A4 인쇄 / PDF]</strong> 클릭 시 A4 규격으로 자동 최적화되어 인감증명서/위임장과 함께 즉시 출력됩니다.
            </span>
          </div>
          {customTemplate && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200 shrink-0 whitespace-nowrap">
              커스텀: {customTemplate.fileName}
            </span>
          )}
        </div>

        {/* ── 메인 문서 뷰 (인쇄 대상 컨테이너: 그림 1 실무 엑셀 서식 100% 매칭) ── */}
        <div className="flex-1 p-2 sm:p-6 overflow-y-auto bg-slate-100/60">
          <div className="min-w-fit max-w-[850px] mx-auto">
          
          <div 
            id="printable-agency-app"
            className="w-full max-w-[850px] bg-white border border-slate-900 p-6 sm:p-8 shadow-sm text-slate-900 font-sans"
            style={{ fontFamily: "'맑은 고딕', 'Malgun Gothic', sans-serif" }}
          >
            {/* 1. 타이틀 & 사건구분 (상단 헤더) */}
            <div className="flex items-stretch justify-between border-b-2 border-slate-900 pb-2 mb-3">
              <div className="flex-1 flex items-center justify-center">
                <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-slate-900">
                  부채증명서 서류대행 신청서
                </h1>
              </div>

              {/* 우측 상단 사건구분 테이블 */}
              <div className="border border-slate-900 text-xs">
                <div className="grid grid-cols-3 bg-slate-100 text-center font-bold border-b border-slate-900">
                  <span className="px-3 py-1 border-r border-slate-900">개인회생</span>
                  <span className="px-3 py-1 border-r border-slate-900">개인파산</span>
                  <span className="px-3 py-1">기타</span>
                </div>
                <div className="grid grid-cols-3 text-center font-bold text-sm h-7 items-center">
                  <label className="border-r border-slate-900 flex items-center justify-center cursor-pointer hover:bg-indigo-50">
                    <input 
                      type="radio" 
                      name="caseType" 
                      checked={appData.caseType === 'rehab'} 
                      onChange={() => setAppData((p) => ({ ...p, caseType: 'rehab' }))}
                      className="hidden"
                    />
                    <span className={appData.caseType === 'rehab' ? 'font-black text-indigo-700' : 'text-slate-300'}>
                      {appData.caseType === 'rehab' ? 'V' : ''}
                    </span>
                  </label>
                  <label className="border-r border-slate-900 flex items-center justify-center cursor-pointer hover:bg-indigo-50">
                    <input 
                      type="radio" 
                      name="caseType" 
                      checked={appData.caseType === 'bankruptcy'} 
                      onChange={() => setAppData((p) => ({ ...p, caseType: 'bankruptcy' }))}
                      className="hidden"
                    />
                    <span className={appData.caseType === 'bankruptcy' ? 'font-black text-indigo-700' : 'text-slate-300'}>
                      {appData.caseType === 'bankruptcy' ? 'V' : ''}
                    </span>
                  </label>
                  <label className="flex items-center justify-center cursor-pointer hover:bg-indigo-50">
                    <input 
                      type="radio" 
                      name="caseType" 
                      checked={appData.caseType === 'other'} 
                      onChange={() => setAppData((p) => ({ ...p, caseType: 'other' }))}
                      className="hidden"
                    />
                    <span className={appData.caseType === 'other' ? 'font-black text-indigo-700' : 'text-slate-300'}>
                      {appData.caseType === 'other' ? 'V' : ''}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* 2. 사무소 및 담당자 정보 테이블 (그림 1 상단 그리드) */}
            <table className="w-full border-collapse border border-slate-900 text-xs mb-3">
              <tbody>
                <tr className="border-b border-slate-900">
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 w-16 font-bold text-center">
                    사무소
                  </th>
                  <td className="border-r border-slate-900 p-1.5" colSpan={3}>
                    <input 
                      type="text" 
                      value={appData.officeName} 
                      placeholder="사무소명"
                      onChange={(e) => setAppData({ ...appData, officeName: e.target.value })}
                      className="w-full bg-transparent font-bold text-slate-800 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 w-20 font-bold text-center leading-tight">
                    사 건<br />담당자
                  </th>
                  <td className="border-r border-slate-900 p-1.5 w-28">
                    <input 
                      type="text" 
                      value={appData.caseManager} 
                      placeholder="사건 담당자"
                      onChange={(e) => setAppData({ ...appData, caseManager: e.target.value })}
                      className="w-full bg-transparent font-bold text-center text-slate-800 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 w-20 font-bold text-center leading-tight">
                    결 제<br />담당자
                  </th>
                  <td className="p-1.5 w-28">
                    <input 
                      type="text" 
                      value={appData.billingManager} 
                      placeholder="결제 담당자"
                      onChange={(e) => setAppData({ ...appData, billingManager: e.target.value })}
                      className="w-full bg-transparent font-bold text-center text-slate-800 outline-none border-b border-transparent hover:border-slate-300 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                </tr>

                <tr className="border-b border-slate-900">
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 font-bold text-center">
                    TEL
                  </th>
                  <td className="border-r border-slate-900 p-1.5">
                    <input 
                      type="text" 
                      value={appData.tel} 
                      placeholder="02-0000-0000"
                      onChange={(e) => setAppData({ ...appData, tel: e.target.value })}
                      className="w-full bg-transparent text-center font-mono outline-none placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 w-14 font-bold text-center">
                    FAX
                  </th>
                  <td className="border-r border-slate-900 p-1.5">
                    <input 
                      type="text" 
                      value={appData.fax} 
                      placeholder="02-0000-0000"
                      onChange={(e) => setAppData({ ...appData, fax: e.target.value })}
                      className="w-full bg-transparent text-center font-mono outline-none placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 font-bold text-center leading-tight">
                    직 통<br />번 호
                  </th>
                  <td className="border-r border-slate-900 p-1.5">
                    <input 
                      type="text" 
                      value={appData.directPhone || ''} 
                      placeholder="직통번호"
                      onChange={(e) => setAppData({ ...appData, directPhone: e.target.value })}
                      className="w-full bg-transparent text-center font-mono outline-none text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 font-bold text-center">
                    H P
                  </th>
                  <td className="p-1.5">
                    <input 
                      type="text" 
                      value={appData.hp} 
                      placeholder="010-0000-0000"
                      onChange={(e) => setAppData({ ...appData, hp: e.target.value })}
                      className="w-full bg-transparent text-center font-mono font-bold outline-none placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                </tr>

                <tr>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 font-bold text-center">
                    고객명
                  </th>
                  <td className="border-r border-slate-900 p-1.5" colSpan={1}>
                    <input 
                      type="text" 
                      value={appData.clientName} 
                      placeholder="고객명"
                      onChange={(e) => setAppData({ ...appData, clientName: e.target.value })}
                      className="w-full bg-transparent font-bold text-center text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 font-bold text-center leading-tight">
                    고 객<br />연락처
                  </th>
                  <td className="border-r border-slate-900 p-1.5" colSpan={1}>
                    <input 
                      type="text" 
                      value={appData.clientPhone} 
                      placeholder="010-0000-0000"
                      onChange={(e) => setAppData({ ...appData, clientPhone: e.target.value })}
                      className="w-full bg-transparent font-mono text-center outline-none placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </td>
                  <th className="bg-slate-100 border-r border-slate-900 p-1.5 font-bold text-center leading-tight">
                    주 의<br />사 항
                  </th>
                  <td className="p-1.5 text-[11px] text-slate-700 leading-snug" colSpan={3}>
                    <p className="text-slate-900 font-medium">
                      * 은행, 카드사 개별부채 의뢰시 본사에서 추가로 교차확인 후 발급진행.
                    </p>
                    <p className="text-rose-700 font-bold">
                      * 부채발급진행 시 <span className="underline">신용카드 및 은행계좌정지</span>됩니다. 이 점 고객님에게 고지부탁드립니다.
                    </p>
                    <p className="text-slate-900 font-medium">
                      * 서류발급 시 본인통화가 필요할 수 있으니 고객님에게 안내 부탁드립니다.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 3. 기본서류 발급신청 (V) 영역 (그림 1 중단 그리드) */}
            <div className="border border-slate-900 text-xs mb-3">
              <div className="bg-blue-100/70 border-b border-slate-900 py-1 font-bold text-center tracking-wider text-slate-900">
                기본서류 발급신청 ( V )
              </div>

              <div className="grid grid-cols-[1.05fr_1.15fr_1.45fr] divide-x divide-slate-900">
                {/* 열 1: 신용조회 / 은행연합회 / 보험협회 */}
                <div className="divide-y divide-slate-900">
                  {/* 신용조회 */}
                  <div className="flex">
                    <div className="w-[70px] shrink-0 bg-slate-50 border-r border-slate-900 px-1 py-1.5 flex flex-col items-center justify-center text-center font-bold leading-tight">
                      <span className="text-[11px] text-slate-900">신용조회</span>
                      <span className="text-[10px] text-slate-500 font-normal leading-none mt-0.5">(나이스)</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1.5 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.niceCredit.requested}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              niceCredit: { ...appData.basicDocs.niceCredit, requested: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>신청</span>
                      </label>
                      <label className="flex items-start gap-1.5 cursor-pointer leading-tight">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.niceCredit.extraCreditorsAfterIssue}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              niceCredit: { ...appData.basicDocs.niceCredit, extraCreditorsAfterIssue: e.target.checked }
                            }
                          })}
                          className="mt-0.5 shrink-0"
                        />
                        <span>발급 후 신청건 외 채권사 추가발급진행</span>
                      </label>
                    </div>
                  </div>

                  {/* 은행연합회 */}
                  <div className="flex">
                    <div className="w-[70px] shrink-0 bg-slate-50 border-r border-slate-900 px-1 py-1.5 flex flex-col items-center justify-center text-center font-bold leading-tight">
                      <span className="text-[11px] text-slate-900">은행연합회</span>
                      <span className="text-[10px] text-slate-500 font-normal leading-none mt-0.5">(조회서)</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1.5 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.bankUnion.requested}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              bankUnion: { ...appData.basicDocs.bankUnion, requested: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>신청</span>
                      </label>
                      <label className="flex items-start gap-1.5 cursor-pointer leading-tight">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.bankUnion.extraCreditorsAfterIssue}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              bankUnion: { ...appData.basicDocs.bankUnion, extraCreditorsAfterIssue: e.target.checked }
                            }
                          })}
                          className="mt-0.5 shrink-0"
                        />
                        <span>발급 후 신청건 외 채권사 추가발급진행</span>
                      </label>
                    </div>
                  </div>

                  {/* 생명/손해보험협회 */}
                  <div className="flex">
                    <div className="w-[70px] shrink-0 bg-slate-50 border-r border-slate-900 px-1 py-1.5 flex flex-col items-center justify-center text-center font-bold leading-tight">
                      <span className="text-[10.5px] text-slate-900">생명(손해)</span>
                      <span className="text-[10.5px] text-slate-900 mt-0.5">보험협회</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1.5 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.lifeInsuranceAssoc.requested}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              lifeInsuranceAssoc: { ...appData.basicDocs.lifeInsuranceAssoc, requested: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>신청</span>
                      </label>
                      <label className="flex items-start gap-1.5 cursor-pointer leading-tight">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.lifeInsuranceAssoc.expectedRefundDoc}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              lifeInsuranceAssoc: { ...appData.basicDocs.lifeInsuranceAssoc, expectedRefundDoc: e.target.checked }
                            }
                          })}
                          className="mt-0.5 shrink-0"
                        />
                        <span>보험 예상해지 환급금증명서 진행</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 열 2: 국민건강보험 & 국민연금 */}
                <div className="divide-y divide-slate-900">
                  {/* 국민건강보험 */}
                  <div className="flex">
                    <div className="w-[70px] shrink-0 bg-slate-50 border-r border-slate-900 px-1 py-1.5 flex flex-col items-center justify-center text-center font-bold leading-tight">
                      <span className="text-[11px] text-slate-900">국민건강</span>
                      <span className="text-[11px] text-slate-900 mt-0.5">보험</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.healthInsurance.all}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              healthInsurance: { ...appData.basicDocs.healthInsurance, all: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span className="font-bold">전체내역발급</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.healthInsurance.unpaidPaymentHistory}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              healthInsurance: { ...appData.basicDocs.healthInsurance, unpaidPaymentHistory: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>건강보험 미납(납부)내역서</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.healthInsurance.eligibilityConfirm}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              healthInsurance: { ...appData.basicDocs.healthInsurance, eligibilityConfirm: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>자격득실 확인서</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.healthInsurance.assessmentNotice}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              healthInsurance: { ...appData.basicDocs.healthInsurance, assessmentNotice: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>산정(부과)내역서</span>
                      </label>
                      <div className="flex items-center gap-1 text-[10.5px] pt-0.5">
                        <span className="shrink-0 text-slate-600">기타:</span>
                        <input 
                          type="text" 
                          value={appData.basicDocs.healthInsurance.other} 
                          placeholder="직접입력"
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              healthInsurance: { ...appData.basicDocs.healthInsurance, other: e.target.value }
                            }
                          })}
                          className="flex-1 min-w-0 bg-transparent border-b border-slate-300 outline-none text-[10px] px-1 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 국민연금 */}
                  <div className="flex">
                    <div className="w-[70px] shrink-0 bg-slate-50 border-r border-slate-900 px-1 py-1.5 flex flex-col items-center justify-center text-center font-bold leading-tight">
                      <span className="text-[11px] text-slate-900">국민연금</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalPension.all}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalPension: { ...appData.basicDocs.nationalPension, all: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span className="font-bold">전체내역발급</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalPension.subscriberConfirm}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalPension: { ...appData.basicDocs.nationalPension, subscriberConfirm: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>가입자 가입증명서</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalPension.pensionCalcHistory}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalPension: { ...appData.basicDocs.nationalPension, pensionCalcHistory: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>연금산정가입내역확인서</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalPension.rehabApplicationConfirm}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalPension: { ...appData.basicDocs.nationalPension, rehabApplicationConfirm: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>개인회생신청용확인서</span>
                      </label>
                      <div className="flex items-center gap-1 text-[10.5px] pt-0.5">
                        <span className="shrink-0 text-slate-600">기타:</span>
                        <input 
                          type="text" 
                          value={appData.basicDocs.nationalPension.other} 
                          placeholder="직접입력"
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalPension: { ...appData.basicDocs.nationalPension, other: e.target.value }
                            }
                          })}
                          className="flex-1 min-w-0 bg-transparent border-b border-slate-300 outline-none text-[10px] px-1 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 열 3: 국세(세무서) & 구청/동사무소 */}
                <div className="divide-y divide-slate-900">
                  {/* 국세(세무서) */}
                  <div className="flex">
                    <div className="w-[70px] shrink-0 bg-slate-50 border-r border-slate-900 px-1 py-1.5 flex flex-col items-center justify-center text-center font-bold leading-tight">
                      <span className="text-[11px] text-slate-900">국세</span>
                      <span className="text-[10px] text-slate-500 font-normal leading-none mt-0.5">(세무서)</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalTax.all}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalTax: { ...appData.basicDocs.nationalTax, all: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span className="font-bold">전체내역발급</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalTax.taxPaymentCert}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalTax: { ...appData.basicDocs.nationalTax, taxPaymentCert: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>납세증명,체납증명</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalTax.incomeAmountCert}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalTax: { ...appData.basicDocs.nationalTax, incomeAmountCert: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>소득금액증명</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.nationalTax.closedBizCert}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalTax: { ...appData.basicDocs.nationalTax, closedBizCert: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span>휴,폐업사실증명</span>
                      </label>
                      <div className="flex items-center gap-1 text-[10.5px] pt-0.5">
                        <span className="shrink-0 text-slate-600">기타:</span>
                        <input 
                          type="text" 
                          value={appData.basicDocs.nationalTax.other} 
                          placeholder="직접입력"
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              nationalTax: { ...appData.basicDocs.nationalTax, other: e.target.value }
                            }
                          })}
                          className="flex-1 min-w-0 bg-transparent border-b border-slate-300 outline-none text-[10px] px-1 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 구청 및 동사무소 */}
                  <div className="flex">
                    <div className="w-[70px] shrink-0 bg-slate-50 border-r border-slate-900 px-1 py-1.5 flex flex-col items-center justify-center text-center font-bold leading-tight text-[11px]">
                      <span className="text-[11px] text-slate-900">구청 및</span>
                      <span className="text-[11px] text-slate-900 mt-0.5">동사무소</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1.5 text-[10.5px]">
                      <div className="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.localDistrict.localTaxCert}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              localDistrict: { ...appData.basicDocs.localDistrict, localTaxCert: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span className="shrink-0">지방세세목별과세증명:</span>
                        <input 
                          type="text" 
                          value={appData.basicDocs.localDistrict.localTaxJurisdiction}
                          placeholder="관할구역"
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              localDistrict: { ...appData.basicDocs.localDistrict, localTaxJurisdiction: e.target.value }
                            }
                          })}
                          className="flex-1 min-w-0 bg-transparent border-b border-slate-300 text-[10px] outline-none px-1 placeholder:text-slate-400"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.localDistrict.residentAbstract}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              localDistrict: { ...appData.basicDocs.localDistrict, residentAbstract: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span className="shrink-0">주민등록 등초본: 세대주(</span>
                        <input 
                          type="text" 
                          value={appData.basicDocs.localDistrict.residentHead}
                          placeholder="성명"
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              localDistrict: { ...appData.basicDocs.localDistrict, residentHead: e.target.value }
                            }
                          })}
                          className="w-12 bg-transparent border-b border-slate-300 text-[10px] text-center outline-none px-0.5 placeholder:text-slate-400"
                        />
                        <span className="shrink-0">)</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.localDistrict.vehicleRegister}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              localDistrict: { ...appData.basicDocs.localDistrict, vehicleRegister: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span className="shrink-0">자동차등록원부:</span>
                        <input 
                          type="text" 
                          value={appData.basicDocs.localDistrict.vehiclePlate}
                          placeholder="차량번호"
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              localDistrict: { ...appData.basicDocs.localDistrict, vehiclePlate: e.target.value }
                            }
                          })}
                          className="flex-1 min-w-0 bg-transparent border-b border-slate-300 text-[10px] outline-none px-1 placeholder:text-slate-400"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer leading-tight">
                        <input 
                          type="checkbox" 
                          checked={appData.basicDocs.localDistrict.cadastreLandRecord}
                          onChange={(e) => setAppData({
                            ...appData,
                            basicDocs: {
                              ...appData.basicDocs,
                              localDistrict: { ...appData.basicDocs.localDistrict, cadastreLandRecord: e.target.checked }
                            }
                          })}
                          className="shrink-0"
                        />
                        <span className="whitespace-nowrap">지적전산자료조회결과서(토지소유현황)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. 채권사 목록 테이블 (그림 1 하단 테이블) */}
            <div className="border border-slate-900 text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-900 text-center font-bold">
                    <th className="border-r border-slate-900 py-1.5 w-12">번호</th>
                    <th className="border-r border-slate-900 py-1.5">채 권 사</th>
                    <th className="border-r border-slate-900 py-1.5 w-16 leading-tight">
                      부채<br />증명
                    </th>
                    <th className="border-r border-slate-900 py-1.5 w-16 leading-tight">
                      카드<br />거래
                    </th>
                    <th className="border-r border-slate-900 py-1.5 w-16 leading-tight">
                      통장<br />거래
                    </th>
                    <th className="py-1.5 w-60 border-r border-slate-900">비 고 사 항</th>
                    <th className="no-print py-1.5 w-10 text-center">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {appData.creditors.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/50">
                      <td className="border-r border-slate-900 py-1 text-center font-mono font-bold text-slate-800">
                        {idx + 1}
                      </td>
                      <td className="border-r border-slate-900 px-2 py-1">
                        <input 
                          type="text" 
                          value={row.creditorName} 
                          placeholder="채권사명 (예: 국민은행, 신한카드)"
                          onChange={(e) => handleUpdateCreditorRow(idx, { creditorName: e.target.value })}
                          className="w-full bg-transparent font-medium text-slate-900 outline-none"
                        />
                      </td>
                      <td className="border-r border-slate-900 py-1 text-center">
                        <input 
                          type="checkbox" 
                          checked={row.requestDebtCert} 
                          onChange={(e) => handleUpdateCreditorRow(idx, { requestDebtCert: e.target.checked })}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="border-r border-slate-900 py-1 text-center">
                        <input 
                          type="checkbox" 
                          checked={row.requestCardHistory} 
                          onChange={(e) => handleUpdateCreditorRow(idx, { requestCardHistory: e.target.checked })}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="border-r border-slate-900 py-1 text-center">
                        <input 
                          type="checkbox" 
                          checked={row.requestBankHistory} 
                          onChange={(e) => handleUpdateCreditorRow(idx, { requestBankHistory: e.target.checked })}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="border-r border-slate-900 px-2 py-1">
                        <input 
                          type="text" 
                          value={row.note || ''} 
                          placeholder="지점명, 계좌번호 등 메모"
                          onChange={(e) => handleUpdateCreditorRow(idx, { note: e.target.value })}
                          className="w-full bg-transparent text-slate-600 outline-none text-[11px]"
                        />
                      </td>
                      <td className="no-print py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCreditorRow(idx)}
                          className="text-slate-300 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 하단 행 추가 버튼 (인쇄 제외) */}
              <div className="no-print p-2 bg-slate-50 border-t border-slate-200 flex justify-center">
                <button
                  type="button"
                  onClick={handleAddCreditorRow}
                  className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>채권사 행 추가</span>
                </button>
              </div>
            </div>

            {/* 하단 페이지 워터마크 / 탭 표시 */}
            <div className="mt-4 pt-2 border-t border-slate-200 text-center text-xs text-slate-400 font-mono">
              [ 1 페이지 ] - 부채증명서 서류대행 신청서
            </div>

          </div>
          </div>
        </div>

      </div>
    </div>
  );
}
