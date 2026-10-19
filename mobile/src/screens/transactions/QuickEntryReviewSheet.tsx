import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  Divider,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { categoriesApi } from '../../api/categories';
import { transactionsApi } from '../../api/transactions';
import {
  AccountResponseDto,
  CategoryResponseDto,
} from '../../api/types';
import { CreateTransactionInput } from '../../utils/payloads';
import { toCents, fromCents } from '../../utils/money';
import { formatMoney, normalizeAmountInput, toArabicNumberSeparators } from '../../utils/format';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';
import {
  NativeSpeechRecognitionProvider,
  SpeechEngineState,
} from '../../services/voice/speechProvider';
import { parseExpenses } from '../../services/voice/expenseParser';

export interface DraftItem {
  id: string;
  amount: string;
  categoryId: string | null;
  accountId: string;
  note: string;
  date?: string;
}

interface QuickEntryReviewSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialDrafts?: DraftItem[];
  startInVoiceMode?: boolean;
}

export const QuickEntryReviewSheet: React.FC<QuickEntryReviewSheetProps> = ({
  visible,
  onClose,
  onSuccess,
  initialDrafts,
  startInVoiceMode = false,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice recording state
  const [voiceProvider] = useState(() => new NativeSpeechRecognitionProvider());
  const [voiceState, setVoiceState] = useState<SpeechEngineState>('idle');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [voiceSupported, setVoiceSupported] = useState<boolean>(true);
  const autoVoiceTriggeredRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setErrorMessage(null);
      loadMetadata();

      if (initialDrafts && initialDrafts.length > 0) {
        setDrafts(initialDrafts);
      } else {
        setDrafts([]);
      }

      if (startInVoiceMode && !autoVoiceTriggeredRef.current) {
        autoVoiceTriggeredRef.current = true;
        const timer = setTimeout(() => {
          startVoiceRecording();
        }, 150);
        return () => clearTimeout(timer);
      }
    } else {
      autoVoiceTriggeredRef.current = false;
      stopVoiceRecording();
    }
  }, [visible]);

  const loadMetadata = async () => {
    try {
      const [accs, cats] = await Promise.all([
        accountsApi.getAccounts(),
        categoriesApi.getCategories('EXPENSE'),
      ]);
      const activeAccs = accs.filter((a) => !a.isArchived);
      setAccounts(activeAccs);
      setCategories(cats.filter((c) => !c.isArchived));

      // Check voice capability
      const avail = await voiceProvider.isAvailableAsync();
      setVoiceSupported(avail);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  const defaultAccountId = useMemo(() => {
    const spendable = accounts.find((a) => !a.excludeFromSafeToSpend);
    return spendable ? spendable.id : accounts[0]?.id || '';
  }, [accounts]);

  const startVoiceRecording = async () => {
    try {
      const available = await voiceProvider.isAvailableAsync();
      if (!available) {
        setVoiceSupported(false);
        setErrorMessage('التعرف على الصوت غير مدعوم في هذا الجهاز أو المتصفح');
        return;
      }

      const perm = await voiceProvider.requestPermissionsAsync();
      if (perm === 'denied' || perm === 'blocked') {
        setErrorMessage('يرجى السماح بالوصول إلى الميكروفون للتعرف على الصوت');
        return;
      }

      setLiveTranscript('');
      setVoiceState('listening');

      await voiceProvider.start({
        onStateChange: (st) => setVoiceState(st),
        onInterimResult: (tx) => setLiveTranscript(tx),
        onFinalResult: (tx) => {
          setLiveTranscript(tx);
          handleVoiceTranscriptFinished(tx);
        },
        onError: (err) => {
          setVoiceState('error');
          setErrorMessage(err);
        },
      });
    } catch (err) {
      setVoiceState('error');
      setErrorMessage(getErrorMessage(err));
    }
  };

  const stopVoiceRecording = async () => {
    try {
      if (voiceState === 'listening' || voiceState === 'recognizing') {
        await voiceProvider.stop();
      }
    } catch {
      // ignore clean cancellation
    }
  };

  const handleVoiceTranscriptFinished = (transcript: string) => {
    if (!transcript.trim()) return;

    // Run deterministic NLP parser
    const categoryDict = categories.map((c) => ({
      id: c.id,
      name: c.name,
      keywords: [c.name],
    }));

    const parsed = parseExpenses(transcript, {
      defaultCurrency: 'EGP',
      categories: categoryDict,
    });

    if (parsed.candidates.length > 0) {
      const newDrafts: DraftItem[] = parsed.candidates.map((cand, idx) => ({
        id: `voice-${Date.now()}-${idx}`,
        amount:
          cand.amount?.value !== null && cand.amount?.value !== undefined
            ? cand.amount.value.toString()
            : '',
        categoryId: cand.categoryId?.value || null,
        accountId: defaultAccountId,
        note: cand.categoryName || cand.description?.value || 'مصروف صوتي',
        date: cand.date?.value || undefined,
      }));

      setDrafts((prev) => [...prev, ...newDrafts]);
      haptics.notificationSuccess();
    } else if (parsed.warnings && parsed.warnings.length > 0) {
      setErrorMessage(parsed.warnings[0]);
    }
  };

  const handleUpdateDraft = (id: string, updates: Partial<DraftItem>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  const handleRemoveDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    haptics.impactLight();
  };

  const handleAddEmptyDraft = () => {
    if (drafts.length >= 20) {
      setErrorMessage('الحد الأقصى للتسجيل دفعة واحدة هو 20 معاملة');
      return;
    }
    const newDraft: DraftItem = {
      id: `draft-${Date.now()}-${drafts.length}`,
      amount: '',
      categoryId: null,
      accountId: defaultAccountId,
      note: '',
    };
    setDrafts((prev) => [...prev, newDraft]);
  };

  // Validation: 1-20 items, all amounts must be > 0
  const validation = useMemo(() => {
    if (drafts.length === 0) return { valid: false, error: null };
    if (drafts.length > 20) {
      return { valid: false, error: 'الحد الأقصى هو 20 معاملة في المرة الواحدة' };
    }
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const val = parseFloat(d.amount);
      if (!d.amount || isNaN(val) || val <= 0) {
        return { valid: false, error: 'يرجى تحديد المبلغ لكل المعاملات' };
      }
      if (!d.accountId) {
        return { valid: false, error: 'يرجى اختيار الحساب لكل المعاملات' };
      }
    }
    return { valid: true, error: null };
  }, [drafts]);

  // Exact decimal sum calculation using toCents/fromCents
  const totalAmount = useMemo(() => {
    let totalCents = 0n;
    for (const d of drafts) {
      if (d.amount) {
        try {
          totalCents += toCents(d.amount);
        } catch {
          // invalid amount skipped in sum
        }
      }
    }
    return fromCents(totalCents);
  }, [drafts]);

  const handleSubmitBatch = async () => {
    if (!validation.valid || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payloadTransactions: CreateTransactionInput[] = drafts.map((d) => ({
        type: 'EXPENSE',
        amount: d.amount,
        accountId: d.accountId,
        categoryId: d.categoryId || undefined,
        note: d.note.trim() ? d.note.trim() : undefined,
        transactionDate: d.date ? new Date(d.date).toISOString() : new Date().toISOString(),
      }));

      await transactionsApi.createBatch(payloadTransactions);

      haptics.notificationSuccess();
      showToast(
        `اتسجّل ${drafts.length} ${
          drafts.length === 1 ? 'معاملة' : drafts.length === 2 ? 'معاملتان' : 'معاملات'
        }`
      );

      onSuccess?.();
      onClose();
    } catch (err) {
      haptics.notificationError();
      setErrorMessage(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={startInVoiceMode
        ? drafts.length > 0 ? 'راجع معاملاتك' : 'تسجيل معاملة بالصوت'
        : strings.transactions.batchTitle}
      subtitle={startInVoiceMode
        ? drafts.length > 0 ? 'تأكد من المبالغ والتفاصيل قبل الحفظ' : 'اذكر المبلغ والوصف بطريقتك المعتادة'
        : undefined}
      isDirty={drafts.length > 0}
      footer={
        drafts.length > 0 ? (
          <Button
            title={strings.transactions.batchSaveAll.replace(
              '{count}',
              drafts.length.toString()
            )}
            onPress={handleSubmitBatch}
            loading={submitting}
            disabled={!validation.valid || submitting}
          />
        ) : undefined
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Focused voice capture for the Home shortcut; compact control in batch entry. */}
        {voiceSupported && startInVoiceMode ? (
          <View style={[styles.voicePanel, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: radii.lg }]}>
            <View style={styles.voicePanelHeading}>
              <View style={[styles.voiceStatusDot, { backgroundColor: voiceState === 'listening' ? colors.positive : colors.textTertiary }]} />
              <AppText variant="label" tone={voiceState === 'listening' ? 'positive' : 'secondary'}>
                {voiceState === 'listening' ? 'أستمع إليك الآن' : voiceState === 'recognizing' ? 'جاري تجهيز كلامك' : 'التسجيل الصوتي'}
              </AppText>
            </View>

            <Pressable
              onPress={voiceState === 'listening' || voiceState === 'recognizing' ? stopVoiceRecording : startVoiceRecording}
              style={[styles.voiceMainButton, { backgroundColor: voiceState === 'listening' ? colors.action : colors.action }]}
              accessibilityRole="button"
              accessibilityLabel={voiceState === 'listening' ? 'إيقاف التسجيل الصوتي' : 'ابدأ التسجيل الصوتي'}
              accessibilityState={{ busy: voiceState === 'listening' || voiceState === 'recognizing' }}
            >
              {voiceState === 'recognizing' ? (
                <ActivityIndicator color={colors.onAction} size="small" />
              ) : (
                <Icon name={voiceState === 'listening' ? 'stop' : 'mic'} size={25} color={colors.onAction} />
              )}
            </Pressable>

            <AppText variant="bodyStrong" style={styles.voicePrompt}>
              {voiceState === 'listening' ? 'قول المصروفات في جملة واحدة' : 'سجّل مشترياتك بسرعة'}
            </AppText>
            <AppText variant="caption" tone="secondary" style={styles.voiceExample}>
              مثال: دفعت ٢٠٠ جنيه سوبرماركت و٥٠ جنيه قهوة
            </AppText>

            {liveTranscript ? (
              <View style={[styles.transcriptBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppText variant="micro" tone="secondary" style={styles.transcriptLabel}>ما تم التقاطه</AppText>
                <AppText variant="body" style={styles.transcriptText}>{liveTranscript}</AppText>
              </View>
            ) : null}

            {drafts.length === 0 && (
              <Button
                title="إضافة بند يدوي"
                variant="text"
                onPress={handleAddEmptyDraft}
                style={styles.manualEntryButton}
              />
            )}
          </View>
        ) : voiceSupported && (
          <View
            style={[
              styles.voiceBar,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
                borderRadius: radii.md,
                padding: spacing.md,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">
                {voiceState === 'listening'
                  ? 'جاري الاستماع… تكلّم الآن'
                  : 'التسجيل الصوتي السريع'}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {liveTranscript || 'مثال: «دفعت 200 جنيه سوبرماركت و50 كافيه»'}
              </AppText>
            </View>

            <Pressable
              onPress={
                voiceState === 'listening' ? stopVoiceRecording : startVoiceRecording
              }
              style={[
                styles.micButton,
                {
                  backgroundColor:
                    voiceState === 'listening' ? colors.negative : colors.brand,
                },
              ]}
              accessibilityRole="button"
            >
              <Icon
                name={voiceState === 'listening' ? 'stop' : 'mic'}
                size={22}
                color={colors.textInverse}
              />
            </Pressable>
          </View>
        )}

        {!voiceSupported && startInVoiceMode && (
          <View style={[styles.unavailableVoice, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderRadius: radii.lg }]}>
            <Icon name="mic-off-outline" size={22} color={colors.textSecondary} />
            <AppText variant="bodyStrong" style={{ marginTop: 8, textAlign: 'center' }}>التسجيل الصوتي غير متاح هنا</AppText>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 4, textAlign: 'center' }}>تقدر تضيف المعاملة يدويًا وتراجعها قبل الحفظ.</AppText>
            {drafts.length === 0 && <Button title="إضافة بند يدوي" variant="secondary" onPress={handleAddEmptyDraft} style={{ marginTop: 14, alignSelf: 'stretch' }} />}
          </View>
        )}

        {errorMessage && (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.negativeMuted,
                borderRadius: radii.sm,
                borderColor: colors.negative,
              },
            ]}
          >
            <Icon name="alert-circle-outline" size={18} color={colors.negative} />
            <AppText
              variant="body"
              tone="negative"
              style={{ flex: 1, marginStart: 8 }}
            >
              {errorMessage}
            </AppText>
          </View>
        )}

        {/* Draft Items List */}
        {drafts.length === 0 ? (
          startInVoiceMode ? null : (
            <View style={[styles.emptyContainer, { padding: spacing.xl }]}>
              <Icon name="receipt-outline" size={40} color={colors.textTertiary} />
              <AppText variant="body" tone="secondary" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                مفيش معاملات جاهزة للمراجعة
              </AppText>
              <Button title="＋ ضيف بند يدوي" variant="secondary" onPress={handleAddEmptyDraft} style={{ marginTop: spacing.md }} />
            </View>
          )
        ) : (
          <View style={{ marginTop: spacing.md }}>
            {drafts.map((draft, index) => {
              const account = accounts.find((a) => a.id === draft.accountId);
              const category = categories.find((c) => c.id === draft.categoryId);

              return (
                <View
                  key={draft.id}
                  style={[
                    styles.draftCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radii.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <AppText variant="label" tone="secondary">
                      بند {index + 1}
                    </AppText>
                    <Pressable
                      onPress={() => handleRemoveDraft(draft.id)}
                      hitSlop={8}
                    >
                      <Icon name="trash-outline" size={18} color={colors.negative} />
                    </Pressable>
                  </View>

                  <View style={styles.row}>
                    {/* Amount Input */}
                    <View style={{ flex: 1 }}>
                      <AppText variant="caption" tone="secondary">
                        المبلغ
                      </AppText>
                      <TextInput
                        value={toArabicNumberSeparators(draft.amount)}
                        onChangeText={(txt) =>
                          handleUpdateDraft(draft.id, { amount: normalizeAmountInput(txt) })
                        }
                        placeholder="٠٫٠٠"
                        keyboardType="decimal-pad"
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            borderColor: !draft.amount ? colors.negative : colors.border,
                            borderRadius: radii.sm,
                            color: colors.textPrimary,
                          },
                        ]}
                      />
                    </View>

                    {/* Note Input */}
                    <View style={{ flex: 2, marginStart: 8 }}>
                      <AppText variant="caption" tone="secondary">
                        الوصف / ملاحظة
                      </AppText>
                      <TextInput
                        value={draft.note}
                        onChangeText={(txt) =>
                          handleUpdateDraft(draft.id, { note: txt })
                        }
                        placeholder="سوبرماركت، قهوة…"
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            borderRadius: radii.sm,
                            color: colors.textPrimary,
                            textAlign: 'right',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Account & Category summary pills */}
                  <View style={styles.chipsRow}>
                    <AppText variant="caption" tone="secondary">
                      الحساب:{' '}
                      <AppText variant="caption" style={{ fontWeight: '600' }}>
                        {account ? displayName(account.name) : 'كاش'}
                      </AppText>
                    </AppText>
                    <AppText
                      variant="caption"
                      tone="secondary"
                      style={{ marginStart: 16 }}
                    >
                      التصنيف:{' '}
                      <AppText variant="caption" style={{ fontWeight: '600' }}>
                        {category ? displayName(category.name) : 'بدون تصنيف'}
                      </AppText>
                    </AppText>
                  </View>
                </View>
              );
            })}

            {/* Add row button */}
            {drafts.length < 20 && (
              <Pressable
                onPress={handleAddEmptyDraft}
                style={[
                  styles.addRowBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    padding: spacing.md,
                  },
                ]}
              >
                <Icon name="add" size={18} color={colors.brand} />
                <AppText variant="body" tone="brand" style={{ marginStart: 8 }}>
                  ضيف بند تاني
                </AppText>
              </Pressable>
            )}

            {/* Summary & Disclaimers */}
            <View style={{ marginTop: spacing.lg }}>
              <View style={styles.summaryLine}>
                <AppText variant="bodyStrong">
                  {drafts.length} معاملات
                </AppText>
                <AppText variant="title3" tone="primary" style={{ writingDirection: 'ltr' }}>
                  {formatMoney(totalAmount, 'EGP')}
                </AppText>
              </View>

              <AppText
                variant="caption"
                tone="secondary"
                style={{ textAlign: 'center', marginTop: 4 }}
              >
                {strings.transactions.batchAtomicNote}
              </AppText>

              <View style={{ height: 16 }} />
            </View>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  voicePanel: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  unavailableVoice: {
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  voicePanelHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
  },
  voiceStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  voiceMainButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 14,
  },
  voicePrompt: {
    textAlign: 'center',
  },
  voiceExample: {
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 20,
  },
  transcriptBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  transcriptLabel: {
    textAlign: 'right',
    marginBottom: 4,
  },
  transcriptText: {
    textAlign: 'right',
  },
  manualEntryButton: {
    marginTop: 10,
  },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftCard: {
    borderWidth: 1,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    height: 42,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
});
