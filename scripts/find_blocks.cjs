const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'ClientRole.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
const N = lines.length;

// Find line containing string (1-indexed), starting from 0-indexed startFrom
function fl(str, startFrom = 0) {
  for (let i = startFrom; i < N; i++) if (lines[i].includes(str)) return i + 1;
  return -1;
}

// Find the closing line of a JSX block that starts with a { or ( pattern
// startLine is 1-indexed. Returns 1-indexed line of the closing.
function findBlockEnd(startLine1) {
  let depth = 0;
  let started = false;
  for (let i = startLine1 - 1; i < N; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{' || ch === '(') { depth++; started = true; }
      if (ch === '}' || ch === ')') depth--;
    }
    if (started && depth <= 0) return i + 1;
  }
  return -1;
}

// Collect replacements as [startLine(1-indexed), endLine(1-indexed), replacement]
const R = [];

// ===== 1. IMPORTS (line 15) =====
R.push([15, 15, // only the supabase import line
`import { supabase } from '../supabaseClient';
import ReviewsView from './client/ReviewsView';
import CalculatorView from './client/CalculatorView';
import QnAView from './client/QnAView';
import ChatView from './client/ChatView';
import NewsView from './client/NewsView';
import NoticesView from './client/NoticesView';
import LawyersView from './client/LawyersView';
import AuthModal from './client/AuthModal';
import MyPageView from './client/MyPageView';
import InquiryView from './client/InquiryView';
import DiagnosisFlow from './client/DiagnosisFlow';
import DiagnosisResultView from './client/DiagnosisResult';
import ClientFooter from './client/ClientFooter';
import TermsModal from './client/TermsModal';
import MobileGNB from './client/MobileGNB';
import { loadDiagnosisConfig, saveDiagnosisResult } from '../services/diagnosisService';
import { DiagnosisResult as DiagnosisResultType, DiagnosisConfig } from '../types';`]);

// ===== 2. AUTH STATE (lines 404-407 and 498-504) =====
R.push([404, 407, '']); // authTab, authError, authLoading, isRegisterMode
R.push([498, 504, '']); // authPhone, otpSent, otpCountdown, otpInput, otpError, otpSuccess, authConsent

// ===== 3. DIAGNOSIS STATE (line 413 -> after showSettingsModal) =====
R.push([403, 404,
`  // Email and Real Auth States

  // Diagnosis States
  const [diagnosisPhase, setDiagnosisPhase] = useState<'idle' | 'flow' | 'result'>('idle');
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResultType | null>(null);
  const [diagnosisConfig, setDiagnosisConfig] = useState<DiagnosisConfig | null>(null);
`]);

// ===== 4. OTP TIMER useEffect (lines 505-517) =====
R.push([505, 517, '']);

// ===== 5. LOAD DIAGNOSIS CONFIG (line 441) =====
R.push([441, 441,
`  // Load Diagnosis Config
  useEffect(() => { loadDiagnosisConfig().then(c => { if(c) setDiagnosisConfig(c); }); }, []);

  // Suspended, Withdrawn, or Dormant check hook`]);

// ===== 6. AUTH HANDLERS (handleSocialLogin...handleEmailAuth, lines ~1065-1239) =====
const socialLogin = fl('const handleSocialLogin');
const regenAlias = fl('const handleRegenAlias');
if (socialLogin > 0 && regenAlias > 0) R.push([socialLogin, regenAlias - 1, '']);

// ===== 7. LANDING DIAGNOSIS BUTTON (replace the calculator button with diagnosis + calculator) =====
// Find exact lines of original button: "탕감액 계산기" comment -> "</button>" 
const calcBtnComment = fl('{/* 탕감액 계산기 */}', 1300);
const calcBtnEnd = fl('</button>', calcBtnComment);
if (calcBtnComment > 0 && calcBtnEnd > 0) {
  R.push([calcBtnComment, calcBtnEnd,
`                {/* 간이 자가진단 */}
                <button
                  onClick={() => setDiagnosisPhase('flow')}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-5 rounded-3xl shadow-lg hover:shadow-xl transition-all flex items-center justify-between group w-full text-left"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">🧪 AI 간이 진단</span>
                    <h4 className="font-extrabold text-sm text-white">1분 무료 채무 자가진단</h4>
                    <p className="text-[11px] text-indigo-200/70">5문항 답변 → AI가 최적 전략 즉시 분석</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <Activity className="w-5 h-5" />
                  </div>
                </button>

                {/* 탕감액 계산기 */}
                <button
                  onClick={() => setActiveTab('calculator')}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group w-full text-left"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] text-brand dark:text-brand-light font-bold uppercase tracking-wider">정밀 계산</span>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">내 빚 탕감액 계산기</h4>
                    <p className="text-[11px] text-slate-500">소득, 채무만 입력하면 예상 변제금 계산</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-brand-light dark:bg-brand/10 text-brand dark:text-brand-light flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 ml-2">
                    <Activity className="w-5 h-5" />
                  </div>
                </button>`]);
}

// ===== 8. VIEW TABS (use brace-counting for precise ends) =====
// MyPage tab
const mypageLine = fl("{activeTab === 'mypage' && (");
if (mypageLine > 0) {
  const mypageEnd = findBlockEnd(mypageLine);
  R.push([mypageLine, mypageEnd,
    `        {activeTab === 'mypage' && (<MyPageView userAlias={userAlias} setUserAlias={setUserAlias} isEditingAlias={isEditingAlias} setIsEditingAlias={setIsEditingAlias} tempAlias={tempAlias} setTempAlias={setTempAlias} income={income} setIncome={setIncome} dependents={dependents} setDependents={setDependents} debtBanks={debtBanks} setDebtBanks={setDebtBanks} debtCards={debtCards} setDebtCards={setDebtCards} debtPersonals={debtPersonals} setDebtPersonals={setDebtPersonals} requests={requests} onNavigateToChat={(reqId) => { if(reqId) setActiveChatReqId(reqId); setActiveTab('chat'); }} />)}`]);
}

// Calculator tab
const calcLine = fl("{activeTab === 'calculator' && (", 2300);
if (calcLine > 0) {
  const calcEnd = findBlockEnd(calcLine);
  R.push([calcLine, calcEnd,
    `        {activeTab === 'calculator' && (<CalculatorView onNavigateToRequest={(data) => { setIncome(data.income); setDebtTotal(data.debtTotal); setDependents(data.dependents); if(data.title) setTitle(data.title); if(data.content) setContent(data.content); if(data.requestType) setRequestType(data.requestType); setRequestStep(data.step); setActiveTab('request'); }} />)}`]);
}

// Reviews tab (find exact start)
const reviewsLine = fl("{activeTab === 'reviews' && (", 2500);
if (reviewsLine > 0) {
  const reviewsEnd = findBlockEnd(reviewsLine);
  R.push([reviewsLine, reviewsEnd,
    `        {activeTab === 'reviews' && (<ReviewsView reviews={reviews} onReviewClick={handleReviewClick} />)}`]);
}

// Inquiry tab
const inquiryLine = fl("{activeTab === 'inquiry' && (() =>", 2800);
if (inquiryLine > 0) {
  const inquiryEnd = findBlockEnd(inquiryLine);
  R.push([inquiryLine, inquiryEnd,
    `        {activeTab === 'inquiry' && (<InquiryView inquiries={inquiries} setInquiries={setInquiries} isLoggedIn={isLoggedIn} userAlias={userAlias} onShowAuthModal={() => setShowAuthModal(true)} inquiryTitle={inquiryTitle} setInquiryTitle={setInquiryTitle} inquiryContent={inquiryContent} setInquiryContent={setInquiryContent} onLogActivity={onLogActivity} />)}`]);
}

// News tab
const newsLine = fl("{activeTab === 'news' && (", inquiryLine);
if (newsLine > 0) {
  const newsEnd = findBlockEnd(newsLine);
  R.push([newsLine, newsEnd,
    `        {activeTab === 'news' && (<NewsView newsArticles={newsArticles} onSelectArticle={(art) => setSelectedArticle(art)} onUpdateViews={(id) => setNewsArticles(prev => prev.map(x => x.id === id ? {...x, views: x.views+1} : x))} />)}`]);
}

// QnA tab
const qnaLine = fl("{activeTab === 'qna' && (", newsLine);
if (qnaLine > 0) {
  const qnaEnd = findBlockEnd(qnaLine);
  R.push([qnaLine, qnaEnd,
    `        {activeTab === 'qna' && (<QnAView qas={qas} onConsultRequest={(t,c) => { setTitle(t); setContent(c); setRequestStep(3); setActiveTab('request'); }} />)}`]);
}

// Notices tab
const noticesLine = fl("{activeTab === 'notices' && (", qnaLine);
if (noticesLine > 0) {
  const noticesEnd = findBlockEnd(noticesLine);
  R.push([noticesLine, noticesEnd,
    `        {activeTab === 'notices' && (<NoticesView notices={notices} selectedNoticeId={selectedNoticeId} onSetSelectedNoticeId={setSelectedNoticeId} onGoHome={() => setActiveTab('landing')} />)}`]);
}

// Lawyers tab  
const lawyersLine = fl("{activeTab === 'lawyers' && (", 3500);
if (lawyersLine > 0) {
  const lawyersEnd = findBlockEnd(lawyersLine);
  R.push([lawyersLine, lawyersEnd,
    `        {activeTab === 'lawyers' && (<LawyersView lawyers={mockLawyers} onConsultClick={(l) => { setTitle(l.name+' 변호사 상담 신청'); setActiveTab('request'); }} />)}`]);
}

// Chat tab
const chatLine = fl("{activeTab === 'chat' && (", 3700);
if (chatLine > 0) {
  const chatEnd = findBlockEnd(chatLine);
  R.push([chatLine, chatEnd,
    `        {activeTab === 'chat' && (<ChatView requests={requests} consultMessages={consultMessages} activeChatReqId={activeChatReqId} setActiveChatReqId={setActiveChatReqId} userAlias={userAlias} isLoggedIn={isLoggedIn} onSendMessage={(reqId, msg) => { const m = { id:'msg-'+Date.now(), visibleTo:['CLIENT','ADMIN'], requestId:reqId, consultRequestId:reqId, senderId:'client-'+Date.now(), senderName:userAlias||'의뢰인', senderRole:'CLIENT', content:msg, timestamp:new Date().toISOString(), isRead:false }; setConsultMessages(prev => [...prev,m]); }} onShowAuthModal={() => setShowAuthModal(true)} />)}`]);
}

// ===== 9. FOOTER block =====
const footerStart = fl('Babitalk-style Footer');
const footerCopyright = fl('</footer>', footerStart);
R.push([footerStart, footerCopyright,
  `      <ClientFooter platformConfig={platformConfig} onShowTerms={(type) => { setTermsModalType(type); setShowTermsModal(true); }} />`]);

// ===== 10. TERMS MODAL =====
const termsStart = fl('이용약관 및 개인정보처리방침');
const showTermsLine = fl('{showTermsModal && (', termsStart);
const termsEnd = findBlockEnd(showTermsLine);
R.push([termsStart, termsEnd,
  `      {showTermsModal && (<TermsModal termsModalType={termsModalType} platformConfig={platformConfig} onClose={() => setShowTermsModal(false)} />)}`]);

// ===== 11. AUTH MODAL + DIAGNOSIS OVERLAYS =====
const authModalComment = fl('{/* Auth Modal', 4000);
if (authModalComment <= 0) {
  // Try finding the showAuthModal block directly
  const authModalBlock = fl('{showAuthModal && (', 4300);
  if (authModalBlock > 0) {
    const authEnd = findBlockEnd(authModalBlock);
    R.push([authModalBlock, authEnd,
      `      {showAuthModal && (<AuthModal onClose={() => setShowAuthModal(false)} onLoginSuccess={(alias,ep,ch) => { setIsLoggedIn(true); setUserAlias(alias); setShowAuthModal(false); recordClientLogin(alias,ep,ch); }} />)}

      {diagnosisPhase === 'flow' && (<DiagnosisFlow onComplete={async (r) => { setDiagnosisResult(r); setDiagnosisPhase('result'); await saveDiagnosisResult(r); }} onBack={() => setDiagnosisPhase('idle')} diagnosisConfig={diagnosisConfig||undefined} />)}

      {diagnosisPhase === 'result' && diagnosisResult && (<DiagnosisResultView result={diagnosisResult} onGoHome={() => { setDiagnosisPhase('idle'); setDiagnosisResult(null); }} onStartDetailedDiagnosis={() => { setDiagnosisPhase('idle'); setActiveTab('calculator'); }} onViewLawyers={() => { setDiagnosisPhase('idle'); setActiveTab('lawyers'); }} onRetakeDiagnosis={() => { setDiagnosisPhase('idle'); setDiagnosisResult(null); setDiagnosisPhase('flow'); }} />)}`]);
  }
}

// ===== 12. GNB =====
const gnbStart = fl('Mobile Bottom GNB');
const gnbNav = fl('</nav>', gnbStart);
R.push([gnbStart, gnbNav,
  `      <MobileGNB activeTab={activeTab} onSetActiveTab={setActiveTab} onRequestConsult={() => { setRequestType('open'); setRequestStep(1); setActiveTab('request'); }} />`]);

// Sort descending to apply from bottom up
R.sort((a, b) => b[0] - a[0]);

let res = [...lines];
for (const [s, e, r] of R) {
  if (s <= 0 || e <= 0 || e < s) { console.log('SKIP', s, e); continue; }
  console.log('R', s, '-', e, '(' + (e - s + 1) + ' lines)');
  res.splice(s - 1, e - s + 1, ...r.split('\n'));
}

fs.writeFileSync(filePath, res.join('\n'), 'utf8');
console.log('Done!', lines.length, '->', res.length);
