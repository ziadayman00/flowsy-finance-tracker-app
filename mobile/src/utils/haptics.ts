import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean) {
  hapticsEnabled = enabled;
}

export function isHapticsEnabled() {
  return hapticsEnabled;
}

export async function hapticSelection(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticError(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticDeleteImpact(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Ignore haptic failures
  }
}

export const haptics = {
  selection: hapticSelection,
  notificationSuccess: hapticSuccess,
  notificationError: hapticError,
  impactMedium: hapticDeleteImpact,
  impactLight: hapticSelection,
};
