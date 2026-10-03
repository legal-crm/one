import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatLocalDate, formatVaultDday, saveCertificateVault, shredCertificateVault } from '../../../services/vault/certificateVaultService';
import { updateCrmClientExtension } from '../../../services/crmService';
import { Badge, Button, Card } from '../ui';
import type { MyPageModel } from './useMyPageModel';

/**
 * 내 사건 탭: 인증서 보관함 카드 (MyPageView에서 분리)
 * - 인증서는 개인키 보호를 위해 이 기기에만 저장되고 법률사무소로 전달되지 않는다(crmService가 서버 전송에서 제외).
 *   사무소가 쓸 수 없는 기능이라 새 등록은 받지 않고(기획서 '인증서 금고: 숨김'), 이미 저장한 인증서가 있을 때만
 *   내용을 확인하고 삭제할 수 있게 보여 준다. 등록 창(ClientCertificateSubmissionModal)은 사무소 전달 기능이 생기면 다시 연결한다.
 */
export default function CertificateVaultCard({ vm }: { vm: MyPageModel }) {
  const { clientVault, dialog, profile, setClientVault, targetClientId, userAlias } = vm;

  const hasStored = !!clientVault && clientVault.status !== 'shredded' && (!!clientVault.npki || !!clientVault.financial?.registered);
  if (!hasStored || !clientVault) {
    return (
      <Card as="section" aria-labelledby="mypage-vault-guide-title" className="space-y-4 border-dashed border-slate-300 bg-slate-50/60">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600" aria-hidden="true">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 id="mypage-vault-guide-title" className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
              부채증명서 발급을 위한 인증서 준비 안내
              <Badge tone="info">실무 협조</Badge>
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 break-keep">
              개인회생·파산 사건 진행을 위해 10~30여 개 금융기관의 부채증명서를 발급받아야 합니다. 아래 두 가지 방법 중 편하신 방식으로 협조해 주세요.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 pt-1">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">1. 금융인증서 원격 승인 (권장)</span>
              <Badge tone="success">가장 간편</Badge>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed break-keep">
              파일 제출 없이 스마트폰에서 실시간으로 승인합니다. 담당자가 은행 사이트 접속 시 전화나 카카오톡으로 알려드리면 스마트폰에서 2자리 번호 확인 후 승인해 주시면 됩니다.
            </p>
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1 pt-1">
              ✓ 별도 파일 제출 불필요 · 통화 시 승인 협조
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">2. 공동인증서 (구 공인인증서)</span>
              <Badge tone="warning">PC 전용</Badge>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed break-keep">
              PC에 저장된 인증서 파일(signCert.der, signPri.key)은 담당자 통화 시 안내에 따라 사무소 카카오톡/이메일로 보내주시거나, PC 브라우저에서 아래 마법사로 등록할 수 있습니다.
            </p>
            <div className="pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => vm.setIsCertSubmissionModalOpen(true)}
                className="w-full text-xs font-bold text-slate-700 hover:text-slate-900 border-slate-300"
              >
                인증서 안심 제출 마법사 열기
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const handleShred = async () => {
    const ok = await dialog.confirm({
      title: '인증서 삭제',
      message: '이 기기에 저장된 인증서 파일과 비밀번호를 삭제합니다. 법률사무소에 이미 전달한 사본은 사무소에 삭제를 요청해 주세요.\n삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!ok) return;
    const shredded = shredCertificateVault(clientVault, userAlias || profile?.name || '신청인', '의뢰인 본인 직접 폐기 요청');
    // 기기 보관본 + CRM 확장 데이터 사본을 모두 삭제본으로 덮어씀
    saveCertificateVault(shredded);
    await updateCrmClientExtension(targetClientId, { certificateVault: shredded });
    setClientVault(shredded);
    toast.success('이 기기에 저장된 인증서 파일과 비밀번호를 삭제했습니다.');
  };

  return (
    <Card as="section" aria-labelledby="mypage-vault-title" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand" aria-hidden="true">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id="mypage-vault-title" className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
            이 기기에 저장한 인증서
            <Badge tone="warning">이 기기에만 저장</Badge>
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 break-keep">
            인증서는 이 브라우저에만 저장되어 있고 법률사무소로 전송되지 않았어요. 전달 방법은 담당 사무소와 상의하고, 더 쓰지 않으면 삭제해 주세요.
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {clientVault.npki && (
          <li className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-800">공동인증서 (NPKI)</span>
              <Badge tone="success">보관 중 · {formatVaultDday(clientVault.npki.validTo)}</Badge>
            </p>
            <p className="text-sm leading-relaxed text-slate-600 break-keep">
              {clientVault.npki.issuer} 발급 · {formatLocalDate(clientVault.npki.validTo)} 만료 · 비밀번호는 암호화해 보관
            </p>
          </li>
        )}
        {clientVault.financial?.registered && (
          <li className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-800">금융인증서 (YESKEY)</span>
              <Badge tone="info">등록 정보 있음</Badge>
            </p>
            <p className="text-sm leading-relaxed text-slate-600 break-keep">
              사무소가 발급 사이트에서 로그인하면 휴대폰({clientVault.financial.relayPhone})으로 온 요청을 직접 확인한 뒤 승인해 주세요.
            </p>
          </li>
        )}
      </ul>

      {/* 이 기기의 열람 기록 (투명성) */}
      {clientVault.accessLogs && clientVault.accessLogs.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="flex items-center justify-between gap-2 text-sm font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              이 기기의 열람 기록
            </span>
            <span className="text-xs font-medium text-slate-500">최근 {Math.min(2, clientVault.accessLogs.length)}건</span>
          </p>
          <ul className="space-y-1.5">
            {clientVault.accessLogs.slice(0, 2).map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-bold text-slate-800">
                    {log.actorName} ({log.actorRole})
                  </span>
                  <span className="block text-xs text-slate-600">{log.purpose}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">{new Date(log.timestamp).toLocaleDateString('ko-KR')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-600 break-keep">사건이 끝났거나 위임을 철회하려면 저장한 인증서를 삭제하세요.</p>
        <Button
          variant="secondary"
          onClick={handleShred}
          className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
          leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        >
          인증서 삭제
        </Button>
      </div>
    </Card>
  );
}
