import React, { useMemo } from 'react';
import { Modal } from '../ui';
import SignatureCanvas from '../../lawyer/SignatureCanvas';

/** 좁은 세로 화면(휴대폰 세로)인지 — 서명 칸 비율을 정할 때만 쓴다 */
const isNarrowPortrait = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(orientation: portrait) and (max-width: 639px)').matches;

/**
 * 서명 패드 (모바일 전체 화면)
 * - 공용 SignatureCanvas(변호사 서명과 공유)를 넓게 띄운다. 논리 크기: 휴대폰 세로 600×400(3:2), 그 밖 600×300(2:1)
 * - 캔버스는 너비에 맞춰 비율대로 커지고 최대 높이가 논리 높이라, 상자 너비를 600px·화면 높이 기준으로 제한해 비율이 깨지지 않게 한다
 */
export default function SignaturePadModal({
  open,
  onClose,
  onComplete,
  signerName,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (dataUrl: string) => void;
  signerName: string;
}) {
  // 열 때의 화면 방향으로 정한다(열려 있는 동안 바꾸면 그리던 서명이 지워지므로 고정)
  const dims = useMemo(() => (open && isNarrowPortrait() ? { w: 600, h: 400 } : { w: 600, h: 300 }), [open]);
  const ratio = dims.w / dims.h;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="서명하기"
      description="다 쓰면 [서명 확인]을 눌러 주세요. 잘못 썼다면 [지우기]로 다시 쓸 수 있어요."
      size="lg"
      mobile="fullscreen"
      closeLabel="서명 창 닫기"
    >
      <div className="mx-auto w-full" style={{ maxWidth: `min(100%, ${dims.w}px, calc((100dvh - 16rem) * ${ratio}))` }}>
        <SignatureCanvas width={dims.w} height={dims.h} label={`${signerName}님 서명`} onComplete={onComplete} />
      </div>
      <p className="mt-4 text-sm text-slate-600 break-keep sm:hidden landscape:hidden">
        화면을 가로로 돌리면 더 넓게 쓸 수 있어요.
      </p>
    </Modal>
  );
}
