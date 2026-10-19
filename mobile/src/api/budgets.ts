import { apiClient } from './client';
import { BudgetResponseDto } from './types';
import { CreateBudgetInput, buildCreateBudgetPayload } from '../utils/payloads';

export async function getBudgets(includeArchived: boolean = false): Promise<BudgetResponseDto[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  return apiClient<BudgetResponseDto[]>(`/budgets${query}`);
}

export async function getBudgetById(id: string): Promise<BudgetResponseDto> {
  return apiClient<BudgetResponseDto>(`/budgets/${id}`);
}

export async function createBudget(input: CreateBudgetInput): Promise<BudgetResponseDto> {
  const payload = buildCreateBudgetPayload(input);
  return apiClient<BudgetResponseDto>('/budgets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateBudget(
  id: string,
  input: {
    name?: string;
    amount?: number | string;
    categoryId?: string | null;
    startDate?: string | Date;
    endDate?: string | Date;
    isArchived?: boolean;
  },
): Promise<BudgetResponseDto> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim().slice(0, 100);
  if (input.amount !== undefined) payload.amount = parseFloat(Number(input.amount).toFixed(2));
  if (input.categoryId !== undefined) payload.categoryId = input.categoryId;
  if (input.startDate !== undefined) {
    const s = typeof input.startDate === 'string' ? new Date(input.startDate) : input.startDate;
    payload.startDate = s.toISOString();
  }
  if (input.endDate !== undefined) {
    const e = typeof input.endDate === 'string' ? new Date(input.endDate) : input.endDate;
    payload.endDate = e.toISOString();
  }
  if (input.isArchived !== undefined) payload.isArchived = input.isArchived;

  return apiClient<BudgetResponseDto>(`/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteBudget(id: string): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/budgets/${id}`, {
    method: 'DELETE',
  });
}

export const budgetsApi = {
  getBudgets,
  getBudget: getBudgetById,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
};
