export type FieldStatus =
  | 'resolved'
  | 'ambiguous'
  | 'missing'
  | 'invalid';

export interface ParsedField<T> {
  value: T | null;
  status: FieldStatus;
  alternatives?: T[];
  sourceText?: string;
  reason?: string;
}

export interface ExpenseCandidate {
  id: string; // Client temporary unique ID for editing/tracking
  amount: ParsedField<number>;
  currency: ParsedField<string>;
  categoryId: ParsedField<string>;
  categoryName?: string;
  date: ParsedField<string>; // ISO string (YYYY-MM-DD)
  description: ParsedField<string>;
  accountId?: string;
  unresolvedFields: string[];
  isManuallyEdited?: boolean;
}

export interface ExpenseParseResult {
  originalTranscript: string;
  normalizedTranscript: string;
  candidates: ExpenseCandidate[];
  warnings: string[];
  isNegationOrNonExpense?: boolean;
}

export interface CategoryAliasItem {
  id: string;
  name: string;
  icon?: string | null;
  aliases?: string[];
}

export interface ParserOptions {
  referenceDate?: Date; // Reference time for relative date calculation
  timezone?: string; // Timezone, default 'Africa/Cairo'
  defaultCurrency?: string; // Default 'EGP'
  supportedCurrencies?: string[];
  categories?: CategoryAliasItem[];
  defaultAccountId?: string;
}
