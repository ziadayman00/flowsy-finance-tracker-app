import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SavingsGoalResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'شقة الأحلام' })
  name!: string;

  @ApiProperty({
    example: '200000.00',
    description: 'Target savings amount',
  })
  targetAmount!: string;

  @ApiProperty({
    example: 'EGP',
    description: 'Currency derived from the linked account',
  })
  currency!: string;

  @ApiProperty({
    example: '45000.00',
    description: 'Current balance of the linked account (actual progress)',
  })
  currentAmount!: string;

  @ApiProperty({
    example: '155000.00',
    description: 'Remaining amount to reach the target',
  })
  remainingAmount!: string;

  @ApiProperty({
    example: 22.5,
    description: 'Percentage of target reached (0–100+)',
  })
  percentage!: number;

  @ApiProperty({
    example: { id: '...', name: 'صندوق الطوارئ' },
    description: 'Linked account summary',
  })
  account!: { id: string; name: string; type: string };

  @ApiPropertyOptional({
    example: '2027-12-31T00:00:00.000Z',
    nullable: true,
  })
  targetDate!: Date | null;

  @ApiPropertyOptional({ example: 'توفير مقدمة شقة', nullable: true })
  note!: string | null;

  @ApiProperty({ example: false })
  isArchived!: boolean;

  @ApiProperty({ example: '2026-10-19T12:00:00.000Z' })
  createdAt!: Date;
}
