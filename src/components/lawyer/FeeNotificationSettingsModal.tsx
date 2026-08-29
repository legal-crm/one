import React, { useState, useEffect } from 'react';
import { X, Settings, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { FeeNotificationSettings } from '../../types';
import { loadFeeNotificationSettings, saveFeeNotificationSettings } from '../../services/alimtokService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeeNotificationSettingsModal({ isOpen, onClose }: Props) {
  const [settings, setSettings] = useState<FeeNotificationSettings | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(loadFeeNotificationSettings());
    }
  }, [isOpen]);

  if (!isOpen || !settings) return null;

  const handleSave = () => {
    saveFeeNotificationSettings(settings);
    toast.success('수임료 알림 설정이 저장되었습니다.');
    onClose();
  };

  const updateRule = (id: string, updates: Partial<FeeNotificationSettings['rules'][0]>) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rules: prev.rules.map(r => r.id === id ? { ...r, ...updates } : r)
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">수임료 안내 발송 설정</h2>
              <p className="text-xs text-slate-500">자동 알림톡 발송 규칙 및 계좌정보 관리</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          {/* 전체 자동 발송 스위치 */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">전체 자동 발송 사용</h3>
              <p className="text-xs text-slate-500 mt-1">이 기능을 끄면 모든 수임료 안내가 자동으로 발송되지 않습니다.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.autoTriggerEnabled}
                onChange={e => setSettings({ ...settings, autoTriggerEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 발송 규칙 목록 */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm mb-2 px-1">자동 발송 스케줄 규칙</h3>
            {settings.rules.map(rule => (
              <div key={rule.id} className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${rule.enabled ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={rule.enabled}
                    onChange={e => updateRule(rule.id, { enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-sm text-slate-800">{rule.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      기준일: {rule.daysOffset === 0 ? '당일(D-Day)' : rule.daysOffset < 0 ? `D${rule.daysOffset}` : `D+${rule.daysOffset}`} / 발송 템플릿: {rule.milestone}
                    </div>
                  </div>
                </div>
                <select 
                  value={rule.sendTime}
                  onChange={e => updateRule(rule.id, { sendTime: e.target.value })}
                  disabled={!rule.enabled}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="09:00">09:00</option>
                  <option value="09:30">09:30</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="14:00">14:00</option>
                  <option value="17:00">17:00</option>
                </select>
              </div>
            ))}
          </div>

          {/* 입금 계좌 정보 */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm mb-2 px-1">입금 계좌 정보</h3>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">은행명</label>
                  <input 
                    type="text" 
                    value={settings.bankInfo.bankName}
                    onChange={e => setSettings({ ...settings, bankInfo: { ...settings.bankInfo, bankName: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">예금주</label>
                  <input 
                    type="text" 
                    value={settings.bankInfo.accountHolder}
                    onChange={e => setSettings({ ...settings, bankInfo: { ...settings.bankInfo, accountHolder: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">계좌번호</label>
                <input 
                  type="text" 
                  value={settings.bankInfo.accountNumber}
                  onChange={e => setSettings({ ...settings, bankInfo: { ...settings.bankInfo, accountNumber: e.target.value } })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
             <input 
                type="checkbox" 
                id="sendReceipt"
                checked={settings.sendReceiptOnPaid}
                onChange={e => setSettings({ ...settings, sendReceiptOnPaid: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500 cursor-pointer mt-0.5"
              />
              <label htmlFor="sendReceipt" className="text-sm font-bold text-emerald-900 cursor-pointer">
                납부 확인(입금) 시 자동 영수증 안내 발송
              </label>
          </div>

        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors active:scale-[0.98]"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 min-h-[44px] rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
