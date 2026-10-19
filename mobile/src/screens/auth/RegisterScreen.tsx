import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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

interface RegisterScreenProps {
  onRegisterSuccess: () => void;
  onGoToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onRegisterSuccess,
  onGoToLogin,
}) => {
  const { spacing, colors } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!displayName.trim() || displayName.trim().length < 2) {
      errs.displayName = 'الاسم يجب أن يكون حرفين على الأقل';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errs.email = 'يرجى إدخال بريد إلكتروني صحيح';
    }

    if (password.length < 8) {
      errs.password = 'كلمة السر يجب أن تكون 8 حروف على الأقل';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    setGlobalError(null);

    try {
      await register(email, password, displayName);
      onRegisterSuccess();
    } catch (err: unknown) {
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

  return (
    <Screen scroll contentContainerStyle={[styles.container, { padding: spacing.xl }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onGoToLogin}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="العودة لتسجيل الدخول"
        >
          <Icon name="arrow-back" size={24} mirror />
        </Pressable>
      </View>

      <AppText variant="caption" tone="secondary">
        Flowsy
      </AppText>
      <AppText variant="title1" style={styles.title}>
        إنشاء حساب جديد
      </AppText>
      <AppText variant="body" tone="secondary" style={styles.subtitle}>
        سجّل بياناتك لبدء متابعة أموالك والتزاماتك الشهرية.
      </AppText>

      {globalError && (
        <View style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle }]}>
          <AppText variant="caption" tone="negative">
            {globalError}
          </AppText>
        </View>
      )}

      <Field
        label={strings.common.nameField}
        placeholder="زياد أيمن"
        value={displayName}
        onChangeText={(val) => {
          setDisplayName(val);
          setFieldErrors((prev) => ({ ...prev, displayName: '' }));
        }}
        error={fieldErrors.displayName}
      />

      <Field
        label={strings.common.emailField}
        placeholder="user@example.com"
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

      <Field
        label={strings.common.passwordField}
        placeholder="••••••••"
        value={password}
        onChangeText={(val) => {
          setPassword(val);
          setFieldErrors((prev) => ({ ...prev, password: '' }));
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        isLtr
        helper="8 حروف على الأقل"
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

      <Button
        title="إنشاء الحساب"
        onPress={handleRegister}
        loading={loading}
        style={{ marginTop: spacing.md }}
      />

      <View style={styles.footerRow}>
        <AppText variant="body" tone="secondary">
          عندك حساب؟
        </AppText>
        <Pressable onPress={onGoToLogin} style={{ marginStart: 6 }}>
          <AppText variant="bodyStrong" tone="primary" style={{ textDecorationLine: 'underline' }}>
            سجّل دخولك
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
