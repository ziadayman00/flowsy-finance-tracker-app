import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      financialAccount: {
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaService);
      }),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_jwt_access_token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock_secret'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      prismaService.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123!',
          displayName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register a new user and return tokens with initial cash account', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      const mockCreatedUser = {
        id: 'new-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        currency: 'EGP',
        timezone: 'Africa/Cairo',
        createdAt: new Date(),
      };
      prismaService.user.create.mockResolvedValue(mockCreatedUser);
      prismaService.financialAccount.create.mockResolvedValue({ id: 'acc-id' });
      prismaService.refreshToken.create.mockResolvedValue({ id: 'tok-id' });

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        displayName: 'Test User',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock_jwt_access_token');
      expect(result.refreshToken).toBeDefined();
      expect(prismaService.financialAccount.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for unknown user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      const realPasswordHash = await argon2.hash('CorrectPassword123!');
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: realPasswordHash,
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should authenticate user and return rotated tokens for valid credentials', async () => {
      const password = 'CorrectPassword123!';
      const realPasswordHash = await argon2.hash(password);
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        currency: 'EGP',
        timezone: 'Africa/Cairo',
        passwordHash: realPasswordHash,
        createdAt: new Date(),
      });
      prismaService.refreshToken.create.mockResolvedValue({ id: 'tok-id' });

      const result = await service.login({
        email: 'test@example.com',
        password,
      });

      expect(result.accessToken).toBe('mock_jwt_access_token');
      expect(result.user.id).toBe('user-id');
    });
  });

  describe('refreshToken', () => {
    it('should detect replay attack and revoke all tokens if already revoked', async () => {
      prismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id',
        userId: 'user-123',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
        user: { id: 'user-123', email: 'user@example.com' },
      });

      await expect(
        service.refreshToken({ refreshToken: 'some_old_token' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', revokedAt: null },
        }),
      );
    });
  });
});
