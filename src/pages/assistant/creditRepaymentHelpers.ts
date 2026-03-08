import type { DebtItem, RepaymentRecord } from '../../features/debt/model/debtMetrics';

export interface CreditRepaymentLookupSummary {
  matchedDebtName?: string;
  plannedRepaymentText?: string;
  paymentAccountText?: string;
  actualRepaymentText?: string;
  recordStatusText?: string;
  lookupHint?: string;
}

export interface CreditRepaymentGapSummary {
  plannedDueAmount?: string;
  recentActualPaidAmount?: string;
  gapAmount?: string;
  gapReason?: string;
  paymentAccountSummary?: string;
}

export interface CreditRepaymentSummaryItem {
  title: string;
  productType: string;
  dueAmount?: string;
  repaymentDate?: string;
}

function normalizeCreditIdentity(text: string): string {
  return String(text || '')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\-_（）()【】\[\]·•:：/]/g, '');
}

function findMatchingDebt(item: CreditRepaymentSummaryItem, debts: DebtItem[]): DebtItem | undefined {
  const currentKey = normalizeCreditIdentity(`${item.title}${item.productType}`);
  return debts.find((debt) => {
    const debtKey = normalizeCreditIdentity(`${debt.name}${debt.type}`);
    return debtKey === currentKey || debtKey.includes(currentKey) || currentKey.includes(debtKey);
  });
}

function toMoneyNumber(raw?: string): number {
  const normalized = String(raw || '').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatGapMoney(value: number): string {
  return `¥${Math.round((value + Number.EPSILON) * 100) / 100}`;
}

export function buildCreditRepaymentLookupSummary(
  item: CreditRepaymentSummaryItem,
  debts: DebtItem[],
  repaymentRecords: RepaymentRecord[]
): CreditRepaymentLookupSummary | undefined {
  const matchedDebt = findMatchingDebt(item, debts);

  const relatedRecords = repaymentRecords
    .filter((record) => (matchedDebt ? record.debtId === matchedDebt.id : false))
    .sort((a, b) => `${b.paidAt}-${b.amount}`.localeCompare(`${a.paidAt}-${a.amount}`, 'zh-CN'));

  const latestRecord = relatedRecords[0];
  const paymentAccounts = Array.from(
    new Set(relatedRecords.map((record) => String(record.paymentAccount || '').trim()).filter(Boolean))
  );

  const plannedRepaymentText = matchedDebt
    ? [
        matchedDebt.repaymentDay ? `每月${matchedDebt.repaymentDay}日` : '',
        item.dueAmount ? `本期约${item.dueAmount}` : '',
        matchedDebt.remainingMonths ? `剩余${matchedDebt.remainingMonths}期` : ''
      ]
        .filter(Boolean)
        .join(' · ')
    : item.repaymentDate || item.dueAmount
      ? [item.repaymentDate || '', item.dueAmount ? `本期约${item.dueAmount}` : ''].filter(Boolean).join(' · ')
      : undefined;

  const paymentAccountText = matchedDebt?.paymentAccount
    ? paymentAccounts.length > 0 && !paymentAccounts.includes(matchedDebt.paymentAccount)
      ? `${matchedDebt.paymentAccount}（计划） / ${paymentAccounts.join(' / ')}（实际）`
      : matchedDebt.paymentAccount
    : paymentAccounts.length > 0
      ? paymentAccounts.join(' / ')
      : undefined;

  const actualRepaymentText = latestRecord
    ? `${formatGapMoney(Number(latestRecord.amount || 0))} · ${String(latestRecord.paidAt || '').slice(0, 10) || '日期待确认'}`
    : undefined;

  let recordStatusText = '';
  let lookupHint = '';
  if (matchedDebt && relatedRecords.length === 0) {
    recordStatusText = '已命中负债，未命中最近还款流水';
    lookupHint = '计划存在，但流水侧暂未确认；如果实际已还，建议补录还款记录或核对账户归属。';
  } else if (matchedDebt && relatedRecords.length > 0) {
    recordStatusText = '已命中负债，也命中最近还款流水';
    lookupHint = '这笔信贷的计划、账户和近期还款记录都已串起来，可直接继续核对缺口。';
  } else if (!matchedDebt && relatedRecords.length > 0) {
    recordStatusText = '命中还款流水，但未稳定命中负债';
    lookupHint = '流水里看到了还款，但当前识别结果还没和已保存负债稳定关联，建议确认是否为同一笔。';
  } else {
    recordStatusText = '暂未命中已保存负债或还款流水';
    lookupHint = '当前更像一张新识别卡片，若想继续查台账，需要先补产品名、还款日或金额等锚点。';
  }

  if (!matchedDebt && relatedRecords.length === 0 && !plannedRepaymentText && !paymentAccountText) {
    return undefined;
  }

  return {
    matchedDebtName: matchedDebt?.name,
    plannedRepaymentText,
    paymentAccountText,
    actualRepaymentText,
    recordStatusText,
    lookupHint
  };
}

export function buildCreditRepaymentGapSummary(
  item: CreditRepaymentSummaryItem,
  debts: DebtItem[],
  repaymentRecords: RepaymentRecord[]
): CreditRepaymentGapSummary | undefined {
  const matchedDebt = findMatchingDebt(item, debts);

  const planned = toMoneyNumber(item.dueAmount) || (matchedDebt ? Number(matchedDebt.customMinPayment || 0) : 0);
  const relatedRecords = repaymentRecords
    .filter((record) => (matchedDebt ? record.debtId === matchedDebt.id : false))
    .sort((a, b) => `${b.paidAt}-${b.amount}`.localeCompare(`${a.paidAt}-${a.amount}`, 'zh-CN'));

  const recentPaid = relatedRecords.slice(0, 3).reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const gap = Math.max(0, planned - recentPaid);
  const paymentAccounts = Array.from(
    new Set(relatedRecords.map((record) => String(record.paymentAccount || '').trim()).filter(Boolean))
  );

  let gapReason = '';
  if (planned > 0 && recentPaid === 0) {
    gapReason = '计划里有应还，但流水侧暂未确认已还记录';
  } else if (planned > recentPaid && recentPaid > 0) {
    gapReason = '存在部分已还，可能还有待补录或未匹配的还款';
  } else if (planned === 0 && recentPaid > 0) {
    gapReason = '已记录到还款流水，但当前卡片里尚未识别出明确计划应还';
  } else if (
    matchedDebt?.paymentAccount &&
    paymentAccounts.length > 0 &&
    !paymentAccounts.includes(matchedDebt.paymentAccount)
  ) {
    gapReason = `计划账户是“${matchedDebt.paymentAccount}”，但最近还款来自“${paymentAccounts.join(' / ')}”`;
  } else {
    gapReason = '计划与流水基本一致，若仍有差异建议再核对账单或扣款账户';
  }

  if (planned <= 0 && recentPaid <= 0 && !matchedDebt) {
    return undefined;
  }

  return {
    plannedDueAmount: planned > 0 ? formatGapMoney(planned) : undefined,
    recentActualPaidAmount: recentPaid > 0 ? formatGapMoney(recentPaid) : undefined,
    gapAmount: gap > 0 ? formatGapMoney(gap) : '0',
    gapReason,
    paymentAccountSummary:
      paymentAccounts.length > 0
        ? paymentAccounts.join(' / ')
        : matchedDebt?.paymentAccount || undefined
  };
}
