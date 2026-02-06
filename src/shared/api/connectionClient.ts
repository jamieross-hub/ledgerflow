import { ENV } from '../config/env';
import { ConnectionFormValues } from '../../features/connection-config/model/connectionFormSchema';

interface ProxyTestRequest {
  config: ConnectionFormValues;
}

interface ProxyTestResponse {
  ok: boolean;
  message?: string;
  detail?: string;
}

/**
 * 为什么抽象单独 client：
 * 1) UI 层不应该知道接口 URL 拼接细节；
 * 2) 后续接入鉴权头、重试策略时无需修改 feature 代码。
 */
export async function postConnectionTest(payload: ProxyTestRequest): Promise<ProxyTestResponse> {
  const response = await fetch(`${ENV.apiBaseUrl}/conn/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`代理接口异常：HTTP ${response.status}`);
  }

  return (await response.json()) as ProxyTestResponse;
}
