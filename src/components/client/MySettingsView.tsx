import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2, ChevronDown, Lock, LogOut, MessageSquare, PencilLine, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import { supabase } from '../../supabaseClient';
import { purgeAllClientData } from '../../services/consultService';
import type { ClientInquiry } from '../../types';
import ConsentStatusList from './ConsentStatusList';
import { Badge, Button, Card, EmptyState, FormField, PageHeader, inputClass } from './ui';
import { cn } from '../../utils/cn';

/**
 * 계정 설정 (마이페이지 '알림·설정' 탭 안)
 * - 키트 부품으로 정리: 이모지 제목·그라디언트 버튼·32px 아이콘 버튼(title만 있음)·라벨 없는 가명 입력 → 글자 버튼·FormField
 * - 문의 내역은 펼치기 버튼(aria-expanded)으로 (이전: div onClick이라 키보드로 열 수 없었음)
 * - 사실과 다른 표시 정리: '안심번호'(구현되지 않음) 항목 삭제, 항상 켜진 '스텔스 보안 활성' 배지 삭제
 */

interface MySettingsViewProps {
  isLoggedIn: boolean;
  userAlias: string;
  setUserAlias: (alias: string) => void;
  /** 중복 검사 후 가명 변경 (true = 반영됨). 미제공 시 기존 방식으로 저장 */
  onChangeAlias?: (alias: string) => Promise<boolean>;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  inquiries: ClientInquiry[];
  onNavigateToTab: (tab: string) => void;
  onShowAuthModal: () => void;
  onLogout: () => void;
  /** 마이페이지 '알림·설정' 탭 안에 넣을 때 (자체 제목·바깥 여백을 뺀다) */
  embedded?: boolean;
}

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', kakao: '카카오', email: '이메일' };

const SECURITY_POINTS = [
  { title: '1:1 대화 접근 제한', body: '전송 구간은 TLS로 암호화되고, 상담 당사자(본인·선택한 변호사)만 볼 수 있어요.' },
  { title: '상담 기록 직접 삭제', body: '이 화면에서 대화와 진단 기록을 직접 영구 삭제할 수 있어요.' },
  { title: '광고용 추적 도구 미사용', body: '상담 화면에 광고 목적의 외부 추적 스크립트를 넣지 않아요.' },
  { title: '스텔스 가명', body: '수임 계약 전까지 변호사에게 실명과 연락처를 보내지 않아요. 상담방에는 가명이 보여요.' },
];

function InquiryItem({ inq }: { inq: ClientInquiry }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const replied = inq.status === 'replied';
  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span className="min-w-0">
          <span className="block text-xs text-slate-500">{new Date(inq.createdAt).toLocaleDateString('ko-KR')}</span>
          <span className="mt-0.5 block truncate text-sm font-bold text-slate-900">{inq.title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge tone={replied ? 'success' : 'warning'}>{replied ? '답변 완료' : '답변 대기'}</Badge>
          <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div id={panelId} className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 break-keep">{inq.content}</p>
          {replied && inq.replyContent ? (
            <div className="rounded-xl border border-brand/15 bg-brand-light p-3.5">
              <p className="text-sm font-bold text-brand">운영자 답변</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 break-keep">{inq.replyContent}</p>
              {inq.repliedAt && <p className="mt-2 text-right text-xs text-slate-500">{new Date(inq.repliedAt).toLocaleString('ko-KR')}</p>}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-center text-sm text-slate-600">아직 답변이 등록되지 않았어요.</p>
          )}
        </div>
      )}
    </li>
  );
}

export default function MySettingsView({
  isLoggedIn,
  userAlias,
  setUserAlias,
  onChangeAlias,
  isEditingAlias,
  setIsEditingAlias,
  tempAlias,
  setTempAlias,
  inquiries,
  onNavigateToTab,
  onShowAuthModal,
  onLogout,
  embedded = false,
}: MySettingsViewProps) {
  const dialog = useDialog();
  const [userEmail, setUserEmail] = useState<string>('');
  const [loginProvider, setLoginProvider] = useState<string>('');
  const [savingAlias, setSavingAlias] = useState(false);

  // [SECURITY Complete Client Purge] 의뢰인 데이터 전체 영구 삭제
  const handlePurgeAllData = async () => {
    const confirmed = await dialog.confirm({
      title: '나의 모든 상담·진단 데이터 영구 삭제',
      message: '다음 기록을 삭제합니다. 삭제 후에는 복구할 수 없습니다.\n\n· 서버: 내 상담 요청과 1:1 대화, 1:1 문의\n· 이 기기: 진단 결과, 작성 중인 서류, 회생동행 기록, 인증서 보관함, 알림\n\n※ 이미 사건을 맡긴 변호사 사무소의 수임 기록·전자계약서는 법령상 보관될 수 있어 이 기능으로 삭제되지 않습니다. 필요하면 해당 사무소에 삭제를 요청해 주세요.\n\n진행하시겠습니까?',
      confirmText: '삭제하기',
      variant: 'danger'
    });

    if (confirmed) {
      // 기존: localStorage에서 의뢰인 ID를 읽어(실제로는 sessionStorage에 저장됨) 'client-temp'로 삭제 → 본인 기록이 지워지지 않았음
      const result = await purgeAllClientData();
      if (result.serverOk) {
        toast.success(`삭제했습니다. (서버 상담 ${result.deletedRequests}건, 문의 ${result.deletedInquiries}건, 이 기기 데이터)`);
      } else {
        toast.error(`이 기기의 데이터는 삭제했지만 서버 기록 일부를 삭제하지 못했습니다: ${result.errors.join(', ')}. 고객센터로 삭제를 요청해 주세요.`, { duration: 10000 });
      }
      onLogout();
    }
  };

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = tempAlias.trim();
    if (!next) {
      toast.error('가명을 입력해 주세요.');
      return;
    }
    if (onChangeAlias) {
      // 서버 중복 검사 통과 시에만 반영, 실패 시 편집 상태 유지
      setSavingAlias(true);
      const ok = await onChangeAlias(next);
      setSavingAlias(false);
      if (!ok) return;
    } else {
      setUserAlias(next);
      supabase.auth.updateUser({ data: { alias: next } });
    }
    setIsEditingAlias(false);
  };

  useEffect(() => {
    if (isLoggedIn) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUserEmail(session.user.email || '');
          setLoginProvider(session.user.app_metadata?.provider || 'email');
        }
      });
    }
  }, [isLoggedIn]);

  // 현재 가명으로 남긴 문의
  const safeInquiries = Array.isArray(inquiries) ? inquiries : [];
  const myInquiries = safeInquiries.filter((inq) => inq && inq.clientName === userAlias && userAlias !== '');

  const heading = embedded ? (
    <h2 className="text-lg font-bold text-slate-900">계정 설정</h2>
  ) : (
    <PageHeader title="계정 설정" description="가명·로그인 계정, 기록 삭제, 1:1 문의 내역을 관리해요." />
  );

  return (
    <div className={embedded ? 'space-y-4 text-left' : 'mx-auto max-w-5xl animate-fadeIn space-y-6 pb-24 text-left'}>
      {heading}

      {!isLoggedIn ? (
        <Card>
          <EmptyState
            icon={<Lock className="h-6 w-6" />}
            title="로그인하면 계정 설정을 볼 수 있어요"
            description="개인 정보 보호를 위해 가명 변경, 기록 삭제, 문의 내역은 로그인한 뒤에만 보여요."
            action={<Button onClick={onShowAuthModal}>로그인하기</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* 계정 */}
            <Card as="section" aria-labelledby="settings-account-title" className="space-y-5">
              <h3 id="settings-account-title" className="text-base font-bold text-slate-900">
                스텔스 안심 프로필
              </h3>

              {isEditingAlias ? (
                <form onSubmit={handleSaveAlias} className="space-y-3">
                  <FormField label="스텔스 가명" hint="상담방에서 변호사에게 보이는 이름이에요. 최대 20자.">
                    {(p) => (
                      <input
                        {...p}
                        type="text"
                        value={tempAlias}
                        onChange={(e) => setTempAlias(e.target.value)}
                        maxLength={20}
                        autoFocus
                        className={cn(inputClass, 'sm:max-w-xs')}
                      />
                    )}
                  </FormField>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" loading={savingAlias}>
                      저장
                    </Button>
                    <Button variant="secondary" onClick={() => setIsEditingAlias(false)} disabled={savingAlias}>
                      취소
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-600">스텔스 가명 (상담방에 보이는 이름)</p>
                    <p className="mt-0.5 truncate text-base font-bold text-slate-900">{userAlias || '회원'}</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setTempAlias(userAlias || '회원');
                      setIsEditingAlias(true);
                    }}
                    leftIcon={<PencilLine className="h-4 w-4" aria-hidden="true" />}
                  >
                    가명 바꾸기
                  </Button>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-sm font-bold text-slate-600">로그인 계정</p>
                <p className="mt-0.5 break-all text-sm text-slate-900">
                  {userEmail || '확인할 수 없어요'}
                  {loginProvider && <span className="ml-1.5 text-slate-600">({PROVIDER_LABEL[loginProvider] || loginProvider} 로그인)</span>}
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  variant="secondary"
                  onClick={handlePurgeAllData}
                  className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
                  leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                >
                  기록 영구 삭제
                </Button>
                <Button variant="secondary" onClick={onLogout} leftIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}>
                  안전 로그아웃
                </Button>
              </div>
            </Card>

            {/* 1:1 문의 내역 */}
            <Card as="section" aria-labelledby="settings-inquiry-title" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="settings-inquiry-title" className="text-base font-bold text-slate-900">
                  내 1:1 문의
                </h3>
                <Button variant="ghost" onClick={() => onNavigateToTab('inquiry')}>
                  1:1 문의로 이동
                </Button>
              </div>
              {myInquiries.length === 0 ? (
                <EmptyState
                  compact
                  icon={<MessageSquare className="h-6 w-6" />}
                  title="이 가명으로 남긴 문의가 없어요"
                  description="사이트 이용 중 궁금한 점은 1:1 문의로 보내 주세요."
                />
              ) : (
                <ul className="max-h-[360px] space-y-2 overflow-y-auto">
                  {myInquiries.map((inq) => (
                    <InquiryItem key={inq.id} inq={inq} />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* 보안·동의 상태 */}
          <Card as="section" aria-labelledby="settings-security-title" className="space-y-5">
            <h3 id="settings-security-title" className="text-base font-bold text-slate-900">
              보안 및 약관 상태
            </h3>

            {/* 동의 상태: 계정에 남은 실제 기록 (이전: '동의 완료' 고정 표시, 사용하지 않는 마이데이터 조회 동의 표시) */}
            <ConsentStatusList />

            <ul className="space-y-4">
              {SECURITY_POINTS.map((pt) => (
                <li key={pt.title} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-800">{pt.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-slate-600 break-keep">{pt.body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-brand/15 bg-brand-light p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-brand">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                my김변 스텔스 보안 보증
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700 break-keep">
                상담 내용은 전송 구간(TLS)으로 암호화되어 오가고, 데이터베이스 접근 규칙에 따라 본인과 선택한 변호사만 조회할 수 있습니다. 원하면 언제든 상담 기록을 삭제할 수 있습니다. 종단간 암호화(E2EE)는 아닙니다.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
