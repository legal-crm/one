import React, { useState, useEffect } from 'react';
import { 
  mockLawyers, 
  initialConsultRequests, 
  initialConsultMessages, 
  initialCases 
} from './data';
import { ConsultRequest, ConsultMessage, Case, User as LawyerType } from './types';
import ClientRole from './components/ClientRole';
import LawyerRole from './components/LawyerRole';
import { ShieldCheck, Info, Sparkles, Scale, RefreshCw } from 'lucide-react';

export default function App() {
  // Dual role toggle state: 'client' or 'lawyer'
  const [currentRole, setCurrentRole] = useState<'client' | 'lawyer'>('client');

  // Core application states
  const [requests, setRequests] = useState<ConsultRequest[]>([]);
  const [messages, setMessages] = useState<ConsultMessage[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [lawyers] = useState<LawyerType[]>(mockLawyers);

  // Load state from localStorage on startup or fallback to initial mock data.
  useEffect(() => {
    const savedRequests = localStorage.getItem('legal_crm_requests');
    const savedMessages = localStorage.getItem('legal_crm_messages');
    const savedCases = localStorage.getItem('legal_crm_cases');

    if (savedRequests) {
      setRequests(JSON.parse(savedRequests));
    } else {
      setRequests(initialConsultRequests);
    }

    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      setMessages(initialConsultMessages);
    }

    if (savedCases) {
      setCases(JSON.parse(savedCases));
    } else {
      setCases(initialCases);
    }
  }, []);

  // Sync state to localStorage whenever it updates
  useEffect(() => {
    if (requests.length > 0) {
      localStorage.setItem('legal_crm_requests', JSON.stringify(requests));
    }
  }, [requests]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('legal_crm_messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (cases.length > 0) {
      localStorage.setItem('legal_crm_cases', JSON.stringify(cases));
    }
  }, [cases]);

  // Method to add customized chat messages
  const handleAddMessage = (
    reqId: string, 
    text: string, 
    sender: 'client' | 'lawyer', 
    senderId: string, 
    name: string
  ) => {
    const newMessage: ConsultMessage = {
      id: `msg-${Date.now()}`,
      consultRequestId: reqId,
      senderType: sender,
      senderId,
      senderName: name,
      message: text,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);

    // Update the corresponding request status to active 'counseling' if it was just 'requested' or 'responding'
    setRequests(prev => prev.map(req => {
      if (req.id === reqId && req.status === 'requested') {
        return { ...req, status: 'counseling' };
      }
      return req;
    }));
  };

  // Reset entire database to default mock
  const handleResetData = () => {
    if (confirm('모든 입력 데이터를 기동 초기값으로 리셋하시겠습니까?')) {
      localStorage.removeItem('legal_crm_requests');
      localStorage.removeItem('legal_crm_messages');
      localStorage.removeItem('legal_crm_cases');
      setRequests(initialConsultRequests);
      setMessages(initialConsultMessages);
      setCases(initialCases);
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Universal Demo controller bar (Sticky / Fixed at top) */}
      <div className="bg-slate-950 text-white py-2 px-4 border-b border-slate-800 text-xs flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg z-50">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-amber-400">
            <Scale className="w-4 h-4" />
            <span>Legal Platform Demo 가상 컨트롤러</span>
          </span>
          <span className="text-slate-500 hidden md:inline">|</span>
          <p className="text-slate-400 text-[11px] hidden lg:inline">
            본 데모는 <strong>동일 웹브라우저 로컬 데이터(localStorage)를 동기화</strong>하므로 의뢰인 모드에서 등록한 채무 정보와 상담이 변호사 CRM 모드에 실시간 반영됩니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Reset button */}
          <button 
            onClick={handleResetData}
            title="초기 템플릿 데이터로 리셋"
            className="p-1 px-2.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-semibold text-[11px] transition-colors border border-slate-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>데이터 초기화</span>
          </button>

          {/* Role selector switches */}
          <div className="bg-slate-900 rounded-lg p-1 border border-slate-800 flex gap-1">
            <button 
              onClick={() => setCurrentRole('client')}
              className={`p-1 px-3 rounded-md transition-all font-bold text-[11px] flex items-center gap-1 ${
                currentRole === 'client' 
                ? 'bg-blue-600 text-white shadow' 
                : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300"></span>
              <span>1. 의뢰인 모드(개인회생 신청)</span>
            </button>
            <button 
              onClick={() => setCurrentRole('lawyer')}
              className={`p-1 px-3 rounded-md transition-all font-bold text-[11px] flex items-center gap-1 ${
                currentRole === 'lawyer' 
                ? 'bg-amber-500 text-slate-950 shadow' 
                : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-950"></span>
              <span>2. 변호사/직원 모드(SaaS CRM)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role View Render */}
      <div className="flex-1">
        {currentRole === 'client' ? (
          <ClientRole 
            requests={requests}
            setRequests={setRequests}
            messages={messages}
            setMessages={setMessages}
            lawyers={lawyers}
            onAddMessage={handleAddMessage}
          />
        ) : (
          <LawyerRole 
            requests={requests}
            setRequests={setRequests}
            messages={messages}
            setMessages={setMessages}
            lawyers={lawyers}
            onAddMessage={handleAddMessage}
            cases={cases}
            setCases={setCases}
          />
        )}
      </div>

    </div>
  );
}
