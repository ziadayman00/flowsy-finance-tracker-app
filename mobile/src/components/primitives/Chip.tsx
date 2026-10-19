import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, style }) => {
  const { colors, radii } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: radii.sm,
          borderColor: selected ? colors.forest : colors.border,
          backgroundColor: selected ? colors.forest : colors.surface,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <AppText
        variant="caption"
        style={{
          color: selected ? colors.onAction : colors.textPrimary,
          fontWeight: selected ? '600' : '500',
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
