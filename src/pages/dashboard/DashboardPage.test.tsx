import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('应渲染仪表盘核心区块', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '仪表盘' })).toBeInTheDocument();
    expect(screen.getByText('分类饼图（占位）')).toBeInTheDocument();
    expect(screen.getByText('趋势图（占位）')).toBeInTheDocument();
  });
});
