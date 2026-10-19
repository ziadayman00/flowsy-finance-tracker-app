import { apiClient } from './client';
import {
  PaginatedTransactionsDto,
  TransactionResponseDto,
  TransactionType,
} from './types';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  buildCreateTransactionPayload,
  buildUpdateTransactionPayload,
} from '../utils/payloads';

export interface QueryTransactionsParams {
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function getTransactions(
  params: QueryTransactionsParams = {},
): Promise<PaginatedTransactionsDto> {
  const queryParts: string[] = [];
  if (params.page) queryParts.push(`page=${params.page}`);
  if (params.limit) queryParts.push(`limit=${params.limit}`);
  if (params.type) queryParts.push(`type=${params.type}`);
  if (params.accountId) queryParts.push(`accountId=${params.accountId}`);
  if (params.categoryId) queryParts.push(`categoryId=${params.categoryId}`);
  if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
  if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return apiClient<PaginatedTransactionsDto>(`/transactions${queryString}`);
}

export async function getTransactionById(id: string): Promise<TransactionResponseDto> {
  return apiClient<TransactionResponseDto>(`/transactions/${id}`);
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<TransactionResponseDto> {
  const payload = buildCreateTransactionPayload(input);
  return apiClient<TransactionResponseDto>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createBatchTransactions(
  inputs: CreateTransactionInput[],
): Promise<{ created: TransactionResponseDto[]; count: number }> {
  const transactions = inputs.map((input) => buildCreateTransactionPayload(input));
  return apiClient<{ created: TransactionResponseDto[]; count: number }>('/transactions/batch', {
    method: 'POST',
    body: JSON.stringify({ transactions }),
  });
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionResponseDto> {
  const payload = buildUpdateTransactionPayload(input);
  return apiClient<TransactionResponseDto>(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteTransaction(
  id: string,
): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/transactions/${id}`, {
    method: 'DELETE',
  });
}

export const transactionsApi = {
  getTransactions,
  getTransaction: getTransactionById,
  getTransactionById,
  createTransaction,
  createBatch: createBatchTransactions,
  createBatchTransactions,
  updateTransaction,
  deleteTransaction,
};
