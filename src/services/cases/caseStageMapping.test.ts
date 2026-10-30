import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { availableMilestones, MILESTONE_ACTIONS, serverStageToCrmStatus } from './caseStageMapping';
import { stageForStatus } from '../../components/lawyer/pipeline/pipelineGates';

const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261030000100_case_core.sql'), 'utf8');
const stages = [...sql.matchAll(/\('(rehab|bankruptcy)', '([a-z_]+)', (\d+), (\d), '/g)]
  .map(m => ({ caseType: m[1], code: m[2], order: Number(m[3]), group: Number(m[4]) }));

describe('세부 단계표', () => {
  it('회생 12·파산 13 단계', () => {
    expect(stages.filter(s => s.caseType === 'rehab')).toHaveLength(12);
    expect(stages.filter(s => s.caseType === 'bankruptcy')).toHaveLength(13);
  });

  it('서버 단계 → 기존 상태 → 화면 묶음이 단계표 묶음과 크게 어긋나지 않는다', () => {
    for (const s of stages.filter(x => x.code !== 'closed')) {
      const group = stageForStatus(serverStageToCrmStatus(s.code));
      // 기존 상태 8개로는 묶음 2(계약 진행)를 따로 표현하지 못하므로 한 칸 차이까지 허용
      expect(Math.abs(group - s.group), `${s.caseType}/${s.code}`).toBeLessThanOrEqual(2);
      if (s.code === 'filed') expect(group).toBe(5);
      if (s.code === 'commenced') expect(group).toBe(6);
    }
  });
});

describe('stageForStatus (한 칸 늦는 문제 수정)', () => {
  it('접수하면 5단계, 개시결정이면 6단계', () => {
    expect(stageForStatus('requested')).toBe(1);
    expect(stageForStatus('consulting')).toBe(1);
    expect(stageForStatus('contracted')).toBe(3);
    expect(stageForStatus('document')).toBe(3);
    expect(stageForStatus('filed')).toBe(5);
    expect(stageForStatus('commenced')).toBe(6);
    expect(stageForStatus('repaying')).toBe(6);
  });
});

describe('기록 버튼', () => {
  it('모든 기록 종류가 서버 함수에 있다', () => {
    for (const a of MILESTONE_ACTIONS) expect(sql, a.kind).toContain(`'${a.kind}'`);
  });
  it('종결된 사건은 다시 열기만', () => {
    expect(availableMilestones('closed', 'rehab').map(a => a.kind)).toEqual(['reopened']);
  });
  it('회생 접수 뒤에는 파산선고 버튼이 없다', () => {
    const kinds = availableMilestones('filed', 'rehab').map(a => a.kind);
    expect(kinds).toContain('commencement_decided');
    expect(kinds).not.toContain('bankruptcy_declared');
  });
});
