import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Button,
} from '../../components/primitives';
import { usersApi } from '../../api/users';
import { UserProfileDto } from '../../api/types';
import { getErrorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

interface EditProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  currentUser: UserProfileDto | null;
  onSuccess?: (updatedUser: UserProfileDto) => void;
}

export const EditProfileSheet: React.FC<EditProfileSheetProps> = ({
  visible,
  onClose,
  currentUser,
  onSuccess,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentUser) {
      setName(currentUser.displayName);
      setErrorMessage(null);
    }
  }, [visible, currentUser]);

  const isValid = name.trim().length >= 2 && name.trim().length <= 50;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const updated = await usersApi.updateProfile({ displayName: name.trim() });
      haptics.notificationSuccess();
      showToast('تم تحديث الاسم بنجاح');
      onSuccess?.(updated);
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
      title="تعديل الحساب"
      isDirty={!!currentUser && name.trim() !== currentUser.displayName}
      footer={
        <Button
          title="حفظ"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isValid || submitting}
        />
      }
    >
      <View style={{ paddingBottom: 16 }}>
        <View style={{ marginBottom: spacing.md }}>
          <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
            الاسم
          </AppText>
          <TextInput
            value={name}
            onChangeText={(txt) => setName(txt.slice(0, 50))}
            placeholder="اسمك"
            placeholderTextColor={colors.textTertiary}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.md,
                color: colors.textPrimary,
                paddingHorizontal: 12,
              },
            ]}
          />
        </View>

        {currentUser && (
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
              الإيميل (للقراءة فقط)
            </AppText>
            <View
              style={[
                styles.readOnlyField,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderRadius: radii.md,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <AppText variant="body" tone="secondary" style={{ writingDirection: 'ltr' }}>
                {currentUser.email}
              </AppText>
            </View>
          </View>
        )}

        {errorMessage && (
          <AppText variant="caption" tone="negative" style={{ marginBottom: 8 }}>
            {errorMessage}
          </AppText>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    height: 44,
    fontSize: 15,
  },
  readOnlyField: {
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
  },
});
