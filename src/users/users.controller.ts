import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { UserProfileDto } from '../auth/dto/auth-response.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserProfileDto })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserProfileDto> {
    return this.usersService.findById(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserProfileDto })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ): Promise<UserProfileDto> {
    return this.usersService.update(user.id, dto);
  }

  /**
   * GDPR / data portability: export all data owned by the authenticated user
   * as a JSON download.
   *
   * No sensitive auth material (password hash, refresh tokens) is included.
   * The response is streamed as `application/json` with a Content-Disposition
   * header so browsers treat it as a file download.
   */
  @Get('me/export')
  @ApiOperation({
    summary: 'Export all user data (GDPR data portability)',
    description:
      'Returns a JSON file containing all data associated with the authenticated user. ' +
      'Password hash and auth tokens are excluded. ' +
      'Intended for GDPR data-portability requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'JSON file download containing all user data.',
  })
  async exportData(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.usersService.exportData(user.id);

    const filename = `flowsy-export-${user.id}-${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(JSON.stringify(data, null, 2));
  }

  /**
   * GDPR / right to erasure: permanently delete the authenticated user's
   * account and all associated data.
   *
   * This action is irreversible. The active JWT is still technically valid
   * until it expires (short-lived tokens are the mitigation); a token
   * blacklist can be added in Phase 4 if required.
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete account (GDPR right to erasure)',
    description:
      'Permanently deletes the authenticated user account and all associated data ' +
      '(accounts, transactions, budgets, commitments, categories, savings goals). ' +
      'This is irreversible.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account deleted successfully.',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
      },
    },
  })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    return this.usersService.deleteAccount(user.id);
  }
}
