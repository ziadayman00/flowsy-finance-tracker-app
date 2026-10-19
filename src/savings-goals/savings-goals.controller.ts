import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { SavingsGoalsService } from './savings-goals.service';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto';
import { SavingsGoalResponseDto } from './dto/savings-goal-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Savings Goals')
@Controller('savings-goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class SavingsGoalsController {
  constructor(private readonly savingsGoalsService: SavingsGoalsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all savings goals',
    description:
      'Returns savings goals with live progress computed from the linked account balance.',
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Include archived goals (default: false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Savings goals returned.',
    type: [SavingsGoalResponseDto],
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<SavingsGoalResponseDto[]> {
    return this.savingsGoalsService.findAll(user.id, includeArchived === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific savings goal' })
  @ApiResponse({
    status: 200,
    description: 'Savings goal returned.',
    type: SavingsGoalResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Savings goal not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SavingsGoalResponseDto> {
    return this.savingsGoalsService.findById(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new savings goal',
    description:
      'Creates a savings goal linked to a financial account. Progress is tracked by the account\'s current balance.',
  })
  @ApiResponse({
    status: 201,
    description: 'Savings goal created.',
    type: SavingsGoalResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Account already has an active goal' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    return this.savingsGoalsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a savings goal' })
  @ApiResponse({
    status: 200,
    description: 'Savings goal updated.',
    type: SavingsGoalResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Savings goal not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSavingsGoalDto,
  ): Promise<SavingsGoalResponseDto> {
    return this.savingsGoalsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a savings goal',
    description:
      'Deletes the goal record. The linked account and its balance are not affected.',
  })
  @ApiResponse({ status: 200, description: 'Savings goal deleted.' })
  @ApiResponse({ status: 404, description: 'Savings goal not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.savingsGoalsService.delete(user.id, id);
  }
}
