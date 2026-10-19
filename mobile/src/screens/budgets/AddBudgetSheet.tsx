import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  Keypad,
  Divider,
} from '../../components/primitives';
import { categoriesApi } from '../../api/categories';
import { budgetsApi } from '../../api/budgets';
import { BudgetResponseDto, CategoryResponseDto } from '../../api/types';
import {
  buildCreateBudgetPayload,
  buildUpdateBudgetPayload,
} from '../../utils/payloads';
import { getMonthBoundaries } from '../../utils/dates';
import { toArabicNumberSeparators } from '../../utils/format';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface AddBudgetSheetProps {
  visible: boolean;
  onClose: () => void;
  budgetToEdit?: BudgetResponseDto | null;
  onSuccess?: () => void;
}

export const AddBudgetSheet: React.FC<AddBudgetSheetProps> = ({
  visible,
  onClose,
  budgetToEdit,
  onSuccess,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const isEditMode = !!budgetToEdit;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [periodPreset, setPeriodPreset] = useState<'this_month' | 'next_month' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());

  const [categories, setCategories] = useState<CategoryResponseDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (budgetToEdit) {
        setName(budgetToEdit.name);
        setAmount(budgetToEdit.amount);
        setCategoryId(budgetToEdit.categoryId || '');
        setCustomStartDate(new Date(budgetToEdit.startDate));
        setCustomEndDate(new Date(budgetToEdit.endDate));
        setPeriodPreset('custom');
      } else {
        setName('');
        setAmount('');
        setCategoryId('');
        setPeriodPreset('this_month');
      }
      setErrorMessage(null);
      loadCategories();
    }
  }, [visible, budgetToEdit]);

  const loadCategories = async () => {
    try {
      const cats = await categoriesApi.getCategories('EXPENSE');
      setCategories(cats.filter((c) => !c.isArchived));
    } catch {
      // ignore
    }
  };

  const { calculatedStartDate, calculatedEndDate } = useMemo(() => {
    const now = new Date();
    if (periodPreset === 'this_month') {
      const { start, end } = getMonthBoundaries(now);
      return { calculatedStartDate: start, calculatedEndDate: end };
    } else if (periodPreset === 'next_month') {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const { start, end } = getMonthBoundaries(nextMonth);
      return { calculatedStartDate: start, calculatedEndDate: end };
    } else {
      return { calculatedStartDate: customStartDate, calculatedEndDate: customEndDate };
    }
  }, [periodPreset, customStartDate, customEndDate]);

  const isValid = useMemo(() => {
    const num = parseFloat(amount);
    if (!name.trim() || isNaN(num) || num <= 0) return false;
    if (calculatedStartDate >= calculatedEndDate) return false;
    return true;
  }, [name, amount, calculatedStartDate, calculatedEndDate]);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      if (isEditMode && budgetToEdit) {
        const patchPayload = buildUpdateBudgetPayload({
          name,
          amount,
          categoryId: categoryId || null,
          startDate: calculatedStartDate,
          endDate: calculatedEndDate,
        });

        await budgetsApi.updateBudget(budgetToEdit.id, patchPayload as any);
        haptics.notificationSuccess();
        showToast('تم تحديث الميزانية');
      } else {
        const createPayload = buildCreateBudgetPayload({
          name,
          amount,
          categoryId: categoryId || undefined,
          startDate: calculatedStartDate,
          endDate: calculatedEndDate,
        });

        await budgetsApi.createBudget(createPayload as any);
        haptics.notificationSuccess();
        showToast('تمت إضافة الميزانية');
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

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEditMode ? 'تعديل الميزانية' : strings.plan.addBudget}
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
            اسم الميزانية
          </AppText>
          <TextInput
            value={name}
            onChangeText={(txt) => setName(txt.slice(0, 100))}
            placeholder="مثال: مصاريف الأكل والخروج"
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
            حد الصرف
          </AppText>
          <View style={styles.amountRow}>
            <AppText variant="amountLg" tone="primary" style={{ writingDirection: 'ltr' }}>
              {toArabicNumberSeparators(amount || '0')}
            </AppText>
            <AppText variant="title3" tone="secondary" style={{ marginStart: 8 }}>
              ج.م
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

        {/* Period Presets */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            فترة الميزانية
          </AppText>
          <View style={styles.chipsRow}>
            {[
              { id: 'this_month', label: strings.transactions.thisMonth },
              { id: 'next_month', label: 'الشهر الجاي' },
            ].map((p) => {
              const active = periodPreset === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPeriodPreset(p.id as any)}
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
        </View>

        {/* Category selection */}
        <View style={{ marginTop: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            التصنيف
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => {
                setCategoryId('');
                if (!name) setName('كل المصروفات');
              }}
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
                كل المصروفات
              </AppText>
            </Pressable>

            {categories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setCategoryId(cat.id);
                    if (!name) setName(displayName(cat.name));
                  }}
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
