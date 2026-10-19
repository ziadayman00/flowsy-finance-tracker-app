import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/primitives/Screen';
import { AppText } from '../../components/primitives/AppText';
import { Field } from '../../components/primitives/Field';
import { Button } from '../../components/primitives/Button';
import { Card } from '../../components/primitives/Card';
import { Icon } from '../../components/primitives/Icon';
import { getAccounts, createAccount, deleteAccount } from '../../api/accounts';
import { AccountResponseDto } from '../../api/types';
import { normalizeAmountInput, toArabicNumberSeparators } from '../../utils/format';
import { toCents } from '../../utils/money';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';

interface StartingBalancesScreenProps {
  onComplete: () => void;
}

export const StartingBalancesScreen: React.FC<StartingBalancesScreenProps> = ({
  onComplete,
}) => {
  const { spacing, colors, radii } = useTheme();

  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await getAccounts(false);
      setAccounts(data);
      const initialMap: Record<string, string> = {};
      data.forEach((acc) => {
        initialMap[acc.id] = acc.initialBalance === '0.00' ? '' : acc.initialBalance;
      });
      setBalances(initialMap);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      for (const acc of accounts) {
        const enteredVal = balances[acc.id]?.trim();
        if (enteredVal && acc.initialBalance === '0.00' && acc.currentBalance === '0.00') {
          const cents = toCents(enteredVal);
          if (cents > 0n) {
            try {
              await deleteAccount(acc.id);
              await createAccount({
                name: acc.name,
                type: acc.type,
                currency: acc.currency,
                initialBalance: enteredVal,
                excludeFromSafeToSpend: acc.excludeFromSafeToSpend,
              });
            } catch {
              // If delete fails, proceed gracefully
            }
          }
        }
      }
      haptics.notificationSuccess();
      onComplete();
    } catch {
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={[styles.container, { paddingHorizontal: spacing.xl }]}>
      {/* Top Section */}
      <View style={styles.topSection}>
        {/* Step pill */}
        <View style={[styles.stepPill, { backgroundColor: colors.sunken, borderRadius: radii.xs }]}>
          <AppText variant="caption" style={{ color: colors.forest, fontWeight: '700' }}>
            الخطوة الأخيرة • تهيئة الحساب
          </AppText>
        </View>

        <AppText variant="title1" style={styles.title}>
          {strings.auth.startingBalancesTitle}
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.subtitle}>
          {strings.auth.startingBalancesSubtitle}
        </AppText>
      </View>

      {/* Info Notice Box */}
      <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md }]}>
        <Icon name="information-circle-outline" size={20} color={colors.forest} />
        <AppText variant="caption" tone="secondary" style={{ flex: 1, lineHeight: 20 }}>
          هذا المبلغ سيكون رصيد البداية المتاح في حسابك النقدي الأساسي لحساب "المتاح للصرف" بدقة فور دخولك.
        </AppText>
      </View>

      {/* Accounts List */}
      <View style={styles.accountsList}>
        {accounts.map((acc) => (
          <Card key={acc.id} variant="surface" style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <View style={[styles.accountIcon, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
                <Icon name="wallet-outline" size={20} color={colors.forest} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="bodyStrong">{acc.name}</AppText>
                <AppText variant="caption" tone="secondary">العملة: {acc.currency}</AppText>
              </View>
            </View>

            <Field
              label="الرصيد الفعلي الحالي"
              placeholder="0.00"
              value={toArabicNumberSeparators(balances[acc.id] || '')}
              onChangeText={(val) => {
                const norm = normalizeAmountInput(val);
                setBalances((prev) => ({ ...prev, [acc.id]: norm }));
              }}
              keyboardType="decimal-pad"
              isLtr
              containerStyle={{ marginBottom: 0, marginTop: 8 }}
            />
          </Card>
        ))}
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomSection}>
        <Button
          title={strings.auth.saveStartingBalances}
          variant="primary"
          onPress={handleComplete}
          loading={saving || loading}
          style={{ width: '100%', marginBottom: spacing.sm }}
        />
        <Button
          title={strings.auth.skipStartingBalances}
          variant="ghost"
          onPress={() => {
            haptics.impactLight();
            onComplete();
          }}
          style={{ width: '100%' }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  stepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  title: {
    marginBottom: 8,
    textAlign: 'right',
  },
  subtitle: {
    textAlign: 'right',
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  accountsList: {
    marginBottom: 32,
    gap: 12,
  },
  accountCard: {
    padding: 16,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  accountIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    width: '100%',
    paddingBottom: 24,
    paddingTop: 12,
  },
});
