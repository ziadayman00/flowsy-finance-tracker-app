import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { AccountType } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  private async generateTokens(userId: string, email: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const payload = { sub: userId, email };
    const accessToken = await this.jwtService.signAsync(payload);

    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    // Refresh token valid for 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    // Execute atomic user creation + default initial cash account
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
          currency: dto.currency || 'EGP',
          timezone: dto.timezone || 'Africa/Cairo',
        },
      });

      // Provide each newly registered user with an initial default Cash account
      await tx.financialAccount.create({
        data: {
          userId: newUser.id,
          name: 'كاش / Cash',
          type: AccountType.CASH,
          currency: newUser.currency,
          initialBalance: 0.00,
          currentBalance: 0.00,
        },
      });

      return newUser;
    });

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        currency: user.currency,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        currency: user.currency,
        timezone: user.timezone,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(dto.refreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Replay attack detection: if token is already revoked, invalidate all user tokens
    if (tokenRecord.revokedAt) {
      this.logger.warn(
        `Potential replay attack detected for user ${tokenRecord.userId}. Revoking all active tokens.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: tokenRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check expiration
    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Rotate token: revoke current token and issue new token pair atomically
    const newTokens = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      const payload = { sub: tokenRecord.userId, email: tokenRecord.user.email };
      const accessToken = await this.jwtService.signAsync(payload);

      const rawRefreshToken = this.generateRefreshToken();
      const newTokenHash = this.hashToken(rawRefreshToken);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await tx.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: tokenRecord.userId,
          expiresAt,
        },
      });

      return {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: 900,
      };
    });

    return {
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        displayName: tokenRecord.user.displayName,
        currency: tokenRecord.user.currency,
        timezone: tokenRecord.user.timezone,
        createdAt: tokenRecord.user.createdAt,
      },
      ...newTokens,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<{ success: boolean; message: string }> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      // Invalidate all active sessions for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
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
}
