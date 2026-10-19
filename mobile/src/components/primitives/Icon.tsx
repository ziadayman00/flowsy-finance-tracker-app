import React from 'react';
import { I18nManager, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  mirror?: boolean;
  isRTLMirrored?: boolean;
  style?: ViewStyle;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color,
  mirror = false,
  isRTLMirrored,
  style,
}) => {
  const { colors } = useTheme();
  const iconColor = color || colors.textPrimary;

  // In RTL, mirror directional icons (chevrons, forward/back, arrows)
  const shouldMirror = isRTLMirrored ?? mirror;
  const shouldFlip = shouldMirror && I18nManager.isRTL;

  return (
    <View style={[shouldFlip && { transform: [{ scaleX: -1 }] }, style]}>
      <Ionicons name={name as any} size={size} color={iconColor} />
    </View>
  );
};
