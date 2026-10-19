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
  Keypad,
  Segmented,
  Divider,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { categoriesApi } from '../../api/categories';
import { commitmentsApi } from '../../api/commitments';
import {
  AccountResponseDto,
  CategoryResponseDto,
  RecurrenceFrequency,
} from '../../api/types';
import { buildCreateCommitmentPayload } from '../../utils/payloads';
import { getErrorMessage } from '../../utils/errors';
import { displayName } from '../../utils/names';
import { formatMoney, toArabicNumberSeparators } from '../../utils/format';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface AddCommitmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddCommitmentSheet: React.FC<AddCommitmentSheetProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('MONTHLY');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [dueDateDaysOffset, setDueDateDaysOffset] = useState<number>(7);

  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      setAmount('');
      setRecurrence('MONTHLY');
      setDueDateDaysOffset(7);
      setCategoryId('');
      setErrorMessage(null);
      loadMetadata();
    }
  }, [visible]);

  const loadMetadata = async () => {
    try {
      const [accs, cats] = await Promise.all([
        accountsApi.getAccounts(),
        categoriesApi.getCategories('EXPENSE'),
      ]);
      const active = accs.filter((a) => !a.isArchived);
      setAccounts(active);
      setCategories(cats.filter((c) => !c.isArchived));

      if (active.length > 0) {
        const spendable = active.find((a) => !a.excludeFromSafeToSpend);
        setAccountId(spendable ? spendable.id : active[0].id);
      }
    } catch {
      // ignore
    }
  };

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === accountId);
  }, [accounts, accountId]);

  const calculatedDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dueDateDaysOffset);
    d.setHours(12, 0, 0, 0);
    return d;
  }, [dueDateDaysOffset]);

  const isPastDate = dueDateDaysOffset < 0;

  const isValid = useMemo(() => {
    const num = parseFloat(amount);
    return name.trim().length >= 1 && !isNaN(num) && num > 0;
  }, [name, amount]);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = buildCreateCommitmentPayload({
        name,
        amount,
        dueDate: calculatedDueDate,
        recurrence,
        accountId: accountId || undefined,
        categoryId: categoryId || undefined,
        currency: selectedAccount?.currency || 'EGP',
      });

      await commitmentsApi.createCommitment(payload as any);

      haptics.notificationSuccess();
      showToast('تمت إضافة الالتزام بنجاح');
      onSuccess?.();
      onClose();
    } catch (err) {
      haptics.notificationError();
      setErrorMessage(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={strings.plan.addCommitment}
      isDirty={!!name || !!amount}
      footer={
        <Button
          title={strings.common.save}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isValid || submitting}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name input */}
        <View style={{ marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            اسم الالتزام (إيجار، كهرباء، قسط…)
          </AppText>
          <TextInput
            value={name}
            onChangeText={(txt) => setName(txt.slice(0, 100))}
            placeholder="مثال: إيجار الشقة"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                color: colors.textPrimary,
                paddingHorizontal: 12,
              },
            ]}
          />
        </View>

        {/* Amount display */}
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
            المبلغ المطلوب
          </AppText>
          <View style={styles.amountRow}>
            <AppText variant="amountLg" tone="primary" style={{ writingDirection: 'ltr' }}>
              {toArabicNumberSeparators(amount || '0')}
            </AppText>
            <AppText variant="title3" tone="secondary" style={{ marginStart: 8 }}>
              {selectedAccount?.currency || 'EGP'}
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

        {/* Due Date Presets */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            تاريخ الاستحقاق
          </AppText>
          <View style={styles.chipsRow}>
            {[
              { label: 'النهارده', offset: 0 },
              { label: 'بعد أسبوع', offset: 7 },
              { label: 'بعد أسبوعين', offset: 14 },
              { label: 'أول الشهر الجاي', offset: 25 },
              { label: 'متأخر (امبارح)', offset: -1 },
            ].map((p) => {
              const active = dueDateDaysOffset === p.offset;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => setDueDateDaysOffset(p.offset)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.surfaceSubtle : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {p.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {isPastDate && (
            <AppText
              variant="caption"
              tone="warning"
              style={{ marginTop: 4 }}
            >
              هتتسجّل كمتأخرة لأن تاريخ الاستحقاق في الماضي.
            </AppText>
          )}
        </View>

        {/* Recurrence Frequency */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            التكرار
          </AppText>
          <Segmented
            options={[
              { label: 'مرة واحدة', value: 'NONE' },
              { label: 'شهري', value: 'MONTHLY' },
              { label: 'أسبوعي', value: 'WEEKLY' },
              { label: 'سنوي', value: 'YEARLY' },
            ]}
            selectedValue={recurrence}
            onSelect={(val) => setRecurrence(val as RecurrenceFrequency)}
          />
        </View>

        {/* Linked Account */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            الحساب المرتبط
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {accounts.map((acc) => {
              const active = accountId === acc.id;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => setAccountId(acc.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.surfaceSubtle : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {displayName(acc.name)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Category */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            التصنيف (اختياري)
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => setCategoryId('')}
              style={[
                styles.chip,
                {
                  borderColor: !categoryId ? colors.brand : colors.border,
                  backgroundColor: !categoryId ? colors.surfaceSubtle : colors.surface,
                },
              ]}
            >
              <AppText
                variant="label"
                style={{
                  color: !categoryId ? colors.brand : colors.textPrimary,
                  fontWeight: !categoryId ? '600' : '400',
                }}
              >
                بدون تصنيف
              </AppText>
            </Pressable>

            {categories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.surfaceSubtle : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {displayName(cat.name)}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Keypad */}
        <View style={{ marginTop: spacing.md }}>
          <Keypad value={amount} onChange={setAmount} />
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    height: 44,
    textAlign: 'right',
    fontSize: 14,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
