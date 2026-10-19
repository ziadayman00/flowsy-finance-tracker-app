import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ForecastingService } from './forecasting.service';
import { CashFlowForecastDto } from './dto/cash-flow-forecast.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const SUPPORTED_CURRENCIES = ['EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'USD', 'EUR'];

@ApiTags('Forecasting')
@Controller('forecasting')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer-auth')
export class ForecastingController {
  constructor(private readonly forecastingService: ForecastingService) {}

  @Get('cashflow')
  @ApiOperation({
    summary: 'Cash-flow forecast',
    description:
      'Returns a deterministic month-by-month projection of upcoming recurring ' +
      'financial commitments for the authenticated user. Values are labelled ' +
      'ESTIMATE and are derived solely from recorded recurring commitments — no AI, ' +
      'no bank connectivity. Cross-currency totals are never mixed: only commitments ' +
      'matching the requested `currency` are included.',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months to project (1–12, default: 3)',
    example: 3,
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: `Currency to project. Only commitments in this currency are included. Default: EGP. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
    example: 'EGP',
  })
  @ApiResponse({
    status: 200,
    description: 'Forecast returned.',
    type: CashFlowForecastDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid months (must be 1–12) or unsupported currency.',
  })
  async getCashFlow(
    @CurrentUser() user: AuthenticatedUser,
    @Query('months') monthsStr?: string,
    @Query('currency') currency?: string,
  ): Promise<CashFlowForecastDto> {
    const months = monthsStr ? parseInt(monthsStr, 10) : 3;
    const resolvedCurrency = (currency ?? 'EGP').toUpperCase();

    if (!SUPPORTED_CURRENCIES.includes(resolvedCurrency)) {
      throw new Error(
        `Unsupported currency: ${resolvedCurrency}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
      );
    }

    return this.forecastingService.getCashFlowForecast(
      user.id,
      isNaN(months) ? 3 : months,
      resolvedCurrency,
    );
  }
}
