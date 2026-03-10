import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionTable, type TransactionColumnKey } from './TransactionTable';

const baseProps = {
  onRetry: vi.fn(),
  onClearFilters: vi.fn(),
  onFirstPage: vi.fn(),
  onPrevPage: vi.fn(),
  onNextPage: vi.fn(),
  onLastPage: vi.fn(),
  onPageSizeChange: vi.fn(),
  onOpenDetail: vi.fn(),
  onShare: vi.fn(),
  onDelete: vi.fn(),
  onDeleteSelected: vi.fn(),
  onBulkEditCategory: vi.fn(),
  onBulkAiRecategorize: vi.fn(),
  bulkAiRecategorizing: false,
  onBulkEditAccount: vi.fn(),
  onClearSelection: vi.fn(),
  onToggleSelect: vi.fn(),
  onToggleSelectPage: vi.fn(),
  onSortChange: vi.fn(),
  onQuickFilterChange: vi.fn(),
  columnWidths: {},
  onColumnReorder: vi.fn(),
  onColumnResize: vi.fn(),
  quickFilters: {
    date: '',
    type: 'all' as const,
    status: 'all' as const,
    category: '',
    account: '',
    amountMin: '',
    amountMax: '',
    tags: '',
    merchant: '',
    location: '',
    orderNo: '',
    merchantOrderNo: '',
    note: ''
  },
  visibleColumns: {
    date: true,
    type: true,
    status: true,
    category: true,
    account: true,
    amount: true,
    orderNo: true,
    merchantOrderNo: true,
    note: true
  },
  columnOrder: [
    'date',
    'type',
    'status',
    'category',
    'account',
    'amount',
    'orderNo',
    'merchantOrderNo',
    'note'
  ] as TransactionColumnKey[],
  categoryOptions: [],
  accountOptions: []
};

describe('TransactionTable', () => {
  it('日期快捷筛选输入应用可用日期范围', () => {
    render(
      <TransactionTable
        rows={[]}
        total={0}
        filteredTotal={0}
        page={1}
        pages={1}
        pageSize={8}
        pageSizeOptions={[8, 20]}
        loading={false}
        hasFilters
        selectedIds={[]}
        bulkSelectionEnabled={false}
        canSelectAllOnPage={false}
        allPageSelected={false}
        sortKey="date"
        sortDirection="desc"
        quickFilters={{
          date: '',
          type: 'all',
          status: 'all',
          category: '',
          account: '',
          amountMin: '',
          amountMax: '',
          tags: '',
          merchant: '',
          location: '',
          orderNo: '',
          merchantOrderNo: '',
          note: ''
        }}
        onRetry={vi.fn()}
        onClearFilters={vi.fn()}
        onFirstPage={vi.fn()}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
        onLastPage={vi.fn()}
        onPageSizeChange={vi.fn()}
        onOpenDetail={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onDeleteSelected={vi.fn()}
        onBulkEditCategory={vi.fn()}
        onBulkAiRecategorize={vi.fn()}
        bulkAiRecategorizing={false}
        onBulkEditAccount={vi.fn()}
        categoryOptions={[]}
        accountOptions={[]}
        onClearSelection={vi.fn()}
        onToggleSelect={vi.fn()}
        onToggleSelectPage={vi.fn()}
        onSortChange={vi.fn()}
        onQuickFilterChange={vi.fn()}
        visibleColumns={{
          date: true,
          type: true,
          status: true,
          category: true,
          account: true,
          amount: true,
          orderNo: true,
          merchantOrderNo: true,
          note: true
        }}
        columnOrder={[
          'date',
          'type',
          'status',
          'category',
          'account',
          'amount',
          'orderNo',
          'merchantOrderNo',
          'note'
        ]}
        onColumnReorder={vi.fn()}
        columnWidths={{}}
        onColumnResize={vi.fn()}
        minAvailableDate="2026-02-01"
        maxAvailableDate="2026-02-28"
      />
    );

    const dateInput = screen.getByPlaceholderText('筛选日期');
    expect(dateInput).toHaveAttribute('min', '2026-02-01');
    expect(dateInput).toHaveAttribute('max', '2026-02-28');
  });

  it('批量 AI 重分类进行中时按钮可点击并展示停止状态', () => {
    render(
      <TransactionTable
        rows={[
          {
            item: {
              id: 'tx-1',
              date: '2026-02-10',
              type: 'expense',
              categoryId: 'cat-1',
              accountId: 'acc-1',
              amount: 88,
              note: '测试',
              tags: []
            },
            categoryName: '餐饮',
            accountName: '现金'
          }
        ]}
        total={1}
        filteredTotal={1}
        page={1}
        pages={1}
        pageSize={8}
        pageSizeOptions={[8, 20]}
        loading={false}
        hasFilters
        selectedIds={['tx-1']}
        bulkSelectionEnabled
        canSelectAllOnPage
        allPageSelected
        sortKey="date"
        sortDirection="desc"
        quickFilters={{
          date: '',
          type: 'all',
          status: 'all',
          category: '',
          account: '',
          amountMin: '',
          amountMax: '',
          tags: '',
          merchant: '',
          location: '',
          orderNo: '',
          merchantOrderNo: '',
          note: ''
        }}
        onRetry={vi.fn()}
        onClearFilters={vi.fn()}
        onFirstPage={vi.fn()}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
        onLastPage={vi.fn()}
        onPageSizeChange={vi.fn()}
        onOpenDetail={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onDeleteSelected={vi.fn()}
        onBulkEditCategory={vi.fn()}
        onBulkAiRecategorize={vi.fn()}
        bulkAiRecategorizing
        onBulkEditAccount={vi.fn()}
        categoryOptions={[]}
        accountOptions={[]}
        onClearSelection={vi.fn()}
        onToggleSelect={vi.fn()}
        onToggleSelectPage={vi.fn()}
        onSortChange={vi.fn()}
        onQuickFilterChange={vi.fn()}
        visibleColumns={{
          date: true,
          type: true,
          status: true,
          category: true,
          account: true,
          amount: true,
          orderNo: true,
          merchantOrderNo: true,
          note: true
        }}
        columnOrder={[
          'date',
          'type',
          'status',
          'category',
          'account',
          'amount',
          'orderNo',
          'merchantOrderNo',
          'note'
        ]}
        onColumnReorder={vi.fn()}
        columnWidths={{}}
        onColumnResize={vi.fn()}
      />
    );

    const aiButton = screen.getByRole('button', { name: '⏹ 停止 AI 重分类' });
    expect(aiButton).toBeEnabled();
  });

  it('展示分页首尾按钮与当前页汇总行', () => {
    render(
      <TransactionTable
        rows={[
          {
            item: {
              id: 'tx-income',
              date: '2026-03-10',
              type: 'income',
              categoryId: 'cat-1',
              accountId: 'acc-1',
              amount: 200,
              note: '工资',
              tags: []
            },
            categoryName: '收入',
            accountName: '银行卡'
          },
          {
            item: {
              id: 'tx-expense',
              date: '2026-03-11',
              type: 'expense',
              categoryId: 'cat-2',
              accountId: 'acc-1',
              amount: 50,
              note: '午餐',
              tags: []
            },
            categoryName: '餐饮',
            accountName: '银行卡'
          }
        ]}
        total={2}
        filteredTotal={2}
        page={2}
        pages={3}
        pageSize={8}
        pageSizeOptions={[8, 20]}
        loading={false}
        hasFilters
        selectedIds={[]}
        bulkSelectionEnabled={false}
        canSelectAllOnPage={false}
        allPageSelected={false}
        sortKey="date"
        sortDirection="desc"
        quickFilters={{
          date: '',
          type: 'all',
          status: 'all',
          category: '',
          account: '',
          amountMin: '',
          amountMax: '',
          tags: '',
          merchant: '',
          location: '',
          orderNo: '',
          merchantOrderNo: '',
          note: ''
        }}
        onRetry={vi.fn()}
        onClearFilters={vi.fn()}
        onFirstPage={vi.fn()}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
        onLastPage={vi.fn()}
        onPageSizeChange={vi.fn()}
        onOpenDetail={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onDeleteSelected={vi.fn()}
        onBulkEditCategory={vi.fn()}
        onBulkAiRecategorize={vi.fn()}
        bulkAiRecategorizing={false}
        onBulkEditAccount={vi.fn()}
        categoryOptions={[]}
        accountOptions={[]}
        onClearSelection={vi.fn()}
        onToggleSelect={vi.fn()}
        onToggleSelectPage={vi.fn()}
        onSortChange={vi.fn()}
        onQuickFilterChange={vi.fn()}
        visibleColumns={{
          date: true,
          type: true,
          status: true,
          category: true,
          account: true,
          amount: true,
          orderNo: true,
          merchantOrderNo: true,
          note: true
        }}
        columnOrder={[
          'date',
          'type',
          'status',
          'category',
          'account',
          'amount',
          'orderNo',
          'merchantOrderNo',
          'note'
        ]}
        onColumnReorder={vi.fn()}
        columnWidths={{}}
        onColumnResize={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '第一页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '最后一页' })).toBeInTheDocument();
    expect(screen.getByText(/汇总（当前页 2 条）/)).toBeInTheDocument();
    expect(screen.getByText(/金额合计 ¥250.00/)).toBeInTheDocument();
  });

  it('隐私模式下应隐藏金额与商家订单号', () => {
    render(
      <TransactionTable
        rows={[
          {
            item: {
              id: 'tx-mask',
              date: '2026-03-12',
              type: 'expense',
              categoryId: 'cat-2',
              accountId: 'acc-1',
              amount: 188.66,
              note: '晚餐',
              orderNo: 'ORDER-12345678',
              merchantOrderNo: 'MERCHANT-99887766',
              tags: []
            },
            categoryName: '餐饮',
            accountName: '银行卡'
          }
        ]}
        total={1}
        filteredTotal={1}
        page={1}
        pages={1}
        pageSize={8}
        pageSizeOptions={[8, 20]}
        loading={false}
        hasFilters
        privacyMode
        selectedIds={[]}
        bulkSelectionEnabled={false}
        canSelectAllOnPage={false}
        allPageSelected={false}
        sortKey="date"
        sortDirection="desc"
        {...baseProps}
      />
    );

    expect(screen.getAllByText('¥••••').length).toBeGreaterThan(0);
    expect(screen.getByText(/商家订单：ME\*\*\*66/)).toBeInTheDocument();
  });

  it('应将收支显示为圆圈标签，并在支付宝账户展示图标', () => {
    render(
      <TransactionTable
        rows={[
          {
            item: {
              id: 'tx-income',
              date: '2026-03-12',
              type: 'income',
              categoryId: 'cat-1',
              accountId: 'acc-1',
              amount: 300,
              note: '工资',
              tags: []
            },
            categoryName: '收入',
            accountName: '支付宝'
          },
          {
            item: {
              id: 'tx-expense',
              date: '2026-03-13',
              type: 'expense',
              categoryId: 'cat-2',
              accountId: 'acc-2',
              amount: 42,
              note: '午餐',
              tags: [],
              attachments: [
                {
                  id: 'att-1',
                  name: 'receipt.jpg',
                  uploadedAt: '2026-03-13T10:00:00.000Z',
                  remotePath: '/receipts/receipt.jpg'
                }
              ]
            },
            categoryName: '餐饮',
            accountName: '现金'
          }
        ]}
        total={2}
        filteredTotal={2}
        page={1}
        pages={1}
        pageSize={8}
        pageSizeOptions={[8, 20]}
        loading={false}
        hasFilters
        selectedIds={[]}
        bulkSelectionEnabled={false}
        canSelectAllOnPage={false}
        allPageSelected={false}
        sortKey="date"
        sortDirection="desc"
        {...baseProps}
      />
    );

    expect(screen.getByLabelText('收入')).toBeInTheDocument();
    expect(screen.getByLabelText('支出')).toBeInTheDocument();
    expect(document.querySelectorAll('.alipay-icon').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('有附件').length).toBeGreaterThan(0);
  });

  it('应展示任务条统计并高亮退款/冲正行', () => {
    render(
      <TransactionTable
        rows={[
          {
            item: {
              id: 'tx-pending',
              date: '2026-03-10',
              type: 'expense',
              categoryId: 'cat-1',
              accountId: 'acc-1',
              amount: 100,
              note: '待处理支出',
              status: 'pending',
              tags: []
            },
            categoryName: '餐饮',
            accountName: '银行卡'
          },
          {
            item: {
              id: 'tx-refund',
              date: '2026-03-11',
              type: 'expense',
              categoryId: 'cat-1',
              accountId: 'acc-1',
              amount: 20,
              note: '退款单',
              status: 'refunded',
              adjustmentKind: 'refund',
              refundOfTransactionId: 'tx-origin',
              tags: []
            },
            categoryName: '餐饮',
            accountName: '银行卡'
          },
          {
            item: {
              id: 'tx-failed',
              date: '2026-03-12',
              type: 'expense',
              categoryId: 'cat-2',
              accountId: 'acc-1',
              amount: 30,
              note: '失败单',
              status: 'failed',
              tags: []
            },
            categoryName: '交通',
            accountName: '银行卡'
          },
          {
            item: {
              id: 'tx-done',
              date: '2026-03-13',
              type: 'income',
              categoryId: 'cat-3',
              accountId: 'acc-1',
              amount: 200,
              note: '已完成入账',
              status: 'completed',
              tags: []
            },
            categoryName: '工资',
            accountName: '银行卡'
          }
        ]}
        total={4}
        filteredTotal={4}
        page={1}
        pages={1}
        pageSize={8}
        pageSizeOptions={[8, 20]}
        loading={false}
        hasFilters
        selectedIds={[]}
        bulkSelectionEnabled={false}
        canSelectAllOnPage={false}
        allPageSelected={false}
        sortKey="date"
        sortDirection="desc"
        {...baseProps}
      />
    );

    const taskStrip = screen.getByLabelText('交易任务概览');
    expect(taskStrip).toBeInTheDocument();
    expect(within(taskStrip).getByText('待处理')).toBeInTheDocument();
    expect(within(taskStrip).getByText('退款 / 冲正')).toBeInTheDocument();
    expect(within(taskStrip).getByText('失败单')).toBeInTheDocument();
    expect(within(taskStrip).getByText('已完成')).toBeInTheDocument();
    expect(within(taskStrip).getByText('¥100.00')).toBeInTheDocument();
    expect(within(taskStrip).getByText('¥20.00')).toBeInTheDocument();
    expect(within(taskStrip).getByText('¥30.00')).toBeInTheDocument();
    expect(within(taskStrip).getByText('¥200.00')).toBeInTheDocument();

    expect(document.querySelector('#transaction-row-tx-refund')).toHaveClass(
      'transaction-row-refund-like'
    );
  });
});
