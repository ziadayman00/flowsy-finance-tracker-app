import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Screen,
  AppText,
  Icon,
  Button,
  Money,
  SectionHeading,
  Skeleton,
} from '../../components/primitives';
import { accountsApi } from '../../api/accounts';
import { dashboardApi } from '../../api/dashboard';
import {
  AccountResponseDto,
  DashboardSummaryDto,
  AccountType,
} from '../../api/types';
import { formatMoney } from '../../utils/format';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { AddAccountSheet } from './AddAccountSheet';

interface AccountsScreenProps {
  onSelectAccount: (accountId: string) => void;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({
  onSelectAccount,
}) => {
  const { colors, radii, spacing } = useTheme();

  const [accounts, setAccounts] = useState<AccountResponseDto[]>([]);
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
      const [accs, sum] = await Promise.all([
        accountsApi.getAccounts(true), // load with archived
        dashboardApi.getSummary().catch(() => null),
      ]);
      setAccounts(accs);
      if (sum) setSummary(sum);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const baseCurrency = summary?.baseCurrency || 'EGP';

  // Group accounts
  const spendableAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.isArchived &&
          !a.excludeFromSafeToSpend &&
          a.currency === baseCurrency
      ),
    [accounts, baseCurrency]
  );

  const protectedAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.isArchived &&
          a.excludeFromSafeToSpend &&
          a.currency === baseCurrency
      ),
    [accounts, baseCurrency]
  );

  const otherCurrencyAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived && a.currency !== baseCurrency),
    [accounts, baseCurrency]
  );

  const archivedAccounts = useMemo(
    () => accounts.filter((a) => a.isArchived),
    [accounts]
  );

  const totalLiquid = summary?.totalLiquidBalance
    ? formatMoney(summary.totalLiquidBalance, baseCurrency)
    : '0 ج.م';

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'CASH':
        return 'cash-outline';
      case 'BANK':
        return 'card-outline';
      case 'SAVINGS':
        return 'wallet-outline';
      case 'MOBILE_WALLET':
        return 'phone-portrait-outline';
    }
  };

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'CASH':
        return 'نقد';
      case 'BANK':
        return 'حساب بنكي';
      case 'SAVINGS':
        return 'مدخرات';
      case 'MOBILE_WALLET':
        return 'محفظة إلكترونية';
    }
  };

  const renderAccountItem = (acc: AccountResponseDto, isProtected = false, isArchived = false) => (
    <Pressable
      key={acc.id}
      onPress={() => {
        haptics.impactLight();
        onSelectAccount(acc.id);
      }}
      style={({ pressed }) => [
        styles.accountItem,
        {
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
          backgroundColor: pressed ? colors.sunken : 'transparent',
          opacity: isArchived ? 0.6 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isProtected ? colors.warningSubtle : colors.sunken,
            borderRadius: radii.sm,
          },
        ]}
      >
        <Icon
          name={isProtected ? 'lock-closed-outline' : getAccountIcon(acc.type)}
          size={18}
          color={isProtected ? colors.warningText : colors.forest}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0, marginHorizontal: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <AppText variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{displayName(acc.name)}</AppText>
          {isProtected && (
            <View style={[styles.badge, { backgroundColor: colors.warningSubtle }]}>
              <AppText variant="micro" tone="warning">
                محمي
              </AppText>
            </View>
          )}
        </View>
        <AppText variant="caption" tone="secondary" style={{ marginTop: 2 }}>
          {getAccountTypeLabel(acc.type)}
        </AppText>
      </View>

      <Money
        value={acc.currentBalance}
        currency={acc.currency}
        variant="amountSm"
        tone={isArchived ? 'secondary' : 'primary'}
      />
    </Pressable>
  );

  return (
    <Screen hasTabBar scrollable={false}>
      {/* 1. Header */}
      <View
        style={[
          styles.headerRow,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: 12,
            paddingBottom: 8,
          },
        ]}
      >
        <View>
          <AppText variant="caption" tone="secondary">
            المصادر والمحافظ
          </AppText>
          <AppText variant="title2">{strings.accounts.title}</AppText>
        </View>

        <Pressable
          onPress={() => setAddSheetVisible(true)}
          style={[
            styles.addBtn,
            { backgroundColor: colors.forest, borderColor: colors.forest },
          ]}
          accessibilityRole="button"
        >
            <Icon name="add" size={20} color={colors.onAction} />
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={80} width="100%" />
          <Skeleton height={50} width="100%" />
          <Skeleton height={50} width="100%" />
        </View>
      ) : loadError ? (
        <View style={[styles.centerBox, { padding: spacing.xl }]}>
          <Icon name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <AppText variant="title3" style={{ marginTop: 12, marginBottom: 6, textAlign: 'center' }}>
            تعذّر تحميل الحسابات
          </AppText>
          <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginBottom: 18 }}>
            تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.
          </AppText>
          <Button title="إعادة المحاولة" onPress={loadData} />
        </View>
      ) : accounts.filter((a) => !a.isArchived).length === 0 ? (
        /* Empty State */
        <View style={[styles.centerBox, { padding: spacing.xl }]}>
          <Icon name="wallet-outline" size={48} color={colors.textDisabled} />
          <AppText variant="title2" style={{ marginTop: 12, marginBottom: 4 }}>
            مفيش حسابات مسجلة حالياً
          </AppText>
          <AppText variant="body" tone="secondary" style={{ textAlign: 'center', marginBottom: 20 }}>
            سجّل أول حساب مالي (كاش، محفظة أو بنك) لتتمكن من إضافة المعاملات وحساب رصيدك
          </AppText>
          <Button
            title={strings.accounts.addAccount}
            onPress={() => setAddSheetVisible(true)}
          />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.forest}
            />
          }
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Total Liquid Net Worth Header Card */}
          <View style={styles.summaryCard}>
            <AppText variant="sectionHeading" tone="secondary">
              إجمالي السيولة المتاحة
            </AppText>
            <View style={{ marginTop: 4 }}>
              <Money
                value={summary?.totalLiquidBalance || '0.00'}
                currency={baseCurrency}
                variant="display"
                tone="primary"
                dimDecimals
              />
            </View>
            <AppText variant="caption" tone="secondary" style={{ marginTop: 6 }}>
              موزعة على {spendableAccounts.length} حسابات نشطة قابلة للصرف
            </AppText>
          </View>

          {/* 3. Spendable Accounts List */}
          <View style={{ marginTop: spacing.md }}>
            <SectionHeading title="الحسابات القابلة للصرف" withLine />
            {spendableAccounts.map((acc) => renderAccountItem(acc, false, false))}
          </View>

          {/* 4. Protected Accounts (if any) */}
          {protectedAccounts.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <SectionHeading title="المدخرات المحمية (خارج المتاح للصرف)" withLine />
              {protectedAccounts.map((acc) => renderAccountItem(acc, true, false))}
            </View>
          )}

          {/* 5. Other Currency Accounts (if any) */}
          {otherCurrencyAccounts.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <SectionHeading title="حسابات بعملات أخرى" withLine />
              {otherCurrencyAccounts.map((acc) => renderAccountItem(acc, false, false))}
            </View>
          )}

          {/* 6. Archived Accounts Collapsible */}
          {archivedAccounts.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <Pressable
                onPress={() => setShowArchived(!showArchived)}
                style={styles.archivedToggle}
              >
                <AppText variant="body" tone="secondary">
                  الحسابات المؤرشفة ({archivedAccounts.length})
                </AppText>
                <Icon
                  name={showArchived ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>

              {showArchived && (
                <View style={{ marginTop: 8 }}>
                  {archivedAccounts.map((acc) => renderAccountItem(acc, false, true))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Account Sheet (S42) */}
      <AddAccountSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        baseCurrency={baseCurrency}
        onSuccess={loadData}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  summaryCard: {
    marginTop: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  archivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
