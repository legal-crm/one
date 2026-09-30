import React, { useState } from 'react';
import { Building2, FileUp, CheckCircle2, RefreshCw, Check, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { RetrievedJobHistoryItem } from '../../../types/jobHistoryTypes';
import { JobHistoryService } from '../../../services/jobHistoryService';
import type { JobHistoryItem } from '../../../types/statementTypes';
import { Badge, Button, Callout, Modal } from '../ui';
import { cn } from '../../../utils/cn';

interface JobHistoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  onConfirmImport: (importedItems: JobHistoryItem[]) => void;
}

/**
 * 과거 직장 경력 불러오기 — 진술서 작성 창 위에 뜨는 창(z-70)
 * 자격득실확인서·가입증명서 사진/PDF를 AI(Google Gemini)로 읽어 직장명·기간을 채운다.
 * (간편인증 국민연금 조회는 연동되지 않아 화면에서 뺐다 — 이전: 생년월일·휴대폰을 받는데 항상 '준비 중' 실패)
 */
function JobHistoryImportModalInner({
  isOpen,
  onClose,
  onConfirmImport
}: JobHistoryImportModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  // 조회된 경력 목록
  const [retrievedItems, setRetrievedItems] = useState<RetrievedJobHistoryItem[]>([]);
  const [hasQueried, setHasQueried] = useState(false);

  // 자격득실확인서 파일 업로드 및 AI 판독
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (uploadEvt) => {
      const base64 = uploadEvt.target?.result as string;
      try {
        const result = await JobHistoryService.parseJobHistoryFromDocumentImage(base64, file.name);
        if (result.ok && result.items.length > 0) {
          setRetrievedItems(result.items);
          setHasQueried(true);
          toast.success(`서류에서 직장 경력 ${result.items.length}건을 읽었습니다. 틀린 부분이 없는지 확인해 주세요.`);
        } else {
          toast.error('서류에서 경력을 인식하지 못했습니다. 선명한 사진으로 다시 시도하거나 직접 입력해 주세요.');
        }
      } catch {
        toast.error('서류를 읽는 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 직접 입력해 주세요.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setIsLoading(false);
      toast.error('파일을 열지 못했습니다. 다른 파일로 다시 시도해 주세요.');
    };
    reader.readAsDataURL(file);
  };

  const toggleItemSelect = (id: string) => {
    setRetrievedItems(prev => prev.map(it => (it.id === id ? { ...it, selected: !it.selected } : it)));
  };

  const selectedCount = retrievedItems.filter(it => it.selected).length;

  // 진술서에 넣기 확정(완료 안내는 진술서 화면이 한 번만 보여 준다)
  const handleApplyToStatement = () => {
    const selected = retrievedItems.filter(it => it.selected);
    if (selected.length === 0) {
      toast.error('진술서에 추가할 경력을 1개 이상 선택해 주세요.');
      return;
    }

    const mapped: JobHistoryItem[] = selected.map(it => ({
      period: it.periodText,
      companyName: it.workplaceName,
      position: it.suggestedPosition || '직원',
      reasonForLeaving: it.leaveReason || (it.isCurrent ? '재직 중' : '퇴직')
    }));

    onConfirmImport(mapped);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      mobile="fullscreen"
      zIndexClassName="z-[70]"
      icon={<Building2 className="w-5 h-5" />}
      title="과거 직장 경력 불러오기"
      description="건강보험 자격득실확인서나 국민연금 가입증명서 사진으로 직장명과 입·퇴사 시기를 불러와요. 결과는 꼭 확인해 주세요."
      closeLabel="경력 불러오기 닫기"
      footerClassName="justify-between"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          {hasQueried && (
            <Button onClick={handleApplyToStatement} disabled={selectedCount === 0} leftIcon={<Check className="w-4 h-4" aria-hidden="true" />}>
              선택한 {selectedCount}건 넣기
            </Button>
          )}
        </>
      }
    >
      {hasQueried ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                불러온 직장 {retrievedItems.length}건
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">진술서에 넣을 경력을 골라 주세요.</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setHasQueried(false);
                setRetrievedItems([]);
              }}
              leftIcon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
            >
              다른 서류로 다시
            </Button>
          </div>

          <ul className="space-y-2">
            {retrievedItems.map(item => (
              <li key={item.id}>
                <label
                  className={cn(
                    'flex items-start gap-3 min-h-11 p-3.5 rounded-2xl border cursor-pointer transition-colors',
                    item.selected ? 'border-brand bg-brand-light/60' : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleItemSelect(item.id)}
                    className="mt-0.5 w-5 h-5 shrink-0 accent-brand"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 break-keep">{item.workplaceName}</span>
                      {item.isCurrent && <Badge tone="success">재직 중</Badge>}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 tabular-nums">
                      {item.periodText} · {item.durationMonths}개월
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <Callout tone="info" icon={<Info className="w-4 h-4 text-sky-700" aria-hidden="true" />}>
            정부24나 The건강보험 앱에서 받은 <strong>건강보험 자격득실확인서</strong> 또는 <strong>국민연금 가입증명서</strong> 캡처·PDF를 올려 주세요.
            올린 이미지는 표를 읽기 위해 AI 서비스(Google Gemini)로 전송됩니다.
          </Callout>

          <label
            className={cn(
              'relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-colors',
              isLoading ? 'border-brand/40 bg-brand-light/40 cursor-wait' : 'border-slate-300 bg-slate-50 hover:border-brand cursor-pointer',
              'focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2'
            )}
          >
            <span className="w-12 h-12 rounded-2xl bg-brand-light text-brand flex items-center justify-center" aria-hidden="true">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileUp className="w-6 h-6" />}
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900">
                {isLoading ? '서류를 읽는 중이에요…' : '확인서 사진 또는 PDF 올리기'}
              </span>
              <span className="mt-1 block text-sm text-slate-600">앨범 사진, 화면 캡처, PDF 파일을 올릴 수 있어요</span>
            </span>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              disabled={isLoading}
              className="sr-only"
            />
          </label>
          {isLoading && <p className="sr-only" role="status">서류를 읽는 중입니다</p>}
        </div>
      )}
    </Modal>
  );
}

// Rules of Hooks: isOpen 가드는 훅을 쓰는 본문 바깥에서 처리 (열고 닫을 때 훅 개수 불일치 크래시 방지)
export default function JobHistoryImportModal(props: JobHistoryImportModalProps) {
  if (!props.isOpen) return null;
  return <JobHistoryImportModalInner {...props} />;
}
