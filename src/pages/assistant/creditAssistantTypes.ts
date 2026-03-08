export interface CreditConflictField {
  label: string;
  currentValue: string;
  nextValue: string;
}

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
  statusText?: string;
  shortfallAction?: string;
  explanationItems?: string[];
}

export type CreditFieldSource = 'explicit' | 'rule' | 'ai-inferred' | 'user-supplemented' | 'pending';
export type CreditFieldStatus = 'confirmed' | 'needs-confirmation' | 'low-confidence';

export interface CreditFieldMeta {
  value?: string;
  source: CreditFieldSource;
  status: CreditFieldStatus;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string;
  updatedAt?: string;
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
  draftCreditId?: string;
  matchReason?: string;
  lastConfirmedFields?: string[];
  lastMissingFields?: string[];
  mergedFromTurns?: number[];
  recommendedNextFields?: string[];
  bindingProgressText?: string;
  completionRatio?: number;
  completionLabel?: string;
  mergedFromHistory?: boolean;
  matchedDebtId?: string;
  matchedDebtName?: string;
  conflictFields?: CreditConflictField[];
  repaymentGapSummary?: CreditRepaymentGapSummary;
  repaymentLookupSummary?: CreditRepaymentLookupSummary;
  fieldMeta?: Partial<
    Record<
      'title' | 'dueAmount' | 'totalDebt' | 'repaymentDate' | 'remainingPeriods' | 'monthlyAmount' | 'interest',
      CreditFieldMeta
    >
  >;
}
