import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AppText } from '../primitives/AppText';
import { Icon, IconName } from '../primitives/Icon';
import { strings } from '../../utils/strings.ar';
import { haptics, hapticSelection } from '../../utils/haptics';

export type TabKey = 'home' | 'transactions' | 'plan' | 'accounts';
export type TabRoute = TabKey;

interface TabItemDef {
  key: TabKey;
  label: string;
  icon: IconName;
  activeIcon: IconName;
}

const TABS: TabItemDef[] = [
  {
    key: 'home',
    label: strings.nav.home,
    icon: 'home-outline',
    activeIcon: 'home',
  },
  {
    key: 'transactions',
    label: strings.nav.transactions,
    icon: 'swap-vertical-outline',
    activeIcon: 'swap-vertical',
  },
  {
    key: 'plan',
    label: strings.nav.plan,
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    key: 'accounts',
    label: strings.nav.accounts,
    icon: 'wallet-outline',
    activeIcon: 'wallet',
  },
];

export interface BottomTabBarProps {
  currentTab?: TabKey;
  activeRoute?: TabKey;
  onSelectTab?: (tab: TabKey) => void;
  onNavigate?: (tab: TabKey) => void;
  onAddPress?: () => void;
  onAddLongPress?: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentTab,
  activeRoute,
  onSelectTab,
  onNavigate,
  onAddPress,
  onAddLongPress,
}) => {
  const active = activeRoute || currentTab || 'home';
  const handleSelect = onNavigate || onSelectTab;

  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const renderTabItem = (tab: TabItemDef) => {
    const isActive = active === tab.key;
    return (
      <Pressable
        key={tab.key}
        onPress={() => {
          if (!isActive) {
            hapticSelection();
            handleSelect?.(tab.key);
          }
        }}
        style={styles.tabButton}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={tab.label}
      >
        <Icon
          name={isActive ? tab.activeIcon : tab.icon}
          size={20}
          color={isActive ? colors.brand : colors.textDisabled}
        />
        <AppText
          variant="nav"
          tone={isActive ? 'primary' : 'disabled'}
          style={[
            styles.tabText,
            { color: isActive ? colors.brand : colors.textDisabled },
          ]}
        >
          {tab.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.dockArea,
        {
          backgroundColor: colors.bg,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingHorizontal: spacing.md,
        },
      ]}
    >
    <View
      style={[
        styles.barContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          paddingTop: spacing.xs,
          shadowColor: colors.stampFrom,
        },
      ]}
      accessibilityRole="tablist"
    >
      {/* First 2 tabs: Home & Transactions */}
      {TABS.slice(0, 2).map(renderTabItem)}

      {/* Central Editorial Add Button */}
      {onAddPress && (
        <View style={styles.centerAddWrapper}>
          <Pressable
            onPress={() => {
              haptics.impactMedium();
              onAddPress();
            }}
            onLongPress={
              onAddLongPress
                ? () => {
                    haptics.impactMedium();
                    onAddLongPress();
                  }
                : undefined
            }
            style={({ pressed }) => [
              styles.centerAddButton,
              {
                backgroundColor: colors.action,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="تسجيل معاملة جديدة"
            accessibilityHint="اضغط مطولاً للتسجيل بالصوت"
          >
            <Icon name="add" size={26} color={colors.onAction} />
          </Pressable>
          <AppText variant="nav" style={[styles.addLabel, { color: colors.textSecondary }]}>
            إضافة
          </AppText>
        </View>
      )}

      {/* Remaining 2 tabs: Plan & Accounts */}
      {TABS.slice(2, 4).map(renderTabItem)}
    </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockArea: {
    paddingTop: 4,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: 20,
    paddingBottom: 4,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  tabText: {
    textAlign: 'center',
  },
  centerAddWrapper: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    gap: 1,
  },
  centerAddButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontWeight: '600',
  },
});
