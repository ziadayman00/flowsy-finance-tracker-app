import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Money,
  Button,
  Divider,
  SplitLine,
  ConfirmDialog,
} from '../../components/primitives';
import { BudgetResponseDto } from '../../api/types';
import { budgetsApi } from '../../api/budgets';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface BudgetDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  budget: BudgetResponseDto | null;
  onEdit: (budget: BudgetResponseDto) => void;
  onViewTransactions: (categoryId?: string, startDate?: string, endDate?: string) => void;
  onUpdated?: () => void;
}

export const BudgetDetailSheet: React.FC<BudgetDetailSheetProps> = ({
  visible,
  onClose,
  budget,
  onEdit,
  onViewTransactions,
  onUpdated,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!budget) return null;

  const isOver = budget.percentage > 100;
  const startFormatted = new Date(budget.startDate).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
  });
  const endFormatted = new Date(budget.endDate).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const periodText = `${startFormatted} – ${endFormatted}`;

  const handleToggleArchive = async () => {
    try {
      setActionLoading(true);
      await budgetsApi.updateBudget(budget.id, {
        isArchived: !budget.isArchived,
      } as any);

      haptics.notificationSuccess();
      showToast(budget.isArchived ? 'تم استرجاع الميزانية' : 'تمت أرشفة الميزانية');
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBudget = async () => {
    try {
      setActionLoading(true);
      await budgetsApi.deleteBudget(budget.id);

      haptics.impactMedium();
      showToast('تم حذف الميزانية');
      setConfirmDeleteVisible(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title="تفاصيل الميزانية"
        footer={
          <View style={{ gap: spacing.xs }}>
            <Button
              title="شوف المعاملات"
              variant="primary"
              onPress={() => {
                onClose();
                onViewTransactions(
                  budget.categoryId || undefined,
                  budget.startDate,
                  budget.endDate
                );
              }}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="تعديل"
                variant="secondary"
                onPress={() => {
                  onClose();
                  onEdit(budget);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title={budget.isArchived ? 'استرجاع' : 'أرشفة'}
                variant="secondary"
                loading={actionLoading}
                onPress={handleToggleArchive}
                style={{ flex: 1 }}
              />
              <Button
                title="حذف"
                variant="destructive"
                onPress={() => setConfirmDeleteVisible(true)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Budget overview */}
          <View
            style={[
              styles.headerCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.lg,
              },
            ]}
          >
            <View style={styles.budgetTitleRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="title2" numberOfLines={2}>
                  {budget.name}
                </AppText>
                <AppText variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                  {periodText}
                </AppText>
              </View>
              <View style={styles.limitValue}>
                <AppText variant="caption" tone="secondary">سقف الميزانية</AppText>
                <Money value={budget.amount} currency="EGP" variant="amountSm" tone="primary" />
              </View>
            </View>

            <View style={{ width: '100%', marginTop: spacing.md }}>
              <SplitLine
                availableRatio={Math.min(budget.percentage / 100, 1)}
                committedRatio={0}
                isDeficit={isOver}
                height={8}
              />
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCell}>
                <AppText variant="caption" tone="secondary">المصروف</AppText>
                <Money value={budget.spent} currency="EGP" variant="amountSm" tone="negative" />
              </View>

              <View style={[styles.metricCell, { alignItems: 'flex-end' }]}>
                <AppText variant="caption" tone="secondary">{isOver ? 'تجاوزت بـ' : 'المتبقي'}</AppText>
                <Money value={budget.remaining} currency="EGP" variant="amountSm" tone={isOver ? 'negative' : 'positive'} />
              </View>
            </View>
          </View>

        <View style={{ height: 16 }} />
        </ScrollView>
      </Sheet>

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="حذف الميزانية"
        message="هل أنت متأكد من حذف هذه الميزانية؟ لن تتأثر معاملاتك المالية السابقة."
        confirmLabel={strings.common.delete}
        cancelLabel={strings.common.cancel}
        isDestructive
        loading={actionLoading}
        onConfirm={handleDeleteBudget}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  headerCard: {
    borderWidth: 1,
    alignItems: 'stretch',
  },
  budgetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  limitValue: {
    alignItems: 'flex-end',
    gap: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
  },
  metricCell: {
    gap: 4,
  },
});
