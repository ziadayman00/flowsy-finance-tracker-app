import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '@prisma/client';

export class CategoryResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'إيجار / Rent' })
  name!: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  type!: CategoryType;

  @ApiProperty({ example: 'home-outline', nullable: true })
  icon!: string | null;

  @ApiProperty({ example: true, description: 'True if system-provided default category' })
  isSystem!: boolean;

  @ApiProperty({ example: false })
  isArchived!: boolean;
}
