import { toast } from 'sonner';
import { secureGetItem } from '../../../utils/secureStorage';
import { feeAmountWon, feeTotalWon } from '../../../services/alimtokService';
import { validateUploadFile } from '../../../utils/fileSecurity';
import { applyCourtSubmissionWatermark } from '../../../utils/documentWatermark';
import { submitClientDocument } from '../../../services/crmService';
import type { CrmStatus, DocumentCheckItem, DocumentFile, DocumentRequest, FeeInstallment } from '../../../types';
import type { MyPageModel } from './useMyPageModel';

/**
 * 내 사건 탭 상세 화면이 렌더링될 때마다 계산하는 값 (이전: MyPageView JSX 안 즉시 실행 함수의 지역 값)
 * - CRM 저장소를 그때그때 다시 읽는다(변호사 화면과 같은 저장소). 훅이 아니므로 조건부 렌더링 안에서 불러도 된다
 */
export function buildMyCaseData(vm: MyPageModel) {
  const { activeRequest, clientContract, dischargeRequestedLocal, requests, setRefreshTick, userAlias } = vm;
  // CRM 데이터 읽기 (변호사 CRM과 동일 sessionStorage/localStorage 공유)
  const getCrmData = () => {
    try { 
      const raw = secureGetItem('legal_crm_data');
      return raw ? JSON.parse(raw) : {}; 
    } catch { return {}; }
  };
  const reqId = activeRequest?.id || requests[0]?.id;
  const crmExt = reqId ? (getCrmData()[reqId] || null) : null;
  const currentStatus: CrmStatus = crmExt?.crmStatus || activeRequest?.status || 'requested';
  const isDischargeRequested = dischargeRequestedLocal || !!crmExt?.dischargeRequestedAt;
  // 수임료 분납 스케줄: CRM 확장 데이터 우선, 미등록 시 체결된 전자계약서(clientContract) 자동 폴백
  const feeSchedule: FeeInstallment[] = (Array.isArray(crmExt?.feeSchedule) && crmExt.feeSchedule.length > 0)
    ? crmExt.feeSchedule 
    : (clientContract?.feeSchedule || []);
  // 원 단위로 통일 (이전: 원·만원이 섞인 값을 그대로 '만원'으로 표시 → '1,000,000만원' 가능)
  const totalFee: number = feeTotalWon(crmExt?.totalFee || clientContract?.totalFee || 0);
  const checklist: DocumentCheckItem[] = Array.isArray(crmExt?.documents) ? crmExt.documents : [];
  const uploadedFiles: DocumentFile[] = Array.isArray(crmExt?.uploadedFiles) ? crmExt.uploadedFiles : [];
  const docRequests: DocumentRequest[] = Array.isArray(crmExt?.documentRequests) ? crmExt.documentRequests : [];
  const totalPaid = feeSchedule
    .filter((f: FeeInstallment) => f && f.status === 'paid')
    .reduce((s: number, f: FeeInstallment) => s + feeAmountWon(f), 0);

  const handleFileUpload = async (files: FileList | null, linkedDocId?: string) => {
    if (!files || files.length === 0 || !reqId) return false;
    let validCount = 0;
    let failedCount = 0;
    const readAsDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateUploadFile(file);
      if (!validation.isValid) {
        toast.error(`[${file.name}] ${validation.error}`);
        continue;
      }
      try {
        let dataUrl = await readAsDataUrl(file);
        let fileSize = file.size;
        let mimeType = file.type;

        // 신분증/인감 등 이미지 서류인 경우 법원 제출용 비가역 반투명 워터마크 자동 합성 (주민번호 13자리 온전 보존)
        if (file.type.startsWith('image/')) {
          try {
            const watermarked = await applyCourtSubmissionWatermark(dataUrl, {
              clientName: userAlias || activeRequest?.name || '신청인',
              requestId: reqId,
              isIdCardOrSeal: true
            });
            dataUrl = watermarked.dataUrl;
            fileSize = watermarked.fileSize;
            mimeType = watermarked.mimeType;
          } catch (wmErr) {
            console.warn('[Watermark Synthesis Error]', wmErr);
          }
        }

        const fileObj = {
          name: file.name,
          category: 'other',
          uploadedAt: new Date().toISOString(),
          fileSize,
          mimeType,
          dataUrl,
          uploadSource: 'client',
          linkedDocId
        };
        await submitClientDocument(reqId, fileObj as any, linkedDocId);
        validCount++;
      } catch (err) {
        console.warn('[upload failed]', err);
        failedCount++;
      }
    }
    setRefreshTick(c => c + 1);
    // 실제 제출이 끝난 뒤에만 결과 안내
    if (validCount > 0) toast.success(`${validCount}개 파일을 제출했습니다.`);
    if (failedCount > 0) toast.error(`${failedCount}개 파일은 제출하지 못했습니다. 다시 시도해 주세요.`);
    return validCount > 0 && failedCount === 0;
  };

  const submittedCount = checklist.filter(d => ['submitted', 'approved', 'under_review', 'resubmitted'].includes(d.reviewStatus || '')).length;

  // 진행 단계 정의 (cancelled 제외)
  const PROGRESS_STEPS: CrmStatus[] = ['requested', 'consulting', 'contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];
  const currentIdx = PROGRESS_STEPS.indexOf(currentStatus);

  return { getCrmData, reqId, crmExt, currentStatus, isDischargeRequested, feeSchedule, totalFee, checklist, uploadedFiles, docRequests, totalPaid, handleFileUpload, submittedCount, PROGRESS_STEPS, currentIdx };
}

export type MyCaseData = ReturnType<typeof buildMyCaseData>;
