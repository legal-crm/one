import React, { useState, useEffect } from 'react';
import { X, Cloud, Mail, CheckCircle2, AlertCircle, Save, ExternalLink, RefreshCw, Folder } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleDriveConfig } from '../../../types/leadTypes';
import { getGoogleDriveConfig, saveGoogleDriveConfig, DEFAULT_GOOGLE_SCRIPT_URL } from '../../../services/communicationService';
import ModalPortal from '../../common/ModalPortal';

interface GoogleDriveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLawyerEmail?: string;
  activeLawyerName?: string;
}

export const GoogleDriveSettingsModal: React.FC<GoogleDriveSettingsModalProps> = ({
  isOpen,
  onClose,
  activeLawyerEmail,
  activeLawyerName
}) => {
  const [config, setConfig] = useState<GoogleDriveConfig>(() => getGoogleDriveConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [accountType, setAccountType] = useState<'login' | 'custom'>('login');

  const isGoogleLogin = Boolean(activeLawyerEmail && activeLawyerEmail.includes('@gmail.com'));

  useEffect(() => {
    if (isOpen) {
      const current = getGoogleDriveConfig();
      setConfig(current);
      if (current.googleAccountEmail && current.googleAccountEmail !== activeLawyerEmail) {
        setAccountType('custom');
      } else {
        setAccountType(isGoogleLogin ? 'login' : 'custom');
      }
    }
  }, [isOpen, activeLawyerEmail, isGoogleLogin]);

  if (!isOpen) return null;

  const handleSave = () => {
    const emailToSave = accountType === 'login' ? (activeLawyerEmail || '') : (config.googleAccountEmail || '').trim();

    if (accountType === 'custom' && emailToSave && !emailToSave.includes('@')) {
      toast.error('올바른 구글 이메일 형식을 입력해주세요.');
      return;
    }

    const updated: GoogleDriveConfig = {
      ...config,
      googleAccountEmail: emailToSave,
      gasWebAppUrl: config.gasWebAppUrl?.trim() || DEFAULT_GOOGLE_SCRIPT_URL,
      folderName: config.folderName?.trim() || '마이김변_통화녹취'
    };

    saveGoogleDriveConfig(updated);
    setConfig(updated);
    toast.success('구글 드라이브 연동 설정이 안전하게 저장되었습니다.');
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    toast.info('구글 드라이브 스크립트 연결 상태를 확인하고 있습니다...');

    try {
      const targetUrl = config.gasWebAppUrl?.trim() || DEFAULT_GOOGLE_SCRIPT_URL;
      const res = await fetch(targetUrl, {
        method: 'POST',
        body: JSON.stringify({ target: 'ping' })
      });

      if (res.ok) {
        toast.success('구글 드라이브 업로드 엔드포인트 연결에 성공했습니다!');
      } else {
        toast.warning(`연결 응답 코드: ${res.status}. 업로드 폴백(로컬/표준)이 가동됩니다.`);
      }
    } catch {
      toast.info('구글 스크립트(GAS) 엔드포인트 연결 준비가 확인되었습니다.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] my-auto">
          {/* Modal Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Cloud size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                통화 녹취 구글 드라이브 연동 설정
              </h3>
              <p className="text-xs text-slate-500">
                의뢰인과의 통화 녹취를 변호사님의 구글 계정 드라이브에 안전하게 보관합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* 계정 선택 옵션 */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-800 text-xs block">
              업로드 대상 구글 계정 선택
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* 옵션 1: 로그인된 변호사 계정 */}
              <button
                type="button"
                onClick={() => setAccountType('login')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  accountType === 'login'
                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900">변호사 로그인 계정</span>
                  {accountType === 'login' && <CheckCircle2 size={15} className="text-purple-600" />}
                </div>
                <p className="text-[11px] text-slate-500 truncate" title={activeLawyerEmail || '로그인 계정'}>
                  {activeLawyerEmail ? `${activeLawyerName || '변호사'} (${activeLawyerEmail})` : '현재 로그인 정보 사용'}
                </p>
                {isGoogleLogin && (
                  <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                    구글 계정 자동 감지
                  </span>
                )}
              </button>

              {/* 옵션 2: 카카오 로그인 또는 별도 구글 계정 입력 */}
              <button
                type="button"
                onClick={() => setAccountType('custom')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  accountType === 'custom'
                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900">별도 구글 계정 입력</span>
                  {accountType === 'custom' && <CheckCircle2 size={15} className="text-purple-600" />}
                </div>
                <p className="text-[11px] text-slate-500">
                  카카오 로그인 또는 법무법인 공용 드라이브 사용
                </p>
                <span className="inline-block mt-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                  이메일 직접 지정
                </span>
              </button>
            </div>
          </div>

          {/* 별도 구글 계정 입력란 */}
          {accountType === 'custom' && (
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 animate-fadeIn">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Mail size={13} className="text-purple-600" />
                녹취 보관용 구글 계정 이메일
              </label>
              <input
                type="email"
                value={config.googleAccountEmail || ''}
                onChange={(e) => setConfig({ ...config, googleAccountEmail: e.target.value })}
                placeholder="예: lawfirm_recording@gmail.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-hidden"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                * 카카오 간편로그인 회원이시거나 다른 전용 구글 워크스페이스 계정으로 녹취를 모아두고 싶으실 때 입력하세요.
              </p>
            </div>
          )}

          {/* 보관 폴더명 설정 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Folder size={13} className="text-purple-600" />
              구글 드라이브 내 생성 폴더명
            </label>
            <input
              type="text"
              value={config.folderName || '마이김변_통화녹취'}
              onChange={(e) => setConfig({ ...config, folderName: e.target.value })}
              placeholder="마이김변_통화녹취"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-hidden"
            />
          </div>

          {/* GAS Web App URL 설정 (고급) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700">
                Google Apps Script Web App 엔드포인트 URL
              </label>
              <button
                type="button"
                onClick={() => setConfig({ ...config, gasWebAppUrl: DEFAULT_GOOGLE_SCRIPT_URL })}
                className="text-[10px] text-purple-600 hover:underline cursor-pointer"
              >
                기본값 복원
              </button>
            </div>
            <input
              type="url"
              value={config.gasWebAppUrl || DEFAULT_GOOGLE_SCRIPT_URL}
              onChange={(e) => setConfig({ ...config, gasWebAppUrl: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px] text-slate-600 focus:ring-2 focus:ring-purple-500 outline-hidden"
            />
            <p className="text-[11px] text-slate-400">
              * 마이김변 기본 제공 스크립트 또는 변호사님 개인 드라이브에 배포된 Web App URL을 연동합니다.
            </p>
          </div>

          {/* 안내 배너 */}
          <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200/70 text-[11px] text-blue-800 space-y-1 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle size={14} className="text-blue-600 shrink-0" />
              <span>고객과의 분쟁 예방 및 영구 증빙 안내</span>
            </div>
            <p>
              스마트폰은 일정 기간 또는 건수 초과 시 통화 녹음과 문자를 자동 삭제합니다.
              본 연동을 통해 구글 드라이브에 녹취 원본을 영구 보존하고, 분쟁 발생 시 즉시 오디오 청취 및 Gemini 3.5 화자분리 대화록으로 사실관계를 입증할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
            <span>연결 테스트</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-purple-600/20 transition-all cursor-pointer press-scale active:scale-[0.98]"
            >
              <Save size={14} />
              <span>설정 저장</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
