import React, { useState } from 'react';
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

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onGoToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onGoToRegister,
}) => {
  const { spacing, colors } = useTheme();

  const [email, setEmail] = useState('demo@flowsy.app');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('يرجى كتابة الإيميل وكلمة السر');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const mapped = mapBackendError(
          err.statusCode,
          err.error,
          err.rawResponse?.message || err.message,
        );
        setErrorMessage(mapped.message);
      } else {
        setErrorMessage('تعذر تسجيل الدخول — تأكد من الاتصال وحاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={[styles.container, { padding: spacing.xl }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onGoToRegister}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="العودة لإنشاء حساب"
        >
          <Icon name="arrow-back" size={24} mirror />
        </Pressable>
      </View>

      <AppText variant="caption" tone="secondary">
        Flowsy
      </AppText>
      <AppText variant="title1" style={styles.title}>
        تسجيل الدخول
      </AppText>
      <AppText variant="body" tone="secondary" style={styles.subtitle}>
        أهلاً بك مجدداً. ادخل عشان تشوف المتاح للصرف.
      </AppText>

      {errorMessage && (
        <View style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle }]}>
          <AppText variant="caption" tone="negative">
            {errorMessage}
          </AppText>
        </View>
      )}

      <Field
        label={strings.common.emailField}
        placeholder="user@example.com"
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

      <Field
        label={strings.common.passwordField}
        placeholder="••••••••"
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

      <Button
        title="دخول"
        onPress={handleLogin}
        loading={loading}
        style={{ marginTop: spacing.md }}
      />

      <View style={styles.footerRow}>
        <AppText variant="body" tone="secondary">
          ليس لديك حساب بعد؟
        </AppText>
        <Pressable onPress={onGoToRegister} style={{ marginStart: 6 }}>
          <AppText variant="bodyStrong" tone="primary" style={{ textDecorationLine: 'underline' }}>
            أنشئ حساباً جديداً
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
  },
  topBar: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  backBtn: {
    padding: 8,
  },
  title: {
    marginBottom: 8,
    textAlign: 'right',
  },
  subtitle: {
    marginBottom: 24,
    textAlign: 'right',
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
});
