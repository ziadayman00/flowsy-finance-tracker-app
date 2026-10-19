import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BudgetResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'ميزانية البقالة' })
  name!: string;

  @ApiProperty({ example: '4000.00', description: 'Allocated budget amount' })
  amount!: string;

  @ApiProperty({ example: 'EGP', description: 'Currency the budget is denominated in' })
  currency!: string;

  @ApiProperty({ example: '1250.50', description: 'Total spent during the period' })
  spent!: string;

  @ApiProperty({ example: '2749.50', description: 'Remaining spendable amount in budget' })
  remaining!: string;

  @ApiProperty({ example: 31.26, description: 'Percentage of budget consumed' })
  percentage!: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001', nullable: true })
  categoryId!: string | null;

  @ApiPropertyOptional({ example: 'بقالة ومستلزمات', nullable: true })
  categoryName!: string | null;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  startDate!: Date;

  @ApiProperty({ example: '2026-10-31T23:59:59.999Z' })
  endDate!: Date;

  @ApiProperty({ example: false })
  isArchived!: boolean;
}

