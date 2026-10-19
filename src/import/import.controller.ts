import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ImportService } from './import.service';
import {
  ImportCommitDto,
  ImportCommitResponseDto,
  ImportPreviewDto,
  ImportPreviewResponseDto,
} from './dto/import.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('Import')
@Controller('import')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * Step 1 of 2: Validate and classify rows, detect likely duplicates.
   * No data is written to the database.
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview an import batch (no DB writes)',
    description:
      'Validates rows, detects likely duplicates against existing transactions, ' +
      'and returns a classification report. A sessionId is returned which must be ' +
      'passed to /import/commit within 15 minutes to persist the import.',
  })
  @ApiResponse({
    status: 200,
    description: 'Preview report returned.',
    type: ImportPreviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error or batch too large.' })
  @ApiResponse({ status: 404, description: 'Account not found.' })
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportPreviewDto,
  ): Promise<ImportPreviewResponseDto> {
    return this.importService.preview(user.id, dto);
  }

  /**
   * Step 2 of 2: Persist the accepted rows from a previous preview session.
   */
  @Post('commit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Commit an import session',
    description:
      'Persists accepted rows from a previous /import/preview session. ' +
      'Pass rowIndices to selectively commit specific rows; omit to commit all NEW rows. ' +
      'All inserts happen atomically. Account balance is updated in the same transaction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Import committed.',
    type: ImportCommitResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Session not found, expired, or invalid row indices.',
  })
  async commit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportCommitDto,
  ): Promise<ImportCommitResponseDto> {
    return this.importService.commit(user.id, dto);
  }
}
