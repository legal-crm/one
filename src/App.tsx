import React, { useState, useEffect } from 'react';
import { 
  mockLawyers, 
  initialConsultRequests, 
  initialConsultMessages, 
  initialCases,
  mockNewsArticles,
  initialQAs,
  initialReviews,
  initialBanners
} from './data';
import { ConsultRequest, ConsultMessage, Case, User as LawyerType, NewsArticle, ClientQA, SuccessReview, MainBanner } from './types';
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
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>(() => {
    const savedNews = localStorage.getItem('legal_crm_news');
    return savedNews ? JSON.parse(savedNews) : mockNewsArticles;
  });

  const [qas, setQas] = useState<ClientQA[]>(() => {
    const saved = localStorage.getItem('legal_crm_qas');
    return saved ? JSON.parse(saved) : initialQAs;
  });

  const [reviews, setReviews] = useState<SuccessReview[]>(() => {
    const saved = localStorage.getItem('legal_crm_reviews');
    return saved ? JSON.parse(saved) : initialReviews;
  });

  const [banners, setBanners] = useState<MainBanner[]>(() => {
    const saved = localStorage.getItem('legal_crm_banners');
    return saved ? JSON.parse(saved) : initialBanners;
  });

  // Sync states to localStorage
  useEffect(() => {
    localStorage.setItem('legal_crm_news', JSON.stringify(newsArticles));
  }, [newsArticles]);

  useEffect(() => {
    localStorage.setItem('legal_crm_qas', JSON.stringify(qas));
  }, [qas]);

  useEffect(() => {
    localStorage.setItem('legal_crm_reviews', JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    localStorage.setItem('legal_crm_banners', JSON.stringify(banners));
  }, [banners]);

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

    if (savedLawyers && JSON.parse(savedLawyers).length >= mockLawyers.length) {
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
      localStorage.removeItem('legal_crm_lawyers');
      localStorage.removeItem('legal_crm_news');
      localStorage.removeItem('legal_crm_qas');
      localStorage.removeItem('legal_crm_reviews');
      localStorage.removeItem('legal_crm_banners');
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
            newsArticles={newsArticles}
            setNewsArticles={setNewsArticles}
            qas={qas}
            setQas={setQas}
            reviews={reviews}
            setReviews={setReviews}
            banners={banners}
            setBanners={setBanners}
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
            newsArticles={newsArticles}
            setNewsArticles={setNewsArticles}
            qas={qas}
            setQas={setQas}
            reviews={reviews}
            setReviews={setReviews}
            banners={banners}
            setBanners={setBanners}
          />
        )}
      </div>



    </div>
  );
}
