import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

export class AccountResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'محفظة الكاش' })
  name!: string;

  @ApiProperty({ enum: AccountType, example: AccountType.CASH })
  type!: AccountType;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiProperty({ example: '1500.00', description: 'Opening balance as exact decimal string' })
  initialBalance!: string;

  @ApiProperty({ example: '1500.00', description: 'Current available balance as exact decimal string' })
  currentBalance!: string;

  @ApiProperty({ example: false })
  isArchived!: boolean;

  @ApiProperty({ example: false })
  excludeFromSafeToSpend!: boolean;

  @ApiProperty({ example: '2026-10-17T20:00:00.000Z' })
  createdAt!: Date;
}
