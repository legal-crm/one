import React, { useState } from 'react';
import { Home, Landmark, Car, ExternalLink, Calculator, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import { openExternalSearchPortal, ASSET_SEARCH_PORTALS } from '../../../../services/documents/assetSearchLinks';
import { setDockLiquidation, LiquidationInputs } from '../dockShared';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';
import MoneyInput from '../ui/MoneyInput';
import { formatWonKorean } from '../ui/money';

type AssetType = 'housing' | 'land' | 'vehicle';
type HouseBasis = 'public' | 'market';

/** 공시가격·공시지가 → 시세 참고 환산 배율 (법원 기준 아님, 화면에 '참고 환산'으로만 표시) */
const PUBLIC_PRICE_MULTIPLIER = 1.3;

interface PortalButtonProps {
  portalKey: keyof typeof ASSET_SEARCH_PORTALS;
  query?: string;
  title: string;
  desc: string;
  tone: string;
}

function PortalButton({ portalKey, query, title, desc, tone }: PortalButtonProps) {
  const handleOpen = async () => {
    const res = await openExternalSearchPortal(portalKey, query);
    if (res.copiedQuery) {
      toast.info(`검색어 ‘${res.copiedQuery}’를 복사했습니다. 열린 사이트 검색창에 붙여넣으세요.`);
    }
  };
  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`p-2 border rounded-xl font-bold flex items-center justify-between text-left transition-colors cursor-pointer group press-scale ${tone}`}
    >
      <span>
        <span className="block text-[11px]">{title}</span>
        <span className="block text-[10px] font-normal opacity-90">{desc}</span>
      </span>
      <ExternalLink className="w-3.5 h-3.5 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
      <span className="sr-only">(새 창)</span>
    </button>
  );
}

function ApplyButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-[34px] py-1.5 rounded-xl text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer press-scale flex items-center justify-center gap-1.5 whitespace-nowrap"
    >
      <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
      청산가치 점검기에 반영
    </button>
  );
}

export default function AssetValuationTool() {
  const [activeType, setActiveType] = useState<AssetType>('housing');
  const { copied, copy } = useCopyFeedback();

  // 1. 주택 (원 단위)
  const [houseAddress, setHouseAddress] = useState('');
  const [houseBasis, setHouseBasis] = useState<HouseBasis>('public');
  const [housePrice, setHousePrice] = useState(0);
  const [houseMortgage, setHouseMortgage] = useState(0);
  const [houseTenantDeposit, setHouseTenantDeposit] = useState(0);

  // 2. 토지
  const [landAddress, setLandAddress] = useState('');
  const [landUnitJiga, setLandUnitJiga] = useState(0); // 개별공시지가 (원/㎡)
  const [landAreaM2, setLandAreaM2] = useState(0);
  const [landApplyMultiplier, setLandApplyMultiplier] = useState(true);
  const [landMortgage, setLandMortgage] = useState(0);

  // 3. 차량
  const [carName, setCarName] = useState('');
  const [carValue, setCarValue] = useState(0);
  const [carMortgage, setCarMortgage] = useState(0);

  // ── 계산 ──
  const houseValuation = houseBasis === 'public' ? Math.round(housePrice * PUBLIC_PRICE_MULTIPLIER) : housePrice;
  const houseNet = Math.max(0, houseValuation - houseMortgage - houseTenantDeposit);

  const landPublicTotal = Math.round(landUnitJiga * landAreaM2);
  const landValuation = landApplyMultiplier ? Math.round(landPublicTotal * PUBLIC_PRICE_MULTIPLIER) : landPublicTotal;
  const landNet = Math.max(0, landValuation - landMortgage);

  const carNet = Math.max(0, carValue - carMortgage);

  const applyToLiquidation = (field: 'housing' | 'land' | 'vehicle', value: number, label: string) => {
    setDockLiquidation({ [field]: value } as Partial<LiquidationInputs>);
    toast.success(`${label} 순가액 ${formatWonKorean(value)}을 청산가치 점검기에 반영했습니다.`);
  };

  const handleCopy = () => {
    let summary = '';
    if (activeType === 'housing') {
      summary = `[주택/아파트 자산가치 산정 (참고)]
• 대상/주소: ${houseAddress || '주택/아파트'}
• ${houseBasis === 'public' ? `공시가격: ${formatWonKorean(housePrice)} → 참고 환산(×130%) ${formatWonKorean(houseValuation)}` : `시세(KB·실거래가 등): ${formatWonKorean(housePrice)}`}
• 담보대출(근저당): ${formatWonKorean(houseMortgage)}
• 임차인 보증금 등: ${formatWonKorean(houseTenantDeposit)}
• 순가액(청산가치 반영 참고): ${formatWonKorean(houseNet)}`;
    } else if (activeType === 'land') {
      summary = `[토지/임야 자산가치 산정 (참고)]
• 소재지 지번: ${landAddress || '토지/임야'}
• 개별공시지가: ${landUnitJiga.toLocaleString()}원/㎡ × ${landAreaM2.toLocaleString()}㎡ (약 ${(landAreaM2 * 0.3025).toFixed(1)}평) = ${formatWonKorean(landPublicTotal)}
• 반영 가액: ${formatWonKorean(landValuation)}${landApplyMultiplier ? ' (공시지가×130% 참고 환산)' : ' (공시지가 그대로)'}
• 담보대출(근저당): ${formatWonKorean(landMortgage)}
• 순가액(청산가치 반영 참고): ${formatWonKorean(landNet)}`;
    } else {
      summary = `[자동차/차량 자산가치 산정 (참고)]
• 차종/차량명: ${carName || '보유 차량'}
• 차량 기준가액: ${formatWonKorean(carValue)} (보험개발원·중고 시세 참고)
• 할부/캐피탈 저당(을구): ${formatWonKorean(carMortgage)}
• 순가액(청산가치 반영 참고): ${formatWonKorean(carNet)}`;
    }
    copy(summary, '자산가액 산정 내역이 복사되었습니다.');
  };

  const tabClass = (t: AssetType) =>
    `py-1.5 flex items-center justify-center gap-1 font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
      activeType === t ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
    }`;

  return (
    <div className="p-3.5 space-y-3.5 text-xs text-slate-800">
      {/* ── 자산 종류 탭 ── */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl" role="tablist" aria-label="자산 종류">
        <button type="button" role="tab" aria-selected={activeType === 'housing'} onClick={() => setActiveType('housing')} className={tabClass('housing')}>
          <Home className="w-3.5 h-3.5" aria-hidden="true" />
          <span>주택·아파트</span>
        </button>
        <button type="button" role="tab" aria-selected={activeType === 'land'} onClick={() => setActiveType('land')} className={tabClass('land')}>
          <Landmark className="w-3.5 h-3.5" aria-hidden="true" />
          <span>토지·임야</span>
        </button>
        <button type="button" role="tab" aria-selected={activeType === 'vehicle'} onClick={() => setActiveType('vehicle')} className={tabClass('vehicle')}>
          <Car className="w-3.5 h-3.5" aria-hidden="true" />
          <span>차량·이륜차</span>
        </button>
      </div>

      {activeType === 'housing' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="asset-house-address" className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>단지명 또는 도로명 주소</span>
              <span className="text-[10px] text-emerald-800 font-medium">포털을 열 때 검색어 자동 복사</span>
            </label>
            <input
              id="asset-house-address"
              type="text"
              value={houseAddress}
              onChange={e => setHouseAddress(e.target.value)}
              placeholder="예: 은마아파트, 역삼동 123"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-medium placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-600 block">시세·공시가격 포털</span>
            <div className="grid grid-cols-2 gap-1.5">
              <PortalButton portalKey="kb_realestate" query={houseAddress} title="KB부동산 시세" desc="아파트·오피스텔" tone="bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200/80" />
              <PortalButton portalKey="realty_price" query={houseAddress} title="공시가격 알리미" desc="빌라·다세대·단독" tone="bg-blue-50 hover:bg-blue-100 text-blue-950 border-blue-200/80" />
              <PortalButton portalKey="molit_real_trade" query={houseAddress} title="국토부 실거래가" desc="최근 매매 실거래" tone="bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200" />
              <PortalButton portalKey="iros_registry" title="인터넷등기소" desc="을구 근저당 채권최고액" tone="bg-purple-50 hover:bg-purple-100 text-purple-950 border-purple-200/80" />
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 space-y-2">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              주택 순가액 간이 산정
            </span>
            <div className="grid grid-cols-2 gap-1 bg-white/70 p-1 rounded-xl" role="radiogroup" aria-label="입력 금액 종류">
              {([
                ['public', '공시가격 입력 (×130% 참고)'],
                ['market', '시세 입력 (그대로)'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={houseBasis === value}
                  onClick={() => setHouseBasis(value)}
                  className={`py-1 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                    houseBasis === value ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label htmlFor="asset-house-price" className="text-[10px] text-slate-600 block mb-0.5 font-medium">
                  {houseBasis === 'public' ? '공시가격' : '시세'}
                </label>
                <MoneyInput id="asset-house-price" value={housePrice} onChange={setHousePrice} placeholder="예: 3억" showHint={false} />
              </div>
              <div>
                <label htmlFor="asset-house-mortgage" className="text-[10px] text-slate-600 block mb-0.5 font-medium">근저당(대출)</label>
                <MoneyInput id="asset-house-mortgage" value={houseMortgage} onChange={setHouseMortgage} placeholder="0" showHint={false} />
              </div>
              <div>
                <label htmlFor="asset-house-tenant" className="text-[10px] text-slate-600 block mb-0.5 font-medium">임차인 보증금 등</label>
                <MoneyInput id="asset-house-tenant" value={houseTenantDeposit} onChange={setHouseTenantDeposit} placeholder="0" showHint={false} />
              </div>
            </div>
            <div className="p-2 bg-white rounded-xl border border-emerald-200 space-y-1 text-[11px]" aria-live="polite">
              <div className="flex justify-between text-slate-600">
                <span>{houseBasis === 'public' ? '참고 시세 (공시가격×130%)' : '시세'}</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatWonKorean(houseValuation)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 font-extrabold text-emerald-900">
                <span>순가액</span>
                <span className="text-sm font-black text-emerald-800 tabular-nums">{formatWonKorean(houseNet)}</span>
              </div>
            </div>
            <ApplyButton onClick={() => applyToLiquidation('housing', houseNet, '주택')} disabled={housePrice <= 0} />
          </div>
        </div>
      )}

      {activeType === 'land' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="asset-land-address" className="text-[11px] font-bold text-slate-700 block">토지 소재지 (지번/도로명)</label>
            <input
              id="asset-land-address"
              type="text"
              value={landAddress}
              onChange={e => setLandAddress(e.target.value)}
              placeholder="예: 양평군 양서면 목왕리 산 12"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-medium placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-600 block">공시지가·지적도 포털</span>
            <div className="grid grid-cols-2 gap-1.5">
              <PortalButton portalKey="eum_land" query={landAddress} title="토지이음" desc="개별공시지가·지목" tone="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200" />
              <PortalButton portalKey="realty_price" query={landAddress} title="공시가격 알리미 (토지)" desc="표준지·개별공시지가" tone="bg-blue-50 hover:bg-blue-100 text-blue-950 border-blue-200" />
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 space-y-2">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              토지 가액 계산 (공시지가 × 면적)
            </span>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label htmlFor="asset-land-jiga" className="text-[10px] text-slate-600 block mb-0.5 font-medium">공시지가 (원/㎡)</label>
                <input
                  id="asset-land-jiga"
                  type="number"
                  min={0}
                  step={1000}
                  value={landUnitJiga || ''}
                  onChange={e => setLandUnitJiga(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div>
                <label htmlFor="asset-land-area" className="text-[10px] text-slate-600 block mb-0.5 font-medium">면적 (㎡)</label>
                <input
                  id="asset-land-area"
                  type="number"
                  min={0}
                  step={1}
                  value={landAreaM2 || ''}
                  onChange={e => setLandAreaM2(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div>
                <label htmlFor="asset-land-mortgage" className="text-[10px] text-slate-600 block mb-0.5 font-medium">담보대출</label>
                <MoneyInput id="asset-land-mortgage" value={landMortgage} onChange={setLandMortgage} placeholder="0" showHint={false} />
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
              <input type="checkbox" checked={landApplyMultiplier} onChange={e => setLandApplyMultiplier(e.target.checked)} className="rounded accent-emerald-600" />
              공시지가 ×130% 참고 환산 적용
            </label>
            <div className="p-2 bg-white rounded-xl border border-emerald-200 space-y-1 text-[11px]" aria-live="polite">
              <div className="flex justify-between text-slate-600">
                <span>공시지가 합계 ({landAreaM2 > 0 ? `약 ${(landAreaM2 * 0.3025).toFixed(1)}평` : '면적 입력'})</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatWonKorean(landPublicTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>반영 가액</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatWonKorean(landValuation)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 font-extrabold text-emerald-900">
                <span>순가액</span>
                <span className="text-sm font-black text-emerald-800 tabular-nums">{formatWonKorean(landNet)}</span>
              </div>
            </div>
            <ApplyButton onClick={() => applyToLiquidation('land', landNet, '토지')} disabled={landPublicTotal <= 0} />
          </div>
        </div>
      )}

      {activeType === 'vehicle' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="asset-car-name" className="text-[11px] font-bold text-slate-700 block">차명, 세부 모델 또는 차량번호</label>
            <input
              id="asset-car-name"
              type="text"
              value={carName}
              onChange={e => setCarName(e.target.value)}
              placeholder="예: 아반떼 CN7, 그랜저 IG 2.5"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-medium placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-600 block">차량 기준가액·중고 시세 포털</span>
            <div className="grid grid-cols-2 gap-1.5">
              <PortalButton portalKey="kidi_car" title="보험개발원 기준가" desc="차량 기준가액 조회" tone="bg-rose-50 hover:bg-rose-100 text-rose-950 border-rose-200" />
              <PortalButton portalKey="encar" query={carName} title="엔카 시세" desc="실매물 중고 시세" tone="bg-red-50 hover:bg-red-100 text-red-950 border-red-200" />
              <PortalButton portalKey="kb_chachacha" query={carName} title="KB차차차 시세" desc="중고 시세 참고 (감정가 아님)" tone="bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200" />
              <PortalButton portalKey="ecar_portal" title="자동차365 저당조회" desc="등록원부 을구 저당권" tone="bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200" />
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 space-y-2">
            <span className="font-extrabold text-emerald-950 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              차량 순가액 산정
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <label htmlFor="asset-car-value" className="text-[10px] text-slate-600 block mb-0.5 font-medium">차량 시세/기준가액</label>
                <MoneyInput id="asset-car-value" value={carValue} onChange={setCarValue} placeholder="예: 1200만" />
              </div>
              <div>
                <label htmlFor="asset-car-mortgage" className="text-[10px] text-slate-600 block mb-0.5 font-medium">할부·캐피탈 저당액</label>
                <MoneyInput id="asset-car-mortgage" value={carMortgage} onChange={setCarMortgage} placeholder="0" />
              </div>
            </div>
            <div className="p-2 bg-white rounded-xl border border-emerald-200 text-[11px]" aria-live="polite">
              <div className="flex justify-between font-extrabold text-emerald-900">
                <span>순가액</span>
                <span className="text-sm font-black text-emerald-800 tabular-nums">{formatWonKorean(carNet)}</span>
              </div>
            </div>
            <ApplyButton onClick={() => applyToLiquidation('vehicle', carNet, '차량')} disabled={carValue <= 0} />
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-500">
        ×130%는 공시가격을 시세로 가늠하기 위한 참고 환산이며 법원 기준이 아닙니다. KB시세·실거래가·감정 결과가 있으면 그 값을 쓰세요.
      </p>

      <CopyButton copied={copied} onClick={handleCopy} label="자산 산정 결과 복사" />
    </div>
  );
}
