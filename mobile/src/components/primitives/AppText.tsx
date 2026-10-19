import React from 'react';
import { Text, TextStyle, TextProps, StyleProp } from 'react-native';
import { useTheme } from '../../theme';
import { typography } from '../../theme/tokens';
import { toArabicDigits } from '../../utils/format';

export type TypographyRole = keyof typeof typography;

function localizeTextChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string' || typeof children === 'number') {
    return toArabicDigits(children);
  }
  if (Array.isArray(children)) return children.map(localizeTextChildren);
  if (React.isValidElement<{ children?: React.ReactNode }>(children) && children.props.children !== undefined) {
    return React.cloneElement(children, undefined, localizeTextChildren(children.props.children));
  }
  return children;
}
export type TextColorTone =
  | 'primary'
  | 'secondary'
  | 'disabled'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'brand'
  | 'info'
  | 'onAction'
  | 'inverse';

interface AppTextProps extends TextProps {
  variant?: TypographyRole;
  tone?: TextColorTone;
  align?: 'right' | 'left' | 'center';
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  tone = 'primary',
  align = 'right',
  style,
  children,
  ...props
}) => {
  const { colors } = useTheme();

  const getToneColor = (): string => {
    switch (tone) {
      case 'secondary':
        return colors.textSecondary;
      case 'disabled':
        return colors.textDisabled;
      case 'positive':
        return colors.positive;
      case 'negative':
        return colors.negative;
      case 'warning':
        return colors.warningText;
      case 'brand':
        return colors.brand;
      case 'info':
        return colors.info;
      case 'onAction':
        return colors.onAction;
      case 'inverse':
        return colors.textInverse;
      case 'primary':
      default:
        return colors.textPrimary;
    }
  };

  const typeStyle = typography[variant] || typography.body;

  const combinedStyle: TextStyle = {
    ...typeStyle,
    color: getToneColor(),
    textAlign: align,
  };

  return (
    <Text style={[combinedStyle, style]} {...props}>
      {localizeTextChildren(children)}
    </Text>
  );
};
