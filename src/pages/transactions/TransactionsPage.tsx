import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { exportTransactionsCsv } from '../../shared/lib/csv';
import { parseBillCsvToTransactions } from '../../shared/lib/billImport';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { Toast, ToastVariant } from '../../shared/ui/Toast';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { TransactionDetailDrawer } from '../../features/transactions/components/TransactionDetailDrawer';
import { TransactionFilters } from '../../features/transactions/components/TransactionFilters';
import {
  TransactionQuickFilters,
  TransactionRowView,
  TransactionSortDirection,
  TransactionSortKey,
  TransactionTable
} from '../../features/transactions/components/TransactionTable';
import { resolveDateRange, useTransactionFilters } from '../../features/transactions/hooks/useTransactionFilters';
import { TransactionSource } from '../../entities/transaction/types';

const PAGE_SIZE = 8;
type BillSource = 'wechat' | 'alipay';

const DEFAULT_QUICK_FILTERS: TransactionQuickFilters = {
  date: '',
  type: 'all',
  category: '',
  account: '',
  amount: '',
  note: ''
};

function detectSource(source: TransactionSource | undefined, note: string, tags: string[]): TransactionSource {
  if (source) {
    return source;
  }
  const combined = `${note} ${tags.join(' ')}`;
  if (/微信|wechat/i.test(combined)) {
    return 'wechat';
  }
  if (/支付宝|alipay/i.test(combined)) {
    return 'alipay';
  }
  if (/AI|识别/i.test(combined)) {
    return 'ai';
  }
  return 'manual';
}

export function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);

  const {
    filters,
    isFiltered,
    setKeyword,
    setType,
    setSource,
    setDatePreset,
    setDateFrom,
    setDateTo,
    setPage,
    clearFilters
  } = useTransactionFilters();

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [importSource, setImportSource] = useState<BillSource | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [highlightId, setHighlightId] = useState<string>('');
  const [importNotice, setImportNotice] = useState<{ visible: boolean; message: string; variant: ToastVariant }>({
    visible: false,
    message: '',
    variant: 'success'
  });
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: ToastVariant }>({
    visible: false,
    message: '',
    variant: 'success'
  });

  const [quickFilters, setQuickFilters] = useState<TransactionQuickFilters>(DEFAULT_QUICK_FILTERS);
  const [sortKey, setSortKey] = useState<TransactionSortKey>('date');
  const [sortDirection, setSortDirection] = useState<TransactionSortDirection>('desc');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dateRange = useMemo(() => resolveDateRange(filters), [filters]);

  useEffect(() => {
    if (filters.datePreset === 'custom' && dateRange.from && dateRange.to && dateRange.from > dateRange.to) {
      setErrorMessage('自定义日期范围无效：开始日期不能晚于结束日期。');
      return;
    }
    setErrorMessage('');
  }, [filters.datePreset, dateRange.from, dateRange.to]);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [filters.keyword, filters.type, filters.source, filters.datePreset, filters.dateFrom, filters.dateTo, filters.page]);

  useEffect(() => {
    if (!importNotice.visible) {
      return;
    }
    const timer = window.setTimeout(() => {
      setImportNotice((prev) => ({ ...prev, visible: false }));
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [importNotice.visible]);

  useEffect(() => {
    const highlight = searchParams.get('highlight') ?? '';
    if (!highlight) {
      return;
    }

    setHighlightId(highlight);
    const rowTimer = window.setTimeout(() => {
      const row = document.getElementById(`transaction-row-${highlight}`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);

    const clearTimer = window.setTimeout(() => {
      setHighlightId('');
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    }, 1200);

    return () => {
      window.clearTimeout(rowTimer);
      window.clearTimeout(clearTimer);
    };
  }, [searchParams, setSearchParams]);

  const filteredRows = useMemo(() => {
    return transactions.filter((item) => {
      const byType = filters.type === 'all' ? true : item.type === filters.type;
      const source = detectSource(item.source, item.note, item.tags);
      const bySource = filters.source === 'all' ? true : source === filters.source;
      const byKeyword =
        filters.keyword.trim().length === 0 ||
        item.note.toLowerCase().includes(filters.keyword.toLowerCase()) ||
        item.tags.join(',').toLowerCase().includes(filters.keyword.toLowerCase());

      let byDate = true;
      if (dateRange.from && dateRange.to) {
        const day = item.date.slice(0, 10);
        byDate = day >= dateRange.from && day <= dateRange.to;
      }

      return byType && bySource && byKeyword && byDate;
    });
  }, [transactions, filters.type, filters.source, filters.keyword, dateRange.from, dateRange.to]);

  const mappedRows: TransactionRowView[] = useMemo(() => {
    return filteredRows.map((item) => ({
      item,
      categoryName: categories.find((c) => c.id === item.categoryId)?.name ?? '-',
      accountName: accounts.find((a) => a.id === item.accountId)?.name ?? '-'
    }));
  }, [accounts, categories, filteredRows]);

  const quickFilteredRows = useMemo(() => {
    const dateFilter = quickFilters.date.trim().toLowerCase();
    const categoryFilter = quickFilters.category.trim().toLowerCase();
    const accountFilter = quickFilters.account.trim().toLowerCase();
    const amountFilter = quickFilters.amount.trim().toLowerCase();
    const noteFilter = quickFilters.note.trim().toLowerCase();

    return mappedRows.filter((row) => {
      const dateText = formatDate(row.item.date).toLowerCase();
      const typePass = quickFilters.type === 'all' ? true : row.item.type === quickFilters.type;
      const categoryPass = !categoryFilter || row.categoryName.toLowerCase().includes(categoryFilter);
      const accountPass = !accountFilter || row.accountName.toLowerCase().includes(accountFilter);
      const notePass = !noteFilter || (row.item.note || '').toLowerCase().includes(noteFilter);
      const amountPass =
        !amountFilter ||
        String(row.item.amount).toLowerCase().includes(amountFilter) ||
        formatCurrency(row.item.amount).toLowerCase().includes(amountFilter);

      return (!dateFilter || dateText.includes(dateFilter)) && typePass && categoryPass && accountPass && notePass && amountPass;
    });
  }, [mappedRows, quickFilters]);

  const sortedRows = useMemo(() => {
    const rows = [...quickFilteredRows];

    rows.sort((a, b) => {
      let compare = 0;
      switch (sortKey) {
        case 'date':
          compare = new Date(a.item.date).getTime() - new Date(b.item.date).getTime();
          break;
        case 'type':
          compare = a.item.type.localeCompare(b.item.type);
          break;
        case 'category':
          compare = a.categoryName.localeCompare(b.categoryName, 'zh-CN');
          break;
        case 'account':
          compare = a.accountName.localeCompare(b.accountName, 'zh-CN');
          break;
        case 'amount':
          compare = a.item.amount - b.item.amount;
          break;
        case 'note':
          compare = (a.item.note || '').localeCompare(b.item.note || '', 'zh-CN');
          break;
      }

      return sortDirection === 'asc' ? compare : -compare;
    });

    return rows;
  }, [quickFilteredRows, sortDirection, sortKey]);

  const pages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);

  useEffect(() => {
    if (filters.page > pages) {
      setPage(pages);
    }
  }, [filters.page, pages, setPage]);

  const viewRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selected = useMemo(
    () => transactions.find((item) => item.id === selectedId) ?? null,
    [transactions, selectedId]
  );

  const selectedCategoryName = selected
    ? categories.find((item) => item.id === selected.categoryId)?.name ?? '-'
    : '-';
  const selectedAccountName = selected
    ? accounts.find((item) => item.id === selected.accountId)?.name ?? '-'
    : '-';

  const openImport = (source: BillSource) => {
    setImportSource(source);
    fileInputRef.current?.click();
  };

  const showToast = (message: string, variant: ToastVariant) => {
    setToast({ visible: true, message, variant });
  };

  const showImportNotice = (message: string, variant: ToastVariant) => {
    setImportNotice({ visible: true, message, variant });
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !importSource) {
      return;
    }

    try {
      const csvText = await file.text();
      const defaultCategoryId = categories[0]?.id;
      const defaultAccountId = accounts[0]?.id;

      if (!defaultCategoryId || !defaultAccountId) {
        const message = '导入失败：请先创建分类和账户。';
        showToast(message, 'warning');
        showImportNotice(message, 'warning');
        return;
      }

      const parsed = parseBillCsvToTransactions({
        csvText,
        source: importSource,
        defaultCategoryId,
        defaultAccountId
      });

      if (parsed.length === 0) {
        const message = '未识别到可导入账单。';
        showToast(message, 'warning');
        showImportNotice(message, 'warning');
        return;
      }

      const insertedIds = parsed.map((item) => addTransaction(item));
      const newestId = insertedIds[insertedIds.length - 1];
      const expectedIndex = Math.max(0, filteredRows.length + parsed.length - 1);
      const expectedPage = Math.floor(expectedIndex / PAGE_SIZE) + 1;
      setPage(expectedPage);
      const message = `导入成功：新增 ${parsed.length} 条记录。`;
      showToast(message, 'success');
      showImportNotice(`${message} 已自动定位到最新一条。`, 'success');

      const next = new URLSearchParams(searchParams);
      next.set('highlight', newestId);
      setSearchParams(next, { replace: true });
    } catch {
      const message = '导入失败：文件解析异常。';
      showToast(message, 'error');
      showImportNotice(message, 'error');
    } finally {
      event.target.value = '';
      setImportSource(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (pendingDeleteIds.length === 0) {
      return;
    }

    pendingDeleteIds.forEach((id) => removeTransaction(id));

    if (selectedId && pendingDeleteIds.includes(selectedId)) {
      setSelectedId(null);
    }

    setSelectedIds((prev) => prev.filter((id) => !pendingDeleteIds.includes(id)));
    showToast(pendingDeleteIds.length > 1 ? `已删除 ${pendingDeleteIds.length} 条交易。` : '交易已删除。', 'success');
    setPendingDeleteIds([]);
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, 'success');
    } catch {
      showToast('复制失败，请检查浏览器权限。', 'error');
    }
  };

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => transactions.some((item) => item.id === id)));
  }, [transactions]);

  const pageRowIds = viewRows.map((row) => row.item.id);
  const canSelectAllOnPage = pageRowIds.length > 0;
  const allPageSelected = canSelectAllOnPage && pageRowIds.every((id) => selectedIds.includes(id));

  const handleToggleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      if (selected) {
        return Array.from(new Set([...prev, id]));
      }
      return prev.filter((itemId) => itemId !== id);
    });
  };

  const handleToggleSelectPage = (selected: boolean) => {
    setSelectedIds((prev) => {
      if (!selected) {
        return prev.filter((itemId) => !pageRowIds.includes(itemId));
      }
      return Array.from(new Set([...prev, ...pageRowIds]));
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      return;
    }
    setPendingDeleteIds(selectedIds);
  };

  const hasQuickFilters =
    quickFilters.date.trim().length > 0 ||
    quickFilters.type !== 'all' ||
    quickFilters.category.trim().length > 0 ||
    quickFilters.account.trim().length > 0 ||
    quickFilters.amount.trim().length > 0 ||
    quickFilters.note.trim().length > 0;

  const handleQuickFilterChange = <K extends keyof TransactionQuickFilters>(key: K, value: TransactionQuickFilters[K]) => {
    setQuickFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSortChange = (nextKey: TransactionSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('desc');
  };

  const clearAllFilters = () => {
    clearFilters();
    setQuickFilters(DEFAULT_QUICK_FILTERS);
  };

  const selectedSource = selected ? detectSource(selected.source, selected.note, selected.tags) : 'manual';

  return (
    <div>
      <TransactionFilters
        filters={filters}
        onKeywordChange={setKeyword}
        onTypeChange={setType}
        onSourceChange={setSource}
        onDatePresetChange={setDatePreset}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClear={clearAllFilters}
        onExport={() => exportTransactionsCsv(filteredRows)}
        onImportWechat={() => openImport('wechat')}
        onImportAlipay={() => openImport('alipay')}
      />

      {importNotice.visible ? (
        <section className={`import-result-banner import-result-${importNotice.variant}`} role="status" aria-live="polite">
          <strong>导入结果：</strong>
          <span>{importNotice.message}</span>
          <button type="button" onClick={() => setImportNotice((prev) => ({ ...prev, visible: false }))}>
            知道了
          </button>
        </section>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(event) => void handleImportFile(event)}
      />

      <TransactionTable
        rows={viewRows}
        total={transactions.length}
        filteredTotal={sortedRows.length}
        page={page}
        pages={pages}
        loading={loading}
        errorMessage={errorMessage}
        hasFilters={isFiltered || hasQuickFilters}
        highlightId={highlightId}
        onRetry={() => setErrorMessage('')}
        onClearFilters={clearAllFilters}
        sortKey={sortKey}
        sortDirection={sortDirection}
        quickFilters={quickFilters}
        onSortChange={handleSortChange}
        onQuickFilterChange={handleQuickFilterChange}
        onPrevPage={() => setPage(Math.max(1, page - 1))}
        onNextPage={() => setPage(Math.min(pages, page + 1))}
        onOpenDetail={setSelectedId}
        selectedIds={selectedIds}
        canSelectAllOnPage={canSelectAllOnPage}
        allPageSelected={allPageSelected}
        onDelete={((id) => setPendingDeleteIds([id]))}
        onDeleteSelected={handleDeleteSelected}
        onClearSelection={() => setSelectedIds([])}
        onToggleSelect={handleToggleSelect}
        onToggleSelectPage={handleToggleSelectPage}
      />

      <TransactionDetailDrawer
        open={Boolean(selected)}
        transaction={selected}
        categoryName={selectedCategoryName}
        accountName={selectedAccountName}
        source={selectedSource}
        onClose={() => setSelectedId(null)}
        onCopyNote={() => void copyText(selected?.note ?? '', '备注已复制')}
        onCopyJson={() => void copyText(JSON.stringify(selected, null, 2), 'JSON 已复制')}
        onDelete={() => {
          if (!selected) {
            return;
          }
          setPendingDeleteIds([selected.id]);
        }}
      />

      <ConfirmDialog
        open={pendingDeleteIds.length > 0}
        title={pendingDeleteIds.length > 1 ? '确认批量删除交易' : '确认删除交易'}
        description={
          pendingDeleteIds.length > 1
            ? `即将删除 ${pendingDeleteIds.length} 条交易，删除后将无法恢复。是否继续？`
            : '删除后将无法恢复。是否继续？'
        }
        confirmText={pendingDeleteIds.length > 1 ? '确认批量删除' : '确认删除'}
        cancelText="取消"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDeleteIds([])}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </div>
  );
}
