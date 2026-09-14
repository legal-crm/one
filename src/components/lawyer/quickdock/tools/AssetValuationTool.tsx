import React, { useState } from 'react';
import { 
  Building2, Home, Landmark, Car, ExternalLink, Calculator, 
  Search, Copy, Check, ArrowRight, ShieldCheck, AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { openExternalSearchPortal, ASSET_SEARCH_PORTALS } from '../../../../services/documents/assetSearchLinks';

type AssetType = 'housing' | 'land' | 'vehicle';

export default function AssetValuationTool() {
  const [activeType, setActiveType] = useState<AssetType>('housing');
  const [copied, setCopied] = useState(false);

  // 1. 주택 상태
  const [houseAddress, setHouseAddress] = useState('');
  const [housePublicPrice, setHousePublicPrice] = useState<number>(15000); // 1.5억원 (만원)
  const [houseMortgage, setHouseMortgage] = useState<number>(8000); // 8,000만원 (만원)
  const [houseDeposit, setHouseDeposit] = useState<number>(0); // 소액보증금 등

  // 2. 토지 상태
  const [landAddress, setLandAddress] = useState('');
  const [landUnitJiga, setLandUnitJiga] = useState<number>(300000); // 개별공시지가 (원/㎡)
  const [landAreaM2, setLandAreaM2] = useState<number>(165); // 면적 (㎡) ≈ 50평
  const [landMortgage, setLandMortgage] = useState<number>(0); // 근저당 (만원)

  // 3. 차량 상태
  const [carName, setCarName] = useState('');
  const [carValue, setCarValue] = useState<number>(1200); // 차량가액 (만원)
  const [carMortgage, setCarMortgage] = useState<number>(500); // 캐피탈 할부 저당 (만원)

  // ── 계산 공식 ──
  // 주택: 공시가격의 130%
  const houseValuation130 = Math.round(housePublicPrice * 1.3);
  const houseLiquidation = Math.max(0, houseValuation130 - houseMortgage - houseDeposit);

  // 토지: 개별공시지가 × 면적 × 130%
  const landTotalJigaWon = landUnitJiga * landAreaM2;
  const landValuation130Manwon = Math.round((landTotalJigaWon * 1.3) / 10000);
  const landLiquidation = Math.max(0, landValuation130Manwon - landMortgage);

  // 차량: 가액 - 저당
  const carLiquidation = Math.max(0, carValue - carMortgage);

  // 포털 오픈 헬퍼
  const handleOpenPortal = (portalId: string, customQuery?: string) => {
    openExternalSearchPortal(portalId, customQuery);
  };

  // 클립보드 복사
  const handleCopy = () => {
    let summary = '';
    if (activeType === 'housing') {
      summary = `[주택/아파트 자산가치 산정 보고]
• 대상/주소: ${houseAddress || '주택/아파트'}
• 기준 공시가격: ${housePublicPrice.toLocaleString()}만 원
• 법원 인정 시세(130%): ${houseValuation130.toLocaleString()}만 원 (KB시세 우선)
• 담보대출(근저당): ${houseMortgage.toLocaleString()}만 원
• 소액임차보증금 등: ${houseDeposit.toLocaleString()}만 원
• 순 청산가치 반영액: ${houseLiquidation.toLocaleString()}만 원`;
    } else if (activeType === 'land') {
      summary = `[토지/임야 자산가치 산정 보고]
• 소재지 지번: ${landAddress || '토지/임야'}
• 개별공시지가: ${landUnitJiga.toLocaleString()}원/㎡
• 토지 면적: ${landAreaM2}㎡ (약 ${(landAreaM2 * 0.3025).toFixed(1)}평)
• 법원 인정 시세(공시지가×130%): ${landValuation130Manwon.toLocaleString()}만 원
• 담보대출(근저당): ${landMortgage.toLocaleString()}만 원
• 순 청산가치 반영액: ${landLiquidation.toLocaleString()}만 원`;
    } else {
      summary = `[자동차/차량 자산가치 산정 보고]
• 차종/차량명: ${carName || '보유 차량'}
• 차량 기준가액: ${carValue.toLocaleString()}만 원 (보험개발원/엔카 기준)
• 할부/캐피탈 저당(을구): ${carMortgage.toLocaleString()}만 원
• 순 청산가치 반영액: ${carLiquidation.toLocaleString()}만 원`;
    }

    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success('자산가액 산정 내역이 클립보드에 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3.5 space-y-3.5 text-xs text-slate-800">
      {/* ── 1. 자산 종류 탭 ── */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveType('housing')}
          className={`py-1.5 flex items-center justify-center gap-1 font-bold rounded-lg transition-all cursor-pointer ${
            activeType === 'housing'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>주택·아파트</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveType('land')}
          className={`py-1.5 flex items-center justify-center gap-1 font-bold rounded-lg transition-all cursor-pointer ${
            activeType === 'land'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>토지·임야</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveType('vehicle')}
          className={`py-1.5 flex items-center justify-center gap-1 font-bold rounded-lg transition-all cursor-pointer ${
            activeType === 'vehicle'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>차량·이륜차</span>
        </button>
      </div>

      {/* ── 2. 탭별 공적 포털 바로조회 & 간이 산정 ── */}
      {activeType === 'housing' && (
        <div className="space-y-3">
          {/* 검색어 입력창 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>단지명 또는 도로명 주소</span>
              <span className="text-[10px] text-emerald-600 font-medium">검색어 딥링크 지원</span>
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={houseAddress}
                onChange={e => setHouseAddress(e.target.value)}
                placeholder="예: 은마아파트, 마포래미안, 역삼동 123"
                className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 공적 조회 바로가기 버튼군 */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 block">원클릭 시세·공시가격 포털 조회</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenPortal('kb_realestate', houseAddress)}
                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">🏢 KB부동산 시세</span>
                  <span className="text-[9px] text-amber-700 font-normal">아파트/오피스텔 1순위</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPortal('realty_price', houseAddress)}
                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/80 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">📑 공시가격 알리미</span>
                  <span className="text-[9px] text-blue-700 font-normal">빌라/다세대 130% 기준</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPortal('molit_real_trade', houseAddress)}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">📈 국토부 실거래가</span>
                  <span className="text-[9px] text-slate-500 font-normal">최근 매매계약 실거래가</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPortal('iros_registry')}
                className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200/80 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">🏛️ 인터넷등기소</span>
                  <span className="text-[9px] text-purple-700 font-normal">을구 근저당 채권최고액</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 법원 인정가 및 청산가치 간이 산정기 */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-700" />
              주택 청산가치 간이 산정 (만원 단위)
            </span>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">공시가격/시세</label>
                <input
                  type="number"
                  step={500}
                  value={housePublicPrice}
                  onChange={e => setHousePublicPrice(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">근저당(대출)</label>
                <input
                  type="number"
                  step={500}
                  value={houseMortgage}
                  onChange={e => setHouseMortgage(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">소액보증금 등</label>
                <input
                  type="number"
                  step={500}
                  value={houseDeposit}
                  onChange={e => setHouseDeposit(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-emerald-200 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>법원 인정 시세 (공시가 130%):</span>
                <span className="font-bold text-slate-900">{houseValuation130.toLocaleString()}만 원</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 font-extrabold text-emerald-800">
                <span>순 청산가치 반영액:</span>
                <span className="text-sm font-black text-emerald-700">{houseLiquidation.toLocaleString()}만 원</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeType === 'land' && (
        <div className="space-y-3">
          {/* 토지 지번 입력 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block">토지 소재지 (지번/도로명)</label>
            <input
              type="text"
              value={landAddress}
              onChange={e => setLandAddress(e.target.value)}
              placeholder="예: 양평군 양서면 목왕리 산 12, 화성시 남양읍"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* 토지 공적 포털 버튼군 */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 block">원클릭 토지 공시지가 & 지적도 포털</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenPortal('eum_land', landAddress)}
                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">🗺️ 토지이음 (구 토지이용규제)</span>
                  <span className="text-[9px] text-emerald-700 font-normal">개별공시지가 & 지목</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPortal('realty_price', landAddress)}
                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">📑 공시가격 알리미 (토지)</span>
                  <span className="text-[9px] text-blue-700 font-normal">표준지/개별공시지가</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 토지 평가액 계산기 */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-700" />
              토지 가액 계산 (공시지가 × 면적 × 130%)
            </span>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">공시지가 (원/㎡)</label>
                <input
                  type="number"
                  step={10000}
                  value={landUnitJiga}
                  onChange={e => setLandUnitJiga(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">면적 (㎡)</label>
                <input
                  type="number"
                  step={10}
                  value={landAreaM2}
                  onChange={e => setLandAreaM2(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">담보대출(만원)</label>
                <input
                  type="number"
                  step={100}
                  value={landMortgage}
                  onChange={e => setLandMortgage(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-emerald-200 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>법원 인정 토지가액 (130%):</span>
                <span className="font-bold text-slate-900">{landValuation130Manwon.toLocaleString()}만 원</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 font-extrabold text-emerald-800">
                <span>순 청산가치 반영액:</span>
                <span className="text-sm font-black text-emerald-700">{landLiquidation.toLocaleString()}만 원</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeType === 'vehicle' && (
        <div className="space-y-3">
          {/* 차명/모델명 입력 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block">차명, 세부 모델 또는 차량번호</label>
            <input
              type="text"
              value={carName}
              onChange={e => setCarName(e.target.value)}
              placeholder="예: 아반떼 CN7, 그랜저 IG 2.5, 12가3456"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* 차량 포털 버튼군 */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 block">원클릭 차량기준가액 & 중고차 시세</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenPortal('kidi_car')}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">🚗 보험개발원 기준가</span>
                  <span className="text-[9px] text-rose-700 font-normal">법원 인정 공식가액</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-rose-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPortal('encar', carName)}
                className="p-2 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">🔍 엔카 (Encar) 시세</span>
                  <span className="text-[9px] text-red-700 font-normal">실매물 중고차 시세</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-red-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPortal('kb_chachacha', carName)}
                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">🚙 KB차차차 국민시세</span>
                  <span className="text-[9px] text-amber-700 font-normal">공인 감정가 확인</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenPortal('ecar_portal')}
                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div>
                  <span className="block text-[11px]">📋 자동차365 저당조회</span>
                  <span className="text-[9px] text-slate-500 font-normal">등록원부 을구 저당권</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 차량 청산가치 산정기 */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-700" />
              차량 청산가치 산정 (만원 단위)
            </span>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">차량 시세/기준가액</label>
                <input
                  type="number"
                  step={50}
                  value={carValue}
                  onChange={e => setCarValue(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5 font-medium">할부·캐피탈 저당액</label>
                <input
                  type="number"
                  step={50}
                  value={carMortgage}
                  onChange={e => setCarMortgage(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-emerald-200 space-y-1 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>차량 기준가액:</span>
                <span className="font-bold text-slate-900">{carValue.toLocaleString()}만 원</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 font-extrabold text-emerald-800">
                <span>순 청산가치 반영액:</span>
                <span className="text-sm font-black text-emerald-700">{carLiquidation.toLocaleString()}만 원</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 산정 결과 복사 버튼 ── */}
      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '자산 산정 결과 원클릭 복사'}</span>
      </button>
    </div>
  );
}
