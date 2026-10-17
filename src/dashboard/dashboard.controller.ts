import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Retrieve complete dashboard financial summary including "تقدر تصرف كام؟" (Safe-to-Spend), liquid funds, outstanding commitments, and monthly cash flow',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard financial summary returned.',
    type: DashboardSummaryDto,
  })
  async getSummary(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary(user.id);
  }
}
