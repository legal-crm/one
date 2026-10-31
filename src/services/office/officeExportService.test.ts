import { describe, expect, it, vi } from 'vitest';

vi.mock('../../supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { decryptBackup, encryptBackup } from './officeExportService';

describe('사무소 백업 암호화', () => {
  it('같은 암호로 되돌리면 원문과 같다', async () => {
    const plain = JSON.stringify({ format: 'mykim-office-backup', tables: { cases: [{ id: 'a', title: '한글 사건' }] } });
    const enc = await encryptBackup(plain, 'correct-horse-battery', 1000);
    expect(enc.format).toBe('mykim-office-backup-encrypted');
    expect(enc.data).not.toContain('한글');
    expect(await decryptBackup(enc, 'correct-horse-battery')).toBe(plain);
  });

  it('암호가 틀리면 열리지 않는다', async () => {
    const enc = await encryptBackup('{}', 'correct-horse-battery', 1000);
    await expect(decryptBackup(enc, 'wrong-password!!')).rejects.toBeTruthy();
  });
});
