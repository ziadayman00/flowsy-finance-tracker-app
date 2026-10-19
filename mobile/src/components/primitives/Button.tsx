import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const { colors, radii, spacing } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      minHeight: 50,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    };

    if (disabled) {
      if (variant === 'primary') {
        return { ...base, backgroundColor: colors.actionDisabled };
      }
      return { ...base, opacity: 0.5 };
    }

    switch (variant) {
      case 'secondary':
        return {
          ...base,
          backgroundColor: colors.sunken,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        };
      case 'ghost':
        return {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        };
      case 'text':
        return {
          ...base,
          backgroundColor: 'transparent',
          minHeight: 40,
          paddingHorizontal: spacing.sm,
        };
      case 'destructive':
        return {
          ...base,
          backgroundColor: colors.negativeSubtle,
        };
      case 'primary':
      default:
        return {
          ...base,
          backgroundColor: colors.action,
        };
    }
  };

  const getTextColorTone = (): 'primary' | 'secondary' | 'onAction' | 'negative' | 'disabled' => {
    if (disabled) return 'disabled';
    switch (variant) {
      case 'secondary':
      case 'ghost':
        return 'primary';
      case 'text':
        return 'secondary';
      case 'destructive':
        return 'negative';
      case 'primary':
      default:
        return 'onAction';
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[getContainerStyle(), style]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? colors.onAction : colors.action}
          />
        ) : (
          <>
            {icon}
            <AppText
              variant="bodyStrong"
              tone={getTextColorTone()}
              align="center"
              style={[{ textAlign: 'center' }, textStyle]}
            >
              {title}
            </AppText>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};
