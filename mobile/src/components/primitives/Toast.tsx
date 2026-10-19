import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { AppText } from './AppText';

export interface ToastMessage {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.durationMs || (toast.onAction ? 6000 : 4000));

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(20);
      opacity.setValue(0);
    }
  }, [toast]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 20,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          bottom: Math.max(insets.bottom + 65, 80),
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.toastCard,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderColor: colors.border,
            shadowColor: colors.stampFrom,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {toast.message}
        </AppText>

        {toast.actionLabel && toast.onAction && (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              handleDismiss();
            }}
            style={styles.actionBtn}
            accessibilityRole="button"
          >
            <AppText variant="label" tone="positive" style={{ fontWeight: '600' }}>
              {toast.actionLabel}
            </AppText>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginStart: 8,
  },
});
