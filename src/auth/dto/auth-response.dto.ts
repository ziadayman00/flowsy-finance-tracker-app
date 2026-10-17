import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'أحمد محمد' })
  displayName!: string;

  @ApiProperty({ example: 'EGP' })
  currency!: string;

  @ApiProperty({ example: 'Africa/Cairo' })
  timezone!: string;

  @ApiProperty({ example: '2026-10-17T20:00:00.000Z' })
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived JWT Access Token (15m)',
  })
  accessToken!: string;

  @ApiProperty({
    example: '9f86d081884c7d659a2feaa0c55ad015...',
    description: 'Long-lived Rotated Refresh Token (7d)',
  })
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access token expiration in seconds' })
  expiresIn!: number;
}
