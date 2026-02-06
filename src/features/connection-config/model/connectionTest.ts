import { ConnectionFormValues } from './connectionFormSchema';
import { ConnectionTestResult } from '../../../entities/connection/types';
import { AppMode } from '../../../shared/types/app';
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

async function testByMock(config: ConnectionFormValues): Promise<ConnectionTestResult> {
  const start = performance.now();
  const random = Math.random();
  const delay = Math.min(3000, config.timeoutMs - 100);

  await new Promise((resolve) => setTimeout(resolve, delay));

  if (random < 0.2) {
    throw new Error('模拟连接失败：认证错误或目标不可达');
  }
  if (random < 0.35) {
    throw new Error('模拟连接超时：网络抖动导致握手失败');
  }

  return {
    ok: true,
    message: '模拟连接成功',
    elapsedMs: Math.round(performance.now() - start),
    detail: `[mock] ${config.type}@${config.host}:${config.port} => ok`
  };
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

export async function testConnection(config: ConnectionFormValues, mode: AppMode) {
  return mode === 'proxy'
    ? testByProxy(config)
    : withTimeout(testByMock(config), Math.max(config.timeoutMs, 1000));
}
