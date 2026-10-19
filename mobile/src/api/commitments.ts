import { apiClient } from './client';
import {
  CommitmentResponseDto,
  CommitmentStatus,
  PayCommitmentResponseDto,
} from './types';
import {
  CreateCommitmentInput,
  PayCommitmentInput,
  buildCreateCommitmentPayload,
  buildPayCommitmentPayload,
} from '../utils/payloads';

export async function getCommitments(
  params?: CommitmentStatus | { status?: CommitmentStatus },
): Promise<CommitmentResponseDto[]> {
  const status = typeof params === 'object' && params !== null ? params.status : params;
  const query = status ? `?status=${status}` : '';
  return apiClient<CommitmentResponseDto[]>(`/commitments${query}`);
}

export async function getActiveCommitments(): Promise<CommitmentResponseDto[]> {
  // Fetch commitments without filter or fetch both OVERDUE and PENDING
  // The backend auto-promotes overdue pending items to OVERDUE before returning
  const all = await apiClient<CommitmentResponseDto[]>('/commitments');
  return all.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');
}

export async function getCommitmentById(id: string): Promise<CommitmentResponseDto> {
  return apiClient<CommitmentResponseDto>(`/commitments/${id}`);
}

export async function createCommitment(input: CreateCommitmentInput): Promise<CommitmentResponseDto> {
  const payload = buildCreateCommitmentPayload(input);
  return apiClient<CommitmentResponseDto>('/commitments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCommitment(
  id: string,
  input: {
    name?: string;
    amount?: number | string;
    dueDate?: string | Date;
    status?: CommitmentStatus;
    recurrence?: any;
    accountId?: string | null;
    categoryId?: string | null;
  },
): Promise<CommitmentResponseDto> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim().slice(0, 100);
  if (input.amount !== undefined) payload.amount = parseFloat(Number(input.amount).toFixed(2));
  if (input.dueDate !== undefined) {
    const d = typeof input.dueDate === 'string' ? new Date(input.dueDate) : input.dueDate;
    payload.dueDate = d.toISOString();
  }
  if (input.status !== undefined) payload.status = input.status;
  if (input.recurrence !== undefined) payload.recurrence = input.recurrence;
  if (input.accountId !== undefined) payload.accountId = input.accountId;
  if (input.categoryId !== undefined) payload.categoryId = input.categoryId;

  return apiClient<CommitmentResponseDto>(`/commitments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function payCommitment(
  commitmentId: string,
  input: PayCommitmentInput,
): Promise<PayCommitmentResponseDto> {
  const payload = buildPayCommitmentPayload(input);
  return apiClient<PayCommitmentResponseDto>(`/commitments/${commitmentId}/pay`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteCommitment(id: string): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/commitments/${id}`, {
    method: 'DELETE',
  });
}

export const commitmentsApi = {
  getCommitments,
  getCommitment: getCommitmentById,
  getCommitmentById,
  createCommitment,
  updateCommitment,
  payCommitment,
  deleteCommitment,
};
