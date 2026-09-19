import React, { useState } from 'react';
import { 
  Key, Calendar as CalendarIcon, BarChart3, Edit3, Settings, AlertTriangle, 
  CheckCircle, Clock, ChevronRight, RefreshCcw, Search, ExternalLink, 
  Layout, Eye, ArrowRight, Play, FileText, Image as ImageIcon, MessageCircle, 
  Video, Facebook, Share2, Plus, ArrowUpRight, TrendingUp, Users, Target,
  Check, X, MoreVertical, Smartphone, UploadCloud, Layers
} from 'lucide-react';
import { toast } from 'sonner';

// --- MAIN COMPONENT ---
export default function MarketingAutopilotHub() {
  const [activeTab, setActiveTab] = useState('오늘의 오토파일럿');

  const tabs = [
    { id: '오늘의 오토파일럿', icon: RefreshCcw },
    { id: 'Gemini 키 관리', icon: Key },
    { id: '콘텐츠 스튜디오', icon: Edit3 },
    { id: '365일 캘린더', icon: CalendarIcon },
    { id: '성과 분석', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">마케팅 오토파일럿 허브</h1>
          <p className="text-slate-400 text-sm">법률 플랫폼 통합 마케팅 자동화 및 채널 관리 (100% 익명 보장, 스텔스 가명 기술 적용)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-2 mb-6 pb-2 scrollbar-hide border-b border-[#1E293B]/60">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl transition-all whitespace-nowrap min-h-[44px] press-scale ${
              activeTab === tab.id
                ? 'bg-white/10 text-white font-bold border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.id}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="animate-fadeIn">
        {activeTab === '오늘의 오토파일럿' && <TabTodayAutopilot />}
        {activeTab === 'Gemini 키 관리' && <TabKeyManagement />}
        {activeTab === '콘텐츠 스튜디오' && <TabContentStudio />}
        {activeTab === '365일 캘린더' && <TabCalendar />}
        {activeTab === '성과 분석' && <TabAnalytics />}
      </div>
    </div>
  );
}

// --- TAB 1: 오늘의 오토파일럿 ---
function TabTodayAutopilot() {
  const [autoMode, setAutoMode] = useState(false);

  const channels = [
    { id: 'blog', name: '네이버 블로그', time: '10:00', status: 'completed', icon: FileText, color: 'text-emerald-400' },
    { id: 'shorts', name: '유튜브 쇼츠', time: '12:30', status: 'publishing', icon: Video, color: 'text-red-400' },
    { id: 'cardnews', name: '인스타 카드뉴스', time: '14:00', status: 'pending', icon: ImageIcon, color: 'text-pink-400' },
    { id: 'threads', name: '스레드 단상', time: '17:30', status: 'pending', icon: MessageCircle, color: 'text-white' },
    { id: 'facebook', name: '페이스북 페이지', time: '18:40', status: 'pending', icon: Facebook, color: 'text-blue-400' },
    { id: 'tiktok', name: '틱톡 스낵', time: '20:30', status: 'pending', icon: Smartphone, color: 'text-cyan-400' },
  ];

  const handleApproveAll = () => {
    toast.success('오늘의 6채널 배포가 일괄 승인되었습니다.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 flex flex-col lg:flex-row gap-6 shadow-md">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-sm font-medium border border-indigo-500/30">
              오늘의 테마
            </span>
            <span className="text-white font-bold text-lg">수요일 = 전문가보증 (스텔스 보증)</span>
          </div>
          <h2 className="text-xl font-bold text-white">오늘의 자동 선정 뉴스: "기준금리 동결, 서민 이자 부담은 여전..."</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            [연결 앵글] 금리 동결에도 실질적인 채무 부담을 느끼는 소상공인/직장인들을 타겟으로, 
            플랫폼의 '스텔스 가명' 기술을 통해 완전 비대면으로 안전하게 파산/회생 가능성을 진단받을 수 있음을 강조.
          </p>
        </div>
        
        <div className="lg:w-64 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-[#1E293B]/60 pt-6 lg:pt-0 lg:pl-6">
          <div className="mb-2 flex justify-between items-center text-sm">
            <span className="text-slate-400">컴플라이언스 점수</span>
            <span className="text-emerald-400 font-bold">98 / 100</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '98%' }}></div>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-300">완전자동 무검수 모드</span>
            <button 
              onClick={() => setAutoMode(!autoMode)}
              className={`w-12 h-6 rounded-full transition-colors relative ${autoMode ? 'bg-indigo-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${autoMode ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          
          <button 
            onClick={handleApproveAll}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all press-scale flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
          >
            <CheckCircle size={18} />
            6채널 일괄 승인
          </button>
        </div>
      </div>

      {/* Golden Time Timeline */}
      <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm overflow-x-auto">
        <h3 className="text-lg font-bold text-white mb-6">골든타임 배포 스케줄</h3>
        <div className="flex items-center min-w-[700px] pb-4">
          {channels.map((ch, idx) => (
            <React.Fragment key={ch.id}>
              <div className="flex flex-col items-center relative z-10 w-24">
                <div className="text-xs text-slate-400 mb-2">{ch.time}</div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 bg-[#0B0F19] shadow-sm
                  ${ch.status === 'completed' ? 'border-emerald-500 text-emerald-500' : 
                    ch.status === 'publishing' ? 'border-indigo-500 text-indigo-500 animate-pulse' : 
                    'border-slate-700 text-slate-500'}`}
                >
                  {ch.status === 'completed' ? <Check size={20} /> : <ch.icon size={20} />}
                </div>
                <div className="text-xs text-slate-300 mt-2 font-medium">{ch.name}</div>
              </div>
              {idx < channels.length - 1 && (
                <div className="flex-1 h-[2px] bg-slate-800 -mx-4 z-0 mt-[-10px]">
                  <div className={`h-full ${ch.status === 'completed' ? 'bg-emerald-500' : 'bg-transparent'}`}></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Channel Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map((ch) => (
          <div key={ch.id} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${ch.color}`}>
                  <ch.icon size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">{ch.name}</h4>
                  <p className="text-xs text-slate-400">발행 예정: {ch.time}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg border ${
                ch.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                ch.status === 'publishing' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {ch.status === 'completed' ? '완료' : ch.status === 'publishing' ? '진행중' : '대기중'}
              </span>
            </div>
            
            <div className="bg-[#0B0F19] rounded-xl p-4 text-sm text-slate-300 h-32 overflow-hidden relative">
              <div className="line-clamp-4">
                {ch.id === 'blog' && "[100% 익명] 빚 독촉으로 밤잠 설치는 분들 필독. 최근 금리 동결에도 불구하고 자영업자들의 시름은 깊어지고 있습니다. 하지만 마이김변의 스텔스 기술을 통해 개인정보 노출 없이 안전하게..."}
                {ch.id === 'shorts' && "(후킹) 아직도 빚 때문에 전화기 꺼두시나요? (본론) 내 이름 숨기고 회생 가능성 알아보는 법. 지금 바로 확인하세요. #개인회생 #스텔스보증"}
                {ch.id === 'cardnews' && "[카드 1] 이자 갚다 지친 당신을 위한 솔루션\n[카드 2] 마이김변 100% 익명 진단\n[카드 3] 변호사 직접 검토, 철저한 비밀 보장"}
                {ch.id === 'threads' && "오늘도 이자 낼 생각에 한숨 쉬셨나요? 법적 구제제도가 있어도 낙인찍힐까봐 망설이는 분들을 위해, 완벽한 익명성을 보장하는 플랫폼이 나왔습니다. 고민만 하지 말고 진단받아보세요."}
                {ch.id === 'facebook' && "🚨 금리 동결 소식에도 웃지 못하는 소상공인 여러분! 🚨 더 이상 혼자 앓지 마세요. 스텔스 가명 기술로 내 신분을 철저히 숨기고, 무료로 회생/파산 가능성을 진단받을 수 있습니다."}
                {ch.id === 'tiktok' && "빚독촉 피하는 꿀팁 방출! 내 이름 안 밝히고 변호사한테 회생 파산 진단받는 법. 마이김변 스텔스 모드 키면 끝. 링크에서 바로 확인해봐요!"}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0B0F19] to-transparent"></div>
            </div>
            
            <button className="w-full mt-4 text-sm text-indigo-400 hover:text-indigo-300 font-medium py-2 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-center gap-1 min-h-[44px]">
              콘텐츠 전문 보기 <ChevronRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- TAB 2: Gemini 키 관리 ---
function TabKeyManagement() {
  const [showModal, setShowModal] = useState(false);

  const keys = [
    { id: 1, role: '뉴스분석관 & 검수관', name: 'Account #1', key: 'AIzaSyD...xQ9A', status: 'active', usage: 45, icon: Search },
    { id: 2, role: '블로그 전문 작가', name: 'Account #2', key: 'AIzaSyA...m2P1', status: 'active', usage: 82, icon: FileText },
    { id: 3, role: '숏폼 스크립트 디렉터', name: 'Account #3', key: 'AIzaSyM...k8L0', status: 'rate-limited', usage: 98, icon: Video },
    { id: 4, role: '소셜 스토리텔러', name: 'Account #4', key: 'AIzaSyC...v4N2', status: 'active', usage: 30, icon: MessageCircle },
    { id: 5, role: '비주얼 프롬프트 아티스트', name: 'Account #5', key: 'AIzaSyP...t5X3', status: 'active', usage: 15, icon: ImageIcon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#111622] p-6 rounded-2xl border border-[#1E293B]/60 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-indigo-400" />
            Gemini Pro 멀티-계정 풀 (5-Keys)
          </h2>
          <p className="text-sm text-slate-400 mt-1">API 요금 한도 도달 시 자동으로 다음 키로 페일오버(Failover) 됩니다.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm text-slate-300">오토 페일오버 작동 중</span>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors press-scale flex items-center gap-2 min-h-[44px]"
          >
            <Plus size={16} /> API Key 등록
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {keys.map(k => (
          <div key={k.id} className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
            {k.status === 'rate-limited' && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
            )}
            {k.status === 'active' && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
            )}
            
            <div className="flex justify-between items-start mb-4 mt-1">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                <k.icon size={20} />
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-lg border ${
                k.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {k.status === 'active' ? 'ACTIVE' : 'RATE LIMIT'}
              </span>
            </div>
            
            <h3 className="font-bold text-white text-sm mb-1">{k.role}</h3>
            <p className="text-xs text-slate-400 mb-4">{k.name}</p>
            
            <div className="bg-[#0B0F19] rounded-lg p-2.5 mb-4 border border-slate-800 flex justify-between items-center group/key cursor-pointer">
              <span className="text-xs font-mono text-slate-300">{k.key}</span>
              <Eye size={14} className="text-slate-500 group-hover/key:text-white transition-colors" />
            </div>
            
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">일일 토큰 사용량</span>
                <span className={k.usage > 90 ? 'text-amber-400' : 'text-slate-300'}>{k.usage}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${k.usage > 90 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                  style={{ width: `${k.usage}%` }}
                ></div>
              </div>
            </div>
            
            <button className="w-full py-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors min-h-[44px]">
              연결 테스트
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111622] rounded-3xl border border-[#1E293B] p-6 w-full max-w-md shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">새 Gemini API Key 등록</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">계정 별칭</label>
                <input type="text" className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" placeholder="예: Account #6" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">할당 역할</label>
                <select className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 appearance-none">
                  <option>백업용 예비 풀</option>
                  <option>뉴스분석관</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">API Key</label>
                <input type="password" className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" placeholder="AIzaSy..." />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 min-h-[44px]">취소</button>
              <button 
                onClick={() => {
                  toast.success('API Key가 성공적으로 등록되었습니다.');
                  setShowModal(false);
                }}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 min-h-[44px]"
              >
                저장 및 테스트
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- TAB 3: 콘텐츠 스튜디오 ---
function TabContentStudio() {
  const [topic, setTopic] = useState('가계부채 폭증과 2030 영끌족의 파산 위기');
  const [theme, setTheme] = useState('비대면기술');
  const [genTab, setGenTab] = useState('blog');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Panel - Inputs & Bridge Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <h3 className="text-lg font-bold text-white mb-4">수동 생성 설정</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">타겟 주제 / 뉴스 팩트</label>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">강조 테마 (요일별 추천)</label>
                <select 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 appearance-none"
                >
                  <option value="서류혁신">월 = 서류혁신 (간편 서류 발급)</option>
                  <option value="안심탐색">화 = 안심탐색 (보안 상담)</option>
                  <option value="전문가보증">수 = 전문가보증 (안전 검토)</option>
                  <option value="높은호환성">목 = 높은호환성 (모든 기기 지원)</option>
                  <option value="비대면기술">금 = 비대면기술 (100% 비대면)</option>
                  <option value="면책완주">토 = 면책완주 (끝까지 동행)</option>
                  <option value="주간자가진단">일 = 주간자가진단 (주말 빠른 진단)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Layers size={16} /> 3-Step 연결 브릿지 설계
            </h3>
            
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/50 before:via-slate-700 before:to-slate-800 hidden md:block">
              {/* Stepper hidden on very small screens for simplicity, rendered sequentially instead */}
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">1</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-500 block mb-1">Fact (뉴스)</span>
                  <p className="text-sm text-slate-300">2030세대 영끌족, 금리 인상 여파로 가계부채 한계 봉착</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">2</div>
                <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 flex-1">
                  <span className="text-xs text-slate-500 block mb-1">Dilemma (채무자 딜레마)</span>
                  <p className="text-sm text-slate-300">파산/회생을 알아보고 싶지만, 직장 불이익이나 주변 시선이 두려움</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold shrink-0 z-10 text-indigo-400">3</div>
                <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 flex-1">
                  <span className="text-xs text-indigo-400 block mb-1">Solution (플랫폼 브릿지)</span>
                  <p className="text-sm text-indigo-100">'스텔스 가명' 기술로 철저히 신분을 숨기고 완전 비대면으로 진단 가능함 어필</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => toast.success('6개 채널 콘텐츠 생성을 시작합니다.')}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all press-scale flex items-center justify-center gap-2 shadow-sm min-h-[44px]"
            >
              <UploadCloud size={18} />
              원클릭 6채널 콘텐츠 생성
            </button>
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="lg:col-span-2 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 shadow-sm flex flex-col h-full min-h-[600px]">
          <div className="flex overflow-x-auto space-x-2 mb-4 pb-2 scrollbar-hide border-b border-slate-800">
            {[
              { id: 'blog', label: '블로그' },
              { id: 'shorts', label: '쇼츠 스크립트' },
              { id: 'card', label: '카드뉴스' },
              { id: 'threads', label: '스레드' },
              { id: 'fb', label: '페이스북' },
              { id: 'tiktok', label: '틱톡' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setGenTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap min-h-[44px] transition-colors ${
                  genTab === t.id ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            {genTab === 'blog' && (
              <>
                <input 
                  type="text" 
                  className="w-full bg-[#0B0F19] border border-slate-700 rounded-t-xl px-4 py-3 text-white font-medium focus:outline-none border-b-0"
                  defaultValue="[100% 익명] 2030 영끌족, 빚 독촉 피하고 비대면으로 파산/회생 알아보는 법"
                />
                <textarea 
                  className="w-full flex-1 bg-[#0B0F19] border border-slate-700 rounded-b-xl px-4 py-4 text-slate-300 focus:outline-none resize-none leading-relaxed"
                  defaultValue={`안녕하세요, 최근 금리 인상 여파로 2030세대 영끌족의 고민이 깊어지고 있습니다.\n\n매달 돌아오는 이자 상환일에 가슴 졸이며, 혹시나 직장에 알려질까 전전긍긍하시는 분들이 많습니다. 법적인 구제 제도가 있다는 것은 알지만, 주변의 시선과 낙인 효과가 두려워 상담조차 받지 못하는 것이 현실입니다.\n\n하지만 걱정하지 마세요.\n마이김변 플랫폼에서는 '스텔스 가명' 기술을 도입하여 100% 완전 익명으로 회생/파산 가능성을 진단받을 수 있습니다. 내 진짜 이름이나 연락처를 노출하지 않고도, 전문 변호사의 검토를 받을 수 있는 비대면 기술입니다.\n\n더 이상 혼자 앓지 마시고, 안전한 플랫폼에서 첫 걸음을 떼보세요.`}
                />
              </>
            )}
            {genTab === 'card' && (
              <div className="flex-1 flex items-center justify-center bg-[#0B0F19] border border-slate-700 rounded-xl relative overflow-hidden">
                <div className="text-center">
                  <ImageIcon size={48} className="text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">카드뉴스 이미지 렌더링 프리뷰 영역</p>
                  <button className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm min-h-[44px]">프롬프트 재생성</button>
                </div>
              </div>
            )}
            {(genTab !== 'blog' && genTab !== 'card') && (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                선택한 채널의 에디터가 표시됩니다.
              </div>
            )}
          </div>
          
          <div className="mt-4 flex justify-end gap-3">
            <button className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700 min-h-[44px]">임시저장</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 min-h-[44px] shadow-sm flex items-center gap-2">
              <Share2 size={16} /> 즉시 배포하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- TAB 4: 365일 캘린더 ---
function TabCalendar() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dates = Array.from({ length: 35 }, (_, i) => i - 2); // Simple mock for calendar grid
  
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">이번 달 총 발행</div>
          <div className="text-2xl font-bold text-white">124<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
        </div>
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">성공률</div>
          <div className="text-2xl font-bold text-emerald-400">99.2<span className="text-sm font-normal text-slate-500 ml-1">%</span></div>
        </div>
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">예약된 콘텐츠</div>
          <div className="text-2xl font-bold text-indigo-400">42<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
        </div>
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm">
          <div className="text-slate-400 text-xs mb-1">에러 알림</div>
          <div className="text-2xl font-bold text-slate-300">0<span className="text-sm font-normal text-slate-500 ml-1">건</span></div>
        </div>
      </div>

      <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm">
        {/* Month Nav */}
        <div className="flex items-center justify-between mb-6">
          <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <h3 className="text-xl font-bold text-white">2026년 9월</h3>
          <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800">
          {days.map(d => (
            <div key={d} className="bg-[#111622] py-3 text-center text-xs font-medium text-slate-400">
              {d}
            </div>
          ))}
          {dates.map((d, i) => {
            const isCurrentMonth = d > 0 && d <= 30;
            const isToday = d === 19;
            return (
              <div 
                key={i} 
                className={`bg-[#0B0F19] min-h-[100px] p-2 hover:bg-[#111622] transition-colors cursor-pointer group ${!isCurrentMonth ? 'opacity-30' : ''}`}
              >
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-2 
                  ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400 group-hover:text-white'}`}
                >
                  {d > 0 ? (d > 30 ? d - 30 : d) : 31 + d}
                </div>
                
                {isCurrentMonth && (d % 3 !== 0) && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {/* Mock status dots */}
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : d === 19 ? 'bg-indigo-500' : 'bg-slate-600'}`} title="블로그"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : d === 19 ? 'bg-amber-500' : 'bg-slate-600'}`} title="쇼츠"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : d === 19 ? 'bg-slate-600' : 'bg-slate-600'}`} title="카드뉴스"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : 'bg-slate-600'}`} title="스레드"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : 'bg-slate-600'}`} title="페이스북"></div>
                    <div className={`w-2 h-2 rounded-full ${d < 19 ? 'bg-emerald-500' : 'bg-slate-600'}`} title="틱톡"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 flex gap-4 text-xs text-slate-400 justify-end">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> 발행 완료</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> 예약됨</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> 진행중</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-600"></div> 미정</div>
        </div>
      </div>
    </div>
  );
}

// --- TAB 5: 성과 분석 ---
function TabAnalytics() {
  const channelStats = [
    { name: '네이버 블로그', total: 342, growth: '+12%', icon: FileText, color: 'text-emerald-400' },
    { name: '유튜브 쇼츠', total: 128, growth: '+24%', icon: Video, color: 'text-red-400' },
    { name: '인스타 카드뉴스', total: 256, growth: '+8%', icon: ImageIcon, color: 'text-pink-400' },
    { name: '스레드', total: 184, growth: '+45%', icon: MessageCircle, color: 'text-white' },
    { name: '페이스북', total: 420, growth: '+2%', icon: Facebook, color: 'text-blue-400' },
    { name: '틱톡', total: 95, growth: '+88%', icon: Smartphone, color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {channelStats.map((stat, i) => (
          <div key={i} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 shadow-sm flex flex-col justify-between h-32 hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-start">
              <stat.icon size={20} className={stat.color} />
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">{stat.growth}</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white mb-0.5">{stat.total}</div>
              <div className="text-xs text-slate-400">{stat.name} 누적 발행</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-2 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm min-h-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-white">월간 발행 및 트래픽 유입 추이</h3>
            <select className="bg-[#0B0F19] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
              <option>최근 6개월</option>
              <option>최근 1년</option>
            </select>
          </div>
          <div className="flex-1 flex items-center justify-center border border-dashed border-slate-700/50 rounded-xl bg-[#0B0F19]/50">
            <div className="text-center text-slate-500">
              <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">차트 렌더링 영역 (Recharts 등 활용)</p>
            </div>
          </div>
        </div>

        {/* Top Content */}
        <div className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 shadow-sm">
          <h3 className="font-bold text-white mb-4">이번 주 Top 성과 콘텐츠</h3>
          <div className="space-y-4">
            {[
              { title: '"이자 갚다 지쳤다면 필수 시청"', type: '유튜브 쇼츠', views: '12.4k', conversions: 42 },
              { title: '2030 영끌족 파산 진단 가이드', type: '네이버 블로그', views: '8.2k', conversions: 28 },
              { title: '스텔스 가명으로 알아보는 내 빚', type: '틱톡', views: '24k', conversions: 19 },
              { title: '법원 서류, 비대면으로 끝내는 법', type: '인스타 카드뉴스', views: '5.1k', conversions: 15 },
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 bg-[#0B0F19] rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{item.type}</span>
                  <span className="text-xs font-bold text-emerald-400">{item.conversions}건 전환</span>
                </div>
                <div className="text-sm font-medium text-slate-200 line-clamp-1">{item.title}</div>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span className="flex items-center gap-1"><Eye size={12} /> {item.views}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
