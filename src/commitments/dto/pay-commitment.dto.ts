import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PayCommitmentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Account to deduct payment from',
  })
  @IsUUID('4', { message: 'accountId must be a valid UUID' })
  @IsNotEmpty()
  accountId!: string;

  @ApiPropertyOptional({
    example: '2026-10-17T20:00:00.000Z',
    description: 'Payment timestamp (defaults to current time)',
  })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @ApiPropertyOptional({
    example: 'سداد إيجار شهر أكتوبر',
    description: 'Optional note for payment transaction',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
