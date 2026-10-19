import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A single upcoming commitment occurrence projected into a future month. */
export class ProjectedCommitmentDto {
  @ApiProperty({ example: 'cmt-uuid-123' })
  id!: string;

  @ApiProperty({ example: 'إيجار الشقة' })
  name!: string;

  @ApiProperty({ example: '5000.00' })
  amount!: string;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiProperty({
    example: '2026-12-01T00:00:00.000Z',
    description: 'Projected due date for this occurrence',
  })
  projectedDueDate!: Date;

  @ApiProperty({
    example: 'EXPENSE',
    description: 'EXPENSE (outflow) or INCOME (inflow)',
  })
  flowType!: 'EXPENSE' | 'INCOME';
}

/** Cash-flow summary for one calendar month. */
export class MonthlyForecastDto {
  @ApiProperty({
    example: '2026-12',
    description: 'ISO year-month label (YYYY-MM)',
  })
  month!: string;

  @ApiProperty({
    example: '2026-12-01T00:00:00.000Z',
    description: 'First day of this month (UTC midnight)',
  })
  startDate!: Date;

  @ApiProperty({
    example: '2026-12-31T23:59:59.999Z',
    description: 'Last instant of this month (UTC)',
  })
  endDate!: Date;

  @ApiProperty({
    example: '28500.00',
    description:
      'Sum of all projected outflow commitments for this month (same currency as the user default or filtered currency)',
  })
  projectedExpenses!: string;

  @ApiProperty({
    example: '15000.00',
    description: 'Sum of all projected inflow commitments for this month',
  })
  projectedIncome!: string;

  @ApiProperty({
    example: '-13500.00',
    description:
      'Net projected cash flow = projectedIncome - projectedExpenses. Negative means net outflow.',
  })
  netCashFlow!: string;

  @ApiProperty({ type: [ProjectedCommitmentDto] })
  commitments!: ProjectedCommitmentDto[];
}

/** Top-level forecasting response. */
export class CashFlowForecastDto {
  @ApiProperty({
    example: 'ESTIMATE',
    enum: ['ESTIMATE'],
    description:
      'All values are deterministic projections from recorded recurring commitments. ' +
      'They are NOT actuals and NOT AI-generated. Actual spending may differ.',
  })
  dataQuality!: 'ESTIMATE';

  @ApiProperty({
    example: 'EGP',
    description:
      'Currency in which all amounts in this response are expressed. ' +
      'Only commitments in this currency are included. Cross-currency totals are never mixed.',
  })
  currency!: string;

  @ApiProperty({
    example: '2026-10-19T12:00:00.000Z',
    description: 'Server time at which this forecast was computed.',
  })
  generatedAt!: Date;

  @ApiProperty({
    example: 3,
    description: 'Number of months projected (1–12)',
  })
  months!: number;

  @ApiProperty({ type: [MonthlyForecastDto] })
  forecast!: MonthlyForecastDto[];
}
