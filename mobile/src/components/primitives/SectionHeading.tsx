import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

interface SectionHeadingProps {
  title: string;
  actionTitle?: string;
  onAction?: () => void;
  withLine?: boolean;
  style?: ViewStyle;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  actionTitle,
  onAction,
  withLine = false,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.container, { marginBottom: spacing.sm, marginTop: spacing.lg }, style]}>
      <View style={styles.textRow}>
        <AppText variant="sectionHeading" tone="primary" style={styles.titleText}>
          {title}
        </AppText>

        {withLine && (
          <View
            style={[
              styles.hairline,
              { backgroundColor: colors.border, marginHorizontal: spacing.sm },
            ]}
          />
        )}

        {actionTitle && onAction && (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            style={styles.actionPressable}
            accessibilityRole="button"
          >
            <AppText variant="caption" tone="brand" style={{ fontWeight: '600' }}>
              {actionTitle}
            </AppText>
            <Icon name="chevron-back" size={12} color={colors.action} mirror style={{ marginEnd: 2 }} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    flexShrink: 1,
  },
  hairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  actionPressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
