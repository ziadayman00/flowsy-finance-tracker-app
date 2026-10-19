import { apiClient } from './client';
import { DashboardSummaryDto } from './types';

/**
 * Retrieves the comprehensive Home Page dashboard summary.
 * Endpoint: GET /api/v1/dashboard/summary
 */
export async function getDashboardSummary(): Promise<DashboardSummaryDto> {
  return apiClient<DashboardSummaryDto>('/dashboard/summary');
}

export const dashboardApi = {
  getSummary: getDashboardSummary,
  getDashboardSummary,
};
