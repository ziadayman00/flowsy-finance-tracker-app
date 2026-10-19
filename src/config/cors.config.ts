import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ForbiddenException } from '@nestjs/common';

export const DEFAULT_DEVELOPMENT_ORIGINS: readonly string[] = Object.freeze([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',
]);

/**
 * Validates whether a string is a well-formed CORS origin:
 * - Must be an absolute URL with http or https protocol
 * - Must have a valid host and optional port
 * - Must NOT contain pathname, search, or hash
 * - Must NOT contain trailing slash
 * - Must NOT be or contain wildcard '*'
 */
export function isValidOrigin(origin: string): boolean {
  if (!origin || typeof origin !== 'string') {
    return false;
  }
  const trimmed = origin.trim();
  if (!trimmed || trimmed === '*' || trimmed.includes('*')) {
    return false;
  }
  if (trimmed.endsWith('/')) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (!parsed.host) {
      return false;
    }
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      return false;
    }
    if (parsed.search || parsed.hash) {
      return false;
    }
    return parsed.origin === trimmed;
  } catch {
    return false;
  }
}

/**
 * Parses and validates the CORS_ORIGIN environment variable.
 * In production: fails fast if missing, empty, wildcard, or invalid.
 * In development: fails if wildcard or invalid URL; defaults to local development origins if unset.
 */
export function parseCorsOrigins(
  corsOriginEnv?: string,
  nodeEnv?: string,
): string[] {
  const isProduction = nodeEnv === 'production';

  if (!corsOriginEnv || corsOriginEnv.trim() === '') {
    if (isProduction) {
      throw new Error(
        'CORS_ORIGIN is required in production environment. Provide an explicit comma-separated list of approved origins.',
      );
    }
    return [...DEFAULT_DEVELOPMENT_ORIGINS];
  }

  const rawOrigins = corsOriginEnv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (rawOrigins.length === 0) {
    if (isProduction) {
      throw new Error(
        'CORS_ORIGIN must contain at least one valid origin in production.',
      );
    }
    return [...DEFAULT_DEVELOPMENT_ORIGINS];
  }

  for (const origin of rawOrigins) {
    if (origin === '*' || origin.includes('*')) {
      throw new Error(
        `Wildcard '*' is strictly forbidden for CORS_ORIGIN. Explicitly configure approved frontend origins.`,
      );
    }
    if (!isValidOrigin(origin)) {
      throw new Error(
        `Invalid CORS origin '${origin}'. Origins must be absolute URLs without trailing slashes or paths (e.g. 'https://app.flowsy.com').`,
      );
    }
  }

  return rawOrigins;
}

/**
 * Constructs production-grade NestJS / Express CorsOptions.
 * - Allows native clients (missing Origin header) without CORS headers.
 * - Matches incoming Origin against explicit allowlist.
 * - Rejects unapproved browser origins with 403 Forbidden.
 * - Exposes credentials only to explicitly approved origins.
 */
export function createCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // 1. Native mobile HTTP clients do not send Origin header; allow without CORS headers
      if (!origin) {
        return callback(null, true);
      }

      // 2. Explicit approved origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 3. Reject unapproved browser origins with 403 Forbidden
      return callback(
        new ForbiddenException(
          `CORS policy violation: Origin '${origin}' is not authorized.`,
        ),
        false,
      );
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'x-correlation-id',
    ],
    exposedHeaders: ['x-correlation-id'],
    maxAge: 86400,
  };
}
