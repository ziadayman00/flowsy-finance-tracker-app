import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  Keypad,
  Chip,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { categoriesApi } from '../../api/categories';
import { transactionsApi } from '../../api/transactions';
import {
  AccountResponseDto,
  CategoryResponseDto,
  TransactionResponseDto,
  TransactionType,
} from '../../api/types';
import {
  buildUpdateTransactionPayload,
} from '../../utils/payloads';
import { getErrorMessage } from '../../utils/errors';
import { displayName } from '../../utils/names';
import { formatMoney, toArabicNumberSeparators } from '../../utils/format';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface AddTransactionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editTransaction?: TransactionResponseDto | null;
  copyFromTransaction?: TransactionResponseDto | null;
  onCopyAsNew?: (tx: TransactionResponseDto) => void;
  defaultAccountId?: string;
  defaultType?: TransactionType;
}

export const AddTransactionSheet: React.FC<AddTransactionSheetProps> = ({
  visible,
  onClose,
  onSuccess,
  editTransaction,
  copyFromTransaction,
  onCopyAsNew,
  defaultAccountId,
  defaultType = 'EXPENSE',
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const isEditMode = !!editTransaction;

  // Form State
  const [type, setType] = useState<TransactionType>(
    editTransaction?.type || defaultType
  );
  const [amount, setAmount] = useState<string>(
    editTransaction ? editTransaction.amount : ''
  );
  const [accountId, setAccountId] = useState<string>(
    editTransaction?.account.id || defaultAccountId || ''
  );
  const [destinationAccountId, setDestinationAccountId] = useState<string>(
    editTransaction?.destinationAccount?.id || ''
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    editTransaction?.category?.id || null
  );
  const [note, setNote] = useState<string>(editTransaction?.note || '');
  const [dateSelection, setDateSelection] = useState<'today' | 'yesterday' | 'other'>(
    'today'
  );
  const [customDate, setCustomDate] = useState<Date>(
    editTransaction ? new Date(editTransaction.transactionDate) : new Date()
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDto[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDestAccountModal, setShowDestAccountModal] = useState(false);
  const [showAllCategoriesModal, setShowAllCategoriesModal] = useState(false);

  // Reset or initialize on visibility/transaction change
  useEffect(() => {
    if (visible) {
      if (editTransaction) {
        setType(editTransaction.type);
        setAmount(editTransaction.amount);
        setAccountId(editTransaction.account.id);
        setDestinationAccountId(editTransaction.destinationAccount?.id || '');
        setCategoryId(editTransaction.category?.id || null);
        setNote(editTransaction.note || '');
        setCustomDate(new Date(editTransaction.transactionDate));
        setDateSelection('today');
      } else if (copyFromTransaction) {
        setType(copyFromTransaction.type);
        setAmount(copyFromTransaction.amount);
        setAccountId(copyFromTransaction.account.id);
        setDestinationAccountId(copyFromTransaction.destinationAccount?.id || '');
        setCategoryId(copyFromTransaction.category?.id || null);
        setNote(copyFromTransaction.note || '');
        setDateSelection('today');
        setCustomDate(new Date());
      } else {
        setType(defaultType);
        setAmount('');
        if (defaultAccountId) {
          setAccountId(defaultAccountId);
        }
        setDestinationAccountId('');
        setCategoryId(null);
        setNote('');
        setDateSelection('today');
        setCustomDate(new Date());
      }
      setErrorMessage(null);
      setShowAccountModal(false);
      setShowDestAccountModal(false);
      setShowAllCategoriesModal(false);
      loadData();
    }
  }, [visible, editTransaction, copyFromTransaction, defaultType, defaultAccountId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accs, cats] = await Promise.all([
        accountsApi.getAccounts(),
        categoriesApi.getCategories(),
      ]);
      const activeAccs = accs.filter((a) => !a.isArchived);
      setAccounts(activeAccs);
      setCategories(cats.filter((c) => !c.isArchived));

      // If no account selected yet, pick first active spendable account
      if (!accountId && activeAccs.length > 0) {
        const firstSpendable = activeAccs.find((a) => !a.excludeFromSafeToSpend);
        setAccountId(firstSpendable ? firstSpendable.id : activeAccs[0].id);
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId),
    [accounts, accountId]
  );

  const selectedDestAccount = useMemo(
    () => accounts.find((a) => a.id === destinationAccountId),
    [accounts, destinationAccountId]
  );

  const currentCurrency = selectedAccount?.currency || 'EGP';

  // Filter categories by type (EXPENSE or INCOME)
  const filteredCategories = useMemo(() => {
    if (type === 'TRANSFER') return [];
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  // Strip categories: top 5
  const stripCategories = useMemo(
    () => filteredCategories.slice(0, 5),
    [filteredCategories]
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  // Eligible destination accounts (same currency, different account)
  const eligibleDestAccounts = useMemo(() => {
    if (!selectedAccount) return [];
    return accounts.filter(
      (a) => a.id !== selectedAccount.id && a.currency === selectedAccount.currency
    );
  }, [accounts, selectedAccount]);

  const transactionDateISO = useMemo(() => {
    const now = new Date();
    if (dateSelection === 'today') {
      return now.toISOString();
    } else if (dateSelection === 'yesterday') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return yesterday.toISOString();
    } else {
      return customDate.toISOString();
    }
  }, [dateSelection, customDate]);

  const isValid = useMemo(() => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) return false;
    if (!accountId) return false;
    if (type === 'TRANSFER' && !destinationAccountId) return false;
    return true;
  }, [amount, accountId, type, destinationAccountId]);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      if (isEditMode && editTransaction) {
        const patchPayload = buildUpdateTransactionPayload({
          amount,
          categoryId: type === 'TRANSFER' ? null : categoryId,
          transactionDate: transactionDateISO,
          note: note.trim() || null,
        });

        await transactionsApi.updateTransaction(editTransaction.id, patchPayload);
        haptics.notificationSuccess();
        showToast('تم تعديل المعاملة');
      } else {
        await transactionsApi.createTransaction({
          amount,
          type,
          accountId,
          destinationAccountId: type === 'TRANSFER' ? destinationAccountId : undefined,
          categoryId: type === 'TRANSFER' ? null : categoryId,
          transactionDate: transactionDateISO,
          note: note.trim() || undefined,
        });
        haptics.notificationSuccess();
        showToast(type === 'TRANSFER' ? 'تم تسجيل التحويل' : 'تم تسجيل المعاملة');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      haptics.notificationError();
      setErrorMessage(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const sheetTitle = isEditMode
    ? strings.transactions.editTitle
    : type === 'EXPENSE'
    ? 'تسجيل مصروف'
    : type === 'INCOME'
    ? 'تسجيل دخل'
    : 'تحويل بين حسابين';

  // Modal Footer containing Primary Save Button
  const renderFooter = (
    <View style={styles.footerActionRow}>
      {isEditMode && editTransaction && onCopyAsNew && (
        <Button
          title={strings.transactions.copyAsNew}
          variant="secondary"
          onPress={() => onCopyAsNew(editTransaction)}
          style={{ flex: 1, marginEnd: spacing.sm }}
        />
      )}
      <Button
        title={
          isEditMode
            ? strings.common.save
            : isValid
            ? `سجّل ${formatMoney(amount, currentCurrency)}`
            : 'سجّل المعاملة'
        }
        onPress={handleSubmit}
        loading={submitting}
        disabled={!isValid || submitting}
        style={{ flex: 2 }}
      />
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={sheetTitle}
      subtitle={isEditMode ? strings.transactions.editRestrictedHint : undefined}
      isDirty={!!amount && amount !== '0'}
      footer={renderFooter}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {!isEditMode && (
          <View style={[styles.typeSwitcher, { borderColor: colors.border, backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as TransactionType[]).map((t) => {
              const active = type === t;
              const label =
                t === 'EXPENSE'
                  ? strings.transactions.expense
                  : t === 'INCOME'
                  ? strings.transactions.income
                  : strings.transactions.transfer;

              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    haptics.impactLight();
                    setType(t);
                    setCategoryId(null);
                    setErrorMessage(null);
                  }}
                  style={[
                    styles.typeTab,
                    active && {
                      backgroundColor: colors.surface,
                      borderRadius: radii.xs,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <AppText
                    variant="label"
                    style={{
                      color: active
                        ? t === 'EXPENSE'
                          ? colors.calmRed
                          : t === 'INCOME'
                          ? colors.positive
                          : colors.forest
                        : colors.textSecondary,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.amountHeroContainer}>
          <AppText variant="micro" tone="secondary" style={styles.amountLabel}>
            المبلغ
          </AppText>
          <View style={styles.amountHeroRow}>
            <AppText
              variant="amountHero"
              style={[
                styles.amountFigure,
                {
                  color:
                    type === 'EXPENSE'
                      ? colors.textPrimary
                      : type === 'INCOME'
                      ? colors.positive
                      : colors.forest,
                },
              ]}
            >
              {toArabicNumberSeparators(amount || '0')}
            </AppText>
            <AppText variant="title3" tone="secondary" style={styles.currencyText}>
              {currentCurrency === 'EGP' ? 'ج.م' : currentCurrency}
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
            <Icon name="alert-circle-outline" size={16} color={colors.negative} />
            <AppText variant="caption" tone="negative" style={{ flex: 1, marginStart: 8 }}>
              {errorMessage}
            </AppText>
          </View>
        )}

        <Keypad value={amount} onChange={setAmount} />

        <Pressable
          disabled={isEditMode}
          onPress={() => setShowAccountModal(true)}
          style={[styles.formPickerRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.sm }]}
        >
          <AppText variant="caption" tone="secondary">
            {type === 'TRANSFER' ? strings.transactions.fromAccount : 'الحساب'}
          </AppText>
          <View style={styles.contextValueRow}>
            <AppText variant="bodyStrong">
              {selectedAccount ? displayName(selectedAccount.name) : 'اختار حساب'}
            </AppText>
            {!isEditMode && <Icon name="chevron-down" size={14} color={colors.textSecondary} style={{ marginStart: 4 }} />}
          </View>
        </Pressable>

        {type === 'TRANSFER' && (
          <Pressable
            disabled={isEditMode}
            onPress={() => setShowDestAccountModal(true)}
            style={[
              styles.formPickerRow,
              {
                backgroundColor: colors.surface,
                borderColor: destinationAccountId ? colors.border : colors.gold,
                borderRadius: radii.sm,
              },
            ]}
          >
            <AppText variant="caption" tone="secondary">
              {strings.transactions.toAccount}
            </AppText>
            <View style={styles.contextValueRow}>
              <AppText variant="bodyStrong" tone={destinationAccountId ? 'primary' : 'warning'}>
                {selectedDestAccount ? displayName(selectedDestAccount.name) : 'اختار الحساب المستلم'}
              </AppText>
              {!isEditMode && <Icon name="chevron-down" size={14} color={colors.textSecondary} style={{ marginStart: 4 }} />}
            </View>
          </Pressable>
        )}

        {type !== 'TRANSFER' && (
          <View style={styles.formGroup}>
            <View style={styles.categoryLabelRow}>
              <AppText variant="label" tone="secondary">
                {strings.transactions.category}
              </AppText>
              <Pressable onPress={() => setShowAllCategoriesModal(true)} hitSlop={8}>
                <AppText variant="caption" tone="brand">
                  {strings.transactions.allCategories}
                </AppText>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsRow}>
              <Chip
                label={strings.transactions.uncategorized}
                selected={categoryId === null}
                onPress={() => {
                  haptics.impactLight();
                  setCategoryId(null);
                }}
              />
              {stripCategories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={displayName(cat.name)}
                  selected={categoryId === cat.id}
                  onPress={() => {
                    haptics.impactLight();
                    setCategoryId(cat.id);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.formGroup}>
          <AppText variant="label" tone="secondary" style={styles.formLabel}>
            {strings.transactions.date}
          </AppText>
          <View style={styles.dateSelectorRow}>
            <Chip label={strings.transactions.today} selected={dateSelection === 'today'} onPress={() => setDateSelection('today')} style={{ flex: 1 }} />
            <Chip label={strings.transactions.yesterday} selected={dateSelection === 'yesterday'} onPress={() => setDateSelection('yesterday')} style={{ flex: 1 }} />
          </View>
        </View>

        <TextInput
          value={note}
          onChangeText={(text) => setNote(text.slice(0, 200))}
          placeholder={strings.transactions.notePlaceholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={2}
          maxLength={200}
          style={[
            styles.noteInputField,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.sm,
              color: colors.textPrimary,
            },
          ]}
        />
      </ScrollView>

      {/* Account Picker Sub-Modal */}
      <Sheet
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title="اختر الحساب"
      >
        <ScrollView style={{ maxHeight: 380 }}>
          {accounts.map((acc) => {
            const selected = acc.id === accountId;
            return (
              <Pressable
                key={acc.id}
                onPress={() => {
                  haptics.impactLight();
                  setAccountId(acc.id);
                  setShowAccountModal(false);
                }}
                style={[
                  styles.modalItemRow,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: selected ? colors.sunken : 'transparent',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{displayName(acc.name)}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {formatMoney(acc.currentBalance, acc.currency)}
                  </AppText>
                </View>
                {selected && <Icon name="checkmark" size={18} color={colors.forest} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>

      {/* Destination Account Sub-Modal */}
      <Sheet
        visible={showDestAccountModal}
        onClose={() => setShowDestAccountModal(false)}
        title="اختر حساب الاستلام"
      >
        <ScrollView style={{ maxHeight: 380 }}>
          {eligibleDestAccounts.length === 0 ? (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <AppText variant="body" tone="secondary">
                لا توجد حسابات أخرى بنفس العملة للتحويل إليها
              </AppText>
            </View>
          ) : (
            eligibleDestAccounts.map((acc) => {
              const selected = acc.id === destinationAccountId;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => {
                    haptics.impactLight();
                    setDestinationAccountId(acc.id);
                    setShowDestAccountModal(false);
                  }}
                  style={[
                    styles.modalItemRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: selected ? colors.sunken : 'transparent',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{displayName(acc.name)}</AppText>
                    <AppText variant="caption" tone="secondary">
                      {formatMoney(acc.currentBalance, acc.currency)}
                    </AppText>
                  </View>
                  {selected && <Icon name="checkmark" size={18} color={colors.forest} />}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Sheet>

      {/* All Categories Sub-Modal */}
      <Sheet
        visible={showAllCategoriesModal}
        onClose={() => setShowAllCategoriesModal(false)}
        title="جميع التصنيفات"
      >
        <ScrollView style={{ maxHeight: 420 }}>
          {/* Uncategorized option */}
          <Pressable
            onPress={() => {
              haptics.impactLight();
              setCategoryId(null);
              setShowAllCategoriesModal(false);
            }}
            style={[
              styles.modalItemRow,
              {
                borderBottomColor: colors.border,
                backgroundColor: categoryId === null ? colors.sunken : 'transparent',
              },
            ]}
          >
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {strings.transactions.uncategorized}
            </AppText>
            {categoryId === null && <Icon name="checkmark" size={18} color={colors.forest} />}
          </Pressable>

          {filteredCategories.map((cat) => {
            const selected = categoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  haptics.impactLight();
                  setCategoryId(cat.id);
                  setShowAllCategoriesModal(false);
                }}
                style={[
                  styles.modalItemRow,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: selected ? colors.sunken : 'transparent',
                  },
                ]}
              >
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {displayName(cat.name)}
                </AppText>
                {selected && <Icon name="checkmark" size={18} color={colors.forest} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 16,
  },
  typeSwitcher: {
    flexDirection: 'row',
    padding: 3,
    borderWidth: 1,
    marginBottom: 8,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountHeroContainer: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountLabel: {
    marginBottom: 2,
  },
  amountHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  amountFigure: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  currencyText: {
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  contextValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  formGroup: {
    marginTop: 10,
    marginBottom: 4,
  },
  formLabel: {
    marginBottom: 4,
    textAlign: 'right',
  },
  formPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  noteInputField: {
    borderWidth: 1,
    minHeight: 56,
    textAlign: 'right',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
