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
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetResponseDto } from './dto/budget-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Budgets')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'List all user budgets with live spending progress' })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'List of budgets with calculated progress.',
    type: [BudgetResponseDto],
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<BudgetResponseDto[]> {
    const showArchived = includeArchived === 'true';
    return this.budgetsService.findAll(user.id, showArchived);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details and progress of a specific budget' })
  @ApiResponse({
    status: 200,
    description: 'Budget details returned.',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.findById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category or overall budget' })
  @ApiResponse({
    status: 201,
    description: 'Budget created successfully.',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid dates or input' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing budget' })
  @ApiResponse({
    status: 200,
    description: 'Budget updated successfully.',
    type: BudgetResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return this.budgetsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiResponse({ status: 200, description: 'Budget deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.budgetsService.delete(user.id, id);
  }
}
