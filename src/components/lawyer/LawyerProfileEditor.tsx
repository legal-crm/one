import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Save, Eye, Upload, Plus, Trash2, MapPin, Building, BookOpen,
  Shield, Award, Briefcase, Users, GraduationCap, Scale, CheckCircle,
  ChevronRight, Phone, Home, ExternalLink, Navigation, Copy, Link, Globe,
  Image as ImageIcon
} from 'lucide-react';
import type { User, LawFirm } from '../../types';
import { mockLawFirms } from '../../data';

interface LawyerProfileEditorProps {
  lawyer: User;
  onSave: (updatedLawyer: User) => void;
  onClose: () => void;
}

export default function LawyerProfileEditor({ lawyer, onSave, onClose }: LawyerProfileEditorProps) {
  // ── 편집 상태 (임시) ──
  const [form, setForm] = useState<User>({ ...lawyer });
  const [fieldsText, setFieldsText] = useState(lawyer.fields.join(', '));
  const [specialtiesText, setSpecialtiesText] = useState((lawyer.specialties || lawyer.fields).join(', '));
  const [newCareerItem, setNewCareerItem] = useState('');
  const [previewTab, setPreviewTab] = useState<'home' | 'info'>('home');
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 폼 업데이트 헬퍼 ──
  const updateForm = (patch: Partial<User>) => {
    setForm(prev => ({ ...prev, ...patch }));
  };

  const handleFieldsChange = (val: string) => {
    setFieldsText(val);
    updateForm({ fields: val.split(',').map(s => s.trim()).filter(Boolean) });
  };

  const handleSpecialtiesChange = (val: string) => {
    setSpecialtiesText(val);
    updateForm({ specialties: val.split(',').map(s => s.trim()).filter(Boolean) });
  };

  const handleAddCareer = () => {
    if (!newCareerItem.trim()) return;
    const updated = [...(form.career || []), newCareerItem.trim()];
    updateForm({ career: updated });
    setNewCareerItem('');
  };

  const handleRemoveCareer = (idx: number) => {
    const updated = (form.career || []).filter((_, i) => i !== idx);
    updateForm({ career: updated });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateForm({ avatarData: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSave(form);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  // ── 미리보기용 데이터 ──
  const firm = mockLawFirms.find(f => f.id === form.lawFirmId);
  const displayName = form.name.replace(' 변호사', '');
  const previewAvatar = form.avatarData || form.avatar;

  // ── 오피스 정보 (미리보기용) ──
  const getOfficeInfo = () => {
    const firmName = firm?.name || form.firmName || '법무법인 한빛';
    const region = form.region || '서울';
    return {
      firmName: firmName.includes('법무') || firmName.includes('법률') ? firmName : `${firmName} 법률사무소`,
      address: region.includes('부산') ? '부산광역시 연제구 법원남로 15, 거제빌딩 7층'
        : region.includes('경기') || region.includes('수원') ? '경기도 수원시 영통구 광교중앙로 248, 광교법조타워 4층'
        : '서울특별시 서초구 서초대로 250, 스타빌딩 6층',
      phone: region.includes('부산') ? '051-507-9012' : region.includes('경기') ? '031-215-5678' : '02-588-1234',
      websiteUrl: form.websiteUrl || 'https://hanbitlaw.co.kr',
      youtubeUrl: form.youtubeUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(displayName + ' 변호사')}`,
      blogUrl: form.blogUrl || `https://section.blog.naver.com/Search/Post.naver?keyword=${encodeURIComponent(displayName + ' 변호사')}`,
    };
  };
  const officeInfo = getOfficeInfo();

  // ── 입력 필드 스타일 ──
  const inputCls = 'w-full bg-[#0B0F19] border border-[#1E293B]/80 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors';
  const labelCls = 'block text-xs font-bold text-slate-400 mb-1.5';
  const sectionCls = 'space-y-4 bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5';

  return createPortal(
    <div className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
      <div
        className="relative w-full max-w-[1400px] h-[90vh] bg-[#0B0F19] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── 헤더 바 ── */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#111622] border-b border-[#1E293B]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-indigo-500/30">
              <img src={previewAvatar} alt={form.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">{form.name} 프로필 편집</h2>
              <p className="text-xs text-slate-500 font-medium">변경사항은 저장 버튼을 누르면 반영됩니다</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFullPreview(true)}
              className="flex items-center gap-1.5 bg-[#1E293B] hover:bg-[#273548] text-slate-300 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-[0.98]"
            >
              <Eye className="w-4 h-4" />
              <span className="whitespace-nowrap">전체 미리보기</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-extrabold transition-all cursor-pointer active:scale-[0.98] shadow-md"
            >
              <Save className="w-4 h-4" />
              <span className="whitespace-nowrap">저장</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[#1E293B] hover:bg-red-600/80 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 메인 본문: 좌 편집 + 우 미리보기 ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ════════════════════════════════
              좌측: 편집 폼
          ════════════════════════════════ */}
          <div className="w-full lg:w-[55%] overflow-y-auto p-6 space-y-5 border-r border-[#1E293B]/40">

            {/* § 기본 정보 */}
            <div className={sectionCls}>
              <h3 className="text-sm font-extrabold text-indigo-400 flex items-center gap-1.5">
                <Building className="w-4 h-4" />
                기본 정보
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>변호사명</label>
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={e => updateForm({ name: e.target.value })}
                    placeholder="홍길동 변호사"
                  />
                </div>
                <div>
                  <label className={labelCls}>소속 법무법인명</label>
                  <input
                    className={inputCls}
                    value={form.firmName || ''}
                    onChange={e => updateForm({ firmName: e.target.value })}
                    placeholder="법무법인 한빛"
                  />
                </div>
                <div>
                  <label className={labelCls}>활동 지역</label>
                  <input
                    className={inputCls}
                    value={form.region}
                    onChange={e => updateForm({ region: e.target.value })}
                    placeholder="서울"
                  />
                </div>
                <div>
                  <label className={labelCls}>한줄 캐치프레이즈</label>
                  <input
                    className={inputCls}
                    value={form.catchphrase || ''}
                    onChange={e => updateForm({ catchphrase: e.target.value })}
                    placeholder="빠르고 안전한 회생의 시작"
                  />
                </div>
              </div>
            </div>

            {/* § 프로필 이미지 */}
            <div className={sectionCls}>
              <h3 className="text-sm font-extrabold text-indigo-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" />
                프로필 이미지
              </h3>
              <div className="flex items-center gap-5">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#1E293B]/60 bg-[#0B0F19] shrink-0">
                  <img src={previewAvatar} alt="프로필" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-2 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 bg-[#1E293B] hover:bg-[#273548] text-slate-300 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <Upload className="w-4 h-4" />
                    <span>이미지 업로드</span>
                  </button>
                  <p className="text-xs text-slate-600">JPG, PNG, WebP (최대 5MB 권장)</p>
                </div>
              </div>
            </div>

            {/* § 전문 분야 */}
            <div className={sectionCls}>
              <h3 className="text-sm font-extrabold text-indigo-400 flex items-center gap-1.5">
                <Scale className="w-4 h-4" />
                전문 분야
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>주요 전문 분야 (콤마로 구분)</label>
                  <input
                    className={inputCls}
                    value={fieldsText}
                    onChange={e => handleFieldsChange(e.target.value)}
                    placeholder="개인회생, 개인파산, 신용회복"
                  />
                  {form.fields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.fields.map(f => (
                        <span key={f} className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-lg font-bold">#{f}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>상세 전문 분야 (콤마로 구분)</label>
                  <input
                    className={inputCls}
                    value={specialtiesText}
                    onChange={e => handleSpecialtiesChange(e.target.value)}
                    placeholder="개인회생 인가, 보정명령 대응, 채권추심 차단"
                  />
                </div>
              </div>
            </div>

            {/* § 소개 & 경력 */}
            <div className={sectionCls}>
              <h3 className="text-sm font-extrabold text-indigo-400 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                소개 & 경력
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>변호사 소개글</label>
                  <textarea
                    className={`${inputCls} min-h-[100px] resize-y`}
                    value={form.bio}
                    onChange={e => updateForm({ bio: e.target.value })}
                    placeholder="변호사 소개글을 입력하세요..."
                  />
                </div>
                <div>
                  <label className={labelCls}>경력 사항</label>
                  <div className="space-y-2">
                    {(form.career || []).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex-1 bg-[#0B0F19] border border-[#1E293B]/60 rounded-xl py-1.5 px-3 text-sm text-slate-300">
                          {item}
                        </span>
                        <button
                          onClick={() => handleRemoveCareer(idx)}
                          className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        className={`${inputCls} flex-1`}
                        value={newCareerItem}
                        onChange={e => setNewCareerItem(e.target.value)}
                        placeholder="경력 항목을 입력 후 추가 버튼 클릭"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCareer(); } }}
                      />
                      <button
                        onClick={handleAddCareer}
                        className="flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-3 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        추가
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>학력</label>
                    <input
                      className={inputCls}
                      value={form.education || ''}
                      onChange={e => updateForm({ education: e.target.value })}
                      placeholder="법학전문대학원 졸업"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>변호사 자격</label>
                    <input
                      className={inputCls}
                      value={form.certYear || ''}
                      onChange={e => updateForm({ certYear: e.target.value })}
                      placeholder="제7회 변호사시험 합격 (2018년)"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>소속 변호사회</label>
                    <input
                      className={inputCls}
                      value={form.barAssociation || ''}
                      onChange={e => updateForm({ barAssociation: e.target.value })}
                      placeholder="서울지방변호사회"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>관할 법원</label>
                    <input
                      className={inputCls}
                      value={form.courtJurisdiction || ''}
                      onChange={e => updateForm({ courtJurisdiction: e.target.value })}
                      placeholder="서울회생법원"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* § 실적 정보 */}
            <div className={sectionCls}>
              <h3 className="text-sm font-extrabold text-indigo-400 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                실적 정보
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>누적 수임 건수</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.totalCases || ''}
                    onChange={e => updateForm({ totalCases: Number(e.target.value) || undefined })}
                    placeholder="842"
                  />
                </div>
                <div>
                  <label className={labelCls}>인가 성공률 (%)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.successRate || ''}
                    onChange={e => updateForm({ successRate: Number(e.target.value) || undefined })}
                    placeholder="98"
                    max={100}
                  />
                </div>
                <div>
                  <label className={labelCls}>평균 변제율 (%)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.avgRepaymentRate || ''}
                    onChange={e => updateForm({ avgRepaymentRate: Number(e.target.value) || undefined })}
                    placeholder="31"
                    max={100}
                  />
                </div>
              </div>
            </div>

            {/* § 관련 링크 */}
            <div className={sectionCls}>
              <h3 className="text-sm font-extrabold text-indigo-400 flex items-center gap-1.5">
                <Link className="w-4 h-4" />
                관련 링크
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      공식 홈페이지 URL
                    </span>
                  </label>
                  <input
                    className={inputCls}
                    value={form.websiteUrl || ''}
                    onChange={e => updateForm({ websiteUrl: e.target.value })}
                    placeholder="https://hanbitlaw.co.kr"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      유튜브 채널 URL
                    </span>
                  </label>
                  <input
                    className={inputCls}
                    value={form.youtubeUrl || ''}
                    onChange={e => updateForm({ youtubeUrl: e.target.value })}
                    placeholder="https://www.youtube.com/@channel"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/></svg>
                      네이버 블로그 URL
                    </span>
                  </label>
                  <input
                    className={inputCls}
                    value={form.blogUrl || ''}
                    onChange={e => updateForm({ blogUrl: e.target.value })}
                    placeholder="https://blog.naver.com/example"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ════════════════════════════════
              우측: 실시간 미리보기
          ════════════════════════════════ */}
          <div className="hidden lg:flex lg:w-[45%] flex-col bg-[#080C14] overflow-hidden">
            <div className="px-5 py-3 bg-[#111622] border-b border-[#1E293B]/40 flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                실시간 미리보기
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewTab('home')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${previewTab === 'home' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  변호사홈
                </button>
                <button
                  onClick={() => setPreviewTab('info')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${previewTab === 'info' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  변호사 정보
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* 미리보기 카드 */}
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-[480px] mx-auto">

                {/* 히어로 섹션 */}
                <div className="relative bg-gradient-to-br from-slate-900 via-[#1e1b4b] to-[#1E3A5F] overflow-hidden">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-1/4 left-1/3 w-[200px] h-[200px] bg-[#1E3A5F]/40 rounded-full blur-[80px]"></div>
                    <div className="absolute bottom-0 right-1/4 w-[150px] h-[150px] bg-indigo-500/30 rounded-full blur-[60px]"></div>
                  </div>

                  <div className="relative z-10 px-5 pt-8 pb-5 flex items-start gap-4">
                    {/* 프로필 사진 */}
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-[2px] border-white/20 shadow-xl">
                        <img src={previewAvatar} alt={form.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-[2px] border-white rounded-full"></div>
                    </div>

                    {/* 기본 정보 */}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-lg font-black text-white truncate">{displayName} 변호사</h3>
                        <div className="bg-[#1E3A5F]/30 border border-[#1E3A5F]/40 rounded-full p-0.5 shrink-0">
                          <CheckCircle className="w-3 h-3 text-sky-300" />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-white/60">
                        <Building className="w-3 h-3 shrink-0" />
                        <span className="font-medium truncate">{form.firmName || firm?.name || '법률사무소'}</span>
                        <span className="text-white/30">·</span>
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{form.region}</span>
                      </div>

                      {/* 전문 분야 태그 */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {form.fields.slice(0, 4).map(f => (
                          <span key={f} className="bg-white/10 border border-white/10 text-white/80 text-[10px] px-1.5 py-0.5 rounded font-bold">#{f}</span>
                        ))}
                      </div>

                      {/* 캐치프레이즈 */}
                      {form.catchphrase && (
                        <p className="text-[11px] text-white/40 font-medium leading-relaxed truncate">
                          "{form.catchphrase}"
                        </p>
                      )}

                      {/* 공식 채널 아이콘 */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                          <Home className="w-3 h-3 text-slate-300" />
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                          <svg className="w-3 h-3 text-slate-300 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-slate-300 fill-current" viewBox="0 0 24 24"><path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 탭 네비게이션 */}
                  <div className="relative z-10 flex border-t border-white/10">
                    {[
                      { key: 'home' as const, label: '변호사홈' },
                      { key: 'info' as const, label: '변호사 정보' },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setPreviewTab(tab.key)}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all cursor-pointer relative ${
                          previewTab === tab.key ? 'text-white' : 'text-white/40'
                        }`}
                      >
                        {tab.label}
                        {previewTab === tab.key && (
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-[2px] bg-[#1E3A5F] rounded-t-full"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 탭 콘텐츠 */}
                <div className="p-4 space-y-4 text-left">

                  {/* TAB: 변호사홈 */}
                  {previewTab === 'home' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* 변호사 소개 */}
                      <div className="bg-gradient-to-r from-[#1E3A5F]/5 to-indigo-500/5 border border-[#1E3A5F]/10 rounded-xl p-4 space-y-2">
                        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#1E3A5F]" />
                          변호사 소개
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {form.bio || '소개글을 입력해주세요.'}
                        </p>
                      </div>

                      {/* 전담 서비스 */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-[#1E3A5F]" />
                          전담 서비스 안내
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { title: '무료 초기 상담', desc: '채무 현황 분석 및 최적 해결 방안 무료 안내', emoji: '💬' },
                            { title: '1:1 밀착 관리', desc: '사건 접수부터 인가까지 전 과정 전담 케어', emoji: '🤝' },
                            { title: '보정명령 긴급 대응', desc: '법원 보정명령 발생 시 48시간 내 즉시 대응', emoji: '⚡' },
                            { title: '신용 회복 가이드', desc: '면책 후 신용 등급 회복 로드맵 무료 제공', emoji: '📈' },
                          ].map(svc => (
                            <div key={svc.title} className="bg-white border border-slate-100 rounded-lg p-3 flex items-start gap-2">
                              <span className="text-sm">{svc.emoji}</span>
                              <div>
                                <h5 className="font-bold text-[11px] text-slate-900">{svc.title}</h5>
                                <p className="text-[10px] text-slate-500 mt-0.5 font-medium leading-tight">{svc.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 사무소 위치 */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#1E3A5F]" />
                            사무소 위치 및 연락처
                          </h4>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                            방문 상담 가능
                          </span>
                        </div>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900">{officeInfo.firmName}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="text-slate-700 font-medium">{officeInfo.address}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-[#1E3A5F]">{officeInfo.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: 변호사 정보 */}
                  {previewTab === 'info' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* 전문 분야 */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-[#1E3A5F]" />
                          전문 분야
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {(form.specialties || form.fields).map(s => (
                            <span key={s} className="bg-[#1E3A5F]/5 border border-[#1E3A5F]/15 text-[#1E3A5F] text-[11px] px-2.5 py-1 rounded-lg font-bold">{s}</span>
                          ))}
                        </div>
                      </div>

                      {/* 인증 뱃지 */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-[#1E3A5F]" />
                          인증 뱃지
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: '대한변협 등록', sub: '도산법 전문', icon: '⚖️' },
                            { label: '회생법원 전담', sub: form.courtJurisdiction || '', icon: '🏛️' },
                            { label: `수임 ${form.totalCases || 100}건+`, sub: '인가 실적', icon: '🏆' },
                          ].map(badge => (
                            <div key={badge.label} className="flex flex-col items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-2.5 shadow-xs text-center">
                              <span className="text-lg">{badge.icon}</span>
                              <div className="text-[10px] font-bold text-slate-900 leading-tight">{badge.label}</div>
                              <div className="text-[9px] text-[#1E3A5F] font-bold">{badge.sub}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 정보 테이블 */}
                      <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                        {[
                          { label: '관할 법원', value: form.courtJurisdiction || `${form.region} 법원`, icon: Building },
                          { label: '경력', value: null, icon: Briefcase, list: form.career },
                          { label: '자격', value: form.certYear || '변호사시험 합격', icon: Award },
                          { label: '소속', value: form.barAssociation || '대한변호사협회', icon: Users },
                          { label: '학력', value: form.education || '법학전문대학원 졸업', icon: GraduationCap },
                        ].map(row => (
                          <div key={row.label} className="flex items-start gap-3 px-3.5 py-2.5">
                            <div className="flex items-center gap-1.5 w-16 shrink-0">
                              <row.icon className="w-3 h-3 text-slate-500" />
                              <span className="text-[10px] text-slate-600 font-bold">{row.label}</span>
                            </div>
                            <div className="flex-1 text-left">
                              {row.list ? (
                                <div className="space-y-0.5">
                                  {row.list.map((item, i) => (
                                    <div key={i} className="text-[10px] text-slate-700 font-medium flex items-start gap-1">
                                      <ChevronRight className="w-2.5 h-2.5 text-[#1E3A5F] mt-0.5 shrink-0" />
                                      <span>{item}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-700 font-medium">{row.value}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* 하단 CTA */}
                <div className="border-t border-slate-100 px-4 py-3 flex justify-end">
                  <div className="w-full bg-[#1E3A5F] text-white font-extrabold py-2.5 px-6 rounded-xl text-xs flex items-center justify-center gap-1.5 opacity-60 pointer-events-none">
                    <span>이 전문가를 직접 선택하여 상담 요청</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── 저장 완료 토스트 ── */}
        {saveToast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-bold animate-fadeIn z-50">
            <CheckCircle className="w-4 h-4" />
            프로필이 저장되었습니다
          </div>
        )}
      </div>

      {/* ── 전체 미리보기 모달 (LawyerProfileModal 스타일) ── */}
      {showFullPreview && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/70 backdrop-blur-sm animate-fadeIn" onClick={() => setShowFullPreview(false)}>
          <div
            className="relative w-full max-w-[720px] my-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh] animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
              <button onClick={() => setShowFullPreview(false)} className="w-9 h-9 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 히어로 섹션 (전체 크기) */}
            <div className="relative bg-gradient-to-br from-slate-900 via-[#1e1b4b] to-[#1E3A5F] overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] bg-[#1E3A5F]/40 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-0 right-1/4 w-[250px] h-[250px] bg-indigo-500/30 rounded-full blur-[80px]"></div>
              </div>

              <div className="relative z-10 px-6 sm:px-8 pt-10 pb-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-[3px] border-white/20 shadow-xl">
                    <img src={previewAvatar} alt={form.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-[3px] border-white rounded-full"></div>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{displayName} 변호사</h1>
                    <div className="bg-[#1E3A5F]/30 border border-[#1E3A5F]/40 rounded-full p-1">
                      <CheckCircle className="w-4 h-4 text-sky-300" />
                    </div>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-white/60">
                    <Building className="w-3.5 h-3.5" />
                    <span className="font-medium">{form.firmName || firm?.name || '법률사무소'}</span>
                    <span className="text-white/30">·</span>
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{form.region}</span>
                  </div>

                  <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
                    {form.fields.map(f => (
                      <span key={f} className="bg-white/10 border border-white/10 text-white/80 text-xs px-2.5 py-1 rounded-lg font-bold">#{f}</span>
                    ))}
                  </div>

                  {form.catchphrase && (
                    <p className="text-sm text-white/50 font-medium leading-relaxed pt-1 max-w-md">
                      "{form.catchphrase}"
                    </p>
                  )}

                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-2">
                    <a href={officeInfo.websiteUrl} target="_blank" rel="noopener noreferrer" className="group w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer">
                      <Home className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
                    </a>
                    <a href={officeInfo.youtubeUrl} target="_blank" rel="noopener noreferrer" className="group w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer">
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-white fill-current transition-colors" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </a>
                    <a href={officeInfo.blogUrl} target="_blank" rel="noopener noreferrer" className="group w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer">
                      <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-white fill-current transition-colors" viewBox="0 0 24 24"><path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/></svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1 text-left">
              {/* 변호사 소개 */}
              <div className="bg-gradient-to-r from-[#1E3A5F]/5 to-indigo-500/5 border border-[#1E3A5F]/10 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#1E3A5F]" />
                  변호사 소개
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{form.bio}</p>
              </div>

              {/* 전담 서비스 */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#1E3A5F]" />
                  전담 서비스 안내
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { title: '무료 초기 상담', desc: '채무 현황 분석 및 최적 해결 방안 무료 안내', emoji: '💬' },
                    { title: '1:1 밀착 관리', desc: '사건 접수부터 인가까지 전 과정 전담 케어', emoji: '🤝' },
                    { title: '보정명령 긴급 대응', desc: '법원 보정명령 발생 시 48시간 내 즉시 대응', emoji: '⚡' },
                    { title: '신용 회복 가이드', desc: '면책 후 신용 등급 회복 로드맵 무료 제공', emoji: '📈' },
                  ].map(svc => (
                    <div key={svc.title} className="bg-white border border-slate-100 rounded-xl p-4 flex items-start gap-3 hover:border-[#1E3A5F]/20 hover:shadow-sm transition-all">
                      <span className="text-lg">{svc.emoji}</span>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{svc.title}</h4>
                        <p className="text-sm text-slate-500 mt-0.5 font-medium">{svc.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 사무소 위치 */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#1E3A5F]" />
                    사무소 위치 및 연락처
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    방문 상담 가능
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-900">{officeInfo.firmName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700 font-medium">{officeInfo.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-bold text-[#1E3A5F]">{officeInfo.phone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 CTA */}
            <div className="bg-white border-t border-slate-100 px-5 sm:px-7 py-4 flex items-center justify-end shrink-0">
              <div className="w-full sm:w-auto bg-[#1E3A5F] text-white font-extrabold py-3.5 px-8 rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 opacity-60 pointer-events-none">
                <span>이 전문가를 직접 선택하여 상담 요청</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
