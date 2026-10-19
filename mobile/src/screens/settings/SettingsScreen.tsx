import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Screen,
  AppText,
  Icon,
  Button,
  Card,
  SectionHeading,
  ConfirmDialog,
} from '../../components/primitives';
import { authApi } from '../../api/auth';
import { usersApi } from '../../api/users';
import { apiClient } from '../../api/client';
import { tokenStorage } from '../../api/tokenStorage';
import { UserProfileDto } from '../../api/types';
import { displayName } from '../../utils/names';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';
import { EditProfileSheet } from './EditProfileSheet';

interface SettingsScreenProps {
  onBack: () => void;
  onNavigateToCategories: () => void;
  onSignedOut: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onNavigateToCategories,
  onSignedOut,
}) => {
  const { colors, radii, spacing, themePreference, setThemePreference } = useTheme();
  const { showToast } = useToast();

  const [user, setUser] = useState<UserProfileDto | null>(null);
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('connected');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Sheets & dialogs
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [confirmCurrencyVisible, setConfirmCurrencyVisible] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const [confirmLogoutAllVisible, setConfirmLogoutAllVisible] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Data export
  const [exportLoading, setExportLoading] = useState(false);

  // Account deletion
  const [confirmDeleteAccountVisible, setConfirmDeleteAccountVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);


  useEffect(() => {
    loadProfileAndHealth();
  }, []);

  const loadProfileAndHealth = async () => {
    try {
      const profile = await usersApi.getProfile();
      setUser(profile);
    } catch {
      // ignore
    }

    try {
      await apiClient.get('/health');
      setServerStatus('connected');
    } catch {
      setServerStatus('disconnected');
    }
  };

  const handleLogout = async (allDevices: boolean = false) => {
    try {
      setLogoutLoading(true);
      await authApi.logout(allDevices);
    } catch {
      // Even if network fails, always clear local credentials
    } finally {
      await tokenStorage.clearTokens();
      setLogoutLoading(false);
      onSignedOut();
    }
  };

  const handleSelectCurrency = (cur: string) => {
    if (!user || user.currency === cur) return;
    setPendingCurrency(cur);
    setConfirmCurrencyVisible(true);
  };

  const handleConfirmCurrency = async () => {
    if (!pendingCurrency) return;

    try {
      const updated = await usersApi.updateProfile({ currency: pendingCurrency });
      setUser(updated);
      haptics.notificationSuccess();
      showToast('تم تغيير العملة الأساسية بنجاح');
      setConfirmCurrencyVisible(false);
    } catch {
      showToast('تعذر تغيير العملة');
    }
  };

  const handleExportData = async () => {
    try {
      setExportLoading(true);
      await apiClient.get('/users/me/export');
      haptics.notificationSuccess();
      showToast('تم إرسال طلب التصدير — ستصلك بياناتك قريباً');
    } catch {
      showToast('تعذر تصدير البيانات');
      haptics.notificationError();
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await apiClient.delete('/users/me');
      haptics.notificationSuccess();
      await tokenStorage.clearTokens();
      setConfirmDeleteAccountVisible(false);
      onSignedOut();
    } catch {
      showToast('تعذر حذف الحساب');
      haptics.notificationError();
      setDeletingAccount(false);
    }
  };

  return (
    <Screen scrollable>
      {/* Top Header */}
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
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={colors.textPrimary} isRTLMirrored />
        </Pressable>
        <AppText variant="title2">{strings.settings.title}</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        {/* Section: الحساب */}
        <View style={{ marginTop: spacing.md }}>
          <SectionHeading title={strings.settings.accountSection} withLine />

          <Card variant="surface" style={{ padding: 0 }}>
            <Pressable
              onPress={() => setEditProfileVisible(true)}
              style={({ pressed }) => [
                styles.settingRow,
                {
                  backgroundColor: pressed ? colors.sunken : 'transparent',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">
                  {user ? displayName(user.displayName) : 'المستخدم'}
                </AppText>
                <AppText variant="caption" tone="secondary" style={{ writingDirection: 'ltr', marginTop: 2 }}>
                  {user ? user.email : ''}
                </AppText>
              </View>
              <Icon name="chevron-forward" size={16} color={colors.textTertiary} isRTLMirrored />
            </Pressable>
          </Card>
        </View>

        {/* Section: التفضيلات */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeading title={strings.settings.preferencesSection} withLine />

          <Card variant="surface" style={{ padding: 0 }}>
            {/* Theme Selector */}
            <View
              style={[
                styles.settingRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">{strings.settings.theme}</AppText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[
                  { id: 'light', label: 'فاتح' },
                  { id: 'dark', label: 'داكن' },
                  { id: 'system', label: 'تلقائي' },
                ].map((t) => {
                  const active = themePreference === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setThemePreference(t.id as any)}
                      style={[
                        styles.pillBtn,
                        {
                          backgroundColor: active ? colors.forest : colors.sunken,
                          borderColor: active ? colors.forest : colors.border,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={{
                          color: active ? colors.paper : colors.textPrimary,
                          fontWeight: active ? '600' : '400',
                        }}
                      >
                        {t.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Haptics Switch */}
            <View
              style={[
                styles.settingRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">{strings.settings.haptics}</AppText>
              <Switch
                value={hapticsEnabled}
                onValueChange={setHapticsEnabled}
                trackColor={{ false: colors.border, true: colors.forest }}
              />
            </View>

            {/* Categories Management Link */}
            <Pressable
              onPress={onNavigateToCategories}
              style={({ pressed }) => [
                styles.settingRow,
                {
                  backgroundColor: pressed ? colors.sunken : 'transparent',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">{strings.settings.categories}</AppText>
              <Icon name="chevron-forward" size={16} color={colors.textTertiary} isRTLMirrored />
            </Pressable>
          </Card>
        </View>

        {/* Section: متقدم */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeading title={strings.settings.advancedSection} withLine />

          <Card variant="surface" style={{ padding: 0 }}>
            {/* Base Currency Selection */}
            <View
              style={[
                styles.settingRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">{strings.settings.baseCurrency}</AppText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['EGP', 'USD', 'EUR', 'SAR', 'AED'].map((cur) => {
                  const active = user?.currency === cur;
                  return (
                    <Pressable
                      key={cur}
                      onPress={() => handleSelectCurrency(cur)}
                      style={[
                        styles.pillBtn,
                        {
                          backgroundColor: active ? colors.forest : colors.sunken,
                          borderColor: active ? colors.forest : colors.border,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        style={{
                          color: active ? colors.paper : colors.textPrimary,
                          fontWeight: active ? '600' : '400',
                        }}
                      >
                        {cur}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Timezone */}
            <View
              style={[
                styles.settingRow,
                {
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">{strings.settings.timezone}</AppText>
              <AppText variant="caption" tone="secondary">
                {user ? user.timezone : 'Africa/Cairo'}
              </AppText>
            </View>
          </Card>
        </View>

        {/* Section: البيانات والخصوصية */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeading title="البيانات والخصوصية" withLine />

          <Card variant="surface" style={{ padding: 0 }}>
            {/* Export Data */}
            <Pressable
              onPress={handleExportData}
              disabled={exportLoading}
              style={({ pressed }) => [
                styles.settingRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  backgroundColor: pressed ? colors.sunken : 'transparent',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">تصدير بياناتي</AppText>
              {exportLoading ? (
                <ActivityIndicator size="small" color={colors.forest} />
              ) : (
                <Icon name="download-outline" size={18} color={colors.textTertiary} />
              )}
            </Pressable>

            {/* Delete Account */}
            <Pressable
              onPress={() => setConfirmDeleteAccountVisible(true)}
              style={({ pressed }) => [
                styles.settingRow,
                {
                  backgroundColor: pressed ? colors.sunken : 'transparent',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body" tone="negative">حذف الحساب نهائياً</AppText>
              <Icon name="trash-outline" size={18} color={colors.negative} />
            </Pressable>
          </Card>
        </View>

        {/* Section: الأمان */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeading title={strings.settings.securitySection} withLine />


          <Card variant="surface" style={{ padding: 0 }}>
            <Pressable
              onPress={() => handleLogout(false)}
              style={({ pressed }) => [
                styles.settingRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  backgroundColor: pressed ? colors.sunken : 'transparent',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body" tone="negative">
                {strings.settings.logout}
              </AppText>
              <Icon name="log-out-outline" size={18} color={colors.negative} />
            </Pressable>

            <Pressable
              onPress={() => setConfirmLogoutAllVisible(true)}
              style={({ pressed }) => [
                styles.settingRow,
                {
                  backgroundColor: pressed ? colors.sunken : 'transparent',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body" tone="negative">
                {strings.settings.logoutAll}
              </AppText>
              <Icon name="exit-outline" size={18} color={colors.negative} />
            </Pressable>
          </Card>
        </View>

        {/* Section: عن التطبيق */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeading title={strings.settings.aboutSection} withLine />

          <Card variant="surface" style={{ padding: 0 }}>
            <View
              style={[
                styles.settingRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">{strings.settings.version}</AppText>
              <AppText variant="caption" tone="secondary">
                1.0.0
              </AppText>
            </View>

            <View
              style={[
                styles.settingRow,
                {
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <AppText variant="body">{strings.settings.serverStatus}</AppText>
              <AppText
                variant="caption"
                tone={serverStatus === 'connected' ? 'positive' : 'negative'}
                style={{ fontWeight: '600' }}
              >
                {serverStatus === 'connected'
                  ? strings.settings.serverConnected
                  : strings.settings.serverDisconnected}
              </AppText>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Edit Profile Sheet */}
      <EditProfileSheet
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        currentUser={user}
        onSuccess={(updated) => setUser(updated)}
      />

      {/* Currency Change Confirmation */}
      <ConfirmDialog
        visible={confirmCurrencyVisible}
        title="تغيير العملة الأساسية"
        message={strings.settings.baseCurrencyWarning}
        confirmLabel="تأكيد التغيير"
        cancelLabel={strings.common.cancel}
        onConfirm={handleConfirmCurrency}
        onCancel={() => setConfirmCurrencyVisible(false)}
      />

      {/* Logout All Devices Confirmation */}
      <ConfirmDialog
        visible={confirmLogoutAllVisible}
        title={strings.settings.logoutAll}
        message={strings.settings.logoutAllConfirm}
        confirmLabel={strings.settings.logoutAll}
        cancelLabel={strings.common.cancel}
        isDestructive
        loading={logoutLoading}
        onConfirm={() => handleLogout(true)}
        onCancel={() => setConfirmLogoutAllVisible(false)}
      />

      {/* Delete Account Confirmation */}
      <ConfirmDialog
        visible={confirmDeleteAccountVisible}
        title="حذف الحساب نهائياً"
        message="سيُحذف حسابك وجميع بياناتك بشكل دائم ولا يمكن استعادتها. هل أنت متأكد؟"
        confirmLabel="حذف حسابي"
        cancelLabel={strings.common.cancel}
        isDestructive
        loading={deletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDeleteAccountVisible(false)}
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
});
