import type { AccountType } from '../../features/accounts/model/accountTypes';

export interface Account {
  id: string;
  name: string;
  /** 账户类型（可选，兼容旧数据） */
  type?: AccountType;
  /** 初始余额（默认 0） */
  initialBalance?: number;
  /** 当前余额（由交易自动计算或手动设定） */
  balance?: number;
  /** 展示排序，数值越小越靠前 */
  sortOrder?: number;
}
