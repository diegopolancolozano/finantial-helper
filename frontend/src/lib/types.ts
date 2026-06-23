export type MovementType = 'income' | 'expense';

export interface User {
  id: string;
  email: string;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Movement {
  id: string;
  type: MovementType;
  amount: number;
  description: string;
  date: string;
  categoryId: string;
  category: { id: string; name: string };
  createdAt: string;
}

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  percentage: number;
  level: 'warning' | 'exceeded';
}

export interface BudgetStatus {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  incomeAmount: number;
  hasOnlyIncome: boolean;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface MovementSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface MovementFilters {
  type?: MovementType;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount';
  order?: 'asc' | 'desc';
}
