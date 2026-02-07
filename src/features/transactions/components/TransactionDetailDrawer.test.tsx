import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';

const sample = {
  id: 'tx_1',
  type: 'expense' as const,
  categoryId: 'cat-1',
  accountId: 'acc-1',
  amount: 100,
  date: new Date('2026-01-01').toISOString(),
  note: '午餐',
  tags: ['餐饮']
};

describe('TransactionDetailDrawer', () => {
  it('点击复制 JSON 触发回调', () => {
    const onCopyJson = vi.fn();

    render(
      <TransactionDetailDrawer
        open
        transaction={sample}
        categoryName="餐饮"
        accountName="现金"
        onClose={() => undefined}
        onCopyNote={() => undefined}
        onCopyJson={onCopyJson}
        onDelete={() => undefined}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '复制 JSON' }));
    expect(onCopyJson).toHaveBeenCalledTimes(1);
  });
});
