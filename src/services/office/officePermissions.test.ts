import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OFFICE_PERMISSIONS, type OfficeRole } from './officePermissions';

// DB 기본 권한(마이그레이션 seed)과 코드 목록이 같은지 확인 (RB-4: 권한 목록 하나)
const sql = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261030000000_office_foundation.sql'), 'utf8');
const rows = [...sql.matchAll(/\('(owner|lawyer|consultant|clerk|accounting)','([a-z_.]+)','(none|assigned|all)',(true|false)\)/g)]
  .map(m => ({ role: m[1] as OfficeRole, permission: m[2], scope: m[3], lawyerOnly: m[4] === 'true' }));

describe('officePermissions', () => {
  it('DB seed 와 코드 목록의 권한 키가 같다', () => {
    const dbKeys = [...new Set(rows.map(r => r.permission))].sort();
    const codeKeys = OFFICE_PERMISSIONS.map(p => p.key).sort();
    expect(dbKeys).toEqual(codeKeys);
  });

  it('역할별 기본 범위와 변호사 전용 표시가 같다', () => {
    for (const p of OFFICE_PERMISSIONS) {
      for (const role of ['owner', 'lawyer', 'consultant', 'clerk', 'accounting'] as OfficeRole[]) {
        const row = rows.find(r => r.permission === p.key && r.role === role);
        expect(row, `${p.key}/${role}`).toBeDefined();
        expect(row!.scope, `${p.key}/${role}`).toBe(p.defaults[role]);
        expect(row!.lawyerOnly, `${p.key}/${role} lawyerOnly`).toBe(p.lawyerOnly);
      }
    }
  });

  it('변호사 전용 권한은 비변호사 역할 기본값이 none 이다', () => {
    for (const p of OFFICE_PERMISSIONS.filter(x => x.lawyerOnly)) {
      expect(p.defaults.consultant).toBe('none');
      expect(p.defaults.clerk).toBe('none');
      expect(p.defaults.accounting).toBe('none');
    }
  });
});
