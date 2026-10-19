export type AccountType = 'CASH' | 'BANK' | 'SAVINGS' | 'MOBILE_WALLET';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type CommitmentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  currency: string;
  timezone: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseDto extends AuthTokens {
  user: UserProfileDto;
}

export interface AccountResponseDto {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: string;
  currentBalance: string;
  isArchived: boolean;
  excludeFromSafeToSpend: boolean;
  createdAt: string;
}

export interface CategoryResponseDto {
  id: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  isSystem: boolean;
  isArchived: boolean;
}

export interface TransactionSummaryItem {
  id: string;
  name: string;
  icon?: string | null;
}

export interface TransactionResponseDto {
  id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  note: string | null;
  transactionDate: string;
  account: TransactionSummaryItem;
  category: TransactionSummaryItem | null;
  destinationAccount: TransactionSummaryItem | null;
  createdAt: string;
}

export interface PaginatedTransactionsDto {
  data: TransactionResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BatchCreateTransactionsResponseDto {
  created: TransactionResponseDto[];
  count: number;
}

export interface CommitmentResponseDto {
  id: string;
  name: string;
  amount: string;
  currency: string;
  dueDate: string;
  status: CommitmentStatus;
  recurrence: RecurrenceFrequency;
  accountId: string | null;
  categoryId: string | null;
  paidTransactionId: string | null;
  createdAt: string;
}

export interface PayCommitmentResponseDto {
  commitment: CommitmentResponseDto;
  transactionId: string;
}

export interface BudgetResponseDto {
  id: string;
  name: string;
  amount: string;
  spent: string;
  remaining: string;
  percentage: number;
  categoryId: string | null;
  categoryName: string | null;
  startDate: string;
  endDate: string;
  isArchived: boolean;
}

export interface SafeToSpendBreakdownDto {
  safeToSpend: string;
  currency: string;
  totalLiquidFunds: string;
  totalPendingCommitments: string;
  pendingCommitmentsCount: number;
  isDeficit: boolean;
  deficitAmount: string;
  calculatedAt: string;
}

export interface MonthlySummaryDto {
  income: string;
  expenses: string;
  netSavings: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

export interface CurrencyBalanceSummaryDto {
  currency: string;
  totalLiquidBalance: string;
  totalProtectedSavings: string;
  accountCount: number;
}

export interface DashboardAccountQuickViewDto {
  id: string;
  name: string;
  type: string;
  currency: string;
  currentBalance: string;
  excludeFromSafeToSpend: boolean;
}

export interface DashboardSummaryDto {
  baseCurrency: string;
  safeToSpend: SafeToSpendBreakdownDto;
  monthlySummary: MonthlySummaryDto;
  totalLiquidBalance: string;
  totalProtectedSavings: string;
  excludedCurrenciesSummary: CurrencyBalanceSummaryDto[];
  accounts: DashboardAccountQuickViewDto[];
}

export interface HealthCheckResponseDto {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  database: {
    status: string;
  };
}

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  correlationId?: string;
  timestamp: string;
}

// ─── Savings Goals ────────────────────────────────────────────────────────────

export interface SavingsGoalResponseDto {
  id: string;
  name: string;
  targetAmount: string;
  currency: string;
  currentAmount: string;
  remainingAmount: string;
  percentage: number;
  account: { id: string; name: string; type: string };
  targetDate: string | null;
  note: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface CreateSavingsGoalDto {
  name: string;
  targetAmount: string;
  currency: string;
  accountId: string;
  targetDate?: string;
  note?: string;
}

export interface UpdateSavingsGoalDto {
  name?: string;
  targetAmount?: string;
  targetDate?: string | null;
  note?: string | null;
}

// ─── Cash-Flow Forecasting ────────────────────────────────────────────────────

export interface ProjectedCommitmentDto {
  id: string;
  name: string;
  amount: string;
  currency: string;
  projectedDueDate: string;
  flowType: 'EXPENSE' | 'INCOME';
}

export interface MonthlyForecastDto {
  month: string;
  startDate: string;
  endDate: string;
  projectedExpenses: string;
  projectedIncome: string;
  netCashFlow: string;
  commitments: ProjectedCommitmentDto[];
}

export interface CashFlowForecastDto {
  dataQuality: 'ESTIMATE';
  currency: string;
  generatedAt: string;
  months: number;
  forecast: MonthlyForecastDto[];
}

// ─── Transaction Import ───────────────────────────────────────────────────────

export interface ImportRowDto {
  date: string;
  amount: string;
  currency: string;
  type: 'INCOME' | 'EXPENSE';
  note?: string;
}

export interface ImportRowResultDto {
  rowIndex: number;
  date: string;
  amount: string;
  currency: string;
  type: string;
  note?: string;
  status: 'NEW' | 'LIKELY_DUPLICATE' | 'SKIPPED';
  reason?: string;
  duplicateCandidateId?: string;
}

export interface ImportPreviewResponseDto {
  sessionId: string;
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  skippedCount: number;
  rows: ImportRowResultDto[];
}

export interface ImportCommitResponseDto {
  imported: number;
  skipped: number;
  transactionIds: string[];
}

