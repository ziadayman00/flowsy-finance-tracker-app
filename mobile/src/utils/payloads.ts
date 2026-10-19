import { TransactionType, RecurrenceFrequency, AccountType, CategoryType } from '../api/types';
import { toCents, fromCents } from './money';

/**
 * Strict DTO Payload Builders
 * The backend runs ValidationPipe({ forbidNonWhitelisted: true }).
 * These builders strip any undefined, extra, or unpermitted fields before network dispatch.
 */

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number | string;
  accountId: string;
  categoryId?: string | null;
  destinationAccountId?: string | null;
  transactionDate?: string | Date;
  note?: string | null;
}

export function buildCreateTransactionPayload(input: CreateTransactionInput) {
  const numericAmount = parseFloat(fromCents(toCents(input.amount)));

  const payload: Record<string, unknown> = {
    type: input.type,
    amount: numericAmount,
    accountId: input.accountId,
  };

  if (input.type === 'TRANSFER') {
    if (input.destinationAccountId) {
      payload.destinationAccountId = input.destinationAccountId;
    }
  } else if (input.categoryId) {
    payload.categoryId = input.categoryId;
  }

  if (input.transactionDate) {
    const d = typeof input.transactionDate === 'string' ? new Date(input.transactionDate) : input.transactionDate;
    payload.transactionDate = d.toISOString();
  }

  if (input.note && input.note.trim()) {
    payload.note = input.note.trim().slice(0, 200);
  }

  return payload;
}

export interface UpdateTransactionInput {
  amount?: number | string;
  categoryId?: string | null;
  transactionDate?: string | Date;
  note?: string | null;
}

export function buildUpdateTransactionPayload(input: UpdateTransactionInput) {
  const payload: Record<string, unknown> = {};

  if (input.amount !== undefined) {
    payload.amount = parseFloat(fromCents(toCents(input.amount)));
  }

  if (input.categoryId !== undefined) {
    payload.categoryId = input.categoryId || null;
  }

  if (input.transactionDate !== undefined) {
    const d = typeof input.transactionDate === 'string' ? new Date(input.transactionDate) : input.transactionDate;
    payload.transactionDate = d.toISOString();
  }

  if (input.note !== undefined) {
    payload.note = input.note ? input.note.trim().slice(0, 200) : null;
  }

  return payload;
}

export interface CreateCommitmentInput {
  name: string;
  amount: number | string;
  dueDate: string | Date;
  currency?: string;
  recurrence?: RecurrenceFrequency;
  accountId?: string | null;
  categoryId?: string | null;
}

export function buildCreateCommitmentPayload(input: CreateCommitmentInput) {
  const numericAmount = parseFloat(fromCents(toCents(input.amount)));
  const d = typeof input.dueDate === 'string' ? new Date(input.dueDate) : input.dueDate;

  const payload: Record<string, unknown> = {
    name: input.name.trim().slice(0, 100),
    amount: numericAmount,
    dueDate: d.toISOString(),
    recurrence: input.recurrence || 'NONE',
  };

  if (input.currency) {
    payload.currency = input.currency;
  }
  if (input.accountId) {
    payload.accountId = input.accountId;
  }
  if (input.categoryId) {
    payload.categoryId = input.categoryId;
  }

  return payload;
}

export interface PayCommitmentInput {
  accountId: string;
  paidAt?: string | Date;
  note?: string | null;
}

export function buildPayCommitmentPayload(input: PayCommitmentInput) {
  const payload: Record<string, unknown> = {
    accountId: input.accountId,
  };

  if (input.paidAt) {
    const d = typeof input.paidAt === 'string' ? new Date(input.paidAt) : input.paidAt;
    payload.paidAt = d.toISOString();
  }

  if (input.note && input.note.trim()) {
    payload.note = input.note.trim().slice(0, 200);
  }

  return payload;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency?: string;
  initialBalance?: number | string;
  excludeFromSafeToSpend?: boolean;
}

export function buildCreateAccountPayload(input: CreateAccountInput) {
  const payload: Record<string, unknown> = {
    name: input.name.trim().slice(0, 50),
    type: input.type,
  };

  if (input.currency) {
    payload.currency = input.currency;
  }

  if (input.initialBalance !== undefined) {
    payload.initialBalance = parseFloat(fromCents(toCents(input.initialBalance)));
  }

  if (input.excludeFromSafeToSpend !== undefined) {
    payload.excludeFromSafeToSpend = input.excludeFromSafeToSpend;
  }

  return payload;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  excludeFromSafeToSpend?: boolean;
  isArchived?: boolean;
}

export function buildUpdateAccountPayload(input: UpdateAccountInput) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    payload.name = input.name.trim().slice(0, 50);
  }
  if (input.type !== undefined) {
    payload.type = input.type;
  }
  if (input.excludeFromSafeToSpend !== undefined) {
    payload.excludeFromSafeToSpend = input.excludeFromSafeToSpend;
  }
  if (input.isArchived !== undefined) {
    payload.isArchived = input.isArchived;
  }

  return payload;
}

export interface CreateBudgetInput {
  name: string;
  amount: number | string;
  categoryId?: string | null;
  startDate: string | Date;
  endDate: string | Date;
}

export function buildCreateBudgetPayload(input: CreateBudgetInput) {
  const numericAmount = parseFloat(fromCents(toCents(input.amount)));
  const s = typeof input.startDate === 'string' ? new Date(input.startDate) : input.startDate;
  const e = typeof input.endDate === 'string' ? new Date(input.endDate) : input.endDate;

  const payload: Record<string, unknown> = {
    name: input.name.trim().slice(0, 100),
    amount: numericAmount,
    startDate: s.toISOString(),
    endDate: e.toISOString(),
  };

  if (input.categoryId) {
    payload.categoryId = input.categoryId;
  }

  return payload;
}

export interface UpdateCommitmentInput {
  name?: string;
  amount?: number | string;
  dueDate?: string | Date;
  recurrence?: RecurrenceFrequency;
  accountId?: string | null;
  categoryId?: string | null;
  status?: string;
}

export function buildUpdateCommitmentPayload(input: UpdateCommitmentInput) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    payload.name = input.name.trim().slice(0, 100);
  }
  if (input.amount !== undefined) {
    payload.amount = parseFloat(fromCents(toCents(input.amount)));
  }
  if (input.dueDate !== undefined) {
    const d = typeof input.dueDate === 'string' ? new Date(input.dueDate) : input.dueDate;
    payload.dueDate = d.toISOString();
  }
  if (input.recurrence !== undefined) {
    payload.recurrence = input.recurrence;
  }
  if (input.accountId !== undefined) {
    payload.accountId = input.accountId;
  }
  if (input.categoryId !== undefined) {
    payload.categoryId = input.categoryId;
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }

  return payload;
}

export interface UpdateBudgetInput {
  name?: string;
  amount?: number | string;
  categoryId?: string | null;
  startDate?: string | Date;
  endDate?: string | Date;
  isArchived?: boolean;
}

export function buildUpdateBudgetPayload(input: UpdateBudgetInput) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    payload.name = input.name.trim().slice(0, 100);
  }
  if (input.amount !== undefined) {
    payload.amount = parseFloat(fromCents(toCents(input.amount)));
  }
  if (input.categoryId !== undefined) {
    payload.categoryId = input.categoryId;
  }
  if (input.startDate !== undefined) {
    const s = typeof input.startDate === 'string' ? new Date(input.startDate) : input.startDate;
    payload.startDate = s.toISOString();
  }
  if (input.endDate !== undefined) {
    const e = typeof input.endDate === 'string' ? new Date(input.endDate) : input.endDate;
    payload.endDate = e.toISOString();
  }
  if (input.isArchived !== undefined) {
    payload.isArchived = input.isArchived;
  }

  return payload;
}
