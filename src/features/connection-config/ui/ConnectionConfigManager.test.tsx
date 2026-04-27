import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionConfigForm } from './ConnectionConfigForm';
import { ConnectionConfigManager } from './ConnectionConfigManager';

const CONNECTION_STORAGE_KEY = 'ledgerflow-connections';
const CONNECTION_SECRET_SESSION_KEY = 'ledgerflow-connections-secrets';

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ConnectionConfigManager', () => {
  beforeEach(() => {
    localStorage.removeItem(CONNECTION_STORAGE_KEY);
    sessionStorage.removeItem(CONNECTION_SECRET_SESSION_KEY);
  });

  it('keeps the add form collapsed by default', () => {
    const { container } = render(<ConnectionConfigManager />);

    expect(screen.getByRole('button', { name: '新增连接' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '新增连接配置' })).not.toBeInTheDocument();
    expect(screen.getByText('暂无连接配置，需要时点“新增连接”即可。')).toBeInTheDocument();
    expect(container.querySelector('#connection-config-manager.panel')).toBeNull();
  });

  it('shows default endpoint summary in the new form', () => {
    renderWithQuery(<ConnectionConfigForm onSubmit={vi.fn()} />);

    expect(
      screen.getByText('主机 / 端口 / 库名（当前 localhost:3306 / ledgerflow）')
    ).toBeInTheDocument();
    expect(
      screen.getByText('默认 localhost / 3306 / 库 ledgerflow，不改也能直接测试本机 MySQL。')
    ).toBeInTheDocument();
  });

  it('renders the enabled checkbox inline with the type selector', () => {
    renderWithQuery(<ConnectionConfigForm onSubmit={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox', { name: '启用' });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.closest('.connection-inline-checkbox')).not.toBeNull();
  });

  it('renders the add form without a nested panel wrapper', () => {
    const { container } = renderWithQuery(<ConnectionConfigForm onSubmit={vi.fn()} />);

    expect(container.querySelector('form.panel')).toBeNull();
    expect(container.querySelector('.connection-actions.panel')).toBeNull();
  });
});
