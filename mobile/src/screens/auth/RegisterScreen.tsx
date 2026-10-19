import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/primitives/Screen';
import { AppText } from '../../components/primitives/AppText';
import { Field } from '../../components/primitives/Field';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { register } from '../../api/auth';
import { mapBackendError } from '../../utils/errors';
import { ApiError } from '../../api/client';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { TermsAndPrivacySheet } from './TermsAndPrivacySheet';

interface RegisterScreenProps {
  onRegisterSuccess: () => void;
  onGoToLogin: () => void;
  onBack?: () => void;
}

const SUPPORTED_CURRENCIES = [
  { code: 'EGP', label: 'جنيه مصري (EGP)' },
  { code: 'SAR', label: 'ريال سعودي (SAR)' },
  { code: 'AED', label: 'درهم إماراتي (AED)' },
  { code: 'USD', label: 'دولار أمريكي (USD)' },
  { code: 'EUR', label: 'يورو (EUR)' },
];

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onRegisterSuccess,
  onGoToLogin,
  onBack,
}) => {
  const { spacing, colors, radii } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState('EGP');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [termsVisible, setTermsVisible] = useState(false);

  const isPasswordLongEnough = password.length >= 8;
  const doPasswordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!displayName.trim() || displayName.trim().length < 2) {
      errs.displayName = 'الاسم يجب أن يكون حرفين على الأقل';
    } else if (displayName.trim().length > 50) {
      errs.displayName = 'الاسم يجب ألا يتجاوز ٥٠ حرفاً';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errs.email = 'يرجى إدخال بريد إلكتروني صحيح';
    }

    if (password.length < 8) {
      errs.password = 'كلمة السر يجب أن تكون ٨ أحرف على الأقل';
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = 'كلمتا السر غير متطابقتين';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isFormValid = useMemo(() => {
    return (
      displayName.trim().length >= 2 &&
      displayName.trim().length <= 50 &&
      email.trim().includes('@') &&
      password.length >= 8 &&
      password === confirmPassword
    );
  }, [displayName, email, password, confirmPassword]);

  const handleRegister = async () => {
    if (!validate() || loading) return;

    setLoading(true);
    setGlobalError(null);

    try {
      await register(email, password, displayName, currency);
      haptics.notificationSuccess();
      onRegisterSuccess();
    } catch (err: unknown) {
      haptics.notificationError();
      if (err instanceof ApiError) {
        const mapped = mapBackendError(
          err.statusCode,
          err.error,
          err.rawResponse?.message || err.message,
        );
        if (mapped.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...mapped.fieldErrors }));
        }
        setGlobalError(mapped.message);
      } else {
        setGlobalError('تعذر إنشاء الحساب — تأكد من الاتصال وحاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    haptics.impactLight();
    if (onBack) {
      onBack();
    } else {
      onGoToLogin();
    }
  };

  return (
    <>
      <Screen scroll contentContainerStyle={[styles.container, { paddingHorizontal: spacing.xl }]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            style={[styles.backBtn, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <Icon name="arrow-back" size={20} color={colors.textPrimary} isRTLMirrored />
          </Pressable>
          <AppText variant="caption" tone="secondary">
            {strings.appName}
          </AppText>
        </View>

        {/* Title & Subtitle */}
        <View style={{ marginBottom: spacing.lg }}>
          <AppText variant="title1" style={styles.title}>
            {strings.auth.registerTitle}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.subtitle}>
            {strings.auth.registerSubtitle}
          </AppText>
        </View>

        {/* Global Error Banner */}
        {globalError && (
          <View style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle, borderRadius: radii.sm, borderColor: colors.negative }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.negative} />
            <AppText variant="caption" tone="negative" style={{ flex: 1, marginStart: 8 }}>
              {globalError}
            </AppText>
          </View>
        )}

        {/* Full Name */}
        <Field
          label={strings.auth.fullName}
          placeholder={strings.auth.fullNamePlaceholder}
          value={displayName}
          onChangeText={(val) => {
            setDisplayName(val);
            setFieldErrors((prev) => ({ ...prev, displayName: '' }));
          }}
          error={fieldErrors.displayName}
          maxLength={50}
        />

        {/* Email Address */}
        <Field
          label={strings.auth.email}
          placeholder={strings.auth.emailPlaceholder}
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            setFieldErrors((prev) => ({ ...prev, email: '' }));
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          isLtr
          error={fieldErrors.email}
        />

        {/* Password */}
        <Field
          label={strings.auth.password}
          placeholder={strings.auth.passwordPlaceholder}
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            setFieldErrors((prev) => ({ ...prev, password: '' }));
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          isLtr
          error={fieldErrors.password}
          trailingIcon={
            <Icon
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          }
          onTrailingPress={() => setShowPassword(!showPassword)}
        />

        {/* Confirm Password */}
        <Field
          label={strings.auth.confirmPassword}
          placeholder={strings.auth.confirmPasswordPlaceholder}
          value={confirmPassword}
          onChangeText={(val) => {
            setConfirmPassword(val);
            setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
          }}
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          isLtr
          error={fieldErrors.confirmPassword}
          trailingIcon={
            <Icon
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          }
          onTrailingPress={() => setShowConfirmPassword(!showConfirmPassword)}
        />

        {/* Live Validation Guidance */}
        <View style={[styles.guidanceBox, { backgroundColor: colors.surface, borderRadius: radii.sm, borderColor: colors.border }]}>
          <View style={styles.guidanceRow}>
            <Icon
              name={isPasswordLongEnough ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={isPasswordLongEnough ? colors.positive : colors.textTertiary}
            />
            <AppText
              variant="caption"
              style={{
                color: isPasswordLongEnough ? colors.positive : colors.textSecondary,
                fontWeight: isPasswordLongEnough ? '600' : '400',
              }}
            >
              {strings.auth.passwordRuleMinLength}
            </AppText>
          </View>

          {confirmPassword.length > 0 && (
            <View style={styles.guidanceRow}>
              <Icon
                name={doPasswordsMatch ? 'checkmark-circle' : 'close-circle-outline'}
                size={16}
                color={doPasswordsMatch ? colors.positive : colors.negative}
              />
              <AppText
                variant="caption"
                style={{
                  color: doPasswordsMatch ? colors.positive : colors.negative,
                  fontWeight: doPasswordsMatch ? '600' : '400',
                }}
              >
                {doPasswordsMatch ? strings.auth.passwordsMatch : strings.auth.passwordsDoNotMatch}
              </AppText>
            </View>
          )}
        </View>

        {/* Currency Selection */}
        <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            {strings.auth.primaryCurrency}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyChips}>
            {SUPPORTED_CURRENCIES.map((cur) => {
              const active = currency === cur.code;
              return (
                <Pressable
                  key={cur.code}
                  onPress={() => {
                    setCurrency(cur.code);
                    haptics.impactLight();
                  }}
                  style={[
                    styles.currencyChip,
                    {
                      backgroundColor: active ? colors.forest : colors.surface,
                      borderColor: active ? colors.forest : colors.border,
                      borderRadius: radii.sm,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: active ? colors.onAction : colors.textPrimary,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {cur.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Terms and Privacy Notice */}
        <Pressable onPress={() => setTermsVisible(true)} style={styles.termsPressable}>
          <AppText variant="caption" tone="secondary" style={styles.termsText}>
            بإنشائك للحساب، فإنك توافق على{' '}
            <AppText variant="caption" tone="primary" style={{ textDecorationLine: 'underline', fontWeight: '600' }}>
              شروط الخدمة وسياسة الخصوصية
            </AppText>
            .
          </AppText>
        </Pressable>

        {/* Primary Submit Button */}
        <Button
          title={strings.auth.createAccountBtn}
          onPress={handleRegister}
          loading={loading}
          disabled={!isFormValid || loading}
          style={{ marginTop: spacing.md }}
        />

        {/* Footer switch to login */}
        <View style={styles.footerRow}>
          <AppText variant="body" tone="secondary">
            {strings.auth.alreadyHaveAccount}
          </AppText>
          <Pressable onPress={onGoToLogin} style={{ marginStart: 6 }}>
            <AppText variant="bodyStrong" tone="primary" style={{ textDecorationLine: 'underline' }}>
              {strings.auth.goToLogin}
            </AppText>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </Screen>

      <TermsAndPrivacySheet visible={termsVisible} onClose={() => setTermsVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 6,
    textAlign: 'right',
  },
  subtitle: {
    textAlign: 'right',
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  guidanceBox: {
    padding: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: -6,
    marginBottom: 8,
  },
  guidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyChips: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  termsPressable: {
    paddingVertical: 6,
    marginTop: 4,
  },
  termsText: {
    textAlign: 'right',
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
});
