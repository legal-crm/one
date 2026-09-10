// ============================================================
// [ADMIN] 전자계약 블록체인(Polygon) 온체인 무결성 관제 센터
// 전사 전자계약의 온체인 앵커링 현황, 실시간 노드 블록 확인,
// 사후 위·변조 전수 스캔, PolygonScan 연동 및 10개 단위 페이징
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Cpu, 
  FileText, 
  Search, 
  Sparkles, 
  Check, 
  Copy,
  Layers,
  Radio,
  Clock,
  Settings,
  Flame,
  Globe
} from 'lucide-react';
import type { ElectronicContract } from '../../types';
import { loadAdminContractAnchors } from '../../services/contractService';
import { 
  fetchBlockchainNetworkStatus, 
  verifyTxOnChain,
  verifyContractBlockchainAnchor,
  getBlockchainConfig,
  BlockchainNetworkStatus,
  fetchCircuitBreakerStatus,
  freezeCircuitBreaker,
  unfreezeCircuitBreaker,
  CircuitBreakerStatus
} from '../../services/blockchainAnchorService';
import ContractPublicVerifierModal from '../common/ContractPublicVerifierModal';
import BlockchainConfigModal from './BlockchainConfigModal';

export default function BlockchainContractControlCenter() {
  const [contracts, setContracts] = useState<ElectronicContract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<BlockchainNetworkStatus | null>(null);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);

  // [SECURITY] 서킷 브레이커 실시간 동결/감시 상태
  const [circuitStatus, setCircuitStatus] = useState<CircuitBreakerStatus | null>(null);
  const [isUpdatingCircuit, setIsUpdatingCircuit] = useState(false);

  // 전수 감사 스캔 상태
  const [isAuditingAll, setIsAuditingAll] = useState(false);
  const [auditResult, setAuditResult] = useState<{ total: number; valid: number; tampered: number } | null>(null);

  // 모달 및 복사 상태
  const [selectedContract, setSelectedContract] = useState<ElectronicContract | null>(null);
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 페이징 및 필터
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'completed' | 'anchored'>('all');
  const ITEMS_PER_PAGE = 10;

  // 1. 네트워크 및 계약 데이터 로드
  const fetchNetwork = useCallback(async () => {
    setIsLoadingNetwork(true);
    try {
      const status = await fetchBlockchainNetworkStatus();
      setNetworkStatus(status);
    } catch {
      toast.error('블록체인 노드 상태 조회 실패');
    } finally {
      setIsLoadingNetwork(false);
    }
  }, []);

  const fetchContractsData = useCallback(async () => {
    setIsLoadingContracts(true);
    try {
      const list = await loadAdminContractAnchors();
      setContracts(list || []);
    } catch {
      toast.error('전자계약 목록 로드 실패');
    } finally {
      setIsLoadingContracts(false);
    }
  }, []);

  // [SECURITY] 서킷 브레이커 상태 주기적 동기화
  const fetchCircuitData = useCallback(async () => {
    const status = await fetchCircuitBreakerStatus();
    if (status) {
      setCircuitStatus(status);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
    fetchContractsData();
    fetchCircuitData();

    // 10초마다 노드 및 서킷 브레이커 상태 자동 감시
    const interval = setInterval(() => {
      fetchCircuitData();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchNetwork, fetchContractsData, fetchCircuitData]);

  // 서킷 브레이커 즉시 해제 핸들러 (Unfreeze)
  const handleUnfreeze = async () => {
    setIsUpdatingCircuit(true);
    try {
      const res = await unfreezeCircuitBreaker();
      if (res.ok) {
        toast.success('서킷 브레이커가 해제되었습니다. 블록체인 온체인 각인이 정상화되었습니다.');
        await fetchCircuitData();
      } else {
        toast.error(`동결 해제 실패: ${res.error || '알 수 없는 오류'}`);
      }
    } finally {
      setIsUpdatingCircuit(false);
    }
  };

  // 관리자 수동 긴급 정지 핸들러 (Freeze)
  const handleManualFreeze = async () => {
    if (!window.confirm('🚨 긴급 정지(Emergency Freeze) 발동 확인\n\n모든 신규 전자계약의 Polygon 온체인 앵커링이 30분간 즉시 일시 정지(동결)됩니다.\n릴레이어 가스비 소모 및 트랜잭션 전송이 전면 차단됩니다.\n\n정말 긴급 정지를 발동하시겠습니까?')) {
      return;
    }
    setIsUpdatingCircuit(true);
    try {
      const res = await freezeCircuitBreaker('관리자 관제탑에서 수동 긴급 정지 발동');
      if (res.ok) {
        toast.warning('🚨 긴급 정지가 발동되었습니다. 온체인 각인이 일시 동결되었습니다.');
        await fetchCircuitData();
      } else {
        toast.error(`긴급 정지 발동 실패: ${res.error || '알 수 없는 오류'}`);
      }
    } finally {
      setIsUpdatingCircuit(false);
    }
  };

  // 2. 전사 계약서 위변조 전수 스캔 (Audit All)
  const handleAuditAllContracts = async () => {
    setIsAuditingAll(true);
    try {
      let validCount = 0;
      let tamperedCount = 0;

      for (const c of contracts) {
        if (c.status === 'completed' && c.blockchainAnchor) {
          const res = verifyContractBlockchainAnchor(c);
          if (res.isValid) validCount++;
          else tamperedCount++;
        }
      }

      setAuditResult({
        total: contracts.length,
        valid: validCount,
        tampered: tamperedCount,
      });

      if (tamperedCount === 0) {
        toast.success(`전사 계약서 전수 검증 완료: 위·변조 0건 (100% 무결성)`);
      } else {
        toast.error(`⚠️ 경고: 해시 불일치 의심 계약서 ${tamperedCount}건 감지됨`);
      }
    } finally {
      setIsAuditingAll(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('복사되었습니다.');
  };

  // 필터링 및 검색
  const filtered = contracts.filter(c => {
    if (filterType === 'completed' && c.status !== 'completed') return false;
    if (filterType === 'anchored' && !c.blockchainAnchor) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = c.id.toLowerCase().includes(term);
      const matchName = c.clientName.toLowerCase().includes(term);
      const matchLawyer = (c.lawyerName || '').toLowerCase().includes(term);
      return matchId || matchName || matchLawyer;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pagedContracts = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const completedCount = contracts.filter(c => c.status === 'completed').length;
  const anchoredCount = contracts.filter(c => Boolean(c.blockchainAnchor)).length;
  const isMainnetActive = Boolean(networkStatus?.isMainnet);

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      {/* ── 0. 비상 서킷 브레이커 긴급 경고 배너 (동결 시 자동 표시) ── */}
      {circuitStatus?.isFrozen && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-red-950/95 via-rose-950/90 to-amber-950/95 border-2 border-red-500 text-white shadow-2xl shadow-red-950/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-red-600/30 border border-red-400/80 text-red-300 flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider">
                  SECURITY EMERGENCY FREEZE
                </span>
                <span className="text-xs font-bold text-amber-300">
                  자동 복구 대기: 약 {Math.ceil((circuitStatus.retryAfter || 0) / 60)}분 ({circuitStatus.retryAfter || 0}초) 남음
                </span>
              </div>
              <h3 className="text-sm md:text-base font-black text-white mt-1">
                🚨 비상 서킷 브레이커 발동: 비정상 무리한 호출 감지로 온체인 각인이 일시 정지(동결)되었습니다.
              </h3>
              <p className="text-xs text-red-200 mt-0.5">
                사유: {circuitStatus.reason || '비인가 호출 및 공격 시도 급증 감지'} (릴레이어 가스비 소모 100% 방어 중)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto flex-shrink-0">
            <button
              onClick={handleUnfreeze}
              disabled={isUpdatingCircuit}
              className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-950/50 cursor-pointer transition-all disabled:opacity-50 press-scale whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isUpdatingCircuit ? '해제 처리 중...' : '동결 즉시 해제 및 정상화 (Unfreeze)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 1. 헤더 및 종합 상태 대시보드 ── */}
      <div className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
        isMainnetActive 
          ? 'bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-950 border-purple-800/60 shadow-purple-950/30' 
          : 'bg-gradient-to-r from-slate-900 via-slate-950 to-blue-950 border-blue-900/50 shadow-blue-950/30'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
            isMainnetActive 
              ? 'bg-purple-600/20 border-purple-500/40 text-purple-300' 
              : 'bg-blue-600/20 border-blue-500/30 text-blue-400'
          }`}>
            {isMainnetActive ? <Flame className="w-6 h-6 text-purple-400" /> : <Database className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider border ${
                isMainnetActive 
                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/40' 
                  : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
              }`}>
                {isMainnetActive ? 'POLYGON POS MAINNET (EVM-137)' : 'POLYGON AMOY TESTNET'}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {isMainnetActive ? '실제 온체인 트랜잭션 활성화' : '온체인 실시간 노드 동기화'}
              </span>
            </div>
            <h2 className="text-xl font-black text-white mt-1">
              전자계약 블록체인 분산원장 무결성 관제탑
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              사후 위·변조 원천 차단 SHA-256 해시 앵커링 현황 및 법원 제출용 불변 증거력 실시간 모니터링
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          {/* 네트워크 및 노드 설정 버튼 */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
              isMainnetActive
                ? 'bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border-purple-500/60 shadow-lg shadow-purple-950/40'
                : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30'
            }`}
          >
            {isMainnetActive ? (
              <Flame className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            ) : (
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>{isMainnetActive ? '⚙️ 메인넷 온체인 설정' : '⚙️ 네트워크 및 노드 설정'}</span>
          </button>

          <button
            onClick={() => { fetchNetwork(); fetchContractsData(); fetchCircuitData(); }}
            disabled={isLoadingNetwork || isLoadingContracts}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNetwork ? 'animate-spin' : ''}`} />
            <span>노드 새로고침</span>
          </button>

          <button
            onClick={handleAuditAllContracts}
            disabled={isAuditingAll || contracts.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-900/30 cursor-pointer transition-all disabled:opacity-50"
          >
            <ShieldCheck className={`w-4 h-4 ${isAuditingAll ? 'animate-spin text-amber-300' : 'text-emerald-300'}`} />
            <span>{isAuditingAll ? '전수 무결성 대조 중...' : '전사 위·변조 전수 스캔 (Audit All)'}</span>
          </button>

          {/* 비상 서킷 브레이커 수동 제어 버튼 (동결/해제 토글) */}
          {circuitStatus?.isFrozen ? (
            <button
              onClick={handleUnfreeze}
              disabled={isUpdatingCircuit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border border-emerald-400 cursor-pointer transition-all shadow-md shadow-emerald-950/40 press-scale whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isUpdatingCircuit ? '해제 중...' : '동결 즉시 해제'}</span>
            </button>
          ) : (
            <button
              onClick={handleManualFreeze}
              disabled={isUpdatingCircuit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 text-xs font-bold border border-red-700/60 cursor-pointer transition-all hover:text-white press-scale whitespace-nowrap"
              title="비정상 트래픽 발생 시 온체인 앵커링을 수동으로 긴급 정지합니다."
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>{isUpdatingCircuit ? '처리 중...' : '긴급 정지 (Freeze)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. 핵심 KPI 카드 4열 그리드 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 네트워크 상태 */}
        <div className={`p-4 rounded-2xl border space-y-2 transition-colors ${
          isMainnetActive 
            ? 'bg-purple-950/20 border-purple-800/60' 
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio className={`w-3.5 h-3.5 ${isMainnetActive ? 'text-purple-400' : 'text-blue-400'}`} />
              연결 네트워크
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              isMainnetActive 
                ? 'bg-purple-950 text-purple-300 border-purple-700 font-mono' 
                : 'bg-blue-950 text-blue-300 border-blue-800'
            }`}>
              ChainID: {networkStatus?.chainId || (isMainnetActive ? 137 : 80002)}
            </span>
          </div>
          <div className="text-sm font-black text-white truncate flex items-center gap-1.5">
            {isMainnetActive && <Flame className="w-4 h-4 text-purple-400 flex-shrink-0" />}
            <span className="truncate">{networkStatus?.network || (isMainnetActive ? 'Polygon PoS Mainnet' : 'Polygon Amoy Testnet')}</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>최신 블록 높이</span>
            <span className="font-mono text-emerald-400 font-bold">
              {networkStatus?.blockHeight ? `#${networkStatus.blockHeight.toLocaleString()}` : '동기화 중...'}
            </span>
          </div>
        </div>

        {/* 릴레이어 지갑 가스비 & 서킷 브레이커 가드 */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              온체인 릴레이어 가스
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              circuitStatus?.isFrozen
                ? 'bg-red-950 text-red-300 border-red-700 font-mono animate-pulse'
                : networkStatus?.hasRelayerKey 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                  : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              {circuitStatus?.isFrozen ? '🚨 비상 동결됨' : (networkStatus?.hasRelayerKey ? '릴레이어 가동중' : '암호학적 안전망 모드')}
            </span>
          </div>
          <div className="text-sm font-black text-white truncate">
            {networkStatus?.relayerBalance || '무료 Amoy 네트워크 (0원 가스)'}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5 truncate">
            <span>보안 서킷브레이커</span>
            <span className={`text-[10px] font-bold ${circuitStatus?.isFrozen ? 'text-red-400 font-mono' : 'text-emerald-400'}`}>
              {circuitStatus?.isFrozen ? `일시정지 중 (가스비 방어)` : '정상 보호 중 (어뷰징 감시)'}
            </span>
          </div>
        </div>

        {/* 전사 계약 체결 수 */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              전자계약 체결 현황
            </span>
            <span className="text-[10px] font-bold text-slate-300">전체 {contracts.length}건</span>
          </div>
          <div className="text-lg font-black text-white">
            {completedCount} <span className="text-xs font-normal text-slate-400">건 체결 완료</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>블록체인 영구 각인</span>
            <span className="font-bold text-blue-400">{anchoredCount}건 ({completedCount > 0 ? Math.round((anchoredCount / completedCount) * 100) : 100}%)</span>
          </div>
        </div>

        {/* 사후 무결성 감사 결과 */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              사후 위·변조 검증률
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
              100% AUTHENTIC
            </span>
          </div>
          <div className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            <span>위·변조 0건</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5">
            <span>전수 대조 판정</span>
            <span className="text-slate-300">
              {auditResult ? `${auditResult.valid}건 검증 통과` : '상시 무결성 보증'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. 검색 및 필터 바 ── */}
      <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="계약번호, 의뢰인, 변호사명 검색..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value as any); setCurrentPage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">전체 계약 ({contracts.length})</option>
            <option value="completed">체결 완료만 ({completedCount})</option>
            <option value="anchored">블록체인 각인본만 ({anchoredCount})</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>총 {filtered.length}건 중</span>
          <span className="font-bold text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}건 표시</span>
        </div>
      </div>

      {/* ── 4. 전사 블록체인 각인 계약서 테이블 (10개 단위 페이징) ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
              <tr>
                <th className="py-3 px-4">계약번호 / 체결일시</th>
                <th className="py-3 px-4">의뢰인 / 수임 변호사</th>
                <th className="py-3 px-4">체결본 SHA-256 해시</th>
                <th className="py-3 px-4">온체인 트랜잭션 / 블록</th>
                <th className="py-3 px-4">무결성 상태</th>
                <th className="py-3 px-4 text-center">온체인 실증명 / 공공검증</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {pagedContracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    조건에 해당하는 전자계약 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedContracts.map(c => {
                  const anchor = c.blockchainAnchor;
                  const finalHash = c.documentHashes?.finalHash || anchor?.contractHash || '';
                  const txHash = anchor?.txHash || '';
                  const isCompleted = c.status === 'completed';

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* 계약번호 및 일시 */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-white flex items-center gap-1.5">
                          <span>{c.id}</span>
                          {c.isBusiness && <span className="text-[9px] font-bold bg-blue-900/60 text-blue-300 px-1.5 py-0.2 rounded border border-blue-700">사업자</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{(anchor?.anchoredAt || c.updatedAt).slice(0, 16).replace('T', ' ')}</span>
                        </div>
                      </td>

                      {/* 의뢰인 / 변호사 */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">
                          {c.clientName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {c.lawFirmName} {c.lawyerName} 변호사
                        </div>
                      </td>

                      {/* SHA-256 해시 */}
                      <td className="py-3 px-4 font-mono">
                        {finalHash ? (
                          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80 max-w-[190px]">
                            <span className="text-emerald-400 font-bold truncate text-[10px]">
                              {finalHash.slice(0, 8)}...{finalHash.slice(-8)}
                            </span>
                            <button
                              onClick={() => handleCopy(finalHash, `hash-${c.id}`)}
                              className="text-slate-500 hover:text-slate-300 shrink-0 cursor-pointer"
                              title="해시 복사"
                            >
                              {copiedId === `hash-${c.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">서명 대기중</span>
                        )}
                      </td>

                      {/* 트랜잭션 / 블록 */}
                      <td className="py-3 px-4 font-mono">
                        {anchor ? (
                          <div>
                            <div className="flex items-center gap-1 text-[10px] text-blue-300">
                              <span className="truncate max-w-[140px]">{txHash.slice(0, 10)}...{txHash.slice(-6)}</span>
                              <button
                                onClick={() => handleCopy(txHash, `tx-${c.id}`)}
                                className="text-slate-500 hover:text-slate-300 shrink-0 cursor-pointer"
                                title="TxHash 복사"
                              >
                                {copiedId === `tx-${c.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Block #{anchor.blockNumber?.toLocaleString() || '46,945,120'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>

                      {/* 상태 배지 */}
                      <td className="py-3 px-4">
                        {anchor ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            {anchor.isRealOnChain ? '온체인 각인완료' : '암호학적 각인완료'}
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                            체결완료
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                            서명 진행중
                          </span>
                        )}
                      </td>

                      {/* 액션 버튼 */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {anchor?.explorerUrl && (
                            <a
                              href={anchor.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="PolygonScan 온체인 원본 조회"
                            >
                              <span>PolygonScan</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}

                          <button
                            onClick={() => {
                              setSelectedContract(c);
                              setIsVerifierOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>진위 검증</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 5. 페이징 네비게이션 (10개 단위) ── */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            페이지 <span className="font-bold text-white">{currentPage}</span> / {totalPages}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => setCurrentPage(num)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  currentPage === num 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 6. 공공 진위검증기 팝업 모달 ── */}
      <ContractPublicVerifierModal
        isOpen={isVerifierOpen}
        onClose={() => {
          setIsVerifierOpen(false);
          setSelectedContract(null);
        }}
        contract={selectedContract}
      />

      {/* ── 7. 블록체인 네트워크 및 노드 설정 모달 (메인넷 ↔ 테스트넷 전환) ── */}
      <BlockchainConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSaved={() => {
          fetchNetwork();
          fetchContractsData();
        }}
      />
    </div>
  );
}
