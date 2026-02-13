import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFinanceStore } from '../../shared/store/useFinanceStore';
import { exportTransactionsCsv } from '../../shared/lib/csv';
import { parseBillCsvToTransactions } from '../../shared/lib/billImport';
import { formatCurrency, formatDate } from '../../shared/lib/format';
import { Toast, ToastVariant } from '../../shared/ui/Toast';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import {
  TransactionDetailDrawer,
  TransactionDetailSectionKey
} from '../../features/transactions/components/TransactionDetailDrawer';
import { TransactionFilters } from '../../features/transactions/components/TransactionFilters';
import {
  TransactionColumnKey,
  TransactionQuickFilters,
  TransactionRowView,
  TransactionSortDirection,
  TransactionSortKey,
  TransactionTable
} from '../../features/transactions/components/TransactionTable';
import {
  resolveDateRange,
  useTransactionFilters
} from '../../features/transactions/hooks/useTransactionFilters';
import { Category } from '../../entities/category/types';
import { TransactionSource } from '../../entities/transaction/types';

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [8, 20, 50, 100] as const;
const TX_PAGE_SIZE_KEY = 'ledgerflow.transactions.pageSize';
type BillSource = 'wechat' | 'alipay';

const DEFAULT_QUICK_FILTERS: TransactionQuickFilters = {
  date: '',
  type: 'all',
  category: '',
  account: '',
  amount: '',
  orderNo: '',
  merchantOrderNo: '',
  note: ''
};

const DEFAULT_VISIBLE_COLUMNS: Record<TransactionColumnKey, boolean> = {
  date: true,
  type: true,
  category: true,
  account: true,
  amount: true,
  orderNo: true,
  merchantOrderNo: true,
  note: true
};

const DEFAULT_COLUMN_ORDER: TransactionColumnKey[] = [
  'date',
  'type',
  'category',
  'account',
  'amount',
  'orderNo',
  'merchantOrderNo',
  'note'
];

const COLUMN_OPTIONS: Array<{ key: TransactionColumnKey; label: string }> = [
  { key: 'date', label: '日期' },
  { key: 'type', label: '类型' },
  { key: 'category', label: '分类' },
  { key: 'account', label: '账户' },
  { key: 'amount', label: '金额' },
  { key: 'orderNo', label: '交易订单号' },
  { key: 'merchantOrderNo', label: '商家订单号' },
  { key: 'note', label: '备注' }
];

const DEFAULT_DETAIL_SECTIONS: Record<TransactionDetailSectionKey, boolean> = {
  base: true,
  source: true,
  note: true,
  tags: true,
  json: false
};

const TX_VISIBLE_COLUMNS_KEY = 'ledgerflow.transactions.visibleColumns';
const TX_COLUMN_ORDER_KEY = 'ledgerflow.transactions.columnOrder';
const TX_COLUMN_WIDTHS_KEY = 'ledgerflow.transactions.columnWidths';
const TX_DETAIL_SECTIONS_KEY = 'ledgerflow.transactions.detailSections';

const IMPORT_CATEGORY_RULES: Array<{ pattern: RegExp; names: string[] }> = [
  { pattern: /工资|薪资|salary|payroll|奖金/i, names: ['工资', '收入'] },
  {
    pattern: /打车|出租|滴滴|顺风车|地铁|公交|高德|出行|交通|taxi|metro|bus/i,
    names: ['交通', '出行', '打车']
  },
  { pattern: /餐|外卖|奶茶|咖啡|food|meal|restaurant/i, names: ['餐饮', '美食'] }
];

function restoreRecordState<K extends string>(
  storageKey: string,
  defaults: Record<K, boolean>
): Record<K, boolean> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<K, boolean>>;
    const next = { ...defaults };
    (Object.keys(defaults) as K[]).forEach((key) => {
      if (typeof parsed[key] === 'boolean') {
        next[key] = Boolean(parsed[key]);
      }
    });
    return next;
  } catch {
    return defaults;
  }
}

function restorePageSize(): number {
  try {
    const raw = window.localStorage.getItem(TX_PAGE_SIZE_KEY);
    if (!raw) return DEFAULT_PAGE_SIZE;
    const parsed = Number(raw);
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
      ? parsed
      : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function restoreColumnOrder(storageKey: string): TransactionColumnKey[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_COLUMN_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_COLUMN_ORDER;
    const valid = parsed.filter((item): item is TransactionColumnKey =>
      DEFAULT_COLUMN_ORDER.includes(item as TransactionColumnKey)
    );
    if (valid.length !== DEFAULT_COLUMN_ORDER.length) return DEFAULT_COLUMN_ORDER;
    return valid;
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

function restoreColumnWidths(storageKey: string): Partial<Record<TransactionColumnKey, number>> {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Partial<Record<TransactionColumnKey, number>> = {};
    DEFAULT_COLUMN_ORDER.forEach((key) => {
      const value = Number(parsed[key]);
      if (Number.isFinite(value) && value >= 90 && value <= 640) {
        next[key] = Math.round(value);
      }
    });
    return next;
  } catch {
    return {};
  }
}

/**
 * 导入账单分类匹配：优先按关键字命中“交通/工资/餐饮”等，失败时回落到默认分类。
 * 规则顺序很关键：交通在餐饮前，避免“高德打车”被误命中到餐饮。
 */
function resolveImportedCategoryId(
  item: { type: string; note: string; tags?: string[] },
  categories: Category[],
  fallbackCategoryId: string
): string {
  const text = `${item.note || ''} ${(item.tags || []).join(' ')}`;
  const typePrefixedText = `${item.type} ${text}`;

  for (const rule of IMPORT_CATEGORY_RULES) {
    if (!rule.pattern.test(typePrefixedText)) continue;
    const hit = categories.find((category) =>
      rule.names.some((name) => category.name.includes(name))
    );
    if (hit) return hit.id;
  }

  return fallbackCategoryId;
}

/**
 * 兼容账单文件常见编码：
 * - 优先 UTF-8
 * - 若出现乱码，再尝试 GB18030（覆盖 GBK/GB2312）
 */
function decodeBillFileText(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (/交易|金额|收\/支|交易时间|交易创建时间/.test(utf8) && !utf8.includes('�')) {
      return utf8;
    }

    try {
      const gbText = new TextDecoder('gb18030').decode(buffer);
      if (/交易|金额|收\/支|交易时间|交易创建时间/.test(gbText)) {
        return gbText;
      }
    } catch {
      // ignore unsupported encoding
    }

    return utf8;
  });
}

function detectSource(
  source: TransactionSource | undefined,
  note: string,
  tags: string[]
): TransactionSource {
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

function buildDuplicateSignature(item: {
  date: string;
  amount: number;
  type: string;
  note: string;
}) {
  return `${item.date.slice(0, 10)}|${Math.round(Number(item.amount || 0) * 100) / 100}|${item.type}|${String(item.note || '').trim()}`;
}

/** 将交易按“可判重 key”分组：订单号 > 商家订单号 > 内容指纹。 */
function buildDuplicateGroups(rows: TransactionRowView[]): string[][] {
  const groups = new Map<string, string[]>();
  rows.forEach(({ item }) => {
    const key = item.orderNo
      ? `order:${item.orderNo}`
      : item.merchantOrderNo
        ? `merchant:${item.merchantOrderNo}`
        : `content:${buildDuplicateSignature(item)}`;
    groups.set(key, [...(groups.get(key) || []), item.id]);
  });
  return Array.from(groups.values()).filter((ids) => ids.length > 1);
}

export function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const categories = useFinanceStore((s) => s.categories);
  const accounts = useFinanceStore((s) => s.accounts);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);
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
  const [importNotice, setImportNotice] = useState<{
    visible: boolean;
    message: string;
    variant: ToastVariant;
  }>({
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
  const [visibleColumns, setVisibleColumns] = useState<Record<TransactionColumnKey, boolean>>(() =>
    restoreRecordState<TransactionColumnKey>(TX_VISIBLE_COLUMNS_KEY, DEFAULT_VISIBLE_COLUMNS)
  );
  const [columnOrder, setColumnOrder] = useState<TransactionColumnKey[]>(() =>
    restoreColumnOrder(TX_COLUMN_ORDER_KEY)
  );
  const [visibleDetailSections, setVisibleDetailSections] = useState<
    Record<TransactionDetailSectionKey, boolean>
  >(() =>
    restoreRecordState<TransactionDetailSectionKey>(TX_DETAIL_SECTIONS_KEY, DEFAULT_DETAIL_SECTIONS)
  );
  const [columnWidths, setColumnWidths] = useState<Partial<Record<TransactionColumnKey, number>>>(
    () => restoreColumnWidths(TX_COLUMN_WIDTHS_KEY)
  );
  // 页大小允许用户按账单密度自由切换，长列表下减少翻页成本。
  const [pageSize, setPageSize] = useState<number>(() => restorePageSize());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importSourceRef = useRef<BillSource | null>(null);

  const dateRange = useMemo(() => resolveDateRange(filters), [filters]);

  useEffect(() => {
    if (
      filters.datePreset === 'custom' &&
      dateRange.from &&
      dateRange.to &&
      dateRange.from > dateRange.to
    ) {
      setErrorMessage('自定义日期范围无效：开始日期不能晚于结束日期。');
      return;
    }
    setErrorMessage('');
  }, [filters.datePreset, dateRange.from, dateRange.to]);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [
    filters.keyword,
    filters.type,
    filters.source,
    filters.datePreset,
    filters.dateFrom,
    filters.dateTo,
    filters.page
  ]);

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
    window.localStorage.setItem(TX_VISIBLE_COLUMNS_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    window.localStorage.setItem(TX_COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    window.localStorage.setItem(TX_DETAIL_SECTIONS_KEY, JSON.stringify(visibleDetailSections));
  }, [visibleDetailSections]);

  useEffect(() => {
    window.localStorage.setItem(TX_PAGE_SIZE_KEY, String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    window.localStorage.setItem(TX_COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths));
  }, [columnWidths]);

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
    const orderNoFilter = quickFilters.orderNo.trim().toLowerCase();
    const merchantOrderNoFilter = quickFilters.merchantOrderNo.trim().toLowerCase();
    const noteFilter = quickFilters.note.trim().toLowerCase();

    return mappedRows.filter((row) => {
      const dateText = formatDate(row.item.date).toLowerCase();
      const typePass = quickFilters.type === 'all' ? true : row.item.type === quickFilters.type;
      const categoryPass =
        !categoryFilter || row.categoryName.toLowerCase().includes(categoryFilter);
      const accountPass = !accountFilter || row.accountName.toLowerCase().includes(accountFilter);
      const orderNoPass =
        !orderNoFilter || (row.item.orderNo || '').toLowerCase().includes(orderNoFilter);
      const merchantOrderNoPass =
        !merchantOrderNoFilter ||
        (row.item.merchantOrderNo || '').toLowerCase().includes(merchantOrderNoFilter);
      const notePass = !noteFilter || (row.item.note || '').toLowerCase().includes(noteFilter);
      const amountPass =
        !amountFilter ||
        String(row.item.amount).toLowerCase().includes(amountFilter) ||
        formatCurrency(row.item.amount).toLowerCase().includes(amountFilter);

      return (
        (!dateFilter || dateText.includes(dateFilter)) &&
        typePass &&
        categoryPass &&
        accountPass &&
        amountPass &&
        orderNoPass &&
        merchantOrderNoPass &&
        notePass
      );
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
        case 'orderNo':
          compare = (a.item.orderNo || '').localeCompare(b.item.orderNo || '', 'zh-CN');
          break;
        case 'merchantOrderNo':
          compare = (a.item.merchantOrderNo || '').localeCompare(
            b.item.merchantOrderNo || '',
            'zh-CN'
          );
          break;
        case 'note':
          compare = (a.item.note || '').localeCompare(b.item.note || '', 'zh-CN');
          break;
      }

      return sortDirection === 'asc' ? compare : -compare;
    });

    return rows;
  }, [quickFilteredRows, sortDirection, sortKey]);

  const pages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const page = Math.min(filters.page, pages);

  useEffect(() => {
    if (filters.page > pages) {
      setPage(pages);
    }
  }, [filters.page, pages, setPage]);

  const viewRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const selected = useMemo(
    () => transactions.find((item) => item.id === selectedId) ?? null,
    [transactions, selectedId]
  );

  const selectedCategoryName = selected
    ? (categories.find((item) => item.id === selected.categoryId)?.name ?? '-')
    : '-';
  const selectedAccountName = selected
    ? (accounts.find((item) => item.id === selected.accountId)?.name ?? '-')
    : '-';

  /**
   * 这里同时写 state + ref：
   * state 用于 UI，ref 用于规避“点击后立即选文件”时的异步时序竞态。
   */
  const openImport = (source: BillSource) => {
    importSourceRef.current = source;
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
    const activeSource = importSourceRef.current || importSource;
    if (!file || !activeSource) {
      return;
    }

    try {
      const csvText = await decodeBillFileText(file);
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
        source: activeSource,
        defaultCategoryId,
        defaultAccountId
      });

      if (parsed.length === 0) {
        const message = '未识别到可导入账单。';
        showToast(message, 'warning');
        showImportNotice(message, 'warning');
        return;
      }

      const normalizedParsed = parsed.map((item) => ({
        ...item,
        categoryId: resolveImportedCategoryId(item, categories, defaultCategoryId)
      }));

      const insertedIds = normalizedParsed.map((item) => addTransaction(item));
      const newestId = insertedIds[insertedIds.length - 1];
      const expectedIndex = Math.max(0, filteredRows.length + normalizedParsed.length - 1);
      const expectedPage = Math.floor(expectedIndex / pageSize) + 1;
      setPage(expectedPage);
      const message = `导入成功：新增 ${normalizedParsed.length} 条记录。`;
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
      importSourceRef.current = null;
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
    showToast(
      pendingDeleteIds.length > 1 ? `已删除 ${pendingDeleteIds.length} 条交易。` : '交易已删除。',
      'success'
    );
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
    quickFilters.orderNo.trim().length > 0 ||
    quickFilters.merchantOrderNo.trim().length > 0 ||
    quickFilters.note.trim().length > 0;

  const handleQuickFilterChange = <K extends keyof TransactionQuickFilters>(
    key: K,
    value: TransactionQuickFilters[K]
  ) => {
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

  const handleCheckDuplicates = () => {
    // 仅针对当前筛选结果做判重，避免对全量历史做破坏性处理。
    const duplicateGroups = buildDuplicateGroups(sortedRows);
    const duplicateCount = duplicateGroups.reduce((sum, group) => sum + group.length, 0);

    if (duplicateCount === 0) {
      showToast('检测完成：未发现重复账单。', 'success');
      return;
    }

    const shouldOverwrite = window.confirm(
      `检测完成：发现 ${duplicateCount} 条疑似重复账单。\n点击“确定”覆盖重复账单（每组保留最新一条）；点击“取消”继续选择删除重复。`
    );

    if (shouldOverwrite) {
      // 覆盖策略：每组保留最新一条，并把其他重复条目的补充信息并入后删除。
      duplicateGroups.forEach((group) => {
        const txs = group
          .map((id) => transactions.find((item) => item.id === id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .sort((a, b) => +new Date(b.date) - +new Date(a.date));
        const keeper = txs[0];
        const duplicates = txs.slice(1);
        if (!keeper || duplicates.length === 0) return;

        const merged = duplicates.reduce(
          (acc, item) => ({
            ...acc,
            note: acc.note || item.note,
            orderNo: acc.orderNo || item.orderNo,
            merchantOrderNo: acc.merchantOrderNo || item.merchantOrderNo,
            tags: Array.from(new Set([...(acc.tags || []), ...(item.tags || [])]))
          }),
          keeper
        );

        updateTransaction(keeper.id, {
          ...merged,
          amount: Math.round(Number(merged.amount || 0) * 100) / 100
        });
        duplicates.forEach((item) => removeTransaction(item.id));
      });

      showToast('已完成覆盖去重（每组保留最新一条）。', 'success');
      return;
    }

    const shouldDelete = window.confirm(
      '是否删除重复账单？\n点击“确定”删除重复账单（每组保留最早一条）；点击“取消”不处理。'
    );

    if (shouldDelete) {
      // 删除策略：每组保留最早一条，删除其余重复条目。
      duplicateGroups.forEach((group) => {
        const txs = group
          .map((id) => transactions.find((item) => item.id === id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .sort((a, b) => +new Date(a.date) - +new Date(b.date));
        txs.slice(1).forEach((item) => removeTransaction(item.id));
      });
      showToast('已删除重复账单（每组保留最早一条）。', 'success');
      return;
    }

    showToast('已取消重复账单处理。', 'warning');
  };

  const handleToggleColumn = (key: TransactionColumnKey) => {
    setVisibleColumns((prev) => {
      const next = !prev[key];
      if (!next) {
        const enabledCount = Object.values(prev).filter(Boolean).length;
        if (enabledCount <= 1) {
          return prev;
        }
      }
      return { ...prev, [key]: next };
    });
  };

  const handleColumnReorder = (fromKey: TransactionColumnKey, toKey: TransactionColumnKey) => {
    setColumnOrder((prev) => {
      const fromIndex = prev.indexOf(fromKey);
      const toIndex = prev.indexOf(toKey);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      const next = [...prev];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromKey);
      return next;
    });
  };

  const handleColumnResize = (key: TransactionColumnKey, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: Math.max(90, Math.round(width)) }));
  };

  const handleToggleDetailSection = (key: TransactionDetailSectionKey) => {
    setVisibleDetailSections((prev) => {
      const next = !prev[key];
      if (!next) {
        const enabledCount = Object.values(prev).filter(Boolean).length;
        if (enabledCount <= 1) {
          return prev;
        }
      }
      return { ...prev, [key]: next };
    });
  };

  const selectedSource = selected
    ? detectSource(selected.source, selected.note, selected.tags)
    : 'manual';

  return (
    <div className="transactions-page">
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
        onCheckDuplicates={handleCheckDuplicates}
        columnOptions={COLUMN_OPTIONS}
        visibleColumns={visibleColumns}
        onToggleColumn={handleToggleColumn}
      />

      {importNotice.visible ? (
        <section
          className={`import-result-banner import-result-${importNotice.variant}`}
          role="status"
          aria-live="polite"
        >
          <strong>导入结果：</strong>
          <span>{importNotice.message}</span>
          <button
            type="button"
            onClick={() => setImportNotice((prev) => ({ ...prev, visible: false }))}
          >
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
        pageSize={pageSize}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
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
        onPageSizeChange={(size) => {
          // 切换页大小后重置到第一页，避免超页码导致用户误解“数据丢失”。
          setPageSize(size);
          setPage(1);
        }}
        onOpenDetail={setSelectedId}
        selectedIds={selectedIds}
        canSelectAllOnPage={canSelectAllOnPage}
        allPageSelected={allPageSelected}
        onDelete={(id) => setPendingDeleteIds([id])}
        onDeleteSelected={handleDeleteSelected}
        onClearSelection={() => setSelectedIds([])}
        onToggleSelect={handleToggleSelect}
        onToggleSelectPage={handleToggleSelectPage}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        onColumnReorder={handleColumnReorder}
        columnWidths={columnWidths}
        onColumnResize={handleColumnResize}
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
        visibleSections={visibleDetailSections}
        onToggleSection={handleToggleDetailSection}
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
