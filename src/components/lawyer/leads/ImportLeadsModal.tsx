import React, { useState, useRef, useMemo } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, Check, Download, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import type { SalesLead } from '../../../types/leadTypes';
import type { ConsultRequest } from '../../../types';
import { formatPhone, normalizeBirthYear } from '../../../services/leadService';
import { loadInboundPaths } from '../../../services/settingsService';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (leads: SalesLead[]) => void;
  existingLeads: SalesLead[];
  existingRequests: ConsultRequest[];
}

const TARGET_FIELDS = [
  { key: 'customerName', label: '고객명', required: true },
  { key: 'phone', label: '전화번호', required: true },
  { key: 'debtTotal', label: '총채무액(만원)' },
  { key: 'incomeNet', label: '월실소득(만원)' },
  { key: 'caseType', label: '사건유형' },
  { key: 'region', label: '거주지역' },
  { key: 'birth', label: '출생년도' },
  { key: 'gender', label: '성별' },
  { key: 'specialMemo', label: '메모/특이사항' },
];

export default function ImportLeadsModal({
  isOpen,
  onClose,
  onImport,
  existingLeads,
  existingRequests,
}: ImportLeadsModalProps) {
  const inboundPaths = useMemo(() => loadInboundPaths(), [isOpen]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [batchName, setBatchName] = useState(() => `${new Date().toISOString().slice(0, 7)} 대량 인입 DB`);
  const [defaultInboundPath, setDefaultInboundPath] = useState('타사DB구매');
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep(1);
    setRawHeaders([]);
    setRawData([]);
    setColumnMapping({});
    setAllowDuplicates(false);
    onClose();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['고객명', '전화번호', '총채무액(만원)', '월실소득(만원)', '사건유형', '거주지역', '출생년도', '성별', '특이사항'],
      ['김철수', '010-1234-5678', '6500', '280', '개인회생', '서울 관악구', '1988', '남', '카드론 3건 연체 임박'],
      ['이영희', '010-9876-5432', '12000', '0', '개인파산', '경기 수원시', '1975', '여', '무직, 건강문제로 파산희망'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '영업DB템플릿');
    XLSX.writeFile(wb, '영업DB_대량등록_템플릿.xlsx');
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonData.length < 1) {
          toast.error('파일에 데이터가 없습니다.');
          return;
        }

        const headers = jsonData[0].map(h => (h ? String(h).trim() : ''));
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''));
        
        setRawHeaders(headers);
        setRawData(rows);
        
        // 자동 컬럼 매핑
        const initialMapping: Record<string, string> = {};
        headers.forEach((header, index) => {
          const lower = header.toLowerCase();
          if (/고객명|이름|성명|name/.test(lower)) initialMapping[index] = 'customerName';
          else if (/전화번호|연락처|핸드폰|휴대폰|phone/.test(lower)) initialMapping[index] = 'phone';
          else if (/총채무|채무액|채무|debt/.test(lower)) initialMapping[index] = 'debtTotal';
          else if (/소득|급여|실수령|income/.test(lower)) initialMapping[index] = 'incomeNet';
          else if (/사건유형|사건구분|구분/.test(lower)) initialMapping[index] = 'caseType';
          else if (/지역|주소|거주지|region/.test(lower)) initialMapping[index] = 'region';
          else if (/출생년도|생년|출생|birth/.test(lower)) initialMapping[index] = 'birth';
          else if (/성별|gender/.test(lower)) initialMapping[index] = 'gender';
          else if (/메모|특이사항|비고|memo/.test(lower)) initialMapping[index] = 'specialMemo';
        });

        setColumnMapping(initialMapping);
        setStep(2);
      } catch (err) {
        toast.error('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  // 파싱 및 중복 분석
  const processedResults = useMemo(() => {
    if (step !== 3) return { valid: [], duplicates: [], errors: [] };

    const valid: SalesLead[] = [];
    const duplicates: any[] = [];
    const errors: any[] = [];

    const existingClientPhones = new Set(existingRequests.map(r => (r.phone || '').replace(/\D/g, '')));
    const existingLeadPhones = new Set(existingLeads.map(l => (l.phone || '').replace(/\D/g, '')));
    const seenBatchPhones = new Set<string>();

    rawData.forEach((row, idx) => {
      const obj: any = {};
      Object.entries(columnMapping).forEach(([colIdx, targetKey]) => {
        if (targetKey) obj[targetKey] = row[Number(colIdx)];
      });

      const customerName = String(obj.customerName || '').trim();
      const rawPhone = String(obj.phone || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '');

      if (!customerName || cleanPhone.length < 10) {
        errors.push({ row: idx + 2, reason: '이름 누락 또는 유효하지 않은 전화번호', data: row });
        return;
      }

      const formattedPhone = formatPhone(cleanPhone);
      const isClientDup = existingClientPhones.has(cleanPhone);
      const isLeadDup = existingLeadPhones.has(cleanPhone);
      const isBatchDup = seenBatchPhones.has(cleanPhone);

      if (isClientDup || isLeadDup || isBatchDup) {
        duplicates.push({
          row: idx + 2,
          customerName,
          phone: formattedPhone,
          reason: isClientDup ? '기존 CRM 고객과 중복' : isLeadDup ? '기존 영업 DB와 중복' : '파일 내 중복 번호',
        });
        if (!allowDuplicates) return;
      }

      seenBatchPhones.add(cleanPhone);

      const leadItem: SalesLead = {
        id: `lead-bulk-${Date.now()}-${idx}`,
        customerName,
        phone: formattedPhone,
        status: 'new',
        secondaryStatus: '신규인입',
        birth: normalizeBirthYear(String(obj.birth || '')),
        gender: String(obj.gender || '').includes('여') ? '여' : '남',
        region: String(obj.region || '').trim(),
        inboundPath: defaultInboundPath,
        batchName: batchName.trim(),
        caseType: String(obj.caseType || '').includes('파산') ? '개인파산' : '개인회생',
        jobTypes: ['급여소득'],
        insurance4: '가입',
        maritalStatus: '미혼',
        incomeNet: Number(obj.incomeNet) || 0,
        loanMonthlyPay: 0,
        housingType: '월세',
        deposit: 0,
        rent: 0,
        assets: [],
        debtTotal: Number(obj.debtTotal) || 0,
        creditCardUse: '사용',
        specialMemo: String(obj.specialMemo || '').trim(),
        callCount: 0,
        reminders: [],
        callLogs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      valid.push(leadItem);
    });

    return { valid, duplicates, errors };
  }, [step, rawData, columnMapping, allowDuplicates, existingLeads, existingRequests, defaultInboundPath, batchName]);

  const handleFinalImport = () => {
    if (processedResults.valid.length === 0) {
      toast.error('가져올 유효한 데이터가 없습니다.');
      return;
    }
    onImport(processedResults.valid);
    toast.success(`${processedResults.valid.length}건의 영업 DB가 성공적으로 등록되었습니다.`);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold shadow-sm shadow-violet-500/20">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">영업용 대량 DB 엑셀 업로드</h2>
              <p className="text-xs text-slate-500">타사 제3자동의 DB 및 광고 리드를 고객 CRM과 격리하여 등록합니다.</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-100 flex items-center justify-center gap-4 text-xs font-bold">
          <span className={`px-2.5 py-1 rounded-lg ${step === 1 ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>1. 파일 선택</span>
          <ArrowRight size={14} className="text-slate-400" />
          <span className={`px-2.5 py-1 rounded-lg ${step === 2 ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>2. 컬럼 매핑 & 배치</span>
          <ArrowRight size={14} className="text-slate-400" />
          <span className={`px-2.5 py-1 rounded-lg ${step === 3 ? 'bg-violet-600 text-white' : 'text-slate-500'}`}>3. 중복 검사 & 완료</span>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: 파일 업로드 */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging ? 'border-violet-500 bg-violet-50/50' : 'border-slate-200 hover:border-violet-400 hover:bg-slate-50'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <FileSpreadsheet size={26} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-800">엑셀(.xlsx, .xls) 또는 CSV 파일을 끌어다 놓으세요</p>
                  <p className="text-xs text-slate-500 mt-1">또는 클릭하여 컴퓨터에서 파일 선택</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">양식이 준비되지 않으셨나요?</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">표준 컬럼이 지정된 엑셀 템플릿을 다운로드받아 채워보세요.</p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Download size={13} />
                  <span>템플릿 받기</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 컬럼 매핑 & 배치명 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-violet-50/50 p-4 rounded-2xl border border-violet-100">
                <div>
                  <label className="block text-xs font-extrabold text-violet-900 mb-1">DB 배치명 (식별 태그)</label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={e => setBatchName(e.target.value)}
                    placeholder="예: 2026-09 타사동의DB 500건"
                    className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-violet-200 rounded-xl outline-hidden focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-violet-900 mb-1">기본 유입 경로</label>
                  <select
                    value={defaultInboundPath}
                    onChange={e => setDefaultInboundPath(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-violet-200 rounded-xl outline-hidden focus:ring-2 focus:ring-violet-500"
                  >
                    {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-slate-800 mb-2">엑셀 헤더 컬럼 자동 매핑 확인</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {rawHeaders.map((header, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="font-bold text-slate-700">{header || `(열 ${idx + 1})`}</span>
                      <select
                        value={columnMapping[idx] || ''}
                        onChange={e => setColumnMapping(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg outline-hidden"
                      >
                        <option value="">-- 매핑 안 함 --</option>
                        {TARGET_FIELDS.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label} {f.required ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 검증 결과 확인 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                  <p className="text-[11px] font-bold text-emerald-700">가져올 유효 건수</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">{processedResults.valid.length}건</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl">
                  <p className="text-[11px] font-bold text-amber-700">중복 감지</p>
                  <p className="text-xl font-black text-amber-700 mt-1">{processedResults.duplicates.length}건</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                  <p className="text-[11px] font-bold text-rose-700">오류/누락 제외</p>
                  <p className="text-xl font-black text-rose-700 mt-1">{processedResults.errors.length}건</p>
                </div>
              </div>

              {processedResults.duplicates.length > 0 && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-600" />
                      중복 번호 {processedResults.duplicates.length}건 발견
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowDuplicates}
                        onChange={e => setAllowDuplicates(e.target.checked)}
                        className="rounded text-violet-600"
                      />
                      <span className="font-bold">중복 건도 강제 등록</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    기본적으로 중복 번호는 영업 DB에 중복 등록되지 않도록 자동 건너뜁니다.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl flex items-center gap-2 text-xs text-blue-900">
                <ShieldCheck className="w-5 h-5 shrink-0 text-blue-600" />
                <span>
                  <strong>고객 CRM 격리 보장:</strong> 등록된 DB는 영업 관리 탭에만 보관되며, 정식 상담 통화 성공 후 이전하기 전까지 고객 관리 탭을 일체 오염시키지 않습니다.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 1 ? handleClose : () => setStep(prev => (prev - 1) as any)}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {step === 1 ? '취소' : '이전 단계'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 2 && !Object.values(columnMapping).includes('customerName')) {
                  toast.error('고객명 컬럼을 매핑해주세요.');
                  return;
                }
                setStep(prev => (prev + 1) as any);
              }}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            >
              다음 단계
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalImport}
              className="px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold shadow-sm shadow-violet-500/20 transition-all cursor-pointer press-scale active:scale-[0.98]"
            >
              {processedResults.valid.length}건 영업 DB 등록 완료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
