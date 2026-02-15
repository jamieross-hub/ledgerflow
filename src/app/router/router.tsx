import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../../widgets/layout/AppLayout';
import { DashboardPage } from '../../pages/dashboard/DashboardPage';
import { TransactionsPage } from '../../pages/transactions/TransactionsPage';
import { TransactionEditPage } from '../../pages/transaction-edit/TransactionEditPage';
import { CategoriesAccountsPage } from '../../pages/categories-accounts/CategoriesAccountsPage';
import { SettingsPage } from '../../pages/settings/SettingsPage';
import { AboutPage } from '../../pages/about/AboutPage';
import { AssistantPage } from '../../pages/assistant/AssistantPage';
import { DatabaseSettingsPage } from '../../pages/database-settings/DatabaseSettingsPage';
import { ExchangePage } from '../../features/exchange/ui/ExchangePage';
import { FinancePage } from '../../pages/finance/FinancePage';
import { SmartBudgetPage } from '../../pages/smart-budget/SmartBudgetPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'transactions/new', element: <TransactionEditPage /> },
      { path: 'transactions/:id', element: <TransactionEditPage /> },
      { path: 'categories-accounts', element: <CategoriesAccountsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'assistant', element: <AssistantPage /> },
      { path: 'database-settings', element: <DatabaseSettingsPage /> },
      { path: 'exchange', element: <ExchangePage /> },
      { path: 'finance', element: <FinancePage /> },
      { path: 'smart-budget', element: <SmartBudgetPage /> },
      { path: 'tags', element: <Navigate to="/categories-accounts" replace /> }
    ]
  }
]);
