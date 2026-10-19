import { ApiProperty } from '@nestjs/swagger';

export class SafeToSpendBreakdownDto {
  @ApiProperty({
    example: '14350.00',
    description: 'Estimated safe-to-spend amount ("تقدر تصرف كام؟")',
  })
  safeToSpend!: string;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiProperty({
    example: '20800.00',
    description: 'Total liquid funds across active spending accounts',
  })
  totalLiquidFunds!: string;

  @ApiProperty({
    example: '6450.00',
    description: 'Total outstanding commitments due in the evaluation period',
  })
  totalPendingCommitments!: string;

  @ApiProperty({ example: 2, description: 'Number of pending/overdue commitments' })
  pendingCommitmentsCount!: number;

  @ApiProperty({
    example: false,
    description: 'True if upcoming commitments exceed available liquid funds',
  })
  isDeficit!: boolean;

  @ApiProperty({
    example: '0.00',
    description: 'Deficit amount if obligations exceed funds',
  })
  deficitAmount!: string;

  @ApiProperty({
    example: '2026-10-17T20:00:00.000Z',
    description: 'Timestamp when this estimate was derived',
  })
  calculatedAt!: Date;
}

export class MonthlySummaryDto {
  @ApiProperty({ example: '25000.00', description: 'Total monthly income' })
  income!: string;

  @ApiProperty({ example: '8500.00', description: 'Total monthly expenses' })
  expenses!: string;

  @ApiProperty({ example: '16500.00', description: 'Net savings for current month' })
  netSavings!: string;

  @ApiProperty({ example: 'EGP', description: 'Reporting currency' })
  currency!: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  periodStart!: Date;

  @ApiProperty({ example: '2026-10-31T23:59:59.999Z' })
  periodEnd!: Date;
}

export class AccountQuickViewDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'محفظة الكاش' })
  name!: string;

  @ApiProperty({ example: 'CASH' })
  type!: string;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiProperty({ example: '2500.00' })
  currentBalance!: string;

  @ApiProperty({ example: false })
  excludeFromSafeToSpend!: boolean;
}

export class CurrencyBalanceSummaryDto {
  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({
    example: '500.00',
    description: 'Total liquid balance in this non-base currency',
  })
  totalLiquidBalance!: string;

  @ApiProperty({
    example: '0.00',
    description: 'Total protected savings in this non-base currency',
  })
  totalProtectedSavings!: string;

  @ApiProperty({ example: 1, description: 'Number of accounts denominated in this currency' })
  accountCount!: number;
}

export class DashboardSummaryDto {
  @ApiProperty({
    example: 'EGP',
    description: 'User configured base reporting currency',
  })
  baseCurrency!: string;

  @ApiProperty({ type: SafeToSpendBreakdownDto })
  safeToSpend!: SafeToSpendBreakdownDto;

  @ApiProperty({ type: MonthlySummaryDto })
  monthlySummary!: MonthlySummaryDto;

  @ApiProperty({
    example: '20800.00',
    description: 'Total liquid balance in base currency available for spending',
  })
  totalLiquidBalance!: string;

  @ApiProperty({
    example: '5000.00',
    description: 'Total balance in protected/savings accounts in base currency excluded from safe-to-spend',
  })
  totalProtectedSavings!: string;

  @ApiProperty({
    type: [CurrencyBalanceSummaryDto],
    description: 'Balances in non-base currencies excluded from main calculation',
  })
  excludedCurrenciesSummary!: CurrencyBalanceSummaryDto[];

  @ApiProperty({ type: [AccountQuickViewDto] })
  accounts!: AccountQuickViewDto[];
}
