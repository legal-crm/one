import React, { useState } from 'react';
import { 
  X, Printer, Download, ShieldAlert, FileText, CheckCircle2, 
  AlertTriangle, PhoneCall, Copy, Scale, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { 
  StayOrderPetition, 
  ExemptPropertyPetition, 
  StayHarassmentNotice,
  LevyReleasePetition 
} from '../../../types/courtPetitionTypes';

interface AncillaryPetitionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyerName?: string;
}

export default function AncillaryPetitionsModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  activeLawyerName = '김변호'
}: AncillaryPetitionsModalProps) {
  if (!isOpen) return null;

  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const mainCaseNumber = crmExt.courtCase?.caseNumber || (clientRequest as any).caseNumber || '2026개회 (접수 예정)';

  const [activeTab, setActiveTab] = useState<'stay' | 'exempt' | 'prohibition' | 'release'>('stay');

  // 1. 강제집행 중지명령신청서 데이터
  const [stayData, setStayData] = useState<StayOrderPetition>({
    id: 'stay-1',
    clientId: clientRequest.id,
    debtorName: clientName,
    debtorRrn: '820415-1******',
    debtorAddress: '서울특별시 마포구 마포대로 123',
    courtName,
    mainCaseNumber,
    executionCourt: '서울동부지방법원',
    executionCaseNumber: '2026타채 54321호',
    executionType: 'SALARY_ATTACHMENT',
    creditorName: '주식회사 신한카드',
    thirdPartyDebtor: '주식회사 넥스트소프트 (급여 지급처)',
    claimAmount: 18500000,
    stayReason: '신청인은 귀원에 개인회생개시신청을 하여 현재 심리 중에 있는바, 만일 위 채권자의 급여 압류 및 전부·추심명령에 기한 강제집행이 속행된다면 신청인은 최저생계마저 위협받고 회생절차의 원활한 진행이 불가능하게 되므로, 채무자 회생 및 파산에 관한 법률 제593조 제1항 제2호에 기하여 위 강제집행 절차의 즉각적인 중지를 구합니다.',
    createdAt: new Date().toISOString().split('T')[0]
  });

  // 2. 면제재산결정신청서 데이터
  const [exemptData, setExemptData] = useState<ExemptPropertyPetition>({
    id: 'exempt-1',
    clientId: clientRequest.id,
    debtorName: clientName,
    courtName,
    mainCaseNumber,
    exemptCategory: 'HOUSING_LEASE_DEPOSIT',
    targetAssetName: '서울특별시 마포구 마포대로 123 아파트 101호 주거용 임차보증금 반환채권',
    totalAssetAmount: 30000000,
    requestedExemptAmount: 30000000, // 서울 소액보증금 5,500만 한도 내 전액
    petitionReason: '위 재산은 주택임대차보호법 제8조 및 동법 시행령 제10조가 정하는 우선변제를 받을 수 있는 보증금 중 일정액에 해당하는바, 채무자 회생 및 파산에 관한 법률 제383조 제2항 및 제580조 제3항에 따라 개인회생재단(청산가치)에서 면제하여 주시기를 구합니다.',
    createdAt: new Date().toISOString().split('T')[0]
  });

  // 3. 인가 후 압류해제신청서 데이터
  const [releaseData, setReleaseData] = useState<LevyReleasePetition>({
    id: 'rel-1',
    clientId: clientRequest.id,
    debtorName: clientName,
    courtName,
    mainCaseNumber,
    confirmationDate: '2026. 06. 20.',
    executionCourt: '서울동부지방법원',
    executionCaseNumber: '2026타채 54321호',
    seizingCreditorName: '주식회사 신한카드',
    thirdPartyDebtor: '주식회사 넥스트소프트',
    releaseReason: '위 개인회생사건에 관하여 채무자회생법 제615조 제2항에 따라 변제계획인가결정이 확정되었으므로, 종전에 행하여진 강제집행(압류 및 추심명령)은 그 효력을 상실하였습니다. 이에 압류의 해제를 신청합니다.',
    createdAt: new Date().toISOString().split('T')[0]
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyNotice = () => {
    const notice = `[법무법인 의뢰인 안내: 불법 채권추심 응대 매뉴얼]\n\n` +
      `신청인: ${clientName} 님\n` +
      `법원 및 사건번호: ${courtName} ${mainCaseNumber}\n` +
      `대리인: 법무법인 (담당: ${activeLawyerName} 변호사)\n\n` +
      `1. 채권추심원(사채, 대부, 카드사) 전화 수신 시 응대 요령:\n` +
      `"현재 법원에 개인회생 사건번호 [${mainCaseNumber}]가 정식 접수되었으며 법률대리인이 선임되어 있습니다. 모든 연락은 대리인 변호사 사무실로 하시기 바랍니다."\n\n` +
      `2. 불법추심 경고 고지:\n` +
      `채권의 공정한 추심에 관한 법률 제8조의2(대리인 선임 시 채무자 직접 연락 금지)에 따라, 본 통보 이후 채무자에게 직접 방문하거나 반복적으로 전화·문자를 전송하는 행위는 2,000만 원 이하의 과태료 처분 대상입니다.`;

    navigator.clipboard.writeText(notice);
    toast.success('📱 의뢰인 전송용 불법추심 방어 가이드가 클립보드에 복사되었습니다! (카카오톡 발송 가능)');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              📋
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                기타 법원 신청서 및 추심 방어 센터
              </h3>
              <p className="text-[11px] text-slate-400">
                사건: {mainCaseNumber} · 신청인: {clientName} · 법원 제출 정규 서식
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>서식 인쇄 / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 print:hidden">
          {[
            { key: 'stay', label: '1. 강제집행 중지명령신청서', icon: '🛑' },
            { key: 'exempt', label: '2. 면제재산결정신청서', icon: '🛡️' },
            { key: 'prohibition', label: '3. 금지명령 & 추심방어가이드', icon: '📱' },
            { key: 'release', label: '4. 인가후 압류해제신청서', icon: '🔓' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`py-3 px-3 text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border-b-2 ${
                activeTab === t.key 
                  ? 'text-blue-600 border-blue-600 bg-white shadow-xs' 
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* 콘텐츠 본문 */}
        <div className="p-8 sm:p-12 overflow-y-auto bg-white text-slate-900 font-sans leading-relaxed text-sm flex-1 print:p-0">
          
          {/* ══════════ [1탭] 강제집행 중지명령신청서 ══════════ */}
          {activeTab === 'stay' && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-2xl font-serif font-black tracking-widest underline decoration-2 underline-offset-8">
                  강 제 집 행 중 지 명 령 신 청 서
                </h1>
                <p className="text-xs text-slate-500 pt-1">
                  (채무자 회생 및 파산에 관한 법률 제593조 제1항 제2호)
                </p>
              </div>

              {/* 기본 사건 표기 */}
              <div className="space-y-2 text-xs sm:text-sm border-b border-slate-200 pb-4">
                <div className="flex"><span className="w-28 font-bold text-slate-600">신 &nbsp; 청 &nbsp; 인 :</span><span>{stayData.debtorName}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">회생사건번호 :</span><span className="font-bold text-blue-700">{stayData.mainCaseNumber}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">집행사건번호 :</span><span className="font-mono font-bold text-rose-600">{stayData.executionCourt} {stayData.executionCaseNumber}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">채 &nbsp; 권 &nbsp; 자 :</span><span>{stayData.creditorName}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">제3 &nbsp;채무자 :</span><span>{stayData.thirdPartyDebtor}</span></div>
              </div>

              {/* 신청 취지 */}
              <div className="space-y-2">
                <h3 className="font-bold text-base text-slate-900">【 신 청 취 지 】</h3>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm leading-relaxed">
                  "채권자가 신청인에 대하여 가지는 {stayData.executionCourt} {stayData.executionCaseNumber} 채권압류 및 추심명령에 기한 강제집행 절차는 위 개인회생개시신청에 대한 결정이 있을 때까지 이를 중지한다."<br />
                  라는 결정을 구합니다.
                </div>
              </div>

              {/* 신청 이유 */}
              <div className="space-y-2 text-justify">
                <h3 className="font-bold text-base text-slate-900">【 신 청 이 유 】</h3>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed indent-4">
                  {stayData.stayReason}
                </p>
              </div>

              {/* 첨부 서류 및 날인 */}
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <h4 className="font-bold text-xs text-slate-900">【 첨 부 서 류 】</h4>
                <p className="text-xs text-slate-600 pl-2">1. 압류 및 추심명령 정본 사본 1부</p>
                <div className="text-center pt-8 space-y-3">
                  <p className="text-xs font-bold">{stayData.createdAt}</p>
                  <p className="text-sm font-bold">신청인 대리인 : &nbsp; 변호사 {activeLawyerName} &nbsp; (인)</p>
                  <p className="text-base font-black pt-4">{courtName} 귀중</p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ [2탭] 면제재산결정신청서 ══════════ */}
          {activeTab === 'exempt' && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-2xl font-serif font-black tracking-widest underline decoration-2 underline-offset-8">
                  면 제 재 산 결 정 신 청 서
                </h1>
                <p className="text-xs text-slate-500 pt-1">
                  (채무자 회생 및 파산에 관한 법률 제383조 제2항, 제580조 제3항)
                </p>
              </div>

              <div className="space-y-2 text-xs sm:text-sm border-b border-slate-200 pb-4">
                <div className="flex"><span className="w-28 font-bold text-slate-600">신 &nbsp; 청 &nbsp; 인 :</span><span>{exemptData.debtorName}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">사 &nbsp; 건 &nbsp; 번 &nbsp; 호 :</span><span className="font-bold text-blue-700">{exemptData.mainCaseNumber}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">면제신청 재산 :</span><span className="font-bold text-slate-900">{exemptData.targetAssetName}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">면제신청 금액 :</span><span className="font-mono font-bold text-emerald-600">{exemptData.requestedExemptAmount.toLocaleString()}원</span></div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-base text-slate-900">【 신 청 취 지 】</h3>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm leading-relaxed">
                  "별지 목록 기재 임차보증금 반환채권 중 금 {exemptData.requestedExemptAmount.toLocaleString()}원을 개인회생재단에서 면제한다."<br />
                  라는 결정을 구합니다.
                </div>
              </div>

              <div className="space-y-2 text-justify">
                <h3 className="font-bold text-base text-slate-900">【 신 청 이 유 】</h3>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed indent-4">
                  {exemptData.petitionReason}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-200 space-y-4">
                <h4 className="font-bold text-xs text-slate-900">【 첨 부 서 류 】</h4>
                <p className="text-xs text-slate-600 pl-2">1. 주택임대차계약서 사본 1통<br />2. 주민등록초본(주소변동) 1통</p>
                <div className="text-center pt-8 space-y-3">
                  <p className="text-xs font-bold">{exemptData.createdAt}</p>
                  <p className="text-sm font-bold">신청인 대리인 : &nbsp; 변호사 {activeLawyerName} &nbsp; (인)</p>
                  <p className="text-base font-black pt-4">{courtName} 귀중</p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ [3탭] 금지명령 & 실시간 추심 방어 가이드 ══════════ */}
          {activeTab === 'prohibition' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-emerald-600" />
                    실시간 채권추심 대응 매뉴얼 (의뢰인 발송용)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    사건 접수 직후 채무자에게 카카오 알림톡/문자로 발송하여 불법 추심을 원천 차단합니다.
                  </p>
                </div>
                <button
                  onClick={handleCopyNotice}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer press-scale whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>카톡 안내문구 복사</span>
                </button>
              </div>

              {/* 모바일 프리뷰 카드 */}
              <div className="max-w-xl mx-auto bg-slate-50 border-2 border-emerald-500/30 rounded-3xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-xs text-emerald-900">
                    [법무법인 의뢰인 안심 가이드] 불법 채권추심 즉시 대처법
                  </span>
                </div>

                <div className="text-xs space-y-3 text-slate-800 leading-relaxed">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-1 font-mono">
                    <div>• 의뢰인: <strong className="text-slate-900">{clientName}</strong> 님</div>
                    <div>• 관할법원: {courtName}</div>
                    <div>• 사건번호: <strong className="text-blue-600">{mainCaseNumber}</strong></div>
                    <div>• 대리인: 담당 변호사 {activeLawyerName}</div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="text-emerald-600 font-extrabold">Q.</span> 대부업체나 카드사에서 전화/독촉이 오면?
                    </h5>
                    <p className="p-3 bg-emerald-50 text-emerald-950 font-bold rounded-xl border border-emerald-200">
                      "법원에 개인회생 사건({mainCaseNumber})이 정식 접수되었고 대리인 변호사가 선임되어 있으니, 더 이상 본인에게 직접 연락하지 마시고 대리인 사무실로 연락하시기 바랍니다."
                    </p>
                  </div>

                  <div className="space-y-1 text-slate-600 pt-2 border-t border-slate-200 text-[11px]">
                    <div className="font-bold text-rose-700">⚖️ 채권추심법 제8조의2 법적 근거:</div>
                    <p>대리인 선임 통보 후에도 채무자에게 직접 연락하거나 직장/자택에 찾아오는 행위는 <strong>2,000만 원 이하의 과태료 처분</strong> 대상입니다.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ [4탭] 인가 후 압류해제신청서 ══════════ */}
          {activeTab === 'release' && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-2xl font-serif font-black tracking-widest underline decoration-2 underline-offset-8">
                  압 류 해 제 신 청 서
                </h1>
                <p className="text-xs text-slate-500 pt-1">
                  (채무자 회생 및 파산에 관한 법률 제615조 제2항에 의한 압류실효)
                </p>
              </div>

              <div className="space-y-2 text-xs sm:text-sm border-b border-slate-200 pb-4">
                <div className="flex"><span className="w-28 font-bold text-slate-600">신 &nbsp; 청 &nbsp; 인 :</span><span>{releaseData.debtorName}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">인가확정사건 :</span><span className="font-bold text-blue-700">{releaseData.mainCaseNumber}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">인가확정일자 :</span><span className="font-mono">{releaseData.confirmationDate}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">해제대상압류 :</span><span className="font-mono font-bold text-rose-600">{releaseData.executionCourt} {releaseData.executionCaseNumber}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">압류채권자 :</span><span>{releaseData.seizingCreditorName}</span></div>
                <div className="flex"><span className="w-28 font-bold text-slate-600">제3 &nbsp;채무자 :</span><span>{releaseData.thirdPartyDebtor}</span></div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-base text-slate-900">【 신 청 취 지 】</h3>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm leading-relaxed">
                  "위 당사자 간 {releaseData.executionCourt} {releaseData.executionCaseNumber} 채권압류 및 추심명령에 의한 강제집행은 이를 해제한다."<br />
                  라는 결정을 구합니다.
                </div>
              </div>

              <div className="space-y-2 text-justify">
                <h3 className="font-bold text-base text-slate-900">【 신 청 이 유 】</h3>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed indent-4">
                  {releaseData.releaseReason}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-200 space-y-4">
                <h4 className="font-bold text-xs text-slate-900">【 첨 부 서 류 】</h4>
                <p className="text-xs text-slate-600 pl-2">1. 변제계획인가결정문 등본 1부<br />2. 인가결정 확정증명원 1부</p>
                <div className="text-center pt-8 space-y-3">
                  <p className="text-xs font-bold">{releaseData.createdAt}</p>
                  <p className="text-sm font-bold">신청인 대리인 : &nbsp; 변호사 {activeLawyerName} &nbsp; (인)</p>
                  <p className="text-base font-black pt-4">{releaseData.executionCourt} 귀중</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
