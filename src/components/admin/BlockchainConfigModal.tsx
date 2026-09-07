import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  Radio, 
  Cpu, 
  Layers, 
  Info,
  Check,
  Flame,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BlockchainConfig,
  getBlockchainConfig,
  saveBlockchainConfig,
  resetBlockchainConfig,
  fetchBlockchainNetworkStatus,
  BlockchainNetworkStatus,
  POLYGON_NOTARY_CONTRACT,
  DEFAULT_MAINNET_RPC,
  DEFAULT_AMOY_RPC
} from '../../services/blockchainAnchorService';

interface BlockchainConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function BlockchainConfigModal({
  isOpen,
  onClose,
  onSaved,
}: BlockchainConfigModalProps) {
  const [network, setNetwork] = useState<'mainnet' | 'amoy'>('amoy');
  const [rpcUrl, setRpcUrl] = useState('');
  const [notaryContract, setNotaryContract] = useState('');
  const [relayerMode, setRelayerMode] = useState<'auto' | 'onchain' | 'simulation'>('auto');

  // 연결 테스트 상태
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<BlockchainNetworkStatus | null>(null);

  // 모달 열릴 때 현재 저장된 설정 불러오기
  useEffect(() => {
    if (isOpen) {
      const config = getBlockchainConfig();
      setNetwork(config.network);
      setRpcUrl(config.rpcUrl || '');
      setNotaryContract(config.notaryContract || POLYGON_NOTARY_CONTRACT);
      setRelayerMode(config.relayerMode || 'auto');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 기본 RPC 주소 도출
  const currentDefaultRpc = network === 'mainnet' ? DEFAULT_MAINNET_RPC : DEFAULT_AMOY_RPC;

  // 노드 연결 테스트 (Ping Test)
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const status = await fetchBlockchainNetworkStatus({
        network,
        rpcUrl: rpcUrl.trim() || undefined,
        notaryContract: notaryContract.trim() || undefined,
        relayerMode,
      });
      setTestResult(status);
      if (status.ok) {
        toast.success(`노드 연결 성공: ChainID ${status.chainId} (#${status.blockHeight?.toLocaleString() || '최신'})`);
      } else {
        toast.error(`노드 연결 실패: ${status.error || '응답 없음'}`);
      }
    } catch (err: any) {
      toast.error(`연결 테스트 오류: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // 설정 저장
  const handleSave = () => {
    const newConfig: BlockchainConfig = {
      network,
      rpcUrl: rpcUrl.trim(),
      notaryContract: notaryContract.trim() || POLYGON_NOTARY_CONTRACT,
      relayerMode,
    };

    saveBlockchainConfig(newConfig);

    if (network === 'mainnet') {
      toast.success('Polygon 메인넷(EVM-137) 실제 트랜잭션 모드로 전환되었습니다.');
    } else {
      toast.success('Polygon Amoy 테스트넷(EVM-80002) 모드로 전환되었습니다.');
    }

    onSaved();
    onClose();
  };

  // 기본값으로 초기화
  const handleReset = () => {
    const def = resetBlockchainConfig();
    setNetwork(def.network);
    setRpcUrl('');
    setNotaryContract(POLYGON_NOTARY_CONTRACT);
    setRelayerMode(def.relayerMode);
    setTestResult(null);
    toast.info('블록체인 네트워크 설정이 기본값(Amoy 테스트넷)으로 복원되었습니다.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">블록체인 분산원장 네트워크 설정</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  network === 'mainnet' 
                    ? 'bg-purple-950 text-purple-300 border border-purple-700 animate-pulse' 
                    : 'bg-blue-950 text-blue-300 border border-blue-800'
                }`}>
                  {network === 'mainnet' ? 'MAINNET ACTIVE' : 'TESTNET ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Polygon Amoy 테스트넷 ↔ Polygon PoS 메인넷 실트랜잭션 환경을 관리자가 원클릭으로 제어합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 모달 바디 스크롤 영역 */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-200 custom-scrollbar">
          
          {/* 1. 네트워크 모드 선택 카드 */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-indigo-400" />
                분산원장 네트워크 선택
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                변경 즉시 신규 전자계약 앵커링에 적용
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 메인넷 옵션 카드 */}
              <div
                onClick={() => setNetwork('mainnet')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  network === 'mainnet'
                    ? 'border-purple-500 bg-purple-950/40 shadow-lg shadow-purple-950/50'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className={`w-4 h-4 ${network === 'mainnet' ? 'text-purple-400' : 'text-slate-500'}`} />
                    <span className="font-bold text-white text-sm">Polygon PoS 메인넷</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-200 border border-purple-700">
                    EVM-137
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  <strong className="text-purple-300 font-semibold">실제 온체인 트랜잭션</strong>이 발생하며, PolygonScan 분산원장에 영구 각인됩니다. 최고 수준의 법적 증거력을 보장합니다.
                </p>
                <div className="mt-3 flex items-center gap-1 text-[10px] text-purple-400 font-medium">
                  <Check className="w-3 h-3" />
                  <span>실거래 가스비(POL) 온체인 정산 모드</span>
                </div>
              </div>

              {/* 테스트넷 옵션 카드 */}
              <div
                onClick={() => setNetwork('amoy')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  network === 'amoy'
                    ? 'border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-950/50'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className={`w-4 h-4 ${network === 'amoy' ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="font-bold text-white text-sm">Polygon Amoy 테스트넷</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-700">
                    EVM-80002
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  개발 및 시연을 위한 <strong className="text-blue-300 font-semibold">무료 테스트 환경</strong>입니다. 실제 자산 소모 없이 Amoy PolygonScan에 원본 해시를 기록합니다.
                </p>
                <div className="mt-3 flex items-center gap-1 text-[10px] text-blue-400 font-medium">
                  <Check className="w-3 h-3" />
                  <span>비용 0원 무제한 테스트 모드</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. RPC 엔드포인트 URL 설정 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                RPC 노드 엔드포인트 URL (공용 또는 사설 노드)
              </label>
              <button
                type="button"
                onClick={() => setRpcUrl('')}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                기본 RPC 사용
              </button>
            </div>
            <input
              type="text"
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder={`미입력 시 기본 RPC: ${currentDefaultRpc}`}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span>Infura, Alchemy, QuickNode 등의 전용 사설 RPC 엔드포인트를 지정하여 처리 속도와 가용성을 극대화할 수 있습니다.</span>
            </div>
          </div>

          {/* 3. 공증 스마트 컨트랙트 주소 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                공인 블록체인 문서 공증 스마트 컨트랙트 주소 (Notary Contract)
              </label>
              <button
                type="button"
                onClick={() => setNotaryContract(POLYGON_NOTARY_CONTRACT)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                표준 컨트랙트 복원
              </button>
            </div>
            <input
              type="text"
              value={notaryContract}
              onChange={(e) => setNotaryContract(e.target.value)}
              placeholder={POLYGON_NOTARY_CONTRACT}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* 4. 릴레이어 실행 정책 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              온체인 릴레이어 트랜잭션 브로드캐스팅 정책
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRelayerMode('auto')}
                className={`px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  relayerMode === 'auto'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">자동 폴백 모드 (권장)</div>
                <div className="text-[10px] text-slate-400 mt-1">온체인 가스 잔액 감지 후 자동 안전망 전환</div>
              </button>

              <button
                type="button"
                onClick={() => setRelayerMode('onchain')}
                className={`px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  relayerMode === 'onchain'
                    ? 'border-purple-500 bg-purple-950/40 text-purple-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">순수 온체인 전송</div>
                <div className="text-[10px] text-slate-400 mt-1">릴레이어 가스 잔액 필수, 실시간 블록 각인</div>
              </button>

              <button
                type="button"
                onClick={() => setRelayerMode('simulation')}
                className={`px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  relayerMode === 'simulation'
                    ? 'border-blue-500 bg-blue-950/40 text-blue-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs">암호학적 타임스탬프</div>
                <div className="text-[10px] text-slate-400 mt-1">KISA 표준 오프체인 무결성 보관 (0원 가스)</div>
              </button>
            </div>
          </div>

          {/* 5. 실시간 연결 테스트 결과 카드 */}
          {testResult && (
            <div className={`p-4 rounded-2xl border transition-all ${
              testResult.ok 
                ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200' 
                : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className="font-bold text-xs">
                  {testResult.ok ? '블록체인 RPC 노드 연결 정상' : 'RPC 노드 연결 실패'}
                </span>
                <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                  ChainID: {testResult.chainId}
                </span>
              </div>

              {testResult.ok ? (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300 border-t border-slate-800/80 pt-2 font-mono">
                  <div>
                    <span className="text-slate-400">최신 블록:</span> #{testResult.blockHeight?.toLocaleString()}
                  </div>
                  <div>
                    <span className="text-slate-400">릴레이어 잔액:</span> {testResult.relayerBalance || '0 POL'}
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="text-slate-400">RPC Endpoint:</span> {testResult.rpcUrl}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-rose-300 font-mono">
                  {testResult.error || '연결 실패: RPC 엔드포인트를 확인해주세요.'}
                </p>
              )}
            </div>
          )}

        </div>

        {/* 모달 하단 푸터 액션 */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold border border-slate-800 cursor-pointer transition-colors"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold border border-slate-700 cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? '연결 확인 중...' : '⚡ 노드 연결 테스트 (Ping)'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800 cursor-pointer transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/40 cursor-pointer transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>설정 저장 및 노드 동기화</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
