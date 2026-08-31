import React, { useState, useMemo } from 'react';
import { Database, FileJson, FileSpreadsheet, Download, Shield, Clock, Users, MessageSquare, Briefcase, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { exportFullJsonBackup, exportExcelReport, getBackupStats } from '../../services/dataExportService';

interface DataBackupSectionProps {
  isOwner: boolean;
  lawyerName: string;
}

export default function DataBackupSection({ isOwner, lawyerName }: DataBackupSectionProps) {
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const stats = useMemo(() => getBackupStats(), []);

  if (!isOwner) return null;

  const handleJsonBackup = async () => {
    setIsExportingJson(true);
    // 짧은 딜레이로 UI 상태 반영
    await new Promise(r => setTimeout(r, 300));
    const result = exportFullJsonBackup();
    setIsExportingJson(false);
    if (result.success) {
      toast.success(`전체 백업 완료: ${result.filename}`);
    } else {
      toast.error('백업에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleExcelExport = async () => {
    setIsExportingExcel(true);
    await new Promise(r => setTimeout(r, 300));
    const result = exportExcelReport();
    setIsExportingExcel(false);
    if (result.success) {
      toast.success(`Excel 다운로드 완료: ${result.filename}`);
    } else {
      toast.error('Excel 내보내기에 실패했습니다.');
    }
  };

  const lastBackupText = stats.lastBackup
    ? (() => {
        const d = new Date(stats.lastBackup);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })()
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shadow-sm">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              데이터 백업
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Shield className="w-3 h-3" />대표변호사 전용
              </span>
            </h3>
            <p className="text-sm text-slate-500">플랫폼 데이터를 다운로드하여 안전하게 보관하세요</p>
          </div>
        </div>
      </div>

      {/* 데이터 통계 */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, label: '상담 신청', value: stats.clientCount, color: 'text-blue-600' },
            { icon: MessageSquare, label: '채팅 메시지', value: stats.messageCount, color: 'text-emerald-600' },
            { icon: Briefcase, label: '사건 관리', value: stats.caseCount, color: 'text-violet-600' },
            { icon: FileText, label: '전자 계약', value: stats.contractCount, color: 'text-amber-600' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
              <div className="text-lg font-extrabold text-slate-900">{item.value.toLocaleString()}</div>
              <div className="text-[11px] font-bold text-slate-500">{item.label}</div>
            </div>
          ))}
        </div>
        {lastBackupText && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>마지막 백업: {lastBackupText}</span>
          </div>
        )}
      </div>

      {/* 다운로드 액션 */}
      <div className="p-6 space-y-4">
        {/* JSON 백업 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <FileJson className="w-5 h-5 text-blue-700" />
            </div>
            <div className="text-left">
              <h4 className="font-extrabold text-sm text-slate-900">전체 JSON 백업</h4>
              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                모든 데이터를 원본 형태로 저장합니다.<br />
                DB 삭제 시 완전 복원에 사용할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            onClick={handleJsonBackup}
            disabled={isExportingJson}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#163152] disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px] shadow-sm disabled:cursor-not-allowed cursor-pointer"
          >
            {isExportingJson ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 백업 중...</>
            ) : (
              <><Download className="w-4 h-4" /> JSON 백업 다운로드</>
            )}
          </button>
        </div>

        {/* Excel 내보내기 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="text-left">
              <h4 className="font-extrabold text-sm text-slate-900">Excel 고객데이터 다운로드</h4>
              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                고객 상담, 재무정보, 제안서, 채팅, 계약, 사건, 활동로그를<br />
                시트별로 정리한 Excel 파일을 다운로드합니다.
              </p>
            </div>
          </div>
          <button
            onClick={handleExcelExport}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px] shadow-sm disabled:cursor-not-allowed cursor-pointer"
          >
            {isExportingExcel ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 생성 중...</>
            ) : (
              <><Download className="w-4 h-4" /> Excel 다운로드</>
            )}
          </button>
        </div>

        {/* 안내 */}
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/60 border border-amber-200/60 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed font-medium text-left">
            <strong>백업 파일에는 고객 개인정보가 포함됩니다.</strong><br />
            개인정보보호법에 따라 안전한 저장 장소에 보관하시고, 불필요 시 즉시 파기해 주세요.
            백업 이력은 활동 로그에 기록됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}
