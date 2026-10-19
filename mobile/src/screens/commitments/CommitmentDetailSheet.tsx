import React, { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  Divider,
  ConfirmDialog,
} from '../../components/primitives';
import { CommitmentResponseDto, TransactionResponseDto } from '../../api/types';
import { commitmentsApi } from '../../api/commitments';
import { transactionsApi } from '../../api/transactions';
import { formatMoney } from '../../utils/format';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface CommitmentDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  commitment: CommitmentResponseDto | null;
  onPay: (commitment: CommitmentResponseDto) => void;
  onViewTransaction?: (tx: TransactionResponseDto) => void;
  onUpdated?: () => void;
}

export const CommitmentDetailSheet: React.FC<CommitmentDetailSheetProps> = ({
  visible,
  onClose,
  commitment,
  onPay,
  onViewTransaction,
  onUpdated,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!commitment) return null;

  const isPaid = commitment.status === 'PAID';
  const isOverdue = commitment.status === 'OVERDUE';
  const isCancelled = commitment.status === 'CANCELLED';
  const isPending = commitment.status === 'PENDING';

  const statusLabel = isPaid
    ? 'اتسدد'
    : isOverdue
    ? 'متأخر'
    : isCancelled
    ? 'ملغي'
    : 'جاي';

  const statusTone = isPaid
    ? 'positive'
    : isOverdue
    ? 'negative'
    : isCancelled
    ? 'secondary'
    : 'primary';

  const recurrenceLabel =
    commitment.recurrence === 'DAILY'
      ? 'يومي'
      : commitment.recurrence === 'WEEKLY'
      ? 'أسبوعي'
      : commitment.recurrence === 'MONTHLY'
      ? 'شهري'
      : commitment.recurrence === 'YEARLY'
      ? 'سنوي'
      : 'مرة واحدة';

  const formattedDueDate = new Date(commitment.dueDate).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleCancelCommitment = async () => {
    try {
      setActionLoading(true);
      await commitmentsApi.updateCommitment(commitment.id, {
        status: 'CANCELLED',
      } as any);

      haptics.notificationSuccess();
      showToast('تم إلغاء الالتزام');
      setConfirmCancelVisible(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCommitment = async () => {
    try {
      setActionLoading(true);
      await commitmentsApi.deleteCommitment(commitment.id);

      haptics.impactMedium();
      showToast('تم حذف الالتزام');
      setConfirmDeleteVisible(false);
      onUpdated?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewPaidTransaction = async () => {
    if (!commitment.paidTransactionId || !onViewTransaction) return;

    try {
      setActionLoading(true);
      const tx = await transactionsApi.getTransaction(commitment.paidTransactionId);
      onClose();
      onViewTransaction(tx);
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
        title="تفاصيل الالتزام"
        footer={
          <View style={{ gap: spacing.xs }}>
            {(isPending || isOverdue) && (
              <Button
                title={strings.home.payAction}
                variant="primary"
                onPress={() => {
                  onClose();
                  onPay(commitment);
                }}
              />
            )}
            {isPaid && commitment.paidTransactionId && (
              <Button
                title="شوف المعاملة"
                variant="primary"
                loading={actionLoading}
                onPress={handleViewPaidTransaction}
              />
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(isPending || isOverdue) && (
                <Button
                  title={strings.plan.cancelCommitment}
                  variant="secondary"
                  onPress={() => setConfirmCancelVisible(true)}
                  style={{ flex: 1 }}
                />
              )}
              {!isPaid && (
                <Button
                  title={strings.plan.deleteCommitment}
                  variant="destructive"
                  onPress={() => setConfirmDeleteVisible(true)}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {/* Header Card */}
          <View
            style={[
              styles.headerCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
              },
            ]}
          >
            <AppText variant="caption" tone={statusTone} style={{ fontWeight: '600' }}>
              {statusLabel}
            </AppText>
            <AppText variant="title2" style={{ marginTop: 2 }}>
              {commitment.name}
            </AppText>
            <View style={{ marginTop: 6 }}>
              <AppText variant="amountLg" tone="primary" style={{ writingDirection: 'ltr' }}>
                {formatMoney(commitment.amount, commitment.currency)}
              </AppText>
            </View>
          </View>

          {/* Details Group */}
          <View
            style={[
              styles.detailsGroup,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                marginTop: spacing.md,
              },
            ]}
          >
            <View style={styles.detailRow}>
              <AppText variant="body" tone="secondary">
                تاريخ الاستحقاق
              </AppText>
              <AppText variant="bodyStrong">{formattedDueDate}</AppText>
            </View>

            <Divider />

            <View style={styles.detailRow}>
              <AppText variant="body" tone="secondary">
                التكرار
              </AppText>
              <AppText variant="bodyStrong">{recurrenceLabel}</AppText>
            </View>

            <Divider />

            <View style={styles.detailRow}>
              <AppText variant="body" tone="secondary">
                الحالة
              </AppText>
              <AppText variant="bodyStrong" tone={statusTone}>
                {statusLabel}
              </AppText>
            </View>
          </View>

        <View style={{ height: 16 }} />
        </ScrollView>
      </Sheet>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        visible={confirmCancelVisible}
        title="إلغاء الالتزام"
        message="هل أنت متأكد من إلغاء هذا الالتزام؟ لن يدخل بعد الآن في حساب تقدر تصرف كام."
        confirmLabel="إلغاء الالتزام"
        cancelLabel={strings.common.cancel}
        isDestructive
        loading={actionLoading}
        onConfirm={handleCancelCommitment}
        onCancel={() => setConfirmCancelVisible(false)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="حذف الالتزام"
        message="هل أنت متأكد من حذف هذا الالتزام تماماً؟"
        confirmLabel={strings.common.delete}
        cancelLabel={strings.common.cancel}
        isDestructive
        loading={actionLoading}
        onConfirm={handleDeleteCommitment}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  headerCard: {
    borderWidth: 1,
    alignItems: 'center',
  },
  detailsGroup: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
