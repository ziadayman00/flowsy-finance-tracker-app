import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';
import { TransactionResponseDto } from './transaction-response.dto';

export class BatchCreateTransactionsDto {
  @ApiProperty({
    type: [CreateTransactionDto],
    description: 'Array of transactions to create atomically (1 to 20 transactions)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one transaction is required' })
  @ArrayMaxSize(20, { message: 'Maximum 20 transactions per batch allowed' })
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  transactions!: CreateTransactionDto[];
}

export class BatchCreateTransactionsResponseDto {
  @ApiProperty({
    type: [TransactionResponseDto],
    description: 'List of successfully created transactions in the atomic batch',
  })
  created!: TransactionResponseDto[];

  @ApiProperty({
    example: 2,
    description: 'Count of transactions created',
  })
  count!: number;
}
