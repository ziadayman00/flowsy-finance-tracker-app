import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommitmentStatus, RecurrenceFrequency } from '@prisma/client';

export class CommitmentResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'إيجار الشقة' })
  name!: string;

  @ApiProperty({ example: '6000.00', description: 'Monetary amount as exact decimal string' })
  amount!: string;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiProperty({ example: '2026-10-31T00:00:00.000Z' })
  dueDate!: Date;

  @ApiProperty({ enum: CommitmentStatus, example: CommitmentStatus.PENDING })
  status!: CommitmentStatus;

  @ApiProperty({ enum: RecurrenceFrequency, example: RecurrenceFrequency.MONTHLY })
  recurrence!: RecurrenceFrequency;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001', nullable: true })
  accountId!: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174002', nullable: true })
  categoryId!: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174003', nullable: true })
  paidTransactionId!: string | null;

  @ApiProperty({ example: '2026-10-17T20:00:00.000Z' })
  createdAt!: Date;
}
