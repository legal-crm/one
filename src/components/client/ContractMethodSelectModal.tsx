import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Building2, 
  Mail, 
  CheckCircle2, 
  ArrowRight, 
  Calendar, 
  Clock, 
  MapPin, 
  AlertCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import type { ConsultProposal } from '../../types';

export type ContractMethodChoice = 'electronic' | 'in_person' | 'postal';

export interface OfflineContractRequestPayload {
  method: 'in_person' | 'postal';
  visitDate?: string;
  visitTime?: string;
  postalAddress?: string;
  postalDetailAddress?: string;
  postcode?: string;
  notes?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  proposal: ConsultProposal;
  clientDisplayName?: string;
  onSelectElectronic: () => Promise<void>;
  onSelectOffline: (payload: OfflineContractRequestPayload) => Promise<void>;
}

export default function ContractMethodSelectModal({
  isOpen,
  onClose,
  proposal,
  clientDisplayName,
  onSelectElectronic,
  onSelectOffline,
}: Props) {
  if (!isOpen) return null;

  // 내일 날짜 기본값
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const [selectedMethod, setSelectedMethod] = useState<ContractMethodChoice>('electronic');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 방문 체결 입력값
  const [visitDate, setVisitDate] = useState<string>(tomorrowStr);
  const [visitTime, setVisitTime] = useState<string>('14:00');
  const [visitNotes, setVisitNotes] = useState<string>('');

  // 우편 등기 입력값
  const [postalAddress, setPostalAddress] = useState<string>('');
  const [postalDetailAddress, setPostalDetailAddress] = useState<string>('');
  const [postcode, setPostcode] = useState<string>('');
  const [postalNotes, setPostalNotes] = useState<string>('');

  const handleConfirm = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      if (selectedMethod === 'electronic') {
        await onSelectElectronic();
        onClose();
      } else if (selectedMethod === 'in_person') {
        if (!visitDate) {
          setErrorMessage('방문 희망 날짜를 선택해 주세요.');
          setSubmitting(false);
          return;
        }
        await onSelectOffline({
          method: 'in_person',
          visitDate,
          visitTime,
          notes: visitNotes.trim() || undefined,
        });
        onClose();
      } else if (selectedMethod === 'postal') {
        if (!postalAddress.trim()) {
          setErrorMessage('계약서를 수령하실 기본 주소를 입력해 주세요.');
          setSubmitting(false);
          return;
        }
        await onSelectOffline({
          method: 'postal',
          postalAddress: postalAddress.trim(),
          postalDetailAddress: postalDetailAddress.trim() || undefined,
          postcode: postcode.trim() || undefined,
          notes: postalNotes.trim() || undefined,
        });
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 mb-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>수임계약 체결 방식 선택</span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              {proposal.lawyerName} 변호사 수임계약
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 제안서 조건 요약 배너 */}
        <div className="px-6 py-3 bg-indigo-50/60 border-b border-indigo-100/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600">
            약정 수임료: <strong className="text-slate-900 font-bold">{proposal.fee}만원</strong>
            {proposal.installment && <span className="text-indigo-700 font-medium"> ({proposal.installment})</span>}
          </span>
          <span className="text-slate-500 font-medium">
            위임인: <strong className="text-slate-800">{clientDisplayName || '의뢰인'}</strong>
          </span>
        </div>

        {/* 모달 본문 (스크롤) */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700">
          <p className="text-xs font-medium text-slate-600 leading-relaxed break-keep">
            원하시는 계약 체결 방식을 선택해 주세요. 온라인 전자계약뿐만 아니라 사무소 방문이나 우편(등기)을 통한 서면 체결도 가능합니다.
          </p>

          {/* 3가지 방식 선택 라디오 카드 목록 */}
          <div className="space-y-3">
            {/* 1. 간편 전자계약 */}
            <div
              onClick={() => setSelectedMethod('electronic')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedMethod === 'electronic'
                  ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    selectedMethod === 'electronic' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">간편 전자계약</span>
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                        가장 빠름 · 권장
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed break-keep">
                      휴대폰 본인인증(PASS/문자) 후 스마트폰 화면에서 계약서를 확인하고 즉시 자필 서명합니다. (약 3분 소요)
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedMethod === 'electronic' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {selectedMethod === 'electronic' && <CheckCircle2 className="w-3.5 h-3.5 fill-white text-indigo-600" />}
                </div>
              </div>

              {selectedMethod === 'electronic' && (
                <div className="mt-3 pt-3 border-t border-indigo-100/80 flex items-center gap-1.5 text-[11px] text-indigo-700">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>전자서명법 제3조에 따라 공인된 법적 효력을 갖는 정식 위임계약서입니다.</span>
                </div>
              )}
            </div>

            {/* 2. 사무소 방문 체결 */}
            <div
              onClick={() => setSelectedMethod('in_person')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedMethod === 'in_person'
                  ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    selectedMethod === 'in_person' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">법률사무소 내방(방문) 체결</span>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed break-keep">
                      담당 변호사 사무소에 직접 내방하여 대면 상담 후 실물 종이 계약서에 서명 또는 도장을 날인합니다.
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedMethod === 'in_person' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {selectedMethod === 'in_person' && <CheckCircle2 className="w-3.5 h-3.5 fill-white text-indigo-600" />}
                </div>
              </div>

              {/* 방문 선택 시 폼 노출 */}
              {selectedMethod === 'in_person' && (
                <div className="mt-4 pt-4 border-t border-indigo-100 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        방문 희망 날짜 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={tomorrowStr}
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        방문 희망 시간
                      </label>
                      <select
                        value={visitTime}
                        onChange={(e) => setVisitTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="10:00">오전 10:00</option>
                        <option value="11:00">오전 11:00</option>
                        <option value="14:00">오후 02:00</option>
                        <option value="15:30">오후 03:30</option>
                        <option value="17:00">오후 05:00</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      사무소 전달 사항 / 메모 (선택)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 신분증 및 소득 서류 지참 예정, 배우자 동행 등"
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    ※ 요청 접수 시 담당자가 전화 또는 채팅으로 정확한 사무소 위치와 방문 일정을 확정해 드립니다.
                  </p>
                </div>
              )}
            </div>

            {/* 3. 우편(등기) 계약 체결 */}
            <div
              onClick={() => setSelectedMethod('postal')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                selectedMethod === 'postal'
                  ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    selectedMethod === 'postal' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">우편(등기) 서면 계약</span>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed break-keep">
                      휴대폰 본인인증이 어렵거나 방문이 힘든 경우, 법률사무소에서 계약서 2부를 등기로 발송해 드리며 서명 후 1부를 반송합니다.
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedMethod === 'postal' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                }`}>
                  {selectedMethod === 'postal' && <CheckCircle2 className="w-3.5 h-3.5 fill-white text-indigo-600" />}
                </div>
              </div>

              {/* 우편 선택 시 폼 노출 */}
              {selectedMethod === 'postal' && (
                <div className="mt-4 pt-4 border-t border-indigo-100 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      계약서 수령 배송지 주소 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="기본 주소 (예: 서울특별시 서초구 서초대로 123)"
                      value={postalAddress}
                      onChange={(e) => setPostalAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 mb-1.5"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="상세 주소 (동/호수)"
                        value={postalDetailAddress}
                        onChange={(e) => setPostalDetailAddress(e.target.value)}
                        className="col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="우편번호"
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                        className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      배송 메모 (선택)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 부재 시 문 앞, 경비실 보관 등"
                      value={postalNotes}
                      onChange={(e) => setPostalNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    ※ 등기우편 발송 후 카카오톡/문자로 우체국 등기번호(배송추적)를 안내해 드립니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <span>
              {submitting
                ? '처리 중...'
                : selectedMethod === 'electronic'
                ? '전자계약서 작성하러 가기'
                : selectedMethod === 'in_person'
                ? '방문 체결 일정 요청하기'
                : '우편 등기 발송 요청하기'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
