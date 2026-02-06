import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionTestButton } from './ConnectionTestButton';

const baseValues = {
  name: 'pg-dev',
  type: 'postgresql' as const,
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '123456',
  database: 'ledger',
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
  it('mock 模式下可执行测试并展示结果', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);

    renderWithQuery(<ConnectionTestButton values={baseValues} mode="mock" />);

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }));

    await waitFor(() => {
      expect(screen.getByText(/模拟连接成功/)).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });
});
