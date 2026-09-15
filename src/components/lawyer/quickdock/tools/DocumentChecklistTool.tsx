import React, { useState, useMemo } from 'react';
import { CheckSquare, Copy, Check, FileText, Send, Building, DollarSign, Home, Car } from 'lucide-react';
import { toast } from 'sonner';

type JobType = 'employee' | 'business' | 'freelancer' | 'unemployed';
type HousingType = 'rent' | 'own' | 'free';

interface DocItem {
  id: string;
  name: string;
  source: string; // 발급처 (주민센터, 홈택스, 정부24, 은행 등)
  description: string;
  required: boolean;
}

export default function DocumentChecklistTool() {
  const [caseType, setCaseType] = useState<'rehab' | 'bankruptcy'>('rehab');
  const [jobType, setJobType] = useState<JobType>('employee');
  const [housingType, setHousingType] = useState<HousingType>('rent');
  const [hasVehicle, setHasVehicle] = useState(true);
  const [hasSpouse, setHasSpouse] = useState(false);
  const [copied, setCopied] = useState(false);

  // 조건에 따른 맞춤형 서류 목록 동적 구성
  const docSections = useMemo(() => {
    // 1. 공통 기본 서류 (주민센터 / 정부24)
    const basicDocs: DocItem[] = [
      { id: 'b1', name: '주민등록등본 (상세)', source: '주민센터/정부24', description: '주민번호 뒷자리 전체 공개', required: true },
      { id: 'b2', name: '주민등록초본 (원초본)', source: '주민센터/정부24', description: '과거 주소변동사항 전체 포함 필수', required: true },
      { id: 'b3', name: '가족관계증명서 (상세)', source: '주민센터/대법원', description: '본인 기준 상세 증명서', required: true },
      { id: 'b4', name: '혼인관계증명서 (상세)', source: '주민센터/대법원', description: '이혼 이력 포함 전체 상세', required: true },
      { id: 'b5', name: '지방세 세목별 과세증명서', source: '주민센터/위택스', description: '최근 5년분, 전국 자치단체 기준', required: true },
      { id: 'b6', name: '인감증명서 2~3통 또는 본인서명사실확인서', source: '주민센터 방문', description: '대리인 위임장 날인용', required: true },
    ];

    // 2. 소득 및 재직 증빙 서류
    const incomeDocs: DocItem[] = [];
    if (jobType === 'employee') {
      incomeDocs.push(
        { id: 'i1', name: '근로소득원천징수영수증', source: '직장/홈택스', description: '최근 1~2개년치 (직인 날인)', required: true },
        { id: 'i2', name: '최근 1년분 급여명세서', source: '직장 급여담당', description: '매월 실수령액 확인용', required: true },
        { id: 'i3', name: '재직증명서', source: '직장', description: '현재 근무 중임을 소명', required: true },
        { id: 'i4', name: '예상퇴직금확인서', source: '직장', description: '퇴직연금 DC형은 가입증명서', required: true },
        { id: 'i5', name: '건강보험 자격득실확인서 & 납부확인서', source: '건보공단(1577-1000)', description: '최근 1년치', required: true }
      );
    } else if (jobType === 'business') {
      incomeDocs.push(
        { id: 'i11', name: '사업자등록증명원', source: '홈택스/세무서', description: '현재 사업장 등록 증빙', required: true },
        { id: 'i12', name: '소득금액증명원 (최근 3년분)', source: '홈택스/세무서', description: '종합소득세 신고 기준', required: true },
        { id: 'i13', name: '부가가치세 과세표준증명원 (최근 2년)', source: '홈택스/세무서', description: '매출 추이 확인용', required: true },
        { id: 'i14', name: '매출/매입 장부 및 사업용 통장 거래내역', source: '은행', description: '최근 1년 입출금 내역서', required: true },
        { id: 'i15', name: '사업장 임대차계약서 사본', source: '본인 보관', description: '사업장 보증금 및 월세 확인', required: true }
      );
    } else if (jobType === 'freelancer') {
      incomeDocs.push(
        { id: 'i21', name: '소득금액증명원 (3.3% 사업소득)', source: '홈택스', description: '최근 2년분', required: true },
        { id: 'i22', name: '급여(보수) 입금 통장 거래내역서', source: '은행', description: '최근 1년치 전체', required: true },
        { id: 'i23', name: '위촉계약서 또는 용역계약서', source: '발주처/소속사', description: '프리랜서 근무 확인', required: true }
      );
    } else {
      incomeDocs.push(
        { id: 'i31', name: '소득금액증명원 (소득없음 증명)', source: '홈택스/세무서', description: '최근 3년분 사실증명', required: true },
        { id: 'i32', name: '건강보험 자격득실확인서', source: '건보공단', description: '피부양자 등록 확인용', required: true },
        { id: 'i33', name: '생계비 조달 경위서 / 진단서', source: '병원 등', description: '근로 불가능 사유(질병/고령 등)', required: caseType === 'bankruptcy' }
      );
    }

    // 3. 주거 관련 서류
    const housingDocs: DocItem[] = [];
    if (housingType === 'rent') {
      housingDocs.push(
        { id: 'h1', name: '주택 임대차계약서 사본 (확정일자 필)', source: '본인 보관', description: '보증금 및 월세 소명용', required: true },
        { id: 'h2', name: '보증금 지급 증빙 및 현재 거주지 등기부등본', source: '인터넷등기소', description: '임대인 소유권 확인', required: true }
      );
    } else if (housingType === 'own') {
      housingDocs.push(
        { id: 'h11', name: '부동산 등기사항전부증명서 (등기부등본)', source: '인터넷등기소', description: '말소사항 포함 전부 출력', required: true },
        { id: 'h12', name: 'KB시세 확인서 또는 국토부 실거래가 내역', source: 'KB부동산/실거래가', description: '시세 산정 자료', required: true }
      );
    } else {
      housingDocs.push(
        { id: 'h21', name: '무상거주사실확인서', source: '법률사무소 양식', description: '소유자(임차인) 인감증명서 첨부', required: true },
        { id: 'h22', name: '거주지 임대차계약서 사본 또는 등기부등본', source: '거주지 제공자', description: '거주지 권리관계 확인', required: true }
      );
    }

    // 4. 재산 및 금융 자산 서류
    const assetDocs: DocItem[] = [
      { id: 'a1', name: '전 금융기관 계좌정보통합조회(어카운트인포)', source: 'payinfo.or.kr', description: '보유 계좌 잔액 전체 조회표', required: true },
      { id: 'a2', name: '최근 1~2년 은행 입출금 거래내역서', source: '각 은행 인터넷뱅킹', description: '주거래/급여 통장 전체 엑셀/PDF', required: true },
      { id: 'a3', name: '보험가입내역조회서 (내보험다보여/내보험찾아줌)', source: 'credit4u / cont.insure.or.kr', description: '전체 보험 및 예상해약환급금확인서', required: true },
    ];

    if (hasVehicle) {
      assetDocs.push(
        { id: 'a11', name: '자동차등록원부 (갑부/을부)', source: '자동차365/정부24', description: '저당권 내역 포함 필수', required: true },
        { id: 'a12', name: '차량 시세 확인서 (보험개발원/엔카 캡처)', source: '보험개발원/엔카', description: '현재 차량가액 증빙', required: true }
      );
    }

    if (hasSpouse) {
      assetDocs.push(
        { id: 'a21', name: '배우자 지방세 세목별 과세증명서', source: '주민센터', description: '배우자 재산 유무 확인(최근 3년)', required: true },
        { id: 'a22', name: '배우자 재산 소명자료(부동산/차량)', source: '등기부/원부', description: '회생 시 1/2 청산가치 반영 검토', required: false }
      );
    }

    return [
      { category: '기본 신분 서류 (동사무소/정부24)', items: basicDocs },
      { category: '소득 및 재직 증빙 서류', items: incomeDocs },
      { category: '주거 및 거주 증빙 서류', items: housingDocs },
      { category: '재산·금융 및 기타 서류', items: assetDocs },
    ];
  }, [caseType, jobType, housingType, hasVehicle, hasSpouse]);

  // 카톡/문자 발송용 텍스트 생성 및 복사
  const handleCopyForClient = () => {
    let message = `[법무법인 개인회생·파산 준비서류 안내]\n`;
    message += `안녕하세요, 의뢰인님. 원활한 법원 접수를 위해 아래 서류를 준비해주시기 바랍니다.\n\n`;

    docSections.forEach(sec => {
      message += `📌 ${sec.category}\n`;
      sec.items.forEach((doc, idx) => {
        message += ` ${idx + 1}. ${doc.name} [발급처: ${doc.source}]\n   - ${doc.description}\n`;
      });
      message += `\n`;
    });

    message += `⚠️ 유의사항: 모든 서류는 주민등록번호 뒷자리까지 모두 공개하여 상세로 발급받으셔야 합니다. 준비되시는 대로 사진 또는 팩스/방문 전달 부탁드립니다.`;

    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success('의뢰인 발송용 서류 안내문이 클립보드에 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  const totalDocCount = docSections.reduce((acc, sec) => acc + sec.items.length, 0);

  return (
    <div className="p-3.5 space-y-3 text-xs text-slate-800">
      {/* ── 조건 선택 컨트롤러 ── */}
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
        <span className="font-extrabold text-slate-700 block text-[11px]">
          의뢰인 상황 맞춤 필터 (서류 자동 최적화)
        </span>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {/* 사건 구분 */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">신청 사건</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setCaseType('rehab')}
                className={`py-1 rounded font-bold transition-all cursor-pointer ${
                  caseType === 'rehab' ? 'bg-teal-700 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                개인회생
              </button>
              <button
                type="button"
                onClick={() => setCaseType('bankruptcy')}
                className={`py-1 rounded font-bold transition-all cursor-pointer ${
                  caseType === 'bankruptcy' ? 'bg-teal-700 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                개인파산
              </button>
            </div>
          </div>

          {/* 직업 형태 */}
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">소득 형태</label>
            <select
              value={jobType}
              onChange={e => setJobType(e.target.value as JobType)}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold cursor-pointer text-xs"
            >
              <option value="employee">직장인(급여소득)</option>
              <option value="business">자영업/개인사업자</option>
              <option value="freelancer">프리랜서/일용직</option>
              <option value="unemployed">무직/주부/학생</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-200/60">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">주거 형태</label>
            <select
              value={housingType}
              onChange={e => setHousingType(e.target.value as HousingType)}
              className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded font-bold cursor-pointer text-xs"
            >
              <option value="rent">임차(월세/전세)</option>
              <option value="own">자가(본인소유)</option>
              <option value="free">무상거주</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 pt-3">
            <input
              type="checkbox"
              checked={hasVehicle}
              onChange={e => setHasVehicle(e.target.checked)}
              className="rounded accent-teal-600"
            />
            차량 보유
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 pt-3">
            <input
              type="checkbox"
              checked={hasSpouse}
              onChange={e => setHasSpouse(e.target.checked)}
              className="rounded accent-teal-600"
            />
            배우자 있음
          </label>
        </div>
      </div>

      {/* ── 생성된 서류 목록 뷰어 ── */}
      <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="font-bold text-teal-800">
            필요 서류: 총 {totalDocCount}종 선별됨
          </span>
          <span className="text-[10px] text-slate-400">카톡/문자 즉시 전송 가능</span>
        </div>

        {docSections.map((sec, idx) => (
          <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="bg-slate-100/80 px-3 py-1.5 font-black text-slate-700 text-[11px] border-b border-slate-200 flex items-center justify-between">
              <span>{sec.category}</span>
              <span className="text-[10px] text-slate-400 font-normal">{sec.items.length}개</span>
            </div>
            <div className="divide-y divide-slate-100">
              {sec.items.map(doc => (
                <div key={doc.id} className="p-2 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-bold text-slate-900 text-xs leading-tight">
                      {doc.name}
                    </span>
                    <span className="text-[9px] bg-teal-50 text-teal-800 px-1.5 py-0.2 rounded border border-teal-200 font-medium shrink-0">
                      {doc.source}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    {doc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── 카카오톡/문자 발송문 원클릭 복사 버튼 ── */}
      <button
        onClick={handleCopyForClient}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사 완료!' : '의뢰인 발송용 서류 안내문 전체 복사'}</span>
      </button>
    </div>
  );
}
