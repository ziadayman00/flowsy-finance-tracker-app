import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../database/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { CategoryType } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
      },
      commitment: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('should throw ForbiddenException when attempting to update a system category', async () => {
      prismaService.category.findUnique.mockResolvedValue({
        id: 'sys-cat-1',
        userId: null, // System category
        name: 'إيجار / Rent',
        type: CategoryType.EXPENSE,
      });

      await expect(
        service.update('user-1', 'sys-cat-1', { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when attempting to update another users category', async () => {
      prismaService.category.findUnique.mockResolvedValue({
        id: 'user-cat-1',
        userId: 'other-user',
        name: 'My Custom Cat',
        type: CategoryType.EXPENSE,
      });

      await expect(
        service.update('user-1', 'user-cat-1', { name: 'Hacked Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update successfully when user owns the category', async () => {
      prismaService.category.findUnique.mockResolvedValue({
        id: 'user-cat-1',
        userId: 'user-1',
        name: 'My Custom Cat',
        type: CategoryType.EXPENSE,
        icon: null,
        isArchived: false,
      });

      prismaService.category.update.mockResolvedValue({
        id: 'user-cat-1',
        userId: 'user-1',
        name: 'Updated Cat Name',
        type: CategoryType.EXPENSE,
        icon: 'star',
        isArchived: false,
      });

      const result = await service.update('user-1', 'user-cat-1', {
        name: 'Updated Cat Name',
        icon: 'star',
      });

      expect(result.name).toBe('Updated Cat Name');
      expect(result.icon).toBe('star');
      expect(result.isSystem).toBe(false);
    });
  });
});
