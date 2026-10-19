import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import {
  IsSupportedCurrency,
  SUPPORTED_CURRENCIES,
} from '../../common/validators/is-supported-currency.validator';
import { IsSupportedTimezone } from '../../common/validators/is-supported-timezone.validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    description: 'Password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

  @ApiProperty({ example: 'أحمد محمد', description: 'User display name' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2, { message: 'Display name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Display name must not exceed 50 characters' })
  displayName!: string;

  @ApiPropertyOptional({
    example: 'EGP',
    default: 'EGP',
    enum: SUPPORTED_CURRENCIES,
    description: `Currency code. Supported values: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  @IsOptional()
  @IsSupportedCurrency()
  currency?: string = 'EGP';

  @ApiPropertyOptional({
    example: 'Africa/Cairo',
    default: 'Africa/Cairo',
    description: 'Valid IANA timezone identifier',
  })
  @IsOptional()
  @IsSupportedTimezone()
  timezone?: string = 'Africa/Cairo';
}

