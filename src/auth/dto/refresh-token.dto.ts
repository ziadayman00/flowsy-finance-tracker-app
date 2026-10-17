import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'd3b07384d113edec49eaa6238ad5ff00...',
    description: 'Cryptographic refresh token string',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
