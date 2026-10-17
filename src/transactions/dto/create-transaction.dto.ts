import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    enum: TransactionType,
    example: TransactionType.EXPENSE,
    description: 'Transaction type: INCOME, EXPENSE, or TRANSFER',
  })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({
    example: 250.75,
    description: 'Positive monetary amount (up to 2 decimal places)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Transaction amount must be strictly greater than 0' })
  amount!: number;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Primary financial account ID (source for EXPENSE or TRANSFER, target for INCOME)',
  })
  @IsUUID('4', { message: 'accountId must be a valid UUID' })
  @IsNotEmpty()
  accountId!: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Category ID (applicable for INCOME or EXPENSE)',
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174002',
    description: 'Destination account ID (REQUIRED if type is TRANSFER)',
  })
  @ValidateIf((o: CreateTransactionDto) => o.type === TransactionType.TRANSFER)
  @IsNotEmpty({ message: 'destinationAccountId is required for transfers' })
  @IsUUID('4')
  destinationAccountId?: string;

  @ApiPropertyOptional({
    example: '2026-10-17T18:30:00.000Z',
    description: 'Transaction date (ISO 8601 timestamp)',
  })
  @IsOptional()
  @IsISO8601()
  transactionDate?: string;

  @ApiPropertyOptional({ example: 'مشتريات سوبرماركت', description: 'User note or description' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
