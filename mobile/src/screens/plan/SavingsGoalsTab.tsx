import React, { useState, useEffect, useCallback } from 'react';
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
import { savingsGoalsApi } from '../../api/savingsGoals';
import { SavingsGoalResponseDto } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';
import { AddSavingsGoalSheet } from './AddSavingsGoalSheet';
import { SavingsGoalDetailSheet } from './SavingsGoalDetailSheet';

interface SavingsGoalsTabProps {
  addTrigger?: number;
}

export const SavingsGoalsTab: React.FC<SavingsGoalsTabProps> = ({ addTrigger }) => {
  const { colors, radii, spacing } = useTheme();

  const [goals, setGoals] = useState<SavingsGoalResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addVisible, setAddVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalResponseDto | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoalResponseDto | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      setError(null);
      const res = await savingsGoalsApi.getGoals();
      setGoals(res.filter((g) => !g.isArchived));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Open add sheet when triggered by parent header
  useEffect(() => {
    if (addTrigger && addTrigger > 0) {
      setEditingGoal(null);
      setAddVisible(true);
    }
  }, [addTrigger]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadGoals();
  };

  if (loading) {
    return (
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <Skeleton height={120} width="100%" />
        <Skeleton height={120} width="100%" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Icon name="alert-circle-outline" size={36} color={colors.negative} />
        <AppText variant="body" tone="negative" style={{ marginTop: 8 }}>
          {error}
        </AppText>
        <Button
          title="إعادة المحاولة"
          variant="secondary"
          onPress={loadGoals}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  return (
    <>
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
        <SectionHeading
          title="أهداف الادخار"
          withLine
          style={{ marginTop: spacing.sm }}
        />

        {goals.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <Icon name="flag-outline" size={40} color={colors.textDisabled} />
            <AppText variant="title2" style={{ marginTop: 8, marginBottom: 4 }}>
              لا توجد أهداف ادخار
            </AppText>
            <AppText
              variant="body"
              tone="secondary"
              style={{ textAlign: 'center', marginBottom: 16 }}
            >
              حدد أهدافك المالية (سيارة، سفر، طوارئ) واربطها بحساباتك لتتابع نسبة تحقيقها بدقة
            </AppText>
            <Button
              title="إضافة هدف جديد"
              onPress={() => {
                setEditingGoal(null);
                setAddVisible(true);
              }}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            {goals.map((goal) => {
              const pct = Math.min(goal.percentage, 100);
              const isComplete = goal.percentage >= 100;
              const meterColor = isComplete ? colors.positive : colors.forest;

              return (
                <Pressable
                  key={goal.id}
                  onPress={() => {
                    setSelectedGoal(goal);
                    setDetailVisible(true);
                    haptics.impactLight();
                  }}
                >
                  <Card variant="surface">
                    {/* Header Row */}
                    <View style={styles.goalHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {goal.name}
                        </AppText>
                        <AppText variant="caption" tone="secondary" numberOfLines={1}>
                          {goal.account.name}
                        </AppText>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <AppText variant="caption" tone="secondary">
                          المستهدف
                        </AppText>
                        <Money
                          value={goal.targetAmount}
                          currency={goal.currency}
                          variant="amountSm"
                          tone="primary"
                        />
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View
                      style={[
                        styles.progressTrack,
                        { backgroundColor: colors.sunken, borderRadius: radii.xs },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${pct}%`,
                            backgroundColor: meterColor,
                            borderRadius: radii.xs,
                          },
                        ]}
                      />
                    </View>

                    {/* Stats Row */}
                    <View style={styles.goalStats}>
                      <View>
                        <AppText variant="caption" tone="secondary">
                          المدخر حالياً
                        </AppText>
                        <Money
                          value={goal.currentAmount}
                          currency={goal.currency}
                          variant="amountSm"
                          tone={isComplete ? 'positive' : 'primary'}
                        />
                      </View>
                      <View style={styles.pctBadge}>
                        <AppText
                          variant="caption"
                          style={{
                            color: isComplete ? colors.positive : colors.textPrimary,
                            fontWeight: '700',
                          }}
                        >
                          {goal.percentage.toFixed(0)}٪
                        </AppText>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <AppText variant="caption" tone="secondary">
                          المتبقي
                        </AppText>
                        <Money
                          value={goal.remainingAmount}
                          currency={goal.currency}
                          variant="amountSm"
                          tone={isComplete ? 'positive' : 'secondary'}
                        />
                      </View>
                    </View>

                    {/* Target Date */}
                    {goal.targetDate && (
                      <AppText
                        variant="caption"
                        tone="secondary"
                        style={{ marginTop: 8 }}
                      >
                        الموعد المستهدف:{' '}
                        {new Date(goal.targetDate).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </AppText>
                    )}
                  </Card>
                </Pressable>
              );
            })}

            <Button
              title="إضافة هدف جديد"
              variant="secondary"
              onPress={() => {
                setEditingGoal(null);
                setAddVisible(true);
              }}
              style={{ marginTop: spacing.xs }}
            />
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <AddSavingsGoalSheet
        visible={addVisible}
        goalToEdit={editingGoal}
        onClose={() => {
          setAddVisible(false);
          setEditingGoal(null);
        }}
        onSuccess={() => {
          setEditingGoal(null);
          loadGoals();
        }}
      />

      <SavingsGoalDetailSheet
        visible={detailVisible}
        goal={selectedGoal}
        onClose={() => {
          setDetailVisible(false);
          setSelectedGoal(null);
        }}
        onEdit={(g) => {
          setDetailVisible(false);
          setEditingGoal(g);
          setAddVisible(true);
        }}
        onUpdated={loadGoals}
      />
    </>
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
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressTrack: {
    height: 8,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
  },
  goalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pctBadge: {
    alignItems: 'center',
  },
});
