import { apiClient } from './client';
import { AccountResponseDto } from './types';
import {
  CreateAccountInput,
  UpdateAccountInput,
  buildCreateAccountPayload,
  buildUpdateAccountPayload,
} from '../utils/payloads';

export async function getAccounts(includeArchived: boolean = false): Promise<AccountResponseDto[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  return apiClient<AccountResponseDto[]>(`/accounts${query}`);
}

export async function getAccountById(id: string): Promise<AccountResponseDto> {
  return apiClient<AccountResponseDto>(`/accounts/${id}`);
}

export async function createAccount(input: CreateAccountInput): Promise<AccountResponseDto> {
  const payload = buildCreateAccountPayload(input);
  return apiClient<AccountResponseDto>('/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAccount(id: string, input: UpdateAccountInput): Promise<AccountResponseDto> {
  const payload = buildUpdateAccountPayload(input);
  return apiClient<AccountResponseDto>(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAccount(id: string): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/accounts/${id}`, {
    method: 'DELETE',
  });
}

export const accountsApi = {
  getAccounts,
  getAccount: getAccountById,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
};
