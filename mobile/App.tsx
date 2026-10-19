import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './src/theme';
import { ToastProvider } from './src/context/ToastContext';
import { tokenStorage } from './src/api/tokenStorage';
import { authApi } from './src/api/auth';
import { accountsApi } from './src/api/accounts';
import {
  AccountResponseDto,
  CommitmentResponseDto,
  TransactionResponseDto,
  TransactionType,
} from './src/api/types';

import { AppText } from './src/components/primitives';
import { BottomTabBar, TabRoute } from './src/components/navigation/BottomTabBar';

// Auth Screens (S01 - S04)
import { WelcomeScreen } from './src/screens/auth/WelcomeScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { StartingBalancesScreen } from './src/screens/auth/StartingBalancesScreen';

// Core Screens (S10, S20, S30, S40, S50)
import { HomeScreen } from './src/screens/home/HomeScreen';
import { TransactionsScreen } from './src/screens/transactions/TransactionsScreen';
import { AddTransactionSheet } from './src/screens/transactions/AddTransactionSheet';
import { QuickEntryReviewSheet } from './src/screens/transactions/QuickEntryReviewSheet';
import { PlanScreen } from './src/screens/plan/PlanScreen';
import { PayCommitmentSheet } from './src/screens/commitments/PayCommitmentSheet';
import { AccountsScreen } from './src/screens/accounts/AccountsScreen';
import { AccountDetailScreen } from './src/screens/accounts/AccountDetailScreen';
import { AddAccountSheet } from './src/screens/accounts/AddAccountSheet';
import { SettingsScreen } from './src/screens/settings/SettingsScreen';
import { CategoriesScreen } from './src/screens/settings/CategoriesScreen';

type AuthFlowState = 'CHECKING' | 'WELCOME' | 'LOGIN' | 'REGISTER' | 'STARTING_BALANCES' | 'APP';

const AppNavigator: React.FC = () => {
  const { colors, isDark } = useTheme();

  // Root navigation state
  const [authState, setAuthState] = useState<AuthFlowState>('CHECKING');
  const [activeTab, setActiveTab] = useState<TabRoute>('home');

  // Stack navigation states
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Global sheet states
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [addTxVisible, setAddTxVisible] = useState(false);
  const [newTransactionType, setNewTransactionType] = useState<TransactionType>('EXPENSE');
  const [voiceReviewVisible, setVoiceReviewVisible] = useState(false);
  const [voiceReviewStartMic, setVoiceReviewStartMic] = useState(false);
  const [payingCommitment, setPayingCommitment] = useState<CommitmentResponseDto | null>(null);

  // S00 Session gate
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const tokens = await tokenStorage.getTokens();
        if (!tokens?.accessToken) {
          if (isMounted) setAuthState('WELCOME');
          return;
        }

        // Verify active token validity
        await authApi.getMe();
        const accs = await accountsApi.getAccounts();
        const active = accs.filter((a) => !a.isArchived);

        if (isMounted) {
          setAuthState(active.length > 0 ? 'APP' : 'STARTING_BALANCES');
        }
      } catch {
        // If session invalid and refresh failed, clear local state
        await tokenStorage.clearTokens();
        if (isMounted) setAuthState('WELCOME');
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    await tokenStorage.clearTokens();
    setSelectedAccountId(null);
    setSettingsOpen(false);
    setCategoriesOpen(false);
    setAuthState('WELCOME');
  };

  // S00 Splash / Session checking
  if (authState === 'CHECKING') {
    return (
      <View style={[styles.splashContainer, { backgroundColor: colors.background }]}>
        <AppText variant="caption" tone="secondary">
          دفتر الصرف الذكي
        </AppText>
        <AppText variant="display" tone="brand" style={{ letterSpacing: 0.4, marginTop: 6 }}>
          Flowsy
        </AppText>
        <AppText variant="body" tone="secondary" style={{ marginTop: 8 }}>
          {strings.auth.welcomeHeadline}
        </AppText>
        <ActivityIndicator size="small" color={colors.brand} style={{ marginTop: 24 }} />
      </View>
    );
  }

  // Auth Flow Screens
  if (authState === 'WELCOME') {
    return (
      <WelcomeScreen
        onStartRegister={() => setAuthState('REGISTER')}
        onGoToLogin={() => setAuthState('LOGIN')}
      />
    );
  }

  if (authState === 'LOGIN') {
    return (
      <LoginScreen
        onLoginSuccess={async () => {
          try {
            const accs = await accountsApi.getAccounts();
            const active = accs.filter((a) => !a.isArchived);
            setAuthState(active.length > 0 ? 'APP' : 'STARTING_BALANCES');
          } catch {
            setAuthState('APP');
          }
        }}
        onGoToRegister={() => setAuthState('REGISTER')}
        onBack={() => setAuthState('WELCOME')}
      />
    );
  }

  if (authState === 'REGISTER') {
    return (
      <RegisterScreen
        onRegisterSuccess={() => setAuthState('STARTING_BALANCES')}
        onGoToLogin={() => setAuthState('LOGIN')}
        onBack={() => setAuthState('WELCOME')}
      />
    );
  }

  if (authState === 'STARTING_BALANCES') {
    return <StartingBalancesScreen onComplete={() => setAuthState('APP')} />;
  }

  // Main Application Stack Screens
  if (categoriesOpen) {
    return (
      <CategoriesScreen
        onBack={() => setCategoriesOpen(false)}
      />
    );
  }

  if (settingsOpen) {
    return (
      <SettingsScreen
        onBack={() => setSettingsOpen(false)}
        onNavigateToCategories={() => setCategoriesOpen(true)}
        onSignedOut={handleSignOut}
      />
    );
  }

  if (selectedAccountId) {
    return (
      <AccountDetailScreen
        accountId={selectedAccountId}
        onBack={() => setSelectedAccountId(null)}
        onNavigateToTransactions={() => {
          setSelectedAccountId(null);
          setActiveTab('transactions');
        }}
      />
    );
  }

  // Main Tab Container
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Tab Screen Content */}
      <View style={styles.screenContainer}>
        {activeTab === 'home' && (
          <HomeScreen
            onOpenQuickAdd={(type = 'EXPENSE') => {
              setNewTransactionType(type);
              setAddTxVisible(true);
            }}
            onOpenVoiceEntry={() => {
              setVoiceReviewStartMic(true);
              setVoiceReviewVisible(true);
            }}
            onPayCommitment={(comm) => setPayingCommitment(comm)}
            onNavigateToPlan={() => setActiveTab('plan')}
            onNavigateToAccounts={() => setActiveTab('accounts')}
            onNavigateToSettings={() => setSettingsOpen(true)}
            onAddAccount={() => setAddAccountVisible(true)}
            onNavigateToTransactions={() => setActiveTab('transactions')}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsScreen
            onNavigateToAccount={(accId) => setSelectedAccountId(accId)}
          />
        )}

        {activeTab === 'plan' && (
          <PlanScreen
            onFilterTransactions={() => setActiveTab('transactions')}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsScreen
            onSelectAccount={(accId) => setSelectedAccountId(accId)}
          />
        )}
      </View>

      {/* Bottom Tab Bar with Integrated Central Add Action */}
      <BottomTabBar
        activeRoute={activeTab}
        onNavigate={(tab: TabRoute) => setActiveTab(tab)}
        onAddPress={() => {
          setNewTransactionType('EXPENSE');
          setAddTxVisible(true);
        }}
        onAddLongPress={() => {
          setVoiceReviewStartMic(true);
          setVoiceReviewVisible(true);
        }}
      />

      {/* Global Add Account Sheet (S42) */}
      <AddAccountSheet
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
      />

      {/* Global Add Transaction Sheet (S11) */}
      <AddTransactionSheet
        visible={addTxVisible}
        onClose={() => setAddTxVisible(false)}
        defaultType={newTransactionType}
      />

      {/* Global Quick Entry / Voice Review Sheet (S12) */}
      <QuickEntryReviewSheet
        visible={voiceReviewVisible}
        onClose={() => {
          setVoiceReviewVisible(false);
          setVoiceReviewStartMic(false);
        }}
        startInVoiceMode={voiceReviewStartMic}
      />

      {/* Global Pay Commitment Sheet (S33) */}
      <PayCommitmentSheet
        visible={!!payingCommitment}
        onClose={() => setPayingCommitment(null)}
        commitment={payingCommitment}
      />
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppNavigator />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
