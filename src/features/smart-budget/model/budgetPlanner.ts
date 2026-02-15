export type UserIdentity = 'student' | 'employee' | 'freelancer' | 'other';

export type BudgetAnswers = {
  identity: UserIdentity;
  monthlyIncomeK: number;
  monthlyFixedExpenseK: number;
  savingsRatio: number;
};

export type BudgetCategoryPlan = {
  category: string;
  amount: number;
  ratio: number;
};

export type BudgetRecommendation = {
  monthlyIncome: number;
  monthlyFixedExpense: number;
  disposableIncome: number;
  savingsAmount: number;
  flexibleBudget: number;
  categoryBudgets: BudgetCategoryPlan[];
};

const IDENTITY_LABELS: Record<UserIdentity, string> = {
  student: '学生',
  employee: '上班族',
  freelancer: '自由职业者',
  other: '其他'
};

const FLEXIBLE_CATEGORY_WEIGHT: Record<
  UserIdentity,
  Array<{ category: string; weight: number }>
> = {
  student: [
    { category: '餐饮', weight: 0.3 },
    { category: '学习成长', weight: 0.28 },
    { category: '交通', weight: 0.12 },
    { category: '娱乐社交', weight: 0.18 },
    { category: '医疗健康', weight: 0.12 }
  ],
  employee: [
    { category: '餐饮', weight: 0.26 },
    { category: '交通', weight: 0.16 },
    { category: '通讯网络', weight: 0.12 },
    { category: '家庭生活', weight: 0.24 },
    { category: '娱乐社交', weight: 0.12 },
    { category: '学习成长', weight: 0.1 }
  ],
  freelancer: [
    { category: '餐饮', weight: 0.22 },
    { category: '交通', weight: 0.12 },
    { category: '工作投入', weight: 0.26 },
    { category: '家庭生活', weight: 0.18 },
    { category: '医疗健康', weight: 0.1 },
    { category: '娱乐社交', weight: 0.12 }
  ],
  other: [
    { category: '餐饮', weight: 0.24 },
    { category: '交通', weight: 0.14 },
    { category: '家庭生活', weight: 0.24 },
    { category: '医疗健康', weight: 0.14 },
    { category: '学习成长', weight: 0.12 },
    { category: '娱乐社交', weight: 0.12 }
  ]
};

function toAmountFromK(value: number): number {
  return Math.round(value * 1000);
}

function roundToTen(amount: number): number {
  return Math.round(amount / 10) * 10;
}

function normalizeWeights(
  items: Array<{ category: string; weight: number }>
): Array<{ category: string; weight: number }> {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return items.map((item) => ({ ...item, weight: 1 / items.length }));
  }
  return items.map((item) => ({ ...item, weight: item.weight / totalWeight }));
}

/**
 * 根据四个问答结果生成预算建议。
 * - 问题 2/3 使用“千”为单位输入，函数内部统一转为元。
 * - 预算会拆分为固定支出、储蓄与灵活支出分类，且总额严格等于月收入。
 */
export function generateBudgetRecommendation(answers: BudgetAnswers): BudgetRecommendation {
  if (!Number.isFinite(answers.monthlyIncomeK) || answers.monthlyIncomeK <= 0) {
    throw new Error('每月收入必须大于 0。');
  }
  if (!Number.isFinite(answers.monthlyFixedExpenseK) || answers.monthlyFixedExpenseK < 0) {
    throw new Error('固定支出不能小于 0。');
  }
  if (
    !Number.isFinite(answers.savingsRatio) ||
    answers.savingsRatio < 0.1 ||
    answers.savingsRatio > 0.6
  ) {
    throw new Error('预算比例应在 10%~60% 之间。');
  }

  const monthlyIncome = toAmountFromK(answers.monthlyIncomeK);
  const monthlyFixedExpense = toAmountFromK(answers.monthlyFixedExpenseK);

  if (monthlyFixedExpense >= monthlyIncome) {
    throw new Error('固定支出需要小于月收入，才能生成可执行预算。');
  }

  const disposableIncome = monthlyIncome - monthlyFixedExpense;
  const savingsAmount = roundToTen(disposableIncome * answers.savingsRatio);
  const flexibleBudget = monthlyIncome - monthlyFixedExpense - savingsAmount;

  const dynamicWeights = normalizeWeights(FLEXIBLE_CATEGORY_WEIGHT[answers.identity]);

  const dynamicPlans: BudgetCategoryPlan[] = dynamicWeights.map((item) => ({
    category: item.category,
    amount: roundToTen(flexibleBudget * item.weight),
    ratio: 0
  }));

  const dynamicBudgetUsed = dynamicPlans.reduce((sum, item) => sum + item.amount, 0);
  const dynamicDelta = flexibleBudget - dynamicBudgetUsed;
  if (dynamicPlans.length > 0 && dynamicDelta !== 0) {
    dynamicPlans[0] = {
      ...dynamicPlans[0],
      amount: dynamicPlans[0].amount + dynamicDelta
    };
  }

  const categoryBudgets = [
    {
      category: '固定支出',
      amount: monthlyFixedExpense,
      ratio: 0
    },
    {
      category: '储蓄/投资',
      amount: savingsAmount,
      ratio: 0
    },
    ...dynamicPlans
  ].map((item) => ({
    ...item,
    ratio: monthlyIncome > 0 ? item.amount / monthlyIncome : 0
  }));

  return {
    monthlyIncome,
    monthlyFixedExpense,
    disposableIncome,
    savingsAmount,
    flexibleBudget,
    categoryBudgets
  };
}

export function getIdentityLabel(identity: UserIdentity): string {
  return IDENTITY_LABELS[identity];
}
