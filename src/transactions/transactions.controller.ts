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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import {
  PaginatedTransactionsDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';
import {
  BatchCreateTransactionsDto,
  BatchCreateTransactionsResponseDto,
} from './dto/batch-create-transactions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Record a financial transaction (INCOME, EXPENSE, or TRANSFER) with atomic balance updates',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction recorded and account balances updated.',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation or transfer error' })
  @ApiResponse({ status: 404, description: 'Account or category not found' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(user.id, dto);
  }

  @Post('batch')
  @ApiOperation({
    summary:
      'Record multiple financial transactions atomically in a single database transaction',
  })
  @ApiResponse({
    status: 201,
    description: 'All transactions recorded and account balances updated atomically.',
    type: BatchCreateTransactionsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation or transfer error' })
  @ApiResponse({ status: 404, description: 'Account or category not found' })
  async createBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchCreateTransactionsDto,
  ): Promise<BatchCreateTransactionsResponseDto> {
    return this.transactionsService.createBatch(user.id, dto.transactions);
  }

  @Get()
  @ApiOperation({
    summary:
      'List paginated transactions with optional filters (type, account, category, date range)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated transactions list.',
    type: PaginatedTransactionsDto,
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryTransactionsDto,
  ): Promise<PaginatedTransactionsDto> {
    return this.transactionsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific transaction' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details returned.',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.findById(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a transaction note, date, category, or amount (adjusts balance delta atomically)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated successfully.',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete a transaction and atomically reverse its balance effect on account(s)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction deleted and balance reversed successfully.',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.transactionsService.delete(user.id, id);
  }
}
