import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BudgetAnswers,
  BudgetRecommendation
} from '../../features/smart-budget/model/budgetPlanner';

export type ConfirmedSmartBudgetPlan = {
  answers: BudgetAnswers;
  recommendation: BudgetRecommendation;
  confirmedAt: string;
};

interface SmartBudgetState {
  confirmedPlan: ConfirmedSmartBudgetPlan | null;
  confirmPlan: (payload: { answers: BudgetAnswers; recommendation: BudgetRecommendation }) => void;
  clearPlan: () => void;
}

/**
 * 智能预算确认结果存储。
 * 仅保存用户最终确认的建议，避免中间步骤污染全局状态。
 */
export const useSmartBudgetStore = create<SmartBudgetState>()(
  persist(
    (set) => ({
      confirmedPlan: null,
      confirmPlan: ({ answers, recommendation }) => {
        set({
          confirmedPlan: {
            answers,
            recommendation,
            confirmedAt: new Date().toISOString()
          }
        });
      },
      clearPlan: () => set({ confirmedPlan: null })
    }),
    { name: 'ledgerflow-smart-budget' }
  )
);
