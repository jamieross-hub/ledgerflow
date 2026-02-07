import { ConnectionFormValues } from './connectionFormSchema';
import { ConnectionTestResult } from '../../../entities/connection/types';
import { postConnectionTest } from '../../../shared/api/connectionClient';

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

export async function testConnection(config: ConnectionFormValues) {
  return testByProxy(config);
}
