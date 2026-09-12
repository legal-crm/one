import React, { useState, useEffect } from 'react';
import { 
  X, Settings, Plus, Trash2, ShieldCheck, Check, AlertTriangle, 
  Send, PhoneForwarded, Layers, Building, Link2, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import type { Partner, MissedCallIntervalTier, TelegramRoomTarget } from '../../../types/leadTypes';
import { 
  loadStatuses, saveStatuses,
  loadSecondaryStatuses, saveSecondaryStatuses,
  loadInboundPaths, saveInboundPaths,
  loadPartners, savePartners,
  loadIntervalTiers, saveIntervalTiers,
  loadTelegramRooms, saveTelegramRooms
} from '../../../services/settingsService';

interface SalesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

type TabKey = 'statuses' | 'partners' | 'inbound' | 'missed_calls' | 'integrations';

export default function SalesSettingsModal({
  isOpen,
  onClose,
  title = '영업 및 CRM 마스터 환경설정'
}: SalesSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('statuses');

  // 1. 상태
  const [statuses, setStatuses] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState('');
  const [secondaryStatuses, setSecondaryStatuses] = useState<string[]>([]);
  const [newSecondaryStatus, setNewSecondaryStatus] = useState('');

  // 2. 파트너
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerMemo, setNewPartnerMemo] = useState('');

  // 3. 인입 경로
  const [inboundPaths, setInboundPaths] = useState<string[]>([]);
  const [newPath, setNewPath] = useState('');

  // 4. 부재 티어
  const [intervalTiers, setIntervalTiers] = useState<MissedCallIntervalTier[]>([]);

  // 5. 텔레그램 연동
  const [telegramRooms, setTelegramRooms] = useState<TelegramRoomTarget[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomUrl, setNewRoomUrl] = useState('');

  // 삭제 마이그레이션 모달
  const [migrationTarget, setMigrationTarget] = useState<string>('');
  const [itemToDelete, setItemToDelete] = useState<{ type: 'status' | 'inbound'; value: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatuses(loadStatuses());
      setSecondaryStatuses(loadSecondaryStatuses());
      setInboundPaths(loadInboundPaths());
      setPartners(loadPartners());
      setIntervalTiers(loadIntervalTiers());
      setTelegramRooms(loadTelegramRooms());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── 1. 상태 핸들러 ──
  const handleAddStatus = () => {
    if (!newStatus.trim()) return;
    if (statuses.includes(newStatus.trim())) {
      toast.error('이미 존재하는 상태입니다.');
      return;
    }
    const updated = [...statuses, newStatus.trim()];
    setStatuses(updated);
    saveStatuses(updated);
    setNewStatus('');
    toast.success(`1차 상태 '${newStatus.trim()}' 추가 완료`);
  };

  const handleAddSecondaryStatus = () => {
    if (!newSecondaryStatus.trim()) return;
    if (secondaryStatuses.includes(newSecondaryStatus.trim())) {
      toast.error('이미 존재하는 2차 상태입니다.');
      return;
    }
    const updated = [...secondaryStatuses, newSecondaryStatus.trim()];
    setSecondaryStatuses(updated);
    saveSecondaryStatuses(updated);
    setNewSecondaryStatus('');
    toast.success(`2차 세부 상태 '${newSecondaryStatus.trim()}' 추가 완료`);
  };

  // ── 2. 파트너사 핸들러 ──
  const handleAddPartner = () => {
    if (!newPartnerName.trim()) return;
    const newP: Partner = {
      id: `partner-${Date.now()}`,
      name: newPartnerName.trim(),
      memo: newPartnerMemo.trim() || undefined,
      rules: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [...partners, newP];
    setPartners(updated);
    savePartners(updated);
    setNewPartnerName('');
    setNewPartnerMemo('');
    toast.success(`파트너사 '${newP.name}' 추가 완료`);
  };

  const handleDeletePartner = (id: string) => {
    const updated = partners.filter(p => p.id !== id);
    setPartners(updated);
    savePartners(updated);
    toast.success('파트너사가 삭제되었습니다.');
  };

  // ── 3. 인입 경로 핸들러 ──
  const handleAddInboundPath = () => {
    if (!newPath.trim()) return;
    if (inboundPaths.includes(newPath.trim())) {
      toast.error('이미 등록된 경로입니다.');
      return;
    }
    const updated = [...inboundPaths, newPath.trim()];
    setInboundPaths(updated);
    saveInboundPaths(updated);
    setNewPath('');
    toast.success(`인입 경로 '${newPath.trim()}' 추가 완료`);
  };

  // ── 4. 부재 티어 핸들러 ──
  const handleUpdateTierMinutes = (idx: number, minutes: number) => {
    const next = [...intervalTiers];
    next[idx].minutes = minutes;
    setIntervalTiers(next);
    saveIntervalTiers(next);
  };

  // ── 5. 텔레그램 핸들러 ──
  const handleAddTelegramRoom = () => {
    if (!newRoomName.trim() || !newRoomUrl.trim()) {
      toast.error('알림방 이름과 웹훅 URL을 모두 입력해주세요.');
      return;
    }
    const newRoom: TelegramRoomTarget = {
      id: `tg-${Date.now()}`,
      name: newRoomName.trim(),
      webhookUrl: newRoomUrl.trim(),
      active: true,
    };
    const updated = [...telegramRooms, newRoom];
    setTelegramRooms(updated);
    saveTelegramRooms(updated);
    setNewRoomName('');
    setNewRoomUrl('');
    toast.success(`텔레그램 알림방 '${newRoom.name}' 등록 완료`);
  };

  const handleDeleteTelegramRoom = (id: string) => {
    const updated = telegramRooms.filter(r => r.id !== id);
    setTelegramRooms(updated);
    saveTelegramRooms(updated);
    toast.success('텔레그램 알림방이 삭제되었습니다.');
  };

  // ── 삭제 시 마이그레이션 확정 ──
  const handleConfirmDeletion = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'status') {
      const updated = statuses.filter(s => s !== itemToDelete.value);
      setStatuses(updated);
      saveStatuses(updated);
      toast.success(`'${itemToDelete.value}' 상태가 삭제되었으며, 기존 건은 '${migrationTarget || '종결'}'(으)로 이전되었습니다.`);
    } else if (itemToDelete.type === 'inbound') {
      const updated = inboundPaths.filter(p => p !== itemToDelete.value);
      setInboundPaths(updated);
      saveInboundPaths(updated);
      toast.success(`'${itemToDelete.value}' 경로가 삭제되었으며, 기존 건은 '${migrationTarget || '기타'}'(으)로 이전되었습니다.`);
    }
    setItemToDelete(null);
    setMigrationTarget('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">영업 및 CRM 실무 프로세스를 법인 실정에 맞게 독립 설정합니다.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 bg-slate-100/50 border-b border-slate-200 flex gap-2 overflow-x-auto text-xs font-bold pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('statuses')}
            className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'statuses' ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>상태 종류 관리</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'partners' ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building size={14} />
            <span>거래처 / 파트너사</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inbound')}
            className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inbound' ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 size={14} />
            <span>인입 경로 관리</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('missed_calls')}
            className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'missed_calls' ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PhoneForwarded size={14} />
            <span>부재콜 알림 티어</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-2.5 rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'integrations' ? 'bg-white text-blue-600 border-t-2 border-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send size={14} />
            <span>외부 연동 (Telegram)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 탭 1: 상태 종류 관리 */}
          {activeTab === 'statuses' && (
            <div className="space-y-6">
              {/* 1차 상태 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-extrabold text-slate-900 text-xs mb-3 flex items-center justify-between">
                  <span>1차 메인 진행 상태 ({statuses.length}종)</span>
                  <span className="text-[11px] text-slate-500 font-normal">삭제 시 기존 고객 대체 상태 이전 지원</span>
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="새 상태명 입력 (예: 2차상담완료)"
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddStatus}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    추가
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statuses.map(s => (
                    <div key={s} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 shadow-2xs font-bold text-slate-800">
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setItemToDelete({ type: 'status', value: s });
                          setMigrationTarget(statuses.find(x => x !== s) || '종결');
                        }}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2차 세부 상태 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-extrabold text-slate-900 text-xs mb-3">
                  2차 실무 세부 상태 (사무장/상담원 태그)
                </h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="새 2차 세부 상태 입력 (예: 서류미비)"
                    value={newSecondaryStatus}
                    onChange={e => setNewSecondaryStatus(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddSecondaryStatus}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    추가
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {secondaryStatuses.map(s => (
                    <div key={s} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 shadow-2xs font-bold text-slate-800">
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = secondaryStatuses.filter(x => x !== s);
                          setSecondaryStatuses(updated);
                          saveSecondaryStatuses(updated);
                        }}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 탭 2: 거래처 / 파트너사 */}
          {activeTab === 'partners' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs">신규 거래처/제휴사 등록</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="거래처/파트너사 명 (예: 리걸마케팅 제휴사)"
                    value={newPartnerName}
                    onChange={e => setNewPartnerName(e.target.value)}
                    className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="메모 / 담당자 연락처"
                    value={newPartnerMemo}
                    onChange={e => setNewPartnerMemo(e.target.value)}
                    className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddPartner}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>파트너사 추가</span>
                </button>
              </div>

              <div className="space-y-2">
                {partners.map(p => (
                  <div key={p.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                      {p.memo && <span className="text-slate-500 text-[11px] ml-2">({p.memo})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePartner(p.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 탭 3: 인입 경로 */}
          {activeTab === 'inbound' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-extrabold text-slate-900 text-xs mb-3">인입 마케팅 경로 관리</h4>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="새 인입 경로 입력 (예: 페이스북 2차광고)"
                    value={newPath}
                    onChange={e => setNewPath(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddInboundPath}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    추가
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {inboundPaths.map(p => (
                    <div key={p} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 shadow-2xs font-bold text-slate-800">
                      <span>{p}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setItemToDelete({ type: 'inbound', value: p });
                          setMigrationTarget(inboundPaths.find(x => x !== p) || '기타');
                        }}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 탭 4: 부재콜 알림 티어 */}
          {activeTab === 'missed_calls' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <h4 className="font-extrabold text-slate-900 text-xs mb-2">부재 경과 시간별 알림 티어</h4>
                <p className="text-[11px] text-slate-500 mb-4">
                  통화 시도 후 응답이 없을 때, 다음 재시도까지 경과 시간을 단계별로 관리합니다.
                </p>
                <div className="space-y-3">
                  {intervalTiers.map((tier, idx) => (
                    <div key={tier.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs">
                      <span className={`font-extrabold ${tier.color}`}>{tier.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="10"
                          step="10"
                          value={tier.minutes}
                          onChange={e => handleUpdateTierMinutes(idx, Number(e.target.value))}
                          className="w-20 px-2 py-1 text-center font-bold border border-slate-200 rounded-lg outline-hidden"
                        />
                        <span className="text-slate-500 font-bold">분</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 탭 5: 외부 연동 (Telegram) */}
          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Send size={14} className="text-sky-500" />
                  <span>텔레그램 알림방 웹훅 등록</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="알림방 식별명 (예: 영업 1팀 알림)"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="https://api.telegram.org/bot.../sendMessage"
                    value={newRoomUrl}
                    onChange={e => setNewRoomUrl(e.target.value)}
                    className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddTelegramRoom}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>알림방 연동 추가</span>
                </button>
              </div>

              <div className="space-y-2">
                {telegramRooms.length === 0 ? (
                  <p className="text-center text-slate-400 py-4">등록된 텔레그램 연동 채널이 없습니다.</p>
                ) : (
                  telegramRooms.map(r => (
                    <div key={r.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="font-bold text-slate-900 text-xs">{r.name}</span>
                        <span className="text-slate-400 text-[11px] block truncate max-w-sm">{r.webhookUrl}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTelegramRoom(r.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer press-scale active:scale-[0.98]"
          >
            설정 저장 및 닫기
          </button>
        </div>
      </div>

      {/* 마이그레이션 확인 팝업 */}
      {itemToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-5 rounded-2xl shadow-xl max-w-sm w-full space-y-4 border border-slate-200">
            <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="text-amber-500 w-5 h-5" />
              <span>데이터 마이그레이션 안내</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>'{itemToDelete.value}'</strong> 항목을 삭제하면, 기존에 이 항목으로 지정된 데이터들이 영향을 받습니다. 대체할 대상을 선택해주세요.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">대체 대상 선택</label>
              <select
                value={migrationTarget}
                onChange={e => setMigrationTarget(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white"
              >
                {itemToDelete.type === 'status'
                  ? statuses.filter(s => s !== itemToDelete.value).map(s => <option key={s} value={s}>{s}</option>)
                  : inboundPaths.filter(p => p !== itemToDelete.value).map(p => <option key={p} value={p}>{p}</option>)
                }
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletion}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold"
              >
                이전 후 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
