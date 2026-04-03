export type SubscriptionKind = 'digital' | 'mobile' | 'membership' | 'other';
export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'custom';
export type SubscriptionStatus = 'active' | 'due-soon' | 'expired' | 'paused';

export interface SubscriptionItem {
  id: string;
  name: string;
  kind: SubscriptionKind;
  amount: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  customCycleDays?: number;
  accountId?: string;
  provider?: string;
  note?: string;
  renewalDate?: string;
  expireDate?: string;
  autoRenew?: boolean;
  status: SubscriptionStatus;
  lastGeneratedAt?: string;
  lastGeneratedTransactionId?: string;
  trashedAt?: string;
  createdAt: string;
  updatedAt: string;
}
