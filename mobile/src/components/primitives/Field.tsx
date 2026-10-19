import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';

interface FieldProps extends TextInputProps {
  label: string;
  helper?: string;
  error?: string;
  isLtr?: boolean;
  containerStyle?: ViewStyle;
  trailingIcon?: React.ReactNode;
  onTrailingPress?: () => void;
}

export const Field: React.FC<FieldProps> = ({
  label,
  helper,
  error,
  isLtr = false,
  containerStyle,
  trailingIcon,
  onTrailingPress,
  style,
  ...props
}) => {
  const { colors, radii, spacing, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderCol = error
    ? colors.negative
    : isFocused
    ? colors.action
    : colors.border;

  const inputStyle: TextStyle = {
    ...typography.body,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    textAlign: isLtr ? 'left' : 'right',
    writingDirection: isLtr ? 'ltr' : 'rtl',
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {/* Label above input */}
      <AppText variant="label" tone="secondary" style={styles.label}>
        {label}
      </AppText>

      {/* Input container */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderColor: borderCol,
            borderRadius: radii.sm,
            borderWidth: isFocused ? 1.5 : 1,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textDisabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[inputStyle, style]}
          {...props}
        />
        {trailingIcon && (
          <Pressable
            onPress={onTrailingPress}
            style={styles.trailingButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {trailingIcon}
          </Pressable>
        )}
      </View>

      {/* Error or Helper below */}
      {error ? (
        <AppText variant="caption" tone="negative" style={styles.caption}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" tone="secondary" style={styles.caption}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailingButton: {
    paddingHorizontal: 12,
  },
  caption: {
    marginTop: 4,
  },
});
