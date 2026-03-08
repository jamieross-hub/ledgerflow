export interface CreditConflictField {
  label: string;
  currentValue: string;
  nextValue: string;
}

export interface CreditExtractedItem {
  id: string;
  title: string;
  productType: string;
  dueAmount?: string;
  totalDebt?: string;
  repaymentDate?: string;
  remainingPeriods?: string;
  monthlyAmount?: string;
  interest?: string;
  rateType?: string;
  rateSource?: 'explicit' | 'inferred' | 'pending';
  riskHint?: string;
  actionSuggestion?: string;
  pendingFields: string[];
  confidence: 'high' | 'medium' | 'low';
  confirmationState?: 'ready' | 'needs-more-info';
  confirmationSummary?: string[];
  conflictHint?: string;
  identityKey?: string;
  completionRatio?: number;
  completionLabel?: string;
  mergedFromHistory?: boolean;
  matchedDebtId?: string;
  matchedDebtName?: string;
  conflictFields?: CreditConflictField[];
  repaymentGapSummary?: {
    plannedDueAmount?: string;
    recentActualPaidAmount?: string;
    gapAmount?: string;
    gapReason?: string;
    paymentAccountSummary?: string;
  };
  repaymentLookupSummary?: {
    matchedDebtName?: string;
    plannedRepaymentText?: string;
    paymentAccountText?: string;
    actualRepaymentText?: string;
    recordStatusText?: string;
    lookupHint?: string;
  };
}
