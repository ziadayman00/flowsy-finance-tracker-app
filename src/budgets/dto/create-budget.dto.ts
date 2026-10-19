import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  IsSupportedCurrency,
  SUPPORTED_CURRENCIES,
} from '../../common/validators/is-supported-currency.validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 'ميزانية البقالة لشهر أكتوبر', description: 'Budget name' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 4000.0,
    description: 'Budget limit amount',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Budget amount must be strictly greater than 0' })
  amount!: number;

  @ApiPropertyOptional({
    example: 'EGP',
    default: 'EGP',
    enum: SUPPORTED_CURRENCIES,
    description: `Currency the budget is denominated in. Must match the transaction currency to be tracked correctly. Supported values: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  @IsOptional()
  @IsSupportedCurrency()
  currency?: string = 'EGP';

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Category to track (optional; if omitted, tracks overall spending)',
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiProperty({
    example: '2026-10-01T00:00:00.000Z',
    description: 'Start of the budget period',
  })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({
    example: '2026-10-31T23:59:59.999Z',
    description: 'End of the budget period',
  })
  @IsISO8601()
  endDate!: string;
}

