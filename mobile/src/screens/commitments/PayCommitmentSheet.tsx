import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  Divider,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { commitmentsApi } from '../../api/commitments';
import { AccountResponseDto, CommitmentResponseDto } from '../../api/types';
import { toCents, fromCents, moneySubtract, moneyCompare } from '../../utils/money';
import { formatMoney } from '../../utils/format';
import { displayName } from '../../utils/names';
import { buildPayCommitmentPayload } from '../../utils/payloads';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface PayCommitmentSheetProps {
  visible: boolean;
  onClose: () => void;
  commitment: CommitmentResponseDto | null;
  onSuccess?: () => void;
}

export const PayCommitmentSheet: React.FC<PayCommitmentSheetProps> = ({
  visible,
  onClose,
  commitment,
  onSuccess,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && commitment) {
      setErrorMessage(null);
      setNote('');
      loadAccounts();
    }
  }, [visible, commitment]);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const accs = await accountsApi.getAccounts();
      const active = accs.filter((a) => !a.isArchived);
      setAccounts(active);

      if (commitment) {
        // Preferred account: commitment's linked account if matching currency, else first matching currency account
        const matchingLinked = active.find(
          (a) => a.id === commitment.accountId && a.currency === commitment.currency
        );
        if (matchingLinked) {
          setSelectedAccountId(matchingLinked.id);
        } else {
          const firstSameCurrency = active.find((a) => a.currency === commitment.currency);
          if (firstSameCurrency) {
            setSelectedAccountId(firstSameCurrency.id);
          }
        }
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoadingAccounts(false);
    }
  };

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Derived balance calculation: balanceNow - amount
  const balanceMath = useMemo(() => {
    if (!selectedAccount || !commitment) return null;

    try {
      const after = moneySubtract(selectedAccount.currentBalance, commitment.amount);
      const isNegative = moneyCompare(after, '0.00') < 0;

      return {
        balanceNow: formatMoney(selectedAccount.currentBalance, selectedAccount.currency),
        balanceAfter: formatMoney(after, selectedAccount.currency),
        isNegative,
      };
    } catch {
      return null;
    }
  }, [selectedAccount, commitment]);

  const handlePay = async () => {
    if (!commitment || !selectedAccountId || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = buildPayCommitmentPayload({
        accountId: selectedAccountId,
        paidAt: new Date().toISOString(),
        note: note.trim() || undefined,
      });

      const res = await commitmentsApi.payCommitment(commitment.id, payload as any);

      haptics.notificationSuccess();
      showToast(strings.plan.paidToast);

      onSuccess?.();
      onClose();
    } catch (err) {
      haptics.notificationError();
      const msg = getErrorMessage(err);
      if (msg.includes('already') || msg.includes('مسدّد')) {
        setErrorMessage('الالتزام ده اتسدّد قبل كده');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!commitment) return null;

  const formattedAmount = formatMoney(commitment.amount, commitment.currency);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={strings.plan.payCommitmentTitle}
      footer={
        <Button
          title={strings.plan.payConfirmAction.replace('{amount}', formattedAmount)}
          onPress={handlePay}
          loading={submitting}
          disabled={!selectedAccountId || submitting}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Commitment Name & Read-Only Amount */}
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.md,
              padding: spacing.md,
            },
          ]}
        >
          <AppText variant="caption" tone="secondary">
            اسم الالتزام
          </AppText>
          <AppText variant="title2" style={{ marginTop: 2 }}>
            {commitment.name}
          </AppText>

          <View style={styles.amountLine}>
            <AppText variant="amountLg" tone="primary" style={{ writingDirection: 'ltr' }}>
              {formattedAmount}
            </AppText>
          </View>
        </View>

        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.negativeMuted,
                borderRadius: radii.sm,
                borderColor: colors.negative,
              },
            ]}
          >
            <Icon name="alert-circle-outline" size={18} color={colors.negative} />
            <AppText
              variant="body"
              tone="negative"
              style={{ flex: 1, marginStart: 8 }}
            >
              {errorMessage}
            </AppText>
          </View>
        )}

        {/* Account Selection */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
            السداد من حساب:
          </AppText>

          {loadingAccounts ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            accounts.map((acc) => {
              const isSameCurrency = acc.currency === commitment.currency;
              const isSelected = acc.id === selectedAccountId;

              return (
                <Pressable
                  key={acc.id}
                  disabled={!isSameCurrency}
                  onPress={() => setSelectedAccountId(acc.id)}
                  style={[
                    styles.accountRow,
                    {
                      backgroundColor: isSelected
                        ? colors.surfaceSubtle
                        : colors.surface,
                      borderColor: isSelected ? colors.brand : colors.border,
                      borderRadius: radii.md,
                      opacity: isSameCurrency ? 1 : 0.45,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">
                      {displayName(acc.name)}
                    </AppText>
                    <AppText
                      variant="caption"
                      tone="secondary"
                      style={{ writingDirection: 'ltr' }}
                    >
                      {isSameCurrency
                        ? formatMoney(acc.currentBalance, acc.currency)
                        : 'العملة مختلفة (لا يمكن السداد منه)'}
                    </AppText>
                  </View>

                  {isSelected && (
                    <Icon name="checkmark-circle" size={20} color={colors.brand} />
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Balance Impact Derivation */}
        {balanceMath && (
          <View
            style={[
              styles.balanceImpactCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
              },
            ]}
          >
            <View style={styles.impactLine}>
              <AppText variant="caption" tone="secondary">
                الرصيد دلوقتي
              </AppText>
              <AppText variant="body" style={{ writingDirection: 'ltr' }}>
                {balanceMath.balanceNow}
              </AppText>
            </View>

            <Divider style={{ marginVertical: 6 }} />

            <View style={styles.impactLine}>
              <AppText variant="caption" tone="secondary">
                بعد السداد
              </AppText>
              <AppText
                variant="bodyStrong"
                tone={balanceMath.isNegative ? 'negative' : 'primary'}
                style={{ writingDirection: 'ltr' }}
              >
                {balanceMath.balanceAfter}
              </AppText>
            </View>

            {balanceMath.isNegative && (
              <AppText
                variant="caption"
                tone="negative"
                style={{ marginTop: 6 }}
              >
                تنبيه: الرصيد في هذا الحساب هيكون بالسالب بعد السداد.
              </AppText>
            )}
          </View>
        )}

        {/* Note Field */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
            ملاحظة (اختياري)
          </AppText>
          <TextInput
            value={note}
            onChangeText={(txt) => setNote(txt.slice(0, 200))}
            placeholder="مثال: فاتورة شهر أكتوبر"
            placeholderTextColor={colors.textTertiary}
            maxLength={200}
            style={[
              styles.noteInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                color: colors.textPrimary,
                padding: spacing.sm,
              },
            ]}
          />
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  headerCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  amountLine: {
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  balanceImpactCard: {
    borderWidth: 1,
    marginTop: 10,
  },
  impactLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteInput: {
    borderWidth: 1,
    height: 44,
    textAlign: 'right',
    fontSize: 14,
  },
});
