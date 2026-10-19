import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Button,
  Icon,
  Keypad,
} from '../../components/primitives';
import { savingsGoalsApi } from '../../api/savingsGoals';
import { accountsApi } from '../../api/accounts';
import { AccountResponseDto, SavingsGoalResponseDto } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { toArabicNumberSeparators } from '../../utils/format';
import { displayName } from '../../utils/names';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface AddSavingsGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  goalToEdit?: SavingsGoalResponseDto | null;
  onSuccess?: () => void;
}

export const AddSavingsGoalSheet: React.FC<AddSavingsGoalSheetProps> = ({
  visible,
  onClose,
  goalToEdit,
  onSuccess,
}) => {
  const { colors, spacing, radii } = useTheme();
  const { showToast } = useToast();

  const isEditMode = !!goalToEdit;

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('0');
  const [currency, setCurrency] = useState('EGP');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [note, setNote] = useState('');

  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const all = await accountsApi.getAccounts();
      const active = all.filter((a) => !a.isArchived);
      setAccounts(active);
      if (!isEditMode && active.length > 0 && !selectedAccountId) {
        setSelectedAccountId(active[0].id);
        setCurrency(active[0].currency);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, [isEditMode, selectedAccountId]);

  useEffect(() => {
    if (visible) {
      setError(null);
      if (goalToEdit) {
        setName(goalToEdit.name);
        setAmountStr(goalToEdit.targetAmount);
        setCurrency(goalToEdit.currency);
        setSelectedAccountId(goalToEdit.account.id);
        setTargetDate(
          goalToEdit.targetDate ? goalToEdit.targetDate.split('T')[0] : ''
        );
        setNote(goalToEdit.note || '');
      } else {
        setName('');
        setAmountStr('0');
        setCurrency('EGP');
        setSelectedAccountId(null);
        setTargetDate('');
        setNote('');
      }
      loadAccounts();
    }
  }, [visible, goalToEdit, loadAccounts]);

  // Keep currency in sync with the selected account's currency
  useEffect(() => {
    if (selectedAccountId && !isEditMode) {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      if (acc) setCurrency(acc.currency);
    }
  }, [selectedAccountId, accounts, isEditMode]);

  const isValid = useMemo(() => {
    const num = parseFloat(amountStr);
    return name.trim().length > 0 && !isNaN(num) && num > 0 && !!selectedAccountId;
  }, [name, amountStr, selectedAccountId]);

  const handleDatePreset = (preset: '3m' | '6m' | '1y' | 'eoy') => {
    const d = new Date();
    if (preset === '3m') {
      d.setMonth(d.getMonth() + 3);
    } else if (preset === '6m') {
      d.setMonth(d.getMonth() + 6);
    } else if (preset === '1y') {
      d.setFullYear(d.getFullYear() + 1);
    } else if (preset === 'eoy') {
      d.setMonth(11, 31);
    }
    setTargetDate(d.toISOString().split('T')[0]);
    haptics.impactLight();
  };

  const handleSubmit = async () => {
    if (!isValid || !selectedAccountId || submitting) return;
    try {
      setSubmitting(true);
      setError(null);

      if (isEditMode && goalToEdit) {
        await savingsGoalsApi.updateGoal(goalToEdit.id, {
          name: name.trim(),
          targetAmount: amountStr,
          targetDate: targetDate.trim() || null,
          note: note.trim() || null,
        });
        haptics.notificationSuccess();
        showToast('تم تحديث هدف الادخار');
      } else {
        await savingsGoalsApi.createGoal({
          name: name.trim(),
          targetAmount: amountStr,
          currency,
          accountId: selectedAccountId,
          targetDate: targetDate.trim() || undefined,
          note: note.trim() || undefined,
        });
        haptics.notificationSuccess();
        showToast('تم إنشاء هدف الادخار');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      haptics.notificationError();
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty =
    name.trim().length > 0 || parseFloat(amountStr) > 0 || !!targetDate || !!note;

  const targetDateFormatted = targetDate
    ? new Date(targetDate).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEditMode ? 'تعديل هدف الادخار' : 'هدف ادخار جديد'}
      isDirty={isDirty}
      footer={
        <Button
          title={isEditMode ? 'حفظ التعديلات' : 'إنشاء الهدف'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isValid || submitting}
        />
      }
    >
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle }]}>
            <AppText variant="caption" tone="negative">
              {error}
            </AppText>
          </View>
        )}

        {/* Goal Name Input */}
        <View style={{ gap: 6 }}>
          <AppText variant="label" tone="secondary">
            اسم الهدف
          </AppText>
          <TextInput
            value={name}
            onChangeText={(txt) => setName(txt.slice(0, 60))}
            placeholder="مثال: سيارة، دفعة أولى، صندوق طوارئ"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: radii.md,
              },
            ]}
            maxLength={60}
          />
        </View>

        {/* Target Amount Card (PROMINENT DISPLAY OF TARGET PRICE) */}
        <View
          style={[
            styles.amountCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.md,
              padding: spacing.md,
            },
          ]}
        >
          <AppText variant="caption" tone="secondary">
            المبلغ المستهدف (سعر الهدف)
          </AppText>
          <View style={styles.amountRow}>
            <AppText variant="amountLg" tone="primary" style={{ writingDirection: 'ltr' }}>
              {toArabicNumberSeparators(amountStr || '0')}
            </AppText>
            <AppText variant="title3" tone="secondary" style={{ marginStart: 8 }}>
              {currency}
            </AppText>
          </View>
        </View>

        {/* Keypad for entering target amount */}
        <View style={{ marginTop: -4 }}>
          <Keypad
            value={amountStr}
            onChange={setAmountStr}
            maxDecimals={2}
            maxIntegerDigits={10}
          />
        </View>

        {/* Account Selection */}
        <View style={{ gap: 6, marginTop: spacing.xs }}>
          <AppText variant="label" tone="secondary">
            الحساب المرتبط
          </AppText>
          <AppText variant="caption" tone="secondary" style={{ fontSize: 11, marginTop: -4 }}>
            رصيد هذا الحساب يحدد نسبة إنجاز الهدف تلقائياً
          </AppText>

          {isEditMode && goalToEdit ? (
            <View
              style={[
                styles.accountChip,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radii.sm,
                  padding: 12,
                },
              ]}
            >
              <Icon name="wallet-outline" size={16} color={colors.textSecondary} />
              <AppText variant="bodyStrong">{goalToEdit.account.name}</AppText>
              <AppText variant="caption" tone="secondary">({goalToEdit.currency})</AppText>
            </View>
          ) : loadingAccounts ? (
            <AppText variant="caption" tone="secondary">جارٍ تحميل الحسابات...</AppText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {accounts.map((acc) => {
                const selected = acc.id === selectedAccountId;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => {
                      setSelectedAccountId(acc.id);
                      setCurrency(acc.currency);
                      haptics.impactLight();
                    }}
                    style={[
                      styles.accountChip,
                      {
                        backgroundColor: selected ? colors.forest : colors.surface,
                        borderColor: selected ? colors.forest : colors.border,
                        borderRadius: radii.sm,
                      },
                    ]}
                  >
                    <Icon
                      name={selected ? 'checkmark-circle' : 'wallet-outline'}
                      size={15}
                      color={selected ? colors.onAction : colors.textTertiary}
                    />
                    <AppText
                      variant="label"
                      style={{
                        color: selected ? colors.onAction : colors.textPrimary,
                        fontWeight: selected ? '700' : '500',
                      }}
                    >
                      {displayName(acc.name)}
                    </AppText>
                    <AppText
                      variant="caption"
                      style={{
                        color: selected ? colors.onAction : colors.textSecondary,
                        fontSize: 10,
                      }}
                    >
                      {acc.currency}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Target Date with Quick Presets */}
        <View style={{ gap: 6, marginTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="label" tone="secondary">
              تاريخ الهدف (اختياري)
            </AppText>
            {targetDateFormatted ? (
              <AppText variant="caption" tone="secondary" style={{ color: colors.forest }}>
                {targetDateFormatted}
              </AppText>
            ) : null}
          </View>

          {/* Quick Date Presets */}
          <View style={styles.chipsRow}>
            {[
              { id: '3m' as const, label: '٣ أشهر' },
              { id: '6m' as const, label: '٦ أشهر' },
              { id: '1y' as const, label: 'سنة' },
              { id: 'eoy' as const, label: 'نهاية العام' },
            ].map((p) => (
              <Pressable
                key={p.id}
                onPress={() => handleDatePreset(p.id)}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <AppText variant="caption" tone="secondary">
                  {p.label}
                </AppText>
              </Pressable>
            ))}
            {targetDate ? (
              <Pressable
                onPress={() => { setTargetDate(''); haptics.impactLight(); }}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: colors.sunken,
                    borderColor: colors.border,
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <AppText variant="caption" tone="negative">
                  مسح
                </AppText>
              </Pressable>
            ) : null}
          </View>

          <TextInput
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numbers-and-punctuation"
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: radii.md,
                writingDirection: 'ltr',
              },
            ]}
            maxLength={10}
          />
        </View>

        {/* Note (optional) */}
        <View style={{ gap: 6, marginTop: spacing.xs }}>
          <AppText variant="label" tone="secondary">
            ملاحظة (اختياري)
          </AppText>
          <TextInput
            value={note}
            onChangeText={(txt) => setNote(txt.slice(0, 200))}
            placeholder="أضف تفاصيل إضافية حول خطتك لتحقيق هذا الهدف..."
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: radii.md,
                height: 64,
                textAlignVertical: 'top',
              },
            ]}
            multiline
            maxLength={200}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    padding: 10,
    borderRadius: 8,
  },
  textInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: 'right',
  },
  amountCard: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
});
