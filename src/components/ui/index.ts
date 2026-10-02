/**
 * 공통 UI 모듈 루트 (docs/mykim_lawyer_admin_ui_upgrade_plan.md Phase 1-5)
 * 고객 및 어드민에서 공통으로 재사용하는 기반 UI 부품을 export합니다.
 */

// 기반 부품 (client/ui 기반 공유)
export { Button, buttonClassName } from '../client/ui/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from '../client/ui/Button';
export { Modal } from '../client/ui/Modal';
export type { ModalProps, ModalSize, ModalMobileMode } from '../client/ui/Modal';
export { Badge, Callout, EmptyState, ErrorState, Skeleton, SkeletonText, CardSkeleton, ListSkeleton, PageSkeleton } from '../client/ui/feedback';
export type { Tone } from '../client/ui/feedback';
export { PageHeader, SectionHeader, Card, SearchField, FilterChips, Pagination, SegmentedTabs, Stepper } from '../client/ui/layout';
export type { ChipOption, SegmentTab } from '../client/ui/layout';
export { FormField, MoneyInput, formatKoreanWon, inputClass, textareaClass } from '../client/ui/form';
export type { FieldControlProps } from '../client/ui/form';

// 어드민 전용 부품
export * from './admin';
