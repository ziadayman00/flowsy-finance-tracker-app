import { apiClient } from './client';
import { CashFlowForecastDto } from './types';

export const forecastingApi = {
  async getForecast(months: number = 3, currency: string = 'EGP'): Promise<CashFlowForecastDto> {
    return apiClient.get<CashFlowForecastDto>(
      `/forecasting/cashflow?months=${months}&currency=${encodeURIComponent(currency)}`
    );
  },
};
