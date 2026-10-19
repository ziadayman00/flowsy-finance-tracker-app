import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Button,
  Segmented,
  Divider,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { categoriesApi } from '../../api/categories';
import {
  AccountResponseDto,
  CategoryResponseDto,
  TransactionType,
} from '../../api/types';
import { displayName } from '../../utils/names';
import { getMonthBoundaries } from '../../utils/dates';
import { strings } from '../../utils/strings.ar';

export interface TransactionFilterState {
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  periodPreset?: 'this_month' | 'last_month' | 'last_30_days' | null;
}

interface TransactionFiltersSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: TransactionFilterState;
  onApply: (filters: TransactionFilterState) => void;
  onReset: () => void;
}

export const TransactionFiltersSheet: React.FC<TransactionFiltersSheetProps> = ({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
}) => {
  const { colors, radii, spacing } = useTheme();

  const [selectedType, setSelectedType] = useState<TransactionType | undefined>(
    filters.type
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(
    filters.accountId
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    filters.categoryId
  );
  const [selectedPreset, setSelectedPreset] = useState<
    'this_month' | 'last_month' | 'last_30_days' | null
  >(filters.periodPreset || null);

  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [categories, setCategories] = useState<CategoryResponseDto[]>([]);

  useEffect(() => {
    if (visible) {
      setSelectedType(filters.type);
      setSelectedAccountId(filters.accountId);
      setSelectedCategoryId(filters.categoryId);
      setSelectedPreset(filters.periodPreset || null);
      loadAccountsAndCategories();
    }
  }, [visible, filters]);

  const loadAccountsAndCategories = async () => {
    try {
      const [accs, cats] = await Promise.all([
        accountsApi.getAccounts(true), // include archived so history is filterable
        categoriesApi.getCategories(),
      ]);
      setAccounts(accs);
      setCategories(cats);
    } catch {
      // ignore
    }
  };

  const handleApply = () => {
    let startDate: string | undefined;
    let endDate: string | undefined;

    const now = new Date();
    if (selectedPreset === 'this_month') {
      const { start, end } = getMonthBoundaries(now);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (selectedPreset === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { start, end } = getMonthBoundaries(lastMonth);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (selectedPreset === 'last_30_days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = thirtyDaysAgo.toISOString();
      endDate = now.toISOString();
    }

    onApply({
      type: selectedType,
      accountId: selectedAccountId,
      categoryId: selectedCategoryId,
      startDate,
      endDate,
      periodPreset: selectedPreset,
    });
    onClose();
  };

  const handleClear = () => {
    setSelectedType(undefined);
    setSelectedAccountId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedPreset(null);
    onReset();
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={strings.transactions.filterTitle}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title={strings.transactions.clearAll}
            variant="secondary"
            onPress={handleClear}
            style={{ flex: 1 }}
          />
          <Button
            title={strings.transactions.applyFilters}
            variant="primary"
            onPress={handleApply}
            style={{ flex: 2 }}
          />
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Type Filter */}
        <View style={{ marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
            {strings.transactions.filterType}
          </AppText>
          <Segmented
            options={[
              { label: 'الكل', value: 'ALL' },
              { label: strings.transactions.expense, value: 'EXPENSE' },
              { label: strings.transactions.income, value: 'INCOME' },
              { label: strings.transactions.transfer, value: 'TRANSFER' },
            ]}
            selectedValue={selectedType || 'ALL'}
            onSelect={(val) =>
              setSelectedType(val === 'ALL' ? undefined : (val as TransactionType))
            }
          />
        </View>

        {/* Period Presets */}
        <View style={{ marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
            {strings.transactions.filterPeriod}
          </AppText>
          <View style={styles.chipsRow}>
            {[
              { id: 'this_month', label: strings.transactions.thisMonth },
              { id: 'last_month', label: strings.transactions.lastMonth },
              { id: 'last_30_days', label: strings.transactions.last30Days },
            ].map((p) => {
              const active = selectedPreset === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedPreset(active ? null : (p.id as any))}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.surfaceSubtle : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {p.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Account Filter */}
        <View style={{ marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
            {strings.transactions.filterAccount}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => setSelectedAccountId(undefined)}
              style={[
                styles.chip,
                {
                  borderColor: !selectedAccountId ? colors.brand : colors.border,
                  backgroundColor: !selectedAccountId ? colors.surfaceSubtle : colors.surface,
                },
              ]}
            >
              <AppText
                variant="label"
                style={{
                  color: !selectedAccountId ? colors.brand : colors.textPrimary,
                  fontWeight: !selectedAccountId ? '600' : '400',
                }}
              >
                كل الحسابات
              </AppText>
            </Pressable>
            {accounts.map((acc) => {
              const active = selectedAccountId === acc.id;
              return (
                <Pressable
                  key={acc.id}
                  onPress={() => setSelectedAccountId(active ? undefined : acc.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.brand : colors.border,
                      backgroundColor: active ? colors.surfaceSubtle : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      fontWeight: active ? '600' : '400',
                    }}
                  >
                    {displayName(acc.name)} {acc.isArchived ? '(مؤرشف)' : ''}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Category Filter */}
        {selectedType !== 'TRANSFER' && (
          <View style={{ marginBottom: spacing.lg }}>
            <AppText variant="label" tone="secondary" style={{ marginBottom: spacing.xs }}>
              {strings.transactions.filterCategory}
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <Pressable
                onPress={() => setSelectedCategoryId(undefined)}
                style={[
                  styles.chip,
                  {
                    borderColor: !selectedCategoryId ? colors.brand : colors.border,
                    backgroundColor: !selectedCategoryId ? colors.surfaceSubtle : colors.surface,
                  },
                ]}
              >
                <AppText
                  variant="label"
                  style={{
                    color: !selectedCategoryId ? colors.brand : colors.textPrimary,
                    fontWeight: !selectedCategoryId ? '600' : '400',
                  }}
                >
                  كل التصنيفات
                </AppText>
              </Pressable>
              {categories.map((cat) => {
                const active = selectedCategoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCategoryId(active ? undefined : cat.id)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.surfaceSubtle : colors.surface,
                      },
                    ]}
                  >
                    <AppText
                      variant="label"
                      style={{
                        color: active ? colors.brand : colors.textPrimary,
                        fontWeight: active ? '600' : '400',
                      }}
                    >
                      {displayName(cat.name)}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
