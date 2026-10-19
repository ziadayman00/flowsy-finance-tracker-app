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

export class CreateSavingsGoalDto {
  @ApiProperty({
    example: 'شقة الأحلام',
    description: 'Savings goal name',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'Financial account that holds the savings. The account currency becomes the goal currency.',
  })
  @IsUUID('4')
  accountId!: string;

  @ApiProperty({
    example: 200000.0,
    description: 'Target amount to save',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Target amount must be strictly greater than 0' })
  targetAmount!: number;

  @ApiPropertyOptional({
    example: '2027-12-31T00:00:00.000Z',
    description: 'Optional target date to reach the goal',
  })
  @IsOptional()
  @IsISO8601()
  targetDate?: string;

  @ApiPropertyOptional({
    example: 'توفير مقدمة شقة',
    description: 'Optional note or description',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
