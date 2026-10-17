import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommitmentStatus, RecurrenceFrequency } from '@prisma/client';
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
  MinLength,
} from 'class-validator';

export class CreateCommitmentDto {
  @ApiProperty({ example: 'إيجار الشقة', description: 'Commitment name' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 6000.0,
    description: 'Obligation amount (positive number with up to 2 decimal places)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Commitment amount must be strictly greater than 0' })
  amount!: number;

  @ApiPropertyOptional({ example: 'EGP', default: 'EGP' })
  @IsOptional()
  @IsString()
  currency?: string = 'EGP';

  @ApiProperty({
    example: '2026-10-31T00:00:00.000Z',
    description: 'Due date of the commitment',
  })
  @IsISO8601()
  dueDate!: string;

  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.MONTHLY,
    default: RecurrenceFrequency.NONE,
  })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrence?: RecurrenceFrequency = RecurrenceFrequency.NONE;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Default account to pay from',
  })
  @IsOptional()
  @IsUUID('4')
  accountId?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Category for the commitment',
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}
