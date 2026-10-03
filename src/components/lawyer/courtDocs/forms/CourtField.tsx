import type { ReactNode } from 'react';

/**
 * 서식 값 래퍼 — A4 서식 위의 값에 필드 키(data-field)를 붙인다.
 * - 화면에서는 클릭 시 오른쪽 입력 칸으로 이동, 입력 칸 포커스 시 강조 표시
 * - 인쇄/PDF 에서는 스타일이 모두 제거되어 원래 서식과 동일하게 출력된다
 *   (스타일은 CourtDocSuiteViewerModal 의 .cf-field 규칙 참고)
 */
export function F({ k, children }: { k: string; children?: ReactNode }) {
  return (
    <span data-field={k} className="cf-field">
      {children}
    </span>
  );
}
