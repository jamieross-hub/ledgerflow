import { describe, expect, it } from 'vitest';
import { connectionFormSchema } from '../model/connectionFormSchema';

describe('connectionFormSchema', () => {
  it('应拒绝非法端口与缺失必填字段', () => {
    const result = connectionFormSchema.safeParse({
      name: 'pg-prod',
      type: 'postgresql',
      host: 'db.example.com',
      port: 70000,
      username: '',
      password: '',
      database: '',
      connectionString: '',
      enabled: true,
      timeoutMs: 8000,
      pool: { min: 1, max: 10, idleTimeoutMs: 10000 },
      tls: { enabled: false, rejectUnauthorized: true }
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.port?.[0]).toContain('1-65535');
      expect(errors.username?.[0]).toContain('必填');
      expect(errors.database?.[0]).toContain('必填');
    }
  });

  it('应支持解析合法连接串并通过校验', () => {
    const result = connectionFormSchema.safeParse({
      name: 'mysql-dev',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: '',
      password: '',
      database: '',
      connectionString: 'mysql://root:pass@127.0.0.1:3306/ledger',
      enabled: true,
      timeoutMs: 8000,
      pool: { min: 1, max: 10, idleTimeoutMs: 10000 },
      tls: { enabled: false, rejectUnauthorized: true }
    });

    expect(result.success).toBe(true);
  });
});
