import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Scale, X } from 'lucide-react';
import { ConsultRequest, User as UserType } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requests: ConsultRequest[];
  lawyers: UserType[];
  onNavigate: (tab: string, id?: string) => void;
}

export default function GlobalSearchPalette({ isOpen, onClose, requests, lawyers, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const filteredRequests = requests.filter(r => 
    r.clientName.includes(query) || 
    r.phone.includes(query) || 
    r.title.includes(query) || 
    r.content.includes(query)
  );

  const filteredLawyers = lawyers.filter(l => 
    l.name.includes(query)
  );

  const totalResults = query.trim() === '' ? 0 : filteredRequests.length + filteredLawyers.length;
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalResults);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalResults) % totalResults);
    } else if (e.key === 'Enter' && totalResults > 0) {
      e.preventDefault();
      if (selectedIndex < filteredRequests.length) {
        onNavigate('client-crm', filteredRequests[selectedIndex].id);
      } else {
        onNavigate('settings');
      }
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 pt-[20vh] backdrop-blur-sm px-4" onClick={onClose}>
      <div 
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-gray-200 px-4 py-3">
          <Search className="mr-3 h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="의뢰인 이름, 연락처, 내용 등 검색..."
            className="flex-1 bg-transparent text-lg outline-none placeholder:text-gray-400"
          />
          <button onClick={onClose} className="rounded-xl p-1 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="p-8 text-center text-gray-500">
              검색어를 입력하세요
            </div>
          ) : totalResults === 0 ? (
            <div className="p-8 text-center text-gray-500">
              검색 결과가 없습니다
            </div>
          ) : (
            <>
              {filteredRequests.length > 0 && (
                <div className="mb-4">
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500">의뢰인</div>
                  {filteredRequests.map((req, idx) => (
                    <div
                      key={req.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 ${
                        idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        onNavigate('client-crm', req.id);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="flex items-center">
                        <User className="mr-3 h-5 w-5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">{req.clientName}</div>
                          <div className="text-sm text-gray-500">{req.phone}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredLawyers.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500">변호사</div>
                  {filteredLawyers.map((lawyer, idx) => {
                    const globalIdx = filteredRequests.length + idx;
                    return (
                      <div
                        key={lawyer.id}
                        className={`flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 ${
                          globalIdx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          onNavigate('settings');
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <div className="flex items-center">
                          <Scale className="mr-3 h-5 w-5 text-gray-400" />
                          <div>
                            <div className="font-medium text-gray-900">{lawyer.name}</div>
                            <div className="text-sm text-gray-500">{lawyer.email || '소속 변호사'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
