import { ConnectionFormValues, connectionFormSchema } from './connectionFormSchema';
import { ConnectionTestResult } from '../../../entities/connection/types';
import { postConnectionTest } from '../../../shared/api/connectionClient';
import { ENV } from '../../../shared/config/env';
import { saveConnection } from './connectionStorage';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`连接超时（>${timeoutMs}ms）`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function testByProxy(config: ConnectionFormValues): Promise<ConnectionTestResult> {
  const start = performance.now();
  const data = await withTimeout(postConnectionTest({ config }), config.timeoutMs);

  return {
    ok: data.ok,
    message: data.message ?? (data.ok ? '代理连接成功' : '代理连接失败'),
    elapsedMs: Math.round(performance.now() - start),
    detail: data.detail ?? '[proxy] no detail'
  };
}

async function testByLocal(config: ConnectionFormValues): Promise<ConnectionTestResult> {
  const start = performance.now();
  const parsed = connectionFormSchema.safeParse(config);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message || '请先完善连接配置，再保存使用');
  }

  const saved = saveConnection(parsed.data);

  return {
    ok: true,
    message: '未配置后端接口，已自动保存到本地，可立即使用',
    elapsedMs: Math.round(performance.now() - start),
    detail: `[local-mode] saved connection: ${saved.name} (${saved.type})`
  };
}

export async function testConnection(config: ConnectionFormValues) {
  if (!ENV.hasConfiguredApiBaseUrl) {
    return testByLocal(config);
  }
  return testByProxy(config);
}
