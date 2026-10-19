import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Button,
  Icon,
  Money,
  ConfirmDialog,
} from '../../components/primitives';
import { savingsGoalsApi } from '../../api/savingsGoals';
import { SavingsGoalResponseDto } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface SavingsGoalDetailSheetProps {
  visible: boolean;
  goal: SavingsGoalResponseDto | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const SavingsGoalDetailSheet: React.FC<SavingsGoalDetailSheetProps> = ({
  visible,
  goal,
  onClose,
  onUpdated,
}) => {
  const { colors, spacing, radii } = useTheme();
  const { showToast } = useToast();

  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  if (!goal) return null;

  const pct = Math.min(goal.percentage, 100);
  const isComplete = goal.percentage >= 100;

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await savingsGoalsApi.deleteGoal(goal.id);
      haptics.notificationSuccess();
      showToast('تم حذف الهدف');
      setConfirmDeleteVisible(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
      haptics.notificationError();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={goal.name}>
        <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
          {/* Progress Visual */}
          <View style={{ gap: 10 }}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.sunken, borderRadius: radii.xs },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: isComplete ? colors.positive : colors.forest,
                    borderRadius: radii.xs,
                  },
                ]}
              />
            </View>
            <View style={styles.pctRow}>
              <AppText
                variant="title2"
                style={{ color: isComplete ? colors.positive : colors.textPrimary }}
              >
                {goal.percentage.toFixed(1)}٪
              </AppText>
              {isComplete && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.positiveSubtle, borderRadius: radii.sm },
                  ]}
                >
                  <AppText variant="caption" tone="positive">
                    🎉 اكتمل الهدف!
                  </AppText>
                </View>
              )}
            </View>
          </View>

          {/* Stats Grid */}
          <View style={[styles.statsGrid, { backgroundColor: colors.surface, borderRadius: radii.md }]}>
            <View style={styles.statCell}>
              <AppText variant="caption" tone="secondary">الهدف</AppText>
              <Money value={goal.targetAmount} currency={goal.currency} variant="amountSm" tone="primary" />
            </View>
            <View style={[styles.statCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
              <AppText variant="caption" tone="secondary">المدخر</AppText>
              <Money value={goal.currentAmount} currency={goal.currency} variant="amountSm" tone={isComplete ? 'positive' : 'primary'} />
            </View>
            <View style={[styles.statCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
              <AppText variant="caption" tone="secondary">المتبقي</AppText>
              <Money value={goal.remainingAmount} currency={goal.currency} variant="amountSm" tone={isComplete ? 'positive' : 'primary'} />
            </View>
          </View>

          {/* Details */}
          <View style={{ gap: spacing.sm }}>
            {/* Account */}
            <View style={styles.detailRow}>
              <Icon name="wallet-outline" size={16} color={colors.textSecondary} />
              <AppText variant="body" tone="secondary">الحساب المرتبط</AppText>
              <AppText variant="bodyStrong" style={{ marginStart: 'auto' }}>
                {goal.account.name}
              </AppText>
            </View>

            {/* Target Date */}
            {goal.targetDate && (
              <View style={styles.detailRow}>
                <Icon name="calendar-outline" size={16} color={colors.textSecondary} />
                <AppText variant="body" tone="secondary">الموعد المستهدف</AppText>
                <AppText variant="bodyStrong" style={{ marginStart: 'auto' }}>
                  {new Date(goal.targetDate).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </AppText>
              </View>
            )}

            {/* Note */}
            {goal.note && (
              <View style={[styles.noteBox, { backgroundColor: colors.surface, borderRadius: radii.sm }]}>
                <AppText variant="caption" tone="secondary">ملاحظة</AppText>
                <AppText variant="body" style={{ marginTop: 4 }}>{goal.note}</AppText>
              </View>
            )}
          </View>

          {/* Currency note */}
          <AppText variant="caption" tone="secondary" style={{ textAlign: 'center', opacity: 0.7 }}>
            يعكس المبلغ المدخر رصيد حساب "{goal.account.name}" بالعملة {goal.currency}
          </AppText>

          {/* Delete Action */}
          <Pressable
            onPress={() => {
              haptics.impactLight();
              setConfirmDeleteVisible(true);
            }}
            style={[
              styles.deleteBtn,
              { borderColor: colors.negative, borderRadius: radii.md },
            ]}
          >
            <Icon name="trash-outline" size={16} color={colors.negative} />
            <AppText variant="body" tone="negative">حذف الهدف</AppText>
          </Pressable>
        </View>
      </Sheet>

      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="حذف الهدف"
        message={`هل أنت متأكد من حذف هدف "${goal.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        isDestructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  progressTrack: {
    height: 12,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    padding: 14,
    gap: 4,
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteBox: {
    padding: 12,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 12,
    marginTop: 8,
  },
});
