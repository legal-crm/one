// src/components/lawyer/petitions/LitigationPowerOfAttorneyModal.tsx
// ============================================================
// [리걸플로 벤치마킹] 소송위임장 및 담당변호사 지정서 발급 모달 (STEP 7)
// 매뉴얼 p.67 그림 7-33 완벽 대응
// - 개인 법률사무소 vs 법무법인(유한) 선택 분기
// - 법무법인 선택 시 [담당변호사 지정서] 자동 포함
// - 8대 법정 수권사항 체크리스트
// - 대법원 전자소송 제출용 A4 인쇄 및 다운로드
// ============================================================

import React, { useState, useRef } from 'react';
import { 
  X, Printer, Download, CheckSquare, Square, 
  Building, UserCheck, ShieldCheck, Scale, FileText 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';

interface LitigationPowerOfAttorneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyerName?: string;
  firmName?: string;
}

export default function LitigationPowerOfAttorneyModal({
  isOpen,
  onClose,
  clientRequest,
  crmExt,
  activeLawyerName = '김변호',
  firmName = '법률사무소 로앤윈'
}: LitigationPowerOfAttorneyModalProps) {
  if (!isOpen) return null;

  const printAreaRef = useRef<HTMLDivElement>(null);

  const clientName = clientRequest.clientName || '신청인';
  const clientPhone = clientRequest.phone || '010-0000-0000';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const caseNumber = crmExt.courtCase?.caseNumber || '2026개회 (신청 접수예정)';

  // 위임인 및 수임인 설정 상태
  const [attorneyType, setAttorneyType] = useState<'individual' | 'lawfirm'>('lawfirm');
  const [lawFirmName, setLawFirmName] = useState(firmName.includes('법무법인') ? firmName : '법무법인(유한) 한결');
  const [managingLawyer, setManagingLawyer] = useState(activeLawyerName);
  const [assignedLawyers, setAssignedLawyers] = useState<string[]>([activeLawyerName, '박창호 변호사']);
  const [firmAddress, setFirmAddress] = useState('서울특별시 서초구 서초대로 250, 8층 (서초동)');

  // 8대 수권사항 체크 상태
  const [powers, setPowers] = useState({
    p1: true, // 일체의 소송행위, 반소의 제기 및 응소
    p2: true, // 소의 취하, 화해, 청구의 포기 및 인낙
    p3: true, // 복대리인의 선임
    p4: true, // 공탁물의 납입 및 공탁물과 그 이자의 수령
    p5: true, // 담보권의 실행, 강제집행의 신청 및 취하
    p6: true, // 보정권고, 보정명령에 대한 답변서 및 소명자료 제출
    p7: true, // 변제계획안의 작성, 수정 및 인가신청
    p8: true, // 법원 송달물의 영수
  });

  const togglePower = (key: keyof typeof powers) => {
    setPowers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand/20 border border-brand/40 flex items-center justify-center text-brand">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                소송위임장 및 담당변호사 지정서 (STEP 7)
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30">
                  대법원 전자소송 표준양식
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                개인 법률사무소 및 법무법인 담당변호사 지정서를 자동 생성하고 A4로 출력합니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-sm press-scale cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> 인쇄 / PDF 저장
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 상단 컨트롤러 (법률사무소 vs 법무법인 선택 & 수권사항 토글) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-600 font-bold block mb-1.5">대리인 구분 선택:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAttorneyType('individual')}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  attorneyType === 'individual'
                    ? 'bg-white border-brand text-brand shadow-xs ring-1 ring-brand/30'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-white'
                }`}
              >
                개인 법률사무소
              </button>
              <button
                type="button"
                onClick={() => setAttorneyType('lawfirm')}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  attorneyType === 'lawfirm'
                    ? 'bg-white border-brand text-brand shadow-xs ring-1 ring-brand/30'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-white'
                }`}
              >
                법무법인(유한) · 지정서 포함
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-600 font-bold block mb-1.5">수임인 정보 (사무소/대표변호사):</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={lawFirmName}
                onChange={e => setLawFirmName(e.target.value)}
                placeholder="사무소명 / 법무법인명"
                className="p-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand"
              />
              <input
                type="text"
                value={managingLawyer}
                onChange={e => setManagingLawyer(e.target.value)}
                placeholder="담당/대표 변호사명"
                className="p-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* 메인 A4 서식 인쇄 미리보기 영역 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 flex justify-center">
          <div 
            ref={printAreaRef}
            className="w-[210mm] min-h-[297mm] bg-white p-[20mm] shadow-lg border border-slate-200 text-slate-900 font-serif leading-relaxed text-sm flex flex-col justify-between"
          >
            <div className="space-y-6">
              {/* 문서 제목 */}
              <div className="text-center pb-4 border-b-2 border-slate-900">
                <h1 className="text-2xl font-bold tracking-widest mb-1">소 송 위 임 장</h1>
                <p className="text-xs font-sans text-slate-500">사건: {courtName} {caseNumber} 개인회생</p>
              </div>

              {/* 사건 및 당사자 표시 */}
              <div className="space-y-3 font-sans text-xs">
                <div className="grid grid-cols-6 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-bold col-span-1 text-slate-600">위 임 인:</span>
                  <span className="col-span-5 font-bold text-slate-900">{clientName} (전화: {clientPhone})</span>
                  
                  <span className="font-bold col-span-1 text-slate-600">수 임 인:</span>
                  <span className="col-span-5 font-bold text-slate-900">
                    {attorneyType === 'lawfirm' ? `${lawFirmName} (담당: ${assignedLawyers.join(', ')})` : `${lawFirmName} 변호사 ${managingLawyer}`}
                  </span>

                  <span className="font-bold col-span-1 text-slate-600">사무소 소재지:</span>
                  <span className="col-span-5 text-slate-700">{firmAddress}</span>
                </div>
              </div>

              {/* 위임 본문 */}
              <div className="space-y-2 text-xs leading-relaxed text-justify">
                <p>
                  위임인은 귀하를 소송대리인으로 정하고, 위 사건에 관하여 다음 권한을 위임합니다.
                </p>

                {/* 8대 수권사항 */}
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-200 font-sans space-y-1.5 text-[11px]">
                  <span className="font-bold block text-slate-800 mb-1">【 수 권 사 항 】</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p1')}>
                      {powers.p1 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>1. 일체의 소송행위, 반소의 제기 및 응소</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p2')}>
                      {powers.p2 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>2. 소의 취하, 화해, 청구의 포기 및 인낙</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p3')}>
                      {powers.p3 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>3. 복대리인의 선임</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p4')}>
                      {powers.p4 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>4. 공탁물의 납입 및 공탁금과 이자의 수령</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p5')}>
                      {powers.p5 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>5. 담보권의 실행, 강제집행 신청 및 취하</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p6')}>
                      {powers.p6 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>6. 보정명령에 대한 답변 및 서류 제출</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p7')}>
                      {powers.p7 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>7. 변제계획안의 작성, 수정 및 인가신청</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => togglePower('p8')}>
                      {powers.p8 ? <CheckSquare className="w-3.5 h-3.5 text-brand" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                      <span>8. 법원 송달물의 영수</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 법무법인인 경우: 담당변호사 지정서 세트 포함 */}
              {attorneyType === 'lawfirm' && (
                <div className="mt-4 pt-4 border-t border-dashed border-slate-300 space-y-3 font-sans">
                  <div className="text-center">
                    <h2 className="text-base font-bold tracking-wider">담 당 변 호 사 지 정 서</h2>
                    <p className="text-[10px] text-slate-500">(변호사법 제50조 제1항)</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <p>
                      위 사건에 관하여 당 법무법인은 다음 변호사를 담당변호사로 지정합니다.
                    </p>
                    <div className="pl-4 font-bold text-slate-800 space-y-0.5 text-xs">
                      {assignedLawyers.map((name, idx) => (
                        <p key={idx}>· 담당변호사: {name}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 날짜 및 서명날인부 */}
            <div className="pt-8 text-center space-y-5 font-serif">
              <p className="text-sm font-bold">{new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일</p>
              
              <div className="flex justify-around items-end text-xs font-sans">
                <div>
                  <span className="text-slate-500 block text-[10px]">위임인(신청인)</span>
                  <span className="font-bold text-sm text-slate-900">{clientName}</span>
                  <span className="inline-block ml-2 border border-slate-300 px-2 py-0.5 text-[10px] text-slate-400 rounded">
                    (서명 또는 날인)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">수임인(대리인)</span>
                  <span className="font-bold text-sm text-slate-900">{lawFirmName}</span>
                  <span className="inline-block ml-2 border border-slate-300 px-2 py-0.5 text-[10px] text-slate-400 rounded">
                    (직인)
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <p className="text-base font-bold font-serif tracking-widest text-slate-800">{courtName} 귀중</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
