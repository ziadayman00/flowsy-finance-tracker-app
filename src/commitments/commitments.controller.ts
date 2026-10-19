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
import { CommitmentsService } from './commitments.service';
import { CreateCommitmentDto } from './dto/create-commitment.dto';
import { UpdateCommitmentDto } from './dto/update-commitment.dto';
import { PayCommitmentDto } from './dto/pay-commitment.dto';
import { CommitmentResponseDto } from './dto/commitment-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CommitmentStatus } from '@prisma/client';

@ApiTags('Commitments')
@Controller('commitments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class CommitmentsController {
  constructor(private readonly commitmentsService: CommitmentsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List upcoming financial commitments (rent, utilities, installments, subscriptions)',
  })
  @ApiQuery({
    name: 'status',
    enum: CommitmentStatus,
    required: false,
    description: 'Filter commitments by status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of commitments returned.',
    type: [CommitmentResponseDto],
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: CommitmentStatus,
  ): Promise<CommitmentResponseDto[]> {
    return this.commitmentsService.findAll(user.id, status);
  }
  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark overdue commitments',
    description:
      'Transitions all PENDING commitments whose dueDate is in the past to OVERDUE status. ' +
      'Call this before reading commitments when accuracy is required. ' +
      'A scheduled job also runs this automatically on a nightly basis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the count of commitments transitioned to OVERDUE.',
    schema: {
      type: 'object',
      properties: {
        transitioned: { type: 'number', example: 2 },
      },
    },
  })
  async reconcileOverdue(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ transitioned: number }> {
    const count = await this.commitmentsService.markOverdueForUser(user.id);
    return { transitioned: count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific commitment' })
  @ApiResponse({
    status: 200,
    description: 'Commitment details returned.',
    type: CommitmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Commitment not found' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CommitmentResponseDto> {
    return this.commitmentsService.findById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new upcoming commitment' })
  @ApiResponse({
    status: 201,
    description: 'Commitment created successfully.',
    type: CommitmentResponseDto,
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommitmentDto,
  ): Promise<CommitmentResponseDto> {
    return this.commitmentsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing commitment' })
  @ApiResponse({
    status: 200,
    description: 'Commitment updated successfully.',
    type: CommitmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Commitment not found' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommitmentDto,
  ): Promise<CommitmentResponseDto> {
    return this.commitmentsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a commitment' })
  @ApiResponse({ status: 200, description: 'Commitment deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Commitment not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.commitmentsService.delete(user.id, id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Pay a commitment: records an atomic EXPENSE transaction, deducts account balance, marks status PAID, and schedules next recurrence if recurring',
  })
  @ApiResponse({
    status: 200,
    description: 'Commitment marked as paid and expense recorded.',
  })
  @ApiResponse({ status: 400, description: 'Commitment already paid' })
  @ApiResponse({ status: 404, description: 'Commitment or account not found' })
  async pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PayCommitmentDto,
  ) {
    return this.commitmentsService.pay(user.id, id, dto);
  }
}

