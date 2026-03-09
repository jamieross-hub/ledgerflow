import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionTestButton } from './ConnectionTestButton';
import { testConnection } from '../model/connectionTest';

vi.mock('../model/connectionTest', () => ({
  testConnection: vi.fn(async () => ({
    ok: true,
    message: '代理连接成功',
    detail: '[proxy] ok',
    elapsedMs: 15
  }))
}));

const baseValues = {
  name: 'mysql-dev',
  type: 'mysql' as const,
  host: 'db.example.com',
  port: 3306,
  username: 'ledgerflow',
  password: '123456',
  database: 'ledgerflow',
  connectionString: '',
  enabled: true,
  timeoutMs: 1200,
  pool: { min: 1, max: 5, idleTimeoutMs: 5000 },
  tls: { enabled: false, rejectUnauthorized: true }
};

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ConnectionTestButton', () => {
  it('点击测试后通过代理返回成功结果', async () => {
    renderWithQuery(<ConnectionTestButton values={baseValues} />);

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));

    await waitFor(() => {
      expect(testConnection).toHaveBeenCalled();
      expect(screen.getByText(/代理连接成功/)).toBeInTheDocument();
    });
  });
});
