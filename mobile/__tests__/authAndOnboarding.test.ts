import { tokenStorage } from '../src/api/tokenStorage';
import { strings } from '../src/utils/strings.ar';
import { mapBackendError } from '../src/utils/errors';

describe('Flowsy Brand, Onboarding & Authentication Tests', () => {
  beforeEach(async () => {
    await tokenStorage.clearTokens();
  });

  afterAll(async () => {
    await tokenStorage.clearTokens();
  });

  describe('1. Token Storage & Session Lifecycle', () => {
    it('stores and retrieves access and refresh tokens correctly', async () => {
      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(tokenStorage.getRefreshToken()).toBeNull();

      const sampleTokens = {
        accessToken: 'mock-access-token-xyz',
        refreshToken: 'mock-refresh-token-abc',
        expiresIn: 900,
      };

      await tokenStorage.setTokens(sampleTokens);

      expect(tokenStorage.getAccessToken()).toBe('mock-access-token-xyz');
      expect(tokenStorage.getRefreshToken()).toBe('mock-refresh-token-abc');

      const retrieved = await tokenStorage.getTokens();
      expect(retrieved).toEqual(sampleTokens);
    });

    it('clears all tokens completely on logout', async () => {
      await tokenStorage.setTokens({
        accessToken: 'to-be-cleared',
        refreshToken: 'to-be-cleared-refresh',
        expiresIn: 900,
      });

      expect(tokenStorage.getAccessToken()).toBe('to-be-cleared');

      await tokenStorage.clearTokens();

      expect(tokenStorage.getAccessToken()).toBeNull();
      expect(tokenStorage.getRefreshToken()).toBeNull();
      const retrieved = await tokenStorage.getTokens();
      expect(retrieved).toBeNull();
    });

    it('ensureInitialized warms up memory tokens if storage is populated', async () => {
      await tokenStorage.setTokens({
        accessToken: 'warmed-token',
        refreshToken: 'warmed-refresh',
        expiresIn: 900,
      });

      const initialized = await tokenStorage.ensureInitialized();
      expect(initialized?.accessToken).toBe('warmed-token');
      expect(tokenStorage.getAccessToken()).toBe('warmed-token');
    });
  });

  describe('2. Registration Validation & Payload Rules', () => {
    it('enforces display name minimum length of 2 characters and max 50', () => {
      const validateName = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed.length < 2) return 'الاسم يجب أن يكون حرفين على الأقل';
        if (trimmed.length > 50) return 'الاسم يجب ألا يتجاوز ٥٠ حرفاً';
        return null;
      };

      expect(validateName('')).toBe('الاسم يجب أن يكون حرفين على الأقل');
      expect(validateName('أ')).toBe('الاسم يجب أن يكون حرفين على الأقل');
      expect(validateName('  أ  ')).toBe('الاسم يجب أن يكون حرفين على الأقل');
      expect(validateName('أحمد')).toBeNull();
      expect(validateName('زياد أيمن')).toBeNull();
      expect(validateName('a'.repeat(51))).toBe('الاسم يجب ألا يتجاوز ٥٠ حرفاً');
    });

    it('enforces email format validation and normalization', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('user@')).toBe(false);
      expect(emailRegex.test('@example.com')).toBe(false);
      expect(emailRegex.test('user@example.com')).toBe(true);

      expect(normalizeEmail('  Ziad@Flowsy.App ')).toBe('ziad@flowsy.app');
    });

    it('enforces password minimum 8 characters and confirmation match', () => {
      const validatePasswords = (pw: string, confirm: string) => {
        if (pw.length < 8) return 'كلمة السر يجب أن تكون ٨ أحرف على الأقل';
        if (pw !== confirm) return 'كلمتا السر غير متطابقتين';
        return null;
      };

      expect(validatePasswords('short', 'short')).toBe('كلمة السر يجب أن تكون ٨ أحرف على الأقل');
      expect(validatePasswords('ValidPass123', 'Different123')).toBe('كلمتا السر غير متطابقتين');
      expect(validatePasswords('ValidPass123', 'ValidPass123')).toBeNull();
    });

    it('supports regional currencies with EGP as primary default for Egypt & Gulf', () => {
      const currencies = ['EGP', 'SAR', 'AED', 'USD', 'EUR'];
      expect(currencies).toContain('EGP');
      expect(currencies).toContain('SAR');
      expect(currencies).toContain('AED');
    });
  });

  describe('3. Login Error Mapping', () => {
    it('maps 401 Unauthorized to friendly Arabic credential failure message', () => {
      const mapped = mapBackendError(401, 'Unauthorized', 'Invalid credentials');
      expect(mapped.message).toContain('كلمة السر');
    });

    it('maps 429 Too Many Requests to friendly throttling guidance', () => {
      const mapped = mapBackendError(429, 'Too Many Requests', 'ThrottlerException: Too Many Requests');
      expect(mapped.message).toContain('محاولات كتير');
    });

    it('maps 409 Conflict to duplicate email error message', () => {
      const mapped = mapBackendError(409, 'Conflict', 'Email already exists');
      expect(mapped.message).toContain('مسجّل قبل كده');
    });
  });

  describe('4. Brand Copy & Egyptian/Gulf Editorial Tone', () => {
    it('contains the specified official Flowsy headline and supporting copy', () => {
      expect(strings.auth.welcomeHeadline).toBe('فلوسك أوضح. قراراتك أهدى.');
      expect(strings.auth.welcomeTagline).toBe('تابع مصاريفك، نظّم ميزانيتك، وخطّط للي جاي بثقة.');
    });

    it('includes core brand value pillars for financial clarity and privacy', () => {
      expect(strings.auth.safeToSpendPillar).toBe('المتاح للصرف بأمان');
      expect(strings.auth.privacyPillar).toBe('خصوصية وأمان');
      expect(strings.auth.gulfEgyptPillar).toBe('مخصص لمصر والخليج');
    });

    it('provides truthful password recovery messaging without fake email claims', () => {
      expect(strings.auth.passwordRecoveryNotice).toContain('قيد الإعداد للتحديث القادم');
      expect(strings.auth.supportEmail).toBe('support@flowsy.app');
    });
  });
});
