import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsSupportedCurrency } from '../../common/validators/is-supported-currency.validator';
import { IsSupportedTimezone } from '../../common/validators/is-supported-timezone.validator';
import { SUPPORTED_CURRENCIES } from '../../common/validators/is-supported-currency.validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'زياد أيمن' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'EGP',
    description: `Currency code. Supported values: ${SUPPORTED_CURRENCIES.join(', ')}`,
    enum: SUPPORTED_CURRENCIES,
  })
  @IsOptional()
  @IsSupportedCurrency()
  currency?: string;

  @ApiPropertyOptional({
    example: 'Africa/Cairo',
    description: 'Valid IANA timezone identifier',
  })
  @IsOptional()
  @IsSupportedTimezone()
  timezone?: string;
}
