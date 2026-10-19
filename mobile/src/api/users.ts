import { apiClient } from './client';
import { UserProfileDto } from './types';

export interface UpdateUserProfileDto {
  displayName?: string;
  currency?: string;
  timezone?: string;
}

export const usersApi = {
  async getProfile(): Promise<UserProfileDto> {
    const res = await apiClient.get<UserProfileDto>('/users/profile');
    return res;
  },

  async updateProfile(dto: UpdateUserProfileDto): Promise<UserProfileDto> {
    const payload: Record<string, string> = {};
    if (dto.displayName !== undefined) payload.displayName = dto.displayName.trim();
    if (dto.currency !== undefined) payload.currency = dto.currency;
    if (dto.timezone !== undefined) payload.timezone = dto.timezone;

    const res = await apiClient.patch<UserProfileDto>('/users/profile', payload);
    return res;
  },
};
