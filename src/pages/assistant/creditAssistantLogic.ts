import type { DebtItem, RepaymentRecord } from '../../features/debt/model/debtMetrics';
import {
  buildCreditRepaymentGapSummary,
  buildCreditRepaymentLookupSummary
} from './creditRepaymentHelpers';
import type { CreditConflictField, CreditExtractedItem } from './creditAssistantTypes';

export interface CreditHistoryLikeItem {
  role: 'user' | 'assistant';
  creditItems?: CreditExtractedItem[];
}

function normalizeCreditIdentity(text: string): string {
  return text.replace(/\s+/g, '').replace(/[（）()\-·:：]/g, '').toLowerCase();
}

export function countCompletedCreditFields(item: CreditExtractedItem): number {
  return [
    item.title,
    item.dueAmount,
    item.totalDebt,
    item.repaymentDate,
    item.monthlyAmount,
    item.rateType || item.interest
  ].filter((value) => String(value || '').trim()).length;
}

function mergeCreditItemPair(base: CreditExtractedItem, incoming: CreditExtractedItem): CreditExtractedItem {
  const pendingFields = Array.from(new Set([...(base.pendingFields || []), ...(incoming.pendingFields || [])])).filter(
    (field) => {
      if (field === '当前应还' && (incoming.dueAmount || base.dueAmount)) return false;
      if (field === '剩余待还' && (incoming.totalDebt || base.totalDebt)) return false;
      if (field === '还款日' && (incoming.repaymentDate || base.repaymentDate)) return false;
      if (field === '每期金额' && (incoming.monthlyAmount || base.monthlyAmount)) return false;
      return true;
    }
  );

  return {
    ...base,
    ...incoming,
    title: incoming.title || base.title,
    productType: incoming.productType || base.productType,
    dueAmount: incoming.dueAmount || base.dueAmount,
    totalDebt: incoming.totalDebt || base.totalDebt,
    repaymentDate: incoming.repaymentDate || base.repaymentDate,
    remainingPeriods: incoming.remainingPeriods || base.remainingPeriods,
    monthlyAmount: incoming.monthlyAmount || base.monthlyAmount,
    interest: incoming.interest || base.interest,
    rateType: incoming.rateType || base.rateType,
    rateSource: incoming.rateSource || base.rateSource,
    riskHint: incoming.riskHint || base.riskHint,
    actionSuggestion: incoming.actionSuggestion || base.actionSuggestion,
    confirmationState: incoming.confirmationState || base.confirmationState,
    confirmationSummary: incoming.confirmationSummary || base.confirmationSummary,
    conflictHint: incoming.conflictHint || base.conflictHint,
    repaymentGapSummary: incoming.repaymentGapSummary || base.repaymentGapSummary,
    pendingFields,
    mergedFromHistory: base.mergedFromHistory || incoming.mergedFromHistory,
    confidence:
      incoming.confidence === 'high' || base.confidence === 'high'
        ? 'high'
        : incoming.confidence === 'medium' || base.confidence === 'medium'
          ? 'medium'
          : 'low'
  };
}

export function dedupeCreditItems(items: CreditExtractedItem[]): CreditExtractedItem[] {
  if (items.length <= 1) return items;

  const merged = new Map<string, CreditExtractedItem>();
  items.forEach((item, index) => {
    const identityKey = normalizeCreditIdentity(`${item.title}${item.productType}`) || `credit-item-${index}`;
    const nextItem = { ...item, identityKey };
    const existing = merged.get(identityKey);
    if (!existing) {
      merged.set(identityKey, nextItem);
      return;
    }
    merged.set(identityKey, mergeCreditItemPair(existing, nextItem));
  });

  return Array.from(merged.values());
}

export function mergeCreditItemsWithHistory(
  currentItems: CreditExtractedItem[],
  history: CreditHistoryLikeItem[]
): CreditExtractedItem[] {
  if (currentItems.length === 0) return currentItems;

  const previousItems = dedupeCreditItems(
    [...history]
      .reverse()
      .filter((item) => item.role === 'assistant' && Array.isArray(item.creditItems) && item.creditItems.length > 0)
      .flatMap((item) => item.creditItems || [])
      .slice(0, 8)
  );

  const mergedCurrentItems = currentItems.map((item) => {
    const currentKey = normalizeCreditIdentity(`${item.title}${item.productType}`);
    const matched = previousItems.find((prev) => {
      const prevKey = normalizeCreditIdentity(`${prev.title}${prev.productType}`);
      return prevKey === currentKey || prevKey.includes(currentKey) || currentKey.includes(prevKey);
    });
    if (!matched) return item;

    return {
      ...mergeCreditItemPair(matched, item),
      mergedFromHistory: true
    };
  });

  return dedupeCreditItems(mergedCurrentItems);
}

function findMatchingDebt(item: CreditExtractedItem, debts: DebtItem[]): DebtItem | undefined {
  const currentKey = normalizeCreditIdentity(`${item.title}${item.productType}`);
  const currentNameKey = normalizeCreditIdentity(item.title);
  return debts.find((debt) => {
    const debtKey = normalizeCreditIdentity(`${debt.name}${debt.type}`);
    const debtNameKey = normalizeCreditIdentity(debt.name);
    return (
      debtNameKey === currentNameKey ||
      debtNameKey.includes(currentNameKey) ||
      currentNameKey.includes(debtNameKey) ||
      debtKey === currentKey ||
      debtKey.includes(currentKey) ||
      currentKey.includes(debtKey)
    );
  });
}

function formatDebtCompareValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '未填写';
  return String(value);
}

function normalizeCreditDebtPayload(item: CreditExtractedItem): Omit<DebtItem, 'id'> {
  const extractNumberText = (value?: string) => {
    if (!value) return '';
    const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? match[0] : '';
  };

  const extractDayText = (value?: string) => {
    if (!value) return '';
    const match = value.match(/(\d{1,2})(?:日|号)?/);
    return match ? match[1] : '';
  };

  const normalizedTypeText = `${item.productType} ${item.title}`;
  const type: 'credit-card' | 'consumer-loan' | 'loan' = /房贷|车贷|按揭|贷款/i.test(normalizedTypeText)
    ? 'loan'
    : /花呗|白条|分期|消费贷|借呗|现金贷/i.test(normalizedTypeText)
      ? 'consumer-loan'
      : 'credit-card';

  const toNumber = (value?: string) => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const totalPeriodsNumber = extractNumberText(item.remainingPeriods);
  const balance = toNumber(extractNumberText(item.totalDebt) || extractNumberText(item.dueAmount)) || 0;
  const annualRate = toNumber(extractNumberText(item.interest));
  const remainingMonths = toNumber(totalPeriodsNumber);
  const totalPeriods = toNumber(totalPeriodsNumber);
  const loanPrincipal = toNumber(extractNumberText(item.totalDebt));
  const totalRepayment = toNumber(extractNumberText(item.totalDebt));
  const repaymentDay = toNumber(extractDayText(item.repaymentDate));

  return {
    name: item.title || '待确认负债',
    type,
    balance,
    annualRate,
    remainingMonths,
    totalPeriods,
    paidPeriods: undefined,
    loanPrincipal,
    totalRepayment,
    repaymentDay,
    paymentAccount: undefined,
    customMinPayment: undefined,
    billDay: undefined,
    repaymentMethod: type === 'loan' ? 'equal-installment' : 'minimum-payment',
    repaymentRecordMode: 'manual',
    graceDays: 0
  };
}

function buildCreditConflictFields(item: CreditExtractedItem, matchedDebt?: DebtItem): CreditConflictField[] | undefined {
  if (!matchedDebt) return undefined;

  const nextPayload = normalizeCreditDebtPayload(item);
  const comparisons = [
    { label: '名称', currentValue: matchedDebt.name, nextValue: nextPayload.name },
    { label: '余额/待还', currentValue: matchedDebt.balance, nextValue: nextPayload.balance },
    { label: 'APR/年化', currentValue: matchedDebt.annualRate, nextValue: nextPayload.annualRate },
    { label: '还款日', currentValue: matchedDebt.repaymentDay, nextValue: nextPayload.repaymentDay },
    { label: '剩余期数', currentValue: matchedDebt.remainingMonths, nextValue: nextPayload.remainingMonths },
    { label: '扣款账户', currentValue: matchedDebt.paymentAccount, nextValue: nextPayload.paymentAccount }
  ];

  const rows = comparisons
    .map((row) => ({
      label: row.label,
      currentValue: formatDebtCompareValue(row.currentValue),
      nextValue: formatDebtCompareValue(row.nextValue)
    }))
    .filter((row) => row.currentValue !== row.nextValue);

  return rows.length > 0 ? rows : undefined;
}

function buildCreditConfirmationSummary(item: CreditExtractedItem): string[] {
  return [
    `产品：${item.title || '待确认'}`,
    `当前应还：${item.dueAmount || '待确认'}`,
    `剩余待还：${item.totalDebt || '待确认'}`,
    `还款日：${item.repaymentDate || '待确认'}`,
    `每期金额：${item.monthlyAmount || '待确认'}`,
    `APR/年化：${item.rateType || item.interest || '待确认'}`,
    `状态：${item.pendingFields.length === 0 ? '字段基本齐全，可确认保存' : `仍待补充 ${item.pendingFields.join('、')}`}`
  ];
}

export function enrichCreditItemsForConfirmation(
  items: CreditExtractedItem[],
  history: CreditHistoryLikeItem[],
  debts: DebtItem[],
  repaymentRecords: RepaymentRecord[]
): CreditExtractedItem[] {
  return items.map((item) => {
    const similarHistoryCount = history.filter(
      (historyItem) =>
        historyItem.role === 'assistant' &&
        Array.isArray(historyItem.creditItems) &&
        (historyItem.creditItems || []).some((prev) => {
          const prevKey = normalizeCreditIdentity(`${prev.title}${prev.productType}`);
          const currentKey = normalizeCreditIdentity(`${item.title}${item.productType}`);
          return prev.id !== item.id && (prevKey === currentKey || prevKey.includes(currentKey) || currentKey.includes(prevKey));
        })
    ).length;

    const identityKey = normalizeCreditIdentity(`${item.title}${item.productType}`) || item.id;
    const completedCount = countCompletedCreditFields(item);
    const completionRatio = Math.min(100, Math.round((completedCount / 6) * 100));
    const matchedDebt = findMatchingDebt(item, debts);
    const conflictFields = buildCreditConflictFields(item, matchedDebt);

    const normalizedPendingFields = Array.from(
      new Set((item.pendingFields || []).map((field) => String(field || '').trim()).filter(Boolean))
    );

    return {
      ...item,
      pendingFields: normalizedPendingFields,
      identityKey,
      completionRatio,
      completionLabel: `${completedCount}/6 关键字段已补齐`,
      confirmationState: completedCount >= 4 ? 'ready' : 'needs-more-info',
      confirmationSummary: buildCreditConfirmationSummary({
        ...item,
        pendingFields: normalizedPendingFields
      }),
      matchedDebtId: matchedDebt?.id,
      matchedDebtName: matchedDebt?.name,
      conflictFields,
      conflictHint:
        conflictFields && conflictFields.length > 0
          ? `检测到这张结果可能对应已保存负债“${matchedDebt?.name || '已有负债'}”，建议先确认是更新原条目还是另存为新。`
          : similarHistoryCount > 1
            ? '检测到历史里有相似信贷项目，保存前建议确认是否为同一笔，避免重复合并。'
            : undefined,
      repaymentGapSummary: buildCreditRepaymentGapSummary(item, debts, repaymentRecords),
      repaymentLookupSummary: buildCreditRepaymentLookupSummary(item, debts, repaymentRecords)
    };
  });
}

export function buildCreditFollowUpPrompts(items: CreditExtractedItem[]): string[] {
  const prompts: string[] = [];
  items.forEach((item) => {
    const title = item.title || '这笔负债';
    if (item.pendingFields.includes('还款日')) {
      prompts.push(`我补充一下“${title}”的还款日，你继续完善这张还款卡片`);
    }
    if (item.pendingFields.includes('每期金额')) {
      prompts.push(`我补充“${title}”的每期金额/月供，你帮我更新识别结果`);
    }
    if (item.pendingFields.includes('当前应还') || item.pendingFields.includes('剩余待还')) {
      prompts.push(`我再补一张“${title}”账单图，你继续识别应还和剩余待还`);
    }
  });
  prompts.push('基于当前信息，直接告诉我还缺哪几个字段才能保存到还款管理');
  prompts.push('如果我现在继续补充一句说明或再发一张图，你希望我优先补什么？');
  return Array.from(new Set(prompts)).slice(0, 4);
}
