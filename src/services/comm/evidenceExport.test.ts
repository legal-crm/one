import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false, getAuthHeaders: async () => ({}) }));

import { commLogsCsv } from './evidenceExport';

describe('증빙 내보내기 CSV (CL-10)', () => {
  it('BOM·머리줄·수식 주입 방지', () => {
    const csv = commLogsCsv([{
      id: '1', officeId: 'o', deviceId: null, userId: null, workspaceKey: 'k', salesLeadId: null, contactId: null,
      linkStatus: 'linked', candidates: [], source: 'manual', senderName: null, exportId: null,
      channel: 'sms', direction: 'out', result: 'sent', durationSec: null, lineLabel: '업무폰', body: '=HYPERLINK("x")',
      occurredAt: '2026-10-31T01:00:00Z', receivedAt: '2026-10-31T01:00:00Z', contentHash: 'abc', note: '메모, 쉼표', nextContactAt: null, linkHistory: [],
    }]);
    expect(csv.startsWith('\uFEFF일시,종류')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"메모, 쉼표"');
    expect(csv).toContain('문자');
  });
});
