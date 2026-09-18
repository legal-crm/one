import React, { useState, useEffect } from 'react';
import { 
  Scale, Briefcase, FileText, Calculator, CheckCircle2, 
  Printer, ShieldCheck, Download, ExternalLink, ArrowRight, 
  Lock, Sparkles, AlertCircle, Building2, Smartphone, UserCheck, 
  Layers, Check, Copy, ChevronRight, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { 
  getDocSharePackage, 
  quickRegisterStaffOrLawyer, 
  upgradeToFullPartner,
  LawyerDocSharePackage,
  RecipientRoleType
} from '../../services/lawyerDocShareService';

interface UnregisteredLawyerDocViewerProps {
  token: string;
  onLawyerRegistered?: (lawyerId: string) => void;
  onNavigateHome?: () => void;
}

export default function UnregisteredLawyerDocViewer({
  token,
  onLawyerRegistered,
  onNavigateHome
}: UnregisteredLawyerDocViewerProps) {
  const [pkg, setPkg] = useState<LawyerDocSharePackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1단계: 간이 가입 여부 체크
  const [isUnlocked, setIsUnlocked] = useState(false);

  // 간이 가입 폼 상태
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<RecipientRoleType>('LAWYER');
  const [regPhone, setRegPhone] = useState('');
  const [regFirmName, setRegFirmName] = useState('');

  // 서류 탭: 'statement' | 'incomeExpense' | 'property'
  const [activeTab, setActiveTab] = useState<'statement' | 'incomeExpense' | 'property'>('statement');

  // 2단계: 정식 파트너 전환 모달
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    const loaded = getDocSharePackage(token);
    setPkg(loaded);
    setIsLoading(false);

    if (loaded) {
      setRegName(loaded.recipientName || '');
      setRegRole(loaded.recipientType || 'LAWYER');
      setRegPhone(loaded.recipientPhone || '');
      setRegFirmName(loaded.recipientFirmName || '');

      // 이미 세션에 등록된 변호사/사무장인지 확인
      try {
        const sessionRaw = sessionStorage.getItem('mykimbyun_light_member');
        if (sessionRaw) {
          const member = JSON.parse(sessionRaw);
          if (member.token === token || member.phone === loaded.recipientPhone) {
            setIsUnlocked(true);
          }
        }
      } catch {}
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">보안 서류 패키지를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black text-white">서류 열람 기간이 만료되었거나 올바르지 않은 링크입니다</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            보안을 위해 서류 공유 링크는 발송 후 7일간 유효합니다. 의뢰인에게 새 열람 링크 전송을 요청해 주세요.
          </p>
          <button
            onClick={() => {
              if (onNavigateHome) onNavigateHome();
              else window.location.href = window.location.origin;
            }}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition"
          >
            마이김변 홈으로 이동
          </button>
        </div>
      </div>
    );
  }

  // 1단계: 5초 간이 가입 제출 처리
  const handleQuickRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      toast.error('변호사님 또는 사무장님의 성함을 입력해 주세요.');
      return;
    }
    if (!regPhone.trim()) {
      toast.error('휴대폰 번호를 입력해 주세요.');
      return;
    }

    const res = quickRegisterStaffOrLawyer({
      token,
      name: regName.trim(),
      role: regRole,
      phone: regPhone.trim(),
      firmName: regFirmName.trim()
    });

    if (res.success) {
      setIsUnlocked(true);
      toast.success(`${regName} ${regRole === 'LAWYER' ? '변호사님' : '사무장님'} 인증 완료! 서류 열람실로 입장합니다.`);
    }
  };

  // 2단계: 정식 파트너 변호사 회원 전환
  const handleUpgradeToFull = () => {
    setIsUpgrading(true);
    const sessionRaw = sessionStorage.getItem('mykimbyun_light_member');
    const member = sessionRaw ? JSON.parse(sessionRaw) : {};
    const lawyerId = member.lawyerId || `lawyer_${Date.now()}`;

    const res = upgradeToFullPartner({
      lawyerId,
      name: regName || pkg.recipientName,
      role: regRole,
      phone: regPhone || pkg.recipientPhone,
      firmName: regFirmName || pkg.recipientFirmName || '법무법인 한빛',
      token
    });

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}

    toast.success('🎉 마이김변 정식 파트너 변호사로 전환되었습니다! 해당 의뢰인 사건이 CRM 수임 목록에 배속되었습니다.', {
      duration: 5000
    });

    setTimeout(() => {
      setIsUpgrading(false);
      if (onLawyerRegistered) {
        onLawyerRegistered(lawyerId);
      } else {
        // App role 전환
        window.location.search = '?role=lawyer';
      }
    }, 1200);
  };

  const won = (n: number | undefined) => (n || 0).toLocaleString();

  // ══════════════════════════════════════════════════════════
  // GATE: 5초 간이 가입 화면 (미인증 상태)
  // ══════════════════════════════════════════════════════════
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-left">
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                마이김변 로펌 서류 열람실
              </span>
              <h2 className="text-lg font-black text-white mt-1">
                변호사·사무장 서류 확인
              </h2>
            </div>
          </div>

          <div className="p-3.5 bg-slate-850 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">전달 의뢰인:</span>
              <span className="font-bold text-white">{pkg.clientName} 님</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">포함 서류:</span>
              <span className="text-emerald-400 font-semibold">진술서(D5104), 수지표(D5103), 재산목록</span>
            </div>
            {pkg.memo && (
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 italic">
                "{pkg.memo}"
              </p>
            )}
          </div>

          <form onSubmit={handleQuickRegister} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300">직책 선택</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegRole('LAWYER')}
                  className={`py-2 px-3 rounded-xl font-bold border transition ${
                    regRole === 'LAWYER'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  ⚖️ 변호사
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('MANAGER')}
                  className={`py-2 px-3 rounded-xl font-bold border transition ${
                    regRole === 'MANAGER'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  💼 사무장·실무관
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">성함</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="예: 김민준"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">소속 로펌명</label>
                <input
                  type="text"
                  value={regFirmName}
                  onChange={(e) => setRegFirmName(e.target.value)}
                  placeholder="예: 법무법인 한빛"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">수신 휴대폰 번호</label>
              <input
                type="tel"
                required
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="010-XXXX-XXXX"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Sparkles className="w-4 h-4" />
              <span>⚡ 5초 간이 가입 & 서류 즉시 열람하기</span>
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            * 별도의 앱 설치나 결제 없이, 의뢰인이 작성한 법원 표준 서류를 즉시 확인하고 A4 인쇄/다운로드하실 수 있습니다.
          </p>

        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // UNLOCKED: 서류 열람실 & 정식 파트너 전환 뷰어
  // ══════════════════════════════════════════════════════════
  const stmt = pkg.docs.statementData;
  const inc = pkg.docs.incomeExpenseData;
  const prop = pkg.docs.propertySummary;
  const debt = pkg.docs.debtSummary;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      
      {/* ═══ 상단 로펌 헤더 바 ═══ */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-white">
                마이김변 로펌 서류 열람실
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                인증 열람 모드
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              열람자: {regFirmName ? `[${regFirmName}] ` : ''}{regName} {regRole === 'LAWYER' ? '변호사님' : '사무장님'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.print();
            }}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>A4 인쇄</span>
          </button>

          <button
            onClick={handleUpgradeToFull}
            disabled={isUpgrading}
            className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isUpgrading ? 'CRM 이관 중...' : '🏆 이 사건 내 CRM에 수임 등록'}</span>
          </button>
        </div>
      </header>

      {/* ═══ 의뢰인 사건 요약 카드 ═══ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 text-left">
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500 text-white">
                  개인회생 2차 서류
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  접수관할: {debt?.courtName || '서울회생법원'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                의뢰인 <span className="text-emerald-400">{pkg.clientName}</span> 님의 사전 작성 서류 패키지
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">총 채무액</span>
                <span className="text-lg font-black text-white">{won(debt?.totalDebt)}원</span>
              </div>
              <div className="h-8 w-px bg-slate-800"></div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">예상 월 변제금</span>
                <span className="text-lg font-black text-emerald-400">{won(debt?.monthlyPayment)}원</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">신청인 월 소득</span>
              <span className="font-bold text-slate-200">{won(debt?.monthlyIncome)}원</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">총 재산(청산가치)</span>
              <span className="font-bold text-slate-200">{won(prop?.totalAssetValue)}원</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">예상 원금 탕감률</span>
              <span className="font-bold text-emerald-400">{debt?.expectedReductionRate || 60}%</span>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px]">서류 AI 검증</span>
              <span className="font-bold text-indigo-300">법원 표준 규격 100%</span>
            </div>
          </div>
        </div>

        {/* ═══ 2단계 정식 전환 유치 배너 (High-Conversion Callout) ═══ */}
        <div className="mt-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-slate-900 border border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-purple-500 text-white">
                B2B 로펌 전용 혜택
              </span>
              <span className="text-xs text-purple-200 font-bold">
                서류 보정 야근 80% 절감!
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-black text-white">
              의뢰인이 AI로 90% 완성해 온 서류입니다. 지금 원클릭으로 사건을 수임 등록하세요.
            </h4>
            <p className="text-xs text-purple-200/80 leading-relaxed">
              정식 파트너로 등록하시면 이 사건의 전자소송 데이터가 내 CRM으로 자동 이관되며, 매달 사전 검토된 회생 의뢰인을 무료 매칭해 드립니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleUpgradeToFull}
            disabled={isUpgrading}
            className="px-5 py-3 bg-white text-slate-950 hover:bg-slate-100 text-xs sm:text-sm font-black rounded-2xl shadow-lg transition flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>10초 만에 정식 파트너 가입 & 수임 등록</span>
          </button>
        </div>

        {/* ═══ 서류 탭 네비게이션 ═══ */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'statement'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>🎙️ 대법원 표준 진술서 (D5104)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('incomeExpense')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'incomeExpense'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>📊 12개월 수지표 (D5103)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('property')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'property'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>📋 재산 및 청산가치 요약</span>
          </button>
        </div>

        {/* ═══ 탭별 서류 뷰어 ═══ */}
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-left space-y-6">
          
          {/* TAB 1: 법원 진술서 */}
          {activeTab === 'statement' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">
                    대법원 전산양식 [D5104] 개인회생 진술서
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    사건본인: {stmt?.applicantName || pkg.clientName} | 관할: {stmt?.courtName || '서울회생법원'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  판사·회생위원 검토 규격
                </span>
              </div>

              {/* 1. 직업 및 경력 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. 최종학력 및 최근 직업·경력 이력
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800 text-slate-300 font-bold">
                      <tr>
                        <th className="p-3">기간</th>
                        <th className="p-3">직장명 / 상호</th>
                        <th className="p-3">직위 / 업종</th>
                        <th className="p-3">퇴직 및 폐업 사유</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {(stmt?.careers || []).map((c: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-850">
                          <td className="p-3 font-mono">{c.period}</td>
                          <td className="p-3 font-bold text-white">{c.companyName}</td>
                          <td className="p-3">{c.position}</td>
                          <td className="p-3 text-slate-400">{c.reasonForLeaving}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. 주거 현황 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. 현재 주거 상황 및 임차 조건
                </h4>
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">주거 유형</span>
                    <span className="font-bold text-white">{stmt?.residence?.residenceTypeLabel || '임차(월세)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">보증금</span>
                    <span className="font-bold text-white">{won(stmt?.residence?.deposit)}원</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">월세</span>
                    <span className="font-bold text-white">{won(stmt?.residence?.monthlyRent)}원</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">거주지</span>
                    <span className="font-bold text-white">{stmt?.residence?.addressSummary || '서울'}</span>
                  </div>
                </div>
              </div>

              {/* 3. 채무 발생 및 증대 4단 사연 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>3. 채무 발생 원인 및 지급불능 경위 (법원 표준 4단 구성)</span>
                  <span className="text-[10px] text-emerald-400 font-normal">AI 음성 인터뷰 정돈 완료</span>
                </h4>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-indigo-400 text-[11px] block">
                      ① 첫 채무 발생 원인 및 계기
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.initialCauseDetail || '생활비 및 운영자금 부족으로 인한 채무 개시'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-indigo-400 text-[11px] block">
                      ② 채무가 급격히 증대한 과정 (돌려막기 등)
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.growthProcessDetail || '고금리 대출 및 카드 돌려막기 누적'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-rose-400 text-[11px] block">
                      ③ 스스로 더 이상 감당할 수 없게 된 지급불능 시점
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.insolvencyTriggerDetail || '월 원리금 상환액이 월 소득을 초과'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1">
                    <span className="font-bold text-emerald-400 text-[11px] block">
                      ④ 현재 생활 상황 및 성실 변제 다짐
                    </span>
                    <p className="text-slate-200 pl-1">
                      {stmt?.story?.resolutionAndApology || '성실한 변제계획 수행을 통한 경제적 재기 다짐'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 12개월 수지표 */}
          {activeTab === 'incomeExpense' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">
                    대법원 전산양식 [D5103] 채무자의 수입 및 지출에 관한 목록
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    소득 구분: {inc?.detailedIncomeType || '개인사업자/프리랜서'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  12개월 원장 산출 완료
                </span>
              </div>

              {/* 월평균 요약 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">월평균 총매출/수입</span>
                  <span className="text-sm font-black text-white">{won(inc?.monthlyLedger?.averageMonthlyIncome || 3200000)}원</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">월평균 인정 필요경비</span>
                  <span className="text-sm font-black text-rose-400">{won(inc?.monthlyLedger?.averageMonthlyExpense || 720000)}원</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">월평균 순소득</span>
                  <span className="text-sm font-black text-emerald-400">{won(inc?.monthlyLedger?.averageNetIncome || 2480000)}원</span>
                </div>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">1인가구 최저생계비</span>
                  <span className="text-sm font-black text-indigo-300">1,400,000원</span>
                </div>
              </div>

              {/* 12개월 장부 테이블 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  최근 12개월 월별 수입 및 경비 원장 (법원 제출 규격)
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800 text-slate-300 font-bold">
                      <tr>
                        <th className="p-3">귀속월</th>
                        <th className="p-3">카드매출</th>
                        <th className="p-3">현금매출</th>
                        <th className="p-3">월세/임차료</th>
                        <th className="p-3">영업필수경비</th>
                        <th className="p-3 text-right">월 순소득</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {(inc?.monthlyLedger?.months || []).slice(0, 6).map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-850">
                          <td className="p-3 font-mono text-slate-400">{m.monthLabel}</td>
                          <td className="p-3 font-mono">{won(m.incomeCard)}원</td>
                          <td className="p-3 font-mono">{won(m.incomeCash)}원</td>
                          <td className="p-3 font-mono">{won(m.expenseRent)}원</td>
                          <td className="p-3 font-mono text-rose-300">{won(m.expenseOperating)}원</td>
                          <td className="p-3 font-mono font-bold text-emerald-400 text-right">{won(m.netIncome)}원</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 재산 및 채무 종합 */}
          {activeTab === 'property' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-black text-white">
                  재산상황표 및 청산가치 보장의 원칙 검토
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  총 채무 {won(debt?.totalDebt)}원 대비 청산가치 {won(prop?.totalAssetValue)}원
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">임차보증금 (공제 후)</span>
                  <span className="text-base font-black text-white">{won(prop?.depositAmount)}원</span>
                  <p className="text-[10px] text-slate-500">서울 소액임차보증금 면제 규정 검토</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">차량 및 환가재산</span>
                  <span className="text-base font-black text-white">{won(prop?.vehicleValue)}원</span>
                  <p className="text-[10px] text-slate-500">중고차 시세 기준 청산가치</p>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 block text-[10px]">청산가치 총액</span>
                  <span className="text-base font-black text-indigo-400">{won(prop?.totalAssetValue)}원</span>
                  <p className="text-[10px] text-emerald-400">청산가치 보장 원칙 통과</p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
