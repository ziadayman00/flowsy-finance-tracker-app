import React, { useRef, useEffect } from 'react';
import {
  View,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { strings } from '../../utils/strings.ar';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  isDirty?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
  noHorizontalPadding?: boolean;
  contentPaddingHorizontal?: number;
}

export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  isDirty = false,
  children,
  footer,
  contentStyle,
  noHorizontalPadding = false,
  contentPaddingHorizontal,
}) => {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(600)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 28,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(600);
      opacityAnim.setValue(0);
    }
  }, [visible, slideAnim, opacityAnim]);

  const handleDismissAttempt = () => {
    if (isDirty) {
      Alert.alert(
        strings.common.discardTitle,
        '',
        [
          { text: strings.common.discardStay, style: 'cancel' },
          { text: strings.common.discardLeave, style: 'destructive', onPress: triggerDismiss },
        ],
        { cancelable: true },
      );
      return;
    }
    triggerDismiss();
  };

  const triggerDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  const horizontalPad = noHorizontalPadding
    ? 0
    : contentPaddingHorizontal ?? spacing.lg;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismissAttempt}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {/* Scrim Backdrop */}
        <Animated.View
          style={[
            styles.scrim,
            {
              backgroundColor: colors.scrim,
              opacity: opacityAnim,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismissAttempt} />
        </Animated.View>

        {/* Bottom Sheet Card */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Subtle Pull Handle */}
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header Row */}
          <View
            style={[
              styles.header,
              {
                paddingHorizontal: spacing.lg,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {title ? (
              <View style={{ flex: 1 }}>
                <AppText variant="title2" numberOfLines={1} style={styles.titleText}>
                  {title}
                </AppText>
                {subtitle && (
                  <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ textAlign: 'right', marginTop: 2 }}>
                    {subtitle}
                  </AppText>
                )}
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <Pressable
              onPress={handleDismissAttempt}
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.sunken,
                  borderColor: colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="إغلاق النافذة"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Sheet Main Content */}
          <View
            style={[
              styles.content,
              { paddingHorizontal: horizontalPad },
              contentStyle,
            ]}
          >
            {children}
          </View>

          {/* Docked Footer Area (Pinned above safe area) */}
          {footer && (
            <View
              style={[
                styles.footerContainer,
                {
                  borderTopColor: colors.border,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.md,
                },
              ]}
            >
              {footer}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    maxHeight: '92%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleText: {
    textAlign: 'right',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 12,
  },
  content: {
    flexShrink: 1,
    paddingTop: 8,
  },
  footerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
