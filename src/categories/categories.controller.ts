import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CategoryType } from '@prisma/client';

@ApiTags('Categories')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List system default and user custom categories, optionally filtered by type',
  })
  @ApiQuery({
    name: 'type',
    enum: CategoryType,
    required: false,
    description: 'Filter by INCOME or EXPENSE',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully.',
    type: [CategoryResponseDto],
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: CategoryType,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(user.id, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a category' })
  @ApiResponse({
    status: 200,
    description: 'Category details returned.',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.findById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom category for the user' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully.',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a user custom category (system categories cannot be edited)',
  })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully.',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot edit system default categories or other users categories',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete a user custom category (system categories and in-use categories cannot be deleted)',
  })
  @ApiResponse({ status: 200, description: 'Category deleted successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete category with associated transactions',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot delete system default categories',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.categoriesService.delete(user.id, id);
  }
}
