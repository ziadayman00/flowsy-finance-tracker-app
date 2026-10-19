import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Button,
  Icon,
  Card,
  Money,
} from '../../components/primitives';
import { importApi } from '../../api/import';
import { accountsApi } from '../../api/accounts';
import {
  AccountResponseDto,
  ImportPreviewResponseDto,
  ImportRowDto,
  ImportRowResultDto,
} from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface ImportSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'FORM' | 'PREVIEW' | 'DONE';

interface RowFormEntry {
  date: string;
  amount: string;
  currency: string;
  type: 'INCOME' | 'EXPENSE';
  note: string;
}

const BLANK_ROW: RowFormEntry = {
  date: '',
  amount: '',
  currency: 'EGP',
  type: 'EXPENSE',
  note: '',
};

const STATUS_COLORS: Record<ImportRowResultDto['status'], string> = {
  NEW: '#38856A',
  LIKELY_DUPLICATE: '#C9963E',
  SKIPPED: '#9BA8B7',
};

const STATUS_LABELS: Record<ImportRowResultDto['status'], string> = {
  NEW: 'جديد',
  LIKELY_DUPLICATE: 'محتمل التكرار',
  SKIPPED: 'متجاهل',
};

export const ImportSheet: React.FC<ImportSheetProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors, spacing, radii } = useTheme();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('FORM');
  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [rows, setRows] = useState<RowFormEntry[]>([{ ...BLANK_ROW }]);
  const [preview, setPreview] = useState<ImportPreviewResponseDto | null>(null);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const all = await accountsApi.getAccounts();
      setAccounts(all.filter((a) => !a.isArchived));
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadAccounts();
      // Reset
      setStep('FORM');
      setSelectedAccountId(null);
      setRows([{ ...BLANK_ROW }]);
      setPreview(null);
      setError(null);
    }
  }, [visible, loadAccounts]);

  const updateRow = (idx: number, field: keyof RowFormEntry, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { ...BLANK_ROW, currency: prev[prev.length - 1]?.currency ?? 'EGP' }]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const validRows = (): ImportRowDto[] =>
    rows
      .filter(
        (r) =>
          r.date.trim().length >= 8 &&
          parseFloat(r.amount) > 0 &&
          r.currency.trim().length > 0
      )
      .map((r) => ({
        date: r.date.trim(),
        amount: r.amount.trim(),
        currency: r.currency.trim().toUpperCase(),
        type: r.type,
        note: r.note.trim() || undefined,
      }));

  const canPreview = !!selectedAccountId && validRows().length > 0;

  const handlePreview = async () => {
    if (!canPreview || !selectedAccountId) return;
    try {
      setPreviewing(true);
      setError(null);
      const result = await importApi.previewImport({
        accountId: selectedAccountId,
        rows: validRows(),
      });
      setPreview(result);
      setStep('PREVIEW');
      haptics.impactLight();
    } catch (err) {
      setError(getErrorMessage(err));
      haptics.notificationError();
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    try {
      setCommitting(true);
      setError(null);
      const result = await importApi.commitImport({
        sessionId: preview.sessionId,
      });
      haptics.notificationSuccess();
      showToast(`تم استيراد ${result.imported} معاملة بنجاح`);
      setStep('DONE');
      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err));
      haptics.notificationError();
    } finally {
      setCommitting(false);
    }
  };

  const renderFormStep = () => (
    <ScrollView
      contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle, borderRadius: radii.sm }]}>
          <AppText variant="caption" tone="negative">{error}</AppText>
        </View>
      )}

      {/* Explainer */}
      <View style={[styles.infoBanner, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
        <Icon name="information-circle-outline" size={16} color={colors.textSecondary} />
        <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
          أدخل معاملاتك يدوياً. سيعرض النظام معاينة قبل الاستيراد النهائي.
        </AppText>
      </View>

      {/* Account picker */}
      <View style={{ gap: 6 }}>
        <AppText variant="caption" tone="secondary">الحساب المستهدف</AppText>
        {loadingAccounts ? (
          <AppText variant="caption" tone="secondary">جارٍ التحميل...</AppText>
        ) : (
          <View style={{ gap: 8 }}>
            {accounts.map((acc) => {
              const selected = acc.id === selectedAccountId;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => { setSelectedAccountId(acc.id); haptics.impactLight(); }}
                  style={[
                    styles.accountRow,
                    {
                      backgroundColor: selected ? colors.forest : colors.surface,
                      borderColor: selected ? colors.forest : colors.border,
                      borderRadius: radii.md,
                    },
                  ]}
                >
                  <Icon
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={selected ? colors.onAction : colors.textTertiary}
                  />
                  <AppText
                    variant="body"
                    style={{ flex: 1, color: selected ? colors.onAction : colors.textPrimary }}
                    numberOfLines={1}
                  >
                    {acc.name}
                  </AppText>
                  <AppText
                    variant="caption"
                    style={{ color: selected ? colors.onAction : colors.textSecondary }}
                  >
                    {acc.currency}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Rows */}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="secondary">المعاملات</AppText>

        {rows.map((row, idx) => (
          <Card key={idx} variant="surface">
            {/* Date + Type row */}
            <View style={styles.rowHeaderLine}>
              <TextInput
                value={row.date}
                onChangeText={(v) => updateRow(idx, 'date', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                style={[
                  styles.smallInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.sm,
                    writingDirection: 'ltr',
                    flex: 1,
                  },
                ]}
                maxLength={10}
              />
              {/* Type toggle */}
              <Pressable
                onPress={() =>
                  updateRow(idx, 'type', row.type === 'EXPENSE' ? 'INCOME' : 'EXPENSE')
                }
                style={[
                  styles.typePill,
                  {
                    backgroundColor:
                      row.type === 'EXPENSE' ? colors.negativeSubtle : colors.positiveSubtle,
                    borderRadius: radii.sm,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  style={{
                    color: row.type === 'EXPENSE' ? colors.negative : colors.positive,
                    fontWeight: '600',
                  }}
                >
                  {row.type === 'EXPENSE' ? 'مصروف' : 'دخل'}
                </AppText>
              </Pressable>

              {rows.length > 1 && (
                <Pressable onPress={() => removeRow(idx)} hitSlop={8}>
                  <Icon name="close-circle-outline" size={18} color={colors.textTertiary} />
                </Pressable>
              )}
            </View>

            {/* Amount + Currency row */}
            <View style={[styles.rowHeaderLine, { marginTop: 8 }]}>
              <TextInput
                value={row.amount}
                onChangeText={(v) => updateRow(idx, 'amount', v)}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                style={[
                  styles.smallInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.sm,
                    flex: 1,
                    writingDirection: 'ltr',
                  },
                ]}
              />
              <TextInput
                value={row.currency}
                onChangeText={(v) => updateRow(idx, 'currency', v.toUpperCase())}
                placeholder="EGP"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.currencyInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: radii.sm,
                    writingDirection: 'ltr',
                  },
                ]}
                maxLength={5}
                autoCapitalize="characters"
              />
            </View>

            {/* Note */}
            <TextInput
              value={row.note}
              onChangeText={(v) => updateRow(idx, 'note', v)}
              placeholder="ملاحظة (اختياري)"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.smallInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  borderRadius: radii.sm,
                  marginTop: 8,
                  textAlign: 'right',
                },
              ]}
            />
          </Card>
        ))}

        <Button title="+ إضافة معاملة" variant="ghost" onPress={addRow} />
      </View>

      <Button
        title="معاينة الاستيراد"
        onPress={handlePreview}
        loading={previewing}
        disabled={!canPreview}
      />
    </ScrollView>
  );

  const renderPreviewStep = () => {
    if (!preview) return null;
    return (
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.negativeSubtle, borderRadius: radii.sm }]}>
            <AppText variant="caption" tone="negative">{error}</AppText>
          </View>
        )}

        {/* Summary header */}
        <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderRadius: radii.md }]}>
          <View style={styles.summaryCell}>
            <AppText variant="caption" tone="secondary">إجمالي</AppText>
            <AppText variant="title2">{preview.totalRows}</AppText>
          </View>
          <View style={[styles.summaryCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
            <AppText variant="caption" tone="secondary" style={{ color: colors.positive }}>جديدة</AppText>
            <AppText variant="title2" style={{ color: colors.positive }}>{preview.newCount}</AppText>
          </View>
          <View style={[styles.summaryCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
            <AppText variant="caption" tone="secondary" style={{ color: colors.gold }}>محتملة</AppText>
            <AppText variant="title2" style={{ color: colors.gold }}>{preview.duplicateCount}</AppText>
          </View>
          <View style={[styles.summaryCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
            <AppText variant="caption" tone="secondary">متجاهلة</AppText>
            <AppText variant="title2">{preview.skippedCount}</AppText>
          </View>
        </View>

        {/* Row list */}
        <AppText variant="caption" tone="secondary">
          ستُستورد المعاملات الجديدة فقط. يمكنك مراجعة المكررات المحتملة لاحقاً.
        </AppText>

        <View style={{ gap: 8 }}>
          {preview.rows.map((row) => (
            <Card key={row.rowIndex} variant="surface">
              <View style={styles.previewRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: STATUS_COLORS[row.status],
                      borderRadius: 4,
                    },
                  ]}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="body" numberOfLines={1}>
                    {row.note || `معاملة ${row.rowIndex + 1}`}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    {new Date(row.date).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    • {STATUS_LABELS[row.status]}
                  </AppText>
                </View>
                <Money
                  value={row.amount}
                  currency={row.currency}
                  variant="amountSm"
                  tone={row.type === 'INCOME' ? 'positive' : 'negative'}
                />
              </View>
              {row.reason && (
                <AppText variant="caption" tone="secondary" style={{ marginTop: 4, opacity: 0.7 }}>
                  {row.reason}
                </AppText>
              )}
            </Card>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="العودة"
            variant="secondary"
            onPress={() => { setStep('FORM'); setError(null); }}
            style={{ flex: 1 }}
          />
          <Button
            title={`استيراد ${preview.newCount} معاملة`}
            onPress={handleCommit}
            loading={committing}
            disabled={preview.newCount === 0}
            style={{ flex: 2 }}
          />
        </View>
      </ScrollView>
    );
  };

  const renderDoneStep = () => (
    <View style={[styles.center, { paddingVertical: 40 }]}>
      <Icon name="checkmark-circle" size={60} color={colors.positive} />
      <AppText variant="title2" style={{ marginTop: 16 }}>
        تم الاستيراد بنجاح
      </AppText>
      <AppText variant="body" tone="secondary" style={{ marginTop: 8, textAlign: 'center' }}>
        تمت إضافة المعاملات إلى حسابك
      </AppText>
      <Button
        title="إغلاق"
        variant="secondary"
        onPress={onClose}
        style={{ marginTop: 32, minWidth: 140 }}
      />
    </View>
  );

  const stepTitle =
    step === 'FORM'
      ? 'استيراد معاملات'
      : step === 'PREVIEW'
      ? 'معاينة الاستيراد'
      : 'تم الاستيراد';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={stepTitle}
      isDirty={step === 'FORM' && (rows.some((r) => r.amount || r.date) || !!selectedAccountId)}
    >
      {step === 'FORM' && renderFormStep()}
      {step === 'PREVIEW' && renderPreviewStep()}
      {step === 'DONE' && renderDoneStep()}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    padding: 10,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
  },
  accountRow: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallInput: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  currencyInput: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    width: 60,
    textAlign: 'center',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    gap: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
