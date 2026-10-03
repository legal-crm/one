import React, { useState } from 'react';
import { 
  X, ExternalLink, Copy, Check, ShieldCheck, Download, 
  Building2, Landmark, FileText, Smartphone, Sparkles, BookOpen, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';

interface PublicDocGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
}

interface PublicAgencyGuide {
  id: string;
  name: string;
  category: 'GOV' | 'TAX' | 'COURT' | 'PENSION' | 'FINANCE';
  icon: string;
  siteUrl: string;
  recommendedAuth: string;
  targetDocs: {
    name: string;
    courtRequirement: string;
    criticalOption: string;
  }[];
  smsGuideTemplate: string;
}

const PUBLIC_AGENCIES: PublicAgencyGuide[] = [
  {
    id: 'gov24',
    name: '정부24 (민원24)',
    category: 'GOV',
    icon: '🏛️',
    siteUrl: 'https://www.gov.kr',
    recommendedAuth: '간편인증(카카오·토스·PASS) 또는 공동인증서',
    targetDocs: [
      {
        name: '주민등록등본',
        courtRequirement: '세대원 전원의 이름 및 주민번호 표시',
        criticalOption: '발급형태: [전부표시], 세대구성 사유 및 일자 포함'
      },
      {
        name: '주민등록초본 (말소·이력 포함)',
        courtRequirement: '과거 5년~전체 주소 변동 이력 필수 (관할법원 소명용)',
        criticalOption: '발급형태: [선택발급] → [과거 주소변동사항: 전체포함], [주민등록번호 뒷자리: 표시]'
      },
      {
        name: '지방세 세목별 과세증명서',
        courtRequirement: '최근 3~5년분 전국 자치단체 과세 내역 (재산 유무 확인)',
        criticalOption: '과세기간: 최근 5년, 과세물건지: [전국 자치단체 선택] 필수'
      },
      {
        name: '건축물대장 / 토지대장',
        courtRequirement: '부동산 소유자 또는 과거 매각 사실 소명 시',
        criticalOption: '총괄표제부 및 전유부 포함'
      }
    ],
    smsGuideTemplate: `[마이김변] 정부24 서류 발급 안내
1. 정부24(gov.kr) 접속 후 간편인증(카카오 등) 로그인
2. [주민등록초본]: 반드시 '과거 주소변동사항 전체포함' 및 '주민번호 뒷자리 표시'로 발급
3. [지방세 세목별 과세증명서]: '최근 5년간, 전국 자치단체'로 신청해 주세요.`
  },
  {
    id: 'hometax',
    name: '국세청 홈택스 / 손택스',
    category: 'TAX',
    icon: '🏢',
    siteUrl: 'https://www.hometax.go.kr',
    recommendedAuth: '공동·금융인증서 또는 간편인증',
    targetDocs: [
      {
        name: '소득금액증명원 (최근 3년분)',
        courtRequirement: '근로소득·종합소득·사업소득 유무 및 금액 확인',
        criticalOption: '발급유형: [한글], 증명구분: [종합소득세 또는 근로소득자용], 과세기간: [최근 3년]'
      },
      {
        name: '근로소득 원천징수영수증',
        courtRequirement: '직장인의 최근 급여 내역 소명',
        criticalOption: '지급명세서 등 제출내역 조회 → 최근 귀속년도 지급명세서 인쇄'
      },
      {
        name: '국세 체납 사실증명 (납세증명서)',
        courtRequirement: '국세 체납액 확인 (우선권 있는 개인회생채권 분류용)',
        criticalOption: '용도: [법원제출용] 선택'
      },
      {
        name: '부가가치세 과세표준증명 / 폐업사실증명',
        courtRequirement: '개인사업자 또는 과거 폐업한 자영업자 필수',
        criticalOption: '폐업자는 [폐업사실증명원], 사업자는 최근 2~3년 [부가세 과세표준증명]'
      }
    ],
    smsGuideTemplate: `[마이김변] 국세청 홈택스 서류 발급 안내
1. 국세청 홈택스(hometax.go.kr) 접속 후 로그인
2. [소득금액증명원]: '최근 3개년치, 주민번호 전체공개, 법원제출용'으로 발급
3. [납세증명서]: 국세 완납 또는 체납 여부 확인용으로 함께 발급해 주세요.`
  },
  {
    id: 'court_family',
    name: '대법원 전자가족관계등록시스템',
    category: 'COURT',
    icon: '⚖️',
    siteUrl: 'https://efamily.scourt.go.kr',
    recommendedAuth: '공동인증서, 금융인증서, 간편인증',
    targetDocs: [
      {
        name: '가족관계증명서 (상세)',
        courtRequirement: '부모, 배우자, 자녀 관계 및 부양가족 산정용',
        criticalOption: '발급형태: 반드시 [상세증명서] 선택, 주민번호 뒷자리: [전부 공개]'
      },
      {
        name: '혼인관계증명서 (상세)',
        courtRequirement: '이혼, 재혼, 별거 등 재산분할 및 배우자 재산 소명용',
        criticalOption: '발급형태: 반드시 [상세증명서] 선택, 과거 혼인·이혼 이력 모두 포함'
      }
    ],
    smsGuideTemplate: `[마이김변] 전자가족관계등록시스템 서류 안내
1. efamily.scourt.go.kr 접속 후 간편인증 로그인
2. [가족관계증명서] 및 [혼인관계증명서]는 일반이 아닌 반드시 '상세증명서'로 선택
3. 주민등록번호 뒷자리 6자리가 모두 보이도록 발급해 주세요.`
  },
  {
    id: 'iros',
    name: '대법원 인터넷등기소',
    category: 'COURT',
    icon: '📑',
    siteUrl: 'https://www.iros.go.kr',
    recommendedAuth: '회원/비회원 누구나 열람·발급 가능',
    targetDocs: [
      {
        name: '부동산 등기사항전부증명서 (등기부등본)',
        courtRequirement: '현재 거주지(임차주택 또는 자가) 및 최근 2년 내 매각 부동산',
        criticalOption: '구분: [말소사항 포함] 선택 필수 (근저당, 가압류 이력 확인)'
      }
    ],
    smsGuideTemplate: `[마이김변] 등기부등본 발급 안내
1. 인터넷등기소(iros.go.kr)에서 현재 살고 계신 집의 부동산 등기부등본을 발급
2. '말소사항 포함'으로 선택하셔야 권리관계 심사가 가능합니다.`
  },
  {
    id: 'nhis',
    name: '국민건강보험공단',
    category: 'PENSION',
    icon: '🩺',
    siteUrl: 'https://www.nhis.or.kr',
    recommendedAuth: '간편인증 또는 공동인증서',
    targetDocs: [
      {
        name: '건강보험 자격득실확인서',
        courtRequirement: '신청인의 현재 및 과거 직장 재직 이력 소명 (소득 활동 입증)',
        criticalOption: '조회조건: [전체(직장가입자+지역가입자 전체 이력)], 주민번호 뒷자리 포함'
      },
      {
        name: '건강보험료 납부확인서 (최근 1년)',
        courtRequirement: '급여 미신고 프리랜서나 일용직의 간접 소득 추정용',
        criticalOption: '납부기간: 최근 12개월'
      }
    ],
    smsGuideTemplate: `[마이김변] 건강보험공단 서류 발급 안내
1. 국민건강보험(nhis.or.kr) 접속 후 로그인
2. [건강보험 자격득실확인서]: '전체 이력, 주민번호 뒷자리 포함'으로 발급
3. [건강보험료 납부확인서]: 최근 1년분으로 발급해 주세요.`
  },
  {
    id: 'nps',
    name: '국민연금공단 (내연금)',
    category: 'PENSION',
    icon: '🛡️',
    siteUrl: 'https://www.nps.or.kr',
    recommendedAuth: '간편인증 또는 공동인증서',
    targetDocs: [
      {
        name: '국민연금 가입증명서',
        courtRequirement: '가입 기간 및 사업장 명칭 확인',
        criticalOption: '국문 전체 이력'
      },
      {
        name: '연금산정용 가입내역 확인서',
        courtRequirement: '기준소득월액 확인 (최근 소득 산정용)',
        criticalOption: '최근 3년분 이상'
      }
    ],
    smsGuideTemplate: `[마이김변] 국민연금 가입증명 안내
국민연금공단(nps.or.kr)에서 '국민연금 가입증명서' 및 '연금산정용 가입내역 확인서'를 발급받아 첨부해 주세요.`
  },
  {
    id: 'car365',
    name: '자동차365 (국토교통부)',
    category: 'GOV',
    icon: '🚗',
    siteUrl: 'https://www.car365.go.kr',
    recommendedAuth: '본인 휴대폰 인증 또는 공동인증서',
    targetDocs: [
      {
        name: '자동차등록원부 (갑부/을부)',
        courtRequirement: '차량 시가 산정 및 캐피탈 저당권 설정 확인',
        criticalOption: '을부(저당권 설정 내역) 반드시 포함'
      }
    ],
    smsGuideTemplate: `[마이김변] 자동차등록원부 발급 안내
자동차365(car365.go.kr) 또는 정부24에서 본인 명의 차량의 '자동차등록원부(갑부 및 을부 모두)'를 발급해 주세요.`
  },
  {
    id: 'kfb',
    name: '크레딧포유 (한국신용정보원)',
    category: 'FINANCE',
    icon: '💳',
    siteUrl: 'https://www.credit4u.or.kr',
    recommendedAuth: '공동인증서 필수 (신용정보 열람)',
    targetDocs: [
      {
        name: '본인 신용정보조회서 (대출·보증·연체)',
        courtRequirement: '누락 채권자 방지 및 채권자목록 대조용 1순위 자료',
        criticalOption: '대출정보, 신용카드 개설정보, 채무보증정보, 연체정보 일괄 인쇄'
      }
    ],
    smsGuideTemplate: `[마이김변] 크레딧포유(한국신용정보원) 신용정보서 안내
1. credit4u.or.kr 접속 후 본인 공동인증서 로그인
2. [신용정보 열람]에서 본인의 전체 대출, 카드, 연체 내역이 포함된 신용정보조회서를 인쇄(PDF 저장)해 주세요.`
  }
];

export default function PublicDocGuideModal({
  isOpen,
  onClose,
  clientName = '의뢰인'
}: PublicDocGuideModalProps) {
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('gov24');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAgency = PUBLIC_AGENCIES.find(a => a.id === selectedAgencyId) || PUBLIC_AGENCIES[0];

  const handleCopySms = (template: string, id: string) => {
    navigator.clipboard.writeText(template);
    setCopiedId(id);
    toast.success('의뢰인 전송용 발급 안내 메시지가 클립보드에 복사되었습니다. 카카오톡이나 문자로 전송하세요.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <ModalPortal>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-doc-guide-title"
      >
        <div 
          className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ═══ 헤더 ═══ */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="public-doc-guide-title" className="text-base font-black tracking-tight">
                    공공기관 서류 발급 가이드 & 안내 센터
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/40 text-[10px] font-black text-blue-300">
                    8대 발급처 완벽 정리
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  법원 보정명령 0순위 지적 방지: 정확한 발급처, 필수 옵션(상세/전부표시), 의뢰인 전송용 템플릿
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ═══ 본문: 좌측 기관 목록 + 우측 상세 가이드 ═══ */}
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* 좌측 사이드바: 8대 기관 목록 */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 overflow-y-auto shrink-0 space-y-1 text-xs">
              <div className="px-2 py-1 text-[11px] font-black text-slate-500 dark:text-slate-400">
                발급 기관 선택
              </div>
              {PUBLIC_AGENCIES.map(agency => {
                const isSelected = agency.id === selectedAgencyId;
                return (
                  <button
                    key={agency.id}
                    type="button"
                    onClick={() => setSelectedAgencyId(agency.id)}
                    className={`w-full p-2.5 rounded-xl font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{agency.icon}</span>
                      <span className="truncate">{agency.name}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {agency.targetDocs.length}종
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 우측 메인 패널: 상세 가이드 */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
              {/* 기관 정보 헤더 */}
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{currentAgency.icon}</span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {currentAgency.name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    권장 인증: <strong>{currentAgency.recommendedAuth}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={currentAgency.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <span>공식 사이트 바로가기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleCopySms(currentAgency.smsGuideTemplate, currentAgency.id)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] transition-all"
                  >
                    {copiedId === currentAgency.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">복사 완료</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>의뢰인 전송문 복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 필수 서류 및 법원 심사 옵션 리스트 */}
              <div className="space-y-2.5">
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>해당 기관 발급 서류 및 법원 필수 옵션 ({currentAgency.targetDocs.length}종)</span>
                </h4>

                <div className="space-y-2.5">
                  {currentAgency.targetDocs.map((doc, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-[11px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span>{doc.name}</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          법원 제출 필수
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-700">
                          <span className="font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                            ⚖️ 법원 제출 목적 및 심사 기준
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {doc.courtRequirement}
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50">
                          <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>반드시 선택해야 하는 필수 옵션</span>
                          </span>
                          <span className="text-amber-900 dark:text-amber-200 font-bold leading-relaxed">
                            {doc.criticalOption}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 의뢰인 안내 문자 템플릿 미리보기 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    <span>의뢰인 카카오톡 / 문자 안내 템플릿 미리보기</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopySms(currentAgency.smsGuideTemplate, currentAgency.id)}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>전체 복사</span>
                  </button>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {currentAgency.smsGuideTemplate}
                </div>
              </div>

            </div>
          </div>

          {/* ═══ 푸터 ═══ */}
          <div className="p-3 px-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>정확한 옵션으로 발급된 서류는 법원 전자소송 접수 시 보정명령 확률을 80% 이상 단축합니다.</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
            >
              닫기
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
}
