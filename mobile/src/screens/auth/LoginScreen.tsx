import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/primitives/Screen';
import { AppText } from '../../components/primitives/AppText';
import { Field } from '../../components/primitives/Field';
import { Button } from '../../components/primitives/Button';
import { Icon } from '../../components/primitives/Icon';
import { login } from '../../api/auth';
import { mapBackendError } from '../../utils/errors';
import { ApiError } from '../../api/client';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { PasswordRecoverySheet } from './PasswordRecoverySheet';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onGoToRegister: () => void;
  onBack?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onGoToRegister,
  onBack,
}) => {
  const { spacing, colors, radii } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryVisible, setRecoveryVisible] = useState(false);

  const isFormValid = useMemo(() => {
    return email.trim().length > 3 && email.includes('@') && password.length > 0;
  }, [email, password]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('يرجى كتابة البريد الإلكتروني وكلمة السر');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(email, password);
      haptics.notificationSuccess();
      onLoginSuccess();
    } catch (err: unknown) {
      haptics.notificationError();
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setErrorMessage('البريد الإلكتروني أو كلمة السر غير صحيحة.');
        } else if (err.statusCode === 429) {
          setErrorMessage('محاولات متكررة — يرجى الانتظار دقيقة واحدة ثم المحاولة مجدداً.');
        } else {
          const mapped = mapBackendError(
            err.statusCode,
            err.error,
            err.rawResponse?.message || err.message,
          );
          setErrorMessage(mapped.message);
        }
      } else {
        setErrorMessage('تعذر تسجيل الدخول — تأكد من الاتصال بالإنترنت وحاول مرة أخرى.');
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
      onGoToRegister();
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
        <View style={{ marginBottom: spacing.xl }}>
          <AppText variant="title1" style={styles.title}>
            {strings.auth.loginTitle}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.subtitle}>
            {strings.auth.loginSubtitle}
          </AppText>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle, borderRadius: radii.sm, borderColor: colors.negative }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.negative} />
            <AppText variant="caption" tone="negative" style={{ flex: 1, marginStart: 8 }}>
              {errorMessage}
            </AppText>
          </View>
        )}

        {/* Email Field */}
        <Field
          label={strings.auth.email}
          placeholder={strings.auth.emailPlaceholder}
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            setErrorMessage(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          isLtr
        />

        {/* Password Field */}
        <Field
          label={strings.auth.password}
          placeholder={strings.auth.passwordPlaceholder}
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            setErrorMessage(null);
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          isLtr
          trailingIcon={
            <Icon
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          }
          onTrailingPress={() => setShowPassword(!showPassword)}
        />

        {/* Forgot Password Row */}
        <View style={styles.forgotPasswordRow}>
          <Pressable
            onPress={() => {
              haptics.impactLight();
              setRecoveryVisible(true);
            }}
            hitSlop={8}
          >
            <AppText variant="caption" tone="primary" style={{ fontWeight: '600' }}>
              {strings.auth.forgotPassword}
            </AppText>
          </Pressable>
        </View>

        {/* Submit Button */}
        <Button
          title={strings.auth.loginBtn}
          onPress={handleLogin}
          loading={loading}
          disabled={!isFormValid || loading}
          style={{ marginTop: spacing.md }}
        />

        {/* Footer switch to register */}
        <View style={styles.footerRow}>
          <AppText variant="body" tone="secondary">
            {strings.auth.dontHaveAccount}
          </AppText>
          <Pressable
            onPress={() => {
              haptics.impactLight();
              onGoToRegister();
            }}
            style={{ marginStart: 6 }}
          >
            <AppText variant="bodyStrong" tone="primary" style={{ textDecorationLine: 'underline' }}>
              {strings.auth.goToRegister}
            </AppText>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </Screen>

      <PasswordRecoverySheet
        visible={recoveryVisible}
        onClose={() => setRecoveryVisible(false)}
      />
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
    marginBottom: 24,
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
  forgotPasswordRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: -4,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
});
