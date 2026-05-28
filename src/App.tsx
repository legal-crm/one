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
import AdminRole from './components/AdminRole';
import { ShieldCheck, Info, Sparkles, Scale, RefreshCw } from 'lucide-react';

export default function App() {
  // Triple role state: 'client' | 'lawyer' | 'admin'
  const [currentRole, setCurrentRole] = useState<'client' | 'lawyer' | 'admin'>('client');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'admin') {
      setCurrentRole('admin');
    } else if (roleParam === 'lawyer') {
      setCurrentRole('lawyer');
    }
  }, []);

  // Core application states
  const [requests, setRequests] = useState<ConsultRequest[]>([]);
  const [messages, setMessages] = useState<ConsultMessage[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [lawyers, setLawyers] = useState<LawyerType[]>([]);

  // Load state from localStorage on startup or fallback to initial mock data.
  useEffect(() => {
    const savedRequests = localStorage.getItem('legal_crm_requests');
    const savedMessages = localStorage.getItem('legal_crm_messages');
    const savedCases = localStorage.getItem('legal_crm_cases');
    const savedLawyers = localStorage.getItem('legal_crm_lawyers');

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

    if (savedLawyers) {
      setLawyers(JSON.parse(savedLawyers));
    } else {
      // Set initial passwords to '1234' for easy mockup login
      const lawyersWithPass = mockLawyers.map(l => ({ ...l, password: '1234' }));
      setLawyers(lawyersWithPass);
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

  useEffect(() => {
    if (lawyers.length > 0) {
      localStorage.setItem('legal_crm_lawyers', JSON.stringify(lawyers));
    }
  }, [lawyers]);

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
        ) : currentRole === 'lawyer' ? (
          <LawyerRole 
            requests={requests}
            setRequests={setRequests}
            messages={messages}
            setMessages={setMessages}
            lawyers={lawyers}
            setLawyers={setLawyers}
            onAddMessage={handleAddMessage}
            cases={cases}
            setCases={setCases}
          />
        ) : (
          <AdminRole 
            requests={requests}
            setRequests={setRequests}
            lawyers={lawyers}
            setLawyers={setLawyers}
          />
        )}
      </div>

      {/* Developer Role Switcher Floating Panel */}
      <div className="fixed bottom-4 right-4 z-50 bg-slate-950/85 backdrop-blur border border-[#1F2937]/80 rounded-[200px] p-1.5 flex gap-1 shadow-2xl">
        <button 
          onClick={() => {
            setCurrentRole('client');
            window.history.replaceState({}, '', '?role=client');
          }}
          className={`px-3 py-1 text-[10px] font-extrabold rounded-[200px] transition-colors ${
            currentRole === 'client' ? 'bg-[#7264FF] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          의뢰인 뷰
        </button>
        <button 
          onClick={() => {
            setCurrentRole('lawyer');
            window.history.replaceState({}, '', '?role=lawyer');
          }}
          className={`px-3 py-1 text-[10px] font-extrabold rounded-[200px] transition-colors ${
            currentRole === 'lawyer' ? 'bg-[#7264FF] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          변호사 CRM 뷰
        </button>
        <button 
          onClick={() => {
            setCurrentRole('admin');
            window.history.replaceState({}, '', '?role=admin');
          }}
          className={`px-3 py-1 text-[10px] font-extrabold rounded-[200px] transition-colors ${
            currentRole === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          통합 어드민 뷰
        </button>
      </div>

    </div>
  );
}
