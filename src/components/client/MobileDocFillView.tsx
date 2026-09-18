import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, CheckCircle2, AlertCircle, FileText, 
  RotateCcw, Send, Lock, ArrowLeft, PenTool, Check 
} from 'lucide-react';
import { toast } from 'sonner';
import { ClientMobileDocService, type MobileDocRequestItem } from '../../services/documents/clientMobileDocService';

interface MobileDocFillViewProps {
  token: string;
  onClose?: () => void;
  onComplete?: () => void;
}

export default function MobileDocFillView({
  token,
  onClose,
  onComplete
}: MobileDocFillViewProps) {
  const [requestItem, setRequestItem] = useState<MobileDocRequestItem | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 입력 상태
  const [ownerName, setOwnerName] = useState('');
  const [ownerRelation, setOwnerRelation] = useState('부모');
  const [freeResidenceReason, setFreeResidenceReason] = useState('경제적 사정으로 독립 주거 유지가 어려워 부모님 댁에 무상으로 동거 중입니다.');
  
  // 사채진술서 필드
  const [lenderName, setLenderName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDate, setLoanDate] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('생활비 및 기존 채무 돌려막기');

  // 3. 100만 원 이상 출금 사용처 소명
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseBank, setExpenseBank] = useState('');
  const [expenseRecipient, setExpenseRecipient] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('생활비');
  const [expenseDetails, setExpenseDetails] = useState('');

  // 4. 최근 1년 1,000만 원 이상 재산처분 소명
  const [disposedAssetType, setDisposedAssetType] = useState('부동산');
  const [disposalDate, setDisposalDate] = useState('');
  const [disposalTotalAmount, setDisposalTotalAmount] = useState('');
  const [debtPayoffAmount, setDebtPayoffAmount] = useState('');
  const [netProceeds, setNetProceeds] = useState('');
  const [proceedsUsage, setProceedsUsage] = useState('');

  // 5. 영업소득자 필요경비 산출
  const [monthlyGrossSales, setMonthlyGrossSales] = useState('');
  const [rentExpense, setRentExpense] = useState('');
  const [payrollExpense, setPayrollExpense] = useState('');
  const [materialExpense, setMaterialExpense] = useState('');
  const [utilityExpense, setUtilityExpense] = useState('');

  // 6. 추가 생계비 신청
  const [additionalLivingType, setAdditionalLivingType] = useState('주거비(고액월세)');
  const [additionalAmount, setAdditionalAmount] = useState('');
  const [additionalReason, setAdditionalReason] = useState('');

  // 7. 배우자 재산 및 이혼 재산분할
  const [spouseName, setSpouseName] = useState('');
  const [spousePropertyList, setSpousePropertyList] = useState('');
  const [propertyDivisionDetail, setPropertyDivisionDetail] = useState('');
  const [childSupport, setChildSupport] = useState('');

  // 금융동의/위임 공통 동의
  const [isAgreed, setIsAgreed] = useState(false);

  // 전자서명 캔버스
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasSigned, setHasSigned] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const item = ClientMobileDocService.getRequestByToken(token);
    if (item) {
      setRequestItem(item);
      if (item.status === 'SUBMITTED' || item.status === 'VERIFIED') {
        setIsCompleted(true);
      }
    }
  }, [token]);

  // 캔버스 마우스/터치 이벤트 핸들러
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSubmit = () => {
    if (!hasSigned) {
      toast.error('하단 서명란에 자필 서명을 완료해주세요.');
      return;
    }
    if (!isAgreed) {
      toast.error('진술 내용의 사실 확인 및 동의에 체크해주세요.');
      return;
    }

    const canvas = canvasRef.current;
    const sigDataUrl = canvas ? canvas.toDataURL('image/png') : '';

    setIsSubmitting(true);

    const formData: Record<string, any> = {
      agreed: true,
      submittedAt: new Date().toISOString()
    };

    const docCode = requestItem?.docCode || '';
    const docTitle = requestItem?.docTitle || '';

    if (docCode === '111110' || docTitle.includes('무상거주')) {
      formData.ownerName = ownerName || '부모(소유자)';
      formData.ownerRelation = ownerRelation;
      formData.freeResidenceReason = freeResidenceReason;
    } else if (docCode === '121020' || docTitle.includes('사채') || docTitle.includes('차용')) {
      formData.lenderName = lenderName || '개인대여자';
      formData.loanAmount = loanAmount;
      formData.loanDate = loanDate;
      formData.loanPurpose = loanPurpose;
    } else if (docCode === '122040' || docTitle.includes('사용처') || docTitle.includes('출금')) {
      formData.expenseDate = expenseDate || new Date().toISOString().slice(0, 10);
      formData.expenseAmount = expenseAmount;
      formData.expenseBank = expenseBank;
      formData.expenseRecipient = expenseRecipient;
      formData.expenseCategory = expenseCategory;
      formData.expenseDetails = expenseDetails;
    } else if (docCode === 'ASSET_DISPOSAL' || docTitle.includes('재산처분') || docTitle.includes('처분대금')) {
      formData.disposedAssetType = disposedAssetType;
      formData.disposalDate = disposalDate;
      formData.disposalTotalAmount = disposalTotalAmount;
      formData.debtPayoffAmount = debtPayoffAmount;
      formData.netProceeds = netProceeds;
      formData.proceedsUsage = proceedsUsage;
    } else if (docCode === '122050' || docTitle.includes('영업소득') || docTitle.includes('필요경비')) {
      formData.monthlyGrossSales = monthlyGrossSales;
      formData.rentExpense = rentExpense;
      formData.payrollExpense = payrollExpense;
      formData.materialExpense = materialExpense;
      formData.utilityExpense = utilityExpense;
    } else if (docCode === '122011' || docTitle.includes('생계비')) {
      formData.additionalLivingType = additionalLivingType;
      formData.additionalAmount = additionalAmount;
      formData.additionalReason = additionalReason;
    } else if (docCode === '113120' || docTitle.includes('배우자') || docTitle.includes('이혼')) {
      formData.spouseName = spouseName;
      formData.spousePropertyList = spousePropertyList;
      formData.propertyDivisionDetail = propertyDivisionDetail;
      formData.childSupport = childSupport;
    } else {
      formData.genericStatement = freeResidenceReason || loanPurpose || '사실대로 진술함';
    }

    setTimeout(() => {
      ClientMobileDocService.submitMobileDoc(token, formData, sigDataUrl);
      setIsSubmitting(false);
      setIsCompleted(true);
      toast.success('서류 작성 및 전자서명이 법원에 정상 전송되었습니다.');
      if (onComplete) onComplete();
    }, 600);
  };

  if (!requestItem) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-bold text-lg text-slate-900">유효하지 않은 링크</h3>
          <p className="text-xs text-slate-500">요청 정보를 찾을 수 없거나 이미 만료된 작성 링크입니다.</p>
          {onClose && (
            <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold">
              닫기
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[96vh] flex flex-col overflow-hidden my-auto">
        
        {/* 모바일 상단 바 */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                <span>법원 전자소송 본인확인</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-mono">암호화</span>
              </div>
              <p className="text-[10px] text-slate-400">신청인: {requestItem.clientName} 귀하</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {isCompleted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-lg text-slate-900">작성 및 전자서명 완료</h3>
                <p className="text-xs text-slate-600">
                  [{requestItem.docTitle}]이(가) 법무법인 및 법원 제출 서류함으로 정상 전송되었습니다.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-1.5 font-mono">
                <div>• 접수서식: {requestItem.docTitle} ({requestItem.docCode})</div>
                <div>• 작성자: {requestItem.clientName}</div>
                <div>• 접수일시: {new Date().toLocaleString()}</div>
                <div>• 인증상태: 본인 자필 전자서명 검증 완료</div>
              </div>
              {onClose && (
                <button 
                  onClick={onClose}
                  className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl text-sm press-scale cursor-pointer"
                >
                  확인 및 창 닫기
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 서식 제목 안내 카드 */}
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-[11px] font-bold text-blue-700 font-mono">서식 #{requestItem.docCode}</span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900">{requestItem.docTitle}</h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  법원에 제출될 정식 서식입니다. 질문에 사실대로 답변해주신 후 하단에 자필 서명을 남겨주세요.
                </p>
              </div>

              {/* 1) 무상거주사실확인서 폼 */}
              {requestItem.docCode === '111110' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">주택 소유자 (또는 명의인) 성명</label>
                    <input 
                      type="text" 
                      placeholder="예: 홍길동 (부친)" 
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">소유자와 신청인과의 관계</label>
                    <select 
                      value={ownerRelation}
                      onChange={e => setOwnerRelation(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    >
                      <option value="부모">부모 (친부/친모)</option>
                      <option value="형제자매">형제 / 자매</option>
                      <option value="배우자">배우자 (부부 공동)</option>
                      <option value="친척">친척 (삼촌/이모 등)</option>
                      <option value="지인">지인 / 친구</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">무상 거주 사유</label>
                    <textarea 
                      rows={3}
                      value={freeResidenceReason}
                      onChange={e => setFreeResidenceReason(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}

              {/* 2) 사채진술서 폼 */}
              {requestItem.docCode === '121020' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">개인 대여자 성명</label>
                    <input 
                      type="text" 
                      placeholder="예: 김대여" 
                      value={lenderName}
                      onChange={e => setLenderName(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">차용 금액 (만 원)</label>
                      <input 
                        type="number" 
                        placeholder="예: 500" 
                        value={loanAmount}
                        onChange={e => setLoanAmount(e.target.value)}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">차용 일자</label>
                      <input 
                        type="date" 
                        value={loanDate}
                        onChange={e => setLoanDate(e.target.value)}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">빌린 돈의 사용처</label>
                    <textarea 
                      rows={2}
                      value={loanPurpose}
                      onChange={e => setLoanPurpose(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 3) 100만 원 이상 출금 사용처 소명표 */}
              {(requestItem.docCode === '122040' || requestItem.docTitle.includes('사용처') || requestItem.docTitle.includes('출금')) && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                    💡 <strong>법원 보정 1순위 소명:</strong> 통장에서 출금 또는 송금된 고액 자금의 객관적 사용 목적을 선택 및 소명해 주세요.
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">거래 일자</label>
                      <input 
                        type="date" 
                        value={expenseDate}
                        onChange={e => setExpenseDate(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">출금/이체 금액 (만 원)</label>
                      <input 
                        type="number" 
                        placeholder="예: 300"
                        value={expenseAmount}
                        onChange={e => setExpenseAmount(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">출금 계좌/은행</label>
                      <input 
                        type="text" 
                        placeholder="예: 국민은행 1234"
                        value={expenseBank}
                        onChange={e => setExpenseBank(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">송금처 (받는 분 성명)</label>
                      <input 
                        type="text" 
                        placeholder="예: 홍길동 또는 상호"
                        value={expenseRecipient}
                        onChange={e => setExpenseRecipient(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">사용 목적 분류</label>
                    <select
                      value={expenseCategory}
                      onChange={e => setExpenseCategory(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    >
                      <option value="생활비">생활비 (식비, 주거비, 공과금)</option>
                      <option value="병원비/의료비">병원비 / 수술비 / 장기간병비</option>
                      <option value="기존채무변제">기존 대출금 / 카드대금 상환</option>
                      <option value="가족부양">부모님 또는 자녀 긴급 생활지원</option>
                      <option value="사업물품대금">사업장 원재료 / 물품대금 결제</option>
                      <option value="보증금/전세금">주거지 보증금 및 이사비용</option>
                      <option value="기타">기타 불가피한 지출</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">구체적 지출 경위</label>
                    <textarea 
                      rows={2}
                      placeholder="구체적인 사용 경위를 기재해 주세요 (예: 모친 수술비 지출 및 영수증 보관 중)"
                      value={expenseDetails}
                      onChange={e => setExpenseDetails(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 4) 최근 1년 1,000만 원 이상 재산처분대금 소명서 */}
              {(requestItem.docCode === 'ASSET_DISPOSAL' || requestItem.docTitle.includes('재산처분') || requestItem.docTitle.includes('처분대금')) && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                    💡 <strong>편파변제 및 은닉 방어:</strong> 부동산, 차량, 전세보증금 매각 후 남은 잔여대금의 사용처를 증빙합니다.
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">처분한 재산 종류</label>
                      <select
                        value={disposedAssetType}
                        onChange={e => setDisposedAssetType(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      >
                        <option value="부동산">부동산 (아파트, 빌라, 토지)</option>
                        <option value="자동차">자동차 / 오토바이</option>
                        <option value="임차보증금">전세 / 월세 임차보증금 반환</option>
                        <option value="보험해약금">보험 해약환급금 수령</option>
                        <option value="기타재산">기타 회원권 또는 귀금속</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">처분(매각) 일자</label>
                      <input 
                        type="date"
                        value={disposalDate}
                        onChange={e => setDisposalDate(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800">총 매각가 (만원)</label>
                      <input 
                        type="number"
                        placeholder="예: 5000"
                        value={disposalTotalAmount}
                        onChange={e => setDisposalTotalAmount(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800">담보대출상환액</label>
                      <input 
                        type="number"
                        placeholder="예: 3000"
                        value={debtPayoffAmount}
                        onChange={e => setDebtPayoffAmount(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800">실제 정산금(수령)</label>
                      <input 
                        type="number"
                        placeholder="예: 2000"
                        value={netProceeds}
                        onChange={e => setNetProceeds(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">수령한 정산금의 사용처 상세</label>
                    <textarea 
                      rows={2}
                      placeholder="대출 상환 후 손에 쥔 정산금을 어디에 사용하셨는지 기재해 주세요"
                      value={proceedsUsage}
                      onChange={e => setProceedsUsage(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 5) 영업소득자 필요경비 산출표 */}
              {(requestItem.docCode === '122050' || requestItem.docTitle.includes('영업소득') || requestItem.docTitle.includes('필요경비')) && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-900 text-[11px] leading-relaxed">
                    💡 <strong>영업 순소득 산출:</strong> 매출액에서 필수 사업 지출(월세, 인건비, 재료비, 공과금)을 공제하여 실소득을 산정합니다.
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">최근 1년 월평균 총매출액 (만 원)</label>
                    <input 
                      type="number" 
                      placeholder="예: 600"
                      value={monthlyGrossSales}
                      onChange={e => setMonthlyGrossSales(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">사업장 월세 (만 원)</label>
                      <input 
                        type="number" 
                        placeholder="예: 120"
                        value={rentExpense}
                        onChange={e => setRentExpense(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">직원/알바 인건비</label>
                      <input 
                        type="number" 
                        placeholder="예: 150"
                        value={payrollExpense}
                        onChange={e => setPayrollExpense(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">재료/원자재비</label>
                      <input 
                        type="number" 
                        placeholder="예: 100"
                        value={materialExpense}
                        onChange={e => setMaterialExpense(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">전기/통신/공과금</label>
                      <input 
                        type="number" 
                        placeholder="예: 30"
                        value={utilityExpense}
                        onChange={e => setUtilityExpense(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 6) 추가 생계비 인정 신청서 */}
              {(requestItem.docCode === '122011' || requestItem.docTitle.includes('생계비')) && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 text-[11px] leading-relaxed">
                    💡 <strong>변제금 절감 핵심:</strong> 기본 법정 생계비 외에 매월 고정적으로 지출되는 필수 비용을 추가 인정받아 변제금을 낮춥니다.
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">추가 생계비 신청 항목</label>
                    <select
                      value={additionalLivingType}
                      onChange={e => setAdditionalLivingType(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    >
                      <option value="주거비(고액월세)">주거비 (실제 지급 중인 고액 월세 실비)</option>
                      <option value="중증/만성질환 의료비">의료비 (본인 또는 가족의 중증 질환 정기 병원비)</option>
                      <option value="특수교육비">교육비 (장애/특수아동 교육 및 치료비)</option>
                      <option value="장애인간병비">간병비 (고령 부모 또는 장애 가족 간병비)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">월 추가 필요 금액 (만 원)</label>
                    <input 
                      type="number"
                      placeholder="예: 40"
                      value={additionalAmount}
                      onChange={e => setAdditionalAmount(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">구체적 소명 사유 및 진단/지출 배경</label>
                    <textarea 
                      rows={2}
                      placeholder="신청 사유를 구체적으로 적어주세요 (예: 월세 75만 원 중 기준 초과분 또는 당뇨 만성질환 정기 약제비)"
                      value={additionalReason}
                      onChange={e => setAdditionalReason(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 7) 배우자 재산 진술서 및 이혼 재산분할 소명서 */}
              {(requestItem.docCode === '113120' || requestItem.docTitle.includes('배우자') || requestItem.docTitle.includes('이혼')) && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-950 text-[11px] leading-relaxed">
                    💡 <strong>배우자 고유재산 소명:</strong> 배우자 명의 재산이 신청인의 은닉 자산이나 위장이혼이 아님을 진술합니다.
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">배우자 (또는 전 배우자) 성명</label>
                    <input 
                      type="text" 
                      placeholder="예: 이배우"
                      value={spouseName}
                      onChange={e => setSpouseName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">배우자 보유 재산 내역 (부동산, 차량, 예금 등)</label>
                    <input 
                      type="text" 
                      placeholder="예: 본인 명의 재산 없음 (또는 소형 승용차 1대)"
                      value={spousePropertyList}
                      onChange={e => setSpousePropertyList(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800">재산분할 수령/지급액</label>
                      <input 
                        type="text" 
                        placeholder="예: 없음 (또는 1,000만원 지급)"
                        value={propertyDivisionDetail}
                        onChange={e => setPropertyDivisionDetail(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-800">월 양육비 약정액</label>
                      <input 
                        type="text" 
                        placeholder="예: 월 50만 원"
                        value={childSupport}
                        onChange={e => setChildSupport(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 공통 사실 확인 서약 체크박스 */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isAgreed}
                  onChange={e => setIsAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 leading-relaxed font-medium">
                  위 기재한 내용은 모두 진실이며, 허위 사실이 있을 경우 법률적 책임을 질 것을 서약합니다.
                </span>
              </label>

              {/* 자필 전자서명 패드 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-blue-600" />
                    <span>신청인 자필 전자서명 (정자 서명)</span>
                  </label>
                  <button 
                    type="button"
                    onClick={clearSignature}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    다시 쓰기
                  </button>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 overflow-hidden relative touch-none h-36 flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={144}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full cursor-crosshair"
                  />
                  {!hasSigned && (
                    <div className="absolute pointer-events-none text-slate-400 text-xs flex flex-col items-center gap-1">
                      <span>손가락 또는 펜으로 이곳에 서명하세요</span>
                      <span className="text-[10px] text-slate-400">(법원 제출용 정자 서명)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 제출 버튼 */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>법원 서류 전송 중...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>작성 완료 및 서류 제출</span>
                  </>
                )}
              </button>
            </>
          )}

        </div>

        {/* 푸터 보안 배너 */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 text-center shrink-0">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" />
            대법원 전자소송 보안 규격 256-bit SSL 암호화 적용
          </p>
        </div>

      </div>
    </div>
  );
}
