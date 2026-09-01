import React, { useState } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style'; // [SECURITY Fix H-4] xlsx prototype pollution CVE-2023-30533 대응
import { CRM_STATUS_CONFIG, INTAKE_CHANNEL_CONFIG } from '../../types';
import type { ConsultRequest, CrmClientExtension, CrmStatus, IntakeChannel } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requests: ConsultRequest[];
  getCrmExt: (id: string) => CrmClientExtension;
}

const EXPORT_COLUMNS = [
  { key: 'clientName', label: '고객명', checked: true },
  { key: 'phone', label: '전화번호', checked: true },
  { key: 'status', label: '상태', checked: true },
  { key: 'channel', label: '유입채널', checked: true },
  { key: 'caseType', label: '사건유형', checked: true },
  { key: 'createdAt', label: '등록일', checked: true },
  { key: 'debtTotal', label: '총채무액(만원)', checked: true },
  { key: 'income', label: '월소득(만원)', checked: true },
  { key: 'region', label: '지역', checked: false },
  { key: 'assignee', label: '담당자', checked: false },
  { key: 'memo', label: '최근메모', checked: false },
] as const;

type ColumnKey = typeof EXPORT_COLUMNS[number]['key'];

export default function ExportCasesModal({ isOpen, onClose, requests, getCrmExt }: Props) {
  const [dateMode, setDateMode] = useState<'all' | 'month' | 'custom'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [columns, setColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(EXPORT_COLUMNS.map(c => [c.key, c.checked]))
  );

  if (!isOpen) return null;

  const toggleColumn = (key: string) => {
    setColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getFilteredRequests = () => {
    let filtered = [...requests];

    if (dateMode === 'month') {
      const now = new Date();
      filtered = filtered.filter(r => {
        const d = new Date(r.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (dateMode === 'custom' && dateFrom && dateTo) {
      const from = new Date(dateFrom + 'T00:00:00');
      const to = new Date(dateTo + 'T23:59:59');
      filtered = filtered.filter(r => {
        const d = new Date(r.createdAt);
        return d >= from && d <= to;
      });
    }

    return filtered;
  };

  const handleExport = () => {
    const filtered = getFilteredRequests();
    if (filtered.length === 0) {
      toast.error('내보낼 데이터가 없습니다.');
      return;
    }

    const activeColumns = EXPORT_COLUMNS.filter(c => columns[c.key]);
    const headers = activeColumns.map(c => c.label);

    const rows = filtered.map(r => {
      const ext = getCrmExt(r.id);
      const fp = r.financialProfile;
      const row: string[] = [];

      activeColumns.forEach(col => {
        switch (col.key) {
          case 'clientName': row.push(r.clientName || ''); break;
          case 'phone': row.push(r.phone || ''); break;
          case 'status': {
            const status = ext.crmStatus as CrmStatus;
            row.push(CRM_STATUS_CONFIG[status]?.label || status);
            break;
          }
          case 'channel': {
            const ch = ext.intakeChannel as IntakeChannel;
            row.push(ch ? (INTAKE_CHANNEL_CONFIG[ch]?.label || ch) : '마이김변');
            break;
          }
          case 'caseType': row.push(ext.caseType || ''); break;
          case 'createdAt': row.push(r.createdAt ? new Date(r.createdAt).toLocaleDateString('ko-KR') : ''); break;
          case 'debtTotal': row.push(fp?.debtTotal?.toString() || ''); break;
          case 'income': row.push(fp?.income?.toString() || ''); break;
          case 'region': row.push(ext.region || fp?.residenceRegion || ''); break;
          case 'assignee': row.push(ext.assigneeId || ext.assignedLawyerId || ''); break;
          case 'memo': {
            const lastNote = ext.notes?.[ext.notes.length - 1];
            row.push(lastNote?.content || '');
            break;
          }
          default: row.push('');
        }
      });

      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Set column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CRM 데이터');

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(wb, `마이김변_CRM_내보내기_${today}.xlsx`);
    toast.success(`${filtered.length}건 엑셀 다운로드 완료`);
    onClose();
  };

  const filteredCount = getFilteredRequests().length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">엑셀 내보내기</h2>
              <p className="text-xs text-slate-500">CRM 데이터를 Excel 파일로 다운로드합니다</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Date Range */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">기간 설정</label>
          <div className="flex gap-2 mb-3">
            {([
              { key: 'all', label: '전체' },
              { key: 'month', label: '이번 달' },
              { key: 'custom', label: '직접 지정' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setDateMode(opt.key)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
                  dateMode === opt.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {dateMode === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:outline-none"
              />
              <span className="text-slate-400 text-sm">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Column Selection */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-gray-700 mb-2">출력 컬럼</label>
          <div className="grid grid-cols-2 gap-2">
            {EXPORT_COLUMNS.map(col => (
              <label
                key={col.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-sm ${
                  columns[col.key]
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={columns[col.key]}
                  onChange={() => toggleColumn(col.key)}
                  className="accent-blue-600 rounded"
                />
                <span className="font-medium">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-xl p-3 mb-5 text-center">
          <span className="text-sm text-slate-600">내보낼 건수: </span>
          <span className="text-lg font-black text-slate-900">{filteredCount}</span>
          <span className="text-sm text-slate-600">건</span>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={filteredCount === 0}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 font-bold text-white shadow-md hover:from-emerald-700 hover:to-emerald-600 transition-colors active:scale-[0.98] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          엑셀 다운로드 ({filteredCount}건)
        </button>
      </div>
    </div>
  );
}
