import React, { useState } from 'react';
import { FileSignature, Smartphone, Users, CheckCircle2, FileText, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, Case, Lawyer as LawyerType, ElectronicContract, FeeInstallment, CrmStatus, CrmClientExtension } from '../../types';
import { createContract, saveContract } from '../../services/contractService';
import { sendAlimtok } from '../../services/alimtokService';
import { saveCrmClient, createDefaultCrmExtension } from '../../services/crmService';

interface Props {
  request: ConsultRequest;
  activeLawyer: LawyerType;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCase: Case, newContract: ElectronicContract) => void;
  onAddMessage?: (reqId: string, text: string, sender: 'client' | 'lawyer', senderId: string, name: string) => void;
}

export default function ContractConversionModal({
  request,
  activeLawyer,
  isOpen,
  onClose,
  onSuccess,
  onAddMessage
}: Props) {
  if (!isOpen) return null;

  // 계약 방식: 전자계약 (비대면) vs 대면계약 (사무실 방문)
  const [contractMethod, setContractMethod] = useState<'electronic' | 'in_person'>('electronic');
  // 사건 유형
  const [caseType, setCaseType] = useState<'individual_rehab' | 'individual_bankruptcy'>(
    request.title.includes('파산') ? 'individual_bankruptcy' : 'individual_rehab'
  );
  // 총 수임료 (만 원)
  const [totalFee, setTotalFee] = useState<number>(150);
  // 착수금 (만 원)
  const [initialFee, setInitialFee] = useState<number>(50);
  // 분납 횟수
  const [installmentCount, setInstallmentCount] = useState<number>(3);
  // 법원 실비 (인지대/송달료) 별도 여부
  const [courtCostsSeparate, setCourtCostsSeparate] = useState<boolean>(true);
  // 서류 준비 패키지 동시 발송 체크
  const [sendDocPackage, setSendDocPackage] = useState<boolean>(true);
  // 계약 체결 알림톡 발송 체크
  const [sendAlimtok, setSendAlimtok] = useState<boolean>(true);

  // 분납 스케줄 계산
  const remainingFee = Math.max(0, totalFee - initialFee);
  const monthlyInstallment = installmentCount > 1 ? Math.round(remainingFee / (installmentCount - 1)) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1. 분납 스케줄 객체 구성
      const now = new Date();
      const feeSchedule: FeeInstallment[] = [];
      
      // 1차 착수금
      feeSchedule.push({
        round: 1,
        dueDate: now.toISOString().split('T')[0],
        amount: initialFee * 10000,
        status: contractMethod === 'in_person' ? 'paid' : 'unpaid',
        paidAt: contractMethod === 'in_person' ? now.toISOString() : undefined,
        note: '계약 착수금'
      });

      // 잔여 분납
      if (installmentCount > 1 && remainingFee > 0) {
        for (let i = 2; i <= installmentCount; i++) {
          const nextDueDate = new Date(now.getFullYear(), now.getMonth() + (i - 1), now.getDate());
          const amount = i === installmentCount ? (remainingFee - monthlyInstallment * (installmentCount - 2)) * 10000 : monthlyInstallment * 10000;
          feeSchedule.push({
            round: i,
            dueDate: nextDueDate.toISOString().split('T')[0],
            amount,
            status: 'unpaid',
            note: `${i}회차 분납금`
          });
        }
      }

      // 2. ElectronicContract 생성 및 저장
      const newContract = createContract({
        clientId: request.clientId || `client-${Date.now()}`,
        clientName: request.clientName,
        clientPhone: request.phone || '010-0000-0000',
        lawyerName: activeLawyer.name,
        lawFirmName: activeLawyer.firm || '법무법인',
        assignedLawyerId: activeLawyer.id,
        totalFee: totalFee * 10000,
        feeSchedule
      });

      // 대면 계약의 경우 즉시 체결 완료 상태로 지정
      if (contractMethod === 'in_person') {
        newContract.status = 'completed';
        newContract.contractDate = now.toISOString().split('T')[0];
        newContract.auditTrail.push({
          action: '대면 계약 체결 완료 (서면 서명 확인)',
          actor: `${activeLawyer.name} 변호사`,
          timestamp: now.toISOString(),
          ip: '127.0.0.1'
        });
      } else {
        newContract.status = 'pending_sign';
        newContract.auditTrail.push({
          action: '전자 계약서 모바일 전자서명 발송',
          actor: `${activeLawyer.name} 변호사`,
          timestamp: now.toISOString(),
          ip: '127.0.0.1'
        });
      }

      await saveContract(newContract);

      // 3. Case 사건 대장 데이터 생성
      const newCase: Case = {
        id: `case-${Date.now()}`,
        clientId: request.clientId || `client-${Date.now()}`,
        clientName: request.clientName,
        phone: request.phone || '010-0000-0000',
        status: 'document', // 서류 준비 단계로 시작
        assignedLawyerId: activeLawyer.id,
        assignedLawyerName: activeLawyer.name,
        debtTotal: request.financialProfile?.debtTotal || 0,
        income: request.financialProfile?.income || 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        notes: [
          `[${contractMethod === 'electronic' ? '전자계약 발송' : '대면계약 체결'}] 총 수임료 ${totalFee}만 원 (${installmentCount}회 분납 약정)`,
          `가계 채무 분석서(${request.financialProfile?.debtTotal?.toLocaleString() || 0}만 원) 데이터 이관 완료`,
          sendDocPackage ? '📋 필수 제출 서류 15종 가이드 및 체크리스트 발송 완료' : '서류 준비 착수 지시'
        ]
      };

      // 3-1. CRM 데이터베이스(crm_clients) 즉시 동기화 (수임계약/서류수집 단계 승격)
      const crmExt = createDefaultCrmExtension(request.id);
      const updatedCrmExt: CrmClientExtension = {
        ...crmExt,
        crmStatus: 'contracted' as CrmStatus,
        assigneeId: activeLawyer.id,
        assignedLawyerId: activeLawyer.id,
        totalFee: totalFee * 10000,
        contractDate: now.toISOString().split('T')[0],
        contractAmount: totalFee * 10000,
        feeSchedule,
        lastActivityAt: now.toISOString(),
        activities: [
          ...(crmExt.activities || []),
          {
            id: `act-contract-${Date.now()}`,
            clientId: request.id,
            actorId: activeLawyer.id,
            actorName: activeLawyer.name,
            actorRole: 'OWNER',
            type: 'status_change',
            description: `${contractMethod === 'electronic' ? '전자계약서 발송' : '대면 수임계약 체결'} 완료 (총 수임료 ${totalFee}만 원)`,
            createdAt: now.toISOString()
          }
        ]
      };
      await saveCrmClient(request.id, updatedCrmExt);

      // 4. 채팅 대화방에 시스템/변호사 안내 메시지 자동 전송
      if (onAddMessage) {
        if (contractMethod === 'electronic') {
          onAddMessage(
            request.id,
            `[수임 계약 안내] ${request.clientName}님, ${activeLawyer.firm || '법무법인'} ${activeLawyer.name} 변호사와의 사건 수임 계약서가 전자서명으로 발송되었습니다.\n\n` +
            `• 약정 수임료: ${totalFee.toLocaleString()}만 원 (착수금 ${initialFee.toLocaleString()}만 원 / ${installmentCount}회 분납)\n` +
            `• 계약 방식: 모바일 전자서명 (문자/카카오톡 링크 확인 후 서명 완료)\n` +
            (sendDocPackage ? `\n📂 [서류 준비 안내]\n원활한 법원 접수를 위해 신분증 사본, 주민등록초본, 소득/재산 증빙 서류를 준비해 주시면 감사하겠습니다.` : ''),
            'lawyer',
            activeLawyer.id,
            activeLawyer.name
          );
        } else {
          onAddMessage(
            request.id,
            `[수임 계약 완료] ${request.clientName}님, ${activeLawyer.firm || '법무법인'} ${activeLawyer.name} 변호사와의 정식 대면 수임 계약이 체결되었습니다.\n\n` +
            `• 약정 수임료: ${totalFee.toLocaleString()}만 원 (${installmentCount}회 분납)\n` +
            `• 진행 단계: 서류 준비 및 관할 법원 접수 준비 착수\n\n` +
            (sendDocPackage ? `📂 필수 서류 목록을 확인하시고 서류가 준비되는 대로 업로드 부탁드립니다.` : ''),
            'lawyer',
            activeLawyer.id,
            activeLawyer.name
          );
        }
      }

      // 5. 알림톡 자동 전송 기록 (선택 시)
      if (sendAlimtok) {
        try {
          const clientPhone = request.phone || '010-0000-0000';
          sendAlimtok(clientPhone, 'contract_signed', {
            firmName: activeLawyer.firm || '법무법인',
            lawyerName: activeLawyer.name,
            clientName: request.clientName,
            date: new Date().toLocaleDateString(),
            trackingUrl: window.location.origin
          });
          if (sendDocPackage) {
            sendAlimtok(clientPhone, 'document_request', {
              firmName: activeLawyer.firm || '법무법인',
              lawyerName: activeLawyer.name,
              clientName: request.clientName,
              deadline: '계약일로부터 7일 이내',
              documentList: '1. 신분증 사본\n2. 주민등록등·초본\n3. 인감증명서\n4. 통장거래내역(1년)\n5. 소득금액증명원',
              trackingUrl: window.location.origin
            });
          }
        } catch {}
      }

      toast.success(
        contractMethod === 'electronic'
          ? `${request.clientName} 의뢰인께 전자계약서와 서류 준비 가이드가 발송되었습니다.`
          : `${request.clientName} 의뢰인의 대면 수임계약이 완료되고 서류 준비 단계로 전환되었습니다.`
      );

      onSuccess(newCase, newContract);
      onClose();
    } catch (err: any) {
      toast.error('수임 계약 처리 중 오류가 발생했습니다: ' + (err?.message || '다시 시도해 주세요.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand/10 text-brand flex items-center justify-center font-bold">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">정식 수임 계약 & 사건 전환</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-bold text-slate-800">{request.clientName}</span> 의뢰인 · 채무 {request.financialProfile?.debtTotal?.toLocaleString()}만 원
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all press-scale cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Step 1: 계약 방식 선택 */}
          <div className="space-y-2.5">
            <label className="text-xs font-black text-slate-700 tracking-wide uppercase block">
              1. 계약 방식 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setContractMethod('electronic')}
                className={`p-4 rounded-2xl border-2 text-left transition-all press-scale cursor-pointer relative ${
                  contractMethod === 'electronic'
                    ? 'border-brand bg-brand/5 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Smartphone className={`w-5 h-5 ${contractMethod === 'electronic' ? 'text-brand' : 'text-slate-500'}`} />
                  {contractMethod === 'electronic' && (
                    <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">선택됨</span>
                  )}
                </div>
                <div className="font-bold text-sm text-slate-900">전자 계약 (비대면)</div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                  카카오/문자로 전자서명 링크 즉시 발송
                </div>
              </button>

              <button
                type="button"
                onClick={() => setContractMethod('in_person')}
                className={`p-4 rounded-2xl border-2 text-left transition-all press-scale cursor-pointer relative ${
                  contractMethod === 'in_person'
                    ? 'border-brand bg-brand/5 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Users className={`w-5 h-5 ${contractMethod === 'in_person' ? 'text-brand' : 'text-slate-500'}`} />
                  {contractMethod === 'in_person' && (
                    <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">선택됨</span>
                  )}
                </div>
                <div className="font-bold text-sm text-slate-900">대면 계약 (방문/서면)</div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                  사무소 내방 서면 계약 체결 완료 처리
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: 사건 유형 및 수임료 조건 */}
          <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 tracking-wide uppercase">
                2. 수임료 및 분납 조건 설정
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCaseType('individual_rehab')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    caseType === 'individual_rehab' ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  개인회생
                </button>
                <button
                  type="button"
                  onClick={() => setCaseType('individual_bankruptcy')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    caseType === 'individual_bankruptcy' ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  개인파산
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">총 수임료 (만 원)</label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={totalFee}
                  onChange={(e) => setTotalFee(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">계약 착수금 (만 원)</label>
                <input
                  type="number"
                  min="0"
                  max={totalFee}
                  step="10"
                  value={initialFee}
                  onChange={(e) => setInitialFee(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">분납 횟수</label>
                <select
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                >
                  <option value={1}>일시납 (1회)</option>
                  <option value={2}>2회 분납</option>
                  <option value={3}>3회 분납 (권장)</option>
                  <option value={4}>4회 분납</option>
                  <option value={5}>5회 분납</option>
                  <option value={6}>6회 분납</option>
                </select>
              </div>
            </div>

            {/* 분납 요약 안내 */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">납부 플랜: </span>
                <span>착수금 {initialFee}만 원</span>
                {installmentCount > 1 && remainingFee > 0 && (
                  <span> + 잔여 {remainingFee}만 원 (월 약 {monthlyInstallment}만 원씩 {installmentCount - 1}회)</span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {courtCostsSeparate ? '법원 실비 별도' : '실비 포함'}
              </span>
            </div>
          </div>

          {/* Step 3: 동시 연동 옵션 (서류 패키지 + 알림톡) */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-700 tracking-wide uppercase block">
              3. 계약 체결 시 동시 자동화 옵션
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={sendDocPackage}
                onChange={(e) => setSendDocPackage(e.target.checked)}
                className="mt-0.5 rounded text-brand focus:ring-brand w-4 h-4"
              />
              <div className="flex-1 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand" />
                  <span>필수 서류 15종 체크리스트 및 가이드 동시 발송</span>
                </div>
                <div className="text-slate-500 mt-0.5 leading-relaxed">
                  계약과 동시에 의뢰인에게 신분증, 등본, 소득/재산 증빙 등 서류 제출 안내가 전송됩니다.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={sendAlimtok}
                onChange={(e) => setSendAlimtok(e.target.checked)}
                className="mt-0.5 rounded text-brand focus:ring-brand w-4 h-4"
              />
              <div className="flex-1 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>의뢰인 카카오 알림톡/문자 계약 안내 즉시 전송</span>
                </div>
                <div className="text-slate-500 mt-0.5 leading-relaxed">
                  담당 변호사 선임 완료 및 다음 진행 절차(서류 준비) 안내 메시지를 발송합니다.
                </div>
              </div>
            </label>
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-sm transition-all press-scale cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-3 rounded-xl bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold text-sm transition-all shadow-md flex items-center gap-2 press-scale cursor-pointer active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{contractMethod === 'electronic' ? '전자계약 발송 & 서류준비 착수' : '대면계약 체결 & 서류준비 착수'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
