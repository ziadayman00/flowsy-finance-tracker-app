import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class TransactionAccountSummaryDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'محفظة الكاش' })
  name!: string;
}

export class TransactionCategorySummaryDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  id!: string;

  @ApiProperty({ example: 'بقالة ومستلزمات' })
  name!: string;

  @ApiPropertyOptional({ example: 'cart-outline', nullable: true })
  icon!: string | null;
}

export class TransactionResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  type!: TransactionType;

  @ApiProperty({ example: '250.75', description: 'Monetary amount as exact decimal string' })
  amount!: string;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiPropertyOptional({ example: 'سوبرماركت', nullable: true })
  note!: string | null;

  @ApiProperty({ example: '2026-10-17T18:30:00.000Z' })
  transactionDate!: Date;

  @ApiProperty({ type: TransactionAccountSummaryDto })
  account!: TransactionAccountSummaryDto;

  @ApiPropertyOptional({ type: TransactionCategorySummaryDto, nullable: true })
  category!: TransactionCategorySummaryDto | null;

  @ApiPropertyOptional({ type: TransactionAccountSummaryDto, nullable: true })
  destinationAccount!: TransactionAccountSummaryDto | null;

  @ApiProperty({ example: '2026-10-17T18:30:00.000Z' })
  createdAt!: Date;
}

export class PaginatedTransactionsDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  data!: TransactionResponseDto[];

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
