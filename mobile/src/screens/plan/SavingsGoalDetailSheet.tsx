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
  onEdit?: (goal: SavingsGoalResponseDto) => void;
  onUpdated?: () => void;
}

export const SavingsGoalDetailSheet: React.FC<SavingsGoalDetailSheetProps> = ({
  visible,
  goal,
  onClose,
  onEdit,
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
      <Sheet
        visible={visible}
        onClose={onClose}
        title={goal.name}
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="تعديل"
              variant="secondary"
              onPress={() => {
                onClose();
                onEdit?.(goal);
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="حذف"
              variant="destructive"
              onPress={() => {
                haptics.impactLight();
                setConfirmDeleteVisible(true);
              }}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
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
              {isComplete ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.positiveSubtle, borderRadius: radii.sm },
                  ]}
                >
                  <AppText variant="caption" tone="positive">
                    🎉 اكتمل الهدف بنجاح!
                  </AppText>
                </View>
              ) : (
                <AppText variant="caption" tone="secondary">
                  متبقي {goal.remainingAmount} {goal.currency}
                </AppText>
              )}
            </View>
          </View>

          {/* Stats Grid */}
          <View style={[styles.statsGrid, { backgroundColor: colors.surface, borderRadius: radii.md, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.statCell}>
              <AppText variant="caption" tone="secondary">المستهدف</AppText>
              <Money value={goal.targetAmount} currency={goal.currency} variant="amountSm" tone="primary" />
            </View>
            <View style={[styles.statCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
              <AppText variant="caption" tone="secondary">المدخر حالياً</AppText>
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
              <View style={[styles.noteBox, { backgroundColor: colors.surface, borderRadius: radii.sm, borderColor: colors.border, borderWidth: 1 }]}>
                <AppText variant="caption" tone="secondary">ملاحظة</AppText>
                <AppText variant="body" style={{ marginTop: 4 }}>{goal.note}</AppText>
              </View>
            )}
          </View>

          {/* Explanation Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
            <Icon name="information-circle-outline" size={16} color={colors.textSecondary} />
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              رصيد حساب "{goal.account.name}" ({goal.currency}) هو المعيار التلقائي لإنجاز هذا الهدف. كل إيداع أو تحويل للحساب يقرّبك من الهدف.
            </AppText>
          </View>
        </View>
      </Sheet>

      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="حذف الهدف"
        message={`هل أنت متأكد من حذف هدف "${goal.name}"؟ لا يؤثر ذلك على رصيد الحساب المرتبط.`}
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
  },
});
