import React, { useState } from 'react';
import { Database, FileJson, FileSpreadsheet, Download, Shield, Clock, Users, MessageSquare, Briefcase, FileText, AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { exportEncryptedJsonBackup, exportExcelReport, getBackupStats, MIN_BACKUP_PASSWORD_LENGTH } from '../../services/dataExportService';
import { writeAuditLog } from '../../services/auditService';

interface DataBackupSectionProps {
  isOwner: boolean;
  lawyerName: string;
  /** 대표 변호사 ID — 감사 기록·백업 범위에 사용 */
  lawyerId?: string;
  /** 사무소 공유 단위 ID — 업무·일정·메시지 백업 범위 */
  tenantId?: string;
}

// 대표 변호사 전용 화면 (주의: 백업 대상은 이 브라우저 저장 데이터라 화면 제한만으로 보호되지 않는다)
export default function DataBackupSection({ isOwner, lawyerName, lawyerId = '', tenantId = '' }: DataBackupSectionProps) {
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  // 이전: useMemo(..., [])로 한 번만 계산해 백업 후에도 '마지막 백업'이 갱신되지 않음
  const [stats, setStats] = useState(() => getBackupStats());

  if (!isOwner) return null;

  const scopeIds = [tenantId, lawyerId].filter(Boolean);

  const handleJsonBackup = async () => {
    if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setPasswordError(`비밀번호는 ${MIN_BACKUP_PASSWORD_LENGTH}자 이상으로 입력해 주세요.`);
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setPasswordError('');
    setIsExportingJson(true);
    const result = await exportEncryptedJsonBackup(password, scopeIds);
    setIsExportingJson(false);
    if (result.success) {
      setPassword(''); setPasswordConfirm('');
      setStats(getBackupStats());
      writeAuditLog({ actor_id: lawyerId || 'unknown', actor_role: 'lawyer', action: 'download_report', target_type: 'data_backup', detail: { filename: result.filename, encrypted: true } }).catch(() => {});
      toast.success(`암호화 백업 파일을 저장했습니다: ${result.filename}`);
    } else {
      toast.error(result.error || '백업에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleExcelExport = async () => {
    setIsExportingExcel(true);
    const result = exportExcelReport();
    setIsExportingExcel(false);
    if (result.success) {
      writeAuditLog({ actor_id: lawyerId || 'unknown', actor_role: 'lawyer', action: 'export_excel', target_type: 'data_backup', detail: { filename: result.filename } }).catch(() => {});
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

  const inputCls = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 focus:border-[#1E3A5F]';

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
            <p className="text-sm text-slate-500">{lawyerName} 변호사님, 이 브라우저에 저장된 사무소 데이터를 내려받습니다.</p>
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
            <span>이 브라우저의 마지막 백업: {lastBackupText}</span>
          </div>
        )}
      </div>

      {/* 다운로드 액션 */}
      <div className="p-6 space-y-4">
        {/* 암호화 JSON 백업 */}
        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <FileJson className="w-5 h-5 text-blue-700" />
            </div>
            <div className="text-left">
              <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                암호화 JSON 백업 <Lock className="w-3.5 h-3.5 text-blue-700" />
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                파일은 입력한 비밀번호로 암호화됩니다(AES-256-GCM). 비밀번호를 잊으면 열 수 없습니다.<br />
                서버 DB 전체 백업이 아니며, 복원 기능은 아직 없습니다.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="backup-password" className="block text-[11px] font-bold text-slate-700 mb-1">백업 비밀번호 ({MIN_BACKUP_PASSWORD_LENGTH}자 이상)</label>
              <input id="backup-password" type="password" autoComplete="new-password" value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
                aria-invalid={!!passwordError} aria-describedby={passwordError ? 'backup-password-error' : undefined}
                className={inputCls} />
            </div>
            <div>
              <label htmlFor="backup-password-confirm" className="block text-[11px] font-bold text-slate-700 mb-1">비밀번호 확인</label>
              <input id="backup-password-confirm" type="password" autoComplete="new-password" value={passwordConfirm}
                onChange={e => { setPasswordConfirm(e.target.value); setPasswordError(''); }}
                aria-invalid={!!passwordError} aria-describedby={passwordError ? 'backup-password-error' : undefined}
                className={inputCls} />
            </div>
          </div>
          {passwordError && <p id="backup-password-error" role="alert" className="text-xs font-bold text-red-700">{passwordError}</p>}
          <div className="flex justify-end">
            <button
              onClick={handleJsonBackup}
              disabled={isExportingJson}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#163152] disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px] shadow-sm disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4" /> {isExportingJson ? '암호화 중...' : '암호화 백업 다운로드'}
            </button>
          </div>
        </div>

        {/* Excel 내보내기 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="text-left">
              <h4 className="font-extrabold text-sm text-slate-900">Excel 고객데이터 다운로드 (암호화 안 됨)</h4>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                고객 상담, 재무정보, 제안서, 채팅, 계약, 사건, 활동로그를<br />
                시트별로 정리한 Excel 파일입니다. 파일 자체에는 암호가 걸리지 않습니다.
              </p>
            </div>
          </div>
          <button
            onClick={handleExcelExport}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] whitespace-nowrap min-h-[44px] shadow-sm disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-4 h-4" /> {isExportingExcel ? '생성 중...' : 'Excel 다운로드'}
          </button>
        </div>

        {/* 안내 */}
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/60 border border-amber-200/60 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed font-medium text-left">
            <strong>백업 파일에는 고객 개인정보가 포함됩니다.</strong><br />
            개인정보보호법에 따라 안전한 저장 장소에 보관하시고, 불필요 시 즉시 파기해 주세요.
            다운로드 기록은 감사 로그에 남습니다(서버 연동 시).
          </div>
        </div>
      </div>
    </div>
  );
}
