import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';
import { ApiErrorResponse, AuthTokens } from './types';
import { tokenStorage } from './tokenStorage';

const getDevHostIp = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  // 1. In Expo Go, hostUri contains the exact Metro host LAN IP (e.g. "192.168.1.2:8081")
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && ip !== '10.0.2.2') {
      return ip;
    }
  }

  // 2. NativeModules SourceCode fallback
  const scriptURL: string | undefined = NativeModules.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1' && match[1] !== '10.0.2.2') {
      return match[1];
    }
  }

  // 3. Fallback for Android Studio emulator
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }

  return 'localhost';
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${getDevHostIp()}:3000/api/v1`;

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
    public readonly correlationId?: string,
    public readonly rawResponse?: ApiErrorResponse,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generate simple random UUID for correlation ID header
function generateCorrelationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Mutex promise for single-flight token rotation
let refreshPromise: Promise<boolean> | null = null;

async function executeSingleFlightRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      await tokenStorage.clearTokens();
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-correlation-id': generateCorrelationId(),
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await tokenStorage.clearTokens();
        return false;
      }

      const data: AuthTokens = await res.json();
      await tokenStorage.setTokens(data);
      return true;
    } catch {
      // Network drop during refresh: do not clear tokens so offline state is preserved
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const correlationId = generateCorrelationId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-correlation-id': correlationId,
    ...(options.headers as Record<string, string>),
  };

  if (!options.skipAuth) {
    let token = tokenStorage.getAccessToken();
    if (!token) {
      await tokenStorage.ensureInitialized();
      token = tokenStorage.getAccessToken();
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(
      0,
      'NetworkError',
      `تعذر الاتصال بالخادم (${message}).`,
      correlationId,
    );
  }

  // Handle 401 Unauthorized via Single-Flight Refresh Mutex
  if (response.status === 401 && !options.skipAuth && tokenStorage.getRefreshToken()) {
    // Avoid infinite loop if calling refresh itself
    if (!endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
      const refreshed = await executeSingleFlightRefresh();
      if (refreshed) {
        headers.Authorization = `Bearer ${tokenStorage.getAccessToken()}`;
        return apiClient<T>(endpoint, { ...options, headers });
      }
    }
  }

  if (!response.ok) {
    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = await response.json();
    } catch {
      // Non-JSON response
    }

    const rawMessage = errorData?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : rawMessage || response.statusText || 'حدث خطأ أثناء معالجة الطلب';

    throw new ApiError(
      response.status,
      errorData?.error || 'HttpError',
      message,
      errorData?.correlationId || correlationId,
      errorData || undefined,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

apiClient.get = function <T>(endpoint: string, options?: RequestOptions) {
  return apiClient<T>(endpoint, { ...options, method: 'GET' });
};

apiClient.post = function <T>(endpoint: string, body?: any, options?: RequestOptions) {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'POST',
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
};

apiClient.patch = function <T>(endpoint: string, body?: any, options?: RequestOptions) {
  return apiClient<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
};

apiClient.delete = function <T>(endpoint: string, options?: RequestOptions) {
  return apiClient<T>(endpoint, { ...options, method: 'DELETE' });
};
