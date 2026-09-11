import React, { useState } from 'react';
import { 
  Building2, Home, Briefcase, CreditCard, ShieldCheck, 
  Upload, Eye, CheckCircle2, AlertCircle, Clock, FileText,
  FileSpreadsheet, ArrowRight, Camera, RefreshCw, AlertTriangle,
  Send, ExternalLink, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, DocumentFile } from '../../../types';

interface Stage2DocumentsHubViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onAdvanceToNextStage: () => void;
  onOpenDocScanner?: () => void;
}

type DocAgencyTab = 'gov' | 'tax' | 'work' | 'finance' | 'special';

interface StandardDocItem {
  id: string;
  name: string;
  agency: '주민센터/정부24' | '국세청/홈택스' | '직장/사업장' | '금융기관/공공포털';
  isRequired: boolean;
  notes: string;
  isThirdPartyMaskingRequired?: boolean;
}

export default function Stage2DocumentsHubView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenDocScanner,
}: Stage2DocumentsHubViewProps) {
  const [activeAgency, setActiveAgency] = useState<DocAgencyTab>('gov');
  const [thirdPartyMaskingConfirmed, setThirdPartyMaskingConfirmed] = useState(true);

  // 기관별 4대 서류 표준 데이터베이스 (korea.legal 신우법무사 표준 실무 모델)
  const govDocs: StandardDocItem[] = [
    { id: 'gov-1', name: '주민등록등본', agency: '주민센터/정부24', isRequired: true, notes: '배우자와 세대 분리 시 배우자 등본도 필수 발급', isThirdPartyMaskingRequired: true },
    { id: 'gov-2', name: '주민등록초본', agency: '주민센터/정부24', isRequired: true, notes: '과거 주소 전체, 개명, 주민등록번호 변동사항 포함 발급', isThirdPartyMaskingRequired: false },
    { id: 'gov-3', name: '가족관계증명서(상세)', agency: '주민센터/정부24', isRequired: true, notes: '상세증명서 발급 (신청인 외 가족 뒷자리 마스킹 필수)', isThirdPartyMaskingRequired: true },
    { id: 'gov-4', name: '혼인관계증명서(상세)', agency: '주민센터/정부24', isRequired: true, notes: '미혼인 경우에도 반드시 상세증명서로 발급', isThirdPartyMaskingRequired: true },
    { id: 'gov-5', name: '지방세 세목별 과세증명서', agency: '주민센터/정부24', isRequired: true, notes: '최근 5년 동안, 전국 단위, 모든 세목 표시 발급', isThirdPartyMaskingRequired: false },
    { id: 'gov-6', name: '인감증명서 (본인발급)', agency: '주민센터/정부24', isRequired: false, notes: '부채증명서 대리 발급 의뢰 시 채권자 수 + 3부 필요', isThirdPartyMaskingRequired: false },
  ];

  const taxDocs: StandardDocItem[] = [
    { id: 'tax-1', name: '근로소득세 원천징수영수증', agency: '국세청/홈택스', isRequired: true, notes: '최근 1~2년도 해당분 (급여소득자)', isThirdPartyMaskingRequired: false },
    { id: 'tax-2', name: '소득금액증명원', agency: '국세청/홈택스', isRequired: true, notes: '최근 3년분 발급 (급여/영업 공통)', isThirdPartyMaskingRequired: false },
    { id: 'tax-3', name: '사업자등록증명원 / 폐업사실증명원', agency: '국세청/홈택스', isRequired: false, notes: '개인사업자 또는 과거 5년 내 사업 이력자 필수', isThirdPartyMaskingRequired: false },
    { id: 'tax-4', name: '부가가치세 과세표준증명원', agency: '국세청/홈택스', isRequired: false, notes: '최근 3년분 (영업소득자 필수, 면세사업자는 수입금액증명)', isThirdPartyMaskingRequired: false },
    { id: 'tax-5', name: '납세증명서 및 체납사실증명서', agency: '국세청/홈택스', isRequired: true, notes: '국세 체납 여부 소명 및 우선권 있는 채권 목록화용', isThirdPartyMaskingRequired: false },
    { id: 'tax-6', name: '종합소득세 확정신고서', agency: '국세청/홈택스', isRequired: false, notes: '최근 2~3년분 (영업소득자 및 프리랜서 필수)', isThirdPartyMaskingRequired: false },
  ];

  const workDocs: StandardDocItem[] = [
    { id: 'work-1', name: '재직증명서', agency: '직장/사업장', isRequired: true, notes: '현재 직장의 재직 사실 및 직위 확인', isThirdPartyMaskingRequired: false },
    { id: 'work-2', name: '근로계약서 및 급여명세서', agency: '직장/사업장', isRequired: true, notes: '재직 1년 미만인 경우 최근 3~6개월 급여명세서 첨부', isThirdPartyMaskingRequired: false },
    { id: 'work-3', name: '예상퇴직금확인서 (또는 퇴직연금)', agency: '직장/사업장', isRequired: true, notes: '재직 1년 이상 필수 (퇴직금의 1/2이 청산가치에 반영됨)', isThirdPartyMaskingRequired: false },
    { id: 'work-4', name: '영업장부 사본 및 손익계산서', agency: '직장/사업장', isRequired: false, notes: '영업소득자의 현재 실질 매출액 증빙자료', isThirdPartyMaskingRequired: false },
    { id: 'work-5', name: '사업장 임대차계약서 및 공과금 영수증', agency: '직장/사업장', isRequired: false, notes: '필요경비(임료, 전기세, 통신비 등) 지출 소명', isThirdPartyMaskingRequired: false },
  ];

  const financeDocs: StandardDocItem[] = [
    { id: 'fin-1', name: '금융결제원 어카운트인포 계좌내역', agency: '금융기관/공공포털', isRequired: true, notes: '전 은행별 계좌목록 및 계좌 상세내역서 (휴면계좌 포함)', isThirdPartyMaskingRequired: false },
    { id: 'fin-2', name: '최근 1년 모든 계좌 거래내역서', agency: '금융기관/공공포털', isRequired: true, notes: '주거래/부거래 통장 1년 입출금 거래내역 (엑셀 또는 PDF)', isThirdPartyMaskingRequired: false },
    { id: 'fin-3', name: 'K-Geo 지적전산자료조회결과서', agency: '금융기관/공공포털', isRequired: true, notes: '전국 단위 토지 소유현황 (무소유 증명 포함 필수)', isThirdPartyMaskingRequired: false },
    { id: 'fin-4', name: '신용정보원 보험가입조회서 및 해약환급금', agency: '금융기관/공공포털', isRequired: true, notes: '내보험다보여 조회서 + 각 보험사 예상 해약환급금 증명서', isThirdPartyMaskingRequired: false },
    { id: 'fin-5', name: '주거지 임대차계약서 (또는 무상거주확인서)', agency: '금융기관/공공포털', isRequired: true, notes: '임차보증금 반환채권 및 우선변제 소액보증금 면제 산정', isThirdPartyMaskingRequired: false },
    { id: 'fin-6', name: '부동산/자동차 시가 확인자료', agency: '금융기관/공공포털', isRequired: false, notes: 'KB시세, 실거래가 화면, 차량기준가액, 중고차 2곳 시세표', isThirdPartyMaskingRequired: false },
  ];

  // 업로드된 파일 매핑 상태
  const uploadedFiles = crmExt?.uploadedFiles || [];

  const getDocStatus = (docName: string) => {
    const found = uploadedFiles.find(f => f.name.includes(docName.slice(0, 4)));
    if (found) {
      return { isUploaded: true, file: found, status: '승인' };
    }
    return { isUploaded: false, file: null, status: '미제출' };
  };

  // 모바일 제출 링크 발송
  const handleSendMobileDocLink = () => {
    toast.success(`${clientRequest.clientName}님께 4대 발급처별 간편 서류 제출 안내 링크가 알림톡으로 전송되었습니다.`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 상단 액션 바: 진행 현황 & 모바일 촬영/전송 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900">
              Stage 2. 발급처 기준 4대 서류 허브 & 부채증명 관리
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
              신우법무사 표준 실무 20종 연동
            </span>
          </div>
          <p className="text-xs text-slate-500">
            의뢰인의 발급 동선에 맞추어 주민센터, 국세청, 직장, 금융기관 서류를 체계적으로 수합합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSendMobileDocLink}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-slate-500" />
            <span>모바일 서류제출 링크 발송</span>
          </button>

          {onOpenDocScanner && (
            <button
              onClick={onOpenDocScanner}
              className="px-3.5 py-2 bg-brand/10 hover:bg-brand/20 text-brand font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>문서 스캐너 실행</span>
            </button>
          )}

          <button
            onClick={onAdvanceToNextStage}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer"
          >
            <span>Stage 3 (접수·금지명령)으로 이동</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ⚠️ korea.legal 핵심 강조: 개인정보보호 제3자 주민번호 마스킹 준칙 배너 */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start justify-between gap-4 text-xs shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-sm flex items-center gap-2 text-amber-900">
              <span>개인정보보호 및 법원 제출 기준: 제3자 주민번호 마스킹 준칙</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-900 font-bold">
                보정명령 사전 예방
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed text-[11px]">
              가족관계증명서, 혼인관계증명서, 주민등록등본 제출 시 <strong>신청인 본인을 제외한 제3자(배우자, 부모, 자녀 등)의 주민등록번호 뒷자리는 미표기(******)</strong>된 서류를 제출해야 법원 개인정보 보호 지침에 부합합니다.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-amber-300 shadow-2xs shrink-0">
          <input
            type="checkbox"
            checked={thirdPartyMaskingConfirmed}
            onChange={e => setThirdPartyMaskingConfirmed(e.target.checked)}
            className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand"
          />
          <span className="font-bold text-slate-800 text-xs">제3자 마스킹 검증 완료</span>
        </label>
      </div>

      {/* 4대 발급처별 탭 네비게이션 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/60 p-1.5 gap-1 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveAgency('gov')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeAgency === 'gov'
                ? 'bg-white text-brand shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Home className="w-4 h-4 text-emerald-600" />
            <span>🏛️ 주민센터·정부24 (6종)</span>
          </button>

          <button
            onClick={() => setActiveAgency('tax')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeAgency === 'tax'
                ? 'bg-white text-brand shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>🏢 국세청·홈택스 (6종)</span>
          </button>

          <button
            onClick={() => setActiveAgency('work')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeAgency === 'work'
                ? 'bg-white text-brand shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <span>💼 직장·사업장 서류 (5종)</span>
          </button>

          <button
            onClick={() => setActiveAgency('finance')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeAgency === 'finance'
                ? 'bg-white text-brand shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4 text-amber-600" />
            <span>💳 금융·자산조회 원스톱 (6종)</span>
          </button>

          <button
            onClick={() => setActiveAgency('special')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeAgency === 'special'
                ? 'bg-white text-brand shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>⭐ 6대 특수 사유 소명함</span>
          </button>
        </div>

        {/* 탭 콘텐츠 리스트 */}
        <div className="p-5">
          {activeAgency !== 'special' ? (
            <div className="divide-y divide-slate-100">
              {(activeAgency === 'gov' ? govDocs : activeAgency === 'tax' ? taxDocs : activeAgency === 'work' ? workDocs : financeDocs).map((doc) => {
                const status = getDocStatus(doc.name);

                return (
                  <div key={doc.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition-all">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        status.isUploaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {status.isUploaded ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900">{doc.name}</span>
                          {doc.isRequired ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              필수
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-500">
                              해당자
                            </span>
                          )}
                          {doc.isThirdPartyMaskingRequired && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              제3자 마스킹
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>{doc.notes}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {status.isUploaded ? (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>제출완료</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => toast.info(`${doc.name} 업로드 창이 열렸습니다.`)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>업로드</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 6대 특수 사유 소명함 */
            <div className="space-y-3">
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs text-rose-950 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  아래 항목에 해당하는 경우 법원이 보정명령으로 반드시 제출을 명하므로, 사전에 소명자료를 완비해야 기각을 방어할 수 있습니다.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <span className="font-black text-slate-900">① 최근 1년 이내 1,000만원 이상 재산 처분자</span>
                  <p className="text-slate-500 text-[11px]">부동산 매매계약서, 배당표, 통장 입금내역, 처분대금 사용처 소명표</p>
                  <span className="inline-block text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">은닉·편파변제 방어</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <span className="font-black text-slate-900">② 최근 2년 이내 이혼 및 재산분할 이력자</span>
                  <p className="text-slate-500 text-[11px]">재산분할 명세서, 양육비부담조서, 재판상이혼 판결서 및 확정증명</p>
                  <span className="inline-block text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">위장이혼 의혹 해소</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <span className="font-black text-slate-900">③ 과거 5~10년 내 회생·파산 신청 이력자</span>
                  <p className="text-slate-500 text-[11px]">기존 사건 신청서, 인가결정문, 면책결정문, 변제수행 납입증명원</p>
                  <span className="inline-block text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">제595조 5년제한 검증</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <span className="font-black text-slate-900">④ 기존 급여·통장 압류 집행 계류자</span>
                  <p className="text-slate-500 text-[11px]">법원 압류결정문(타채 사건번호), 상대방 채권자 목록, 압류적립금 소명서</p>
                  <span className="inline-block text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded">Stage 3 중지명령 연계</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 하단: 부채증명서 발급 대행 현황 카드 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900">
              금융기관 부채증명서 발급 대행 현황
            </span>
            <span className="text-xs text-slate-500 font-medium">
              (총 {(crmExt?.debtCertificateOrders?.[0]?.items || []).length}개 채권처 조회)
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            대행 발급 완료 100%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {(crmExt?.debtCertificateOrders?.[0]?.items || [
            { creditorName: '신한카드(주)', balance: 18500000, status: 'completed' },
            { creditorName: '국민은행(주)', balance: 35000000, status: 'completed' },
            { creditorName: '현대캐피탈(주)', balance: 12000000, status: 'completed' }
          ]).map((item: any, idx: number) => (
            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-slate-900 block">{item.creditorName}</span>
                <span className="text-slate-500 text-[11px] mt-0.5 block">
                  원리금: {(item.balance || 0).toLocaleString()}원
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800">
                발급완료
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
