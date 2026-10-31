import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';
import type { CreditorDirectoryItem } from '../../../services/court/creditorAddressDirectory';
import { suggestCreditorChange, type CreditorChanges } from '../../../services/court/creditorRegistryService';
import { getCrmOfficeScope } from '../../../services/crmService';

/**
 * 공용 채권자 정보 수정·추가 제안 (NF-5)
 * 사무소는 제안만 하고, 통합어드민이 확인한 뒤 모든 사무소에 반영된다. 개인 채권자는 제안하지 않는다.
 */
type FieldKey = 'official_name' | 'representative' | 'biz_number' | 'zip_code' | 'address' | 'service_address' | 'phone' | 'fax' | 'cert_desk';
const FIELDS: Array<{ key: FieldKey; label: string; from: (c: CreditorDirectoryItem) => string; placeholder?: string }> = [
  { key: 'official_name', label: '정식 이름', from: c => c.officialName, placeholder: '예: 주식회사 ○○은행' },
  { key: 'representative', label: '대표자', from: c => c.representative, placeholder: '예: 은행장 홍길동' },
  { key: 'biz_number', label: '사업자·법인번호', from: c => c.bizNumber },
  { key: 'zip_code', label: '우편번호', from: c => c.zipCode },
  { key: 'address', label: '본점 주소', from: c => c.address },
  { key: 'service_address', label: '송달 장소', from: c => c.serviceAddress },
  { key: 'phone', label: '대표 전화', from: c => c.phone || '' },
  { key: 'fax', label: '팩스', from: c => c.fax || '' },
  { key: 'cert_desk', label: '부채증명서 발급 창구', from: c => c.certDesk || '', placeholder: '예: 여신관리부 팩스 접수, 지점 방문 가능' },
];

export default function CreditorSuggestModal({ creditor, onClose }: { creditor: CreditorDirectoryItem | null; onClose: () => void }) {
  const isNew = !creditor;
  const [values, setValues] = useState<Record<FieldKey, string>>(() => {
    const v = {} as Record<FieldKey, string>;
    FIELDS.forEach(f => { v[f.key] = creditor ? f.from(creditor) : ''; });
    return v;
  });
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    const changes: CreditorChanges = {};
    FIELDS.forEach(f => {
      const now = values[f.key].trim();
      const before = creditor ? f.from(creditor).trim() : '';
      if (now !== before) (changes as any)[f.key] = now;
    });
    if (isNew) {
      if (!values.official_name.trim()) { setError('정식 이름을 적어 주세요.'); return; }
      (changes as any).category = 'OTHER';
    }
    if (Object.keys(changes).length === 0) { setError('바뀐 칸이 없어요.'); return; }
    if (!source.trim()) { setError('어디서 확인했는지 적어 주세요. 예: 법인등기사항증명서(2026. 11. 1. 발급), 회사 홈페이지'); return; }
    changes.source = source.trim();
    const officeId = getCrmOfficeScope();
    if (!officeId) { setError('사무소 정보를 불러오지 못했어요. 새로 고친 뒤 다시 시도해 주세요.'); return; }
    setBusy(true);
    const r = await suggestCreditorChange(officeId, creditor?.id ?? null, changes, note.trim());
    setBusy(false);
    if (r.ok === false) { setError(r.message); return; }
    toast.success('제안을 보냈어요. 통합어드민이 확인하면 모든 사무소에 반영돼요.');
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[10000] bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="creditor-suggest-title" className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 id="creditor-suggest-title" className="text-base font-bold text-slate-900">{isNew ? '새 채권자 정보 제안' : `${creditor!.officialName} 정보 수정 제안`}</h2>
            <button type="button" onClick={onClose} aria-label="닫기" className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed">금융회사·공공기관의 공개 정보만 제안해 주세요. 개인 채권자는 사건의 채권자 칸에만 적어요.</p>
            {FIELDS.map(f => (
              <label key={f.key} className="block">
                <span className="block text-sm font-bold text-slate-800 mb-1">{f.label}</span>
                <input
                  value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value.slice(0, f.key === 'cert_desk' ? 300 : 200) }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </label>
            ))}
            <label className="block">
              <span className="block text-sm font-bold text-slate-800 mb-1">확인한 곳 (필수)</span>
              <input value={source} onChange={e => setSource(e.target.value.slice(0, 200))} placeholder="예: 법인등기사항증명서 2026. 11. 1. 발급" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-slate-800 mb-1">메모</span>
              <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 500))} rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </label>
            {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <button type="button" onClick={onClose} className="flex-1 min-h-[44px] rounded-xl border border-slate-300 text-sm font-bold text-slate-800 whitespace-nowrap active:scale-[0.98]">취소</button>
            <button type="button" disabled={busy} onClick={submit} className="flex-1 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] disabled:opacity-60">{busy ? '보내는 중…' : '제안 보내기'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
