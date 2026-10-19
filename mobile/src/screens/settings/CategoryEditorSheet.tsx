import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useTheme } from '../../theme';
import {
  Sheet,
  AppText,
  Icon,
  Button,
  ConfirmDialog,
} from '../../components/primitives';
import { categoriesApi } from '../../api/categories';
import { CategoryResponseDto, CategoryType } from '../../api/types';
import { displayName } from '../../utils/names';
import { getErrorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';
import { useToast } from '../../context/ToastContext';

const CURATED_ICONS = [
  'receipt-outline',
  'restaurant-outline',
  'cart-outline',
  'car-outline',
  'home-outline',
  'flash-outline',
  'medkit-outline',
  'cafe-outline',
  'fitness-outline',
  'gift-outline',
  'school-outline',
  'airplane-outline',
  'game-controller-outline',
  'film-outline',
  'shirt-outline',
  'paw-outline',
  'briefcase-outline',
  'cash-outline',
  'card-outline',
  'wallet-outline',
  'trending-up-outline',
  'pricetag-outline',
  'book-outline',
  'build-outline',
];

interface CategoryEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  categoryToEdit?: CategoryResponseDto | null;
  defaultType?: CategoryType;
  onSuccess?: () => void;
}

export const CategoryEditorSheet: React.FC<CategoryEditorSheetProps> = ({
  visible,
  onClose,
  categoryToEdit,
  defaultType = 'EXPENSE',
  onSuccess,
}) => {
  const { colors, radii, spacing } = useTheme();
  const { showToast } = useToast();

  const isEditMode = !!categoryToEdit;

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('receipt-outline');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleteGuidanceMessage, setDeleteGuidanceMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setSelectedIcon(categoryToEdit.icon || 'receipt-outline');
      } else {
        setName('');
        setSelectedIcon('receipt-outline');
      }
      setErrorMessage(null);
      setDeleteGuidanceMessage(null);
    }
  }, [visible, categoryToEdit]);

  const isValid = name.trim().length >= 1 && name.trim().length <= 50;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      if (isEditMode && categoryToEdit) {
        await categoriesApi.updateCategory(categoryToEdit.id, {
          name: name.trim(),
          icon: selectedIcon,
        });
        haptics.notificationSuccess();
        showToast('تم تعديل التصنيف');
      } else {
        await categoriesApi.createCategory({
          name: name.trim(),
          type: defaultType,
          icon: selectedIcon,
        });
        haptics.notificationSuccess();
        showToast('تمت إضافة التصنيف');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      haptics.notificationError();
      setErrorMessage(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!categoryToEdit) return;

    try {
      setActionLoading(true);
      await categoriesApi.updateCategory(categoryToEdit.id, {
        isArchived: !categoryToEdit.isArchived,
      });

      haptics.notificationSuccess();
      showToast(categoryToEdit.isArchived ? 'تم استرجاع التصنيف' : 'تمت أرشفة التصنيف');
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToEdit) return;

    try {
      setActionLoading(true);
      setDeleteGuidanceMessage(null);
      await categoriesApi.deleteCategory(categoryToEdit.id);

      haptics.impactMedium();
      showToast('تم حذف التصنيف');
      setConfirmDeleteVisible(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.includes('used') || msg.includes('معاملات') || msg.includes('400')) {
        setDeleteGuidanceMessage('التصنيف ده مستخدم — أرشفه بدل الحذف');
      } else {
        setDeleteGuidanceMessage(msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title={isEditMode ? 'تعديل التصنيف' : 'تصنيف جديد'}
        isDirty={!!name}
        footer={
          <View style={{ gap: spacing.xs }}>
            <Button
              title="حفظ التصنيف"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!isValid || submitting}
            />
            {isEditMode && categoryToEdit && !categoryToEdit.isSystem && (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={categoryToEdit.isArchived ? 'استرجاع' : 'أرشفة'}
                  variant="secondary"
                  loading={actionLoading}
                  onPress={handleToggleArchive}
                  style={{ flex: 1 }}
                />
                <Button
                  title="حذف"
                  variant="destructive"
                  onPress={() => {
                    setDeleteGuidanceMessage(null);
                    setConfirmDeleteVisible(true);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name field */}
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="label" tone="secondary" style={{ marginBottom: 4 }}>
              اسم التصنيف
            </AppText>
            <TextInput
              value={name}
              onChangeText={(txt) => setName(txt.slice(0, 50))}
              placeholder="مثال: مطاعم وكافيهات"
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

          {/* Icon Picker */}
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="label" tone="secondary" style={{ marginBottom: 8 }}>
              أيقونة التصنيف
            </AppText>
            <View style={styles.iconGrid}>
              {CURATED_ICONS.map((iconName) => {
                const isSelected = selectedIcon === iconName;
                return (
                  <Pressable
                    key={iconName}
                    onPress={() => setSelectedIcon(iconName)}
                    style={[
                      styles.iconCell,
                      {
                        backgroundColor: isSelected
                          ? colors.brand
                          : colors.surface,
                        borderColor: isSelected ? colors.brand : colors.border,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Icon
                      name={iconName}
                      size={20}
                      color={isSelected ? colors.textInverse : colors.textPrimary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {errorMessage && (
            <AppText variant="caption" tone="negative" style={{ marginBottom: 8 }}>
              {errorMessage}
            </AppText>
          )}

        <View style={{ height: 16 }} />
        </ScrollView>
      </Sheet>

      {/* Delete Confirmation */}
      <ConfirmDialog
        visible={confirmDeleteVisible}
        title="حذف التصنيف"
        message={
          deleteGuidanceMessage ||
          'هل أنت متأكد من حذف هذا التصنيف؟'
        }
        confirmLabel={deleteGuidanceMessage ? 'أرشفه بدل الحذف' : 'احذف'}
        cancelLabel="إلغاء"
        isDestructive={!deleteGuidanceMessage}
        loading={actionLoading}
        onConfirm={() => {
          if (deleteGuidanceMessage) {
            setConfirmDeleteVisible(false);
            handleToggleArchive();
          } else {
            handleDeleteCategory();
          }
        }}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    height: 44,
    fontSize: 15,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
