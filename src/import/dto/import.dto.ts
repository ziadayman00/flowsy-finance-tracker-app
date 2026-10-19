import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const SUPPORTED_CURRENCIES = [
  'EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'USD', 'EUR',
] as const;

/** One row of a parsed CSV import before persistence. */
export class ImportRowDto {
  @ApiProperty({
    example: '2026-10-01',
    description: 'Transaction date (YYYY-MM-DD or ISO 8601)',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example: 250.5,
    description: 'Absolute amount (always positive; direction controlled by type)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    example: 'EGP',
    enum: SUPPORTED_CURRENCIES,
    description: 'Transaction currency',
  })
  @IsIn(SUPPORTED_CURRENCIES)
  currency!: string;

  @ApiProperty({
    example: 'EXPENSE',
    enum: ['INCOME', 'EXPENSE', 'TRANSFER'],
  })
  @IsIn(['INCOME', 'EXPENSE', 'TRANSFER'])
  type!: 'INCOME' | 'EXPENSE' | 'TRANSFER';

  @ApiPropertyOptional({ example: 'سوبر ماركت كارفور' })
  @IsOptional()
  @IsString()
  note?: string;
}

/** Request body for POST /import/preview */
export class ImportPreviewDto {
  @ApiProperty({
    example: 'acc-uuid-123',
    description: 'Target financial account for imported transactions',
  })
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ type: [ImportRowDto] })
  rows!: ImportRowDto[];
}

/** Classification of a single import row after duplicate detection. */
export class ImportRowResultDto {
  @ApiProperty({ example: 0 })
  rowIndex!: number;

  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ example: '250.50' })
  amount!: string;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiProperty({ example: 'EXPENSE' })
  type!: string;

  @ApiPropertyOptional({ example: 'سوبر ماركت كارفور' })
  note?: string;

  @ApiProperty({
    example: 'NEW',
    enum: ['NEW', 'LIKELY_DUPLICATE', 'SKIPPED'],
    description:
      'NEW = will be imported. ' +
      'LIKELY_DUPLICATE = a transaction with the same amount, type, and date (±1 day) exists. ' +
      'SKIPPED = row has a validation error.',
  })
  status!: 'NEW' | 'LIKELY_DUPLICATE' | 'SKIPPED';

  @ApiPropertyOptional({
    example: 'Possible duplicate of transaction txn-uuid-456 (same amount, date ±1d)',
  })
  reason?: string;

  @ApiPropertyOptional({ example: 'txn-uuid-456' })
  duplicateCandidateId?: string;
}

/** Response from POST /import/preview */
export class ImportPreviewResponseDto {
  @ApiProperty({ example: 'prev-session-uuid' })
  sessionId!: string;

  @ApiProperty({ example: 10 })
  totalRows!: number;

  @ApiProperty({ example: 8 })
  newCount!: number;

  @ApiProperty({ example: 2 })
  duplicateCount!: number;

  @ApiProperty({ example: 0 })
  skippedCount!: number;

  @ApiProperty({ type: [ImportRowResultDto] })
  rows!: ImportRowResultDto[];
}

/** Request body for POST /import/commit */
export class ImportCommitDto {
  @ApiProperty({
    example: 'prev-session-uuid',
    description:
      'Session ID returned by /import/preview. Identifies the validated batch.',
  })
  @IsUUID()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({
    example: [0, 1, 3],
    description:
      'Zero-based indices of rows to persist. ' +
      'Only rows with status NEW or LIKELY_DUPLICATE can be committed. ' +
      'Omit indices to commit all NEW rows automatically.',
    type: [Number],
  })
  @IsOptional()
  rowIndices?: number[];
}

/** Response from POST /import/commit */
export class ImportCommitResponseDto {
  @ApiProperty({ example: 8 })
  imported!: number;

  @ApiProperty({ example: 2 })
  skipped!: number;

  @ApiProperty({ type: [String], example: ['txn-uuid-1', 'txn-uuid-2'] })
  transactionIds!: string[];
}
