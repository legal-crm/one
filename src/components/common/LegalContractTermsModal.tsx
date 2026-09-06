import React from 'react';
import { X, ShieldCheck, Check, FileText } from 'lucide-react';

export type TermKey = 'privacy' | 'thirdParty' | 'procedure' | 'legalEffect';

export interface TermDefinition {
  key: TermKey;
  title: string;
  badge: string;
  summary: string;
  getContent: (params: { firmName?: string; clientName?: string; lawyerName?: string }) => string;
}

export const LEGAL_TERMS_DATA: Record<TermKey, TermDefinition> = {
  privacy: {
    key: 'privacy',
    title: '개인정보 수집·이용 동의',
    badge: '개인정보보호법 제15조·제22조',
    summary: '성명, 연락처, 주민번호, 채무/소득/재산 정보 수집에 동의합니다.',
    getContent: ({ firmName = '수임 법무법인' }) => `[개인정보 수집·이용 동의서]

${firmName}(이하 "수임인")은 개인정보보호법 제15조, 제22조 및 변호사법에 따라 위임 사무 처리를 위하여 의뢰인의 개인정보를 아래와 같이 수집·이용합니다.

1. 수집·이용 목적
  가. 개인회생, 개인파산 및 면책 신청 사건의 위임 사무 처리
  나. 법원 제출 서류(신청서, 변제계획안, 재산목록, 진술서 등) 작성 및 보정권고 대응
  다. 사건 진행 경과 안내, 채권자 목록 통지 및 법률 상담 서비스 제공

2. 수집하는 개인정보 항목
  가. 필수 인적사항: 성명, 주민등록번호(또는 외국인등록번호), 연락처(휴대전화), 자택 및 직장 주소
  나. 부채 및 신용 정보: 채권자 목록, 부채증명서 발급 내역, 대출 원리금, 연체 내역, 신용조회 내역
  다. 소득 및 재산 정보: 급여명세서, 소득금액증명, 재산세 과세증명, 부동산·차량·보험·예금 등 자산 내역
  라. 가구원 정보: 주민등록등본·초본, 가족관계증명서, 혼인관계증명서 등 법원 요구 서류 일체

3. 보유 및 이용 기간
  - 위임 사무의 종료(면책 결정 확정, 기각, 취하 등) 시까지
  - 단, 변호사법 제28조의2 및 관련 법령에 따른 사건 장부 및 서류 보존 의무에 따라 5년간 보존 후 안전하게 파기합니다.

4. 동의 거부 권리 및 불이익 안내
  - 의뢰인은 본 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.
  - 단, 본 동의는 법률 사무 위임 및 법원 사건 접수에 필수적인 사항이므로, 동의를 거부하실 경우 위임계약 체결 및 사건 수행이 불가능합니다.`,
  },

  thirdParty: {
    key: 'thirdParty',
    title: '제3자 정보제공 동의',
    badge: '개인정보보호법 제17조·제18조',
    summary: '법원, 채권 금융기관, 신용정보원 등에 정보 제공에 동의합니다.',
    getContent: ({ firmName = '수임 법무법인' }) => `[개인정보 제3자 제공 동의서]

${firmName}(이하 "수임인")은 의뢰인의 위임 사무를 적법하게 수행하기 위하여 개인정보보호법 제17조 및 제18조에 따라 다음과 같이 개인정보를 제3자에게 제공합니다.

1. 제공받는 자
  가. 대한민국 관할 법원(회생법원, 지방법원 파산부 등)
  나. 채권자 금융기관(시중은행, 카드사, 캐피탈, 저축은행, 대부업체, 신용보증기금 등 채권자 일체)
  다. 한국신용정보원, 금융결제원, 국민건강보험공단, 국민연금공단, 국세청, 대법원 등 공공·금융기관

2. 제공 목적
  가. 개인회생/파산·면책 신청서 및 첨부 서류의 법원 접수 및 심사
  나. 부채증명서 발급 대행 및 채권자 목록 기재 금액의 정합성 대조
  다. 소득·재산 조회의 공적 증빙 발급 및 법원 보정명령에 대한 소명 자료 제출

3. 제공하는 개인정보 항목
  - 성명, 주민등록번호, 연락처, 주소, 채무 내역 및 발생 경위, 소득 및 재산 증빙 서류 일체

4. 제공받는 자의 보유 및 이용 기간
  - 제공 목적 달성 시 및 관계 법령에 규정된 법정 보존 기한까지

5. 동의 거부 권리 및 불이익 안내
  - 의뢰인은 제3자 정보제공 동의를 거부할 권리가 있습니다.
  - 단, 법원 접수 및 채권자 통지가 이루어지지 않으면 개인회생/파산 절차 진행 자체가 불가능하므로, 동의 거부 시 위임 사무 수행이 불가합니다.`,
  },

  procedure: {
    key: 'procedure',
    title: '사건 진행 절차 안내 확인',
    badge: '변호사법 광고규정 준수',
    summary: '절차, 기간, 면책 불허가 사유 등을 충분히 이해하였습니다.',
    getContent: ({ firmName = '수임 법무법인' }) => `[개인회생·파산 사건 진행 및 유의사항 확인서]

의뢰인은 ${firmName}에 사건을 위임함에 있어 아래의 절차적 특성과 법적 고지 사항을 충분히 확인하고 이해하였음을 서명으로 확인합니다.

1. 사법 심사의 독립성 및 결과 보장 불가
  - 개인회생 및 개인파산·면책은 대한민국 법원의 독립된 심사를 통해 결정되는 사법 절차입니다.
  - 변호사법 제23조 및 대한변호사협회 광고 규정에 따라, 사건의 인가율이나 100% 면책을 사전에 단정하거나 보장하지 않습니다.

2. 통상 소요 기간 안내
  가. 개인회생: 접수 후 금지명령(약 1~2주) → 개시결정(약 3~6개월) → 인가결정(약 6~10개월)
  나. 개인파산·면책: 접수 후 파산선고 및 파산관재인 선임(약 2~4개월) → 면책결정(약 6~12개월)
  ※ 관할 법원의 업무량, 서류 보정 횟수 및 채권자 이의신청 여부에 따라 기간은 변동될 수 있습니다.

3. 면책 불허가 사유의 고지
  - 채무자 회생 및 파산에 관한 법률 제564조에 규정된 면책 불허가 사유(재산 은닉, 허위 채권자 목록 제출, 사행성 행위, 과다한 낭비 등)가 있는 경우, 면책이 불허가되거나 변제율이 상향될 수 있음을 안내받았습니다.

4. 의뢰인의 성실 소명 및 기한 준수 의무
  - 의뢰인은 법원의 보정권고/보정명령에 따라 지정된 기한 내에 성실하게 소명 자료를 제출하여야 합니다.
  - 허위 사실 진술이나 서류 제출 지연으로 인해 발생하는 불이익(사건 기각 또는 폐지)에 대한 책임은 의뢰인 본인에게 있습니다.`,
  },

  legalEffect: {
    key: 'legalEffect',
    title: '전자서명법 제3조 법적 효력 합의',
    badge: '전자서명법 제3조·기본법 제4조',
    summary: '본 전자서명은 종이 계약서 자필 서명과 동일한 법적 효력을 가짐에 합의합니다.',
    getContent: ({ firmName = '수임 법무법인' }) => `[전자서명 및 전자문서 법적 효력 합의서]

위임인(의뢰인)과 수임인(${firmName})은 본 전자위임계약 및 부속 합의를 체결함에 있어 대한민국 전자서명법 및 관련 법령에 따라 다음과 같이 합의합니다.

1. 전자서명의 완전한 법적 효력
  - 대한민국 전자서명법 제3조(전자서명의 효력) 제1항 및 제2항에 의거하여, 당사자 간의 합의에 따라 본 시스템에서 수행되는 전자서명은 종이 서면의 자필 서명, 서명날인 또는 기명날인과 완전히 동일한 법적 효력을 가집니다.

2. 전자문서의 진정성 및 무결성 보장
  - 전자문서 및 전자거래 기본법 제4조(전자문서의 효력)에 따라, 본 계약은 전자적 형태로 작성·송신·수신 또는 저장되었다는 이유만으로 법적 효력이 부인되지 아니합니다.
  - 본 전자계약서는 전문에 대한 SHA-256 암호화 해시 산출 및 3중 타임스탬프(통신사 본인인증, 원본 해시, 체결본 해시)로 봉인되어, 사후 위·변조가 기술적으로 불가능함을 보증합니다.

3. 계약 방식에 대한 상호 동의
  - 양 당사자는 종이 서면 대신 모바일 실명확인(통신사 PASS/문자 인증) 및 전자 터치 서명 방식으로 위임계약을 체결함에 확정적으로 상호 합의합니다.`,
  },
};

interface Props {
  isOpen: boolean;
  termKey: TermKey | null;
  onClose: () => void;
  onAgree?: (key: TermKey) => void;
  firmName?: string;
  clientName?: string;
  lawyerName?: string;
}

export default function LegalContractTermsModal({
  isOpen,
  termKey,
  onClose,
  onAgree,
  firmName,
  clientName,
  lawyerName,
}: Props) {
  if (!isOpen || !termKey) return null;

  const term = LEGAL_TERMS_DATA[termKey];
  if (!term) return null;

  const content = term.getContent({ firmName, clientName, lawyerName });

  const handleAgreeAndClose = () => {
    if (onAgree) onAgree(termKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">{term.title}</h3>
                <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                  {term.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">상세 법률 조항 전문을 꼼꼼히 확인해 주세요.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="p-6 overflow-y-auto flex-1 bg-white text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            {content}
          </div>
          <div className="flex items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900">
            <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
            <span>본 약관은 전자서명법 및 개인정보보호법에 의거하여 분쟁 시 100% 법적 효력을 갖습니다.</span>
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleAgreeAndClose}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>내용을 확인하였으며 동의합니다</span>
          </button>
        </div>

      </div>
    </div>
  );
}
