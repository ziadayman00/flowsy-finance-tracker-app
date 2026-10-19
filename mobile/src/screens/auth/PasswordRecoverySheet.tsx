import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { Sheet, AppText, Button, Icon } from '../../components/primitives';
import { strings } from '../../utils/strings.ar';
import { haptics } from '../../utils/haptics';

interface PasswordRecoverySheetProps {
  visible: boolean;
  onClose: () => void;
}

export const PasswordRecoverySheet: React.FC<PasswordRecoverySheetProps> = ({
  visible,
  onClose,
}) => {
  const { colors, spacing, radii } = useTheme();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={strings.auth.passwordRecoveryTitle}
      footer={<Button title={strings.auth.close} variant="primary" onPress={onClose} />}
    >
      <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
        <View style={[styles.iconContainer, { backgroundColor: colors.sunken, borderRadius: radii.md }]}>
          <Icon name="key-outline" size={32} color={colors.forest} />
          <AppText variant="title3" style={{ marginTop: 12, textAlign: 'center' }}>
            استعادة كلمة المرور
          </AppText>
          <AppText
            variant="body"
            tone="secondary"
            style={{ textAlign: 'center', marginTop: 8, lineHeight: 22 }}
          >
            {strings.auth.passwordRecoveryNotice}
          </AppText>
        </View>

        {/* Support Card */}
        <View style={[styles.supportCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md }]}>
          <Icon name="mail-outline" size={20} color={colors.forest} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="secondary">فريق دعم Flowsy المالي</AppText>
            <AppText variant="bodyStrong" style={{ writingDirection: 'ltr', marginTop: 2 }}>
              {strings.auth.supportEmail}
            </AppText>
          </View>
        </View>

        <AppText variant="caption" tone="secondary" style={{ textAlign: 'center', opacity: 0.8 }}>
          يتم الرد على طلبات استعادة الحسابات والتحقق من الهوية خلال وقت قصير لضمان أمان أموالك.
        </AppText>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    padding: 24,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
  },
});
