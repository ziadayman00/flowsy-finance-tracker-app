import React from 'react';
import { View, Text, TextStyle, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { formatMoneyParts } from '../../utils/format';
import { TypographyRole } from './AppText';
import { typography } from '../../theme/tokens';

interface MoneyProps {
  value: string | number;
  currency?: string;
  variant?: TypographyRole;
  size?: 'sm' | 'md' | 'lg';
  sign?: 'auto' | 'always' | 'none';
  tone?: 'primary' | 'secondary' | 'positive' | 'negative' | 'warning' | 'inverse';
  dimDecimals?: boolean;
  style?: ViewStyle;
}

export const Money: React.FC<MoneyProps> = ({
  value,
  currency = 'EGP',
  variant,
  size,
  sign = 'auto',
  tone,
  dimDecimals = false,
  style,
}) => {
  const { colors } = useTheme();

  const resolvedVariant =
    variant ?? (size === 'lg' ? 'amountLg' : 'amountMd');
  const parts = formatMoneyParts(value, currency, { sign });
  const typeStyle = typography[resolvedVariant] || typography.amountMd;

  const getColor = (): string => {
    if (tone) {
      switch (tone) {
        case 'positive':
          return colors.positive;
        case 'negative':
          return colors.negative;
        case 'warning':
          return colors.warningText;
        case 'secondary':
          return colors.textSecondary;
        case 'inverse':
          return colors.stampOn;
        case 'primary':
        default:
          return colors.textPrimary;
      }
    }
    return parts.isNegative ? colors.negative : colors.textPrimary;
  };

  const textColor = getColor();
  const mutedColor =
    tone === 'inverse' ? colors.stampMuted : colors.textSecondary;

  const numStyle: TextStyle = {
    ...typeStyle,
    color: textColor,
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  };

  const decStyle: TextStyle = dimDecimals
    ? {
        fontSize: Math.round(typeStyle.fontSize * 0.62),
        lineHeight: typeStyle.lineHeight,
        color: mutedColor,
        fontVariant: ['tabular-nums'],
        writingDirection: 'ltr',
      }
    : numStyle;

  const symbolStyle: TextStyle = {
    fontSize: Math.round(typeStyle.fontSize * 0.48),
    lineHeight: typeStyle.lineHeight,
    color: mutedColor,
    marginStart: 6,
    fontWeight: '600',
  };

  const accessibilityLabel = `${parts.isNegative ? 'خصم ' : ''}${parts.whole} جنيه و${parts.fraction} قرش`;

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.numberRow}>
        <Text style={numStyle}>
          {parts.sign}
          {parts.whole}
        </Text>
        <Text style={decStyle}>٫{parts.fraction}</Text>
      </View>
      <Text style={symbolStyle}>{parts.currencySymbol}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
  },
  numberRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'baseline',
  },
});
