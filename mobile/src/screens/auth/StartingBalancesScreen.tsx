import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme';
import { Screen } from '../../components/primitives/Screen';
import { AppText } from '../../components/primitives/AppText';
import { Field } from '../../components/primitives/Field';
import { Button } from '../../components/primitives/Button';
import { getAccounts, createAccount, deleteAccount } from '../../api/accounts';
import { AccountResponseDto } from '../../api/types';
import { normalizeAmountInput, toArabicNumberSeparators } from '../../utils/format';
import { toCents } from '../../utils/money';

interface StartingBalancesScreenProps {
  onComplete: () => void;
}

export const StartingBalancesScreen: React.FC<StartingBalancesScreenProps> = ({
  onComplete,
}) => {
  const { spacing, colors } = useTheme();

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
      // Decision #1 in Appendix A: For the auto-created untouched Cash account with 0.00,
      // if the user entered an initial amount > 0, delete and recreate with entered opening balance.
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
      onComplete();
    } catch {
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={[styles.container, { padding: spacing.xl }]}>
      <View style={styles.topSection}>
        <AppText variant="title1" style={styles.title}>
          رصيدك دلوقتي كام؟
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.subtitle}>
          ده بيبقى رصيد البداية. مش هتقدر تعدله بعدين، لكن تقدر تصحّح الرصيد في أي وقت.
        </AppText>
      </View>

      <View style={styles.accountsList}>
        {accounts.map((acc) => (
          <View key={acc.id} style={styles.accountRow}>
            <Field
              label={acc.name}
              placeholder="0.00"
              value={toArabicNumberSeparators(balances[acc.id] || '')}
              onChangeText={(val) => {
                const norm = normalizeAmountInput(val);
                setBalances((prev) => ({ ...prev, [acc.id]: norm }));
              }}
              keyboardType="numeric"
              isLtr
              helper={`العملة: ${acc.currency}`}
            />
          </View>
        ))}
      </View>

      <View style={styles.bottomSection}>
        <Button
          title="كمّل"
          onPress={handleComplete}
          loading={saving || loading}
          style={{ width: '100%', marginBottom: spacing.sm }}
        />
        <Button
          title="بعدين (تخطي)"
          variant="text"
          onPress={onComplete}
          style={{ width: '100%' }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  topSection: {
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
    textAlign: 'right',
  },
  subtitle: {
    textAlign: 'right',
    lineHeight: 24,
  },
  accountsList: {
    marginBottom: 32,
  },
  accountRow: {
    marginBottom: 8,
  },
  bottomSection: {
    width: '100%',
    paddingBottom: 16,
  },
});
