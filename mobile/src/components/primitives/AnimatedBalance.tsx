import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { Money } from './Money';
import { TypographyRole } from './AppText';

interface AnimatedBalanceProps {
  value: string | number;
  currency?: string;
  variant?: TypographyRole;
  size?: 'sm' | 'md' | 'lg';
  sign?: 'auto' | 'always' | 'none';
  tone?: 'primary' | 'secondary' | 'positive' | 'negative' | 'warning' | 'inverse';
  dimDecimals?: boolean;
  style?: ViewStyle;
}

/**
 * Editorial Animated Balance:
 * Provides a crisp, restrained fade-slide transition on value change
 * ensuring financial accuracy without distracting roulette spinning.
 */
export const AnimatedBalance: React.FC<AnimatedBalanceProps> = ({
  value,
  currency = 'EGP',
  variant,
  size,
  sign,
  tone,
  dimDecimals,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      // Quick subtle pulse
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0.35,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -3,
            duration: 80,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [value, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      <Money
        value={value}
        currency={currency}
        variant={variant}
        size={size}
        sign={sign}
        tone={tone}
        dimDecimals={dimDecimals}
      />
    </Animated.View>
  );
};
