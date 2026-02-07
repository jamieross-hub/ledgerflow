import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { exportTransactionsCsv } from '../../shared/lib/csv';
import { parseBillCsvToTransactions } from '../../shared/lib/billImport';
import { Toast, ToastVariant } from '../../shared/ui/Toast';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { TransactionDetailDrawer } from '../../features/transactions/components/TransactionDetailDrawer';
import { TransactionFilters } from '../../features/transactions/components/TransactionFilters';
import { TransactionRowView, TransactionTable } from '../../features/transactions/components/TransactionTable';
import { resolveDateRange, useTransactionFilters } from '../../features/transactions/hooks/useTransactionFilters';

const PAGE_SIZE = 8;
type BillSource = 'wechat' | 'alipay';

function detectSource(note: string, tags: string[]): 'manual' | 'wechat' | 'alipay' | 'ai' {
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string>('');
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: ToastVariant }>({
    visible: false,
    message: '',
    variant: 'success'
  });

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
      const source = detectSource(item.note, item.tags);
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

  const pages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);

  useEffect(() => {
    if (filters.page > pages) {
      setPage(pages);
    }
  }, [filters.page, pages, setPage]);

  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const viewRows: TransactionRowView[] = useMemo(() => {
    return pageRows.map((item) => ({
      item,
      categoryName: categories.find((c) => c.id === item.categoryId)?.name ?? '-',
      accountName: accounts.find((a) => a.id === item.accountId)?.name ?? '-'
    }));
  }, [accounts, categories, pageRows]);

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
        showToast('导入失败：请先创建分类和账户。', 'warning');
        return;
      }

      const parsed = parseBillCsvToTransactions({
        csvText,
        source: importSource,
        defaultCategoryId,
        defaultAccountId
      });

      if (parsed.length === 0) {
        showToast('未识别到可导入账单。', 'warning');
        return;
      }

      const insertedIds = parsed.map((item) => addTransaction(item));
      const newestId = insertedIds[insertedIds.length - 1];
      const expectedIndex = Math.max(0, filteredRows.length + parsed.length - 1);
      const expectedPage = Math.floor(expectedIndex / PAGE_SIZE) + 1;
      setPage(expectedPage);
      showToast(`导入成功：新增 ${parsed.length} 条记录。`, 'success');

      const next = new URLSearchParams(searchParams);
      next.set('highlight', newestId);
      setSearchParams(next, { replace: true });
    } catch {
      showToast('导入失败：文件解析异常。', 'error');
    } finally {
      event.target.value = '';
      setImportSource(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (!pendingDeleteId) {
      return;
    }
    removeTransaction(pendingDeleteId);
    if (selectedId === pendingDeleteId) {
      setSelectedId(null);
    }
    showToast('交易已删除。', 'success');
    setPendingDeleteId(null);
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, 'success');
    } catch {
      showToast('复制失败，请检查浏览器权限。', 'error');
    }
  };

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
        onClear={clearFilters}
        onExport={() => exportTransactionsCsv(filteredRows)}
        onImportWechat={() => openImport('wechat')}
        onImportAlipay={() => openImport('alipay')}
      />

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
        filteredTotal={filteredRows.length}
        page={page}
        pages={pages}
        loading={loading}
        errorMessage={errorMessage}
        hasFilters={isFiltered}
        highlightId={highlightId}
        onRetry={() => setErrorMessage('')}
        onClearFilters={clearFilters}
        onPrevPage={() => setPage(Math.max(1, page - 1))}
        onNextPage={() => setPage(Math.min(pages, page + 1))}
        onOpenDetail={setSelectedId}
        onDelete={setPendingDeleteId}
      />

      <TransactionDetailDrawer
        open={Boolean(selected)}
        transaction={selected}
        categoryName={selectedCategoryName}
        accountName={selectedAccountName}
        onClose={() => setSelectedId(null)}
        onCopyNote={() => void copyText(selected?.note ?? '', '备注已复制')}
        onCopyJson={() => void copyText(JSON.stringify(selected, null, 2), 'JSON 已复制')}
        onDelete={() => {
          if (!selected) {
            return;
          }
          setPendingDeleteId(selected.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="确认删除交易"
        description="删除后将无法恢复。是否继续？"
        confirmText="确认删除"
        cancelText="取消"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDeleteId(null)}
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
