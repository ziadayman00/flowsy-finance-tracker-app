import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface DividerProps {
  style?: ViewStyle;
  inset?: boolean;
}

export const Divider: React.FC<DividerProps> = ({ style, inset = true }) => {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginHorizontal: inset ? spacing.xl : 0,
        },
        style,
      ]}
    />
  );
};
