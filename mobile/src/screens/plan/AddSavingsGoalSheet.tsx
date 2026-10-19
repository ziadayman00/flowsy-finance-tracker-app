import React, { useState, useEffect, useCallback } from 'react';
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
import { AccountResponseDto } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface AddSavingsGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddSavingsGoalSheet: React.FC<AddSavingsGoalSheetProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors, spacing, radii } = useTheme();
  const { showToast } = useToast();

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
      setAccounts(all.filter((a) => !a.isArchived));
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadAccounts();
      // Reset form
      setName('');
      setAmountStr('0');
      setCurrency('EGP');
      setSelectedAccountId(null);
      setTargetDate('');
      setNote('');
      setError(null);
    }
  }, [visible, loadAccounts]);

  // Keep currency in sync with the selected account's currency
  useEffect(() => {
    if (selectedAccountId) {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      if (acc) setCurrency(acc.currency);
    }
  }, [selectedAccountId, accounts]);


  const isValid =
    name.trim().length > 0 &&
    !!selectedAccountId &&
    parseFloat(amountStr) > 0;

  const handleSubmit = async () => {
    if (!isValid || !selectedAccountId) return;
    try {
      setSubmitting(true);
      setError(null);
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
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
      haptics.notificationError();
    } finally {
      setSubmitting(false);
    }
  };

  const isDirty = name.trim().length > 0 || parseFloat(amountStr) > 0 || !!selectedAccountId;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="هدف ادخار جديد"
      isDirty={isDirty}
      footer={
        <Button
          title="إنشاء الهدف"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isValid}
        />
      }
    >
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
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

        {/* Goal Name */}
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">اسم الهدف</AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="مثال: سيارة، سفر، طوارئ"
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

        {/* Target Amount */}
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">المبلغ المستهدف</AppText>
          <Keypad
            value={amountStr}
            onChange={setAmountStr}
          />
        </View>

        {/* Account Selection */}
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">الحساب المرتبط بالهدف</AppText>
          <AppText variant="caption" tone="secondary" style={{ fontSize: 11, opacity: 0.8 }}>
            سيعكس التقدم رصيد هذا الحساب
          </AppText>
          {loadingAccounts ? (
            <AppText variant="caption" tone="secondary">جارٍ التحميل...</AppText>
          ) : (
            <View style={{ gap: 8 }}>
              {accounts.map((acc) => {
                const selected = acc.id === selectedAccountId;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => {
                      setSelectedAccountId(acc.id);
                      haptics.impactLight();
                    }}
                    style={[
                      styles.accountRow,
                      {
                        backgroundColor: selected ? colors.forest : colors.surface,
                        borderColor: selected ? colors.forest : colors.border,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Icon
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={selected ? colors.onAction : colors.textTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText
                        variant="body"
                        style={{ color: selected ? colors.onAction : colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {acc.name}
                      </AppText>
                    </View>
                    <AppText
                      variant="caption"
                      style={{ color: selected ? colors.onAction : colors.textSecondary }}
                    >
                      {acc.currency}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Target Date (optional) */}
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">
            الموعد المستهدف (اختياري) — بصيغة YYYY-MM-DD
          </AppText>
          <TextInput
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="2026-12-31"
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
        <View style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">ملاحظة (اختياري)</AppText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="..."
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: radii.md,
                height: 72,
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
    paddingVertical: 12,
    fontSize: 15,
    textAlign: 'right',
  },
  amountRow: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountRow: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
