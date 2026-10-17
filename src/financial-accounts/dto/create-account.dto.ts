import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'محفظة الكاش', description: 'Account display name' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiProperty({
    enum: AccountType,
    example: AccountType.CASH,
    description: 'Type of financial account',
  })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiPropertyOptional({ example: 'EGP', default: 'EGP' })
  @IsOptional()
  @IsString()
  currency?: string = 'EGP';

  @ApiPropertyOptional({
    example: 1500.0,
    description: 'Initial opening balance',
    default: 0.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Initial balance cannot be negative' })
  initialBalance?: number = 0.0;

  @ApiPropertyOptional({
    example: false,
    description: 'Exclude from Safe-to-Spend calculation (e.g. for emergency savings)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeFromSafeToSpend?: boolean = false;
}
