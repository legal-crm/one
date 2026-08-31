import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSignature, CheckCircle2, Clock, Plus, Eye, Printer, 
  Shield, PenTool, AlertCircle, RefreshCw, FileText, Check, 
  Sparkles, Download, ArrowRight, UserCheck, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  ConsultRequest, CrmClientExtension, ElectronicContract, 
  ContractDocument, StaffMember, StaffRole 
} from '../../types';
import { CONTRACT_STATUS_CONFIG, CONTRACT_DOC_TYPES } from '../../types';
import { 
  getContractsByClientId, createContract, saveContract, 
  deleteContract, calculateCourtCosts 
} from '../../services/contractService';
import { syncContractToCrm } from '../../services/crmService';
import ContractWizard from './ContractWizard';

interface Props {
  client: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyer: { id: string; name: string; lawFirmName?: string; lawFirmId?: string };
  activeStaff: StaffMember | null;
  onUpdateCrmExt: (patch: Partial<CrmClientExtension>) => Promise<void>;
}

export default function ClientContractSubTab({
  client,
  crmExt,
  activeLawyer,
  activeStaff,
  onUpdateCrmExt
}: Props) {
  const [contracts, setContracts] = useState<ElectronicContract[]>([]);
  const [activeContractId, setActiveContractId] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ElectronicContract | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ContractDocument | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  const loadClientContracts = async () => {
    const list = await getContractsByClientId(client.id);
    setContracts(list);
    if (list.length > 0 && !activeContractId) {
      setActiveContractId(list[0].id);
    }
  };

  useEffect(() => {
    loadClientContracts();
  }, [client.id]);

  const currentContract = useMemo(() => {
    if (!contracts.length) return null;
    return contracts.find(c => c.id === activeContractId) || contracts[0];
  }, [contracts, activeContractId]);

  const handleStartNewContract = () => {
    const lawyerName = activeLawyer.name || '담당 변호사';
    const lawFirmName = activeLawyer.lawFirmName || '법무법인 로앤';
    
    const initialFee = crmExt.totalFee || client.proposals?.[0]?.fee || 200;
    const creditorCount = client.financialProfile?.creditorCount || 5;
    const costs = calculateCourtCosts(creditorCount);

    const newContract = createContract({
      clientId: client.id,
      clientName: client.clientName,
      clientPhone: client.phone,
      clientAddress: client.financialProfile?.residenceRegion || '',
      lawyerName,
      lawFirmName,
      assignedLawyerId: crmExt.assigneeId || activeLawyer.id,
      totalFee: initialFee,
      courtCosts: {
        creditorCount,
        deliveryFee: costs.deliveryFee,
        stampFee: costs.stampFee,
        miscFee: 0
      },
    });

    setEditingContract(newContract);
    setIsWizardOpen(true);
  };

  const handleEditContract = (contract: ElectronicContract) => {
    setEditingContract(contract);
    setIsWizardOpen(true);
  };

  const handleWizardSave = async (saved: ElectronicContract) => {
    saveContract(saved);
    
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    await syncContractToCrm(client.id, saved, actor);

    loadClientContracts();
    setActiveContractId(saved.id);
    setIsWizardOpen(false);
    setEditingContract(null);

    if (saved.status === 'completed') {
      await onUpdateCrmExt({
        crmStatus: 'contracted',
        totalFee: saved.totalFee,
        contractDate: saved.contractDate,
      });
      toast.success('전자계약 체결이 완료되어 CRM 수임료와 사건상태가 동기화되었습니다.');
    } else {
      toast.success('전자계약서가 저장되었습니다.');
    }
  };

  const handlePrintContract = (contract: ElectronicContract) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
      return;
    }

    const docsHtml = contract.documents
      .filter(d => d.included)
      .map((d, i) => `
        <div style="page-break-after: always; padding: 40px; font-family: sans-serif; line-height: 1.6; color: #1e293b;">
          <h2 style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px; font-size: 20px;">
            [제${i + 1}호 서식] ${d.title}
          </h2>
          <div style="white-space: pre-wrap; font-size: 13px; min-height: 500px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
${d.content}
          </div>
          <div style="margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between;">
            <div style="font-size: 12px;">
              <p><strong>위임인 (의뢰인):</strong> ${contract.clientName}</p>
              ${d.clientSignature ? `<img src="${d.clientSignature}" style="max-height: 48px; border: 1px dashed #94a3b8; padding: 2px;" alt="의뢰인 서명" />` : '<span style="color: #94a3b8;">(서명 대기)</span>'}
              ${d.clientSignedAt ? `<p style="font-size: 10px; color: #64748b;">서명일시: ${d.clientSignedAt}</p>` : ''}
            </div>
            <div style="font-size: 12px; text-align: right;">
              <p><strong>수임인 (담당변호사):</strong> ${contract.lawFirmName} ${contract.lawyerName}</p>
              ${d.lawyerSignature ? `<img src="${d.lawyerSignature}" style="max-height: 48px; border: 1px dashed #94a3b8; padding: 2px;" alt="변호사 서명" />` : '<span style="color: #94a3b8;">(변호사 날인)</span>'}
              ${d.lawyerSignedAt ? `<p style="font-size: 10px; color: #64748b;">서명일시: ${d.lawyerSignedAt}</p>` : ''}
            </div>
          </div>
        </div>
      `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>전자계약서 전문 - ${contract.clientName} (${contract.id})</title>
          <style>
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${docsHtml}
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isWizardOpen && editingContract) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-sm">
        <ContractWizard
          contract={editingContract}
          onClose={() => {
            setIsWizardOpen(false);
            setEditingContract(null);
            loadClientContracts();
          }}
          onSave={handleWizardSave}
        />
      </div>
    );
  }

  if (!contracts.length) {
    return (
      <div className="space-y-5 animate-fadeIn">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm space-y-6">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-3xl flex items-center justify-center mx-auto shadow-xs">
            <FileSignature className="w-8 h-8" />
          </div>
          
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-black text-slate-900">
              아직 작성된 전자계약서가 없습니다
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-700">{client.clientName}</strong> 의뢰인과의 사건 위임계약서, 개인정보동의서, 분할납부 약정서를 작성하고 비대면 전자서명을 진행하세요.
            </p>
          </div>

          <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>CRM 자동 연동 정보 (사전 입력)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block font-medium">의뢰인 인적사항</span>
                <span className="font-bold text-slate-800">{client.clientName} ({client.phone})</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block font-medium">상담 약정 수임료</span>
                <span className="font-bold text-brand font-mono">{(crmExt.totalFee || client.proposals?.[0]?.fee || 200).toLocaleString()}만원</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block font-medium">담당 변호사</span>
                <span className="font-bold text-slate-800">{activeLawyer.lawFirmName || '법무법인'} {activeLawyer.name}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 block font-medium">채권자 수 / 예상법원비용</span>
                <span className="font-bold text-slate-800">{client.financialProfile?.creditorCount || 5}개소 (자동산출)</span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={handleStartNewContract}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl shadow-sm text-sm transition-all press-scale cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{client.clientName} 님과 새 전자계약서 작성하기</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const contract = currentContract!;
  const statusCfg = CONTRACT_STATUS_CONFIG[contract.status];
  const isCompleted = contract.status === 'completed';
  const signedDocsCount = contract.documents.filter(d => d.included && (d.clientSignature || !d.signatureRequired.includes('client'))).length;
  const totalIncludedDocs = contract.documents.filter(d => d.included).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand/10 text-brand">
            <FileSignature className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm text-slate-900">전자계약 관리</h4>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${statusCfg.bgColor} ${statusCfg.color} ${statusCfg.borderColor} flex items-center gap-1`}>
                <span>{statusCfg.emoji}</span>
                <span>{statusCfg.label}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">계약번호: {contract.id} · 체결일: {contract.contractDate}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handlePrintContract(contract)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer press-scale whitespace-nowrap"
            title="계약서 전문 인쇄 및 PDF 저장"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>계약서 출력</span>
          </button>
          
          <button
            onClick={() => handleEditContract(contract)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white hover:bg-brand-hover font-bold rounded-xl text-xs transition-colors cursor-pointer press-scale whitespace-nowrap shadow-xs"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>{isCompleted ? '계약서 확인/서명' : '계약서 작성/서명 진행'}</span>
          </button>

          <button
            onClick={handleStartNewContract}
            className="flex items-center gap-1 px-2.5 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer press-scale"
            title="새 계약서 추가 작성"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 계약</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-[11px] font-bold text-slate-400 block">약정 수임료</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {contract.totalFee.toLocaleString()} <span className="text-xs font-bold text-slate-500 font-sans">만원</span>
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
              {contract.feeSchedule?.length || 0}회 분납
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            법원비용 합계: <strong className="font-mono text-slate-700">{((contract.courtCosts.deliveryFee + contract.courtCosts.stampFee + contract.courtCosts.miscFee)).toLocaleString()}원</strong>
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-[11px] font-bold text-slate-400 block">문서 서명 진행률</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {signedDocsCount} / {totalIncludedDocs} <span className="text-xs font-bold text-slate-500 font-sans">문서</span>
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${signedDocsCount === totalIncludedDocs ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {Math.round((signedDocsCount / (totalIncludedDocs || 1)) * 100)}% 완료
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full" 
              style={{ width: `${(signedDocsCount / (totalIncludedDocs || 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <span className="text-[11px] font-bold text-slate-400 block">본인인증 및 무결성</span>
          <div className="flex items-center gap-2">
            {contract.identityVerification ? (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>간편인증 완료 ({contract.identityVerification.method})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-xl">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>서명 시 본인인증 진행</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-mono truncate">
            {contract.identityVerification?.verifiedAt ? `인증일시: ${contract.identityVerification.verifiedAt}` : '위임 계약 효력 보장'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <span>📋 계약 문서 번들 ({totalIncludedDocs}종)</span>
          </h5>
          <span className="text-xs text-slate-400">문서를 클릭하면 본문 및 서명을 확인할 수 있습니다.</span>
        </div>

        <div className="space-y-2.5">
          {contract.documents.filter(d => d.included).map((doc, idx) => {
            const docCfg = CONTRACT_DOC_TYPES[doc.type] || { label: doc.title, emoji: '📄' };
            const isClientSigned = !!doc.clientSignature;
            const isLawyerSigned = !!doc.lawyerSignature;
            const isFullySigned = doc.signatureRequired === 'client' ? isClientSigned :
              doc.signatureRequired === 'lawyer' ? isLawyerSigned : (isClientSigned && isLawyerSigned);

            const isExpanded = previewDoc?.id === doc.id;

            return (
              <div 
                key={doc.id}
                className={`rounded-xl border transition-all ${
                  isExpanded ? 'border-brand/40 bg-brand/5' : 'border-slate-200/80 bg-slate-50/40 hover:border-slate-300'
                }`}
              >
                <div 
                  onClick={() => setPreviewDoc(isExpanded ? null : doc)}
                  className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base">{docCfg.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{doc.title}</span>
                        {docCfg.required && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">필수</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        서명 대상: {doc.signatureRequired === 'both' ? '의뢰인 + 변호사' : doc.signatureRequired === 'client' ? '의뢰인' : '변호사'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {isFullySigned ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <Check className="w-3 h-3" />
                        <span>서명 완료</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        <Clock className="w-3 h-3" />
                        <span>서명 대기</span>
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-200/60 mt-1 space-y-3 animate-fadeIn">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed shadow-inner">
                      {doc.content}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-600 block">의뢰인 서명</span>
                        {doc.clientSignature ? (
                          <div className="flex items-center gap-3">
                            <img src={doc.clientSignature} alt="의뢰인 서명" className="h-10 border border-slate-200 bg-slate-50 rounded-lg p-1" />
                            <span className="text-[10px] text-slate-400 font-mono">{doc.clientSignedAt || '서명완료'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">아직 서명되지 않았습니다.</span>
                        )}
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-600 block">변호사 날인</span>
                        {doc.lawyerSignature ? (
                          <div className="flex items-center gap-3">
                            <img src={doc.lawyerSignature} alt="변호사 날인" className="h-10 border border-slate-200 bg-slate-50 rounded-lg p-1" />
                            <span className="text-[10px] text-slate-400 font-mono">{doc.lawyerSignedAt || '날인완료'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">변호사 날인 대기 중</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <button 
          onClick={() => setShowAuditTrail(!showAuditTrail)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand" />
            <h5 className="font-bold text-sm text-slate-900">감사 추적 기록 (Audit Trail)</h5>
            <span className="text-[10px] text-slate-400 font-mono">총 {contract.auditTrail?.length || 0}건</span>
          </div>
          <span className="text-xs text-brand font-bold flex items-center gap-0.5">
            {showAuditTrail ? '접기' : '상세보기'}
            {showAuditTrail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showAuditTrail && (
          <div className="space-y-2 pt-2 border-t border-slate-100 animate-fadeIn">
            {contract.auditTrail?.map((log, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/50">
                <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                  log.actor === 'lawyer' ? 'bg-blue-50 text-blue-700' :
                  log.actor === 'client' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {log.actor === 'lawyer' ? '변호사' : log.actor === 'client' ? '의뢰인' : '시스템'}
                </span>
                <span className="font-medium text-slate-800 flex-1">{log.action}</span>
                {log.ip && <span className="text-[10px] text-slate-400 font-mono shrink-0">IP: {log.ip}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
