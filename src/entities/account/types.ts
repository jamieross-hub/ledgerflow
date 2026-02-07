import type { AccountType } from '../../features/accounts/model/accountTypes';

export interface Account {
  id: string;
  name: string;
  /** 账户类型（可选，兼容旧数据） */
  type?: AccountType;
}
