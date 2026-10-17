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
import { FinancialAccountsService } from './financial-accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountResponseDto } from './dto/account-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Financial Accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class FinancialAccountsController {
  constructor(
    private readonly accountsService: FinancialAccountsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all financial accounts for authenticated user' })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Whether to include archived accounts',
  })
  @ApiResponse({
    status: 200,
    description: 'List of accounts retrieved successfully.',
    type: [AccountResponseDto],
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<AccountResponseDto[]> {
    const showArchived = includeArchived === 'true';
    return this.accountsService.findAll(user.id, showArchived);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific financial account' })
  @ApiResponse({
    status: 200,
    description: 'Account details returned.',
    type: AccountResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AccountResponseDto> {
    return this.accountsService.findById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new financial account' })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully.',
    type: AccountResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Account name already exists' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update financial account details' })
  @ApiResponse({
    status: 200,
    description: 'Account updated successfully.',
    type: AccountResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete an unused account (accounts with transactions must be archived)',
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete account with existing transactions',
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.accountsService.delete(user.id, id);
  }
}
