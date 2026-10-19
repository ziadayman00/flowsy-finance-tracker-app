import React from 'react';
import { View, Modal, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { strings } from '../../utils/strings.ar';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = strings.common.confirm,
  cancelLabel = strings.common.cancel,
  isDestructive = true,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const { colors, radii, spacing } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <View
          style={[
            styles.dialogCard,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              borderColor: colors.border,
              padding: spacing.xl,
            },
          ]}
        >
          <AppText variant="title2" style={styles.title}>
            {title}
          </AppText>

          <AppText variant="body" tone="secondary" style={styles.message}>
            {message}
          </AppText>

          <View style={[styles.actionsRow, { gap: spacing.md }]}>
            <Button
              title={cancelLabel}
              variant="secondary"
              onPress={onCancel}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <Button
              title={confirmLabel}
              variant={isDestructive ? 'destructive' : 'primary'}
              onPress={onConfirm}
              style={{ flex: 1 }}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 400,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    textAlign: 'right',
    marginBottom: 8,
  },
  message: {
    textAlign: 'right',
    marginBottom: 24,
    lineHeight: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
