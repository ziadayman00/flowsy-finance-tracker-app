import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Switch,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  Segmented,
  Divider,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { AccountResponseDto, AccountType } from '../../api/types';
import {
  buildCreateAccountPayload,
  buildUpdateAccountPayload,
} from '../../utils/payloads';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';
import { normalizeAmountInput, toArabicNumberSeparators } from '../../utils/format';

const CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'KWD', 'GBP'];

interface AddAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  accountToEdit?: AccountResponseDto | null;
  onSuccess?: () => void;
  baseCurrency?: string;
}

export const AddAccountSheet: React.FC<AddAccountSheetProps> = ({
  visible,
  onClose,
  accountToEdit,
  onSuccess,
  baseCurrency = 'EGP',
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const isEditMode = !!accountToEdit;

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('CASH');
  const [currency, setCurrency] = useState(baseCurrency);
  const [initialBalance, setInitialBalance] = useState('');
  const [excludeFromSafeToSpend, setExcludeFromSafeToSpend] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type);
        setCurrency(accountToEdit.currency);
        setExcludeFromSafeToSpend(accountToEdit.excludeFromSafeToSpend);
      } else {
        setName('');
        setType('CASH');
        setCurrency(baseCurrency);
        setInitialBalance('');
        setExcludeFromSafeToSpend(false);
      }
      setErrorMessage(null);
    }
  }, [visible, accountToEdit, baseCurrency]);

  const isValid = useMemo(() => {
    if (!name.trim() || name.trim().length > 50) return false;
    if (!isEditMode && initialBalance) {
      const num = parseFloat(initialBalance);
      if (isNaN(num)) return false;
    }
    return true;
  }, [name, initialBalance, isEditMode]);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      if (isEditMode && accountToEdit) {
        const patchPayload = buildUpdateAccountPayload({
          name,
          type,
          excludeFromSafeToSpend,
        });

        await accountsApi.updateAccount(accountToEdit.id, patchPayload as any);
        haptics.notificationSuccess();
        showToast('تم تعديل بيانات الحساب');
      } else {
        const createPayload = buildCreateAccountPayload({
          name,
          type,
          currency,
          initialBalance: initialBalance ? parseFloat(initialBalance) : 0,
          excludeFromSafeToSpend,
        });

        await accountsApi.createAccount(createPayload as any);
        haptics.notificationSuccess();
        showToast('تمت إضافة الحساب بنجاح');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      haptics.notificationError();
      const msg = getErrorMessage(err);
      if (msg.includes('409') || msg.includes('مستخدم') || msg.includes('exist')) {
        setErrorMessage('الاسم ده مستخدم قبل كده لحساب تاني');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEditMode ? 'تعديل الحساب' : strings.accounts.addAccount}
      isDirty={!!name || !!initialBalance}
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
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name field */}
        <View style={{ marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            اسم الحساب
          </AppText>
          <TextInput
            value={name}
            onChangeText={(txt) => setName(txt.slice(0, 50))}
            placeholder="مثال: فودافون كاش، البنك الأهلي"
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

        {/* Account Type */}
        <View style={{ marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            نوع الحساب
          </AppText>
          <Segmented
            options={[
              { label: 'كاش', value: 'CASH' },
              { label: 'بنك', value: 'BANK' },
              { label: 'توفير', value: 'SAVINGS' },
              { label: 'محفظة', value: 'MOBILE_WALLET' },
            ]}
            selectedValue={type}
            onSelect={(val) => {
              const newType = val as AccountType;
              setType(newType);
              if (newType === 'SAVINGS' && !isEditMode) {
                setExcludeFromSafeToSpend(true);
              }
            }}
          />
        </View>

        {/* Currency (create only) */}
        {!isEditMode && (
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
              العملة
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {CURRENCIES.map((cur) => {
                const active = currency === cur;
                return (
                  <Pressable
                    key={cur}
                    onPress={() => setCurrency(cur)}
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
                      {cur}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>

            {currency !== baseCurrency && (
              <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                حسابات بعملة تانية مش بتدخل في حساب تقدر تصرف كام.
              </AppText>
            )}
          </View>
        )}

        {/* Initial Balance (create only) */}
        {!isEditMode && (
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
              رصيد البداية
            </AppText>
            <TextInput
              value={toArabicNumberSeparators(initialBalance)}
              onChangeText={(value) => setInitialBalance(normalizeAmountInput(value))}
              placeholder="٠٫٠٠"
              keyboardType="decimal-pad"
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
            <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              مش هتقدر تعدل رصيد البداية بعد الحفظ (لكن تقدر تصحّح الرصيد بحركة تعديل).
            </AppText>
          </View>
        )}

        {/* Protected Switch */}
        <View
          style={[
            styles.switchRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={{ flex: 1, marginEnd: 12 }}>
            <AppText variant="bodyStrong">
              حساب محمي
            </AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              مش داخل في حساب تقدر تصرف كام (مناسب للتوفير والطوارئ)
            </AppText>
          </View>

          <Switch
            value={excludeFromSafeToSpend}
            onValueChange={setExcludeFromSafeToSpend}
            trackColor={{ false: colors.border, true: colors.brand }}
          />
        </View>

        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.negativeMuted,
                borderRadius: radii.sm,
                borderColor: colors.negative,
                marginBottom: spacing.md,
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

        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    height: 44,
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
  },
});
