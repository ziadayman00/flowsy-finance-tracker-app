import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  AppText,
  Icon,
  Button,
  Card,
  Money,
  SectionHeading,
  Skeleton,
} from '../../components/primitives';
import { forecastingApi } from '../../api/forecasting';
import { accountsApi } from '../../api/accounts';
import { CashFlowForecastDto, MonthlyForecastDto } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';

const MONTH_OPTIONS: { label: string; value: number }[] = [
  { label: '١ شهر', value: 1 },
  { label: '٣ أشهر', value: 3 },
  { label: '٦ أشهر', value: 6 },
  { label: '١٢ شهراً', value: 12 },
];

export const ForecastTab: React.FC = () => {
  const { colors, spacing, radii } = useTheme();

  const [months, setMonths] = useState(3);
  const [selectedCurrency, setSelectedCurrency] = useState('EGP');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(['EGP']);
  const [forecast, setForecast] = useState<CashFlowForecastDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Load user's currencies from their accounts
  useEffect(() => {
    accountsApi.getAccounts().then((accs) => {
      const currs = Array.from(new Set(accs.map((a) => a.currency).filter(Boolean)));
      if (currs.length > 0) {
        setAvailableCurrencies(currs);
        if (!currs.includes(selectedCurrency)) {
          setSelectedCurrency(currs[0]);
        }
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadForecast = useCallback(async () => {
    try {
      setError(null);
      const res = await forecastingApi.getForecast(months, selectedCurrency);
      setForecast(res);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [months, selectedCurrency]);

  useEffect(() => {
    setLoading(true);
    loadForecast();
  }, [loadForecast]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadForecast();
  };

  const getMaxAbsValue = (data: MonthlyForecastDto[]): number => {
    return data.reduce((acc, m) => {
      const expense = Math.abs(parseFloat(m.projectedExpenses || '0'));
      const income = Math.abs(parseFloat(m.projectedIncome || '0'));
      return Math.max(acc, expense, income);
    }, 1);
  };

  const renderBar = (value: string, maxValue: number, color: string) => {
    const num = Math.abs(parseFloat(value || '0'));
    if (num <= 0 || maxValue <= 0) {
      return (
        <View
          style={[
            styles.bar,
            {
              width: '100%',
              backgroundColor: colors.sunken,
              borderRadius: radii.xs,
              opacity: 0.3,
            },
          ]}
        />
      );
    }
    const pct = Math.min((num / maxValue) * 100, 100);
    return (
      <View
        style={[
          styles.bar,
          {
            width: `${Math.max(pct, 4)}%`,
            backgroundColor: color,
            borderRadius: radii.xs,
          },
        ]}
      />
    );
  };

  if (loading) {
    return (
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <Skeleton height={48} width="100%" />
        <Skeleton height={110} width="100%" />
        <Skeleton height={110} width="100%" />
        <Skeleton height={110} width="100%" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Icon name="alert-circle-outline" size={36} color={colors.negative} />
        <AppText variant="body" tone="negative" style={{ marginTop: 8, textAlign: 'center' }}>
          {error}
        </AppText>
        <Button
          title="إعادة المحاولة"
          variant="secondary"
          onPress={() => { setLoading(true); loadForecast(); }}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  const hasData = forecast && Array.isArray(forecast.forecast) && forecast.forecast.length > 0;
  const maxVal = hasData ? getMaxAbsValue(forecast.forecast) : 1;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: spacing.md }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.forest}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Estimate banner */}
      <View
        style={[
          styles.estimateBanner,
          { backgroundColor: colors.sunken, borderRadius: radii.sm },
        ]}
      >
        <Icon name="information-circle-outline" size={16} color={colors.textSecondary} />
        <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
          هذه توقعات تقديرية مبنية على التزاماتك الدورية المجدولة لتساعدك في التخطيط للمستقبل.
        </AppText>
      </View>

      <SectionHeading title="توقعات التدفق النقدي" withLine style={{ marginTop: spacing.md }} />

      {/* Selectors Row: Months and Currency */}
      <View style={{ gap: 8, marginTop: spacing.sm }}>
        {/* Month Count Selector */}
        <View style={styles.segmentRow}>
          {MONTH_OPTIONS.map((opt) => {
            const active = opt.value === months;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  if (months !== opt.value) {
                    setMonths(opt.value);
                    haptics.impactLight();
                  }
                }}
                style={[
                  styles.segmentPill,
                  {
                    backgroundColor: active ? colors.forest : colors.surface,
                    borderColor: active ? colors.forest : colors.border,
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: active ? colors.onAction : colors.textSecondary,
                    fontWeight: active ? '700' : '400',
                  }}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* Currency Selector (if multiple currencies exist) */}
        {availableCurrencies.length > 1 && (
          <View style={styles.segmentRow}>
            {availableCurrencies.map((cur) => {
              const active = cur === selectedCurrency;
              return (
                <Pressable
                  key={cur}
                  onPress={() => {
                    setSelectedCurrency(cur);
                    haptics.impactLight();
                  }}
                  style={[
                    styles.segmentPill,
                    {
                      backgroundColor: active ? colors.forest : colors.surface,
                      borderColor: active ? colors.forest : colors.border,
                      borderRadius: radii.sm,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: active ? colors.onAction : colors.textSecondary,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {cur}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Empty State */}
      {!hasData ? (
        <View style={[styles.emptyBox, { borderColor: colors.border }]}>
          <Icon name="trending-up-outline" size={40} color={colors.textDisabled} />
          <AppText variant="title2" style={{ marginTop: 8, marginBottom: 4 }}>
            لا توجد توقعات بعد
          </AppText>
          <AppText
            variant="body"
            tone="secondary"
            style={{ textAlign: 'center' }}
          >
            سجّل التزاماتك الدورية (إيجار، فواتير، اشتراكات) لتتولد توقعات التدفق النقدي تلقائياً
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          {forecast!.forecast.map((month) => {
            const net = parseFloat(month.netCashFlow || '0');
            const netIsPositive = net > 0;
            const netIsZero = net === 0;
            const isExpanded = expandedMonth === month.month;
            const commitmentsList = Array.isArray(month.commitments) ? month.commitments : [];

            return (
              <Card key={month.month} variant="surface">
                <Pressable
                  onPress={() => {
                    setExpandedMonth(isExpanded ? null : month.month);
                    haptics.impactLight();
                  }}
                >
                  {/* Month title row */}
                  <View style={styles.monthHeader}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">
                        {new Date(month.startDate).toLocaleDateString('ar-EG', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </AppText>
                      <AppText variant="caption" tone="secondary">
                        {commitmentsList.length > 0
                          ? `${commitmentsList.length} التزام مجدوَل`
                          : 'لا توجد التزامات مجدولة'}
                      </AppText>
                    </View>

                    {/* Net cash flow badge */}
                    <View
                      style={[
                        styles.netBadge,
                        {
                          backgroundColor: netIsZero
                            ? colors.sunken
                            : netIsPositive
                            ? colors.positiveSubtle
                            : colors.negativeSubtle,
                          borderRadius: radii.sm,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={{
                          color: netIsZero
                            ? colors.textSecondary
                            : netIsPositive
                            ? colors.positive
                            : colors.negative,
                          fontWeight: '700',
                        }}
                      >
                        {netIsPositive ? '+' : ''}
                        {net.toLocaleString('ar-EG', {
                          maximumFractionDigits: 0,
                        })} {forecast!.currency}
                      </AppText>
                    </View>

                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textTertiary}
                    />
                  </View>

                  {/* Bar chart row */}
                  <View style={{ gap: 6, marginTop: 10 }}>
                    {/* Income bar */}
                    <View style={styles.barRow}>
                      <AppText variant="caption" tone="secondary" style={styles.barLabel}>
                        دخل
                      </AppText>
                      <View style={styles.barTrack}>
                        {renderBar(month.projectedIncome, maxVal, colors.positive)}
                      </View>
                      <Money
                        value={month.projectedIncome}
                        currency={forecast!.currency}
                        variant="amountSm"
                        tone={parseFloat(month.projectedIncome) > 0 ? 'positive' : 'secondary'}
                      />
                    </View>

                    {/* Expense bar */}
                    <View style={styles.barRow}>
                      <AppText variant="caption" tone="secondary" style={styles.barLabel}>
                        مصروف
                      </AppText>
                      <View style={styles.barTrack}>
                        {renderBar(month.projectedExpenses, maxVal, colors.calmRed)}
                      </View>
                      <Money
                        value={month.projectedExpenses}
                        currency={forecast!.currency}
                        variant="amountSm"
                        tone={parseFloat(month.projectedExpenses) > 0 ? 'negative' : 'secondary'}
                      />
                    </View>
                  </View>
                </Pressable>

                {/* Expanded: individual commitments */}
                {isExpanded && (
                  <View
                    style={[
                      styles.commitmentsList,
                      {
                        borderTopColor: colors.border,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        marginTop: 12,
                        paddingTop: 12,
                      },
                    ]}
                  >
                    {commitmentsList.length === 0 ? (
                      <AppText variant="caption" tone="secondary" style={{ textAlign: 'center', paddingVertical: 8 }}>
                        لا توجد التزامات مسجلة لهذا الشهر
                      </AppText>
                    ) : (
                      <>
                        <AppText variant="caption" tone="secondary" style={{ marginBottom: 8 }}>
                          تفاصيل الالتزامات المستحقة:
                        </AppText>
                        {commitmentsList.map((c, idx) => (
                          <View
                            key={`${c.id}-${idx}`}
                            style={[
                              styles.commitRow,
                              idx > 0 && {
                                borderTopColor: colors.border,
                                borderTopWidth: StyleSheet.hairlineWidth,
                                marginTop: 8,
                                paddingTop: 8,
                              },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <AppText variant="body" numberOfLines={1}>{c.name}</AppText>
                              <AppText variant="caption" tone="secondary">
                                {new Date(c.projectedDueDate).toLocaleDateString('ar-EG', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </AppText>
                            </View>
                            <Money
                              value={c.amount}
                              currency={c.currency}
                              variant="amountSm"
                              tone={c.flowType === 'INCOME' ? 'positive' : 'negative'}
                            />
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}

                {/* Estimate tag on each card */}
                <AppText
                  variant="caption"
                  tone="secondary"
                  style={{ marginTop: 10, opacity: 0.6, fontSize: 10 }}
                >
                  تقدير مبني على الالتزامات • {new Date(forecast!.generatedAt).toLocaleDateString('ar-EG')}
                </AppText>
              </Card>
            );
          })}
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  estimateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  netBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 36,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  bar: {
    height: '100%',
  },
  commitmentsList: {},
  commitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
