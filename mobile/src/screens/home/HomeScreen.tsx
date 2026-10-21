import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Screen,
  AppText,
  Money,
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

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

// Signature surface. TODO: replace with a theme token (e.g. colors.slate) once one exists.
const HERO_BG = '#232F42';
const HERO_TEXT = '#F4F6F9';
const HERO_MUTED = 'rgba(244,246,249,0.70)';
const HERO_HAIRLINE = 'rgba(244,246,249,0.16)';
const HERO_TRACK = 'rgba(244,246,249,0.14)';
const HERO_FILL = 'rgba(244,246,249,0.55)';
const HERO_DEFICIT = '#FFB4A8';

const RECENT_TX_LIMIT = 4;
const UPCOMING_LIMIT = 3;
const EMPTY_TX_META = { total: 0, page: 1, limit: RECENT_TX_LIMIT, totalPages: 1 };

/* -------------------------------------------------------------------------- */
/* Pure helpers (no UI, no API)                                               */
/* -------------------------------------------------------------------------- */

/** Safe numeric parse for decimal strings coming from the API. */
const toNumber = (value: string | number | null | undefined): number => {
  const n = typeof value === 'number' ? value : parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
};

/**
 * Share of `part` within `part + other`, clamped to 0..1.
 * Purely a rendering ratio for bars; it is never displayed as a financial metric.
 */
const shareOf = (part: number, other: number): number => {
  const total = Math.abs(part) + Math.abs(other);
  return total > 0 ? Math.min(1, Math.max(0, Math.abs(part) / total)) : 0;
};

const sortCommitments = (list: CommitmentResponseDto[]): CommitmentResponseDto[] =>
  [...list].sort((a, b) => {
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
    if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
};

/** One-shot fade + rise. Uses core Animated with the native driver: no new dependency. */
const useEntrance = (enabled: boolean, reduced: boolean) => {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (!enabled) return;
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enabled, reduced, progress]);
  return {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };
};

/* -------------------------------------------------------------------------- */
/* Presentational components                                                  */
/* -------------------------------------------------------------------------- */

interface SafeToSpendHeroProps {
  summary: DashboardSummaryDto;
  entranceStyle: ReturnType<typeof useEntrance>;
  onExplain: () => void;
  onOpenAccounts: () => void;
  onOpenPlan: () => void;
}

/**
 * The signature region. All figures come from `summary.safeToSpend`; nothing is
 * recalculated here. The bar only visualises liquidity vs. pending commitments.
 */
const SafeToSpendHero = memo(
  ({ summary, entranceStyle, onExplain, onOpenAccounts, onOpenPlan }: SafeToSpendHeroProps) => {
    const { safeToSpend } = summary;
    const currency = summary.baseCurrency;
    const isDeficit = safeToSpend.isDeficit;
    const headline = isDeficit ? safeToSpend.deficitAmount : safeToSpend.safeToSpend;
    const committedShare = shareOf(
      toNumber(safeToSpend.totalPendingCommitments),
      toNumber(safeToSpend.totalLiquidFunds),
    );
    const amountText = formatMoney(headline, currency);

    return (
      <Animated.View style={[styles.hero, { backgroundColor: HERO_BG }, entranceStyle]}>
        <View style={styles.heroTop}>
          <AppText variant="label" style={{ color: HERO_MUTED }}>
            المتاح للصرف بأمان
          </AppText>
          <Pressable
            onPress={onExplain}
            hitSlop={12}
            style={styles.explainerButton}
            accessibilityRole="button"
            accessibilityLabel="اعرف طريقة حساب المتاح للصرف"
          >
            <Icon name="information-circle-outline" size={20} color={HERO_MUTED} />
          </Pressable>
        </View>

        <View
          accessible
          accessibilityLabel={`${isDeficit ? 'عجز' : 'المتاح للصرف'} ${amountText}`}
          style={styles.heroAmountWrap}
        >
          {isDeficit && (
            <View style={styles.deficitTag}>
              <Icon name="alert-circle-outline" size={16} color={HERO_DEFICIT} />
              <AppText variant="caption" style={{ color: HERO_DEFICIT, marginStart: 4 }}>
                عجز
              </AppText>
            </View>
          )}
          <AppText
            variant="title1"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[styles.heroAmount, { color: isDeficit ? HERO_DEFICIT : HERO_TEXT }]}
          >
            {amountText}
          </AppText>
        </View>

        <AppText variant="caption" style={[styles.heroCaption, { color: HERO_MUTED }]}>
          {isDeficit ? strings.home.deficitSentence : 'المتاح بعد الالتزامات المسجلة حتى نهاية الشهر'}
        </AppText>

        {/* Liquidity split: filled portion = commitments' share of liquidity */}
        <View
          style={[styles.track, { backgroundColor: HERO_TRACK }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View
            style={[
              styles.trackFill,
              { backgroundColor: HERO_FILL, width: `${Math.round(committedShare * 100)}%` },
            ]}
          />
        </View>

        <View style={[styles.heroBreakdown, { borderTopColor: HERO_HAIRLINE }]}>
          <Pressable
            onPress={onOpenAccounts}
            style={styles.heroCell}
            accessibilityRole="button"
            accessibilityLabel={`السيولة ${formatMoney(safeToSpend.totalLiquidFunds, currency)}، افتح الحسابات`}
          >
            <AppText variant="caption" style={{ color: HERO_MUTED }}>
              السيولة
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit style={{ color: HERO_TEXT }}>
              {formatMoney(safeToSpend.totalLiquidFunds, currency)}
            </AppText>
          </Pressable>
          <View style={[styles.heroDivider, { backgroundColor: HERO_HAIRLINE }]} />
          <Pressable
            onPress={onOpenPlan}
            style={styles.heroCell}
            accessibilityRole="button"
            accessibilityLabel={`الالتزامات ${formatMoney(safeToSpend.totalPendingCommitments, currency)}، افتح الخطة`}
          >
            <AppText variant="caption" numberOfLines={1} style={{ color: HERO_MUTED }}>
              التزامات حتى نهاية الشهر
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit style={{ color: HERO_TEXT }}>
              {formatMoney(safeToSpend.totalPendingCommitments, currency)}
            </AppText>
          </Pressable>
        </View>
      </Animated.View>
    );
  },
);

interface MonthFlowProps {
  income: string;
  expenses: string;
  currency: string;
  onPress?: () => void;
}

/** Income vs. expenses for the month as one typographic strip with a proportion bar. */
const MonthFlow = memo(({ income, expenses, currency, onPress }: MonthFlowProps) => {
  const { colors } = useTheme();
  const incomeShare = shareOf(toNumber(income), toNumber(expenses));
  const hasActivity = toNumber(income) > 0 || toNumber(expenses) > 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.flow}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`دخل الشهر ${formatMoney(income, currency)}، مصروف الشهر ${formatMoney(expenses, currency)}`}
    >
      <View style={styles.flowRow}>
        <View style={styles.flowCol}>
          <View style={styles.flowLabel}>
            <Icon name="arrow-down-circle-outline" size={14} color={colors.textSecondary} />
            <AppText variant="caption" tone="secondary" style={{ marginStart: 4 }}>
              دخل الشهر
            </AppText>
          </View>
          <Money value={income} currency={currency} variant="amountMd" tone="positive" />
        </View>
        <View style={styles.flowCol}>
          <View style={styles.flowLabel}>
            <Icon name="arrow-up-circle-outline" size={14} color={colors.textSecondary} />
            <AppText variant="caption" tone="secondary" style={{ marginStart: 4 }}>
              مصروف الشهر
            </AppText>
          </View>
          <Money value={expenses} currency={currency} variant="amountMd" tone="negative" />
        </View>
      </View>
      {hasActivity && (
        <View
          style={[styles.flowTrack, { backgroundColor: colors.sunken }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={{ flex: incomeShare, backgroundColor: colors.textSecondary, opacity: 0.55 }} />
          <View style={{ flex: 1 - incomeShare, backgroundColor: colors.textPrimary }} />
        </View>
      )}
    </Pressable>
  );
});

interface CommitmentItemProps {
  commitment: CommitmentResponseDto;
  onPay: (c: CommitmentResponseDto) => void;
}

const CommitmentItem = memo(({ commitment: c, onPay }: CommitmentItemProps) => {
  const { colors, radii } = useTheme();
  const due = getRelativeDueDateLabel(c.dueDate);
  const afterMonth = isDueAfterEndOfMonth(c.dueDate);

  return (
    <View style={styles.commitmentRow}>
      <View style={styles.commitmentMain}>
        <View style={[styles.dateStub, { backgroundColor: colors.sunken, borderRadius: radii.xs }]}>
          {due.isOverdue && <Icon name="alert-circle-outline" size={13} color={colors.textPrimary} />}
          <AppText variant="caption" tone={due.isOverdue ? 'negative' : 'secondary'} numberOfLines={1}>
            {due.label}
          </AppText>
        </View>
        <View style={styles.commitmentName}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {c.name}
          </AppText>
          {afterMonth && (
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
          tone={due.isOverdue ? 'negative' : 'primary'}
          variant="amountSm"
        />
        <Button title="سداد" variant="secondary" onPress={() => onPay(c)} style={styles.payButton} />
      </View>
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

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
  const reducedMotion = useReducedMotion();

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
        getTransactions({ limit: RECENT_TX_LIMIT }).catch(() => ({ data: [], meta: EMPTY_TX_META })),
        getProfile().catch(() => null),
      ]);
      setSummary(sumData);
      setAccounts(accData);
      setCommitments(commData);
      setRecentTransactions(txData.data || []);
      if (profData) setProfile(profData);
    } catch {
      // Required data failed. Existing data (if any) stays visible, flagged as possibly stale.
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const openExplainer = useCallback(() => setShowExplainer(true), []);
  const closeExplainer = useCallback(() => setShowExplainer(false), []);
  const handleQuickAdd = useCallback(() => onOpenQuickAdd(), [onOpenQuickAdd]);

  const firstName = profile?.displayName?.split(' ')[0] || '';
  const topUpcoming = useMemo(
    () => sortCommitments(commitments).slice(0, UPCOMING_LIMIT),
    [commitments],
  );
  const hasNoAccounts = !loading && !loadError && accounts.length === 0;
  const showContent = !loading && !!summary && !hasNoAccounts;

  const todayArabic = useMemo(
    () =>
      new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(
        new Date(),
      ),
    [],
  );

  const entranceStyle = useEntrance(showContent, reducedMotion);

  return (
    <Screen withBottomInset={false}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: spacing.lg }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.forest} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header: greeting + date, two actions. Physical layout kept from the original. */}
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
          <View style={styles.skeletonStack}>
            <Skeleton height={236} width="100%" radius={24} />
            <Skeleton height={72} width="100%" />
            <Skeleton height={176} width="100%" />
          </View>
        ) : !summary ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <Icon name="cloud-offline-outline" size={36} color={colors.textSecondary} />
            <AppText variant="title3" style={styles.emptyTitle}>
              تعذّر تحميل ملخصك المالي
            </AppText>
            <AppText variant="body" tone="secondary" style={styles.emptyBody}>
              تأكد من اتصالك بالإنترنت وحاول مرة أخرى.
            </AppText>
            <Button title="إعادة المحاولة" onPress={handleRetry} />
          </View>
        ) : hasNoAccounts ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
            <Icon name="wallet-outline" size={40} color={colors.textDisabled} />
            <AppText variant="title2" style={styles.emptyTitle}>
              {strings.home.noAccountsTitle}
            </AppText>
            <AppText variant="body" tone="secondary" style={styles.emptyBody}>
              سجّل حساباتك وأرصدتك لبدء حساب المبلغ الآمن للصرف فوراً.
            </AppText>
            <Button title={strings.home.addFirstAccount} onPress={onAddAccount} />
          </View>
        ) : (
          <>
            {loadError && (
              <Pressable
                onPress={handleRetry}
                style={[styles.staleBanner, { backgroundColor: colors.sunken }]}
                accessibilityRole="button"
                accessibilityLabel="تعذّر التحديث. اضغط لإعادة المحاولة"
              >
                <Icon name="cloud-offline-outline" size={16} color={colors.textSecondary} />
                <AppText variant="caption" tone="secondary" style={{ marginStart: 8, flex: 1 }}>
                  تعذّر التحديث، والأرقام المعروضة قد لا تكون الأحدث. اضغط للمحاولة مجدداً.
                </AppText>
              </Pressable>
            )}

            <SafeToSpendHero
              summary={summary}
              entranceStyle={entranceStyle}
              onExplain={openExplainer}
              onOpenAccounts={onNavigateToAccounts}
              onOpenPlan={onNavigateToPlan}
            />

            <MonthFlow
              income={summary.monthlySummary.income}
              expenses={summary.monthlySummary.expenses}
              currency={summary.baseCurrency}
              onPress={onNavigateToTransactions}
            />

            <View style={styles.section}>
              <SectionHeading title="أحدث المعاملات" actionTitle="السجل" onAction={onNavigateToTransactions} />
              {recentTransactions.length === 0 ? (
                <View style={[styles.emptySectionBox, { borderColor: colors.border }]}>
                  <AppText variant="caption" tone="secondary">
                    لا توجد معاملات مسجلة مؤخراً
                  </AppText>
                  <Button title="سجّل معاملة" variant="text" onPress={handleQuickAdd} />
                </View>
              ) : (
                recentTransactions.map((tx) => (
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

            <View style={styles.section}>
              <SectionHeading
                title={strings.home.upcomingSection}
                actionTitle={commitments.length > UPCOMING_LIMIT ? `الكل (+${commitments.length - UPCOMING_LIMIT})` : 'الخطة'}
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
                topUpcoming.map((c) => <CommitmentItem key={c.id} commitment={c} onPay={onPayCommitment} />)
              )}
            </View>

            <View style={styles.footnotes}>
              {summary.totalProtectedSavings !== '0.00' && (
                <Pressable onPress={onNavigateToAccounts} style={styles.footnoteRow} accessibilityRole="button">
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
                <Pressable onPress={onNavigateToAccounts} style={styles.footnoteRow} accessibilityRole="button">
                  <Icon name="globe-outline" size={13} color={colors.textSecondary} />
                  <AppText variant="caption" tone="secondary" style={{ marginStart: 6, flex: 1 }}>
                    {strings.home.otherCurrenciesNotice}
                  </AppText>
                </Pressable>
              )}
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SafeToSpendExplainerSheet
        visible={showExplainer}
        onClose={closeExplainer}
        summary={summary}
        accounts={accounts}
        commitments={commitments}
      />
    </Screen>
  );
};

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  scrollContent: { paddingTop: 8 },

  headerRow: { position: 'relative', minHeight: 48, marginBottom: 18 },
  headerGreeting: { minWidth: 0, marginLeft: 96, alignItems: 'flex-end' },
  dateLabel: { marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, position: 'absolute', left: 0, top: 4 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  skeletonStack: { gap: 16, marginTop: 4 },
  staleBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 12 },

  // Hero
  hero: { borderRadius: 24, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  explainerButton: { width: 44, height: 32, alignItems: 'center', justifyContent: 'center' },
  heroAmountWrap: { marginTop: 8, alignItems: 'flex-start' },
  deficitTag: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  heroAmount: { fontSize: 40, lineHeight: 52, fontWeight: '700', alignSelf: 'stretch' },
  heroCaption: { marginTop: 2, marginBottom: 16 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  trackFill: { height: 4, borderRadius: 2 },
  heroBreakdown: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  heroCell: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start', minHeight: 44, justifyContent: 'center' },
  heroDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 14 },

  // Month flow
  flow: { marginTop: 20, marginBottom: 8, gap: 12 },
  flowRow: { flexDirection: 'row', gap: 20 },
  flowCol: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  flowLabel: { flexDirection: 'row', alignItems: 'center' },
  flowTrack: { height: 4, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },

  section: { marginTop: 16, marginBottom: 4 },
  emptySectionBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Commitments
  commitmentRow: { paddingVertical: 12, gap: 8 },
  commitmentMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commitmentName: { flex: 1, minWidth: 0, gap: 2 },
  dateStub: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    maxWidth: 110,
  },
  commitmentActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingStart: 62 },
  payButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 4 },

  footnotes: { marginTop: 12, gap: 6 },
  footnoteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },

  emptyCard: { alignItems: 'center', padding: 28, marginTop: 12, borderWidth: 1 },
  emptyTitle: { textAlign: 'center', marginTop: 12, marginBottom: 8 },
  emptyBody: { textAlign: 'center', marginBottom: 20 },
  bottomSpacer: { height: 28 },
});