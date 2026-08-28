import React, { useState, useCallback, useRef, useMemo } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, Check, Download, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { IntakeChannel, INTAKE_CHANNEL_CONFIG } from '../../types';
import { formatPhone } from '../../services/crmService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (cases: ImportedCase[]) => void;
  existingRequests: Array<{ id: string; clientName?: string; phone?: string; status?: string }>;
}

export interface ImportedCase {
  clientName: string;
  phone: string;
  debtTotal?: number;
  income?: number;
  intakeChannel: IntakeChannel;
  specialMemo?: string;
  region?: string;
  birth?: string;
  gender?: string;
  caseType?: string;
}

const TARGET_FIELDS = [
  { key: 'clientName', label: '고객명', required: true },
  { key: 'phone', label: '전화번호', required: true },
  { key: 'debtTotal', label: '총채무액(만원)' },
  { key: 'income', label: '월소득(만원)' },
  { key: 'intakeChannel', label: '유입경로' },
  { key: 'caseType', label: '사건유형' },
  { key: 'region', label: '지역' },
  { key: 'birth', label: '출생년도' },
  { key: 'gender', label: '성별' },
  { key: 'specialMemo', label: '메모' },
];

export default function ImportCasesModal({ isOpen, onClose, onImport, existingRequests }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [defaultIntakeChannel, setDefaultIntakeChannel] = useState<IntakeChannel>('naver_ad');
  
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  // Reset modal state
  const handleClose = () => {
    setStep(1);
    setRawHeaders([]);
    setRawData([]);
    setColumnMapping({});
    setAllowDuplicates(false);
    setDefaultIntakeChannel('naver_ad');
    onClose();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['고객명', '전화번호', '총채무액(만원)', '월소득(만원)', '지역', '출생년도', '성별', '사건유형', '메모'],
      ['홍길동', '010-1234-5678', '5000', '300', '서울', '1985', '남', '개인회생', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '신규케이스');
    XLSX.writeFile(wb, '신규케이스_업로드_템플릿.xlsx');
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

        const headers = jsonData[0].map(h => h ? String(h).trim() : '');
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''));
        
        setRawHeaders(headers);
        setRawData(rows);
        
        // Auto-mapping
        const initialMapping: Record<string, string> = {};
        headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase();
          if (/고객명|이름|성명|customername/.test(lowerHeader)) initialMapping[index] = 'clientName';
          else if (/전화번호|연락처|핸드폰|phone/.test(lowerHeader)) initialMapping[index] = 'phone';
          else if (/총채무|채무액|부채|debttotal/.test(lowerHeader)) initialMapping[index] = 'debtTotal';
          else if (/소득|월소득|월급|income/.test(lowerHeader)) initialMapping[index] = 'income';
          else if (/유입경로|채널|광고매체/.test(lowerHeader)) initialMapping[index] = 'intakeChannel';
          else if (/사건유형|상담유형/.test(lowerHeader)) initialMapping[index] = 'caseType';
          else if (/메모|비고|특이사항/.test(lowerHeader)) initialMapping[index] = 'specialMemo';
          else if (/지역|거주지/.test(lowerHeader)) initialMapping[index] = 'region';
          else if (/출생년도|생년/.test(lowerHeader)) initialMapping[index] = 'birth';
          else if (/성별/.test(lowerHeader)) initialMapping[index] = 'gender';
        });
        
        setColumnMapping(initialMapping);
        setStep(2);
      } catch (error) {
        toast.error('파일을 읽는 중 오류가 발생했습니다.');
        console.error(error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleMappingChange = (colIndex: number, field: string) => {
    setColumnMapping(prev => {
      const newMapping = { ...prev };
      if (!field) {
        delete newMapping[colIndex];
      } else {
        // Remove if mapped somewhere else
        Object.keys(newMapping).forEach(key => {
          if (newMapping[key] === field) delete newMapping[key];
        });
        newMapping[colIndex] = field;
      }
      return newMapping;
    });
  };

  const validateMapping = () => {
    const mappedFields = Object.values(columnMapping);
    if (!mappedFields.includes('clientName') || !mappedFields.includes('phone')) {
      toast.error('고객명과 전화번호는 필수 항목입니다.');
      return false;
    }
    return true;
  };

  const goToPreview = () => {
    if (validateMapping()) {
      setStep(3);
    }
  };

  // Generate preview data
  const previewData = useMemo(() => {
    return rawData.map((row, index) => {
      const caseData: any = {
        intakeChannel: defaultIntakeChannel
      };
      
      Object.entries(columnMapping).forEach(([colIdxStr, fieldKey]) => {
        const colIdx = parseInt(colIdxStr, 10);
        const cellValue = row[colIdx];
        if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
          if (fieldKey === 'phone') {
            caseData[fieldKey] = formatPhone(String(cellValue));
          } else if (fieldKey === 'debtTotal' || fieldKey === 'income') {
            caseData[fieldKey] = Number(String(cellValue).replace(/[^0-9.-]+/g,""));
          } else {
            caseData[fieldKey] = String(cellValue);
          }
        }
      });

      // Validation
      const isMissingRequired = !caseData.clientName || !caseData.phone;
      
      // Duplicate check
      const duplicateInfo = caseData.phone ? existingRequests.find(r => r.phone === caseData.phone) : null;
      const isDuplicate = !!duplicateInfo;

      let status = 'valid';
      if (isMissingRequired) status = 'error';
      else if (isDuplicate) status = 'duplicate';

      return {
        _index: index,
        _status: status,
        _duplicateInfo: duplicateInfo,
        data: caseData as ImportedCase
      };
    });
  }, [rawData, columnMapping, defaultIntakeChannel, existingRequests]);

  const summary = useMemo(() => {
    return previewData.reduce((acc, curr) => {
      acc[curr._status as keyof typeof acc]++;
      return acc;
    }, { valid: 0, duplicate: 0, error: 0 });
  }, [previewData]);

  const handleImport = () => {
    const casesToImport = previewData
      .filter(row => row._status === 'valid' || (allowDuplicates && row._status === 'duplicate'))
      .map(row => row.data);
      
    if (casesToImport.length === 0) {
      toast.error('가져올 데이터가 없습니다.');
      return;
    }

    onImport(casesToImport);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <FileSpreadsheet className="w-5 h-5 mr-2 text-blue-600" />
            엑셀/CSV 일괄 등록
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-8 py-6 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {[1, 2, 3].map((s, idx) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s ? 'bg-blue-600 text-white' : 'bg-white border-2 border-slate-200 text-slate-400'
                  }`}>
                    {s}
                  </div>
                  <span className={`text-xs mt-2 ${step >= s ? 'text-blue-600 font-medium' : 'text-slate-500'}`}>
                    {s === 1 ? '파일 업로드' : s === 2 ? '항목 매핑' : '미리보기'}
                  </span>
                </div>
                {idx < 2 && (
                  <div className={`flex-1 h-0.5 mx-4 ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed h-[200px] rounded-2xl flex flex-col items-center justify-center transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 bg-slate-50'
                }`}
              >
                <Upload className={`w-10 h-10 mb-3 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
                <p className="text-slate-600 font-medium mb-1">여기로 파일을 드래그하거나</p>
                <p className="text-sm text-slate-500 mb-4">.xlsx, .xls, .csv 지원</p>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                  파일 선택
                </button>
              </div>

              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div>
                  <h4 className="text-sm font-bold text-blue-900 mb-1">양식이 필요하신가요?</h4>
                  <p className="text-xs text-blue-700">권장 엑셀 템플릿을 다운로드하여 데이터를 입력하세요.</p>
                </div>
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center px-4 py-2 bg-white text-blue-700 text-sm font-medium rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  템플릿 다운로드
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl text-sm flex items-start border border-yellow-200">
                <AlertTriangle className="w-5 h-5 mr-2 shrink-0 text-yellow-600" />
                <div>
                  <p className="font-medium">필수 항목 지정</p>
                  <p className="mt-1 opacity-90">업로드된 파일의 열(Column)과 시스템 항목을 매핑해주세요. <strong>고객명</strong>과 <strong>전화번호</strong>는 필수입니다.</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">항목 매핑</h3>
                <div className="flex items-center text-sm">
                  <span className="text-slate-600 mr-2">기본 유입경로:</span>
                  <select 
                    value={defaultIntakeChannel}
                    onChange={(e) => setDefaultIntakeChannel(e.target.value as IntakeChannel)}
                    className="border border-slate-300 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-500"
                  >
                    {Object.entries(INTAKE_CHANNEL_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500 font-medium">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 w-1/2">엑셀 파일 열 (첫 번째 행)</th>
                      <th className="px-4 py-3 border-b border-slate-200 w-1/2">시스템 항목</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rawHeaders.map((header, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{header || `(이름 없는 열 ${index + 1})`}</td>
                        <td className="px-4 py-3">
                          <select
                            value={columnMapping[index] || ''}
                            onChange={(e) => handleMappingChange(index, e.target.value)}
                            className={`w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors ${
                              columnMapping[index] ? 'border-blue-300 bg-blue-50' : 'border-slate-300 bg-white'
                            }`}
                          >
                            <option value="">-- 선택 안함 --</option>
                            {TARGET_FIELDS.map(field => {
                              const isMappedElsewhere = Object.entries(columnMapping).some(([i, v]) => v === field.key && i !== String(index));
                              return (
                                <option key={field.key} value={field.key} disabled={isMappedElsewhere}>
                                  {field.label} {field.required ? '*' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <span className="text-green-800 font-medium text-sm mb-1">등록 가능</span>
                  <span className="text-2xl font-bold text-green-700">{summary.valid}건</span>
                </div>
                <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <span className="text-yellow-800 font-medium text-sm mb-1">중복</span>
                  <span className="text-2xl font-bold text-yellow-700">{summary.duplicate}건</span>
                </div>
                <div className="flex-1 bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <span className="text-red-800 font-medium text-sm mb-1">오류</span>
                  <span className="text-2xl font-bold text-red-700">{summary.error}건</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <h3 className="font-bold text-slate-800">미리보기 <span className="text-slate-500 font-normal text-sm">(최대 10건)</span></h3>
                <label className="flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={allowDuplicates}
                    onChange={(e) => setAllowDuplicates(e.target.checked)}
                    className="mr-2 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  중복 건도 등록
                </label>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-xs sm:text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-left text-slate-500 font-medium">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-200 w-10 text-center">상태</th>
                      <th className="px-4 py-3 border-b border-slate-200">고객명</th>
                      <th className="px-4 py-3 border-b border-slate-200">전화번호</th>
                      <th className="px-4 py-3 border-b border-slate-200">총채무액</th>
                      <th className="px-4 py-3 border-b border-slate-200">월소득</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className={`
                        ${row._status === 'error' ? 'bg-red-50' : ''}
                        ${row._status === 'duplicate' ? 'bg-yellow-50' : ''}
                        ${row._status === 'valid' ? 'hover:bg-slate-50' : ''}
                      `}>
                        <td className="px-4 py-3 text-center">
                          {row._status === 'valid' && <Check className="w-4 h-4 text-green-500 mx-auto" />}
                          {row._status === 'duplicate' && <AlertTriangle className="w-4 h-4 text-yellow-500 mx-auto" />}
                          {row._status === 'error' && <X className="w-4 h-4 text-red-500 mx-auto" />}
                        </td>
                        <td className="px-4 py-3">
                          <span className={!row.data.clientName ? 'text-red-500 italic' : 'text-slate-800'}>
                            {row.data.clientName || '누락'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={!row.data.phone ? 'text-red-500 italic' : 'text-slate-800 font-mono'}>
                            {row.data.phone || '누락'}
                          </span>
                          {row._status === 'duplicate' && row._duplicateInfo && (
                            <span className="block text-xs text-yellow-700 mt-1">
                              기존: {row._duplicateInfo.clientName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.data.debtTotal ? row.data.debtTotal.toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.data.income ? row.data.income.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                    {previewData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {previewData.length > 10 && (
                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500 font-medium">
                    외 {previewData.length - 10}건
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-between shrink-0">
          <button
            onClick={step === 1 ? handleClose : () => setStep(step - 1 as 1|2)}
            className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors min-h-[44px]"
          >
            {step === 1 ? '취소' : '이전'}
          </button>
          
          {step < 3 ? (
            <button
              onClick={() => step === 1 ? setStep(2) : goToPreview()}
              disabled={step === 1 && rawData.length === 0}
              className="flex items-center px-8 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed press-scale min-h-[44px] whitespace-nowrap"
            >
              다음 <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleImport}
              className="flex items-center px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-colors press-scale min-h-[44px] whitespace-nowrap shadow-sm"
            >
              <Upload className="w-4 h-4 mr-2" />
              {summary.valid + (allowDuplicates ? summary.duplicate : 0)}건 등록하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
