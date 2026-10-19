import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { displayName } from '../../utils/names';
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

const getTodayIso = () => new Date().toISOString().split('T')[0];
const getYesterdayIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const makeBlankRow = (currency: string = 'EGP'): RowFormEntry => ({
  date: getTodayIso(),
  amount: '',
  currency,
  type: 'EXPENSE',
  note: '',
});

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
  const [entryMode, setEntryMode] = useState<'rows' | 'paste'>('rows');
  const [pasteText, setPasteText] = useState('');

  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [rows, setRows] = useState<RowFormEntry[]>([makeBlankRow()]);
  const [preview, setPreview] = useState<ImportPreviewResponseDto | null>(null);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const loadAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const all = await accountsApi.getAccounts();
      const active = all.filter((a) => !a.isArchived);
      setAccounts(active);
      if (active.length > 0 && !selectedAccountId) {
        setSelectedAccountId(active[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAccounts(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (visible) {
      loadAccounts();
      setStep('FORM');
      setEntryMode('rows');
      setPasteText('');
      setRows([makeBlankRow(selectedAccount?.currency || 'EGP')]);
      setPreview(null);
      setError(null);
    }
  }, [visible, loadAccounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync rows currency when account changes
  const handleSelectAccount = (acc: AccountResponseDto) => {
    setSelectedAccountId(acc.id);
    setRows((prev) => prev.map((r) => ({ ...r, currency: acc.currency })));
    haptics.impactLight();
  };

  const updateRow = (idx: number, field: keyof RowFormEntry, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    const cur = selectedAccount?.currency || rows[rows.length - 1]?.currency || 'EGP';
    setRows((prev) => [...prev, makeBlankRow(cur)]);
    haptics.impactLight();
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
    haptics.impactLight();
  };

  /**
   * Smart Text Parser for Quick Paste:
   * Supports:
   * "150 سوبرماركت"
   * "2026-10-19, 250, كهرباء"
   * "دخل 5000 راتب"
   * "50.5 كافيه"
   */
  const handleParsePasteText = () => {
    if (!pasteText.trim()) return;

    const cur = selectedAccount?.currency || 'EGP';
    const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedRows: RowFormEntry[] = [];
    const today = getTodayIso();

    for (const line of lines) {
      // Split by commas, tabs, or spaces
      const commaParts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);

      let date = today;
      let amount = '';
      let note = '';
      let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

      if (line.includes('دخل') || line.includes('إيداع') || line.includes('راتب') || line.includes('income')) {
        type = 'INCOME';
      }

      if (commaParts.length >= 2) {
        // Look for date in first or second part
        const dateMatch = commaParts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
        if (dateMatch) date = dateMatch;

        // Look for amount
        const amountMatch = commaParts.find((p) => /^\d+(\.\d+)?$/.test(p));
        if (amountMatch) amount = amountMatch;

        // Note is remainder
        const remainingParts = commaParts.filter((p) => p !== dateMatch && p !== amountMatch);
        note = remainingParts.join(' ');
      } else {
        // Space separated line e.g. "150 سوبرماركت" or "سوبرماركت 150"
        const tokens = line.split(/\s+/);
        const numToken = tokens.find((t) => /^\d+(\.\d+)?$/.test(t));
        if (numToken) {
          amount = numToken;
          note = tokens.filter((t) => t !== numToken).join(' ');
        }
      }

      if (amount && parseFloat(amount) > 0) {
        parsedRows.push({
          date,
          amount,
          currency: cur,
          type,
          note: note.slice(0, 100),
        });
      }
    }

    if (parsedRows.length > 0) {
      setRows(parsedRows);
      setEntryMode('rows');
      showToast(`تم استخراج ${parsedRows.length} معاملة بنجاح`);
      haptics.notificationSuccess();
    } else {
      setError('تعذر استخراج المعاملات من النص المكتوب. جرّب: "150 سوبرماركت" في كل سطر.');
      haptics.notificationError();
    }
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

      {/* Account Picker */}
      <View style={{ gap: 6 }}>
        <AppText variant="label" tone="secondary">الحساب المستهدف للاستيراد</AppText>
        {loadingAccounts ? (
          <AppText variant="caption" tone="secondary">جارٍ تحميل الحسابات...</AppText>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {accounts.map((acc) => {
              const selected = acc.id === selectedAccountId;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => handleSelectAccount(acc)}
                  style={[
                    styles.accountChip,
                    {
                      backgroundColor: selected ? colors.forest : colors.surface,
                      borderColor: selected ? colors.forest : colors.border,
                      borderRadius: radii.sm,
                    },
                  ]}
                >
                  <Icon
                    name={selected ? 'checkmark-circle' : 'wallet-outline'}
                    size={16}
                    color={selected ? colors.onAction : colors.textTertiary}
                  />
                  <AppText
                    variant="label"
                    style={{
                      color: selected ? colors.onAction : colors.textPrimary,
                      fontWeight: selected ? '700' : '500',
                    }}
                  >
                    {displayName(acc.name)}
                  </AppText>
                  <AppText
                    variant="caption"
                    style={{
                      color: selected ? colors.onAction : colors.textSecondary,
                      fontSize: 10,
                    }}
                  >
                    {acc.currency}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Mode Switcher: Form Rows vs Quick Paste */}
      <View style={[styles.modeRow, { backgroundColor: colors.sunken, borderRadius: radii.sm }]}>
        <Pressable
          onPress={() => { setEntryMode('rows'); haptics.impactLight(); }}
          style={[
            styles.modePill,
            entryMode === 'rows' && { backgroundColor: colors.surface, borderRadius: radii.xs },
          ]}
        >
          <AppText
            variant="label"
            style={{
              color: entryMode === 'rows' ? colors.textPrimary : colors.textSecondary,
              fontWeight: entryMode === 'rows' ? '700' : '400',
            }}
          >
            إدخال يدوي ({rows.length})
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => { setEntryMode('paste'); haptics.impactLight(); }}
          style={[
            styles.modePill,
            entryMode === 'paste' && { backgroundColor: colors.surface, borderRadius: radii.xs },
          ]}
        >
          <AppText
            variant="label"
            style={{
              color: entryMode === 'paste' ? colors.textPrimary : colors.textSecondary,
              fontWeight: entryMode === 'paste' ? '700' : '400',
            }}
          >
            لصق نص متعدد
          </AppText>
        </Pressable>
      </View>

      {entryMode === 'paste' ? (
        /* Quick Paste Box */
        <View style={{ gap: spacing.sm }}>
          <View style={[styles.infoBanner, { backgroundColor: colors.surface, borderRadius: radii.sm, borderColor: colors.border, borderWidth: 1 }]}>
            <Icon name="information-circle-outline" size={16} color={colors.textSecondary} />
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              الصق أسطر معاملاتك المنسوخة (مثال: "150 سوبرماركت" أو "2026-10-19, 300, فاتورة")
            </AppText>
          </View>

          <TextInput
            value={pasteText}
            onChangeText={setPasteText}
            placeholder={`150 سوبرماركت\n250 فاتورة كهرباء\n75 قهوة\nدخل 5000 مكافأة`}
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[
              styles.pasteInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                borderRadius: radii.md,
              },
            ]}
          />

          <Button
            title="تحويل إلى معاملات"
            variant="secondary"
            onPress={handleParsePasteText}
            disabled={!pasteText.trim()}
          />
        </View>
      ) : (
        /* Rows View */
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="label" tone="secondary">قائمة المعاملات المراد استيرادها</AppText>
            <AppText variant="caption" tone="secondary">
              صالح: {validRows().length} من {rows.length}
            </AppText>
          </View>

          {rows.map((row, idx) => (
            <Card key={idx} variant="surface">
              {/* Header: Date + Quick Date Presets + Type + Delete */}
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

                {/* Date shortcut pills */}
                <Pressable
                  onPress={() => updateRow(idx, 'date', getTodayIso())}
                  style={[styles.miniPill, { backgroundColor: colors.sunken, borderRadius: radii.xs }]}
                >
                  <AppText variant="caption" style={{ fontSize: 10 }}>اليوم</AppText>
                </Pressable>
                <Pressable
                  onPress={() => updateRow(idx, 'date', getYesterdayIso())}
                  style={[styles.miniPill, { backgroundColor: colors.sunken, borderRadius: radii.xs }]}
                >
                  <AppText variant="caption" style={{ fontSize: 10 }}>أمس</AppText>
                </Pressable>

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
                      fontWeight: '700',
                    }}
                  >
                    {row.type === 'EXPENSE' ? 'مصروف' : 'دخل'}
                  </AppText>
                </Pressable>

                {rows.length > 1 && (
                  <Pressable onPress={() => removeRow(idx)} hitSlop={8} style={{ padding: 2 }}>
                    <Icon name="close-circle-outline" size={20} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Amount + Currency */}
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
                      fontSize: 16,
                      fontWeight: '600',
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
                placeholder="ملاحظة أو وصف المعاملة..."
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
                maxLength={100}
              />
            </Card>
          ))}

          <Button title="+ إضافة معاملة أخرى" variant="ghost" onPress={addRow} />
        </View>
      )}

      <Button
        title={`معاينة استيراد (${validRows().length})`}
        onPress={handlePreview}
        loading={previewing}
        disabled={!canPreview || previewing}
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
        <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderRadius: radii.md, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.summaryCell}>
            <AppText variant="caption" tone="secondary">إجمالي</AppText>
            <AppText variant="title2">{preview.totalRows}</AppText>
          </View>
          <View style={[styles.summaryCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
            <AppText variant="caption" style={{ color: colors.positive }}>جديدة</AppText>
            <AppText variant="title2" style={{ color: colors.positive }}>{preview.newCount}</AppText>
          </View>
          <View style={[styles.summaryCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
            <AppText variant="caption" style={{ color: colors.gold }}>مكررة</AppText>
            <AppText variant="title2" style={{ color: colors.gold }}>{preview.duplicateCount}</AppText>
          </View>
          <View style={[styles.summaryCell, { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: colors.border }]}>
            <AppText variant="caption" tone="secondary">متجاهلة</AppText>
            <AppText variant="title2">{preview.skippedCount}</AppText>
          </View>
        </View>

        <AppText variant="caption" tone="secondary">
          ستُستورد المعاملات الجديدة فقط ({preview.newCount}) لمنع ازدواجية الحسابات.
        </AppText>

        {/* Row list */}
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

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <Button
            title="العودة للتعديل"
            variant="secondary"
            onPress={() => { setStep('FORM'); setError(null); }}
            style={{ flex: 1 }}
          />
          <Button
            title={`تأكيد واستيراد ${preview.newCount}`}
            onPress={handleCommit}
            loading={committing}
            disabled={preview.newCount === 0 || committing}
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
        تم الاستيراد بنجاح!
      </AppText>
      <AppText variant="body" tone="secondary" style={{ marginTop: 8, textAlign: 'center' }}>
        تمت إضافة المعاملات إلى حساب "{selectedAccount?.name}" وتحديث أرصدتك فوراً.
      </AppText>
      <Button
        title="تم"
        variant="primary"
        onPress={onClose}
        style={{ marginTop: 32, minWidth: 160 }}
      />
    </View>
  );

  const stepTitle =
    step === 'FORM'
      ? 'استيراد معاملات'
      : step === 'PREVIEW'
      ? 'معاينة الاستيراد'
      : 'اكتمل الاستيراد';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={stepTitle}
      isDirty={step === 'FORM' && (rows.some((r) => r.amount) || !!pasteText)}
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
    padding: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  modeRow: {
    flexDirection: 'row',
    padding: 3,
    gap: 4,
  },
  modePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pasteInput: {
    borderWidth: 1,
    padding: 12,
    height: 120,
    fontSize: 14,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  rowHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallInput: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  miniPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  currencyInput: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    width: 56,
    textAlign: 'center',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
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
