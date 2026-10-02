import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, X, Hash } from 'lucide-react';
import { ConsultRequest } from '../../types';
import ModalPortal from '../common/ModalPortal';
import { loadCrmExtMap } from '../../services/crmService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 이 계정이 볼 수 있는 요청만 전달 (본인 담당 + 매칭 대기 오픈 요청) */
  requests: ConsultRequest[];
  /** 계약 전 실명·연락처 마스킹 규칙이 적용된 표시값 */
  getDisplayName: (req: ConsultRequest) => string;
  getDisplayPhone: (req: ConsultRequest) => string;
  onNavigate: (tab: string, id?: string) => void;
}

const MAX_RESULTS = 30;

/** 대소문자·공백·하이픈 무시 비교용 정규화 */
function normalize(v: string | undefined | null): string {
  return (v || '').toLowerCase().replace(/[\s-]/g, '');
}

interface SearchHit {
  req: ConsultRequest;
  name: string;
  phone: string;
  caseNumber?: string;
  matchedOn: string;
}

export default function GlobalSearchPalette({ isOpen, onClose, requests, getDisplayName, getDisplayPhone, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 사건번호 검색용 CRM 확장 데이터 (열릴 때 1회 로드)
  const extMap = useMemo(() => (isOpen ? loadCrmExtMap() : {}), [isOpen]);

  const hits: SearchHit[] = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const out: SearchHit[] = [];
    for (const req of requests) {
      // 검색 대상은 화면에 보여줄 수 있는 값(마스킹 적용)만 — 미공개 실명·번호로 역추적 불가
      const name = getDisplayName(req);
      const phone = getDisplayPhone(req);
      const caseNumber = (extMap as any)[req.id]?.courtCase?.caseNumber as string | undefined;
      let matchedOn = '';
      if (normalize(name).includes(q)) matchedOn = '이름';
      else if (!phone.includes('*') && normalize(phone).includes(q)) matchedOn = '연락처';
      else if (caseNumber && normalize(caseNumber).includes(q)) matchedOn = '사건번호';
      else if (normalize(req.title).includes(q)) matchedOn = '상담 제목';
      if (matchedOn) out.push({ req, name, phone, caseNumber, matchedOn });
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  }, [query, requests, getDisplayName, getDisplayPhone, extMap]);

  const total = hits.length;

  const openHit = (hit: SearchHit) => {
    onNavigate('client-crm', hit.req.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (total === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[Math.min(selectedIndex, total - 1)];
      if (hit) openHit(hit);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 pt-[15vh] backdrop-blur-sm px-4" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="의뢰인 통합 검색"
          className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[calc(100vh-18vh)] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center border-b border-gray-200 px-4 py-3">
            <Search className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="의뢰인 이름·연락처·사건번호·상담 제목 검색"
              aria-label="검색어"
              role="combobox"
              aria-expanded={total > 0}
              aria-controls="global-search-results"
              aria-activedescendant={total > 0 ? `gs-hit-${selectedIndex}` : undefined}
              className="flex-1 bg-transparent text-lg outline-none placeholder:text-gray-400"
            />
            <button onClick={onClose} aria-label="검색 닫기" className="rounded-xl p-1 hover:bg-gray-100 cursor-pointer">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div id="global-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
            {query.trim() === '' ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                검색어를 입력하세요
                <p className="text-xs text-gray-400 mt-1">계약 전 의뢰인은 공개된 가명·마스킹 정보로만 검색됩니다.</p>
              </div>
            ) : total === 0 ? (
              <div className="p-8 text-center text-gray-500">검색 결과가 없습니다</div>
            ) : (
              <>
                <div className="px-3 py-1 text-xs font-semibold text-gray-500">의뢰인 {total >= MAX_RESULTS ? `(상위 ${MAX_RESULTS}건)` : ''}</div>
                {hits.map((hit, idx) => (
                  <button
                    type="button"
                    key={hit.req.id}
                    id={`gs-hit-${idx}`}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    className={`w-full text-left flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 ${
                      idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => openHit(hit)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="flex items-center min-w-0">
                      <User className="mr-3 h-5 w-5 text-gray-400 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{hit.name}</div>
                        <div className="text-sm text-gray-500 truncate">
                          {hit.phone}
                          {hit.caseNumber && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-gray-400">
                              <Hash className="w-3 h-3" aria-hidden="true" />{hit.caseNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{hit.matchedOn}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
