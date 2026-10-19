import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { Money } from './Money';

interface LedgerRowProps {
  title: string;
  categoryName?: string | null;
  categoryIcon?: string | null;
  accountName?: string | null;
  dateContext?: string | null;
  amount: string | number;
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  currency?: string;
  onPress?: () => void;
  hasBottomLine?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}

/**
 * Editorial Ledger Row (Ledger & Ink):
 * Distinctive financial journal entry with tabular amount zone,
 * restrained category glyph badge, and fine 1px bottom rule.
 */
export const LedgerRow: React.FC<LedgerRowProps> = ({
  title,
  categoryName,
  categoryIcon,
  accountName,
  dateContext,
  amount,
  type,
  currency = 'EGP',
  onPress,
  hasBottomLine = true,
  compact = false,
  style,
}) => {
  const { colors, spacing, radii } = useTheme();

  const isIncome = type === 'INCOME';
  const isTransfer = type === 'TRANSFER';

  // Category Icon resolver with sensible fallback
  const getIconName = (): IconName => {
    if (categoryIcon) return categoryIcon as IconName;
    if (isIncome) return 'arrow-down-circle-outline';
    if (isTransfer) return 'swap-horizontal-outline';
    return 'receipt-outline';
  };

  // Restrained glyph background
  const getBadgeBg = (): string => {
    if (isIncome) return colors.positiveSubtle;
    if (isTransfer) return colors.surfaceSubtle;
    return colors.sunken;
  };

  const getBadgeIconColor = (): string => {
    if (isIncome) return colors.positive;
    if (isTransfer) return colors.textSecondary;
    return colors.forest;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: compact ? spacing.sm + 2 : spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: hasBottomLine ? StyleSheet.hairlineWidth : 0,
          backgroundColor: pressed && onPress ? colors.sunken : 'transparent',
        },
        style,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {/* Category Glyph Badge */}
      <View
        style={[
          styles.badge,
          compact && { width: 28, height: 28, marginEnd: 10 },
          {
            backgroundColor: getBadgeBg(),
            borderRadius: compact ? radii.xs : radii.sm,
          },
        ]}
      >
        <Icon name={getIconName()} size={16} color={getBadgeIconColor()} />
      </View>

      {/* Main Info */}
      <View style={styles.textContainer}>
        <AppText variant={compact ? 'body' : 'bodyStrong'} numberOfLines={1} style={{ textAlign: 'right', fontWeight: compact ? '600' : undefined }}>
          {title}
        </AppText>
        <View style={styles.metaRow}>
          {categoryName && (
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.metaText}>
              {categoryName}
            </AppText>
          )}
          {categoryName && (accountName || dateContext) && (
            <AppText variant="caption" tone="disabled" style={{ marginHorizontal: 4 }}>
              •
            </AppText>
          )}
          {accountName && (
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.metaText}>
              {accountName}
            </AppText>
          )}
          {accountName && dateContext && (
            <AppText variant="caption" tone="disabled" style={{ marginHorizontal: 4 }}>
              •
            </AppText>
          )}
          {dateContext && (
            <AppText variant="caption" tone="disabled" numberOfLines={1} style={styles.metaText}>
              {dateContext}
            </AppText>
          )}
        </View>
      </View>

      {/* Tabular Amount Zone */}
      <View style={styles.amountZone}>
        <Money
          value={amount}
          currency={currency}
          variant={compact ? 'amountSm' : 'amountMd'}
          tone={isIncome ? 'positive' : isTransfer ? 'secondary' : 'negative'}
          sign={isIncome ? 'always' : isTransfer ? 'none' : 'auto'}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  badge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
  },
  textContainer: {
    flex: 1,
    marginEnd: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    minWidth: 0,
    overflow: 'hidden',
  },
  metaText: {
    flexShrink: 1,
  },
  amountZone: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
