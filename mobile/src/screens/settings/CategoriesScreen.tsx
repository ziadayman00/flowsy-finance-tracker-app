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
  Segmented,
  Divider,
} from '../../components/primitives';
import { categoriesApi } from '../../api/categories';
import { CategoryResponseDto, CategoryType } from '../../api/types';
import { displayName } from '../../utils/names';
import { CategoryEditorSheet } from './CategoryEditorSheet';

interface CategoriesScreenProps {
  onBack: () => void;
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({ onBack }) => {
  const { colors, radii, spacing } = useTheme();

  const [activeType, setActiveType] = useState<CategoryType>('EXPENSE');
  const [categories, setCategories] = useState<CategoryResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryResponseDto | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoriesApi.getCategories();
      setCategories(cats);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const filteredByType = useMemo(
    () => categories.filter((c) => c.type === activeType),
    [categories, activeType]
  );

  const customCategories = useMemo(
    () => filteredByType.filter((c) => !c.isSystem && !c.isArchived),
    [filteredByType]
  );

  const systemCategories = useMemo(
    () => filteredByType.filter((c) => c.isSystem && !c.isArchived),
    [filteredByType]
  );

  const archivedCategories = useMemo(
    () => filteredByType.filter((c) => c.isArchived),
    [filteredByType]
  );

  const renderCategoryRow = (cat: CategoryResponseDto, canEdit: boolean) => (
    <Pressable
      key={cat.id}
      disabled={!canEdit}
      onPress={() => {
        if (canEdit) {
          setSelectedCategory(cat);
          setEditorVisible(true);
        }
      }}
      style={[
        styles.catRow,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: colors.surfaceSubtle },
        ]}
      >
        <Icon
          name={cat.icon || 'receipt-outline'}
          size={18}
          color={colors.textPrimary}
        />
      </View>

      <AppText variant="bodyStrong" style={{ flex: 1, marginStart: 12 }}>
        {displayName(cat.name)}
      </AppText>

      {cat.isSystem ? (
        <Icon name="lock-closed-outline" size={16} color={colors.textTertiary} />
      ) : (
        <Icon name="chevron-forward" size={16} color={colors.textTertiary} isRTLMirrored />
      )}
    </Pressable>
  );

  return (
    <Screen scrollable={false}>
      {/* Header */}
      <View
        style={[
          styles.headerRow,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          },
        ]}
      >
        <Pressable onPress={onBack} hitSlop={8}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} isRTLMirrored />
        </Pressable>

        <AppText variant="title2">التصنيفات</AppText>

        <Pressable
          onPress={() => {
            setSelectedCategory(null);
            setEditorVisible(true);
          }}
          style={[
            styles.addBtn,
            { backgroundColor: colors.brand, borderColor: colors.brand },
          ]}
          accessibilityRole="button"
        >
          <Icon name="add" size={20} color={colors.textInverse} />
        </Pressable>
      </View>

      {/* Segmented Control */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Segmented
          options={[
            { label: 'مصروفات', value: 'EXPENSE' },
            { label: 'دخل', value: 'INCOME' },
          ]}
          selectedValue={activeType}
          onSelect={(val) => setActiveType(val as CategoryType)}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Custom Categories */}
          <View style={{ marginTop: spacing.sm }}>
            <AppText
              variant="label"
              tone="secondary"
              style={{ marginHorizontal: spacing.lg, marginBottom: 8 }}
            >
              تصنيفاتي ({customCategories.length})
            </AppText>
            {customCategories.length === 0 ? (
              <View style={{ padding: spacing.md, alignItems: 'center' }}>
                <AppText variant="caption" tone="secondary">
                  مفيش تصنيفات مخصصة — اضغط + لإضافة تصنيف جديد
                </AppText>
              </View>
            ) : (
              customCategories.map((cat) => renderCategoryRow(cat, true))
            )}
          </View>

          {/* System Categories */}
          <View style={{ marginTop: spacing.lg }}>
            <AppText
              variant="label"
              tone="secondary"
              style={{ marginHorizontal: spacing.lg, marginBottom: 8 }}
            >
              التصنيفات الأساسية ({systemCategories.length})
            </AppText>
            {systemCategories.map((cat) => renderCategoryRow(cat, false))}
          </View>

          {/* Archived Categories */}
          {archivedCategories.length > 0 && (
            <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
              <Pressable
                onPress={() => setShowArchived(!showArchived)}
                style={styles.archivedToggle}
              >
                <AppText variant="caption" tone="secondary">
                  المؤرشفة ({archivedCategories.length})
                </AppText>
                <Icon
                  name={showArchived ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>

              {showArchived && (
                <View style={{ marginTop: 8, opacity: 0.75 }}>
                  {archivedCategories.map((cat) => renderCategoryRow(cat, true))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Category Editor Sheet */}
      <CategoryEditorSheet
        visible={editorVisible}
        onClose={() => {
          setEditorVisible(false);
          setSelectedCategory(null);
        }}
        categoryToEdit={selectedCategory}
        defaultType={activeType}
        onSuccess={loadCategories}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
