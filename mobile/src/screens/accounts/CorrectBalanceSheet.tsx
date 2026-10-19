import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Button,
  Divider,
} from '../../components/primitives';
import { AccountResponseDto } from '../../api/types';
import { transactionsApi } from '../../api/transactions';
import { toCents, fromCents, moneySubtract, moneyCompare } from '../../utils/money';
import { formatMoney, normalizeAmountInput, toArabicNumberSeparators } from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface CorrectBalanceSheetProps {
  visible: boolean;
  onClose: () => void;
  account: AccountResponseDto | null;
  onSuccess?: () => void;
}

export const CorrectBalanceSheet: React.FC<CorrectBalanceSheetProps> = ({
  visible,
  onClose,
  account,
  onSuccess,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [actualBalanceInput, setActualBalanceInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute diff: actualInput - currentBalance
  const diffInfo = useMemo(() => {
    if (!account || !actualBalanceInput.trim()) return null;

    try {
      const inputCents = toCents(actualBalanceInput);
      const currentCents = toCents(account.currentBalance);
      const diffCents = inputCents - currentCents;

      if (diffCents === 0n) {
        return { isZero: true, diffStr: '0.00', isPositive: false };
      }

      const isPositive = diffCents > 0n;
      const absCents = isPositive ? diffCents : -diffCents;
      return {
        isZero: false,
        diffStr: fromCents(absCents),
        isPositive,
      };
    } catch {
      return null;
    }
  }, [account, actualBalanceInput]);

  const handleSubmit = async () => {
    if (!account || !diffInfo || diffInfo.isZero || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const type = diffInfo.isPositive ? 'INCOME' : 'EXPENSE';
      const amountVal = parseFloat(diffInfo.diffStr);

      await transactionsApi.createTransaction({
        type,
        amount: amountVal,
        accountId: account.id,
        note: 'تعديل رصيد',
        transactionDate: new Date().toISOString(),
      });

      haptics.notificationSuccess();
      showToast('تم تصحيح الرصيد بنجاح');
      onSuccess?.();
      onClose();
    } catch (err) {
      haptics.notificationError();
      setErrorMessage(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!account) return null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={strings.accounts.correctBalanceTitle}
      footer={
        <Button
          title={strings.accounts.saveCorrection}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!diffInfo || diffInfo.isZero || submitting}
        />
      }
    >
      <View style={{ paddingBottom: 16 }}>
        <AppText variant="body" tone="secondary" style={{ marginBottom: spacing.md }}>
          {strings.accounts.correctBalanceExplanation}
        </AppText>

        {/* Current balance card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
              borderRadius: radii.md,
              padding: spacing.md,
            },
          ]}
        >
          <AppText variant="caption" tone="secondary">
            {strings.accounts.currentBalance}
          </AppText>
          <AppText variant="title3" style={{ writingDirection: 'ltr', marginTop: 4 }}>
            {formatMoney(account.currentBalance, account.currency)}
          </AppText>
        </View>

        {/* Actual balance field */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            {strings.accounts.actualBalanceNow}
          </AppText>
          <TextInput
            value={toArabicNumberSeparators(actualBalanceInput)}
            onChangeText={(value) => setActualBalanceInput(normalizeAmountInput(value))}
            placeholder="٠٫٠٠"
            keyboardType="decimal-pad"
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>

        {/* Computed difference */}
        {diffInfo && (
          <View style={{ marginTop: spacing.md }}>
            <AppText
              variant="bodyStrong"
              tone={diffInfo.isZero ? 'secondary' : diffInfo.isPositive ? 'positive' : 'negative'}
              style={{ writingDirection: 'ltr' }}
            >
              {diffInfo.isZero
                ? 'لا يوجد فرق في الرصيد'
                : `${strings.accounts.difference.replace(
                    '{diff}',
                    `${diffInfo.isPositive ? '+' : '−'}${diffInfo.diffStr} ${account.currency}`
                  )}`}
            </AppText>

            <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              {strings.accounts.correctionNotice}
            </AppText>
          </View>
        )}

        {errorMessage && (
          <AppText variant="caption" tone="negative" style={{ marginTop: 8 }}>
            {errorMessage}
          </AppText>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  infoCard: {
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'left',
  },
});
