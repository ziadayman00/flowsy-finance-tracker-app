import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/primitives/Screen';
import { AppText } from '../../components/primitives/AppText';
import { Button } from '../../components/primitives/Button';
import { Blotter } from '../../components/primitives/Blotter';
import { strings } from '../../utils/strings.ar';

interface WelcomeScreenProps {
  onStartRegister: () => void;
  onGoToLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartRegister,
  onGoToLogin,
}) => {
  const { spacing, colors } = useTheme();

  return (
    <Screen contentContainerStyle={[styles.container, { padding: spacing.xl }]}>
      <View style={styles.topSection}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <AppText variant="title3" style={{ color: colors.action, fontWeight: '700' }}>
            {strings.appName}
          </AppText>
        </View>

        <AppText variant="display" style={styles.headline}>
          {strings.home.safeToSpendQuestion}
        </AppText>

        <AppText variant="body" tone="secondary" style={styles.tagline}>
          {strings.tagline}
        </AppText>

        <Blotter style={{ marginTop: 28 }}>
          <AppText variant="micro" style={{ color: colors.stampMuted, marginBottom: 8 }}>
            المتاح للصرف بأمان
          </AppText>
          <AppText variant="title1" style={{ color: colors.stampOn }}>
            اعرف الرقم قبل ما تصرف
          </AppText>
          <AppText variant="caption" style={{ color: colors.stampMuted, marginTop: 8 }}>
            السيولة ناقص التزامات الشهر — من غير تخمين.
          </AppText>
        </Blotter>
      </View>

      <View style={styles.bottomSection}>
        <Button
          title="ابدأ الآن"
          variant="primary"
          onPress={onStartRegister}
          style={{ width: '100%', marginBottom: spacing.sm }}
        />
        <Button
          title="عندي حساب بالفعل"
          variant="text"
          onPress={onGoToLogin}
          style={{ width: '100%' }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  topSection: {
    marginTop: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  headline: {
    marginBottom: 12,
    textAlign: 'right',
  },
  tagline: {
    textAlign: 'right',
    lineHeight: 26,
  },
  bottomSection: {
    width: '100%',
    paddingBottom: 16,
  },
});
