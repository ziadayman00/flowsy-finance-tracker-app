import React from 'react';
import { View, ViewStyle, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'surface' | 'sunken' | 'outline' | 'forest' | 'flush';
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'surface',
  onPress,
  style,
  padded = true,
}) => {
  const { colors, radii, spacing } = useTheme();

  const getBgColor = () => {
    switch (variant) {
      case 'forest':
        return colors.action;
      case 'sunken':
        return colors.sunken;
      case 'outline':
      case 'flush':
        return 'transparent';
      case 'surface':
      default:
        return colors.surface;
    }
  };

  const cardStyle: ViewStyle = {
    backgroundColor: getBgColor(),
    borderRadius: radii.md,
    borderWidth: variant === 'flush' ? 0 : StyleSheet.hairlineWidth,
    borderColor: variant === 'forest' ? colors.action : colors.border,
    padding: padded === false || variant === 'flush' ? 0 : spacing.lg,
    overflow: 'hidden',
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
