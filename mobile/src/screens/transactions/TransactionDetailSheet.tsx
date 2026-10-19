import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  Divider,
  ConfirmDialog,
} from '../../components/primitives';
import { TransactionResponseDto } from '../../api/types';
import { transactionsApi } from '../../api/transactions';
import { formatMoney } from '../../utils/format';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface TransactionDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  transaction: TransactionResponseDto | null;
  onEdit: (tx: TransactionResponseDto) => void;
  onCopyAsNew: (tx: TransactionResponseDto) => void;
  onDeleted: () => void;
  onNavigateToAccount?: (accountId: string) => void;
}

export const TransactionDetailSheet: React.FC<TransactionDetailSheetProps> = ({
  visible,
  onClose,
  transaction,
  onEdit,
  onCopyAsNew,
  onDeleted,
  onNavigateToAccount,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!transaction) return null;

  const isExpense = transaction.type === 'EXPENSE';
  const isIncome = transaction.type === 'INCOME';
  const isTransfer = transaction.type === 'TRANSFER';

  const formattedAmount = formatMoney(transaction.amount, transaction.currency);
  const sign = isExpense ? '−' : isIncome ? '+' : '';

  const dateStr = new Date(transaction.transactionDate).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = new Date(transaction.transactionDate).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const createdStr = new Date(transaction.createdAt).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getDeleteImpactMessage = () => {
    if (isExpense) {
      return strings.transactions.deleteConfirmExpense
        .replace('{amount}', formattedAmount)
        .replace('{account}', displayName(transaction.account.name));
    }
    if (isIncome) {
      return strings.transactions.deleteConfirmIncome
        .replace('{amount}', formattedAmount)
        .replace('{account}', displayName(transaction.account.name));
    }
    return strings.transactions.deleteConfirmTransfer
      .replace('{amount}', formattedAmount)
      .replace('{from}', displayName(transaction.account.name))
      .replace(
        '{to}',
        transaction.destinationAccount
          ? displayName(transaction.destinationAccount.name)
          : 'الحساب الآخر'
      );
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await transactionsApi.deleteTransaction(transaction.id);
      haptics.impactMedium();
      showToast(strings.transactions.deletedToast);
      setConfirmDeleteVisible(false);
      onDeleted();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title="تفاصيل المعاملة"
        footer={
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title={strings.transactions.copyAsNew}
                variant="secondary"
                onPress={() => {
                  onClose();
                  onCopyAsNew(transaction);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="تعديل المعاملة"
                variant="primary"
                onPress={() => {
                  onClose();
                  onEdit(transaction);
                }}
                style={{ flex: 1 }}
              />
            </View>
            <Button
              title={strings.transactions.deleteAction}
              variant="destructive"
              onPress={() => setConfirmDeleteVisible(true)}
            />
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Amount and Type Header */}
          <View style={styles.amountHeader}>
            <AppText
              variant="amountLg"
              tone={isIncome ? 'positive' : isExpense ? 'primary' : 'secondary'}
              style={{ writingDirection: 'ltr' }}
            >
              {sign} {formattedAmount}
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              {isExpense
                ? strings.transactions.expense
                : isIncome
                ? strings.transactions.income
                : strings.transactions.transfer}{' '}
              • {dateStr}، {timeStr}
            </AppText>
          </View>

          <Divider style={{ marginVertical: spacing.md }} />

          {/* Grouped Details */}
          <View
            style={[
              styles.detailsGroup,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
              },
            ]}
          >
            {/* Account */}
            <Pressable
              onPress={() => {
                if (onNavigateToAccount) {
                  onClose();
                  onNavigateToAccount(transaction.account.id);
                }
              }}
              style={styles.detailRow}
            >
              <AppText variant="body" tone="secondary">
                {isTransfer ? strings.transactions.fromAccount : 'الحساب'}
              </AppText>
              <View style={styles.rowValue}>
                <AppText variant="bodyStrong">
                  {displayName(transaction.account.name)}
                </AppText>
                {onNavigateToAccount && (
                  <Icon
                    name="chevron-forward"
                    size={16}
                    color={colors.textTertiary}
                    style={{ marginStart: 4 }}
                  />
                )}
              </View>
            </Pressable>

            {/* Destination Account if Transfer */}
            {isTransfer && transaction.destinationAccount && (
              <>
                <Divider />
                <Pressable
                  onPress={() => {
                    if (onNavigateToAccount && transaction.destinationAccount) {
                      onClose();
                      onNavigateToAccount(transaction.destinationAccount.id);
                    }
                  }}
                  style={styles.detailRow}
                >
                  <AppText variant="body" tone="secondary">
                    {strings.transactions.toAccount}
                  </AppText>
                  <View style={styles.rowValue}>
                    <AppText variant="bodyStrong">
                      {displayName(transaction.destinationAccount.name)}
                    </AppText>
                    {onNavigateToAccount && (
                      <Icon
                        name="chevron-forward"
                        size={16}
                        color={colors.textTertiary}
                        style={{ marginStart: 4 }}
                      />
                    )}
                  </View>
                </Pressable>
              </>
            )}

            {/* Category */}
            {!isTransfer && (
              <>
                <Divider />
                <View style={styles.detailRow}>
                  <AppText variant="body" tone="secondary">
                    {strings.transactions.category}
                  </AppText>
                  <AppText variant="bodyStrong">
                    {transaction.category
                      ? displayName(transaction.category.name)
                      : strings.transactions.uncategorized}
                  </AppText>
                </View>
              </>
            )}

            {/* Note */}
            {!!transaction.note && (
              <>
                <Divider />
                <View style={styles.detailRow}>
                  <AppText variant="body" tone="secondary">
                    {strings.transactions.note}
                  </AppText>
                  <AppText variant="body" style={{ flex: 1, textAlign: 'left', marginStart: 16 }}>
                    {transaction.note}
                  </AppText>
                </View>
              </>
            )}

            {/* Created At */}
            <Divider />
            <View style={styles.detailRow}>
              <AppText variant="caption" tone="secondary">
                اتسجّلت في
              </AppText>
              <AppText variant="caption" tone="secondary">
                {createdStr}
              </AppText>
            </View>
          </View>

        <View style={{ height: 16 }} />
        </ScrollView>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title={strings.transactions.deleteConfirmTitle}
        message={getDeleteImpactMessage()}
        confirmLabel={strings.common.delete}
        cancelLabel={strings.common.cancel}
        isDestructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  amountHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  detailsGroup: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
