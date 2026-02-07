import { BrowserRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('应渲染标题/描述并响应主操作', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();

    render(
      <BrowserRouter>
        <EmptyState
          title="暂无数据"
          description="请先创建记录"
          icon="📭"
          secondaryAction={{ label: '取消', onClick: onSecondary }}
          primaryAction={{ label: '去创建', onClick: onPrimary, variant: 'primary' }}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('暂无数据')).toBeInTheDocument();
    expect(screen.getByText('请先创建记录')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '去创建' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
