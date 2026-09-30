import { ArrowLeft, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { calculateKoreanAgeInfo } from '../../../services/documents/familyParserService';
import type { FamilyMemberItem } from '../../../types/incomeExpenseTypes';
import type { MyPageModel } from './useMyPageModel';

/**
 * 내 상황 체크 0~6번 상세 항목 수정 폼 (MyPageView에서 분리)
 */
export default function BlueprintEditForm({ vm }: { vm: MyPageModel }) {
  const {
    activeRequest, clientFamilyDocInputRef, handleClientFamilyDocUpload, handleDebtChange, handleFieldChange,
    isCompact, isParsingClientFamilyDoc, onNavigateToChat, profile, setIsEditingBlueprint, setUserAlias,
    userAlias,
  } = vm;
  if (!profile) return null;
  return (
    <div className="space-y-5 pt-3 border-t border-slate-200 dark:border-slate-800 animate-fadeIn text-left">
      {/* 0. 의뢰인 인적사항 및 거주지 / 근무지 관할 법원 설정 */}
      <div className="space-y-3.5">
        <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">0. 의뢰인 기본 인적사항 및 관할 법원 설정</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-1" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">의뢰인 성명 / 안심가명</label>
            <input id="bp-1" 
              type="text" 
              value={profile.clientName || profile.name || userAlias || ''} 
              onChange={(e) => {
                const val = e.target.value;
                handleFieldChange('clientName', val);
                handleFieldChange('name', val);
                setUserAlias(val);
              }} 
              placeholder="홍길동 또는 안심가명"
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-2" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">연락처 (휴대폰 번호)</label>
            <input id="bp-2" 
              type="tel" 
              value={profile.phone || activeRequest?.phone || ''} 
              onChange={(e) => handleFieldChange('phone', e.target.value)} 
              placeholder="010-0000-0000"
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-3" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">나이 (만)</label>
            <input id="bp-3" 
              type="number" 
              value={profile.age || 0} 
              onChange={(e) => handleFieldChange('age', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-4" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">성별</label>
            <select id="bp-4"
              value={profile.gender || ''}
              onChange={(e) => handleFieldChange('gender', e.target.value || undefined)}
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none"
            >
              <option value="">미선택</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-5" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">거주지역 / 거주지 주소</label>
            <input id="bp-5" 
              type="text" 
              value={profile.residenceRegion || profile.address || ''} 
              onChange={(e) => {
                handleFieldChange('residenceRegion', e.target.value);
                handleFieldChange('address', e.target.value);
              }} 
              placeholder="서울특별시, 경기도 남양주시 등"
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-6" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">거주지 관할 회생 법원</label>
            {/* 값이 없으면 '선택해 주세요'로 둔다 (이전: 비어 있어도 '서울회생법원'이 고른 것처럼 보였음) */}
            <select id="bp-6" 
              value={profile.selectedCourt || ''} 
              onChange={(e) => handleFieldChange('selectedCourt', e.target.value)} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            >
              <option value="">선택해 주세요</option>
              {['서울회생법원', '수원회생법원', '부산회생법원', '인천지방법원', '대전지방법원', '대구지방법원', '광주지방법원', '전주지방법원', '청주지방법원', '춘천지방법원', '창원지방법원', '제주지방법원', '의정부지방법원'].map(court => (
                <option key={court} value={court}>{court}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <label htmlFor="bp-7" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">근무지역 / 사업장 주소</label>
            <input id="bp-7" 
              type="text" 
              value={profile.workLocation || ''} 
              onChange={(e) => handleFieldChange('workLocation', e.target.value)} 
              placeholder="서울특별시 강남구, 경기도 성남시 등"
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-8" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">근무지 관할 회생 법원</label>
            <select id="bp-8" 
              value={profile.workplaceCourt || profile.selectedCourt || ''} 
              onChange={(e) => handleFieldChange('workplaceCourt', e.target.value)} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            >
              <option value="">선택해 주세요</option>
              {['서울회생법원', '수원회생법원', '부산회생법원', '인천지방법원', '대전지방법원', '대구지방법원', '광주지방법원', '전주지방법원', '청주지방법원', '춘천지방법원', '창원지방법원', '제주지방법원', '의정부지방법원'].map(court => (
                <option key={court} value={court}>{court}</option>
              ))}
            </select>
          </div>
        </div>
        {/* 이전: '유리한 법원을 자유롭게 선택' 단정 → 사실 안내 + 변호사 확인 */}
        <p className="text-xs text-slate-600 leading-relaxed pt-0.5 break-keep">
          <strong className="font-bold text-slate-800">관할 법원</strong>: 보통 거주지를 기준으로 정해지고, 경우에 따라 근무지(사업장) 관할 법원에 신청할 수도 있어요. 어느 법원에 낼지는 담당 변호사와 확인하세요.
        </p>
      </div>

      {/* 1. 소득 및 고용 정보 */}
      <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-900 pt-4">
        <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">1. 소득 및 고용 형태</h4>
        <div className="space-y-1">
          <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">고용 형태</label>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {[
              { label: '직장인', value: 'salary' },
              { label: '사업자', value: 'business' },
              { label: '프리랜서', value: 'freelancer' },
              { label: '직장+사업', value: 'both' },
              { label: '일용직', value: 'daily' },
              { label: '무직', value: 'none' },
              { label: '기초수급자', value: 'basic_recipient' },
            ].map(item => {
              const currentEmp = profile.employmentType || (profile.jobType === 'SALARIED' ? 'salary' : profile.jobType === 'BUSINESS' ? 'business' : 'salary');
              const isSelected = currentEmp === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    handleFieldChange('employmentType', item.value);
                    handleFieldChange('jobType', item.value === 'business' ? 'BUSINESS' : 'SALARIED');
                  }}
                  className={`min-h-11 py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                    ? 'bg-brand border-brand text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-9" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">세후 실수령 소득 (월급, 만 원)</label>
            <input id="bp-9" 
              type="number" 
              value={profile.income || 0} 
              onChange={(e) => handleFieldChange('income', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="bp-10" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">월 고정 지출 (통신/보험/교통 등, 만 원)</label>
            <input id="bp-10" 
              type="number" 
              value={profile.monthlyFixedExpenses || 0} 
              onChange={(e) => handleFieldChange('monthlyFixedExpenses', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
        </div>
      </div>

      {/* 2. 가족 구성 (매뉴얼 3-5 실무 기준) */}
      <div className="space-y-4 border-t border-slate-100 dark:border-slate-900 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2 flex items-center gap-1.5">
            <span>2. 가족관계 및 부양가족</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
              만 나이 자동계산 & 등본 연동
            </span>
          </h4>

          {/* 등본/가족관계 서류로 가족 정보 채우기 (파일 입력은 버튼으로 연다) */}
          <div className="flex flex-col items-end gap-1">
            <input
              type="file"
              ref={clientFamilyDocInputRef}
              onChange={handleClientFamilyDocUpload}
              accept="image/*,application/pdf"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              type="button"
              disabled={isParsingClientFamilyDoc}
              onClick={() => clientFamilyDocInputRef.current?.click()}
              aria-describedby="bp-family-doc-notice"
              className="min-h-11 px-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer press-scale disabled:opacity-50 whitespace-nowrap"
            >
              {isParsingClientFamilyDoc ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>서류 읽는 중</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-brand" aria-hidden="true" />
                  <span>등본·가족관계증명서로 채우기</span>
                </>
              )}
            </button>
            {/* 서버(/api/ocr-family)가 Google Gemini로 글자를 읽는다 → 올리기 전에 알린다 */}
            <p id="bp-family-doc-notice" className="max-w-xs text-right text-xs leading-relaxed text-slate-600 break-keep">
              올린 서류 이미지는 글자 인식을 위해 Google Gemini(외부 AI)로 보내져요. 가족 이름·생년월일을 읽어 채운 뒤 직접 확인해 주세요.
            </p>
          </div>
        </div>

        {/* 1) 혼인 여부 (기혼 / 별거 / 미혼 / 이혼 - 그림 3-6) */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-3">
          <div>
            <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">
              혼인 여부
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '기혼', value: 'MARRIED' },
                { label: '별거 (기혼)', value: 'MARRIED_SEPARATED' },
                { label: '미혼', value: 'SINGLE' },
                { label: '이혼', value: 'DIVORCED' },
              ].map(item => {
                const currentMarital = profile.isSeparated 
                  ? 'MARRIED_SEPARATED' 
                  : (profile.maritalStatus === 'MARRIED' || profile.maritalStatus === 'married' ? 'MARRIED' : profile.maritalStatus === 'DIVORCED' || profile.maritalStatus === 'divorced' ? 'DIVORCED' : 'SINGLE');
                const isSelected = currentMarital === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (item.value === 'MARRIED_SEPARATED') {
                        handleFieldChange('maritalStatus', 'MARRIED');
                        handleFieldChange('isSeparated', true);
                      } else if (item.value === 'MARRIED') {
                        handleFieldChange('maritalStatus', 'MARRIED');
                        handleFieldChange('isSeparated', false);
                      } else {
                        handleFieldChange('maritalStatus', item.value);
                        handleFieldChange('isSeparated', false);
                      }
                    }}
                    className={`min-h-11 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand border-brand text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 기혼인 경우: 배우자 경제활동 여부 및 월평균 순수입액 */}
          {(profile.maritalStatus === 'MARRIED' || profile.maritalStatus === 'married') && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">배우자 경제활동 여부</span>
                  <span className="text-xs text-slate-500">배우자가 소득 활동을 하고 있다면 토글을 켜주세요.</span>
                </div>
                {/* 스위치: 이름·상태를 읽을 수 있게 role=switch, 누르는 영역 44px (이전: 이름 없는 24px 버튼, 켜면 배우자 소득 200을 임의로 채움) */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!(profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0))}
                  aria-label="배우자 경제활동 여부"
                  onClick={() => {
                    const current = profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0);
                    handleFieldChange('spouseIsWorking', !current);
                    if (current) {
                      handleFieldChange('spouseIncome', 0);
                    }
                  }}
                  className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className={`relative block w-11 h-6 rounded-full transition-colors ${
                    (profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0)) ? 'bg-brand' : 'bg-slate-300'
                  }`} aria-hidden="true">
                    <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                      (profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0)) ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </span>
                </button>
              </div>

              {(profile.spouseIsWorking ?? ((profile.spouseIncome || 0) > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <label htmlFor="bp-11" className="block text-xs font-bold text-slate-700 dark:text-slate-300">배우자 월평균 순수입액 (만 원)</label>
                    <input id="bp-11"
                      type="number"
                      value={profile.spouseIncome || ''}
                      onChange={e => handleFieldChange('spouseIncome', Math.max(0, Number(e.target.value)))}
                      placeholder="예: 250"
                      className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-2.5 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="bp-12" className="block text-xs font-bold text-slate-700 dark:text-slate-300">배우자 소유 재산액 (만 원)</label>
                    <input id="bp-12"
                      type="number"
                      value={profile.spouseAsset || 0}
                      onChange={e => handleFieldChange('spouseAsset', Math.max(0, Number(e.target.value)))}
                      placeholder="예: 1000"
                      className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-2.5 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 이혼인 경우 양육비 수령/지급 */}
          {(profile.maritalStatus === 'DIVORCED' || profile.maritalStatus === 'divorced') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-900 mt-2">
              <div className="space-y-1">
                <label htmlFor="bp-13" className="block text-xs font-bold text-slate-700 dark:text-slate-300">월 양육비 수령액 (만 원)</label>
                <input id="bp-13"
                  type="number"
                  value={profile.childSupportReceived || 0}
                  onChange={e => handleFieldChange('childSupportReceived', Math.max(0, Number(e.target.value)))}
                  className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-2.5 text-base font-bold focus:ring-1 focus:ring-brand"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bp-14" className="block text-xs font-bold text-slate-700 dark:text-slate-300">월 양육비 지급액 (만 원)</label>
                <input id="bp-14"
                  type="number"
                  value={profile.childSupportPaid || 0}
                  onChange={e => handleFieldChange('childSupportPaid', Math.max(0, Number(e.target.value)))}
                  className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-2.5 text-base font-bold focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2) 미성년 자녀 수 (동거 / 비동거 스텝퍼 - 그림 3-6) */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 동거 중인 미성년 자녀 수 */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">동거 중인 미성년 자녀 수</span>
                <span className="text-xs text-slate-400">부양가족 100% 반영 대상</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cur = Math.max(0, (profile.minorChildren || 0) - 1);
                    handleFieldChange('minorChildren', cur);
                    handleFieldChange('dependents', cur + (profile.otherDependents || 0));
                  }}
                  aria-label="동거 중인 미성년 자녀 수 줄이기"
                  className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-lg text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  -
                </button>
                <span className="min-w-10 text-center font-bold text-sm text-brand" aria-live="polite">{profile.minorChildren || 0}명</span>
                <button
                  type="button"
                  onClick={() => {
                    const cur = (profile.minorChildren || 0) + 1;
                    handleFieldChange('minorChildren', cur);
                    handleFieldChange('dependents', cur + (profile.otherDependents || 0));
                  }}
                  aria-label="동거 중인 미성년 자녀 수 늘리기"
                  className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-lg text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  +
                </button>
              </div>
            </div>

            {/* 비동거 중인 미성년 자녀 수 */}
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">비동거 중인 미성년 자녀 수</span>
                <span className="text-xs text-slate-400">이혼 양육권 분리 자녀 등</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cur = Math.max(0, (profile.nonCohabitingMinorChildren || 0) - 1);
                    handleFieldChange('nonCohabitingMinorChildren', cur);
                  }}
                  aria-label="비동거 미성년 자녀 수 줄이기"
                  className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-lg text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  -
                </button>
                <span className="min-w-10 text-center font-bold text-sm text-slate-700" aria-live="polite">{profile.nonCohabitingMinorChildren || 0}명</span>
                <button
                  type="button"
                  onClick={() => {
                    const cur = (profile.nonCohabitingMinorChildren || 0) + 1;
                    handleFieldChange('nonCohabitingMinorChildren', cur);
                  }}
                  aria-label="비동거 미성년 자녀 수 늘리기"
                  className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-lg text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3) 동거여부 토글 버튼군 (부, 모, 배우자, 부모 부양여부 - 그림 3-7) */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">동거 및 부양 여부</span>
            <span className="text-xs text-slate-500">실질 동거 및 부양 시 활성화</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'cohabitingFather', label: '부 (아버지)', desc: '동거 중' },
              { key: 'cohabitingMother', label: '모 (어머니)', desc: '동거 중' },
              { key: 'cohabitingSpouse', label: '배우자', desc: '동거 중' },
              { key: 'supportParents', label: '부모 부양', desc: '실질 부양 인정' },
            ].map(toggleItem => {
              const isChecked = !!(profile as any)[toggleItem.key];
              return (
                <button
                  key={toggleItem.key}
                  type="button"
                  onClick={() => {
                    handleFieldChange(toggleItem.key, !isChecked);
                    if (toggleItem.key === 'supportParents') {
                      const add = !isChecked ? 1 : 0;
                      handleFieldChange('otherDependents', add);
                      handleFieldChange('dependents', (profile.minorChildren || 0) + add);
                    }
                  }}
                  className={`min-h-11 p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <span className="block text-xs font-bold">{toggleItem.label}</span>
                  <span className="text-xs opacity-80">{isChecked ? '✓ 체크됨' : toggleItem.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4) 개별 가족 구성원 리스트 (자녀 생년월일 & 만 나이 자동계산) */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                가족 구성원 명세 (자녀 생년월일 & 만 나이)
              </span>
              <span className="text-xs text-slate-500">
                생년월일을 입력하면 미성년자 나이가 자동으로 계산되어 부양가족에 산정됩니다.
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                const currentList = profile.familyMembers || [];
                // 빈 행을 추가한다(이전: 2016.03.15생 동거 자녀·부양가족 적격으로 미리 채워 부양가족 수가 실제와 달라짐)
                const newM: FamilyMemberItem = {
                  id: `client_fam_${Date.now()}`,
                  relationship: '',
                  name: '',
                  birthDate: '',
                  cohabitationStatus: '' as FamilyMemberItem['cohabitationStatus'],
                  cohabitationPeriod: '',
                  isSupportedByDebtor: false,
                  hasIncome: false,
                  jobAndIncomeDetail: '',
                  isEligibleDependent: false,
                };
                const updated = [...currentList, newM];
                handleFieldChange('familyMembers', updated);
                // 미성년 자녀 수 자동 카운트 갱신
                const minorCount = updated.filter((m: any) => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
                handleFieldChange('minorChildren', minorCount);
                handleFieldChange('dependents', minorCount + (profile.otherDependents || 0));
              }}
              className="min-h-11 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer press-scale shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>가족 추가</span>
            </button>
          </div>

          {/* 구성원 카드 리스트 */}
          <div className="space-y-2">
            {(!profile.familyMembers || profile.familyMembers.length === 0) ? (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-500">
                등록된 가족 구성원이 없습니다. 위의 <strong>[등본·가족관계증명서로 채우기]</strong> 버튼이나 <strong>[+ 가족 추가]</strong>를 눌러주세요.
              </div>
            ) : (
              profile.familyMembers.map((member: FamilyMemberItem, idx: number) => {
                const ageInfo = calculateKoreanAgeInfo(member.birthDate);
                return (
                  <div key={member.id || idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <input
                        type="text"
                        value={member.relationship}
                        onChange={e => {
                          const val = e.target.value;
                          const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? { ...m, relationship: val } : m);
                          handleFieldChange('familyMembers', updated);
                        }}
                        className="min-h-11 w-14 p-1.5 border border-slate-200 dark:border-slate-800 rounded text-center font-bold bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        placeholder="관계"
                      />
                      <input
                        type="text"
                        value={member.name}
                        onChange={e => {
                          const val = e.target.value;
                          const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? { ...m, name: val } : m);
                          handleFieldChange('familyMembers', updated);
                        }}
                        className="min-h-11 w-20 p-1.5 border border-slate-200 dark:border-slate-800 rounded font-medium bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        placeholder="성명"
                      />
                    </div>

                    {/* 생년월일 & 만 나이 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={member.birthDate}
                        placeholder="YYYY.MM.DD"
                        onChange={e => {
                          const val = e.target.value;
                          const newAge = calculateKoreanAgeInfo(val);
                          const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? {
                            ...m,
                            birthDate: val,
                            parsedAge: newAge.fullAge,
                            isMinor: newAge.isMinor,
                            isEligibleDependent: newAge.defaultEligibleDependent
                          } : m);
                          handleFieldChange('familyMembers', updated);

                          // 미성년 자녀 수 자동 재집계
                          const minorCount = updated.filter((m: any) => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
                          handleFieldChange('minorChildren', minorCount);
                          handleFieldChange('dependents', minorCount + (profile.otherDependents || 0));
                        }}
                        className="min-h-11 w-28 p-1.5 border border-slate-200 dark:border-slate-800 rounded font-mono text-center font-bold bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                      />
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${ageInfo.badgeColorClass}`}>
                        {ageInfo.badgeText}
                      </span>
                    </div>

                    {/* 동거 여부 및 삭제 */}
                    <div className="flex items-center gap-2">
                      <select
                        value={member.cohabitationStatus}
                        onChange={e => {
                          const val = e.target.value as any;
                          const updated = profile.familyMembers!.map((m: any, i: number) => i === idx ? { ...m, cohabitationStatus: val } : m);
                          handleFieldChange('familyMembers', updated);
                        }}
                        className="min-h-11 p-1.5 border border-slate-200 dark:border-slate-900 rounded bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-base"
                        aria-label="동거 여부"
                      >
                        {!member.cohabitationStatus && <option value="" disabled>동거 여부</option>}
                        <option value="동거">동거</option>
                        <option value="별거">별거</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = profile.familyMembers!.filter((_: any, i: number) => i !== idx);
                          handleFieldChange('familyMembers', updated);
                          const minorCount = updated.filter((m: any) => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
                          handleFieldChange('minorChildren', minorCount);
                          handleFieldChange('dependents', minorCount + (profile.otherDependents || 0));
                        }}
                        className="min-h-11 p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 5) 추가생계비 및 추가지출 사유 (그림 3-8 완벽 구현) */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                추가생계비 및 추가지출 사유 신청
              </span>
              <span className="text-xs text-slate-500">
                기준중위소득 60%를 초과하는 필수 주거비, 의료비, 교육비 등 추가 공제를 신청합니다.
              </span>
            </div>

            {/* 5대 항목 추가 버튼군 (그림 3-8) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { category: 'living' as const, label: '+생계비' },
                { category: 'housing' as const, label: '+주거비' },
                { category: 'medical' as const, label: '+의료비' },
                { category: 'education' as const, label: '+교육비' },
                { category: 'other' as const, label: '+기타' },
              ].map(btn => (
                <button
                  key={btn.category}
                  type="button"
                  onClick={() => {
                    const currentList = profile.extraExpensesList || [];
                    const categoryName = btn.category === 'living' ? '생계비' :
                                         btn.category === 'housing' ? '주거비' :
                                         btn.category === 'medical' ? '의료비' :
                                         btn.category === 'education' ? '교육비' : '기타';
                    const newItem = {
                      id: `extra_${Date.now()}_${btn.category}`,
                      category: btn.category,
                      categoryLabel: categoryName,
                      amount: 30, // 기본 30만원
                      reason: ''
                    };
                    handleFieldChange('extraExpensesList', [...currentList, newItem]);
                  }}
                  className="min-h-11 px-2 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer press-scale"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* 추가생계비 행 리스트 */}
          <div className="space-y-2">
            {(!profile.extraExpensesList || profile.extraExpensesList.length === 0) ? (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-400">
                추가생계비 신청 항목이 없습니다. 기준 생계비 외에 지속 지출되는 비용이 있다면 위의 <strong>[+주거비], [+의료비]</strong> 등을 클릭해 등록하세요.
              </div>
            ) : (
              profile.extraExpensesList.map((item, index) => (
                <div key={item.id || index} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = profile.extraExpensesList!.filter((_, i) => i !== index);
                      handleFieldChange('extraExpensesList', updated);
                    }}
                    className="w-11 h-11 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center justify-center font-bold cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label={`${item.categoryLabel || '추가생계비'} 항목 삭제`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <span className="w-16 px-2 py-1 bg-slate-100 dark:bg-slate-800 font-bold text-center rounded text-slate-700 dark:text-slate-300 shrink-0">
                    {item.categoryLabel}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-slate-500 font-medium">추가 생계비:</span>
                    <input
                      type="number"
                      value={item.amount || 0}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value));
                        const updated = profile.extraExpensesList!.map((x, i) => i === index ? { ...x, amount: val } : x);
                        handleFieldChange('extraExpensesList', updated);
                      }}
                      className="min-h-11 w-20 p-1.5 border border-slate-200 dark:border-slate-800 rounded font-bold text-right bg-slate-50 dark:bg-slate-950"
                    />
                    <span className="text-slate-600 font-bold">만 원</span>
                  </div>

                  <div className="flex-1 min-w-[180px]">
                    <input
                      type="text"
                      value={item.reason || ''}
                      placeholder="추가지출 사유 (예: 월세 기준주거비 초과분, 만성질환 정기 약제비 등)"
                      onChange={e => {
                        const val = e.target.value;
                        const updated = profile.extraExpensesList!.map((x, i) => i === index ? { ...x, reason: val } : x);
                        handleFieldChange('extraExpensesList', updated);
                      }}
                      className="min-h-11 w-full p-1.5 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950 text-base"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. 주거 및 자산 */}
      <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-900 pt-4">
        <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">3. 주거 유형 및 재산 가치 설정</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-15" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">거주 주택 유형</label>
            <select id="bp-15"
              value={profile.housingType || (profile.rentalDeposit !== undefined && profile.rentalDeposit > 0 ? 'rent' : 'free')}
              onChange={(e) => {
                const val = e.target.value;
                handleFieldChange('housingType', val);
                if (val === 'free') {
                  handleFieldChange('rentalDeposit', 0);
                  handleFieldChange('rentCost', 0);
                } else if (val === 'rent') {
                  if (!profile.rentalDeposit) handleFieldChange('rentalDeposit', 1000);
                  handleFieldChange('housingContractHolder', profile.housingContractHolder || 'self');
                } else if (val === 'jeonse') {
                  if (!profile.rentalDeposit) handleFieldChange('rentalDeposit', 10000);
                  handleFieldChange('rentCost', 0);
                  handleFieldChange('housingContractHolder', profile.housingContractHolder || 'self');
                } else if (val === 'owned' || val === 'dormitory') {
                  handleFieldChange('rentalDeposit', 0);
                  handleFieldChange('rentCost', 0);
                }
              }}
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none"
            >
              <option value="rent">월세 (보증금+월세)</option>
              <option value="jeonse">전세 (보증금만)</option>
              <option value="owned">자가 (본인 소유)</option>
              <option value="free">무상 거주 (보증금 없음)</option>
              <option value="dormitory">기숙사 / 사택</option>
            </select>
          </div>

          {profile.rentalDeposit !== undefined && profile.rentalDeposit > 0 && (
            <>
              <div className="space-y-1">
                <label htmlFor="bp-16" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">임대차 계약 명의자</label>
                <select id="bp-16"
                  value={profile.housingContractHolder || 'self'}
                  onChange={(e) => {
                    const val = e.target.value as 'self' | 'spouse' | 'others';
                    if (val === 'others') {
                      handleFieldChange('housingContractHolder', 'others');
                      handleFieldChange('rentalDeposit', 0);
                      handleFieldChange('rentCost', 0);
                      handleFieldChange('depositLoan', 0);
                      handleFieldChange('housingType', 'free');
                    } else {
                      handleFieldChange('housingContractHolder', val);
                    }
                  }}
                  className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none"
                >
                  <option value="self">본인</option>
                  <option value="spouse">배우자</option>
                  <option value="others">지인, 가족, 회사 등 (무상거주 처리)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="bp-17" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">임차 보증금 (만 원)</label>
                <input id="bp-17" 
                  type="number" 
                  value={profile.rentalDeposit || 0} 
                  onChange={(e) => handleFieldChange('rentalDeposit', Math.max(0, Number(e.target.value)))} 
                  className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
                />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-18" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">월세 (만 원)</label>
            <input id="bp-18" 
              type="number" 
              value={profile.rentCost || 0} 
              onChange={(e) => handleFieldChange('rentCost', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-19" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">보증금 대출금 (만 원)</label>
            <input id="bp-19" 
              type="number" 
              value={profile.depositLoan || 0} 
              onChange={(e) => handleFieldChange('depositLoan', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-20" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">본인 재산 총액 (만 원)</label>
            <input id="bp-20" 
              type="number" 
              value={profile.myAssets || 0} 
              onChange={(e) => handleFieldChange('myAssets', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
            <span className="text-xs text-slate-500 block">※ 예금, 보험 해지환급금, 자동차 시세 등 본인 명의 자산 합계</span>
          </div>

          {profile.maritalStatus !== 'MARRIED' && (
            <div className="space-y-1">
              <label htmlFor="bp-21" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">배우자 소유 재산액 (만 원)</label>
              <input id="bp-21" 
                type="number" 
                value={profile.spouseAsset || 0} 
                onChange={(e) => handleFieldChange('spouseAsset', Math.max(0, Number(e.target.value)))} 
                className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-22" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">예상 퇴직금 (만 원)</label>
            <input id="bp-22" 
              type="number" 
              value={profile.retirementPay || 0} 
              onChange={(e) => handleFieldChange('retirementPay', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">퇴직연금 가입 종류</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '퇴직연금 (DB/DC)', value: 'pension' },
                { label: '일반 퇴직금', value: 'none' },
                { label: '잘 모름', value: 'unknown' }
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleFieldChange('retirementPensionType', item.value)}
                  className={`min-h-11 py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    profile.retirementPensionType === item.value
                    ? 'bg-brand border-brand text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {profile.retirementPensionType === 'pension' && (
              <span className="text-[12px] text-emerald-500 block mt-1">
                🛡️ 법률 보호 확인: 퇴직연금 가입 상태이므로 자산 반영에서 완전히 배제(0% 가산)됩니다.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. 추가 생계비 */}
      <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-900 pt-4">
        <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">4. 추가 생계비 (월 기준)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-23" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">의료비 (만 원)</label>
            <input id="bp-23" 
              type="number" 
              value={profile.medicalCost || 0} 
              onChange={(e) => handleFieldChange('medicalCost', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-24" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">교육비 (만 원)</label>
            <input id="bp-24" 
              type="number" 
              value={profile.educationCost || 0} 
              onChange={(e) => handleFieldChange('educationCost', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bp-25" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">특수교육비 (만 원)</label>
            <input id="bp-25" 
              type="number" 
              value={profile.specialEducationCost || 0} 
              onChange={(e) => handleFieldChange('specialEducationCost', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
            <span className="text-xs text-slate-500 block">※ 장애인 자녀 등 특수교육 관련 지출</span>
          </div>
        </div>
      </div>

      {/* 5. 채무 구성 */}
      <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-900 pt-4">
        <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">5. 채무 구성 설정</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-26" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">은행 대출 (만 원)</label>
            <input id="bp-26" 
              type="number" 
              value={profile.debtTypes?.banks || 0} 
              onChange={(e) => handleDebtChange('banks', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="bp-27" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">카드사/캐피탈 (만 원)</label>
            <input id="bp-27" 
              type="number" 
              value={profile.debtTypes?.cards || 0} 
              onChange={(e) => handleDebtChange('cards', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="bp-28" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">저축은행/대부업/기타 (만 원)</label>
            <input id="bp-28" 
              type="number" 
              value={profile.debtTypes?.personals || 0} 
              onChange={(e) => handleDebtChange('personals', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-29" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">국세/세금 체납 (만 원)</label>
            <input id="bp-29" 
              type="number" 
              value={profile.priorityDebt || 0} 
              onChange={(e) => handleFieldChange('priorityDebt', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
            <span className="text-xs text-red-500 block">※ 국세 체납 채무는 우선변제 채무에 해당하여 회생 변제금에서 우선 순위 공제됩니다.</span>
          </div>

          <div className="space-y-1">
            <label htmlFor="bp-30" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">최근 1년 이내 신규 대출액 (만 원)</label>
            <input id="bp-30" 
              type="number" 
              value={profile.debtTypes?.recentLoans || 0} 
              onChange={(e) => {
                const updatedDebtTypes = { ...profile.debtTypes, recentLoans: Math.max(0, Number(e.target.value)) };
                handleFieldChange('debtTypes', updatedDebtTypes);
              }} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
            <span className="text-xs text-amber-600 dark:text-amber-400 block">※ 1년 이내 신규 대출이 총 채무의 30%를 넘으면 법원이 사용처를 자세히 확인할 수 있습니다.</span>
          </div>
        </div>
      </div>

      {/* 6. 투자/사행성 채무 및 특수 조건 */}
      <div className="space-y-3.5 border-t border-slate-100 dark:border-slate-900 pt-4">
        <h4 className="text-xs font-bold text-slate-500 border-l-2 border-brand pl-2">6. 투자/사행성 채무 및 특수 조건</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="bp-31" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">주식/코인 투자 손실액 (만 원)</label>
            <input id="bp-31" 
              type="number" 
              value={profile.speculativeLoss || 0} 
              onChange={(e) => handleFieldChange('speculativeLoss', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="bp-32" className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">도박/사행성 손실 채무액 (만 원)</label>
            <input id="bp-32" 
              type="number" 
              value={profile.gamblingLoss || 0} 
              onChange={(e) => handleFieldChange('gamblingLoss', Math.max(0, Number(e.target.value)))} 
              className="min-h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl p-3 text-base font-bold focus:ring-1 focus:ring-brand focus:outline-none" 
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">24개월 특례 조건</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: '해당 없음', value: 'none' },
              { label: '기초수급자', value: 'basic_recipient' },
              { label: '중증장애인', value: 'severe_disability' },
              { label: '65세 이상 고령', value: 'elderly' },
              { label: '한부모 가족', value: 'single_parent' },
              { label: '전세사기 피해자', value: 'rent_fraud' },
            ].map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => handleFieldChange('specialCondition', item.value)}
                className={`min-h-11 py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  (profile.specialCondition || 'none') === item.value
                  ? 'bg-brand border-brand text-white shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {profile.specialCondition && profile.specialCondition !== 'none' && (
            <span className="text-xs font-bold text-emerald-700 block mt-1">
              24개월 특례 조건 해당: 변제기간이 36개월에서 24개월로 단축될 수 있어요.
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300">현재 법적 조치 상황</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: '추심 전화/문자', value: 'collection_call' },
              { label: '법원 지급명령', value: 'court_order' },
              { label: '계좌/채권 압류', value: 'seizure' },
              { label: '부동산 압류', value: 'property_seizure' },
              { label: '신용등급 하락', value: 'credit_drop' },
              { label: '급여 압류', value: 'wage_garnishment' },
            ].map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  const current = profile.legalActions || [];
                  const updated = current.includes(item.value)
                    ? current.filter(v => v !== item.value)
                    : [...current, item.value];
                  handleFieldChange('legalActions', updated);
                }}
                className={`min-h-11 py-2 px-1 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  (profile.legalActions || []).includes(item.value)
                  ? 'bg-red-500 border-red-500 text-white shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500 block">※ 해당 항목을 클릭하여 선택/해제합니다. 복수 선택 가능합니다.</span>
        </div>
      </div>

      {/* 저장 완료 및 취소 버튼 */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {!isCompact && (
          <button
            type="button"
            onClick={() => setIsEditingBlueprint(false)}
            className="min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            수정 닫기
          </button>
        )}
        {isCompact && (
          <button
            type="button"
            onClick={() => onNavigateToChat()}
            className="min-h-11 flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            채팅으로 돌아가기
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            // 입력값은 바뀔 때마다 바로 반영된다. 이 버튼은 편집을 마치는 역할만 한다
            toast.success('수정한 내용이 반영되었습니다.', {
              description: '예상 변제금과 채무 지표도 새 값으로 다시 계산했습니다.',
              duration: 3000,
            });
            if (!isCompact) setIsEditingBlueprint(false);
          }}
          className="flex items-center gap-2 min-h-11 px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-bold shadow-sm transition-colors cursor-pointer active:scale-[0.98] whitespace-nowrap"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          수정 완료
        </button>
      </div>
    </div>
  );
}
