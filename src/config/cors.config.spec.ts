import {
  parseCorsOrigins,
  isValidOrigin,
  DEFAULT_DEVELOPMENT_ORIGINS,
} from './cors.config';
import { validate } from './env.validation';

describe('CORS Configuration & Validation', () => {
  const baseValidConfig = {
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/flowsy',
    JWT_ACCESS_SECRET: 'super_secret_access_key_min_32_characters_long!',
    JWT_REFRESH_SECRET: 'super_secret_refresh_key_min_32_characters_long!',
  };

  describe('isValidOrigin', () => {
    it('should accept valid HTTP and HTTPS origins with ports', () => {
      expect(isValidOrigin('http://localhost:3000')).toBe(true);
      expect(isValidOrigin('http://localhost:5173')).toBe(true);
      expect(isValidOrigin('https://app.flowsy.com')).toBe(true);
      expect(isValidOrigin('https://api.flowsy.com:8443')).toBe(true);
    });

    it('should reject wildcards', () => {
      expect(isValidOrigin('*')).toBe(false);
      expect(isValidOrigin('http://*')).toBe(false);
      expect(isValidOrigin('*.flowsy.com')).toBe(false);
    });

    it('should reject origins with trailing slashes or pathnames', () => {
      expect(isValidOrigin('http://localhost:3000/')).toBe(false);
      expect(isValidOrigin('https://app.flowsy.com/dashboard')).toBe(false);
      expect(isValidOrigin('https://app.flowsy.com?query=1')).toBe(false);
    });

    it('should reject invalid strings or schemes', () => {
      expect(isValidOrigin('not-a-url')).toBe(false);
      expect(isValidOrigin('ftp://flowsy.com')).toBe(false);
      expect(isValidOrigin('')).toBe(false);
    });
  });

  describe('parseCorsOrigins', () => {
    it('should return multiple configured origins correctly', () => {
      const origins = parseCorsOrigins(
        'http://localhost:3000, https://app.flowsy.com, https://admin.flowsy.com',
        'development',
      );
      expect(origins).toEqual([
        'http://localhost:3000',
        'https://app.flowsy.com',
        'https://admin.flowsy.com',
      ]);
    });

    it('should default to explicit local frontend origins in development when unset', () => {
      const origins = parseCorsOrigins(undefined, 'development');
      expect(origins).toEqual(DEFAULT_DEVELOPMENT_ORIGINS);
    });

    it('should throw if wildcard is specified in development', () => {
      expect(() => parseCorsOrigins('*', 'development')).toThrow(
        /Wildcard '\*' is strictly forbidden/,
      );
    });

    it('should fail fast in production if CORS_ORIGIN is missing or empty', () => {
      expect(() => parseCorsOrigins(undefined, 'production')).toThrow(
        /CORS_ORIGIN is required in production environment/,
      );
      expect(() => parseCorsOrigins('', 'production')).toThrow(
        /CORS_ORIGIN is required in production environment/,
      );
      expect(() => parseCorsOrigins('   ', 'production')).toThrow(
        /CORS_ORIGIN is required in production environment/,
      );
    });

    it('should fail fast in production if CORS_ORIGIN contains wildcard', () => {
      expect(() => parseCorsOrigins('*', 'production')).toThrow(
        /Wildcard '\*' is strictly forbidden/,
      );
      expect(() =>
        parseCorsOrigins('https://app.flowsy.com, *', 'production'),
      ).toThrow(/Wildcard '\*' is strictly forbidden/);
    });

    it('should fail fast in production if an origin is invalid', () => {
      expect(() =>
        parseCorsOrigins('https://app.flowsy.com, invalid-origin', 'production'),
      ).toThrow(/Invalid CORS origin/);
    });
  });

  describe('env.validation validate()', () => {
    it('should pass in production with valid explicit CORS_ORIGIN', () => {
      const result = validate({
        ...baseValidConfig,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.flowsy.com,https://admin.flowsy.com',
      });
      expect(result.CORS_ORIGIN).toBe(
        'https://app.flowsy.com,https://admin.flowsy.com',
      );
    });

    it('should throw during environment validation if CORS_ORIGIN is missing in production', () => {
      expect(() =>
        validate({
          ...baseValidConfig,
          NODE_ENV: 'production',
        }),
      ).toThrow(/CORS_ORIGIN is required in production environment/);
    });

    it('should throw during environment validation if CORS_ORIGIN has wildcard in production', () => {
      expect(() =>
        validate({
          ...baseValidConfig,
          NODE_ENV: 'production',
          CORS_ORIGIN: '*',
        }),
      ).toThrow(/Wildcard '\*' is strictly forbidden/);
    });
  });
});
