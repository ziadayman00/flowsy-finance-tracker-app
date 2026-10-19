import { Platform } from 'react-native';
import { AuthTokens } from './types';

const ACCESS_TOKEN_KEY = 'flowsy_access_token';
const REFRESH_TOKEN_KEY = 'flowsy_refresh_token';

let memoryTokens: AuthTokens | null = null;

let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch {
  SecureStore = null;
}

export const tokenStorage = {
  async getTokens(): Promise<AuthTokens | null> {
    if (memoryTokens) return memoryTokens;

    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (accessToken && refreshToken) {
          memoryTokens = {
            accessToken,
            refreshToken,
            expiresIn: 900,
          };
          return memoryTokens;
        }
      } catch {
        // Fallback
      }
    }

    if (SecureStore) {
      try {
        const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (accessToken && refreshToken) {
          memoryTokens = {
            accessToken,
            refreshToken,
            expiresIn: 900,
          };
          return memoryTokens;
        }
      } catch {
        // Fallback
      }
    }
    return null;
  },

  getAccessToken(): string | null {
    if (memoryTokens?.accessToken) return memoryTokens.accessToken;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
      } catch {
        return null;
      }
    }
    return null;
  },

  getRefreshToken(): string | null {
    if (memoryTokens?.refreshToken) return memoryTokens.refreshToken;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
      } catch {
        return null;
      }
    }
    return null;
  },

  async setTokens(tokens: AuthTokens | null): Promise<void> {
    memoryTokens = tokens;

    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        if (tokens) {
          localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
        } else {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
      } catch {
        // ignore localStorage errors
      }
    }

    if (SecureStore) {
      try {
        if (tokens) {
          await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
        } else {
          await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        }
      } catch {
        // Storage failure fallback
      }
    }
  },

  async clearTokens(): Promise<void> {
    memoryTokens = null;

    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // ignore
      }
    }

    if (SecureStore) {
      try {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      } catch {
        // Fallback
      }
    }
  },
};
