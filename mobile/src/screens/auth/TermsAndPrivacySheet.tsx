import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { Sheet, AppText, Button, Icon, Divider } from '../../components/primitives';

interface TermsAndPrivacySheetProps {
  visible: boolean;
  onClose: () => void;
}

export const TermsAndPrivacySheet: React.FC<TermsAndPrivacySheetProps> = ({
  visible,
  onClose,
}) => {
  const { colors, spacing, radii } = useTheme();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="شروط الخدمة وسياسة الخصوصية"
      footer={<Button title="فهمت وموافق" variant="primary" onPress={onClose} />}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
      >
        {/* Intro */}
        <View style={[styles.highlightBox, { backgroundColor: colors.sunken, borderRadius: radii.md }]}>
          <Icon name="shield-checkmark-outline" size={24} color={colors.forest} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="bodyStrong">مبدأ Flowsy الأول: بياناتك ملكك وحدك</AppText>
            <AppText variant="caption" tone="secondary">
              تطبيق Flowsy مصمم لحماية خصوصيتك المالية وعدم مشاركتها أو بيعها لأي جهة إعلانية أو طرف ثالث إطلاقاً.
            </AppText>
          </View>
        </View>

        {/* Section 1: البيانات المالية */}
        <View style={styles.section}>
          <AppText variant="title3" style={{ marginBottom: 4 }}>١. بياناتك المالية وحساباتك</AppText>
          <AppText variant="body" tone="secondary" style={styles.paragraph}>
            جميع المعاملات، الحسابات، الالتزامات والميزانيات التي تسجلها في التطبيق تُعالج بأمان عبر اتصال مشفر (HTTPS/TLS) ومخزنة في قواعد بيانات مشفرة.
          </AppText>
        </View>

        <Divider />

        {/* Section 2: عدم بيع البيانات */}
        <View style={styles.section}>
          <AppText variant="title3" style={{ marginBottom: 4 }}>٢. لا إعلانات ولا بيع بيانات</AppText>
          <AppText variant="body" tone="secondary" style={styles.paragraph}>
            لا نستخدم بياناتك المالية في استهداف إعلاني أو بيع معلومات للمعلنين أو السماسرة الماليين. نموذج عمل التطبيق يقوم على الثقة والخدمة المباشرة للمستخدم.
          </AppText>
        </View>

        <Divider />

        {/* Section 3: تصدير وحذف الحساب */}
        <View style={styles.section}>
          <AppText variant="title3" style={{ marginBottom: 4 }}>٣. حق التصدير والحذف الكامل (GDPR)</AppText>
          <AppText variant="body" tone="secondary" style={styles.paragraph}>
            يمكنك في أي وقت تصدير كافة بياناتك المالية بصيغة ملف رقمي كامل من شاشة الإعدادات، كما يمكنك حذف حسابك وجميع بياناتك وسجلاتك نهائياً بضغطة زر واحدة دون رجعة.
          </AppText>
        </View>

        <Divider />

        {/* Section 4: التواصل والدعم */}
        <View style={styles.section}>
          <AppText variant="title3" style={{ marginBottom: 4 }}>٤. الأمان والتواصل</AppText>
          <AppText variant="body" tone="secondary" style={styles.paragraph}>
            تُحفظ كلمات السر باستخدام خوارزميات التشفير المتقدمة (Argon2id). لأي استفسار أو طلب مساعدة بخصوص الخصوصية، تواصل معنا عبر البريد: support@flowsy.app
          </AppText>
        </View>
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
  },
  section: {
    gap: 4,
  },
  paragraph: {
    lineHeight: 22,
    textAlign: 'right',
  },
});
