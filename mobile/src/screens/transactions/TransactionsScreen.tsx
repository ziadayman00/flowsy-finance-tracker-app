import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  SectionList,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Screen,
  AppText,
  Icon,
  Money,
  Button,
  Card,
  LedgerRow,
  SectionHeading,
  Skeleton,
} from '../../components/primitives';
import { transactionsApi } from '../../api/transactions';
import { TransactionResponseDto } from '../../api/types';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import {
  TransactionFiltersSheet,
  TransactionFilterState,
} from './TransactionFiltersSheet';
import { AddTransactionSheet } from './AddTransactionSheet';
import { ImportSheet } from './ImportSheet';


interface TransactionsScreenProps {
  initialCategoryId?: string;
  initialAccountId?: string;
  onNavigateToAccount?: (accountId: string) => void;
}

interface DateGroup {
  title: string;
  data: TransactionResponseDto[];
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  initialCategoryId,
  initialAccountId,
  onNavigateToAccount,
}) => {
  const { colors, radii, spacing } = useTheme();

  // Transactions list & pagination
  const [transactions, setTransactions] = useState<TransactionResponseDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Filters state
  const [filters, setFilters] = useState<TransactionFilterState>({
    categoryId: initialCategoryId,
    accountId: initialAccountId,
  });

  // Modal / Sheet states
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionResponseDto | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionResponseDto | null>(null);
  const [copyTx, setCopyTx] = useState<TransactionResponseDto | null>(null);
  const [importSheetVisible, setImportSheetVisible] = useState(false);


  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.type ||
      filters.accountId ||
      filters.categoryId ||
      filters.periodPreset ||
      filters.startDate
    );
  }, [filters]);

  const fetchTransactions = useCallback(
    async (pageToLoad: number, append: boolean = false) => {
      try {
        if (!append) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        const res = await transactionsApi.getTransactions({
          page: pageToLoad,
          limit: 25,
          type: filters.type,
          accountId: filters.accountId,
          categoryId: filters.categoryId,
          startDate: filters.startDate,
          endDate: filters.endDate,
        });

        setTransactions((prev) => (append ? [...prev, ...res.data] : res.data));
        setPage(res.page);
        setTotalPages(res.totalPages);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    fetchTransactions(1, false);
  }, [fetchTransactions]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions(1, false);
  }, [fetchTransactions]);

  const handleLoadMore = () => {
    if (loading || loadingMore || page >= totalPages) return;
    fetchTransactions(page + 1, true);
  };

  // Local search filter
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const query = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      const cat = t.category?.name ? displayName(t.category.name).toLowerCase() : '';
      const acc = displayName(t.account.name).toLowerCase();
      const dest = t.destinationAccount
        ? displayName(t.destinationAccount.name).toLowerCase()
        : '';
      const note = t.note ? t.note.toLowerCase() : '';
      return (
        cat.includes(query) ||
        acc.includes(query) ||
        dest.includes(query) ||
        note.includes(query)
      );
    });
  }, [transactions, searchQuery]);

  // Group by Date for Editorial Ledger presentation
  const groupedSections = useMemo<DateGroup[]>(() => {
    const groups: { [key: string]: TransactionResponseDto[] } = {};

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    for (const tx of filteredTransactions) {
      const dateKey = tx.transactionDate.slice(0, 10);
      let label = dateKey;
      if (dateKey === todayStr) {
        label = 'اليوم';
      } else if (dateKey === yesterdayStr) {
        label = 'أمس';
      } else {
        const d = new Date(tx.transactionDate);
        label = new Intl.DateTimeFormat('ar-EG', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(d);
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(tx);
    }

    return Object.keys(groups).map((key) => ({
      title: key,
      data: groups[key],
    }));
  }, [filteredTransactions]);

  return (
    <Screen hasTabBar scrollable={false}>
      {/* 1. Editorial Header Row */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.lg }]}>
        <View>
          <AppText variant="caption" tone="secondary">
            السجل المالي
          </AppText>
          <AppText variant="title2">{strings.transactions.title}</AppText>
        </View>

        <View style={styles.headerActions}>
          {/* Import button */}
          <Pressable
            onPress={() => setImportSheetVisible(true)}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.sunken,
                borderColor: colors.border,
                marginEnd: 8,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="استيراد معاملات"
          >
            <Icon name="cloud-upload-outline" size={18} color={colors.textPrimary} />
          </Pressable>

          {/* Filter button */}
          <Pressable
            onPress={() => setFilterSheetVisible(true)}
            style={[
              styles.iconBtn,
              {
                backgroundColor: hasActiveFilters ? colors.forest : colors.sunken,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
          >
            <Icon
              name="funnel-outline"
              size={18}
                color={hasActiveFilters ? colors.onAction : colors.textPrimary}
            />
          </Pressable>

        </View>

      </View>

      {/* 2. Active Filter Banner */}
      {hasActiveFilters && (
        <View
          style={[
            styles.filterBar,
            {
              backgroundColor: colors.sunken,
              borderBottomColor: colors.border,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          <AppText variant="caption" tone="brand" style={{ flex: 1, fontWeight: '600' }}>
            فلاتر مخصصة مفعلة
          </AppText>
          <Pressable onPress={() => setFilters({})}>
            <AppText variant="caption" tone="secondary">
              {strings.transactions.clearFilters}
            </AppText>
          </Pressable>
        </View>
      )}

      {/* 3. Search Bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.sm,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Icon name="search-outline" size={17} color={colors.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="بحث في البيان، الحساب، الفئة…"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.searchInput,
              {
                color: colors.textPrimary,
                marginStart: 8,
              },
            ]}
          />
          {!!searchQuery && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Icon name="close-circle" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 4. Ledger SectionList */}
      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={20} width={120} />
          <Skeleton height={56} width="100%" />
          <Skeleton height={56} width="100%" />
          <Skeleton height={20} width={100} style={{ marginTop: 12 }} />
          <Skeleton height={56} width="100%" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={36} color={colors.negative} />
          <AppText variant="body" tone="negative" style={{ marginTop: 8, textAlign: 'center' }}>
            {error}
          </AppText>
          <Button
            title="إعادة المحاولة"
            variant="secondary"
            onPress={() => fetchTransactions(1, false)}
            style={{ marginTop: 16 }}
          />
        </View>
      ) : groupedSections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="receipt-outline" size={44} color={colors.textDisabled} />
          <AppText variant="title2" style={{ marginTop: 12, marginBottom: 4 }}>
            {strings.transactions.emptyList}
          </AppText>
          <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginBottom: 20 }}>
            {hasActiveFilters
              ? strings.transactions.emptyFiltered
              : 'ابدأ بتسجيل أول مصروف أو دخل في سجلك المالي'}
          </AppText>
          <Button
            title={strings.transactions.addFirst}
            onPress={() => {
              setEditingTx(null);
              setCopyTx(null);
              setAddSheetVisible(true);
            }}
          />
        </View>
      ) : (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.forest}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          renderSectionHeader={({ section: { title } }) => (
            <SectionHeading title={title} withLine style={{ marginTop: spacing.md }} />
          )}
          renderItem={({ item, index, section }) => (
            <LedgerRow
              title={
                item.type === 'TRANSFER'
                  ? item.destinationAccount
                    ? `تحويل إلى ${displayName(item.destinationAccount.name)}`
                    : 'تحويل بين حسابين'
                  : item.note
                  ? item.note
                  : item.category
                  ? displayName(item.category.name)
                  : strings.transactions.uncategorized
              }
              categoryName={item.category ? displayName(item.category.name) : undefined}
              categoryIcon={item.category?.icon}
              accountName={displayName(item.account.name)}
              dateContext={new Date(item.transactionDate).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              amount={item.amount}
              type={item.type}
              currency={item.currency}
              hasBottomLine={index < section.data.length - 1}
              onPress={() => {
                setSelectedTx(item);
                setDetailVisible(true);
                haptics.impactLight();
              }}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.forest} />
              </View>
            ) : null
          }
        />
      )}

      {/* Transaction Detail Sheet (S21) */}
      <TransactionDetailSheet
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedTx(null);
        }}
        transaction={selectedTx}
        onEdit={(tx) => {
          setEditingTx(tx);
          setCopyTx(null);
          setDetailVisible(false);
          setAddSheetVisible(true);
        }}
        onCopyAsNew={(tx) => {
          setCopyTx(tx);
          setEditingTx(null);
          setDetailVisible(false);
          setSelectedTx(null);
          setAddSheetVisible(true);
        }}
        onDeleted={() => {
          fetchTransactions(1, false);
        }}
        onNavigateToAccount={onNavigateToAccount}
      />

      {/* Filter Sheet (S22) */}
      <TransactionFiltersSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setFilterSheetVisible(false);
        }}
        onReset={() => {
          setFilters({});
          setFilterSheetVisible(false);
        }}
      />

      {/* Add / Edit Sheet (S11) */}
      <AddTransactionSheet
        visible={addSheetVisible}
        onClose={() => {
          setAddSheetVisible(false);
          setEditingTx(null);
          setCopyTx(null);
        }}
        editTransaction={editingTx}
        copyFromTransaction={copyTx}
        onSuccess={() => {
          fetchTransactions(1, false);
        }}
      />

      {/* Import Sheet */}
      <ImportSheet
        visible={importSheetVisible}
        onClose={() => setImportSheetVisible(false)}
        onSuccess={() => fetchTransactions(1, false)}
      />
    </Screen>
  );

};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    textAlign: 'right',
                fontSize: 15,
                lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
