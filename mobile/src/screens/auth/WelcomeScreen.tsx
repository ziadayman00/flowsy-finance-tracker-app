import React from 'react';
import { View, StyleSheet, Image, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/primitives/Screen';
import { AppText } from '../../components/primitives/AppText';
import { Button } from '../../components/primitives/Button';
import { Card } from '../../components/primitives/Card';
import { Icon } from '../../components/primitives/Icon';
import { SplitLine } from '../../components/primitives/SplitLine';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';

interface WelcomeScreenProps {
  onStartRegister: () => void;
  onGoToLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartRegister,
  onGoToLogin,
}) => {
  const { spacing, colors, radii } = useTheme();

  return (
    <Screen contentContainerStyle={[styles.container, { paddingHorizontal: spacing.xl }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Brand Row with Official Logo */}
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoWrapper,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
              },
            ]}
          >
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={{ gap: 2 }}>
            <AppText variant="title2" style={{ fontWeight: '700', color: colors.textPrimary }}>
              {strings.appName}
            </AppText>
            <AppText variant="caption" tone="secondary">
              دفتر الإدارة المالية الذكي
            </AppText>
          </View>
        </View>

        {/* Hero Typography */}
        <View style={styles.heroSection}>
          <AppText variant="display" style={styles.headline}>
            {strings.auth.welcomeHeadline}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.subtitle}>
            {strings.auth.welcomeTagline}
          </AppText>
        </View>

        {/* Signature Financial Clarity Card (Real UI Primitives) */}
        <View
          style={[
            styles.clarityCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
              padding: spacing.lg,
            },
          ]}
        >
          {/* Header of card */}
          <View style={styles.cardHeader}>
            <View style={{ gap: 2 }}>
              <AppText variant="caption" tone="secondary">
                {strings.auth.safeToSpendPillar}
              </AppText>
              <AppText variant="title1" style={{ color: colors.textPrimary }}>
                تقدر تصرف كام اليوم؟
              </AppText>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.positiveSubtle, borderRadius: radii.sm }]}>
              <AppText variant="caption" tone="positive" style={{ fontWeight: '700' }}>
                دقيق ومحسوب
              </AppText>
            </View>
          </View>

          {/* Precision Financial Meter */}
          <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
            <SplitLine
              availableRatio={0.65}
              committedRatio={0.35}
              isDeficit={false}
              height={10}
            />
          </View>

          {/* Breakdown Equation */}
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <View style={styles.legendDotContainer}>
                <View style={[styles.dot, { backgroundColor: colors.forest }]} />
                <AppText variant="caption" tone="secondary">السيولة الكلية</AppText>
              </View>
              <AppText variant="bodyStrong">الحسابات النقدية والبنكية</AppText>
            </View>

            <AppText variant="title2" tone="secondary" style={{ paddingHorizontal: 4 }}>
              −
            </AppText>

            <View style={styles.breakdownItem}>
              <View style={styles.legendDotContainer}>
                <View style={[styles.dot, { backgroundColor: colors.gold }]} />
                <AppText variant="caption" tone="secondary">التزامات الشهر</AppText>
              </View>
              <AppText variant="bodyStrong">فواتير وإيجار وأقساط</AppText>
            </View>
          </View>
        </View>

        {/* 3 Value Pillars */}
        <View style={styles.pillarsContainer}>
          {/* Pillar 1 */}
          <View style={styles.pillarRow}>
            <View style={[styles.pillarIcon, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
              <Icon name="calculator-outline" size={20} color={colors.forest} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{strings.auth.safeToSpendPillar}</AppText>
              <AppText variant="caption" tone="secondary">
                {strings.auth.safeToSpendDesc}
              </AppText>
            </View>
          </View>

          {/* Pillar 2 */}
          <View style={styles.pillarRow}>
            <View style={[styles.pillarIcon, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
              <Icon name="shield-checkmark-outline" size={20} color={colors.forest} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{strings.auth.privacyPillar}</AppText>
              <AppText variant="caption" tone="secondary">
                {strings.auth.privacyDesc}
              </AppText>
            </View>
          </View>

          {/* Pillar 3 */}
          <View style={styles.pillarRow}>
            <View style={[styles.pillarIcon, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
              <Icon name="globe-outline" size={20} color={colors.forest} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{strings.auth.gulfEgyptPillar}</AppText>
              <AppText variant="caption" tone="secondary">
                {strings.auth.gulfEgyptDesc}
              </AppText>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Fixed Bottom Action Section */}
      <View style={[styles.bottomSection, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
        <Button
          title={strings.auth.getStarted}
          variant="primary"
          onPress={() => {
            haptics.impactLight();
            onStartRegister();
          }}
          style={{ width: '100%', marginBottom: spacing.sm }}
        />
        <Button
          title={strings.auth.haveAccount}
          variant="secondary"
          onPress={() => {
            haptics.impactLight();
            onGoToLogin();
          }}
          style={{ width: '100%' }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  logoWrapper: {
    width: 48,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 38,
    height: 38,
  },
  heroSection: {
    marginBottom: 24,
    gap: 8,
  },
  headline: {
    textAlign: 'right',
    lineHeight: 46,
    fontSize: 34,
  },
  subtitle: {
    textAlign: 'right',
    lineHeight: 24,
    fontSize: 16,
  },
  clarityCard: {
    borderWidth: 1,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    flex: 1,
    gap: 4,
  },
  legendDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillarsContainer: {
    gap: 16,
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pillarIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
