import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Screen,
  AppText,
  Icon,
  Button,
  Card,
  Money,
  SectionHeading,
  Skeleton,
} from '../../components/primitives';
import { commitmentsApi } from '../../api/commitments';
import { budgetsApi } from '../../api/budgets';
import { dashboardApi } from '../../api/dashboard';
import {
  CommitmentResponseDto,
  BudgetResponseDto,
  DashboardSummaryDto,
  TransactionResponseDto,
} from '../../api/types';
import { formatMoney } from '../../utils/format';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { AddCommitmentSheet } from '../commitments/AddCommitmentSheet';
import { CommitmentDetailSheet } from '../commitments/CommitmentDetailSheet';
import { PayCommitmentSheet } from '../commitments/PayCommitmentSheet';
import { AddBudgetSheet } from '../budgets/AddBudgetSheet';
import { BudgetDetailSheet } from '../budgets/BudgetDetailSheet';
import { SavingsGoalsTab } from './SavingsGoalsTab';
import { ForecastTab } from './ForecastTab';

interface PlanScreenProps {
  onViewTransaction?: (tx: TransactionResponseDto) => void;
  onFilterTransactions?: (categoryId?: string, startDate?: string, endDate?: string) => void;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({
  onViewTransaction,
  onFilterTransactions,
}) => {
  const { colors, radii, spacing } = useTheme();

  const [activeSegment, setActiveSegment] = useState<'commitments' | 'budgets' | 'goals' | 'forecast'>(
    'commitments'
  );


  // Data states
  const [commitments, setCommitments] = useState<CommitmentResponseDto[]>([]);
  const [budgets, setBudgets] = useState<BudgetResponseDto[]>([]);
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy toggle states for completed/cancelled commitments
  const [showPaidCommitments, setShowPaidCommitments] = useState(false);
  const [paidCommitments, setPaidCommitments] = useState<CommitmentResponseDto[]>([]);
  const [loadingPaid, setLoadingPaid] = useState(false);

  // Sheet states
  const [addCommitmentVisible, setAddCommitmentVisible] = useState(false);
  const [selectedCommitment, setSelectedCommitment] = useState<CommitmentResponseDto | null>(null);
  const [commitmentDetailVisible, setCommitmentDetailVisible] = useState(false);
  const [payingCommitment, setPayingCommitment] = useState<CommitmentResponseDto | null>(null);
  const [payCommitmentVisible, setPayCommitmentVisible] = useState(false);

  const [addBudgetVisible, setAddBudgetVisible] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetResponseDto | null>(null);
  const [budgetDetailVisible, setBudgetDetailVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetResponseDto | null>(null);

  const baseCurrency = summary?.safeToSpend?.currency || 'EGP';

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [overdueRes, pendingRes, budgetsRes, summaryRes] = await Promise.all([
        commitmentsApi.getCommitments({ status: 'OVERDUE' }),
        commitmentsApi.getCommitments({ status: 'PENDING' }),
        budgetsApi.getBudgets(),
        dashboardApi.getSummary().catch(() => null),
      ]);

      setCommitments([...overdueRes, ...pendingRes]);
      setBudgets(budgetsRes);
      if (summaryRes) setSummary(summaryRes);
    } catch (err) {
      setError(getErrorMessage(err));
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

  const loadPaidCommitments = async () => {
    if (paidCommitments.length > 0) {
      setShowPaidCommitments(!showPaidCommitments);
      return;
    }
    try {
      setLoadingPaid(true);
      const res = await commitmentsApi.getCommitments({ status: 'PAID' });
      setPaidCommitments(res);
      setShowPaidCommitments(true);
    } catch {
      // ignore
    } finally {
      setLoadingPaid(false);
    }
  };

  // Grouped commitments
  const overdueCommitments = useMemo(
    () => commitments.filter((c) => c.status === 'OVERDUE'),
    [commitments]
  );
  const upcomingCommitments = useMemo(
    () => commitments.filter((c) => c.status === 'PENDING'),
    [commitments]
  );

  // Grouped budgets
  const activeBudgets = useMemo(() => {
    const now = new Date();
    return budgets.filter((b) => {
      if (b.isArchived) return false;
      const s = new Date(b.startDate);
      const e = new Date(b.endDate);
      return s <= now && now <= e;
    });
  }, [budgets]);

  const otherBudgets = useMemo(() => {
    const now = new Date();
    return budgets.filter((b) => {
      if (b.isArchived) return false;
      const s = new Date(b.startDate);
      const e = new Date(b.endDate);
      return now < s || now > e;
    });
  }, [budgets]);

  return (
    <Screen hasTabBar scrollable={false}>
      {/* 1. Header Row */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <View>
          <AppText variant="caption" tone="secondary">
            التخطيط والالتزامات
          </AppText>
          <AppText variant="title2">{strings.plan.title}</AppText>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              if (activeSegment === 'commitments') {
                setAddCommitmentVisible(true);
              } else if (activeSegment === 'budgets') {
                setEditingBudget(null);
                setAddBudgetVisible(true);
              }
              // goals tab has its own add button inside the tab
              // forecast tab has no add action
            }}
            style={[
              styles.iconBtn,
              {
                backgroundColor:
                  activeSegment === 'commitments' || activeSegment === 'budgets'
                    ? colors.forest
                    : colors.sunken,
                borderColor:
                  activeSegment === 'commitments' || activeSegment === 'budgets'
                    ? colors.forest
                    : colors.border,
              },
            ]}
            accessibilityRole="button"
            disabled={activeSegment === 'goals' || activeSegment === 'forecast'}
          >
            <Icon
              name="add"
              size={20}
              color={
                activeSegment === 'commitments' || activeSegment === 'budgets'
                  ? colors.onAction
                  : colors.textTertiary
              }
            />
          </Pressable>
        </View>
      </View>

      {/* 2. Editorial Tab Selector (Restrained Underline Switcher) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {(
          [
            { key: 'commitments', label: `الالتزامات (${commitments.length})` },
            { key: 'budgets', label: `الميزانيات (${budgets.length})` },
            { key: 'goals', label: 'أهدافي' },
            { key: 'forecast', label: 'التدفقات' },
          ] as { key: typeof activeSegment; label: string }[]
        ).map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => {
              setActiveSegment(tab.key);
              haptics.impactLight();
            }}
            style={[
              styles.tabItem,
              activeSegment === tab.key && {
                borderBottomColor: colors.forest,
                borderBottomWidth: 2,
              },
            ]}
          >
            <AppText
              variant="bodyStrong"
              tone={activeSegment === tab.key ? 'primary' : 'secondary'}
            >
              {tab.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>


      {/* 3. Tab Content */}
      <ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingHorizontal: spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.forest}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <Skeleton height={60} width="100%" />
            <Skeleton height={50} width="100%" />
            <Skeleton height={50} width="100%" />
            <Skeleton height={50} width="100%" />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle-outline" size={36} color={colors.negative} />
            <AppText variant="body" tone="negative" style={{ marginTop: 8 }}>
              {error}
            </AppText>
            <Button
              title="إعادة المحاولة"
              variant="secondary"
              onPress={loadData}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : activeSegment === 'commitments' ? (
          /* ================= COMMITMENTS VIEW ================= */
          <>
            {/* Overdue Section */}
            {overdueCommitments.length > 0 && (
              <View style={{ marginTop: spacing.md }}>
                <SectionHeading
                  title={strings.plan.overdueSection}
                  style={{ marginTop: spacing.sm }}
                />

                <Card variant="surface" style={{ borderColor: colors.calmRed, padding: 0 }}>
                  {overdueCommitments.map((item, idx) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setSelectedCommitment(item);
                        setCommitmentDetailVisible(true);
                        haptics.impactLight();
                      }}
                      style={[
                        styles.commitmentCardItem,
                        {
                          borderBottomColor: colors.border,
                          borderBottomWidth: idx < overdueCommitments.length - 1 ? StyleSheet.hairlineWidth : 0,
                          padding: spacing.md,
                        },
                      ]}
                    >
                      <View style={styles.planCommitmentTop}>
                        <View style={[styles.dateBadge, { backgroundColor: colors.negativeSubtle }]}>
                          <AppText variant="caption" tone="negative" style={{ fontWeight: '700' }}>متأخر</AppText>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <AppText variant="bodyStrong" numberOfLines={2}>{item.name}</AppText>
                          <AppText variant="caption" tone="negative" numberOfLines={1}>
                            استحقاق {new Date(item.dueDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                          </AppText>
                        </View>
                      </View>

                      <View style={styles.planCommitmentActions}>
                        <Money
                          value={item.amount}
                          currency={item.currency}
                          variant="amountSm"
                          tone="negative"
                        />
                      <Button
                        title="سداد"
                        variant="destructive"
                        onPress={() => {
                          setPayingCommitment(item);
                          setPayCommitmentVisible(true);
                        }}
                        style={styles.payBtn}
                      />
                      </View>
                    </Pressable>
                  ))}
                </Card>
              </View>
            )}

            {/* Upcoming Section */}
            <View style={{ marginTop: spacing.md }}>
              <SectionHeading
                title={strings.plan.upcomingSection}
                withLine
                style={{ marginTop: spacing.sm }}
              />

              {upcomingCommitments.length === 0 && overdueCommitments.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: colors.border }]}>
                  <Icon name="calendar-outline" size={40} color={colors.textDisabled} />
                  <AppText variant="title2" style={{ marginTop: 8, marginBottom: 4 }}>
                    {strings.plan.emptyCommitments}
                  </AppText>
                  <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginBottom: 16 }}>
                    سجّل التزاماتك الدورية (إيجار، فواتير، اشتراكات) ليتم حجزها تلقائياً من المبلغ الآمن للصرف
                  </AppText>
                  <Button
                    title={strings.plan.addCommitment}
                    onPress={() => setAddCommitmentVisible(true)}
                  />
                </View>
              ) : (
                <View style={styles.commitmentList}>
                  {upcomingCommitments.map((item) => {
                    const dueFormatted = new Date(item.dueDate).toLocaleDateString('ar-EG', {
                      day: 'numeric',
                      month: 'short',
                    });

                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          setSelectedCommitment(item);
                          setCommitmentDetailVisible(true);
                          haptics.impactLight();
                        }}
                        style={styles.commitmentCardItem}
                      >
                        <View style={styles.planCommitmentTop}>
                          <View style={[styles.dateBadge, { backgroundColor: colors.sunken }]}>
                            <AppText variant="caption" tone="secondary">{dueFormatted}</AppText>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <AppText variant="bodyStrong" numberOfLines={2}>{item.name}</AppText>
                            <AppText variant="caption" tone="secondary" numberOfLines={1}>
                              {item.recurrence === 'MONTHLY' ? 'شهري' : item.recurrence === 'WEEKLY' ? 'أسبوعي' : 'مرة واحدة'}
                            </AppText>
                          </View>
                        </View>

                        <View style={styles.planCommitmentActions}>
                          <Money
                            value={item.amount}
                            currency={item.currency}
                            variant="amountSm"
                            tone="primary"
                          />
                          <Button
                            title="سداد"
                            variant="secondary"
                            onPress={() => {
                              setPayingCommitment(item);
                              setPayCommitmentVisible(true);
                            }}
                            style={styles.payBtn}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Paid / Completed Collapsible Toggle */}
            <View style={{ marginTop: spacing.xl }}>
              <Pressable
                onPress={loadPaidCommitments}
                style={styles.collapsibleHeader}
                accessibilityRole="button"
                accessibilityState={{ expanded: showPaidCommitments }}
              >
                <AppText variant="bodyStrong" tone="secondary">
                  {strings.plan.paidSection}
                </AppText>
                {loadingPaid ? (
                  <ActivityIndicator size="small" color={colors.forest} />
                ) : (
                  <Icon
                    name={showPaidCommitments ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textSecondary}
                  />
                )}
              </Pressable>

              {showPaidCommitments && (
                <View style={[styles.paidCommitmentList, { marginTop: spacing.sm }]}>
                  {paidCommitments.length === 0 ? (
                    <AppText variant="caption" tone="secondary" style={{ textAlign: 'center', padding: 12 }}>
                      لا توجد التزامات مسددة مسجلة بعد
                    </AppText>
                  ) : (
                    paidCommitments.map((item) => (
                      <View
                        key={item.id}
                        style={[styles.paidCommitmentCard, { backgroundColor: colors.surface }]}
                      >
                        <View style={[styles.paidStatusIcon, { backgroundColor: colors.positiveSubtle }]}>
                          <Icon name="checkmark" size={18} color={colors.positive} />
                        </View>

                        <View style={styles.paidCommitmentInfo}>
                          <AppText variant="bodyStrong" numberOfLines={2}>
                            {item.name}
                          </AppText>
                          <AppText variant="caption" tone="secondary" numberOfLines={1}>
                            {item.recurrence === 'MONTHLY' ? 'شهري' : item.recurrence === 'WEEKLY' ? 'أسبوعي' : 'مرة واحدة'}
                          </AppText>
                        </View>

                        <View style={styles.paidAmount}>
                          <AppText variant="caption" tone="secondary">قيمة الالتزام</AppText>
                          <Money
                            value={item.amount}
                            currency={item.currency}
                            variant="amountSm"
                            tone="primary"
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          </>
        ) : activeSegment === 'budgets' ? (
          /* ================= BUDGETS VIEW ================= */
          <>
            <View style={{ marginTop: spacing.md }}>
              <SectionHeading
                title={strings.plan.activeBudgets}
                withLine
                style={{ marginTop: spacing.sm }}
              />

              {activeBudgets.length === 0 && otherBudgets.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: colors.border }]}>
                  <Icon name="pie-chart-outline" size={40} color={colors.textDisabled} />
                  <AppText variant="title2" style={{ marginTop: 8, marginBottom: 4 }}>
                    {strings.plan.emptyBudgets}
                  </AppText>
                  <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginBottom: 16 }}>
                    حدد سقوفاً إنفاقية لفئاتك لتراقب مدى التزامك بها شهرياً
                  </AppText>
                  <Button
                    title={strings.plan.addBudget}
                    onPress={() => {
                      setEditingBudget(null);
                      setAddBudgetVisible(true);
                    }}
                  />
                </View>
              ) : (
                <View style={{ gap: spacing.md }}>
                  {activeBudgets.map((b) => {
                    const spent = parseFloat(b.spent || '0');
                    const limit = parseFloat(b.amount || '0');
                    const pct = b.percentage ?? (limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0);
                    const isExceeded = spent > limit || pct > 100;
                    const isNearLimit = pct >= 85 && !isExceeded;

                    const meterColor = isExceeded
                      ? colors.calmRed
                      : isNearLimit
                      ? colors.gold
                      : colors.forest;

                    return (
                      <Card
                        key={b.id}
                        variant="surface"
                        onPress={() => {
                          setSelectedBudget(b);
                          setBudgetDetailVisible(true);
                          haptics.impactLight();
                        }}
                      >
                        <View style={styles.budgetHeader}>
                          <View style={{ flex: 1 }}>
                            <AppText variant="bodyStrong">
                              {b.categoryName ? displayName(b.categoryName) : b.name}
                            </AppText>
                            <AppText variant="caption" tone={isExceeded ? 'negative' : 'secondary'}>
                              {isExceeded ? 'تجاوزت الميزانية!' : `استُهلك ${pct}%`}
                            </AppText>
                          </View>
                          <View style={styles.budgetLimit}>
                            <AppText variant="caption" tone="secondary">سقف الميزانية</AppText>
                            <Money
                              value={b.amount}
                              currency={baseCurrency}
                              variant="amountSm"
                              tone="primary"
                            />
                          </View>
                        </View>

                        {/* Precision Progress Meter */}
                        <View style={[styles.progressTrack, { backgroundColor: colors.sunken, borderRadius: radii.xs }]}>
                          <View
                            style={[
                              styles.progressBar,
                              {
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: meterColor,
                                borderRadius: radii.xs,
                              },
                            ]}
                          />
                        </View>

                        {/* Two primary figures; the limit is labeled in the header. */}
                        <View style={styles.budgetStatsRow}>
                          <View>
                            <AppText variant="caption" tone="secondary">
                              المصروف
                            </AppText>
                            <Money value={b.spent} currency={baseCurrency} variant="amountSm" tone="negative" />
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <AppText variant="caption" tone="secondary">
                              المتبقي
                            </AppText>
                            <Money
                              value={b.remaining ?? Math.max(0, limit - spent).toFixed(2)}
                              currency={baseCurrency}
                              variant="amountSm"
                              tone={isExceeded ? 'negative' : 'positive'}
                            />
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : activeSegment === 'goals' ? (
          /* ================= SAVINGS GOALS VIEW ================= */
          <SavingsGoalsTab />
        ) : activeSegment === 'forecast' ? (
          /* ================= CASH FLOW FORECAST VIEW ================= */
          <ForecastTab />
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>


      {/* Sheet Modals */}
      <AddCommitmentSheet
        visible={addCommitmentVisible}
        onClose={() => setAddCommitmentVisible(false)}
        onSuccess={loadData}
      />

      <CommitmentDetailSheet
        visible={commitmentDetailVisible}
        onClose={() => {
          setCommitmentDetailVisible(false);
          setSelectedCommitment(null);
        }}
        commitment={selectedCommitment}
        onPay={(comm) => {
          setCommitmentDetailVisible(false);
          setPayingCommitment(comm);
          setPayCommitmentVisible(true);
        }}
        onViewTransaction={onViewTransaction}
        onUpdated={loadData}
      />

      <PayCommitmentSheet
        visible={payCommitmentVisible}
        onClose={() => {
          setPayCommitmentVisible(false);
          setPayingCommitment(null);
        }}
        commitment={payingCommitment}
        onSuccess={loadData}
      />

      <AddBudgetSheet
        visible={addBudgetVisible}
        onClose={() => {
          setAddBudgetVisible(false);
          setEditingBudget(null);
        }}
        budgetToEdit={editingBudget}
        onSuccess={loadData}
      />

      <BudgetDetailSheet
        visible={budgetDetailVisible}
        onClose={() => {
          setBudgetDetailVisible(false);
          setSelectedBudget(null);
        }}
        budget={selectedBudget}
        onEdit={(b) => {
          setBudgetDetailVisible(false);
          setEditingBudget(b);
          setAddBudgetVisible(true);
        }}
        onViewTransactions={(categoryId, startDate, endDate) => {
          setBudgetDetailVisible(false);
          onFilterTransactions?.(categoryId, startDate, endDate);
        }}
        onUpdated={loadData}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    paddingVertical: 10,
    marginEnd: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 60,
  },
  commitmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commitmentList: {
    gap: 8,
  },
  commitmentCardItem: {
    paddingVertical: 10,
    gap: 8,
  },
  planCommitmentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planCommitmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: 62,
  },
  dateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    gap: 10,
  },
  paidCommitmentList: {
    gap: 10,
  },
  paidCommitmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  paidStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidCommitmentInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  paidAmount: {
    alignItems: 'flex-end',
    gap: 3,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  budgetLimit: {
    alignItems: 'flex-end',
    gap: 3,
  },
  progressTrack: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
  },
  budgetStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  errorBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
