// 단계 할 일 템플릿 연결 (CM-4)
// 기록(마일스톤)을 저장하면 그 단계의 표준 할 일 묶음을 제안한다. 넣을지는 사람이 고른다.
import { TASK_PACKAGE_TEMPLATES, calculateCourtDeadline, type TaskPackageTemplate } from '../taskTemplateService';
import { localYmd } from '../../utils/localDate';

/** 기록 종류 → 템플릿 (사건 종류별) */
export function templateForMilestone(kind: string, caseType: 'rehab' | 'bankruptcy'): TaskPackageTemplate | null {
  const id = (() => {
    if (kind === 'contract_signed') return caseType === 'bankruptcy' ? 'bankruptcy_all_in_one' : 'rehab_standard_onboarding';
    if (kind === 'correction_registered' && caseType === 'rehab') return 'rehab_court_correction';
    if (kind === 'commencement_decided' && caseType === 'rehab') return 'rehab_creditor_meeting';
    return null;
  })();
  return id ? TASK_PACKAGE_TEMPLATES.find(t => t.id === id) || null : null;
}

/** 템플릿 → 만들 할 일 목록 (기준일 = 오늘, 기한은 템플릿의 일수) */
export function tasksFromTemplate(t: TaskPackageTemplate, base = localYmd()) {
  return t.tasks.map(item => ({
    title: `[${t.badge}] ${item.title}`,
    description: item.description,
    priority: item.priority,
    dueDate: calculateCourtDeadline(base, item.offsetDays),
    subtasks: item.subtasks.map((title, i) => ({ id: `st-${Date.now()}-${i}`, title, completed: false })),
    requiresApproval: item.requiresApproval,
    templateId: t.id,
  }));
}
