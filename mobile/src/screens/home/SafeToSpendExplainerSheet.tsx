import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../theme';
import { Sheet } from '../../components/primitives/Sheet';
import { AppText } from '../../components/primitives/AppText';
import { Money } from '../../components/primitives/Money';
import { Divider } from '../../components/primitives/Divider';
import { DashboardSummaryDto, AccountResponseDto, CommitmentResponseDto } from '../../api/types';
import { formatMoney } from '../../utils/format';
import { displayName } from '../../utils/names';
import { formatCommitmentsCount } from '../../utils/plural';

interface SafeToSpendExplainerSheetProps {
  visible: boolean;
  onClose: () => void;
  summary: DashboardSummaryDto | null;
  accounts: AccountResponseDto[];
  commitments: CommitmentResponseDto[];
}

export const SafeToSpendExplainerSheet: React.FC<SafeToSpendExplainerSheetProps> = ({
  visible,
  onClose,
  summary,
  accounts,
  commitments,
}) => {
  const { colors, spacing } = useTheme();

  if (!summary) return null;

  const baseCurr = summary.baseCurrency;
  const liquid = summary.safeToSpend.totalLiquidFunds;
  const pending = summary.safeToSpend.totalPendingCommitments;
  const spendable = summary.safeToSpend.safeToSpend;

  // Accounts entering the calculation: active, base currency, not excluded
  const qualifyingAccounts = accounts.filter(
    (acc) => !acc.isArchived && acc.currency === baseCurr && !acc.excludeFromSafeToSpend,
  );

  // Commitments entering calculation: pending or overdue, base currency
  const qualifyingCommitments = commitments.filter(
    (c) =>
      c.currency === baseCurr &&
      (c.status === 'PENDING' || c.status === 'OVERDUE'),
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="إزاي اتحسبت؟">
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        {/* Core Equation Box */}
        <View style={[styles.equationBox, { backgroundColor: colors.sunken, padding: spacing.lg }]}>
          <AppText variant="bodyStrong" style={styles.equationText}>
            رصيدك المتاح ({formatMoney(liquid, baseCurr)})
          </AppText>
          <AppText variant="bodyStrong" tone="warning" style={styles.equationText}>
            − التزامات الشهر ({formatMoney(pending, baseCurr)})
          </AppText>
          <Divider inset={false} style={{ marginVertical: 8 }} />
          <AppText variant="title2" tone={summary.safeToSpend.isDeficit ? 'negative' : 'positive'} style={styles.equationText}>
            = {formatMoney(spendable, baseCurr)}
          </AppText>
        </View>

        {/* Section 1: Qualifying Accounts */}
        <View style={styles.section}>
          <AppText variant="heading" style={styles.sectionTitle}>
            الحسابات الداخلة في الحساب
          </AppText>
          {qualifyingAccounts.map((acc) => (
            <View key={acc.id} style={styles.breakdownRow}>
              <AppText variant="body">{displayName(acc.name)}</AppText>
              <Money value={acc.currentBalance} currency={acc.currency} />
            </View>
          ))}
        </View>

        <Divider />

        {/* Section 2: Qualifying Commitments */}
        <View style={styles.section}>
          <AppText variant="heading" style={styles.sectionTitle}>
            الالتزامات الداخلة في الحساب ({formatCommitmentsCount(qualifyingCommitments.length)})
          </AppText>
          {qualifyingCommitments.length === 0 ? (
            <AppText variant="body" tone="secondary" style={styles.emptyText}>
              مفيش التزامات مستحقة حتى نهاية الشهر.
            </AppText>
          ) : (
            qualifyingCommitments.map((c) => (
              <View key={c.id} style={styles.breakdownRow}>
                <AppText variant="body">{c.name}</AppText>
                <Money value={c.amount} currency={c.currency} tone="warning" />
              </View>
            ))
          )}
        </View>

        {/* Footnote */}
        <View style={[styles.footnoteBox, { padding: spacing.md }]}>
          <AppText variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
            الحسابات المحمية والعملات الأخرى مستثناة من هذه المعادلة لضمان عدم صرف أموال مخصصة للادخار أو الطوارئ.
          </AppText>
        </View>
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  equationBox: {
    borderRadius: 8,
    marginBottom: 16,
  },
  equationText: {
    textAlign: 'center',
    marginVertical: 2,
  },
  section: {
    paddingVertical: 12,
  },
  sectionTitle: {
    textAlign: 'right',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  emptyText: {
    textAlign: 'right',
    paddingVertical: 4,
  },
  footnoteBox: {
    marginTop: 16,
    marginBottom: 24,
  },
});
