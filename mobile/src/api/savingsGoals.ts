import { apiClient } from './client';
import {
  SavingsGoalResponseDto,
  CreateSavingsGoalDto,
  UpdateSavingsGoalDto,
} from './types';

export const savingsGoalsApi = {
  async getGoals(): Promise<SavingsGoalResponseDto[]> {
    return apiClient.get<SavingsGoalResponseDto[]>('/savings-goals');
  },

  async createGoal(dto: CreateSavingsGoalDto): Promise<SavingsGoalResponseDto> {
    return apiClient.post<SavingsGoalResponseDto>('/savings-goals', dto);
  },

  async updateGoal(id: string, dto: UpdateSavingsGoalDto): Promise<SavingsGoalResponseDto> {
    return apiClient.patch<SavingsGoalResponseDto>(`/savings-goals/${id}`, dto);
  },

  async deleteGoal(id: string): Promise<void> {
    return apiClient.delete<void>(`/savings-goals/${id}`);
  },
};
