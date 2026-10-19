import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { strings } from '../../utils/strings.ar';

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  message: string;
  actionTitle?: string;
  onAction?: () => void;
  iconName?: IconName;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  actionTitle,
  onAction,
  iconName,
  style,
}) => {
  const { spacing, colors } = useTheme();

  return (
    <View style={[styles.centerContainer, style]}>
      {iconName && (
        <Icon
          name={iconName}
          size={32}
          color={colors.textDisabled}
          style={{ marginBottom: spacing.md }}
        />
      )}
      <AppText variant="body" tone="secondary" style={styles.centerText}>
        {message}
      </AppText>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          variant="secondary"
          onPress={onAction}
          style={{ marginTop: spacing.md }}
        />
      )}
    </View>
  );
};

// ─── Error State ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  correlationId?: string;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  onRetry,
  correlationId,
  style,
}) => {
  const { spacing, colors } = useTheme();

  return (
    <View style={[styles.centerContainer, style]}>
      <Icon
        name="alert-circle-outline"
        size={36}
        color={colors.negative}
        style={{ marginBottom: spacing.md }}
      />
      {title && (
        <AppText variant="heading" tone="negative" style={styles.centerText}>
          {title}
        </AppText>
      )}
      <AppText
        variant="body"
        tone="secondary"
        style={[styles.centerText, { marginTop: 4, marginBottom: spacing.lg }]}
      >
        {message}
      </AppText>
      {correlationId && (
        <AppText
          variant="caption"
          tone="disabled"
          style={[styles.centerText, { marginBottom: spacing.md }]}
        >
          رمز الخطأ: {correlationId.slice(0, 8)}
        </AppText>
      )}
      {onRetry && (
        <Button
          title={strings.common.retry}
          variant="secondary"
          onPress={onRetry}
        />
      )}
    </View>
  );
};

// ─── Offline Notice Banner ───────────────────────────────────────────────────

export const OfflineNotice: React.FC<{ style?: ViewStyle }> = ({ style }) => {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.offlineBar,
        {
          backgroundColor: colors.warningSubtle,
          borderColor: colors.border,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
    >
      <Icon name="cloud-offline-outline" size={16} color={colors.warningText} />
      <AppText variant="caption" tone="warning" style={{ marginStart: 6 }}>
        {strings.common.offlineNotice}
      </AppText>
    </View>
  );
};

// ─── Skeleton Pulse Block ────────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  radius,
  style,
}) => {
  const { colors, radii } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius !== undefined ? radius : radii.xs,
          backgroundColor: colors.sunken,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
