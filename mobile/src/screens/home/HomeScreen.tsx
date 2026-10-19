import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Screen,
  AppText,
  Money,
  AnimatedBalance,
  Button,
  Icon,
  LedgerRow,
  SectionHeading,
  Skeleton,
} from '../../components/primitives';
import { SafeToSpendExplainerSheet } from './SafeToSpendExplainerSheet';

import { getDashboardSummary } from '../../api/dashboard';
import { getAccounts } from '../../api/accounts';
import { getActiveCommitments } from '../../api/commitments';
import { getTransactions } from '../../api/transactions';
import { getProfile } from '../../api/auth';
import {
  DashboardSummaryDto,
  AccountResponseDto,
  CommitmentResponseDto,
  TransactionResponseDto,
  UserProfileDto,
  TransactionType,
} from '../../api/types';
import { formatMoney } from '../../utils/format';
import { getRelativeDueDateLabel, isDueAfterEndOfMonth } from '../../utils/dates';
import { strings } from '../../utils/strings.ar';

interface HomeScreenProps {
  onOpenQuickAdd: (type?: TransactionType) => void;
  onOpenVoiceEntry?: () => void;
  onPayCommitment: (commitment: CommitmentResponseDto) => void;
  onNavigateToPlan: () => void;
  onNavigateToAccounts: () => void;
  onNavigateToSettings: () => void;
  onAddAccount: () => void;
  onNavigateToTransactions?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenQuickAdd,
  onOpenVoiceEntry,
  onPayCommitment,
  onNavigateToPlan,
  onNavigateToAccounts,
  onNavigateToSettings,
  onAddAccount,
  onNavigateToTransactions,
}) => {
  const { colors, spacing, radii } = useTheme();

  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [commitments, setCommitments] = useState<CommitmentResponseDto[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionResponseDto[]>([]);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
      const [sumData, accData, commData, txData, profData] = await Promise.all([
        getDashboardSummary(),
        getAccounts(false),
        getActiveCommitments(),
        getTransactions({ limit: 4 }).catch(() => ({ data: [], meta: { total: 0, page: 1, limit: 4, totalPages: 1 } })),
        getProfile().catch(() => null),
      ]);
      setSummary(sumData);
      setAccounts(accData);
      setCommitments(commData);
      setRecentTransactions(txData.data || []);
      if (profData) setProfile(profData);
    } catch {
      // Keep the screen actionable when the required dashboard data is unavailable.
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const firstName = profile?.displayName?.split(' ')[0] || '';

  const sortedUpcoming = [...commitments].sort((a, b) => {
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
    if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const topUpcoming = sortedUpcoming.slice(0, 3);
  const hasNoAccounts = !loading && accounts.length === 0;

  const todayArabic = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <Screen withBottomInset={false}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.forest}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerGreeting}>
            <AppText variant="title2" numberOfLines={1}>
              {firstName ? `أهلاً، ${firstName}` : 'Flowsy'}
            </AppText>
            <AppText variant="caption" tone="secondary" style={styles.dateLabel}>
              {todayArabic}
            </AppText>
          </View>

          <View style={styles.headerActions}>
            {onOpenVoiceEntry && (
              <Pressable
                onPress={onOpenVoiceEntry}
                style={[styles.iconButton, { backgroundColor: colors.sunken }]}
                accessibilityRole="button"
                accessibilityLabel="تسجيل معاملة بالصوت"
              >
                <Icon name="mic-outline" size={18} color={colors.textPrimary} />
              </Pressable>
            )}
            <Pressable
              onPress={onNavigateToSettings}
              style={[styles.iconButton, { backgroundColor: colors.sunken }]}
              accessibilityRole="button"
              accessibilityLabel="فتح الإعدادات"
            >
              <Icon name="person-outline" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Skeleton height={168} width="100%" radius={22} />
            <Skeleton height={64} width="100%" />
            <Skeleton height={160} width="100%" />
          </View>
        ) : loadError ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <Icon name="cloud-offline-outline" size={36} color={colors.textSecondary} />
            <AppText variant="title3" style={{ textAlign: 'center', marginTop: 12, marginBottom: 6 }}>
              تعذّر تحميل ملخصك المالي
            </AppText>
            <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginBottom: 18 }}>
              تأكد من اتصالك بالإنترنت وحاول مرة أخرى.
            </AppText>
            <Button title="إعادة المحاولة" onPress={loadData} />
          </View>
        ) : hasNoAccounts ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <Icon name="wallet-outline" size={40} color={colors.textDisabled} />
            <AppText variant="title2" style={{ textAlign: 'center', marginTop: 12, marginBottom: 8 }}>
              {strings.home.noAccountsTitle}
            </AppText>
            <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginBottom: 20 }}>
              سجّل حساباتك وأرصدتك لبدء حساب المبلغ الآمن للصرف فوراً.
            </AppText>
            <Button title={strings.home.addFirstAccount} onPress={onAddAccount} />
          </View>
        ) : summary ? (
          <>
            <View style={[styles.safeOverview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.safeHeroHeader}>
                <View style={styles.heroLabelGroup}>
                  <View style={[styles.heroAccent, { backgroundColor: colors.brand }]} />
                  <AppText variant="label" tone="secondary">المتاح للصرف بأمان</AppText>
                </View>
                <Pressable onPress={() => setShowExplainer(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="اعرف طريقة حساب المتاح للصرف" style={styles.explainerButton}>
                  <Icon name="information-circle-outline" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <AnimatedBalance
                value={summary.safeToSpend.isDeficit ? summary.safeToSpend.deficitAmount : summary.safeToSpend.safeToSpend}
                currency={summary.baseCurrency} variant="amountHero" dimDecimals
                tone={summary.safeToSpend.isDeficit ? 'negative' : 'primary'}
                style={styles.heroBalance}
              />
              <AppText variant="caption" tone="secondary" style={styles.heroValueCaption}>
                {summary.safeToSpend.isDeficit ? strings.home.deficitSentence : 'المتاح بعد الالتزامات المسجلة حتى نهاية الشهر'}
              </AppText>

              <View style={[styles.safeBreakdown, { borderTopColor: colors.border }]}>
                <Pressable onPress={onNavigateToAccounts} style={styles.safeBreakdownItem} accessibilityRole="button" accessibilityLabel={`السيولة ${formatMoney(summary.safeToSpend.totalLiquidFunds, summary.baseCurrency)}، افتح الحسابات`}>
                  <AppText variant="caption" tone="secondary">السيولة</AppText>
                  <Money value={summary.safeToSpend.totalLiquidFunds} currency={summary.baseCurrency} variant="amountSm" tone="primary" />
                </Pressable>
                <Pressable onPress={onNavigateToPlan} style={[styles.safeBreakdownItem, styles.safeBreakdownItemSecond, { borderStartColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`الالتزامات ${formatMoney(summary.safeToSpend.totalPendingCommitments, summary.baseCurrency)}، افتح الخطة`}>
                  <AppText variant="caption" tone="secondary" numberOfLines={1}>التزامات حتى نهاية الشهر</AppText>
                  <Money value={summary.safeToSpend.totalPendingCommitments} currency={summary.baseCurrency} variant="amountSm" tone="primary" />
                </Pressable>
              </View>

            </View>

            <View style={styles.statsRow}>
              <Pressable style={styles.statItem} onPress={onNavigateToTransactions}>
                <AppText variant="caption" tone="secondary">
                  دخل الشهر
                </AppText>
                <Money
                  value={summary.monthlySummary.income}
                  currency={summary.baseCurrency}
                  variant="amountMd"
                  tone="positive"
                />
              </Pressable>
              <Pressable style={styles.statItem} onPress={onNavigateToTransactions}>
                <AppText variant="caption" tone="secondary">
                  مصروف الشهر
                </AppText>
                <Money
                  value={summary.monthlySummary.expenses}
                  currency={summary.baseCurrency}
                  variant="amountMd"
                  tone="negative"
                />
              </Pressable>
            </View>

            <View style={styles.sectionWrapper}>
              <SectionHeading
                title="أحدث المعاملات"
                actionTitle="السجل"
                onAction={onNavigateToTransactions}
              />

              {recentTransactions.length === 0 ? (
                <View style={[styles.emptySectionBox, { borderColor: colors.border }]}>
                  <AppText variant="caption" tone="secondary">
                    لا توجد معاملات مسجلة مؤخراً
                  </AppText>
                  <Button title="سجّل معاملة" variant="text" onPress={onOpenQuickAdd} />
                </View>
              ) : (
                recentTransactions.map((tx, idx) => (
                  <LedgerRow
                    key={tx.id}
                    title={tx.note || tx.category?.name || 'معاملة مالية'}
                    categoryName={tx.category?.name}
                    categoryIcon={tx.category?.icon}
                    accountName={tx.account?.name}
                    amount={tx.amount}
                    type={tx.type}
                    currency={tx.currency || summary.baseCurrency}
                    hasBottomLine={false}
                    compact
                    onPress={onNavigateToTransactions}
                  />
                ))
              )}
            </View>

            <View style={styles.sectionWrapper}>
              <SectionHeading
                title={strings.home.upcomingSection}
                actionTitle={commitments.length > 3 ? `الكل (+${commitments.length - 3})` : 'الخطة'}
                onAction={onNavigateToPlan}
              />

              {topUpcoming.length === 0 ? (
                <View style={[styles.emptySectionBox, { borderColor: colors.border }]}>
                  <AppText variant="caption" tone="secondary">
                    {strings.home.noCommitments}
                  </AppText>
                  <Button title="ضيف التزام" variant="text" onPress={onNavigateToPlan} />
                </View>
              ) : (
                topUpcoming.map((c) => {
                  const dueInfo = getRelativeDueDateLabel(c.dueDate);
                  const isAfterMonth = isDueAfterEndOfMonth(c.dueDate);

                  return (
                    <View
                      key={c.id}
                    style={styles.commitmentRow}
                    >
                      <View style={styles.commitmentMainRow}>
                        <View style={[styles.dateStub, { backgroundColor: colors.sunken, borderRadius: radii.xs }]}>
                          <AppText variant="caption" tone={dueInfo.isOverdue ? 'negative' : 'secondary'}>
                            {dueInfo.label}
                          </AppText>
                        </View>
                        <View style={styles.commitmentName}>
                          <AppText variant="bodyStrong" numberOfLines={2}>
                            {c.name}
                          </AppText>
                          {isAfterMonth && (
                            <AppText variant="caption" tone="secondary" numberOfLines={1}>
                              {strings.home.afterMonthEndNotice}
                            </AppText>
                          )}
                        </View>
                      </View>

                      <View style={styles.commitmentActions}>
                        <Money
                          value={c.amount}
                          currency={c.currency}
                          tone={dueInfo.isOverdue ? 'negative' : 'primary'}
                          variant="amountSm"
                        />
                        <Button
                          title="سداد"
                          variant="secondary"
                          onPress={() => onPayCommitment(c)}
                          style={styles.paySmallBtn}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.footnotesSection}>
              {summary.totalProtectedSavings !== '0.00' && (
                <Pressable onPress={onNavigateToAccounts} style={styles.footnoteRow}>
                  <Icon name="lock-closed-outline" size={13} color={colors.textSecondary} />
                  <AppText variant="caption" tone="secondary" style={{ marginStart: 6, flex: 1 }}>
                    {strings.home.protectedSavingsNotice.replace(
                      '{amount}',
                      formatMoney(summary.totalProtectedSavings, summary.baseCurrency),
                    )}
                  </AppText>
                </Pressable>
              )}

              {summary.excludedCurrenciesSummary.length > 0 && (
                <Pressable onPress={onNavigateToAccounts} style={styles.footnoteRow}>
                  <Icon name="globe-outline" size={13} color={colors.textSecondary} />
                  <AppText variant="caption" tone="secondary" style={{ marginStart: 6 }}>
                    {strings.home.otherCurrenciesNotice}
                  </AppText>
                </Pressable>
              )}
            </View>
          </>
        ) : null}

        <View style={{ height: 28 }} />
      </ScrollView>

      <SafeToSpendExplainerSheet
        visible={showExplainer}
        onClose={() => setShowExplainer(false)}
        summary={summary}
        accounts={accounts}
        commitments={commitments}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
  },
  headerRow: {
    position: 'relative',
    minHeight: 48,
    marginBottom: 20,
  },
  headerGreeting: {
    minWidth: 0,
    marginLeft: 96,
    alignItems: 'flex-end',
  },
  dateLabel: {
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'absolute',
    left: 0,
    top: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  safeOverview: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 15,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 14,
  },
  heroBalance: {
    marginTop: 10,
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  safeHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  explainerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  heroValueCaption: {
    marginTop: 5,
    marginBottom: 16,
  },
  safeBreakdown: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  safeBreakdownItem: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  safeBreakdownItemSecond: {
    borderStartWidth: StyleSheet.hairlineWidth,
    paddingStart: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 4,
    marginTop: 10,
    marginBottom: 8,
    gap: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 5,
    paddingHorizontal: 8,
    minWidth: 0,
  },
  sectionWrapper: {
    marginBottom: 8,
  },
  emptySectionBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitmentRow: {
    paddingVertical: 12,
    gap: 8,
  },
  commitmentMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commitmentName: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  commitmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: 62,
  },
  dateStub: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  paySmallBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  footnotesSection: {
    marginTop: 12,
    gap: 6,
  },
  footnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    marginTop: 12,
    borderWidth: 1,
  },
});
