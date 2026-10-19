import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Screen,
  AppText,
  Icon,
  Button,
  Divider,
  Money,
  ConfirmDialog,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { transactionsApi } from '../../api/transactions';
import { AccountResponseDto, TransactionResponseDto } from '../../api/types';
import { formatMoney } from '../../utils/format';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';
import { CorrectBalanceSheet } from './CorrectBalanceSheet';
import { AddAccountSheet } from './AddAccountSheet';

interface AccountDetailScreenProps {
  accountId: string;
  onBack: () => void;
  onNavigateToTransactions?: (accountId: string) => void;
  onNavigateToTxDetail?: (tx: TransactionResponseDto) => void;
}

export const AccountDetailScreen: React.FC<AccountDetailScreenProps> = ({
  accountId,
  onBack,
  onNavigateToTransactions,
  onNavigateToTxDetail,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [account, setAccount] = useState<AccountResponseDto | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<TransactionResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingProtected, setUpdatingProtected] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals / sheets
  const [correctBalanceVisible, setCorrectBalanceVisible] = useState(false);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [confirmArchiveVisible, setConfirmArchiveVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const loadAccountDetails = useCallback(async () => {
    try {
      const [acc, txRes] = await Promise.all([
        accountsApi.getAccount(accountId),
        transactionsApi.getTransactions({ accountId, limit: 5 }),
      ]);
      setAccount(acc);
      setRecentTransactions(txRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAccountDetails();
  }, [loadAccountDetails]);

  const handleToggleProtected = async (newVal: boolean) => {
    if (!account || updatingProtected) return;

    try {
      setUpdatingProtected(true);
      // ON in UI means include in safe to spend, so excludeFromSafeToSpend = !newVal
      const updated = await accountsApi.updateAccount(account.id, {
        excludeFromSafeToSpend: !newVal,
      } as any);
      setAccount(updated);
      haptics.impactLight();
      showToast('تم تحديث حالة الحساب');
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setUpdatingProtected(false);
    }
  };

  const handleArchiveAccount = async () => {
    if (!account) return;

    try {
      setActionLoading(true);
      await accountsApi.updateAccount(account.id, {
        isArchived: !account.isArchived,
      } as any);

      haptics.notificationSuccess();
      showToast(account.isArchived ? strings.accounts.restoreAccount : 'تمت أرشفة الحساب');
      setConfirmArchiveVisible(false);
      onBack();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!account) return;

    try {
      setActionLoading(true);
      setDeleteErrorMessage(null);
      await accountsApi.deleteAccount(account.id);

      haptics.impactMedium();
      showToast('تم حذف الحساب');
      setConfirmDeleteVisible(false);
      onBack();
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.includes('مرتبط') || msg.includes('used') || msg.includes('400')) {
        setDeleteErrorMessage(strings.accounts.deleteUsedGuidance);
      } else {
        setDeleteErrorMessage(msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !account) {
    return (
      <Screen scrollable={false}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const typeLabel =
    account.type === 'CASH'
      ? 'كاش'
      : account.type === 'BANK'
      ? 'حساب بنكي'
      : account.type === 'SAVINGS'
      ? 'حساب توفير'
      : 'محفظة إلكترونية';

  const isIncludedInSafeToSpend = !account.excludeFromSafeToSpend;

  return (
    <Screen scrollable>
      {/* Top Navigation */}
      <View style={[styles.navRow, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} isRTLMirrored />
        </Pressable>
        <AppText variant="title2">{displayName(account.name)}</AppText>
        <Pressable onPress={() => setEditSheetVisible(true)}>
          <AppText variant="body" tone="brand">
            تعديل
          </AppText>
        </Pressable>
      </View>

      {/* Archived Banner */}
      {account.isArchived && (
        <View
          style={[
            styles.archivedBanner,
            {
              backgroundColor: colors.surfaceSubtle,
              borderBottomColor: colors.border,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
            },
          ]}
        >
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            هذا الحساب مؤرشف حالياً
          </AppText>
          <Pressable onPress={handleArchiveAccount}>
            <AppText variant="caption" tone="brand">
              {strings.accounts.restoreAccount}
            </AppText>
          </Pressable>
        </View>
      )}

      {/* Balance Hero Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            marginHorizontal: spacing.lg,
            marginTop: spacing.sm,
            padding: spacing.lg,
          },
        ]}
      >
        <AppText variant="caption" tone="secondary">
          {strings.accounts.currentBalance}
        </AppText>
        <View style={{ marginTop: 4 }}>
          <Money
            value={account.currentBalance}
            currency={account.currency}
            size="lg"
            tone="primary"
          />
        </View>

        <AppText
          variant="caption"
          tone="secondary"
          style={{ marginTop: 8, writingDirection: 'ltr' }}
        >
          {strings.accounts.startingBalance.replace(
            '{amount}',
            formatMoney(account.initialBalance, account.currency)
          )}
        </AppText>
      </View>

      {/* Settings Rows */}
      <View
        style={[
          styles.groupCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
          },
        ]}
      >
        {/* Safe-to-spend switch */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginEnd: 12 }}>
            <AppText variant="bodyStrong">
              {strings.accounts.includeInSafeToSpend}
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              {isIncludedInSafeToSpend
                ? 'الحساب يدخل في حساب تقدر تصرف كام'
                : 'الحساب محمي ومش داخل في الحسبة'}
            </AppText>
          </View>
          {updatingProtected ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Switch
              value={isIncludedInSafeToSpend}
              onValueChange={handleToggleProtected}
              trackColor={{ false: colors.border, true: colors.brand }}
            />
          )}
        </View>

        <Divider />

        {/* Type Display */}
        <View style={styles.row}>
          <AppText variant="body" tone="secondary">
            نوع الحساب
          </AppText>
          <AppText variant="bodyStrong">{typeLabel}</AppText>
        </View>

        <Divider />

        {/* Correct Balance Row */}
        <Pressable
          onPress={() => setCorrectBalanceVisible(true)}
          style={styles.row}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" tone="brand">
              {strings.accounts.correctBalanceAction}
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              تعديل رصيد الحساب ليتطابق مع رصيدك الفعلي
            </AppText>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.brand} isRTLMirrored />
        </Pressable>
      </View>

      {/* Recent Transactions Section */}
      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <View style={styles.sectionHeader}>
          <AppText variant="label" tone="secondary">
            آخر المعاملات
          </AppText>
          {onNavigateToTransactions && (
            <Pressable onPress={() => onNavigateToTransactions(account.id)}>
              <AppText variant="caption" tone="brand">
                كل المعاملات
              </AppText>
            </Pressable>
          )}
        </View>

        <View
          style={[
            styles.groupCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.md,
              marginTop: 6,
            },
          ]}
        >
          {recentTransactions.length === 0 ? (
            <View style={{ padding: spacing.md, alignItems: 'center' }}>
              <AppText variant="caption" tone="secondary">
                مفيش معاملات مسجلة في هذا الحساب
              </AppText>
            </View>
          ) : (
            recentTransactions.map((tx, idx) => {
              const isIncome = tx.type === 'INCOME';
              const isExpense = tx.type === 'EXPENSE';
              return (
                <React.Fragment key={tx.id}>
                  {idx > 0 && <Divider />}
                  <Pressable
                    onPress={() => onNavigateToTxDetail?.(tx)}
                    style={styles.txRow}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {tx.category ? displayName(tx.category.name) : tx.note || 'معاملة'}
                      </AppText>
                      <AppText variant="caption" tone="secondary">
                        {new Date(tx.transactionDate).toLocaleDateString('ar-EG', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </AppText>
                    </View>

                    <Money
                      value={tx.amount}
                      currency={tx.currency}
                      size="sm"
                      tone={isIncome ? 'positive' : isExpense ? 'primary' : 'secondary'}
                      sign={isIncome ? 'always' : isExpense ? 'auto' : 'none'}
                    />
                  </Pressable>
                </React.Fragment>
              );
            })
          )}
        </View>
      </View>

      {/* Advanced Section: Archive & Delete */}
      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: 40, gap: spacing.sm }}>
        <Button
          title={account.isArchived ? strings.accounts.restoreAccount : strings.accounts.archiveAccount}
          variant="secondary"
          onPress={() => setConfirmArchiveVisible(true)}
        />

        <Button
          title={strings.accounts.deleteAccount}
          variant="destructive"
          onPress={() => {
            setDeleteErrorMessage(null);
            setConfirmDeleteVisible(true);
          }}
        />
      </View>

      {/* Correct Balance Sheet */}
      <CorrectBalanceSheet
        visible={correctBalanceVisible}
        onClose={() => setCorrectBalanceVisible(false)}
        account={account}
        onSuccess={loadAccountDetails}
      />

      {/* Edit Account Sheet */}
      <AddAccountSheet
        visible={editSheetVisible}
        onClose={() => setEditSheetVisible(false)}
        accountToEdit={account}
        onSuccess={loadAccountDetails}
      />

      {/* Confirm Archive */}
      <ConfirmDialog
        visible={confirmArchiveVisible}
        title={account.isArchived ? 'استرجاع الحساب' : 'أرشفة الحساب'}
        message={strings.accounts.archiveConfirm}
        confirmLabel={account.isArchived ? strings.common.restore : strings.common.archive}
        cancelLabel={strings.common.cancel}
        loading={actionLoading}
        onConfirm={handleArchiveAccount}
        onCancel={() => setConfirmArchiveVisible(false)}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="حذف الحساب"
        message={
          deleteErrorMessage ||
          'هل أنت متأكد من حذف هذا الحساب؟ لا يمكن حذف الحسابات التي تحتوي على معاملات سابقة.'
        }
        confirmLabel={deleteErrorMessage ? 'أرشفه بدل الحذف' : strings.common.delete}
        cancelLabel={strings.common.cancel}
        isDestructive={!deleteErrorMessage}
        loading={actionLoading}
        onConfirm={() => {
          if (deleteErrorMessage) {
            setConfirmDeleteVisible(false);
            handleArchiveAccount();
          } else {
            handleDeleteAccount();
          }
        }}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archivedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heroCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  groupCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
