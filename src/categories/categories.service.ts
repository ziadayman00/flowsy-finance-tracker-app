import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CategoryType } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToDto(cat: {
    id: string;
    userId: string | null;
    name: string;
    type: CategoryType;
    icon: string | null;
    isArchived: boolean;
  }): CategoryResponseDto {
    return {
      id: cat.id,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      isSystem: cat.userId === null,
      isArchived: cat.isArchived,
    };
  }

  async findAll(
    userId: string,
    type?: CategoryType,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
        isArchived: false,
        ...(type ? { type } : {}),
      },
      orderBy: [{ userId: 'asc' }, { name: 'asc' }],
    });

    return categories.map((cat) => this.mapToDto(cat));
  }

  async findById(userId: string, categoryId: string): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.mapToDto(category);
  }

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        icon: dto.icon || null,
      },
    });

    return this.mapToDto(category);
  }

  async update(
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Protection: system categories cannot be modified by regular users
    if (category.userId === null) {
      throw new ForbiddenException(
        'System default categories cannot be modified',
      );
    }

    // Ownership check: users cannot modify another user's custom category
    if (category.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this category',
      );
    }

    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
      },
    });

    return this.mapToDto(updated);
  }

  async delete(
    userId: string,
    categoryId: string,
  ): Promise<{ success: boolean; message: string }> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.userId === null) {
      throw new ForbiddenException('System default categories cannot be deleted');
    }

    if (category.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this category',
      );
    }

    // Prevent deletion if category is in use
    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with associated transactions. Please archive it instead.',
      );
    }

    const commitmentCount = await this.prisma.commitment.count({
      where: { categoryId },
    });

    if (commitmentCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with associated commitments. Please archive it instead.',
      );
    }

    await this.prisma.category.delete({
      where: { id: categoryId },
    });

    return { success: true, message: 'Category deleted successfully' };
  }
}
