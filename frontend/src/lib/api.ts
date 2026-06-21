import type {
  Category,
  Movement,
  MovementFilters,
  MovementSummary,
  BudgetStatus,
  PaginatedResponse,
} from './types';

const BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const auth = {
  register: (email: string, password: string) =>
    request<{ accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

export const categories = {
  list: () => request<Category[]>('/categories'),
  create: (name: string) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: string, name: string) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  remove: (id: string) => request<void>(`/categories/${id}`, { method: 'DELETE' }),
};

export const movements = {
  list: (filters: MovementFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    return request<PaginatedResponse<Movement>>(`/movements?${params}`);
  },
  create: (data: Omit<Movement, 'id' | 'category' | 'createdAt'>) =>
    request<{ movement: Movement; budgetAlert: unknown }>('/movements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Omit<Movement, 'id' | 'category' | 'createdAt'>>) =>
    request<Movement>(`/movements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) => request<void>(`/movements/${id}`, { method: 'DELETE' }),
  summary: () => request<MovementSummary>('/movements/summary'),
};

export const budgets = {
  status: (month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    return request<BudgetStatus[]>(`/budgets?${params}`);
  },
  set: (categoryId: string, amount: number, month: number, year: number) =>
    request(`/budgets/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ amount, month, year }),
    }),
};
