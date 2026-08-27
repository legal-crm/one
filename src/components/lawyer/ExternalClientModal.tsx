import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { IntakeChannel, INTAKE_CHANNEL_CONFIG, CrmStatus, CRM_STATUS_CONFIG, User } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: { clientName: string; phone: string; debtTotal: number; income: number; intakeChannel: IntakeChannel; channelDetail?: string; initialStatus: CrmStatus }) => void;
  lawyers: User[];
}

export default function ExternalClientModal({ isOpen, onClose, onRegister, lawyers }: Props) {
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [debtTotal, setDebtTotal] = useState<number | ''>('');
  const [income, setIncome] = useState<number | ''>('');
  const [intakeChannel, setIntakeChannel] = useState<IntakeChannel>('naver_ad');
  const [channelDetail, setChannelDetail] = useState('');
  const [initialStatus, setInitialStatus] = useState<CrmStatus>('consulting');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error('의뢰인 이름을 입력해주세요.');
      return;
    }
    if (!phone.trim()) {
      toast.error('전화번호를 입력해주세요.');
      return;
    }

    onRegister({
      clientName,
      phone,
      debtTotal: Number(debtTotal) || 0,
      income: Number(income) || 0,
      intakeChannel,
      channelDetail,
      initialStatus
    });
    
    setClientName('');
    setPhone('');
    setDebtTotal('');
    setIncome('');
    setIntakeChannel('portal_search');
    setChannelDetail('');
    setInitialStatus('consulting');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">외부 의뢰인 등록</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">의뢰인 이름 *</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="홍길동"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">전화번호 *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="010-0000-0000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">총 채무액 (만원)</label>
              <input
                type="number"
                value={debtTotal}
                onChange={(e) => setDebtTotal(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">월 소득 (만원)</label>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="300"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">유입 채널</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(INTAKE_CHANNEL_CONFIG) as [IntakeChannel, any][]).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIntakeChannel(key)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                    intakeChannel === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {config.emoji} {config.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">채널 상세 메모 (선택)</label>
            <textarea
              value={channelDetail}
              onChange={(e) => setChannelDetail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="지인 소개 이름, 검색 키워드 등"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">초기 CRM 상태</label>
            <select
              value={initialStatus}
              onChange={(e) => setInitialStatus(e.target.value as CrmStatus)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.entries(CRM_STATUS_CONFIG) as [CrmStatus, any][]).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="press-scale mt-6 flex min-h-[44px] w-full items-center justify-center whitespace-nowrap rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 font-bold text-white shadow-md hover:from-blue-700 hover:to-blue-600"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            등록하기
          </button>
        </form>
      </div>
    </div>
  );
};
