import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

interface ScreenHeaderProps {
  kicker?: string;
  title: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  kicker,
  title,
  onBack,
  trailing,
}) => {
  const { colors, spacing, radii } = useTheme();

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.lg }]}>
      <View style={styles.leading}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={[styles.backBtn, { backgroundColor: colors.sunken, borderRadius: radii.md }]}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <Icon name="arrow-back" size={22} color={colors.textPrimary} isRTLMirrored />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          {kicker ? (
            <AppText variant="caption" tone="secondary">
              {kicker}
            </AppText>
          ) : null}
          <AppText variant="title2" numberOfLines={1}>
            {title}
          </AppText>
        </View>
      </View>
      {trailing ?? <View style={{ width: 36 }} />}
    </View>
  );
};

export const HeaderIconButton: React.FC<{
  icon: IconName;
  onPress: () => void;
  filled?: boolean;
  accessibilityLabel?: string;
}> = ({ icon, onPress, filled, accessibilityLabel }) => {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconBtn,
        {
          backgroundColor: filled ? colors.action : colors.sunken,
          borderColor: filled ? colors.action : colors.border,
          borderRadius: radii.md,
        },
      ]}
    >
      <Icon name={icon} size={18} color={filled ? colors.onAction : colors.textPrimary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
