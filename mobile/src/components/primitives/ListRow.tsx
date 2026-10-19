import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

interface ListRowProps {
  title: string;
  subtitle?: string | null;
  iconName?: IconName;
  iconColor?: string;
  iconTileColor?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  style?: ViewStyle;
}

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  iconName,
  iconColor,
  iconTileColor,
  trailing,
  onPress,
  showChevron = false,
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: spacing.xl,
          backgroundColor: pressed && onPress ? colors.sunken : 'transparent',
        },
        style,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {/* Leading Icon Tile */}
      {iconName && (
        <View
          style={[
            styles.iconTile,
            {
              borderRadius: radii.sm,
              backgroundColor: iconTileColor || colors.sunken,
            },
          ]}
        >
          <Icon name={iconName} size={20} color={iconColor || colors.textPrimary} />
        </View>
      )}

      {/* Main Content (Title + Subtitle) */}
      <View style={styles.content}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {/* Trailing Slot (Money / Button / Status) */}
      {trailing && <View style={styles.trailing}>{trailing}</View>}

      {/* Optional Chevron */}
      {showChevron && (
        <Icon
          name="chevron-forward"
          size={16}
          color={colors.textDisabled}
          mirror
          style={{ marginStart: 4 }}
        />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  iconTile: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  trailing: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
