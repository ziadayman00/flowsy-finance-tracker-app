import { apiClient } from './client';
import { tokenStorage } from './tokenStorage';
import { AuthResponseDto, UserProfileDto, HealthCheckResponseDto } from './types';

export async function login(
  email: string,
  password: string,
): Promise<AuthResponseDto> {
  const result = await apiClient<AuthResponseDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    skipAuth: true,
  });

  await tokenStorage.setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });

  return result;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
  currency: string = 'EGP',
  timezone: string = 'Africa/Cairo',
): Promise<AuthResponseDto> {
  const result = await apiClient<AuthResponseDto>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName.trim(),
      currency,
      timezone,
    }),
    skipAuth: true,
  });

  await tokenStorage.setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });

  return result;
}

export async function getProfile(): Promise<UserProfileDto> {
  return apiClient<UserProfileDto>('/auth/me');
}

export async function updateProfile(payload: {
  displayName?: string;
  currency?: string;
  timezone?: string;
}): Promise<UserProfileDto> {
  const cleanPayload: Record<string, string> = {};
  if (payload.displayName) cleanPayload.displayName = payload.displayName.trim();
  if (payload.currency) cleanPayload.currency = payload.currency.trim();
  if (payload.timezone) cleanPayload.timezone = payload.timezone.trim();

  return apiClient<UserProfileDto>('/users/profile', {
    method: 'PATCH',
    body: JSON.stringify(cleanPayload),
  });
}

export async function logout(allDevices: boolean = false): Promise<{ success: boolean }> {
  try {
    const refreshToken = tokenStorage.getRefreshToken();
    const body = allDevices ? {} : { refreshToken };

    await apiClient('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {
    // If network fails, clear local tokens regardless
  } finally {
    await tokenStorage.clearTokens();
  }
  return { success: true };
}

export async function checkHealth(): Promise<HealthCheckResponseDto> {
  return apiClient<HealthCheckResponseDto>('/health', { skipAuth: true });
}

export const authApi = {
  login,
  register,
  getMe: getProfile,
  getProfile,
  updateProfile,
  logout,
  checkHealth,
};
