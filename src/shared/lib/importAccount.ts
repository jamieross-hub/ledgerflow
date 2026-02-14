import { Account } from '../../entities/account/types';

type BillSource = 'wechat' | 'alipay';

const SOURCE_PATTERNS: Record<BillSource, RegExp> = {
  wechat: /微信|wechat|wx/i,
  alipay: /支付宝|alipay|余额宝|蚂蚁/i
};

export function resolveImportDefaultAccountId(
  accounts: Account[],
  source: BillSource,
  fallbackAccountId?: string
): string {
  const directHit = accounts.find((item) => SOURCE_PATTERNS[source].test(item.name));
  if (directHit) {
    return directHit.id;
  }

  if (fallbackAccountId) {
    return fallbackAccountId;
  }

  return accounts[0]?.id || '';
}
