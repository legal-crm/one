// src/components/lawyer/filing/CourtPetitionEditModal.tsx
// ============================================================
// [대법원 전산양식 D5101] 개인회생절차 개시신청서 본안 정밀 편집 모달
// - 탭 1: 신청인 인적사항 (성명, 주민번호, 주소, 실거주지, 직장)
// - 탭 2: 관할법원 & 신청이유 (전국 14개 회생관할, 급여/영업소득 구분, 신청원인 서술)
// - 탭 3: 송달영수인 & 대리인 (송달장소, 송달영수인 변호사, 대리인 사무소)
// - 탭 4: 환급계좌 & SMS 수신 (절차비용 반환계좌, 대법원 사건진행 문자통지)
// ============================================================

import React, { useState, useEffect } from 'react';
import { 
  X, Save, FileText, User, Building, MapPin, Phone, 
  CreditCard, Bell, Sparkles, CheckCircle2, AlertCircle,
  Briefcase, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';
import type { ConsultRequest, CrmClientExtension, CourtPetitionData } from '../../../types';

interface CourtPetitionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

const REHAB_COURTS = [
  '서울회생법원',
  '수원회생법원',
  '부산회생법원',
  '의정부지방법원',
  '인천지방법원',
  '춘천지방법원',
  '대전지방법원',
  '청주지방법원',
  '대구지방법원',
  '울산지방법원',
  '창원지방법원',
  '광주지방법원',
  '전주지방법원',
  '제주지방법원'
];

const MAJOR_BANKS = [
  '국민은행', '신한은행', '우리은행', '하나은행', '농협은행',
  '기업은행', '카카오뱅크', '토스뱅크', '케이뱅크', '우체국',
  'SC제일은행', '수협은행', '신협', '새마을금고', '부산은행', '대구은행'
];

export default function CourtPetitionEditModal({
  isOpen,
  onClose,
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '정충원'
}: CourtPetitionEditModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'applicant' | 'court_claim' | 'service' | 'refund_sms'>('applicant');
  const [isSaving, setIsSaving] = useState(false);

  // 기존 저장 데이터 또는 기본값 로드
  const [formData, setFormData] = useState<CourtPetitionData>(() => {
    const p = crmExt.petitionInfo;
    const clientName = p?.clientName || clientRequest.clientName || '신청인';
    const clientPhone = p?.phone || clientRequest.phone || '010-3107-3310';
    const courtName = p?.courtName || crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
    const residentAddress = p?.residentAddress || (clientRequest as any).address || '서울특별시 구로구 개봉로11길 46-25, 201호';

    return {
      courtName,
      clientName,
      rrnFront: p?.rrnFront || (clientRequest as any).rrnFront || '710812',
      rrnBack: p?.rrnBack || (clientRequest as any).rrnBack || '1234567',
      phone: clientPhone,
      tel: p?.tel || '',
      residentAddress,
      residentPostcode: p?.residentPostcode || '08349',
      currentAddress: p?.currentAddress || residentAddress,
      currentPostcode: p?.currentPostcode || '08349',
      companyName: p?.companyName || (clientRequest as any).companyName || '주식회사 한국테크',
      companyAddress: p?.companyAddress || '서울특별시 마포구 마포대로 20, 7층',
      companyPostcode: p?.companyPostcode || '04175',
      incomeType: p?.incomeType || 'salary',
      servicePlaceType: p?.servicePlaceType || 'firm',
      servicePlaceAddress: p?.servicePlaceAddress || '서울특별시 도봉구 마들로 760 (도봉동, 한밭법조타워) 301호',
      servicePlacePostcode: p?.servicePlacePostcode || '01323',
      serviceRecipient: p?.serviceRecipient || `변호사 ${activeLawyerName}`,
      lawyerName: p?.lawyerName || activeLawyerName,
      firmName: p?.firmName || '법률사무소 보광',
      firmAddress: p?.firmAddress || '서울특별시 도봉구 마들로 760 (도봉동, 한밭법조타워) 301호',
      firmPhone: p?.firmPhone || '02-955-8488',
      firmFax: p?.firmFax || '02-2179-8487',
      firmEmail: p?.firmEmail || 'lawyer@lawfirm.co.kr',
      refundBank: p?.refundBank || (crmExt.repaymentPlan as any)?.bankName || '우체국',
      refundAccount: p?.refundAccount || (crmExt.repaymentPlan as any)?.accountNumber || '110-0122-33536',
      refundAccountHolder: p?.refundAccountHolder || clientName,
      smsNotificationConsent: p?.smsNotificationConsent !== undefined ? p.smsNotificationConsent : true,
      smsNotificationPhone: p?.smsNotificationPhone || clientPhone,
      petitionReasonDetail: p?.petitionReasonDetail || '1. 신청인은 첨부한 개인회생채권자목록 기재와 같은 채무를 부담하고 있으나, 수입 및 재산이 별지 수입 및 지출에 관한 목록과 재산목록에 기재된 바와 같으므로 파산의 원인사실이 발생하였습니다(파산의 원인사실이 생길 염려가 있습니다).'
    };
  });

  const handleChange = (field: keyof CourtPetitionData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updated: CourtPetitionData = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      await onUpdateCrmExt({
        petitionInfo: updated
      });

      toast.success('개인회생절차 개시신청서 본안(D5101) 기재사항이 저장되었습니다.');
      onClose();
    } catch (err) {
      console.error('Failed to save petition info:', err);
      toast.error('신청서 기재사항 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
        <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] max-h-[calc(100vh-2.5rem)] animate-fadeIn">
        {/* 모달 상단 헤더 */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">
                  개인회생절차 개시신청서 본안 (D5101) 편집
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  R01 표준서식
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                대법원 전자소송 제출용 신청서 본문 1쪽·2쪽 기재사항 및 송달·환급 정보를 직접 수정합니다.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('applicant')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'applicant'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. 신청인 인적사항</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('court_claim')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'court_claim'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>2. 관할법원 & 신청이유</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('service')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'service'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>3. 송달영수인 & 대리인</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('refund_sms')}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'refund_sms'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>4. 환급계좌 & 문자통지</span>
          </button>
        </div>

        {/* 탭 본문 내용 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 탭 1: 신청인 인적사항 */}
          {activeTab === 'applicant' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-blue-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  신청인 인적사항은 주민등록초본상 기재내용과 토씨 하나 틀리지 않게 일치해야 법원 보정명령을 예방할 수 있습니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">신청인 성명 *</label>
                  <input
                    type="text"
                    value={formData.clientName || ''}
                    onChange={(e) => handleChange('clientName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">주민등록번호 *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={formData.rrnFront || ''}
                      onChange={(e) => handleChange('rrnFront', e.target.value)}
                      placeholder="앞 6자리"
                      className="w-1/2 px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                    <span className="text-slate-400 font-bold">-</span>
                    <input
                      type="text"
                      maxLength={7}
                      value={formData.rrnBack || ''}
                      onChange={(e) => handleChange('rrnBack', e.target.value)}
                      placeholder="뒤 7자리"
                      className="w-1/2 px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">휴대전화 번호 *</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="010-XXXX-XXXX"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">유선전화 (집·직장)</label>
                  <input
                    type="text"
                    value={formData.tel || ''}
                    onChange={(e) => handleChange('tel', e.target.value)}
                    placeholder="없을 시 비워둠"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 주소 영역 */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">주민등록상 주소 (등본상 주소) *</label>
                    <span className="text-slate-500 font-mono text-[11px]">우편번호</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.residentAddress || ''}
                      onChange={(e) => handleChange('residentAddress', e.target.value)}
                      placeholder="주민등록등본상 주소 전체 기재"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                    <input
                      type="text"
                      maxLength={5}
                      value={formData.residentPostcode || ''}
                      onChange={(e) => handleChange('residentPostcode', e.target.value)}
                      placeholder="08349"
                      className="w-24 px-3 py-2 border border-slate-300 rounded-xl font-mono text-center text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">실거주지 (현주소) *</label>
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('currentAddress', formData.residentAddress);
                        handleChange('currentPostcode', formData.residentPostcode);
                        toast.info('주민등록상 주소와 동일하게 적용되었습니다.');
                      }}
                      className="text-blue-600 hover:text-blue-700 text-[11px] font-bold cursor-pointer"
                    >
                      주민등록주소와 동일
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.currentAddress || ''}
                      onChange={(e) => handleChange('currentAddress', e.target.value)}
                      placeholder="실제 거주하고 있는 주소"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                    <input
                      type="text"
                      maxLength={5}
                      value={formData.currentPostcode || ''}
                      onChange={(e) => handleChange('currentPostcode', e.target.value)}
                      placeholder="08349"
                      className="w-24 px-3 py-2 border border-slate-300 rounded-xl font-mono text-center text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* 직장 정보 */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-slate-500" />
                  <span>직장 정보</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">직장명(사업체명)</label>
                    <input
                      type="text"
                      value={formData.companyName || ''}
                      onChange={(e) => handleChange('companyName', e.target.value)}
                      placeholder="예: 주식회사 한국테크"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-700 font-bold">직장 주소</label>
                      <span className="text-slate-500 font-mono text-[11px]">우편번호</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.companyAddress || ''}
                        onChange={(e) => handleChange('companyAddress', e.target.value)}
                        placeholder="직장 소재지 주소"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                      <input
                        type="text"
                        maxLength={5}
                        value={formData.companyPostcode || ''}
                        onChange={(e) => handleChange('companyPostcode', e.target.value)}
                        placeholder="04175"
                        className="w-24 px-3 py-2 border border-slate-300 rounded-xl font-mono text-center text-slate-900 focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 탭 2: 관할법원 & 신청이유 */}
          {activeTab === 'court_claim' && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <label className="block text-slate-700 font-bold mb-1">관할법원 지정 *</label>
                <select
                  value={formData.courtName || '서울회생법원'}
                  onChange={(e) => handleChange('courtName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:border-blue-500 focus:outline-hidden"
                >
                  {REHAB_COURTS.map(court => (
                    <option key={court} value={court}>{court}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  ※ 채무자의 보통재판적 소재지(주민등록 주소) 또는 주된 사무소나 영업소 소재지 법원을 선택합니다.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-2">채무자 소득 성격 (신청 자격 구분) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    formData.incomeType === 'salary'
                      ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="incomeType"
                      checked={formData.incomeType === 'salary'}
                      onChange={() => handleChange('incomeType', 'salary')}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs">급여소득자</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        근로자, 일용직, 아르바이트 등 정기적이고 확실한 급여를 수령하는 자
                      </p>
                    </div>
                  </label>

                  <label className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    formData.incomeType === 'business'
                      ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="incomeType"
                      checked={formData.incomeType === 'business'}
                      onChange={() => handleChange('incomeType', 'business')}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs">영업소득자</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        개인사업자, 프리랜서, 부동산임대, 농림어업 소득 등 반복적 영업 수입을 얻는 자
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="block text-slate-700 font-bold mb-1">신청취지 (법정 불변 문구)</label>
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-mono font-medium text-xs">
                  「신청인에 대하여 개인회생절차를 개시한다.」 라는 결정을 구합니다.
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">신청이유 (파산의 원인사실 진술)</label>
                <textarea
                  rows={4}
                  value={formData.petitionReasonDetail || ''}
                  onChange={(e) => handleChange('petitionReasonDetail', e.target.value)}
                  placeholder="신청인은 첨부한 개인회생채권자목록 기재와 같은 채무를 부담하고 있으나..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-slate-900 text-xs leading-relaxed focus:border-blue-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  ※ 대법원 D5101 1/2쪽 '신청이유' 제1항에 인쇄되는 핵심 문구입니다.
                </p>
              </div>
            </div>
          )}

          {/* 탭 3: 송달영수인 & 대리인 */}
          {activeTab === 'service' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11px]">
                  <strong>송달장소 안내:</strong> 의뢰인의 자택으로 법원 우편물이 발송되어 가족에게 알려지는 것을 원천 차단하기 위해, 원칙적으로 대리인 법률사무소를 송달장소 및 송달영수인으로 지정합니다.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-2">송달장소 선택 *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    formData.servicePlaceType === 'firm'
                      ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="servicePlaceType"
                      checked={formData.servicePlaceType === 'firm'}
                      onChange={() => handleChange('servicePlaceType', 'firm')}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs">대리인 법률사무소 (권장)</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        법원 보정권고/명령 일체를 변호사 사무실에서 전자송달 및 등기 수령
                      </p>
                    </div>
                  </label>

                  <label className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                    formData.servicePlaceType === 'client'
                      ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="servicePlaceType"
                      checked={formData.servicePlaceType === 'client'}
                      onChange={() => handleChange('servicePlaceType', 'client')}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs">채무자 본인 실거주지</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        채무자 본인의 현주소로 송달 서류를 직접 수취
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">송달영수인 성명 *</label>
                  <input
                    type="text"
                    value={formData.serviceRecipient || ''}
                    onChange={(e) => handleChange('serviceRecipient', e.target.value)}
                    placeholder="변호사 정충원"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">송달장소 우편번호 *</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={formData.servicePlacePostcode || ''}
                    onChange={(e) => handleChange('servicePlacePostcode', e.target.value)}
                    placeholder="01323"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">송달장소 상세주소 *</label>
                <input
                  type="text"
                  value={formData.servicePlaceAddress || ''}
                  onChange={(e) => handleChange('servicePlaceAddress', e.target.value)}
                  placeholder="서울특별시 도봉구 마들로 760 (도봉동, 한밭법조타워) 301호"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* 대리인 법률사무소 세부정보 */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-slate-500" />
                  <span>대리인 법률사무소 기재사항</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">대리인 변호사 성명</label>
                    <input
                      type="text"
                      value={formData.lawyerName || ''}
                      onChange={(e) => handleChange('lawyerName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">법률사무소 명칭</label>
                    <input
                      type="text"
                      value={formData.firmName || ''}
                      onChange={(e) => handleChange('firmName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">사무소 전화</label>
                    <input
                      type="text"
                      value={formData.firmPhone || ''}
                      onChange={(e) => handleChange('firmPhone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">사무소 팩스</label>
                    <input
                      type="text"
                      value={formData.firmFax || ''}
                      onChange={(e) => handleChange('firmFax', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">전자우편</label>
                    <input
                      type="email"
                      value={formData.firmEmail || ''}
                      onChange={(e) => handleChange('firmEmail', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 탭 4: 환급계좌 & 문자통지 */}
          {activeTab === 'refund_sms' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>환급계좌 법적 요건 (D5101 2/2쪽 제3항):</strong><br />
                  법원에 납부한 예납비용 및 적립금 잔액을 환급받기 위한 계좌이며, <strong>반드시 신청인 본인 명의</strong> 계좌이어야 합니다. 압류 위험이 없는 1금융권 안전 통장을 권장합니다.
                </div>
              </div>

              {/* 환급계좌 입력 */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-4">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>적립금·예납금 반환 계좌</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">은행명 *</label>
                    <select
                      value={formData.refundBank || '우체국'}
                      onChange={(e) => handleChange('refundBank', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:border-blue-500 focus:outline-hidden"
                    >
                      {MAJOR_BANKS.map(bank => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">계좌번호 *</label>
                    <input
                      type="text"
                      value={formData.refundAccount || ''}
                      onChange={(e) => handleChange('refundAccount', e.target.value)}
                      placeholder="하이픈(-) 포함 입력"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">예금주 (본인) *</label>
                    <input
                      type="text"
                      value={formData.refundAccountHolder || ''}
                      onChange={(e) => handleChange('refundAccountHolder', e.target.value)}
                      placeholder="신청인 본인명"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* SMS 정보수신 신청서 */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    <span>휴대전화를 통한 정보수신 신청서 (법원 문자알림)</span>
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.smsNotificationConsent)}
                      onChange={(e) => handleChange('smsNotificationConsent', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-blue-700 text-xs">문자 통지 신청함</span>
                  </label>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  개시결정, 폐지결정, 면책결정, 월 변제액 3개월분 연체 정보를 대법원에서 휴대전화 문자메시지로 즉시 통지해 주는 제도입니다. (건당 17원 송달료 차감)
                </p>

                {formData.smsNotificationConsent && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">문자 수신 휴대전화 번호 *</label>
                    <input
                      type="text"
                      value={formData.smsNotificationPhone || ''}
                      onChange={(e) => handleChange('smsNotificationPhone', e.target.value)}
                      placeholder="010-XXXX-XXXX"
                      className="w-full max-w-sm px-3 py-2 border border-slate-300 rounded-xl font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 영역 */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer press-scale"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer press-scale"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '저장 중...' : '신청서 기재사항 저장'}</span>
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
