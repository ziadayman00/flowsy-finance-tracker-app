import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from '../auth/dto/auth-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      currency: user.currency,
      timezone: user.timezone,
      createdAt: user.createdAt,
    };
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
      },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      currency: user.currency,
      timezone: user.timezone,
      createdAt: user.createdAt,
    };
  }
}
